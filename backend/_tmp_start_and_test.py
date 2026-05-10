import threading
import time
import json

import uvicorn
import requests


def run_app():
    uvicorn.run("app:app", host="127.0.0.1", port=8000, log_level="warning")

thread = threading.Thread(target=run_app, daemon=True)
thread.start()

# Wait for server to become available
time.sleep(2)

url = "http://127.0.0.1:8000/predict"
# Try a simple payload the server will accept
payload = {"post_op_spo2": 95}

try:
    resp = requests.post(url, json=payload, timeout=5)
    print("STATUS", resp.status_code)
    try:
        print(json.dumps(resp.json(), indent=2))
    except Exception:
        print(resp.text)
except Exception as e:
    print("REQUEST_ERROR", str(e))

# Give server a moment before exiting (daemon thread will stop on process exit)
time.sleep(0.5)
