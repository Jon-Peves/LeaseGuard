"""Runs the Gemini comparison for a submitted inspection, one area at a time."""
import logging
import threading
import time

from django.conf import settings
from django.db import close_old_connections

from .models import Activity, Inspection, Photo
from .services import AIComparisonError, compare_images
from .storage import StorageError, download_photo

log = logging.getLogger(__name__)

# Gemini sometimes answers "overloaded" (503) or "too many requests" (429).
# Those pass on their own, so wait and try again before giving up.
RETRY_WAITS = (5, 15)
TEMPORARY_ERRORS = ('503', '429', 'UNAVAILABLE', 'RESOURCE_EXHAUSTED')


def compare_with_retry(*args, **kwargs):
    for wait in (*RETRY_WAITS, None):
        try:
            return compare_images(*args, **kwargs)
        except AIComparisonError as error:
            if wait is None or not any(code in str(error) for code in TEMPORARY_ERRORS):
                raise
            log.info('Gemini busy, retrying in %ss: %s', wait, error)
            time.sleep(wait)


def latest_photo_urls(unit, kind, inspection=None):
    photos = Photo.objects.filter(unit=unit, kind=kind, inspection=inspection).order_by('created_at')
    return {photo.area: photo.url for photo in photos}  # newest wins


def is_verified(result):
    """A photo counts as a real, usable match when Gemini says it shows the same
    area as the baseline and the image is clear enough to judge."""
    return result.get('photo_quality') == 'good' and bool(result.get('same_area'))


def review_inspection(inspection_id):
    inspection = Inspection.objects.select_related('unit__property').get(pk=inspection_id)
    unit = inspection.unit
    baseline = latest_photo_urls(unit, Photo.Kind.BASELINE)
    current = latest_photo_urls(unit, Photo.Kind.INSPECTION, inspection)
    results = {}
    for area in inspection.areas:
        if area not in current:
            results[area] = {'error': 'The tenant did not upload a photo for this area.'}
            continue
        if area not in baseline:
            results[area] = {'error': 'There is no move-in baseline photo for this area.'}
            continue
        try:
            results[area] = compare_with_retry(
                download_photo(baseline[area]), download_photo(current[area]),
                room=area, area=area,
                known_issues=unit.baseline_notes.get(area),
                tenant_notes=inspection.tenant_notes.get(area),
            )
        except (AIComparisonError, StorageError, OSError) as error:
            log.warning('AI comparison failed for %s / %s: %s', inspection.key, area, error)
            busy = any(code in str(error) for code in TEMPORARY_ERRORS)
            results[area] = {'error': 'Gemini was too busy to check this photo. Run the AI review again in a minute.'
                             if busy else 'The AI comparison could not run for this photo.'}

    compared = [r for r in results.values() if 'error' not in r]
    inspection.ai_results = results
    inspection.ai_status = Inspection.AIStatus.DONE if compared else Inspection.AIStatus.ERROR
    inspection.save(update_fields=['ai_results', 'ai_status'])

    flagged = sum(1 for r in compared if r.get('classification') == 'damage' or not is_verified(r))
    Activity.objects.create(
        landlord=unit.property.owner,
        title=f'AI review ready for Unit {unit.name}',
        detail=(f'{flagged} area{"s" if flagged != 1 else ""} need a look' if flagged
                else 'No damage found'),
    )


def _run(inspection_id):
    close_old_connections()
    try:
        review_inspection(inspection_id)
    except Exception:  # never leave the inspection stuck on "pending"
        log.exception('AI review crashed for inspection %s', inspection_id)
        Inspection.objects.filter(pk=inspection_id).update(ai_status=Inspection.AIStatus.ERROR)
    finally:
        close_old_connections()


def start_review(inspection):
    inspection.ai_status = Inspection.AIStatus.PENDING
    inspection.ai_results = {}
    inspection.save(update_fields=['ai_status', 'ai_results'])
    if getattr(settings, 'INSPECTIONS_AI_SYNC', False):
        _run(inspection.pk)
    else:
        # Gemini takes a few seconds per photo, so answer the tenant right away.
        threading.Thread(target=_run, args=(inspection.pk,), daemon=True).start()
