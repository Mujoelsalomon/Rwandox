import threading
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.http import HttpResponse, JsonResponse
from django.utils.text import get_valid_filename
from django.views.decorators.csrf import csrf_exempt

import trainer

from .common import cors, json_body, require_admin
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

    data = {
        "job_id": job.job_id,
        "status": job.status,
        "dataset": job.dataset_path,
        "model_type": job.model_type,
        "result": job.result,
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }
    return cors(JsonResponse(data))


def training_jobs_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error

    jobs = TrainingJob.objects.all().order_by("-created_at")[:50]
    return cors(JsonResponse({
        "jobs": [
            {
                "job_id": job.job_id,
                "status": job.status,
                "dataset": job.dataset_path,
                "model_type": job.model_type,
                "result": job.result,
                "error": job.error,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "updated_at": job.updated_at.isoformat() if job.updated_at else None,
            }
            for job in jobs
        ]
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
        model_name = model_path.name

        ModelArtifact.objects.update(is_active=False)
        artifact = ModelArtifact.objects.create(
            name=model_name,
            path=str(model_path),
            model_type=result.get("metadata", {}).get("algorithm") or model_type or "generic",
            metrics=result.get("metrics"),
            is_active=True,
        )

        job.status = "completed"
        job.result = {
            "model_name": model_name,
            "model_type": artifact.model_type,
            "metrics": result.get("metrics"),
            "target_column": result.get("metadata", {}).get("target"),
            "feature_count": len(result.get("metadata", {}).get("columns") or []),
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
