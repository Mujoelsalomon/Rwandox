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

## Podman (replacement for Docker)

You can run the backend and frontend with Podman instead of Docker. Using WSL2 is recommended on Windows.

Quick start (WSL shell recommended):

```bash
cd /mnt/c/Users/HP-/Desktop/OXYGEN_PREDICTOR_PROJECT
# initialize/start podman machine if needed (run once)
podman machine init
podman machine start

# build and start services (detached)
podman compose -f backend/podman-compose.yml up --build -d

# list containers
podman ps --all --format "table {{.Names}}\t{{.ID}}\t{{.Status}}\t{{.Ports}}"

# view recent logs for the API (replace name from podman ps)
podman logs --follow <api-container-name>
```

PowerShell (Windows) — use Podman Desktop or mount the project into the VM:

```powershell
# start machine
podman machine start

# optionally mount the Windows path into the Podman VM
podman machine mount C:\Users\HP-\Desktop\OXYGEN_PREDICTOR_PROJECT

# run compose
podman compose -f backend/podman-compose.yml up --build -d
```

Helpers

- `scripts/podman-up.ps1` — PowerShell helper to start compose on Windows
- `scripts/podman-up.sh` — POSIX helper for Mac/Linux/WSL

Notes and troubleshooting

- If compose reports a missing provider, install `podman-compose` in WSL: `python3 -m pip install --user podman-compose`, or use Podman's built-in `podman compose` plugin (Podman v3+/v4+).
- Prefer running compose from WSL (`/mnt/c/...`) to avoid bind-mount issues between Windows and the Podman VM.
- If services fail, collect outputs from `podman ps --all` and `podman compose -f backend/podman-compose.yml logs --tail=200` and share them.

## Prebuilt images and CI caching

To speed developer runs and CI, this repository can publish prebuilt container images (backend and frontend) to a registry. A GitHub Actions workflow (`.github/workflows/images.yml`) builds and pushes images to GHCR (`ghcr.io/<org>/oxygen-predictor-api` and `...-frontend`). The workflow uses GitHub Actions cache for build layers so subsequent builds are faster.

Using prebuilt images locally

1. Pull and run the published images (uses `podman compose` with the remote override):

```bash
./scripts/pull-and-run-images.sh ghcr.io/${your-org-or-user}
```

2. Alternatively run compose with the override file directly (replace REGISTRY_OWNER env if needed):

```bash
REGISTRY_OWNER=ghcr.io REGISTRY_USER=your-org podman compose -f backend/podman-compose.yml -f backend/podman-compose.remote.yml up --build -d
```

Notes:

- If you want the local build (source-to-image) instead of the prebuilt image, run the base compose without the `-f backend/podman-compose.remote.yml` override.
- CI builds are configured to publish images and should speed up developer runs when images are available.
