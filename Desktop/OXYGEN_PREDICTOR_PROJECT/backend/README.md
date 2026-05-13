# Backend (Django + Postgres)

This folder now contains a minimal Django backend configured for Postgres.

Setup (virtualenv recommended):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# start postgres with docker-compose
docker compose up -d
# run migrations
python manage.py makemigrations
python manage.py migrate
# (optional) create admin user
python manage.py createsuperuser
# run dev server
python manage.py runserver
```

API endpoints (local dev):

- GET /api/patients/ — list patients
- POST /api/patients/create/ — create patient with JSON {"name":"Alice","age":42}

Notes:

- Environment variables are read from `.env` (see `.env.example`).
- The Docker Compose service is named `db` and matches the default DB host in settings.
