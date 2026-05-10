import os, json
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend_project.settings'
import django
django.setup()
from django.test import Client
c = Client()
print('GET /models ->')
r = c.get('/models')
print(r.status_code)
print(r.content.decode('utf-8'))
print('\nPOST /predict ->')
r2 = c.post('/predict', data=json.dumps({'features':{'postop_spo2':90}}), content_type='application/json')
print(r2.status_code)
print(r2.content.decode('utf-8'))
