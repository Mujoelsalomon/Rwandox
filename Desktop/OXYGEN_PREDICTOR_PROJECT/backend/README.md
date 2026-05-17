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

API endpoints:

- `POST /auth/login` - login with `{"username":"anesthetist","password":"..."}`
- `POST /auth/register` - create a Django user account
- `POST /auth/logout` - end the current Django session
- `POST /auth/logout-all` - end all active Django sessions
- `GET /auth/me` - return the current authenticated user
- `POST /predict` - generate and persist a prediction
- `GET /prediction-history` - list persisted predictions
- `GET /patients/search?q=KBH` - search patients by hospital ID
- `POST /upload-dataset` - upload a model-training dataset
- `POST /train` - start a model training job
- `GET /train/status/<job_id>` - inspect training status
- `GET /models` - list model artifacts
- `POST /models/activate` - mark one model artifact active
- `GET /models/download?id=<id>` - download a model artifact

Notes:

- The React frontend defaults to `VITE_API_URL=http://localhost:8000`.
- `FRONTEND_ORIGIN` defaults to `http://localhost:5173` for CORS with Django session cookies.
- The development login bootstrap user is `anesthetist` / `munyanezajoel3@gmail.com` with password `Munyaneza@123`.
