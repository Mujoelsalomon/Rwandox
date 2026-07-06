from django.test import TestCase, Client, override_settings
from django.contrib.auth.models import User
from django.utils import timezone
from io import BytesIO
import json
import os
import tempfile
from unittest.mock import patch

import joblib

from apps.api.models import ModelArtifact, TrainingJob
from apps.accounts.models import ensure_user_profile
from apps.support.models import SupportTicket
from apps.predictions.services import build_prediction_result
import trainer
from ml.predict import make_prediction
from ml.model_loader import has_calibration_metadata

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

    @patch('apps.api.model_views.Path.exists', return_value=True)
    @patch('apps.api.model_views.Path.read_text')
    def test_admin_can_activate_non_sigmoid_calibrated_model(self, read_text, _exists):
        read_text.return_value = json.dumps({
            'algorithm': 'random_forest',
            'calibration_method': 'Isotonic regression',
            'calibration': {'method': 'Isotonic regression', 'brier_score': 0.11},
        })
        artifact = ModelArtifact.objects.create(
            name='Isotonic calibrated model',
            path='models/isotonic_model.joblib',
            model_type='random_forest',
            metrics={'calibration': {'method': 'Isotonic regression'}},
        )

        resp = self.client.post(
            '/models/activate',
            data=json.dumps({'id': artifact.id}),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 200)
        artifact.refresh_from_db()
        self.assertTrue(artifact.is_active)

    def test_model_loader_accepts_any_named_calibration_method(self):
        self.assertTrue(has_calibration_metadata({'calibration_method': 'Isotonic regression'}))
        self.assertTrue(has_calibration_metadata({'calibration': {'method': 'Temperature scaling'}}))
        self.assertTrue(has_calibration_metadata({'calibration': {'brier_score': 0.11}}))
        self.assertTrue(has_calibration_metadata({'calibration': {'mean_predicted_probability': [0.2]}}))
        self.assertFalse(has_calibration_metadata({'calibration': {}}))

    def test_default_admin_env_credentials_repair_login_obstacles(self):
        admin = User.objects.get(username='anesthetist')
        admin.set_password('BrokenPass123')
        admin.email = 'wrong@example.com'
        admin.is_active = False
        admin.is_staff = False
        admin.is_superuser = False
        admin.save(update_fields=['password', 'email', 'is_active', 'is_staff', 'is_superuser'])
        profile = ensure_user_profile(admin)
        profile.must_change_password = True
        profile.save(update_fields=['must_change_password', 'updated_at'])

        self.client.logout()
        resp = self.client.post(
            '/auth/login',
            data=json.dumps({'username': 'munyanezajoel3@gmail.com', 'password': 'Munyaneza@123'}),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()['user']
        self.assertEqual(data['username'], 'anesthetist')
        self.assertEqual(data['email'], 'munyanezajoel3@gmail.com')
        self.assertTrue(data['is_active'])
        self.assertTrue(data['is_staff'])
        self.assertTrue(data['is_superuser'])
        self.assertFalse(data['must_change_password'])

    def test_doctor_cannot_access_model_registry(self):
        doctor = User.objects.create_user(
            username='model-registry-doctor',
            email='model-registry-doctor@example.com',
            password='pass12345',
        )
        self.client.force_login(doctor)

        resp = self.client.get('/models')

        self.assertEqual(resp.status_code, 403)

    def test_doctor_can_read_active_model_for_dashboard(self):
        ModelArtifact.objects.create(
            name='Dashboard active model',
            path=__file__,
            model_type='random_forest',
            metrics={'val_accuracy': 0.8, 'test_auc': 0.81, 'test_sensitivity': 0.9},
            is_active=True,
        )
        doctor = User.objects.create_user(
            username='dashboard-model-doctor',
            email='dashboard-model-doctor@example.com',
            password='pass12345',
        )
        self.client.force_login(doctor)

        resp = self.client.get('/models/active')

        self.assertEqual(resp.status_code, 200)
        model = resp.json()['model']
        self.assertEqual(model['name'], 'Dashboard active model')
        self.assertEqual(model['auc'], 0.81)
        self.assertEqual(model['sensitivity'], 0.9)
        self.assertEqual(model['metrics']['test_auc_classification'], 'Excellent')
        self.assertEqual(model['metrics']['test_sensitivity_classification'], 'Excellent detection')

    def test_upload_dataset_rejects_unsupported_file_type(self):
        upload = BytesIO(b'not,a,dataset\n')
        upload.name = 'dataset.exe'
        resp = self.client.post('/upload-dataset', {'file': upload})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('unsupported dataset format', resp.json()['error'])

    def test_anonymous_user_can_create_login_support_ticket_for_admin_portal(self):
        self.client.logout()

        resp = self.client.post(
            '/api/support/tickets/',
            data={
                'full_name': 'Locked Out User',
                'email': '',
                'role': 'Unable to log in',
                'category': 'login',
                'priority': 'medium',
                'subject': 'Login help requested by Locked Out User',
                'message': 'I cannot log in with my account.',
            },
        )

        self.assertEqual(resp.status_code, 201)
        ticket = SupportTicket.objects.get(subject='Login help requested by Locked Out User')
        self.assertIsNone(ticket.user)
        self.assertEqual(ticket.category, SupportTicket.CATEGORY_LOGIN)
        self.assertEqual(ticket.email_delivery_error, '')

        list_resp = self.client.get('/api/support/tickets/')
        self.assertEqual(list_resp.status_code, 403)

        self.client.post(
            '/auth/login',
            data=json.dumps({'username': 'anesthetist', 'password': 'Munyaneza@123'}),
            content_type='application/json',
        )
        admin_list_resp = self.client.get('/api/support/tickets/')
        self.assertEqual(admin_list_resp.status_code, 200)
        self.assertTrue(any(item['id'] == ticket.id for item in admin_list_resp.json()))

    def test_admin_can_resolve_support_ticket(self):
        ticket = SupportTicket.objects.create(
            full_name='Support User',
            email='support-user@example.com',
            category=SupportTicket.CATEGORY_TECHNICAL,
            priority=SupportTicket.PRIORITY_MEDIUM,
            subject='Resolve me',
            message='Needs admin follow-up.',
        )

        resp = self.client.post(
            f'/api/support/tickets/{ticket.id}/resolve/',
            data={'admin_response': 'Issue resolved.'},
        )

        self.assertEqual(resp.status_code, 200)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, SupportTicket.STATUS_RESOLVED)
        self.assertEqual(ticket.admin_response, 'Issue resolved.')

    def test_train_rejects_dataset_outside_uploads(self):
        resp = self.client.post(
            '/train',
            data=json.dumps({'dataset_path': __file__, 'model_type': 'random_forest'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn('uploaded dataset', resp.json()['error'])

    def test_training_metadata_keeps_final_test_set_untouched(self):
        dataset_path = write_training_fixture_dataset()

        try:
            result = trainer.train_model(dataset_path, target_column='postoperative_oxygen_required', model_type='random_forest')
        finally:
            os.unlink(dataset_path)

        metadata = result['metadata']
        metrics = result['metrics']
        self.assertEqual(metadata['validation_size'], 0.3)
        self.assertEqual(metrics['class_weights']['computed_from'], 'training_split_only')
        self.assertIn('test set is untouched', metrics['class_distribution']['test_set_policy'])
        self.assertEqual(
            metrics['class_weights']['positive_class_weight'],
            metrics['class_distribution']['training']['negative'] / metrics['class_distribution']['training']['positive'],
        )
        self.assertEqual(
            metadata['test_row_count'],
            metrics['class_distribution']['test']['total'],
        )
        self.assertIn('selected_threshold', metadata)
        self.assertEqual(metadata['calibration_method'], 'Sigmoid / Platt scaling')
        self.assertEqual(metadata['calibration_fit']['fit_data'], 'training_split_only')
        self.assertIn('never used for calibration', metadata['calibration_fit']['test_set_usage'])
        self.assertEqual(metrics['calibration']['method'], 'Sigmoid / Platt scaling')
        self.assertEqual(metrics['calibration']['fit_data'], 'training_split_only')
        self.assertIn('never used for calibration', metrics['calibration']['test_set_usage'])

    def test_saved_model_predictions_are_consistent_for_identical_input(self):
        dataset_path = write_training_fixture_dataset()

        try:
            result = trainer.train_model(dataset_path, target_column='postoperative_oxygen_required', model_type='logistic_regression')
        finally:
            os.unlink(dataset_path)

        model = joblib.load(result['model_path'])
        metadata = result['metadata']
        self.assertTrue(hasattr(model, 'raw_predict_proba'))
        self.assertTrue(hasattr(model, 'predict_proba'))
        payload = {
            'age_years': 54,
            'sex': 'Female',
            'body_mass_index': 28,
            'baseline_room_air_spo2_percent': 92,
            'copd_or_asthma': 'Yes',
            'sleep_apnea': 'No',
            'asa_class': 'III',
            'duration_of_surgery_minutes': 120,
        }
        first_probability, _ = make_prediction(payload, model=model, preprocessor=metadata, feature_order=metadata['columns'])
        second_probability, _ = make_prediction(payload, model=model, preprocessor=metadata, feature_order=metadata['columns'])

        self.assertEqual(first_probability, second_probability)

    def test_large_dataset_training_profile_does_not_cap_tab_transformer_by_default(self):
        self.assertIsNone(trainer.TAB_TRANSFORMER_MAX_ROWS or None)
        profile = trainer.runtime_profile('tab_transformer', 10000)
        self.assertTrue(profile['large_dataset_profile'])
        self.assertIn('large-dataset profile', ' '.join(profile['notes']))

    def test_large_dataset_svm_uses_scalable_probability_candidate(self):
        class_weight_info = {
            'positive_class_weight': 2.0,
            'negative_cases': 7000,
            'positive_cases': 3000,
        }
        candidates = trainer.model_candidates(
            algo='svm',
            class_weight_info=class_weight_info,
            training_row_count=10000,
        )

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].__class__.__name__, 'SGDClassifier')
        self.assertTrue(hasattr(candidates[0], 'predict_proba'))

    def test_class_labels_are_not_used_as_probabilities(self):
        class LabelOnlyModel:
            def predict(self, frame):
                return [1 for _ in range(len(frame))]

        with self.assertRaisesRegex(RuntimeError, 'class labels cannot be used as probabilities'):
            make_prediction(
                {'age_years': 54},
                model=LabelOnlyModel(),
                preprocessor={'class_labels': ['No', 'Yes']},
                feature_order=['age_years'],
            )

    def test_display_probability_uses_safety_bounds(self):
        low = build_prediction_result(
            {'raw_probability': 0.2, 'calibrated_probability': 0.003},
            [],
            {'selected_threshold': 0.5},
        )
        high = build_prediction_result(
            {'raw_probability': 0.8, 'calibrated_probability': 0.997},
            [],
            {'selected_threshold': 0.5},
        )
        middle = build_prediction_result(
            {'raw_probability': 0.4, 'calibrated_probability': 0.456},
            [],
            {'selected_threshold': 0.5},
        )

        self.assertEqual(low['display_probability'], '<1%')
        self.assertEqual(high['display_probability'], '>99%')
        self.assertEqual(middle['display_probability'], '45.6%')

    def test_risk_classification_uses_calibrated_probability_not_display_rounding(self):
        result = build_prediction_result(
            {'raw_probability': 0.99, 'calibrated_probability': 0.695},
            [],
            {'selected_threshold': 0.7},
        )

        self.assertEqual(result['display_probability'], '69.5%')
        self.assertEqual(result['risk_level'], 'Moderate')
        self.assertEqual(result['predicted_class'], 'No')

    def test_prediction_uses_training_threshold_and_imbalance_metadata(self):
        result = build_prediction_result(
            {'raw_probability': 0.65, 'calibrated_probability': 0.55},
            [],
            {
                'selected_threshold': 0.7,
                'class_weights': {'positive_class_weight': 2.5},
                'weighting_method': 'class-weighted training',
                'class_distribution': {'training': {'negative': 80, 'positive': 20}},
            },
        )

        self.assertEqual(result['selected_threshold'], 0.7)
        self.assertEqual(result['risk_level'], 'Moderate')
        self.assertEqual(result['imbalance_management']['weighting_method'], 'class-weighted training')
        self.assertEqual(result['imbalance_management']['class_weights']['positive_class_weight'], 2.5)

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

    def test_doctor_cannot_access_maintenance_endpoints(self):
        doctor = User.objects.create_user(
            username='maintenance-doctor',
            email='maintenance-doctor@example.com',
            password='pass12345',
        )
        self.client.force_login(doctor)

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

        def test_temporary_password_meets_validators_on_reset(self):
            # Create a regular user
            user = User.objects.create_user(
                username='temp-pass-user',
                email='temp-pass-user@example.com',
                password='initialPass123!',
            )

            resp = self.client.post(
                '/api/admin/users/reset-password/',
                data=json.dumps({'id': user.id}),
                content_type='application/json',
            )

            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertIn('temporary_password', data)
            temp_pwd = data['temporary_password']
            # validate_password should not raise ValidationError for generated temporary password
            try:
                validate_password(temp_pwd)
            except ValidationError as exc:
                self.fail(f'Temporary password did not meet validators: {exc.messages}')

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

    def test_doctor_cannot_access_training_endpoints(self):
        doctor = User.objects.create_user(
            username='training-doctor',
            email='training-doctor@example.com',
            password='pass12345',
        )
        self.client.force_login(doctor)

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

    def test_doctor_can_upload_prediction_dataset_without_training_access(self):
        doctor = User.objects.create_user(
            username='prediction-dataset-doctor',
            email='prediction-dataset-doctor@example.com',
            password='pass12345',
        )
        self.client.force_login(doctor)

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
    def test_doctor_header_session_cannot_upload_dataset(self):
        User.objects.create_user(
            username='header-doctor',
            email='header-doctor@example.com',
            password='pass12345',
        )
        self.client.logout()
        upload = BytesIO(b'postoperative_oxygen_required,age\nYes,50\n')
        upload.name = 'dataset.csv'

        resp = self.client.post(
            '/upload-dataset',
            {'file': upload},
            HTTP_X_USER_EMAIL='header-doctor@example.com',
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

    def test_post_predict_truncates_long_active_model_name(self):
        long_name = 'Very long deployed postoperative oxygen model name that exceeds the prediction model version column'
        ModelArtifact.objects.create(
            name=long_name,
            path=__file__,
            model_type='xgboost',
            metrics={'val_accuracy': 0.8},
            is_active=True,
        )
        payload = {'features': {'patient_coded_id': 'KBH-LONG-MODEL-001', 'age': 45, 'sex': 'Female', 'postop_spo2': 90}}

        resp = self.client.post('/predict', data=json.dumps(payload), content_type='application/json')

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['model_version'], long_name[:50])

    def test_post_predict_without_patient_hospital_id(self):
        payload = {
            'features': {
                'age_years': 45,
                'age': 45,
                'sex': 'Female',
                'weight_kg': 70,
                'height_cm': 165,
                'body_mass_index': 25.7,
                'asa_class': 'II',
                'baseline_room_air_spo2_percent': 96,
                'baseline_spo2': 96,
                'baseline_respiratory_rate_bpm': 18,
                'surgical_specialty': 'General surgery',
                'type_of_surgery_performed': 'Appendectomy',
                'surgery_status': 'Elective',
                'urgency': 'elective',
                'duration_of_surgery_minutes': 90,
                'surgery_duration': 90,
                'estimated_blood_loss_ml': 100,
                'anesthesia_type': 'General',
                'expected_airway_type': 'Endotracheal tube',
                'postoperative_destination': 'Surgical Ward',
            }
        }
        resp = self.client.post('/predict', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('predicted_probability', data)
        self.assertIn('id', data)
        self.assertTrue(data['patient_id'].startswith('UNRECORDED-'))

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

    def test_doctor_cannot_edit_role_or_other_user_profile(self):
        doctor = User.objects.create_user(
            username='doctor',
            email='doctor@example.com',
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
        self.client.force_login(doctor)

        role_resp = self.client.post(
            '/auth/profile',
            data=json.dumps({'name': 'Clinical User', 'email': 'doctor@example.com', 'role': 'Administrator'}),
            content_type='application/json',
        )
        self.assertEqual(role_resp.status_code, 403)

        target_resp = self.client.post(
            '/auth/profile',
            data=json.dumps({'user_id': other_user.id, 'name': 'Edited User', 'email': 'edited@example.com'}),
            content_type='application/json',
        )
        self.assertEqual(target_resp.status_code, 403)

    @override_settings(DEBUG=True)
    def test_current_user_accepts_saved_frontend_session_headers_in_debug(self):
        self.client.logout()
        doctor = User.objects.create_user(
            username='profile-header-doctor',
            email='profile-header-doctor@example.com',
            password='pass12345',
            first_name='Profile',
            last_name='Header',
        )

        resp = self.client.get(
            '/auth/me',
            HTTP_X_USER_EMAIL='profile-header-doctor@example.com',
            HTTP_X_USER_USERNAME='profile-header-doctor',
        )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['authenticated'])
        self.assertEqual(resp.json()['user']['id'], doctor.id)

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

    def test_anonymous_user_cannot_register_account(self):
        self.client.logout()

        resp = self.client.post(
            '/auth/register',
            data=json.dumps({
                'name': 'Public Signup User',
                'email': 'public-signup@example.com',
                'password': 'pass12345',
            }),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.json()['error'], 'Authentication required.')
        self.assertFalse(User.objects.filter(email='public-signup@example.com').exists())

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

    def test_doctor_role_returns_expected_permissions(self):
        resp = self.client.post(
            '/auth/register',
            data=json.dumps({
                'name': 'Doctor User',
                'email': 'doctor-user@example.com',
                'password': 'pass12345',
                'role': 'Doctor',
            }),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()['user']['role'], 'Doctor')
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
            'Monitor model status',
            'View audit logs',
            'Manage QR-code access',
            'Manage settings',
        ])


def write_training_fixture_dataset():
    headers = [
        'age_years',
        'sex',
        'body_mass_index',
        'baseline_room_air_spo2_percent',
        'copd_or_asthma',
        'sleep_apnea',
        'asa_class',
        'duration_of_surgery_minutes',
        'postoperative_oxygen_required',
    ]
    rows = []
    for index in range(48):
        positive = index % 6 == 0
        rows.append([
            40 + (index % 25),
            'Female' if index % 2 else 'Male',
            22 + (index % 10),
            91 if positive else 97,
            'Yes' if index % 8 == 0 else 'No',
            'Yes' if index % 13 == 0 else 'No',
            'III' if positive else 'II',
            130 if positive else 75 + (index % 40),
            'Yes' if positive else 'No',
        ])

    handle = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='')
    handle.write(','.join(headers) + '\n')
    for row in rows:
        handle.write(','.join(str(item) for item in row) + '\n')
    handle.close()
    return handle.name
