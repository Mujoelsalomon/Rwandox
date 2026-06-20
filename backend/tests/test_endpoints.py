from django.test import TestCase, Client, override_settings
from django.contrib.auth.models import User
from django.utils import timezone
from io import BytesIO
import json
from unittest.mock import patch

from apps.api.models import ModelArtifact, TrainingJob

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

    def test_clinician_cannot_access_model_registry(self):
        clinician = User.objects.create_user(
            username='model-registry-clinician',
            email='model-registry-clinician@example.com',
            password='pass12345',
        )
        self.client.force_login(clinician)

        resp = self.client.get('/models')

        self.assertEqual(resp.status_code, 403)

    def test_clinician_can_read_active_model_for_dashboard(self):
        ModelArtifact.objects.create(
            name='Dashboard active model',
            path=__file__,
            model_type='random_forest',
            metrics={'val_accuracy': 0.8},
            is_active=True,
        )
        clinician = User.objects.create_user(
            username='dashboard-model-clinician',
            email='dashboard-model-clinician@example.com',
            password='pass12345',
        )
        self.client.force_login(clinician)

        resp = self.client.get('/models/active')

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['model']['name'], 'Dashboard active model')

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

    def test_training_status_includes_duration_fields(self):
        job = TrainingJob.objects.create(
            job_id='completed-duration-job',
            dataset_path=__file__,
            model_type='random_forest',
            status='completed',
            result={'metrics': {'val_accuracy': 0.8}},
        )
        TrainingJob.objects.filter(id=job.id).update(updated_at=job.created_at + timezone.timedelta(seconds=75))

        resp = self.client.get('/train/status/completed-duration-job')

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['duration_seconds'], 75)
        self.assertEqual(data['duration_display'], '1m 15s')

    def test_admin_can_read_maintenance_health(self):
        resp = self.client.get('/api/admin/maintenance/health/')

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('api', data)
        self.assertIn('database', data)
        self.assertIn('model', data)
        self.assertIn('prediction_service', data)
        self.assertIn('storage', data)
        self.assertIn('sync', data)
        self.assertIn('backend_url', data['api'])
        self.assertIn('connection_result', data['database'])
        self.assertIn('database_name', data['database'])
        self.assertIn('table_count', data['database'])
        self.assertIn('migration_status', data['database'])

    def test_clinician_cannot_access_maintenance_endpoints(self):
        clinician = User.objects.create_user(
            username='maintenance-clinician',
            email='maintenance-clinician@example.com',
            password='pass12345',
        )
        self.client.force_login(clinician)

        get_resp = self.client.get('/api/admin/maintenance/health/')
        post_resp = self.client.post('/api/admin/maintenance/reload-model/')

        self.assertEqual(get_resp.status_code, 403)
        self.assertEqual(post_resp.status_code, 403)

    def test_admin_can_reset_failed_training_jobs_from_maintenance(self):
        TrainingJob.objects.create(
            job_id='maintenance-failed-job',
            dataset_path=__file__,
            model_type='random_forest',
            status='failed',
            error='test failure',
        )

        resp = self.client.post('/api/admin/maintenance/reset-failed-jobs/')

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['reset_count'], 1)
        job = TrainingJob.objects.get(job_id='maintenance-failed-job')
        self.assertEqual(job.status, 'queued')
        self.assertEqual(job.error, '')

    @override_settings(TRAINING_STALE_MINUTES=1)
    def test_stale_running_training_job_is_marked_failed(self):
        job = TrainingJob.objects.create(
            job_id='stale-running-job',
            dataset_path=__file__,
            model_type='xgboost',
            status='running',
        )
        TrainingJob.objects.filter(id=job.id).update(updated_at=timezone.now() - timezone.timedelta(minutes=5))

        resp = self.client.get('/train/status/stale-running-job')

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['status'], 'failed')
        self.assertIn('server may have restarted', data['error'])

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

    def test_researcher_and_data_manager_can_use_training_workflow(self):
        ModelArtifact.objects.create(
            name='Comparison model',
            path=__file__,
            model_type='random_forest',
            metrics={'val_accuracy': 0.8},
            is_active=True,
        )

        for role in ['Researcher', 'Data manager']:
            with self.subTest(role=role):
                self.client.post(
                    '/auth/login',
                    data=json.dumps({'username': 'anesthetist', 'password': 'Munyaneza@123'}),
                    content_type='application/json',
                )
                email = f'{role.lower().replace(" ", "-")}-workflow@example.com'
                register_resp = self.client.post(
                    '/auth/register',
                    data=json.dumps({
                        'name': f'{role} Workflow User',
                        'email': email,
                        'password': 'pass12345',
                        'role': role,
                    }),
                    content_type='application/json',
                )
                self.assertEqual(register_resp.status_code, 201)
                user = User.objects.get(email=email)
                self.assertFalse(user.is_staff)
                self.client.force_login(user)

                upload = BytesIO(b'oxygen_required,age\nYes,50\nNo,42\n')
                upload.name = f'{role.lower().replace(" ", "-")}-dataset.csv'
                upload_resp = self.client.post('/upload-dataset', {'file': upload})
                self.assertEqual(upload_resp.status_code, 200)

                jobs_resp = self.client.get('/train/jobs')
                self.assertEqual(jobs_resp.status_code, 200)

                models_resp = self.client.get('/models')
                self.assertEqual(models_resp.status_code, 200)
                self.assertEqual(len(models_resp.json()['models']), 1)

                train_resp = self.client.post(
                    '/train',
                    data=json.dumps({'dataset_path': __file__, 'model_type': 'random_forest'}),
                    content_type='application/json',
                )
                self.assertEqual(train_resp.status_code, 400)

                activate_resp = self.client.post(
                    '/models/activate',
                    data=json.dumps({'id': ModelArtifact.objects.first().id}),
                    content_type='application/json',
                )
                self.assertEqual(activate_resp.status_code, 403)

    def test_clinician_can_upload_prediction_dataset_without_training_access(self):
        clinician = User.objects.create_user(
            username='prediction-dataset-clinician',
            email='prediction-dataset-clinician@example.com',
            password='pass12345',
        )
        self.client.force_login(clinician)

        upload = BytesIO(b'oxygen_required,age,sex,postop_spo2\nYes,50,Female,90\nNo,41,Male,96\n')
        upload.name = 'prediction-dataset.csv'
        upload_resp = self.client.post('/upload-prediction-dataset', {'file': upload})
        self.assertEqual(upload_resp.status_code, 200)
        self.assertIn('dataset_path', upload_resp.json())

        train_resp = self.client.post(
            '/train',
            data=json.dumps({'dataset_path': upload_resp.json()['dataset_path'], 'model_type': 'random_forest'}),
            content_type='application/json',
        )
        self.assertEqual(train_resp.status_code, 403)

    def test_predict_dataset_runs_without_starting_training(self):
        upload = BytesIO(b'oxygen_required,age,sex,postop_spo2\nYes,50,Female,90\nNo,41,Male,96\n')
        upload.name = 'prediction-dataset.csv'
        upload_resp = self.client.post('/upload-prediction-dataset', {'file': upload})
        self.assertEqual(upload_resp.status_code, 200)

        with patch('apps.api.prediction_views.load_model_assets') as mocked_loader, \
                patch('apps.api.prediction_views.prediction_results_from_assets') as mocked_prediction:
            mocked_loader.return_value = ('model', {'_model_name': 'Test model'}, ['age', 'sex', 'postop_spo2'])
            mocked_prediction.return_value = [
                {'predicted_probability': 0.82, 'predicted_class': 'Yes', 'risk_level': 'High', 'recommendations': [], 'contributing_factors': []},
                {'predicted_probability': 0.2, 'predicted_class': 'No', 'risk_level': 'Low', 'recommendations': [], 'contributing_factors': []},
            ]
            predict_resp = self.client.post(
                '/predict-dataset',
                data=json.dumps({
                    'dataset_path': upload_resp.json()['dataset_path'],
                    'target_column': 'oxygen_required',
                    'model_type': 'random_forest',
                }),
                content_type='application/json',
            )

        self.assertEqual(predict_resp.status_code, 200)
        data = predict_resp.json()
        self.assertEqual(data['summary']['predicted_rows'], 2)
        self.assertEqual(data['summary']['high_risk_rows'], 1)
        self.assertEqual(data['summary']['low_risk_rows'], 1)
        self.assertEqual(data['summary']['oxygen_required_rows'], 1)
        self.assertEqual(data['summary']['oxygen_not_required_rows'], 1)
        self.assertEqual(data['summary']['oxygen_required_percentage'], 50)
        self.assertEqual(data['summary']['average_probability'], 51)
        self.assertEqual(data['summary']['minimum_probability'], 20)
        self.assertEqual(data['summary']['maximum_probability'], 82)
        self.assertEqual(data['summary']['first_row_probability'], 82)
        self.assertEqual(data['summary']['first_row_risk_level'], 'High')
        self.assertEqual(mocked_loader.call_count, 1)
        self.assertEqual(mocked_prediction.call_count, 1)

    @override_settings(DEBUG=True)
    def test_admin_header_session_can_upload_dataset_without_cookie(self):
        self.client.logout()
        upload = BytesIO(b'postoperative_oxygen_required,age\nYes,50\nNo,41\n')
        upload.name = 'dataset.csv'

        resp = self.client.post(
            '/upload-dataset',
            {'file': upload},
            HTTP_X_USER_EMAIL='munyanezajoel3@gmail.com',
            HTTP_AUTHORIZATION='Bearer local-preview-token',
        )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('dataset_path', data)
        self.assertIn('postoperative_oxygen_required', data['columns'])

    @override_settings(DEBUG=True)
    def test_clinician_header_session_cannot_upload_dataset(self):
        User.objects.create_user(
            username='header-clinician',
            email='header-clinician@example.com',
            password='pass12345',
        )
        self.client.logout()
        upload = BytesIO(b'postoperative_oxygen_required,age\nYes,50\n')
        upload.name = 'dataset.csv'

        resp = self.client.post(
            '/upload-dataset',
            {'file': upload},
            HTTP_X_USER_EMAIL='header-clinician@example.com',
            HTTP_AUTHORIZATION='Bearer local-preview-token',
        )

        self.assertEqual(resp.status_code, 403)

    def test_post_predict(self):
        payload = {'features': {'patient_coded_id': 'KBH-TEST-001', 'age': 45, 'sex': 'Female', 'postop_spo2': 90}}
        resp = self.client.post('/predict', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('predicted_probability', data)
        self.assertIn('predicted_class', data)
        self.assertIn('risk_level', data)

    def test_post_predict_preview_does_not_persist(self):
        payload = {'persist': False, 'features': {'patient_coded_id': 'KBH-PREVIEW-001', 'age': 45, 'sex': 'Female', 'postop_spo2': 90}}
        resp = self.client.post('/predict', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('predicted_probability', data)
        self.assertIn('risk_level', data)
        self.assertNotIn('id', data)

        search_resp = self.client.get('/patients/search?q=KBH-PREVIEW-001')
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(search_resp.json()['patients'], [])

        history_resp = self.client.get('/prediction-history')
        self.assertEqual(history_resp.status_code, 200)
        self.assertEqual(history_resp.json()['predictions'], [])

    def test_patient_search_and_prediction_history(self):
        payload = {'features': {'patient_coded_id': 'KBH-TEST-002', 'age': 52, 'sex': 'Male', 'postop_spo2': 91}}
        self.client.post('/predict', data=json.dumps(payload), content_type='application/json')

        search_resp = self.client.get('/patients/search?q=KBH-TEST-002')
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(search_resp.json()['patients'][0]['hospital_id'], 'KBH-TEST-002')

        history_resp = self.client.get('/prediction-history')
        self.assertEqual(history_resp.status_code, 200)
        self.assertGreaterEqual(len(history_resp.json()['predictions']), 1)

    def test_versioned_rest_prediction_aliases(self):
        payload = {'features': {'patient_coded_id': 'KBH-REST-001', 'age': 40, 'sex': 'Female', 'postop_spo2': 92}}
        predict_resp = self.client.post('/api/v1/predictions/run', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(predict_resp.status_code, 200)
        self.assertIn('predicted_probability', predict_resp.json())

        history_resp = self.client.get('/api/v1/predictions')
        self.assertEqual(history_resp.status_code, 200)
        self.assertIn('predictions', history_resp.json())

    def test_fhir_patient_observation_and_risk_assessment_endpoints(self):
        payload = {
            'features': {
                'patient_coded_id': 'KBH-FHIR-001',
                'age': 61,
                'sex': 'Male',
                'baseline_spo2': 93,
                'postop_spo2': 90,
                'respiratory_rate': 24,
            }
        }
        predict_resp = self.client.post('/predict', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(predict_resp.status_code, 200)
        prediction_id = predict_resp.json()['id']

        metadata_resp = self.client.get('/fhir/metadata')
        self.assertEqual(metadata_resp.status_code, 200)
        self.assertEqual(metadata_resp.json()['resourceType'], 'CapabilityStatement')

        patient_resp = self.client.get('/fhir/Patient/KBH-FHIR-001')
        self.assertEqual(patient_resp.status_code, 200)
        self.assertEqual(patient_resp.json()['resourceType'], 'Patient')
        self.assertEqual(patient_resp.json()['identifier'][0]['value'], 'KBH-FHIR-001')

        observation_resp = self.client.get('/fhir/Observation?patient=KBH-FHIR-001')
        self.assertEqual(observation_resp.status_code, 200)
        self.assertEqual(observation_resp.json()['resourceType'], 'Bundle')
        self.assertGreaterEqual(observation_resp.json()['total'], 1)

        risk_resp = self.client.get(f'/fhir/RiskAssessment/{prediction_id}')
        self.assertEqual(risk_resp.status_code, 200)
        self.assertEqual(risk_resp.json()['resourceType'], 'RiskAssessment')
        self.assertEqual(risk_resp.json()['subject']['reference'], 'Patient/KBH-FHIR-001')

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

    def test_invalid_profile_role_is_rejected(self):
        target_user = User.objects.create_user(
            username='invalid-role-target',
            email='invalid-role-target@example.com',
            password='pass12345',
            first_name='Invalid',
            last_name='Role',
        )

        resp = self.client.post(
            '/auth/profile',
            data=json.dumps({
                'user_id': target_user.id,
                'name': 'Invalid Role',
                'email': 'invalid-role-target@example.com',
                'role': 'Reviewer',
            }),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()['error'], 'Invalid user role.')

    def test_admin_can_register_new_user_with_role(self):
        resp = self.client.post(
            '/auth/register',
            data=json.dumps({
                'name': 'New Clinical User',
                'email': 'new-clinical-user@example.com',
                'password': 'pass12345',
                'role': 'Nurse',
            }),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 201)
        created_user = User.objects.get(email='new-clinical-user@example.com')
        self.assertFalse(created_user.is_staff)
        self.assertFalse(created_user.is_superuser)
        self.assertTrue(created_user.groups.filter(name='Nurse').exists())
        self.assertRegex(created_user.profile.user_code, r'^OX\d{3}$')
        self.assertLessEqual(len(created_user.profile.user_code), 50)
        self.assertEqual(resp.json()['user']['user_id'], created_user.profile.user_code)
        self.assertEqual(resp.json()['user']['role'], 'Nurse')

    def test_anesthetist_role_returns_expected_permissions(self):
        resp = self.client.post(
            '/auth/register',
            data=json.dumps({
                'name': 'Anesthetist User',
                'email': 'anesthetist-user@example.com',
                'password': 'pass12345',
                'role': 'Anesthetist',
            }),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()['user']['role'], 'Anesthetist')
        self.assertEqual(resp.json()['user']['access_level'], 'Clinical user')
        self.assertEqual(resp.json()['user']['permissions'], [
            'Login',
            'Enter patient data',
            'Generate prediction',
            'View prediction result',
            'View key factors',
            'Review prediction history',
        ])

    def test_clinician_role_returns_expected_permissions(self):
        resp = self.client.post(
            '/auth/register',
            data=json.dumps({
                'name': 'Clinician User',
                'email': 'clinician-user@example.com',
                'password': 'pass12345',
                'role': 'Clinician',
            }),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()['user']['role'], 'Clinician')
        self.assertEqual(resp.json()['user']['access_level'], 'Clinical user')
        self.assertEqual(resp.json()['user']['permissions'], [
            'Review prediction result',
            'Support monitoring decision',
            'Support disposition decision',
        ])

    def test_researcher_and_data_manager_roles_return_training_permissions(self):
        expected_permissions = [
            'Upload dataset',
            'Train model',
            'View training results',
            'Compare models',
        ]
        for role in ['Researcher', 'Data manager']:
            with self.subTest(role=role):
                resp = self.client.post(
                    '/auth/register',
                    data=json.dumps({
                        'name': f'{role} User',
                        'email': f'{role.lower().replace(" ", "-")}-user@example.com',
                        'password': 'pass12345',
                        'role': role,
                    }),
                    content_type='application/json',
                )

                self.assertEqual(resp.status_code, 201)
                self.assertEqual(resp.json()['user']['role'], role)
                self.assertEqual(resp.json()['user']['access_level'], 'Clinical user')
                self.assertEqual(resp.json()['user']['permissions'], expected_permissions)

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
        self.assertEqual(resp.json()['user']['access_level'], 'Administrator')
        self.assertEqual(resp.json()['user']['permissions'], [
            'Manage users',
            'Manage active model',
            'Monitor system status',
            'View audit logs',
            'Manage QR-code access',
            'Manage settings',
        ])
