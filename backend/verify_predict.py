import json
import sys
import os

URL = os.getenv('API_URL', 'http://localhost:8000') + '/predict'
payload = {'features': {'post_op_spo2': 90}, 'model_type': 'xgboost'}

def main():
    data = json.dumps(payload).encode('utf-8')
    headers = {'Content-Type': 'application/json'}
    try:
        import requests
        resp = requests.post(URL, json=payload, timeout=10)
        print('STATUS:', resp.status_code)
        print(resp.text)
        return 0 if resp.ok else 2
    except Exception:
        # fallback to urllib
        try:
            from urllib.request import Request, urlopen
            req = Request(URL, data=data, headers=headers, method='POST')
            with urlopen(req, timeout=10) as r:
                body = r.read().decode('utf-8')
                print('STATUS:', r.getcode())
                print(body)
                return 0
        except Exception as e:
            print('ERROR:', e)
            return 1

if __name__ == '__main__':
    sys.exit(main())
