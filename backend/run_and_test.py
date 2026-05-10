import os
import threading
import time
import json

import uvicorn
import requests

# Change working directory so imports in app.py resolve as top-level modules
os.chdir(os.path.dirname(__file__))


def run_app():
    uvicorn.run("app:app", host="127.0.0.1", port=8000, log_level="warning")

thread = threading.Thread(target=run_app, daemon=True)
thread.start()

# Wait for server to become available
time.sleep(3)

url = "http://127.0.0.1:8000/predict"
payload = {"post_op_spo2": 95}

try:
    resp = requests.post(url, json=payload, timeout=10)
    print("STATUS", resp.status_code)
    try:
        print(json.dumps(resp.json(), indent=2))
    except Exception:
        print(resp.text)
except Exception as e:
    print("REQUEST_ERROR", str(e))

# Keep running briefly so server stays alive while thread is daemon
time.sleep(0.5)
