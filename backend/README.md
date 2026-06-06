# Backend (Django + Postgres)

This folder contains the Django backend used by the React frontend.

Setup:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
docker compose up -d
python manage.py migrate
python manage.py runserver
```

Local Wi-Fi testing:

1. From the project root, detect/write the current Wi-Fi URL:

```powershell
.\scripts\start-local-wifi.ps1
```

You can override the detected address:

```powershell
.\scripts\start-local-wifi.ps1 -LocalIp 192.168.1.25
```

2. Start Django on the local network:

```powershell
cd backend
$env:LOCAL_WIFI_IP="192.168.1.25"
python manage.py runserver 0.0.0.0:8000
```

3. Start the frontend on the local network:

```bash
cd Front_end
npm run dev -- --host 0.0.0.0
```

The frontend will be available at:

```text
http://<LOCAL_IP>:5173
```

The backend will be available at:

```text
http://<LOCAL_IP>:8000
```

`backend_project/settings.py` reads `LOCAL_WIFI_IP` and adds it to `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` for local testing.

API endpoints:

- `POST /auth/login` - login with `{"username":"anesthetist","password":"..."}`
- `POST /auth/register` - create a Django user account
- `POST /auth/logout` - end the current Django session
- `POST /auth/logout-all` - end all active Django sessions
- `GET /auth/me` - return the current authenticated user
- `POST /predict` - generate and persist a prediction
- `GET /prediction-history` - list persisted predictions
- `GET /patients/search?q=KBH` - search patients by hospital ID
- `POST /api/v1/predictions/run` - versioned REST alias for prediction generation
- `GET /api/v1/predictions` - versioned REST alias for prediction history
- `GET /api/v1/patients` - versioned REST patient list
- `GET /api/v1/patients/search?q=KBH` - versioned REST patient search
- `POST /upload-dataset` - upload a model-training dataset
- `POST /train` - start a model training job
- `GET /train/status/<job_id>` - inspect training status
- `GET /models` - list model artifacts
- `POST /models/activate` - mark one model artifact active
- `GET /models/download?id=<id>` - download a model artifact

FHIR / OpenMRS / OpenClinic interoperability endpoints:

- `GET /fhir/metadata` - FHIR R4 CapabilityStatement for supported resources
- `GET /fhir/Patient?identifier=KBH-001` - search patients by hospital identifier
- `GET /fhir/Patient/<hospital_id>` - read one patient as a FHIR Patient resource
- `GET /fhir/Observation?patient=<hospital_id>` - return vitals such as SpO2, BMI, and respiratory rate as FHIR Observations
- `GET /fhir/RiskAssessment?patient=<hospital_id>` - return prediction results as FHIR RiskAssessment resources
- `GET /fhir/RiskAssessment/<prediction_id>` - read one prediction as a FHIR RiskAssessment

Integration notes:

- OpenMRS can map `Patient.identifier.value` to the OpenMRS patient identifier and consume `Observation` resources using LOINC-coded SpO2, BMI, and respiratory-rate concepts.
- OpenClinic can call the versioned REST endpoints for direct JSON workflows, or the FHIR endpoints when a standards-based integration is preferred.
- FHIR responses use `application/fhir+json` and stay read-only in this adapter; prediction creation remains through `POST /api/v1/predictions/run`.

Notes:

- The React frontend defaults to `VITE_API_URL=http://localhost:8000`.
- `FRONTEND_ORIGIN` defaults to `http://localhost:5173` for CORS with Django session cookies.
- For deployment on `rwandoxy.com`, set `FRONTEND_ORIGIN=https://rwandoxy.com` and include `https://rwandoxy.com,https://www.rwandoxy.com` in `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.
- The development login bootstrap user is `anesthetist` / `munyanezajoel3@gmail.com` with password `Munyaneza@123`.
- Local Wi-Fi QR access is for local testing only.
- Users must be connected to the same Wi-Fi as the laptop running Django and Vite.
- Do not use real patient identifiers or sensitive hospital data during local testing.
  -the dataset usesed to build and develop the model was provided by Kibagabaga L2 teaching hospital
