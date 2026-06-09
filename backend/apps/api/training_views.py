import threading
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.text import get_valid_filename
from django.views.decorators.csrf import csrf_exempt

import trainer

from .common import cors, json_body, require_admin, require_login
from .models import ModelArtifact, TrainingJob


SUPPORTED_DATASET_EXTENSIONS = {".csv", ".tsv", ".tab", ".txt", ".json", ".jsonl", ".xlsx", ".xls"}
SUPPORTED_MODEL_TYPES = {
    "logistic_regression",
    "random_forest",
    "xgboost",
    "lightgbm",
    "knn",
    "svm",
    "mlp",
    "tab_transformer",
    "naive_bayes",
}


@csrf_exempt
def upload_dataset_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    return save_uploaded_dataset(request)


@csrf_exempt
def upload_prediction_dataset_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    return save_uploaded_dataset(request)


def save_uploaded_dataset(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return cors(JsonResponse({"error": "no file provided"}, status=400))
    extension = Path(uploaded_file.name).suffix.lower()
    if extension not in SUPPORTED_DATASET_EXTENSIONS:
        return cors(JsonResponse({"error": f"unsupported dataset format: {extension or 'unknown'}"}, status=400))

    uploads = Path(settings.MEDIA_ROOT) / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    safe_name = get_valid_filename(uploaded_file.name) or f"dataset{extension}"
    dest_name = f"{uuid.uuid4().hex}_{safe_name}"
    storage = FileSystemStorage(location=str(uploads))
    saved_name = storage.save(dest_name, uploaded_file)
    dest = uploads / saved_name

    columns = []
    column_error = ""
    try:
        columns = trainer.dataset_columns(str(dest))
    except Exception as exc:
        column_error = str(exc)
        return cors(JsonResponse({
            "error": column_error,
            "dataset_path": str(dest),
            "filename": saved_name,
            "columns": columns,
            "column_error": column_error,
        }, status=400))

    return cors(JsonResponse({
        "dataset_path": str(dest),
        "filename": saved_name,
        "columns": columns,
        "column_error": column_error,
    }))


@csrf_exempt
def train_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    dataset_path = payload.get("dataset_path")
    model_type = normalize_model_type(payload.get("model_type"))
    target_column = str(payload.get("target") or payload.get("target_column") or "").strip() or None
    if not dataset_path:
        return cors(JsonResponse({"error": "dataset_path required"}, status=400))
    if model_type not in SUPPORTED_MODEL_TYPES:
        return cors(JsonResponse({"error": f"unsupported model_type: {model_type}"}, status=400))

    dataset_error = validate_uploaded_dataset_path(dataset_path)
    if dataset_error:
        return cors(JsonResponse({"error": dataset_error}, status=400))

    job = TrainingJob.objects.create(
        job_id=uuid.uuid4().hex,
        dataset_path=dataset_path,
        model_type=model_type,
        status="queued",
    )
    thread = threading.Thread(target=run_training, args=(job.job_id, dataset_path, model_type, target_column), daemon=True)
    thread.start()
    return cors(JsonResponse({"job_id": job.job_id, "status": job.status, "model_type": model_type}))


def train_status_view(request, job_id):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    try:
        job = TrainingJob.objects.get(job_id=job_id)
    except TrainingJob.DoesNotExist:
        return cors(JsonResponse({"error": "job not found"}, status=404))

    mark_stale_job_failed(job)
    data = training_job_payload(job)
    return cors(JsonResponse(data))


def training_job_payload(job):
    duration_seconds = training_duration_seconds(job)
    return {
        "job_id": job.job_id,
        "status": job.status,
        "dataset": job.dataset_path,
        "model_type": job.model_type,
        "result": job.result,
        "error": job.error,
        "duration_seconds": duration_seconds,
        "duration_display": format_duration(duration_seconds),
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


def training_jobs_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error

    jobs = list(TrainingJob.objects.all().order_by("-created_at")[:50])
    for job in jobs:
        mark_stale_job_failed(job)
    return cors(JsonResponse({
        "jobs": [training_job_payload(job) for job in jobs]
    }))


def run_training(job_id, dataset_path, model_type, target_column):
    try:
        job = TrainingJob.objects.get(job_id=job_id)
        job.status = "running"
        job.save(update_fields=["status", "updated_at"])
    except TrainingJob.DoesNotExist:
        return

    try:
        result = trainer.train_model(
            dataset_path,
            target_column=target_column,
            model_type=model_type,
        )
        model_path = Path(result["model_path"])
        model_name = "A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda"

        ModelArtifact.objects.update(is_active=False)
        artifact = ModelArtifact.objects.create(
            name=model_name,
            path=str(model_path),
            model_type=result.get("metadata", {}).get("algorithm") or model_type or "generic",
            metrics=result.get("metrics"),
            is_active=True,
        )

        job.status = "completed"
        metadata = result.get("metadata", {})
        duration_seconds = training_duration_seconds(job, ended_at=timezone.now())
        job.result = {
            "model_name": model_name,
            "model_type": artifact.model_type,
            "metrics": result.get("metrics"),
            "target_column": metadata.get("target"),
            "feature_count": metadata.get("feature_count") or len(metadata.get("columns") or []),
            "row_count": metadata.get("row_count"),
            "training_row_count": metadata.get("training_row_count"),
            "validation_row_count": metadata.get("validation_row_count"),
            "validation_size": metadata.get("validation_size"),
            "numeric_feature_count": metadata.get("numeric_feature_count"),
            "categorical_feature_count": metadata.get("categorical_feature_count"),
            "dropped_columns": metadata.get("dropped_columns") or [],
            "dataset_cleaning": metadata.get("dataset_cleaning") or result.get("metrics", {}).get("dataset_cleaning") or {},
            "numeric_columns": metadata.get("numeric_columns") or [],
            "categorical_columns": metadata.get("categorical_columns") or [],
            "class_labels": metadata.get("class_labels") or [],
            "model_parameters": metadata.get("model_parameters") or {},
            "training_duration_seconds": duration_seconds,
            "training_duration_display": format_duration(duration_seconds),
            "artifact_id": artifact.id,
        }
        job.error = ""
        job.save()
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        job.save()


def normalize_model_type(value):
    return str(value or "random_forest").strip().lower() or "random_forest"


def validate_uploaded_dataset_path(dataset_path):
    try:
        candidate = Path(dataset_path).resolve()
        uploads = (Path(settings.MEDIA_ROOT) / "uploads").resolve()
    except (OSError, RuntimeError):
        return "invalid dataset_path"

    if uploads not in candidate.parents:
        return "dataset_path must reference an uploaded dataset"
    if not candidate.exists() or not candidate.is_file():
        return "uploaded dataset not found"
    if candidate.suffix.lower() not in SUPPORTED_DATASET_EXTENSIONS:
        return "uploaded dataset format is not supported"
    return ""


def mark_stale_job_failed(job):
    if job.status not in {"queued", "running"} or not job.updated_at:
        return

    stale_minutes = int(getattr(settings, "TRAINING_STALE_MINUTES", 10))
    stale_after = timezone.timedelta(minutes=stale_minutes)
    if timezone.now() - job.updated_at <= stale_after:
        return

    job.status = "failed"
    job.error = (
        "Training stopped before completion. The development server may have restarted. "
        "Start training again; smaller XGBoost settings are now used for local runs."
    )
    job.save(update_fields=["status", "error", "updated_at"])


def training_duration_seconds(job, ended_at=None):
    if not job.created_at:
        return None
    end_time = ended_at or job.updated_at or timezone.now()
    return max(0, int((end_time - job.created_at).total_seconds()))


def format_duration(total_seconds):
    if total_seconds is None:
        return None
    minutes, seconds = divmod(int(total_seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h {minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"
