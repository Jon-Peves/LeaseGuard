"""JSON endpoints for the landlord and tenant screens.

Shapes match frontend/src/data/demoStore.ts so the app can swap the demo store
for these endpoints without changing its screens.
"""
import json
import re
from datetime import date
from functools import wraps

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from accounts.models import AccountProfile

from .models import Activity, AppState, Inspection, Photo, Property, TenantLink, Unit
from .review import latest_photo_urls, start_review
from .storage import ALLOWED_TYPES, MAX_UPLOAD_BYTES, StorageError, upload_photo

KEY_RE = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
MAX_AREAS, MIN_AREAS = 10, 2


class BadRequest(Exception):
    pass


# ---------- helpers ----------

def short_date(value):
    return f'{value:%b} {value.day}' if value else None


def day_label(moment):
    days = (timezone.localdate() - timezone.localtime(moment).date()).days
    return 'Today' if days == 0 else 'Yesterday' if days == 1 else short_date(moment)


def body(request):
    try:
        data = json.loads(request.body or b'{}')
    except (ValueError, UnicodeDecodeError):
        raise BadRequest('Invalid request.')
    if not isinstance(data, dict):
        raise BadRequest('Invalid request.')
    return data


def text(data, name, max_length, required=True):
    value = data.get(name, '')
    if not isinstance(value, str) or len(value.strip()) > max_length:
        raise BadRequest(f'Invalid {name}.')
    value = value.strip()
    if required and not value:
        raise BadRequest(f'Enter {name}.')
    return value


def key(data, name):
    value = data.get(name)
    if not isinstance(value, str) or not KEY_RE.match(value):
        raise BadRequest(f'Invalid {name}.')
    return value


def area_list(value):
    if (not isinstance(value, list) or not MIN_AREAS <= len(value) <= MAX_AREAS
            or not all(isinstance(a, str) and 0 < len(a.strip()) <= 60 for a in value)):
        raise BadRequest(f'Use {MIN_AREAS}–{MAX_AREAS} areas.')
    areas = [a.strip() for a in value]
    if len({a.lower() for a in areas}) != len(areas):
        raise BadRequest('Area names must be different.')
    return areas


def email_value(data):
    from django.core.exceptions import ValidationError
    from django.core.validators import validate_email
    email = text(data, 'email', 254)
    try:
        validate_email(email)
    except ValidationError:
        raise BadRequest('Enter a valid email address.')
    return email.lower()


def role_required(role):
    def decorate(view):
        @wraps(view)
        @never_cache
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({'detail': 'Please sign in.'}, status=401)
            if not AccountProfile.objects.filter(user=request.user, role=role).exists():
                return JsonResponse({'detail': 'This account cannot do that.'}, status=403)
            try:
                return view(request, *args, **kwargs)
            except BadRequest as error:
                return JsonResponse({'detail': str(error)}, status=400)
            except (Unit.DoesNotExist, Inspection.DoesNotExist, TenantLink.DoesNotExist):
                return JsonResponse({'detail': 'Not found.'}, status=404)
        return wrapped
    return decorate


def display_name(user):
    return user.get_full_name() or user.email or 'Your landlord'


# ---------- serializers ----------

def inspection_data(inspection):
    data = {
        'id': inspection.key, 'kind': inspection.kind, 'areas': inspection.areas,
        'status': inspection.status, 'createdOn': short_date(inspection.created_on),
        'photos': latest_photo_urls(inspection.unit, Photo.Kind.INSPECTION, inspection),
    }
    if inspection.due_date:
        data['dueDate'] = inspection.due_date
    if inspection.kind == Inspection.Kind.IN_PERSON:
        data['slots'] = inspection.slots
        data['tenantSlots'] = inspection.tenant_slots
    if inspection.confirmed_slot:
        data['confirmedSlot'] = inspection.confirmed_slot
    if inspection.submitted_on:
        data['submittedOn'] = short_date(inspection.submitted_on)
    if inspection.tenant_notes:
        data['notes'] = inspection.tenant_notes
    if inspection.ai_status:
        data['ai'] = {'status': inspection.ai_status, 'results': inspection.ai_results}
    return data


def tenant_link_data(link):
    data = {'email': link.email, 'status': link.status, 'invitedOn': short_date(link.invited_on)}
    if link.name:
        data['name'] = link.name
    if link.joined_on:
        data['joinedOn'] = short_date(link.joined_on)
    if link.declined_on:
        data['declinedOn'] = short_date(link.declined_on)
    return data


def unit_data(unit):
    data = {
        'id': unit.key, 'name': unit.name, 'bedrooms': unit.bedrooms,
        'bathrooms': unit.bathrooms, 'areas': unit.areas,
        'baselinePhotos': latest_photo_urls(unit, Photo.Kind.BASELINE),
        'inspections': [inspection_data(i) for i in unit.inspections.order_by('created_at')],
    }
    link = TenantLink.objects.filter(unit=unit).first()
    if link:
        data['tenant'] = tenant_link_data(link)
    if unit.baseline_recorded_on:
        data['baselineRecordedOn'] = short_date(unit.baseline_recorded_on)
    if unit.baseline_notes:
        data['baselineNotes'] = unit.baseline_notes
    return data


def invite_data(link):
    unit = link.unit
    prop = unit.property
    return {
        'email': link.email, 'landlordId': str(prop.owner_id),
        'landlordName': display_name(prop.owner), 'propertyId': prop.key,
        'unitId': unit.key, 'street': prop.street, 'city': prop.city,
        'unit': unit.name, 'bedrooms': unit.bedrooms, 'bathrooms': unit.bathrooms,
        'areaCount': len(unit.areas),
    }


def unit_details(link):
    unit = link.unit
    latest = unit.inspections.order_by('-created_at').first()
    data = {
        'areas': unit.areas,
        'baselinePhotos': latest_photo_urls(unit, Photo.Kind.BASELINE),
        'landlordName': display_name(unit.property.owner),
        'baselineNotes': unit.baseline_notes,
    }
    if unit.baseline_recorded_on:
        data['baselineRecordedOn'] = short_date(unit.baseline_recorded_on)
    if latest:
        tenant_view = inspection_data(latest)
        tenant_view.pop('ai', None)  # AI findings go to the landlord only
        data['inspection'] = tenant_view
    return data


def landlord_state(user):
    state = AppState.for_user(user)
    properties = []
    for prop in Property.objects.filter(owner=user).order_by('created_at'):
        properties.append({
            'id': prop.key, 'street': prop.street, 'city': prop.city,
            'units': [unit_data(u) for u in prop.units.order_by('created_at')],
        })
    activity = [
        {'id': str(a.pk), 'title': a.title,
         'detail': f'{day_label(a.created_at)} • {a.detail}' if a.detail else day_label(a.created_at)}
        for a in Activity.objects.filter(landlord=user).order_by('-created_at')[:20]
    ]
    return {'consented': state.landlord_consented, 'properties': properties, 'activity': activity}


def tenant_state(user):
    state = AppState.for_user(user)
    link = (TenantLink.objects.filter(tenant=user, status=TenantLink.Status.JOINED)
            .select_related('unit__property__owner').first())
    pending = (TenantLink.objects.filter(email__iexact=user.email, status=TenantLink.Status.PENDING)
               .exclude(tenant=user).select_related('unit__property__owner')
               .order_by('-invited_on').first())
    move_photos = {}
    if link:
        photos = Photo.objects.filter(unit=link.unit, kind=Photo.Kind.MOVE_IN,
                                      uploaded_by=user).order_by('created_at')
        move_photos = {p.area: p.url for p in photos}
    return {
        'consented': state.tenant_consented, 'welcomed': state.tenant_welcomed,
        'baselineReviewed': state.baseline_reviewed, 'movePhotos': move_photos,
        'unit': invite_data(link) if link else None,
        'details': unit_details(link) if link else None,
        'pendingInvite': invite_data(pending) if pending else None,
    }


# ---------- landlord ----------

def owned_unit(request, unit_key):
    return Unit.objects.select_related('property').get(key=unit_key, property__owner=request.user)


def owned_inspection(request, inspection_key):
    return Inspection.objects.select_related('unit__property').get(
        key=inspection_key, unit__property__owner=request.user)


def invite(unit, email):
    TenantLink.objects.filter(unit=unit).delete()
    return TenantLink.objects.create(unit=unit, email=email, invited_on=timezone.localdate())


@require_GET
@role_required('landlord')
def landlord_state_view(request):
    return JsonResponse(landlord_state(request.user))


@require_POST
@csrf_protect
@role_required('landlord')
def landlord_consent(request):
    state = AppState.for_user(request.user)
    state.landlord_consented = True
    state.save(update_fields=['landlord_consented'])
    return JsonResponse(landlord_state(request.user))


@require_POST
@csrf_protect
@role_required('landlord')
def add_property(request):
    data = body(request)
    prop = Property.objects.create(
        key=key(data, 'propertyId'), owner=request.user,
        street=text(data, 'street', 200), city=text(data, 'city', 200, required=False))
    unit = Unit.objects.create(
        key=key(data, 'unitId'), property=prop, name=text(data, 'unit', 40),
        bedrooms=text(data, 'bedrooms', 4, required=False),
        bathrooms=text(data, 'bathrooms', 4, required=False),
        areas=area_list(data.get('areas')))
    if data.get('email'):
        invite(unit, email_value(data))
    return JsonResponse(landlord_state(request.user), status=201)


@require_POST
@csrf_protect
@role_required('landlord')
def update_unit(request, unit_key):
    unit = owned_unit(request, unit_key)
    data = body(request)
    unit.name = text(data, 'name', 40)
    unit.bedrooms = text(data, 'bedrooms', 4, required=False)
    unit.bathrooms = text(data, 'bathrooms', 4, required=False)
    unit.areas = area_list(data.get('areas'))
    unit.save()
    return JsonResponse(landlord_state(request.user))


@require_http_methods(['POST', 'DELETE'])
@csrf_protect
@role_required('landlord')
def unit_tenant(request, unit_key):
    """POST sends (or re-sends) an invite; DELETE cancels it or removes the tenant."""
    unit = owned_unit(request, unit_key)
    if request.method == 'DELETE':
        TenantLink.objects.filter(unit=unit).delete()
    else:
        invite(unit, email_value(body(request)))
    return JsonResponse(landlord_state(request.user))


@require_POST
@csrf_protect
@role_required('landlord')
def save_baseline(request, unit_key):
    unit = owned_unit(request, unit_key)
    missing = set(unit.areas) - set(latest_photo_urls(unit, Photo.Kind.BASELINE))
    if missing:
        raise BadRequest('Upload a photo for every area first.')
    notes = body(request).get('notes') or {}
    if (not isinstance(notes, dict) or set(notes) - set(unit.areas)
            or not all(isinstance(n, str) and len(n) <= 300 for n in notes.values())):
        raise BadRequest('Notes must be 300 characters or less.')
    unit.baseline_notes = {area: note.strip() for area, note in notes.items() if note.strip()}
    unit.baseline_recorded_on = timezone.localdate()
    unit.save(update_fields=['baseline_recorded_on', 'baseline_notes'])
    return JsonResponse(landlord_state(request.user))


@require_POST
@csrf_protect
@role_required('landlord')
def rename_area(request, unit_key):
    """Rename one area and carry its photos, notes and past AI results over."""
    unit = owned_unit(request, unit_key)
    data = body(request)
    old, new = text(data, 'from', 60), text(data, 'to', 60)
    if old not in unit.areas:
        raise BadRequest('That area is not on this unit.')
    if new != old and new.lower() in {a.lower() for a in unit.areas if a != old}:
        raise BadRequest('Area names must be different.')
    unit.areas = [new if a == old else a for a in unit.areas]
    if old in unit.baseline_notes:
        unit.baseline_notes[new] = unit.baseline_notes.pop(old)
    unit.save(update_fields=['areas', 'baseline_notes'])
    Photo.objects.filter(unit=unit, area=old).update(area=new)
    for inspection in unit.inspections.all():
        if old not in inspection.areas:
            continue
        inspection.areas = [new if a == old else a for a in inspection.areas]
        for field in ('tenant_notes', 'ai_results'):
            values = getattr(inspection, field)
            if old in values:
                values[new] = values.pop(old)
        inspection.save(update_fields=['areas', 'tenant_notes', 'ai_results'])
    return JsonResponse(landlord_state(request.user))


def slot_list(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 10:
        raise BadRequest('Offer 1–10 times.')
    slots = []
    for slot in value:
        if not isinstance(slot, dict):
            raise BadRequest('Invalid time.')
        slots.append({'id': key(slot, 'id'), 'date': iso_date(slot.get('date')),
                      'time': text(slot, 'time', 20)})
    return slots


def iso_date(value):
    try:
        return date.fromisoformat(value).isoformat()
    except (TypeError, ValueError):
        raise BadRequest('Invalid date.')


@require_POST
@csrf_protect
@role_required('landlord')
def schedule_inspection(request, unit_key):
    unit = owned_unit(request, unit_key)
    if not TenantLink.objects.filter(unit=unit, status=TenantLink.Status.JOINED).exists():
        raise BadRequest('A tenant has to join this unit first.')
    if not unit.baseline_recorded_on:
        raise BadRequest('Record the move-in baseline first.')
    data = body(request)
    kind = data.get('kind')
    areas = data.get('areas')
    if (not isinstance(areas, list) or not areas
            or not all(isinstance(a, str) and a in unit.areas for a in areas)):
        raise BadRequest('Pick areas from this unit.')
    fields = dict(key=key(data, 'id'), unit=unit, kind=kind, areas=areas,
                  created_on=timezone.localdate())
    if kind == Inspection.Kind.REMOTE:
        fields.update(status=Inspection.Status.SCHEDULED, due_date=iso_date(data.get('dueDate')))
    elif kind == Inspection.Kind.IN_PERSON:
        fields.update(status=Inspection.Status.AWAITING_TIMES, slots=slot_list(data.get('slots')))
    else:
        raise BadRequest('Invalid inspection type.')
    Inspection.objects.create(**fields)
    return JsonResponse(landlord_state(request.user), status=201)


@require_POST
@csrf_protect
@role_required('landlord')
def confirm_time(request, inspection_key):
    inspection = owned_inspection(request, inspection_key)
    slot = key(body(request), 'slotId')
    if inspection.status != Inspection.Status.TIMES_SENT or slot not in inspection.tenant_slots:
        raise BadRequest('Pick one of the times your tenant chose.')
    inspection.status = Inspection.Status.CONFIRMED
    inspection.confirmed_slot = slot
    inspection.save(update_fields=['status', 'confirmed_slot'])
    return JsonResponse(landlord_state(request.user))


@require_http_methods(['DELETE'])
@csrf_protect
@role_required('landlord')
def cancel_inspection(request, inspection_key):
    owned_inspection(request, inspection_key).delete()
    return JsonResponse(landlord_state(request.user))


@require_POST
@csrf_protect
@role_required('landlord')
def rerun_review(request, inspection_key):
    inspection = owned_inspection(request, inspection_key)
    if inspection.status != Inspection.Status.SUBMITTED or inspection.ai_status == 'pending':
        raise BadRequest('This inspection is not ready for a new AI review.')
    start_review(inspection)
    return JsonResponse(landlord_state(request.user))


# ---------- tenant ----------

def joined_link(request):
    return TenantLink.objects.select_related('unit__property__owner').get(
        tenant=request.user, status=TenantLink.Status.JOINED)


def tenant_inspection(request, inspection_key):
    link = joined_link(request)
    return link, Inspection.objects.get(key=inspection_key, unit=link.unit)


def log_activity(link, title, detail):
    Activity.objects.create(landlord=link.unit.property.owner, title=title, detail=detail)


def tenant_label(request):
    return request.user.get_full_name() or request.user.email


@require_GET
@role_required('tenant')
def tenant_state_view(request):
    return JsonResponse(tenant_state(request.user))


@require_POST
@csrf_protect
@role_required('tenant')
def tenant_progress(request):
    data = body(request)
    state = AppState.for_user(request.user)
    for field, name in (('tenant_welcomed', 'welcomed'), ('tenant_consented', 'consented'),
                        ('baseline_reviewed', 'baselineReviewed')):
        if data.get(name) is True:
            setattr(state, field, True)
    state.save()
    return JsonResponse(tenant_state(request.user))


def pending_link(request, unit_key):
    return TenantLink.objects.select_related('unit__property__owner').get(
        unit__key=unit_key, email__iexact=request.user.email, status=TenantLink.Status.PENDING)


@require_POST
@csrf_protect
@role_required('tenant')
def accept_invite(request):
    link = pending_link(request, key(body(request), 'unitId'))
    # One unit per tenant for now: leaving the old unit frees it for the landlord.
    TenantLink.objects.filter(tenant=request.user).exclude(pk=link.pk).delete()
    link.status = TenantLink.Status.JOINED
    link.tenant = request.user
    link.name = tenant_label(request)
    link.joined_on = timezone.localdate()
    link.save()
    state = AppState.for_user(request.user)
    state.tenant_welcomed = False
    state.baseline_reviewed = False
    state.save()
    log_activity(link, f'{link.name} joined Unit {link.unit.name}',
                 'They can now see the move-in baseline')
    return JsonResponse(tenant_state(request.user))


@require_POST
@csrf_protect
@role_required('tenant')
def decline_invite(request):
    link = pending_link(request, key(body(request), 'unitId'))
    link.status = TenantLink.Status.DECLINED
    link.declined_on = timezone.localdate()
    link.save()
    log_activity(link, f'{tenant_label(request)} declined the invite for Unit {link.unit.name}',
                 'Check the email or invite someone else')
    return JsonResponse(tenant_state(request.user))


@require_POST
@csrf_protect
@role_required('tenant')
def send_availability(request, inspection_key):
    link, inspection = tenant_inspection(request, inspection_key)
    data = body(request)
    choices = data.get('slotIds')
    offered = {s['id'] for s in inspection.slots}
    if inspection.status != Inspection.Status.AWAITING_TIMES:
        raise BadRequest('These times were already answered.')
    if choices == []:
        inspection.status = Inspection.Status.TIMES_DECLINED
        inspection.tenant_slots = []
        log_activity(link, f'None of your times work for {tenant_label(request)}',
                     f'Unit {link.unit.name} • Propose new times')
    elif isinstance(choices, list) and set(choices) <= offered:
        inspection.status = Inspection.Status.TIMES_SENT
        inspection.tenant_slots = choices
        log_activity(link, f'{tenant_label(request)} sent their availability',
                     f'Unit {link.unit.name} • Confirm a time')
    else:
        raise BadRequest('Pick from the offered times.')
    inspection.save(update_fields=['status', 'tenant_slots'])
    return JsonResponse(tenant_state(request.user))


@require_POST
@csrf_protect
@role_required('tenant')
def submit_inspection(request, inspection_key):
    link, inspection = tenant_inspection(request, inspection_key)
    if inspection.kind != Inspection.Kind.REMOTE or inspection.status != Inspection.Status.SCHEDULED:
        raise BadRequest('This inspection cannot be submitted.')
    photos = latest_photo_urls(link.unit, Photo.Kind.INSPECTION, inspection)
    if set(inspection.areas) - set(photos):
        raise BadRequest('Add a photo for every area first.')
    notes = body(request).get('notes') or {}
    if (not isinstance(notes, dict) or set(notes) - set(inspection.areas)
            or not all(isinstance(n, str) and len(n) <= 300 for n in notes.values())):
        raise BadRequest('Notes must be 300 characters or less.')
    inspection.tenant_notes = {area: note.strip() for area, note in notes.items() if note.strip()}
    inspection.status = Inspection.Status.SUBMITTED
    inspection.submitted_on = timezone.localdate()
    inspection.save(update_fields=['status', 'submitted_on', 'tenant_notes'])
    log_activity(link, f'{tenant_label(request)} submitted the inspection for Unit {link.unit.name}',
                 'AI comparison is running')
    start_review(inspection)
    return JsonResponse(tenant_state(request.user))


# ---------- photos ----------

@require_POST
@csrf_protect
@never_cache
def upload(request):
    """Multipart: file, unitId, area, kind (baseline|move_in|inspection), inspectionId."""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Please sign in.'}, status=401)
    file = request.FILES.get('file')
    kind = request.POST.get('kind')
    area = (request.POST.get('area') or '').strip()
    unit_key = request.POST.get('unitId') or ''
    if not file or file.size > MAX_UPLOAD_BYTES or file.content_type not in ALLOWED_TYPES:
        return JsonResponse({'detail': 'Choose a photo under 15 MB.'}, status=400)

    inspection = None
    if kind == Photo.Kind.BASELINE:
        unit = Unit.objects.filter(key=unit_key, property__owner=request.user).first()
    else:
        link = TenantLink.objects.filter(unit__key=unit_key, tenant=request.user,
                                         status=TenantLink.Status.JOINED).first()
        unit = link.unit if link else None
        if unit and kind == Photo.Kind.INSPECTION:
            inspection = Inspection.objects.filter(
                key=request.POST.get('inspectionId') or '', unit=unit,
                status=Inspection.Status.SCHEDULED).first()
            if not inspection or area not in inspection.areas:
                unit = None
        elif kind != Photo.Kind.MOVE_IN:
            unit = None
    if not unit or area not in unit.areas:
        return JsonResponse({'detail': 'You cannot add a photo here.'}, status=403)

    try:
        url, public_id = upload_photo(file, folder=f'leaseguard/{unit.key}/{kind}')
    except StorageError as error:
        return JsonResponse({'detail': str(error)}, status=502)
    Photo.objects.create(unit=unit, inspection=inspection, kind=kind, area=area,
                         url=url, public_id=public_id, uploaded_by=request.user)
    return JsonResponse({'url': url}, status=201)
