import os
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
import django
django.setup()

from django.test import Client


def test_get_models():
    c = Client()
    r = c.get('/models')
    assert r.status_code == 200
    data = r.json()
    assert 'models' in data


def test_post_predict():
    c = Client()
    payload = {'features': {'postop_spo2': 90}}
    r = c.post('/predict', data=json.dumps(payload), content_type='application/json')
    assert r.status_code == 200
    data = r.json()
    assert 'predicted_class' in data
