import io
import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from accounts.models import AccountProfile
from inspections.models import Inspection, Photo, TenantLink
from inspections.services import AIComparisonError

AREAS = ['Kitchen sink', 'Bedroom floor']
GOOD = {
    'photo_quality': 'good', 'same_area': True, 'change_detected': False,
    'classification': 'none', 'severity': None, 'confidence': 'high',
    'obstructed_areas': None, 'findings': [], 'summary': 'No change.',
}


def jpeg():
    buf = io.BytesIO()
    Image.new('RGB', (40, 30), 'white').save(buf, format='JPEG')
    return SimpleUploadedFile('photo.jpg', buf.getvalue(), content_type='image/jpeg')


def make_user(email, role):
    user = get_user_model().objects.create_user(username=email, email=email, password='x-Strong-pass-1',
                                                first_name=email.split('@')[0].title())
    AccountProfile.objects.create(user=user, role=role)
    return user


@override_settings(INSPECTIONS_AI_SYNC=True, CLOUDINARY_URL='cloudinary://k:s@demo')
@patch('inspections.views.upload_photo',
       side_effect=lambda f, folder: (f'https://res.cloudinary.com/demo/{folder}/{f.name}', 'pid'))
class LeaseFlowTests(TestCase):
    def setUp(self):
        self.landlord = make_user('marcus@example.com', 'landlord')
        self.tenant = make_user('alyssa@example.com', 'tenant')

    def post(self, user, path, data=None, method='post'):
        self.client.force_login(user)
        if method == 'get':
            return self.client.get(f'/api/{path}')
        return getattr(self.client, method)(
            f'/api/{path}', data=json.dumps(data or {}), content_type='application/json')

    def upload(self, user, kind, area, inspection=''):
        self.client.force_login(user)
        return self.client.post('/api/photos/', {'file': jpeg(), 'kind': kind, 'area': area,
                                                 'unitId': 'u1', 'inspectionId': inspection})

    def add_unit(self):
        return self.post(self.landlord, 'landlord/properties/', {
            'propertyId': 'p1', 'unitId': 'u1', 'street': '18 Cedar Ave', 'city': 'Farmingdale',
            'unit': '1A', 'bedrooms': '1', 'bathrooms': '1', 'areas': AREAS,
            'email': 'Alyssa@example.com'})

    def test_full_flow(self, _upload):
        self.assertEqual(self.add_unit().status_code, 201)
        state = self.post(self.tenant, 'tenant/state/', method='get').json()
        self.assertEqual(state['pendingInvite']['unitId'], 'u1')
        self.assertIsNone(state['unit'])

        state = self.post(self.tenant, 'tenant/invite/accept/', {'unitId': 'u1'}).json()
        self.assertEqual(state['unit']['street'], '18 Cedar Ave')

        for area in AREAS:
            self.assertEqual(self.upload(self.landlord, 'baseline', area).status_code, 201)
        self.assertEqual(self.post(self.landlord, 'landlord/units/u1/baseline/').status_code, 200)
        self.assertEqual(self.post(self.landlord, 'landlord/units/u1/inspections/', {
            'id': 'i1', 'kind': 'remote', 'dueDate': '2026-12-01', 'areas': AREAS}).status_code, 201)

        # Can't submit before every area has a photo.
        self.assertEqual(self.post(self.tenant, 'tenant/inspections/i1/submit/').status_code, 400)
        for area in AREAS:
            self.assertEqual(self.upload(self.tenant, 'inspection', area, 'i1').status_code, 201)

        with patch('inspections.review.download_photo', return_value=b'img'), \
                patch('inspections.review.compare_images', return_value=GOOD) as compare:
            state = self.post(self.tenant, 'tenant/inspections/i1/submit/',
                              {'notes': {'Kitchen sink': ' Faucet drips '}}).json()
        self.assertEqual(compare.call_count, 2)
        notes = {c.kwargs['area']: c.kwargs['tenant_notes'] for c in compare.call_args_list}
        self.assertEqual(notes, {'Kitchen sink': 'Faucet drips', 'Bedroom floor': None})
        self.assertEqual(state['details']['inspection']['notes'], {'Kitchen sink': 'Faucet drips'})
        self.assertEqual(state['details']['inspection']['status'], 'submitted')
        self.assertNotIn('ai', state['details']['inspection'])  # tenant never sees AI results

        landlord = self.post(self.landlord, 'landlord/state/', method='get').json()
        inspection = landlord['properties'][0]['units'][0]['inspections'][0]
        self.assertEqual(inspection['ai']['status'], 'done')
        self.assertEqual(inspection['ai']['results']['Kitchen sink']['photo_quality'], 'good')
        self.assertIn('AI review ready', landlord['activity'][0]['title'])

    def test_missing_baseline_is_reported_per_area(self, _upload):
        self.add_unit()
        self.post(self.tenant, 'tenant/invite/accept/', {'unitId': 'u1'})
        for area in AREAS:
            self.upload(self.landlord, 'baseline', area)
        self.post(self.landlord, 'landlord/units/u1/baseline/')
        self.post(self.landlord, 'landlord/units/u1/inspections/',
                  {'id': 'i1', 'kind': 'remote', 'dueDate': '2026-12-01', 'areas': AREAS})
        Photo.objects.filter(kind='baseline', area='Bedroom floor').delete()
        for area in AREAS:
            self.upload(self.tenant, 'inspection', area, 'i1')
        with patch('inspections.review.download_photo', return_value=b'img'), \
                patch('inspections.review.compare_images', return_value=GOOD):
            self.post(self.tenant, 'tenant/inspections/i1/submit/')
        results = Inspection.objects.get(key='i1').ai_results
        self.assertIn('error', results['Bedroom floor'])
        self.assertEqual(results['Kitchen sink']['same_area'], True)

    def test_other_users_cannot_touch_unit(self, _upload):
        self.add_unit()
        stranger = make_user('eve@example.com', 'landlord')
        self.assertEqual(self.post(stranger, 'landlord/units/u1/', {
            'name': 'X', 'areas': AREAS}).status_code, 404)
        self.assertEqual(self.upload(stranger, 'baseline', 'Kitchen sink').status_code, 403)
        # A tenant who has not joined cannot upload.
        self.assertEqual(self.upload(self.tenant, 'move_in', 'Kitchen sink').status_code, 403)
        # Tenants can't call landlord endpoints.
        self.assertEqual(self.post(self.tenant, 'landlord/state/', method='get').status_code, 403)

    def test_decline_and_in_person_times(self, _upload):
        self.add_unit()
        self.post(self.tenant, 'tenant/invite/decline/', {'unitId': 'u1'})
        self.assertEqual(TenantLink.objects.get().status, 'declined')
        self.post(self.landlord, 'landlord/units/u1/tenant/', {'email': 'alyssa@example.com'})
        self.post(self.tenant, 'tenant/invite/accept/', {'unitId': 'u1'})
        for area in AREAS:
            self.upload(self.landlord, 'baseline', area)
        self.post(self.landlord, 'landlord/units/u1/baseline/')
        slots = [{'id': 's1', 'date': '2026-12-02', 'time': '10:00 AM'},
                 {'id': 's2', 'date': '2026-12-03', 'time': '2:00 PM'}]
        self.post(self.landlord, 'landlord/units/u1/inspections/',
                  {'id': 'i2', 'kind': 'inperson', 'areas': AREAS, 'slots': slots})
        self.post(self.tenant, 'tenant/inspections/i2/availability/', {'slotIds': ['s2']})
        self.assertEqual(self.post(self.landlord, 'landlord/inspections/i2/confirm/',
                                   {'slotId': 's1'}).status_code, 400)
        self.post(self.landlord, 'landlord/inspections/i2/confirm/', {'slotId': 's2'})
        self.assertEqual(Inspection.objects.get(key='i2').status, 'confirmed')


    def test_rename_area_and_baseline_notes(self, _upload):
        self.add_unit()
        self.post(self.tenant, 'tenant/invite/accept/', {'unitId': 'u1'})
        for area in AREAS:
            self.upload(self.landlord, 'baseline', area)
        state = self.post(self.landlord, 'landlord/units/u1/areas/rename/',
                          {'from': 'Kitchen sink', 'to': 'Living room wall'}).json()
        unit = state['properties'][0]['units'][0]
        self.assertEqual(unit['areas'], ['Living room wall', 'Bedroom floor'])
        self.assertIn('Living room wall', unit['baselinePhotos'])
        self.assertEqual(self.post(self.landlord, 'landlord/units/u1/areas/rename/',
                                   {'from': 'Bedroom floor', 'to': 'living room wall'}).status_code, 400)
        state = self.post(self.landlord, 'landlord/units/u1/baseline/',
                          {'notes': {'Bedroom floor': 'Scratch by the door'}}).json()
        self.assertEqual(state['properties'][0]['units'][0]['baselineNotes'],
                         {'Bedroom floor': 'Scratch by the door'})
        self.post(self.landlord, 'landlord/units/u1/inspections/',
                  {'id': 'i1', 'kind': 'remote', 'dueDate': '2026-12-01',
                   'areas': ['Living room wall', 'Bedroom floor']})
        for area in ['Living room wall', 'Bedroom floor']:
            self.upload(self.tenant, 'inspection', area, 'i1')
        with patch('inspections.review.download_photo', return_value=b'img'), \
                patch('inspections.review.compare_images', return_value=GOOD) as compare:
            self.post(self.tenant, 'tenant/inspections/i1/submit/')
        known = {c.kwargs['area']: c.kwargs['known_issues'] for c in compare.call_args_list}
        self.assertEqual(known, {'Living room wall': None, 'Bedroom floor': 'Scratch by the door'})

        # Renaming later carries the inspection's photos, notes and results over.
        state = self.post(self.landlord, 'landlord/units/u1/areas/rename/',
                          {'from': 'Bedroom floor', 'to': 'Hallway'}).json()
        inspection = state['properties'][0]['units'][0]['inspections'][0]
        self.assertEqual(inspection['areas'], ['Living room wall', 'Hallway'])
        self.assertIn('Hallway', inspection['photos'])
        self.assertIn('Hallway', inspection['ai']['results'])


    def submit_with(self, compare_effect):
        self.add_unit()
        self.post(self.tenant, 'tenant/invite/accept/', {'unitId': 'u1'})
        for area in AREAS:
            self.upload(self.landlord, 'baseline', area)
        self.post(self.landlord, 'landlord/units/u1/baseline/')
        self.post(self.landlord, 'landlord/units/u1/inspections/',
                  {'id': 'i1', 'kind': 'remote', 'dueDate': '2026-12-01', 'areas': AREAS})
        for area in AREAS:
            self.upload(self.tenant, 'inspection', area, 'i1')
        with patch('inspections.review.download_photo', return_value=b'img'), \
                patch('inspections.review.time.sleep') as sleep, \
                patch('inspections.review.compare_images', side_effect=compare_effect) as compare:
            self.post(self.tenant, 'tenant/inspections/i1/submit/')
        return Inspection.objects.get(key='i1').ai_results, compare, sleep

    def test_busy_gemini_is_retried(self, _upload):
        busy = AIComparisonError('Gemini request failed: 503 UNAVAILABLE')
        results, compare, sleep = self.submit_with([busy, GOOD, GOOD])
        self.assertEqual(compare.call_count, 3)
        sleep.assert_called_once_with(5)
        self.assertEqual(results['Kitchen sink'], GOOD)

    def test_gives_up_after_retries(self, _upload):
        busy = AIComparisonError('Gemini request failed: 429 RESOURCE_EXHAUSTED')
        results, compare, _ = self.submit_with([busy, busy, busy, GOOD])
        self.assertIn('too busy', results['Kitchen sink']['error'])
        self.assertEqual(results['Bedroom floor'], GOOD)

    def test_other_errors_are_not_retried(self, _upload):
        results, compare, sleep = self.submit_with([AIComparisonError('bad key'), GOOD])
        self.assertEqual(compare.call_count, 2)
        sleep.assert_not_called()
        self.assertEqual(results['Kitchen sink']['error'], 'The AI comparison could not run for this photo.')
