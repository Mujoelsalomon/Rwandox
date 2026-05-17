import os
import uuid
import threading
import time
from pathlib import Path
import json

from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.db import transaction

from apps.predictions.services import run_prediction
from apps.patients.models import Patient
from apps.perioperative.models import PerioperativeRecord
from apps.predictions.models import PredictionResult
import trainer
from typing import Optional
from .models import TrainingJob, ModelArtifact

MODELS_DIR = Path(settings.BASE_DIR) / "models"
DEFAULT_USERNAME = "anesthetist"
DEFAULT_EMAIL = "munyanezajoel3@gmail.com"
DEFAULT_PASSWORD = "Munyaneza@123"


def _cors(resp):
    origin = getattr(settings, "FRONTEND_ORIGIN", "http://localhost:5173")
    resp["Access-Control-Allow-Origin"] = origin
    resp["Access-Control-Allow-Credentials"] = "true"
    resp["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-User-Email, X-CSRFToken"
    return resp


def _json_body(request):
    try:
      return json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
      return request.POST.dict()


def _require_login(request):
    if not request.user.is_authenticated:
        return _cors(JsonResponse({"error": "Authentication required."}, status=401))
    return None


def _ensure_default_user():
    user, created = User.objects.get_or_create(
        username=DEFAULT_USERNAME,
        defaults={
            "email": DEFAULT_EMAIL,
            "first_name": "Anesthetist",
            "is_staff": True,
            "is_superuser": True,
        },
    )
    if created or not user.check_password(DEFAULT_PASSWORD):
        user.set_password(DEFAULT_PASSWORD)
        user.email = DEFAULT_EMAIL
        user.first_name = "Anesthetist"
        user.is_staff = True
        user.is_superuser = True
        user.save()
    return user


def _user_payload(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": user.get_full_name() or user.first_name or user.username,
        "role": "Administrator" if user.is_staff else "Clinician",
    }


@csrf_exempt
def login_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = _json_body(request)
    identifier = str(payload.get("username") or payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    _ensure_default_user()
    username = identifier
    if "@" in identifier:
        user_by_email = User.objects.filter(email__iexact=identifier).first()
        username = user_by_email.username if user_by_email else identifier

    user = authenticate(request, username=username, password=password)
    if user is None:
        return _cors(JsonResponse({"error": "Invalid username/email or password."}, status=401))

    login(request, user)
    return _cors(JsonResponse({"user": _user_payload(user)}))


@csrf_exempt
def register_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = _json_body(request)
    full_name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not full_name or not email or not password:
        return _cors(JsonResponse({"error": "Name, email, and password are required."}, status=400))
    if User.objects.filter(email__iexact=email).exists():
        return _cors(JsonResponse({"error": "An account with this email already exists."}, status=409))

    base_username = email.split("@")[0] or "user"
    username = base_username
    suffix = 1
    while User.objects.filter(username__iexact=username).exists():
        suffix += 1
        username = f"{base_username}{suffix}"

    user = User.objects.create_user(username=username, email=email, password=password)
    name_parts = full_name.split(maxsplit=1)
    user.first_name = name_parts[0]
    user.last_name = name_parts[1] if len(name_parts) > 1 else ""
    user.save(update_fields=["first_name", "last_name"])
    return _cors(JsonResponse({"user": _user_payload(user)}, status=201))


@csrf_exempt
def logout_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    logout(request)
    return _cors(JsonResponse({"ok": True}))


@csrf_exempt
def logout_all_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error
    Session.objects.all().delete()
    logout(request)
    return _cors(JsonResponse({"ok": True}))


def current_user_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if not request.user.is_authenticated:
        return _cors(JsonResponse({"authenticated": False}, status=401))
    return _cors(JsonResponse({"authenticated": True, "user": _user_payload(request.user)}))


@csrf_exempt
def predict_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = _json_body(request)

    features = payload.get("features") or payload
    result = run_prediction(features)
    result = _persist_prediction(features, payload, result)
    return _cors(JsonResponse(result))


@csrf_exempt
def upload_dataset_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    f = request.FILES.get("file")
    if not f:
        return _cors(JsonResponse({"error": "no file provided"}, status=400))

    uploads = Path(settings.MEDIA_ROOT) / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    dest = uploads / f.name
    with open(dest, "wb") as wf:
        for chunk in f.chunks():
            wf.write(chunk)

    return _cors(JsonResponse({"dataset_path": str(dest)}))


def _run_training(job_id: str, dataset_path: str, model_type: Optional[str]):
    try:
        job = TrainingJob.objects.get(job_id=job_id)
        job.status = "running"
        job.save()
    except TrainingJob.DoesNotExist:
        return

    try:
        # call the existing trainer to train and persist a real model
        res = trainer.train_model(dataset_path, target_column=None, model_type=model_type or "random_forest")
        model_path = Path(res["model_path"])
        model_name = model_path.name

        artifact = ModelArtifact.objects.create(
            name=model_name,
            path=str(model_path),
            model_type=res.get("metadata", {}).get("algorithm") or model_type or "generic",
            metrics=res.get("metrics"),
            is_active=True,
        )

        job.status = "completed"
        job.result = {"model_name": model_name, "metrics": res.get("metrics"), "artifact_id": artifact.id}
        job.save()
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.save()


@csrf_exempt
def train_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = _json_body(request)

    dataset_path = payload.get("dataset_path")
    model_type = payload.get("model_type")
    if not dataset_path:
        return _cors(JsonResponse({"error": "dataset_path required"}, status=400))

    job_id = uuid.uuid4().hex
    job = TrainingJob.objects.create(job_id=job_id, dataset_path=dataset_path, model_type=model_type or "", status="queued")
    t = threading.Thread(target=_run_training, args=(job.job_id, dataset_path, model_type), daemon=True)
    t.start()
    return _cors(JsonResponse({"job_id": job.job_id}))


def train_status_view(request, job_id: str):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error
    try:
        job = TrainingJob.objects.get(job_id=job_id)
    except TrainingJob.DoesNotExist:
        return _cors(JsonResponse({"error": "job not found"}, status=404))

    data = {
        "job_id": job.job_id,
        "status": job.status,
        "dataset": job.dataset_path,
        "result": job.result,
        "error": job.error,
        "created_at": job.created_at,
    }
    return _cors(JsonResponse(data))


def models_list_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error
    artifacts = ModelArtifact.objects.all()
    models = [
        {
            "id": a.id,
            "name": a.name,
            "model_type": a.model_type,
            "path": a.path,
            "metrics": a.metrics,
            "is_active": a.is_active,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in artifacts
    ]
    return _cors(JsonResponse({"models": models}))


@csrf_exempt
def models_activate_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    model_id = _json_body(request).get("id")
    try:
        artifact = ModelArtifact.objects.get(id=int(model_id))
    except (ModelArtifact.DoesNotExist, TypeError, ValueError):
        return _cors(JsonResponse({"error": "model not found"}, status=404))

    ModelArtifact.objects.update(is_active=False)
    artifact.is_active = True
    artifact.save(update_fields=["is_active"])
    return _cors(JsonResponse({"model": {"id": artifact.id, "name": artifact.name, "is_active": artifact.is_active}}))


def models_download_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error
    model_id = request.GET.get("id")
    if not model_id:
        return _cors(JsonResponse({"error": "id query required"}, status=400))
    try:
        artifact = ModelArtifact.objects.get(id=int(model_id))
    except (ModelArtifact.DoesNotExist, ValueError):
        return _cors(JsonResponse({"error": "model not found"}, status=404))
    candidate = Path(artifact.path)
    if not candidate.exists():
        return _cors(JsonResponse({"error": "file not found on disk"}, status=404))
    resp = FileResponse(open(candidate, "rb"), as_attachment=True, filename=candidate.name)
    return _cors(resp)


def patients_search_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error

    query = request.GET.get("q", "").strip()
    qs = Patient.objects.all()
    if query:
        qs = qs.filter(hospital_id__icontains=query)

    patients = [_patient_payload(patient) for patient in qs[:10]]
    return _cors(JsonResponse({"patients": patients}))


def prediction_history_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    auth_error = _require_login(request)
    if auth_error:
        return auth_error

    records = PredictionResult.objects.select_related("record", "record__patient").all()[:250]
    return _cors(JsonResponse({"predictions": [_prediction_history_payload(item) for item in records]}))


def _persist_prediction(features, payload, result):
    hospital_id = str(features.get("patient_coded_id") or features.get("hospital_id") or "KBH-UNKNOWN").strip() or "KBH-UNKNOWN"
    urgency = str(features.get("urgency") or "elective").lower()
    if urgency not in {"elective", "emergency"}:
        urgency = "emergency" if "emerg" in urgency else "elective"

    with transaction.atomic():
        patient, _ = Patient.objects.update_or_create(
            hospital_id=hospital_id,
            defaults={
                "age": _int(features.get("age"), 0),
                "sex": str(features.get("sex") or "Unknown")[:10],
                "bmi": _float(features.get("bmi")),
                "smoking_history": _bool(features.get("smoking_history")),
                "comorbidities": str(features.get("comorbidities") or ""),
                "baseline_spo2": _float(features.get("baseline_spo2")),
            },
        )
        record = PerioperativeRecord.objects.create(
            patient=patient,
            surgery_type=str(features.get("surgery_type") or "Not recorded")[:100],
            urgency=urgency,
            surgery_duration=max(0, _int(features.get("surgery_duration"), 0)),
            blood_loss=str(features.get("blood_loss") or "")[:50],
            ward=str(features.get("ward") or "")[:50],
            anesthesia_type=str(features.get("anesthesia_type") or "Not recorded")[:50],
            asa_class=str(features.get("asa_class") or "")[:10],
            residual_effects=_bool(features.get("residual_effects")),
            opioid_use=_bool(features.get("opioid_use")),
            airway_event=str(features.get("airway_event") or "")[:100],
            respiratory_rate=_int_or_none(features.get("respiratory_rate")),
            time_since_surgery=_int_or_none(features.get("time_since_surgery")),
            oxygen_before_prediction=_bool(features.get("oxygen_before_prediction")),
        )
        active_model = ModelArtifact.objects.filter(is_active=True).first()
        prediction = PredictionResult.objects.create(
            record=record,
            predicted_probability=float(result.get("predicted_probability") or result.get("probability") or 0),
            predicted_class=str(result.get("predicted_class") or ""),
            risk_level=str(result.get("risk_level") or ""),
            recommendations=result.get("recommendations") or [],
            contributing_factors=result.get("contributing_factors") or result.get("factors") or [],
            model_version=active_model.name if active_model else str(payload.get("model_type") or "v1.0"),
        )

    result["id"] = prediction.id
    result["patient_id"] = patient.hospital_id
    result["model_version"] = prediction.model_version
    result["generated_at"] = prediction.generated_at.isoformat()
    return result


def _patient_payload(patient):
    latest_record = patient.perioperative_records.first()
    return {
        "id": patient.id,
        "hospital_id": patient.hospital_id,
        "age": patient.age,
        "sex": patient.sex,
        "bmi": patient.bmi,
        "smoking_history": patient.smoking_history,
        "comorbidities": patient.comorbidities,
        "baseline_spo2": patient.baseline_spo2,
        "latest_record": _record_payload(latest_record) if latest_record else None,
    }


def _record_payload(record):
    return {
        "surgery_type": record.surgery_type,
        "urgency": record.urgency,
        "surgery_duration": record.surgery_duration,
        "blood_loss": record.blood_loss,
        "ward": record.ward,
        "procedure_date": record.procedure_date.isoformat() if record.procedure_date else "",
        "anesthesia_type": record.anesthesia_type,
        "asa_class": record.asa_class,
    }


def _prediction_history_payload(prediction):
    record = prediction.record
    patient = record.patient
    return {
        "id": prediction.id,
        "patient_id": patient.hospital_id,
        "age": patient.age,
        "sex": patient.sex,
        "surgery_type": record.surgery_type,
        "patient_disposition": _disposition(prediction.risk_level),
        "predicted_probability": round(float(prediction.predicted_probability) * 100),
        "risk_level": prediction.risk_level,
        "model_version": prediction.model_version,
        "generated_at": prediction.generated_at.isoformat(),
        "recommendations": prediction.recommendations,
        "contributing_factors": prediction.contributing_factors,
    }


def _disposition(risk_level):
    risk = str(risk_level).lower()
    if "high" in risk:
        return "ICU"
    if "moderate" in risk:
        return "HDU"
    return "Ward"


def _bool(value):
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"true", "1", "yes", "y"}


def _float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value, default):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _int_or_none(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None
