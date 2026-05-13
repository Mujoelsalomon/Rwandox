import os
import json
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
try:
    import django
    django.setup()
except Exception as e:
    print('DJANGO SETUP ERROR:', e)
    sys.exit(1)

from django.test import Client

def run():
    c = Client()
    try:
        r = c.get('/models')
        print('GET /models', r.status_code)
        print(r.content.decode('utf-8'))
    except Exception as e:
        print('GET /models ERROR:', e)

    try:
        payload = {'features': {'postop_spo2': 90}}
        r2 = c.post('/predict', data=json.dumps(payload), content_type='application/json')
        print('POST /predict', r2.status_code)
        print(r2.content.decode('utf-8'))
    except Exception as e:
        print('POST /predict ERROR:', e)

if __name__ == '__main__':
    run()
