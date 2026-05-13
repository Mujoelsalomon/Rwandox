import os
import uuid
import threading
import time
from pathlib import Path
import json

from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from apps.predictions.services import run_prediction
import trainer
from typing import Optional
from .models import TrainingJob, ModelArtifact

MODELS_DIR = Path(settings.BASE_DIR) / "models"


def _cors(resp):
    resp["Access-Control-Allow-Origin"] = "*"
    resp["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


@csrf_exempt
def predict_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        payload = request.POST.dict()

    features = payload.get("features") or payload
    result = run_prediction(features)
    return _cors(JsonResponse(result))


@csrf_exempt
def upload_dataset_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
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
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        payload = {}

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
    artifacts = ModelArtifact.objects.all()
    models = [ {"id": a.id, "name": a.name, "model_type": a.model_type, "path": a.path, "metrics": a.metrics} for a in artifacts ]
    return _cors(JsonResponse({"models": models}))


def models_download_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
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
