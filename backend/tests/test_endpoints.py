from django.test import TestCase, Client
from django.contrib.auth.models import User
from io import BytesIO
import json

class EndpointsTest(TestCase):
    def setUp(self):
        self.client = Client()
        response = self.client.post(
            '/auth/login',
            data=json.dumps({'username': 'anesthetist', 'password': 'Munyaneza@123'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

    def test_get_models(self):
        resp = self.client.get('/models')
        self.assertEqual(resp.status_code, 200)
        data = resp.json() if resp.content else None
        self.assertIsNotNone(data)
        # Expect list or dict with models
        self.assertTrue(isinstance(data, (list, dict)))

    def test_upload_dataset_rejects_unsupported_file_type(self):
        upload = BytesIO(b'not,a,dataset\n')
        upload.name = 'dataset.exe'
        resp = self.client.post('/upload-dataset', {'file': upload})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('unsupported dataset format', resp.json()['error'])

    def test_train_rejects_dataset_outside_uploads(self):
        resp = self.client.post(
            '/train',
            data=json.dumps({'dataset_path': __file__, 'model_type': 'random_forest'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn('uploaded dataset', resp.json()['error'])

    def test_training_jobs_endpoint_returns_jobs_list(self):
        resp = self.client.get('/train/jobs')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('jobs', resp.json())

    def test_clinician_cannot_access_training_endpoints(self):
        clinician = User.objects.create_user(
            username='training-clinician',
            email='training-clinician@example.com',
            password='pass12345',
        )
        self.client.force_login(clinician)

        upload = BytesIO(b'oxygen_required,age\nYes,50\n')
        upload.name = 'dataset.csv'
        upload_resp = self.client.post('/upload-dataset', {'file': upload})
        self.assertEqual(upload_resp.status_code, 403)

        train_resp = self.client.post(
            '/train',
            data=json.dumps({'dataset_path': __file__, 'model_type': 'random_forest'}),
            content_type='application/json',
        )
        self.assertEqual(train_resp.status_code, 403)

        jobs_resp = self.client.get('/train/jobs')
        self.assertEqual(jobs_resp.status_code, 403)

    def test_post_predict(self):
        payload = {'features': {'patient_coded_id': 'KBH-TEST-001', 'age': 45, 'sex': 'Female', 'postop_spo2': 90}}
        resp = self.client.post('/predict', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('predicted_probability', data)
        self.assertIn('predicted_class', data)
        self.assertNotIn('risk_level', data)

    def test_post_predict_preview_does_not_persist(self):
        payload = {'persist': False, 'features': {'patient_coded_id': 'KBH-PREVIEW-001', 'age': 45, 'sex': 'Female', 'postop_spo2': 90}}
        resp = self.client.post('/predict', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('predicted_probability', data)
        self.assertNotIn('risk_level', data)
        self.assertNotIn('id', data)

        search_resp = self.client.get('/patients/search?q=KBH-PREVIEW-001')
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(search_resp.json()['patients'], [])

    def test_patient_search_and_prediction_history(self):
        payload = {'features': {'patient_coded_id': 'KBH-TEST-002', 'age': 52, 'sex': 'Male', 'postop_spo2': 91}}
        self.client.post('/predict', data=json.dumps(payload), content_type='application/json')

        search_resp = self.client.get('/patients/search?q=KBH-TEST-002')
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(search_resp.json()['patients'][0]['hospital_id'], 'KBH-TEST-002')

        history_resp = self.client.get('/prediction-history')
        self.assertEqual(history_resp.status_code, 200)
        self.assertGreaterEqual(len(history_resp.json()['predictions']), 1)

    def test_clinician_cannot_edit_role_or_other_user_profile(self):
        clinician = User.objects.create_user(
            username='clinician',
            email='clinician@example.com',
            password='pass12345',
            first_name='Clinical',
            last_name='User',
        )
        other_user = User.objects.create_user(
            username='other',
            email='other@example.com',
            password='pass12345',
            first_name='Other',
            last_name='User',
        )
        self.client.force_login(clinician)

        role_resp = self.client.post(
            '/auth/profile',
            data=json.dumps({'name': 'Clinical User', 'email': 'clinician@example.com', 'role': 'Administrator'}),
            content_type='application/json',
        )
        self.assertEqual(role_resp.status_code, 403)

        target_resp = self.client.post(
            '/auth/profile',
            data=json.dumps({'user_id': other_user.id, 'name': 'Edited User', 'email': 'edited@example.com'}),
            content_type='application/json',
        )
        self.assertEqual(target_resp.status_code, 403)

    def test_superuser_can_edit_target_user_profile_and_role(self):
        target_user = User.objects.create_user(
            username='target',
            email='target@example.com',
            password='pass12345',
            first_name='Target',
            last_name='User',
        )

        resp = self.client.post(
            '/auth/profile',
            data=json.dumps({
                'user_id': target_user.id,
                'name': 'Updated Target',
                'email': 'updated-target@example.com',
                'role': 'Administrator',
            }),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 200)
        target_user.refresh_from_db()
        self.assertEqual(target_user.get_full_name(), 'Updated Target')
        self.assertEqual(target_user.email, 'updated-target@example.com')
        self.assertTrue(target_user.is_staff)
        self.assertFalse(target_user.is_superuser)
        self.assertEqual(resp.json()['user']['role'], 'Administrator')
