import threading
import uuid
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

import trainer

from .common import cors, json_body, require_login
from .models import ModelArtifact, TrainingJob


@csrf_exempt
def upload_dataset_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return cors(JsonResponse({"error": "no file provided"}, status=400))

    uploads = Path(settings.MEDIA_ROOT) / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    dest = uploads / uploaded_file.name
    with open(dest, "wb") as wf:
        for chunk in uploaded_file.chunks():
            wf.write(chunk)

    columns = []
    column_error = ""
    try:
        columns = trainer.dataset_columns(str(dest))
    except Exception as exc:
        column_error = str(exc)

    return cors(JsonResponse({
        "dataset_path": str(dest),
        "columns": columns,
        "column_error": column_error,
    }))


@csrf_exempt
def train_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    dataset_path = payload.get("dataset_path")
    model_type = payload.get("model_type")
    target_column = payload.get("target") or payload.get("target_column") or None
    if not dataset_path:
        return cors(JsonResponse({"error": "dataset_path required"}, status=400))

    job = TrainingJob.objects.create(
        job_id=uuid.uuid4().hex,
        dataset_path=dataset_path,
        model_type=model_type or "",
        status="queued",
    )
    thread = threading.Thread(target=run_training, args=(job.job_id, dataset_path, model_type, target_column), daemon=True)
    thread.start()
    return cors(JsonResponse({"job_id": job.job_id}))


def train_status_view(request, job_id):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
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
        "result": job.result,
        "error": job.error,
        "created_at": job.created_at,
    }
    return cors(JsonResponse(data))


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
            model_type=model_type or "random_forest",
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
            "metrics": result.get("metrics"),
            "artifact_id": artifact.id,
        }
        job.error = ""
        job.save()
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        job.save()
