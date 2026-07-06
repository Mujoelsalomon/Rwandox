from pathlib import Path
import json

from django.http import FileResponse, HttpResponse, JsonResponse

from .audit import record_audit
from .common import cors, csrf_exempt_trusted as csrf_exempt, json_body, require_admin, require_login, require_training_access
from .model_bootstrap import bootstrap_model_artifacts
from .models import ModelArtifact
from metric_benchmarks import enrich_metric_benchmarks


def models_list_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_training_access(request)
    if auth_error:
        return auth_error

    bootstrap_model_artifacts()
    artifacts = ModelArtifact.objects.all()
    models = [model_payload(artifact) for artifact in artifacts]
    record_audit(request, "Viewed model registry", object_type="ModelArtifact", details={"count": len(models)})
    return cors(JsonResponse({"models": models}))


def active_model_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error

    artifact = bootstrap_model_artifacts()["active"]
    model = model_payload(artifact) if artifact else None
    return cors(JsonResponse({"model": model}))


def model_payload(artifact):
    metrics = enrich_metric_benchmarks(artifact.metrics or {})
    duration_seconds = metrics.get("training_duration_seconds")
    duration_display = metrics.get("training_duration_display")
    dataset_path = metrics.get("dataset_path")
    dataset_name = metrics.get("dataset_name") or (Path(dataset_path).name if dataset_path else None)
    auc_value = first_metric(metrics, "test_auc", "val_roc_auc", "val_roc_auc_weighted_ovr", "val_auc", "auc")
    sensitivity_value = first_metric(metrics, "test_sensitivity", "val_sensitivity", "sensitivity", "val_recall_weighted")
    return {
        "id": artifact.id,
        "name": artifact.name,
        "model_type": artifact.model_type,
        "path": artifact.path,
        "metrics": metrics,
        "auc": auc_value,
        "sensitivity": sensitivity_value,
        "auc_classification": metrics.get("auc_classification"),
        "sensitivity_classification": metrics.get("sensitivity_classification"),
        "is_active": artifact.is_active,
        "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
        "training_duration_seconds": duration_seconds,
        "training_duration_display": duration_display,
        "training_job_id": metrics.get("training_job_id"),
        "dataset_path": dataset_path,
        "dataset_name": dataset_name,
        "feature_count": metrics.get("feature_count"),
        "training_row_count": metrics.get("training_row_count"),
        "validation_row_count": metrics.get("validation_row_count"),
    }


def first_metric(metrics, *keys):
    for key in keys:
        value = metrics.get(key)
        if value is not None:
            return value
    return None


@csrf_exempt
def models_activate_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    model_id = json_body(request).get("id")
    try:
        artifact = ModelArtifact.objects.get(id=int(model_id))
    except (ModelArtifact.DoesNotExist, TypeError, ValueError):
        return cors(JsonResponse({"error": "model not found"}, status=404))

    # Allow activation of any trained model regardless of calibration
    ModelArtifact.objects.update(is_active=False)
    artifact.is_active = True
    artifact.save(update_fields=["is_active"])
    record_audit(request, "Activated model", object_type="ModelArtifact", object_id=artifact.id, details={"name": artifact.name})
    return cors(JsonResponse({"model": {"id": artifact.id, "name": artifact.name, "is_active": artifact.is_active}}))


def is_calibrated_artifact(artifact):
    metadata_path = Path(f"{artifact.path}.meta.json")
    if not metadata_path.exists():
        return False
    try:
        metadata = json.loads(metadata_path.read_text())
    except (OSError, json.JSONDecodeError):
        return False
    return has_calibration_metadata(metadata) or has_calibration_metadata(artifact.metrics)


def has_calibration_metadata(metadata):
    if not isinstance(metadata, dict):
        return False
    calibration = metadata.get("calibration") if isinstance(metadata.get("calibration"), dict) else {}
    method = metadata.get("calibration_method") or calibration.get("method")
    if str(method or "").strip():
        return True
    return any(
        key in calibration
        for key in ("brier_score", "mean_predicted_probability", "fraction_of_positives")
    )


def models_download_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error

    model_id = request.GET.get("id")
    if not model_id:
        return cors(JsonResponse({"error": "id query required"}, status=400))
    try:
        artifact = ModelArtifact.objects.get(id=int(model_id))
    except (ModelArtifact.DoesNotExist, ValueError):
        return cors(JsonResponse({"error": "model not found"}, status=404))

    candidate = Path(artifact.path)
    if not candidate.exists():
        return cors(JsonResponse({"error": "file not found on disk"}, status=404))

    record_audit(request, "Downloaded model artifact", object_type="ModelArtifact", object_id=artifact.id, details={"name": artifact.name})
    resp = FileResponse(open(candidate, "rb"), as_attachment=True, filename=candidate.name)
    return cors(resp)
