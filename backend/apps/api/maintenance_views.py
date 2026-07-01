import os
import shutil
import time
from pathlib import Path

from django.conf import settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from apps.predictions.models import PredictionResult
from metric_benchmarks import enrich_metric_benchmarks
from ml.model_loader import load_model_assets

from .audit import record_audit
from .common import cors, require_admin
from .model_bootstrap import active_model_artifact
from .models import EmrSyncLog, ModelArtifact, TrainingJob


def maintenance_health_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error

    api = api_status_payload(request)
    database = database_status_payload()
    model = model_status_payload()
    prediction = prediction_service_payload()
    storage = storage_status_payload()
    sync = sync_status_payload()

    record_audit(request, "Viewed maintenance health", object_type="Maintenance")
    return cors(JsonResponse({
        "api": api,
        "database": database,
        "model": model,
        "prediction_service": prediction,
        "storage": storage,
        "sync": sync,
        "checked_at": timezone.now().isoformat(),
    }))


def maintenance_api_status_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    record_audit(request, "Checked API status", object_type="Maintenance")
    return cors(JsonResponse(api_status_payload(request)))


def maintenance_database_status_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    record_audit(request, "Checked database status", object_type="Maintenance")
    return cors(JsonResponse(database_status_payload()))


def maintenance_model_status_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    record_audit(request, "Checked model status", object_type="Maintenance")
    return cors(JsonResponse(model_status_payload()))


def maintenance_storage_status_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    record_audit(request, "Checked storage status", object_type="Maintenance")
    return cors(JsonResponse(storage_status_payload()))


@csrf_exempt
def maintenance_reload_model_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))
    record_audit(request, "Reloaded active model", object_type="Maintenance")
    return cors(JsonResponse(model_status_payload(force_load=True)))


@csrf_exempt
def maintenance_clear_temp_files_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    removed = []
    candidates = [
        Path(settings.BASE_DIR) / "tmp",
        Path(settings.BASE_DIR) / "temp",
        Path(settings.MEDIA_ROOT) / "temp",
    ]
    for directory in candidates:
        if not directory.exists() or not directory.is_dir():
            continue
        for item in directory.iterdir():
            try:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
                removed.append(str(item))
            except OSError:
                continue

    record_audit(request, "Cleared temporary files", object_type="Maintenance", details={"removed_count": len(removed)})
    return cors(JsonResponse({
        "status": "ok",
        "removed_count": len(removed),
        "removed_files": removed[:50],
        "message": "Temporary files cleared.",
    }))


def maintenance_export_logs_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error

    log_candidates = [
        Path(settings.BASE_DIR) / "django_local_wifi.log",
        Path(settings.BASE_DIR).parent / "uvicorn_stdout.txt",
        Path(settings.BASE_DIR).parent / "uvicorn_stderr.txt",
    ]
    sections = []
    for log_path in log_candidates:
        if not log_path.exists() or not log_path.is_file():
            continue
        try:
            text = log_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        sections.append(f"===== {log_path.name} =====\n{text[-20000:]}")

    if not sections:
        sections.append("No application log files were found.")

    response = HttpResponse("\n\n".join(sections), content_type="text/plain; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="model-logs-{timezone.now().strftime("%Y%m%d%H%M%S")}.txt"'
    record_audit(request, "Exported model logs", object_type="Maintenance")
    return cors(response)


@csrf_exempt
def maintenance_reset_failed_jobs_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    count = TrainingJob.objects.filter(status="failed").update(
        status="queued",
        error="",
        updated_at=timezone.now(),
    )
    record_audit(request, "Reset failed training jobs", object_type="TrainingJob", details={"reset_count": count})
    return cors(JsonResponse({
        "status": "ok",
        "reset_count": count,
        "message": f"{count} failed training job(s) reset.",
    }))


@csrf_exempt
def maintenance_backup_database_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    database_name = connection.settings_dict.get("NAME")
    source = Path(str(database_name)) if database_name else None
    if connection.vendor != "sqlite" or not source or not source.exists():
        message = (
            "PostgreSQL backups must be created with pg_dump or the managed database provider backup model."
            if connection.vendor == "postgresql"
            else "Automatic file backup is available for SQLite databases only."
        )
        return cors(JsonResponse({
            "status": "warning",
            "message": message,
            "database_type": connection.vendor,
            "database_name": database_name,
        }, status=400))

    backup_dir = Path(settings.BASE_DIR) / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{source.stem}-{timezone.now().strftime('%Y%m%d%H%M%S')}{source.suffix}"
    shutil.copy2(source, backup_path)
    record_audit(request, "Backed up database", object_type="Maintenance", details={"backup_path": str(backup_path)})
    return cors(JsonResponse({
        "status": "ok",
        "backup_path": str(backup_path),
        "message": "Database backup created.",
    }))


@csrf_exempt
def maintenance_test_prediction_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    from apps.predictions.services import run_prediction

    result = run_prediction({
        "patient_coded_id": "MAINTENANCE-TEST",
        "age": 55,
        "sex": "Female",
        "bmi": 28,
        "baseline_spo2": 95,
        "postop_spo2": 93,
        "respiratory_rate": 20,
        "asa_class": "II",
        "surgery_type": "Abdominal",
        "urgency": "elective",
        "surgery_duration": 90,
        "anesthesia_type": "General",
    })
    record_audit(request, "Ran maintenance test prediction", object_type="Maintenance")
    return cors(JsonResponse({
        "status": "ok",
        "prediction": result,
        "message": "Test prediction completed.",
    }))


def api_status_payload(request):
    started_at = time.perf_counter()
    backend_url = request.build_absolute_uri("/") if request else ""
    response_time_ms = round((time.perf_counter() - started_at) * 1000, 2)
    return {
        "status": "ok",
        "label": "Ready",
        "backend_url": backend_url.rstrip("/"),
        "response_time_ms": response_time_ms,
        "last_checked": timezone.now().isoformat(),
    }


def database_status_payload():
    started_at = time.perf_counter()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        response_time_ms = round((time.perf_counter() - started_at) * 1000, 2)
        database_settings = connection.settings_dict
        table_names = connection.introspection.table_names()
        pending_migrations = pending_migration_count()
        return {
            "status": "ok",
            "database_type": connection.vendor,
            "database_name": database_settings.get("NAME") or "Not available",
            "database_host": database_settings.get("HOST") or "local file",
            "database_port": database_settings.get("PORT") or "default",
            "connection_result": "Connected",
            "table_count": len(table_names),
            "pending_migrations": pending_migrations,
            "migration_status": "Up to date" if pending_migrations == 0 else f"{pending_migrations} pending",
            "response_time_ms": response_time_ms,
            "last_successful_connection": timezone.now().isoformat(),
        }
    except Exception as exc:
        return {
            "status": "failed",
            "database_type": connection.vendor,
            "database_name": connection.settings_dict.get("NAME") or "Not available",
            "connection_result": str(exc),
            "last_successful_connection": None,
        }


def model_status_payload(force_load=False):
    active = active_model_artifact()
    loaded = False
    load_error = ""
    if force_load or active:
        try:
            model, metadata, _ = load_model_assets()
            loaded = model is not None
            if not active:
                active = ModelArtifact(
                    name=metadata.get("_model_name") or "A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda",
                    path=metadata.get("_model_path") or "",
                    model_type=metadata.get("_model_type") or metadata.get("algorithm") or "generic",
                    metrics=metadata.get("_training_metrics") or {},
                )
        except Exception as exc:
            load_error = str(exc)

    metrics = enrich_metric_benchmarks(active.metrics) if active and isinstance(active.metrics, dict) else {}
    model_path = Path(active.path) if active and active.path else None
    model_file_exists = bool(model_path and model_path.exists())
    return {
        "status": "ok" if active and model_file_exists and loaded else "warning" if active else "failed",
        "active_model_name": active.name if active else "No active model",
        "model_type": active.model_type if active else "Not available",
        "model_loaded": loaded,
        "last_trained_date": active.created_at.isoformat() if active and getattr(active, "created_at", None) else None,
        "validation_accuracy": metrics.get("val_accuracy") if isinstance(metrics, dict) else None,
        "auc": (
            metrics.get("test_auc")
            or metrics.get("val_roc_auc")
            or metrics.get("val_roc_auc_weighted_ovr")
            or metrics.get("val_auc")
            or metrics.get("auc")
        ) if isinstance(metrics, dict) else None,
        "sensitivity": (
            metrics.get("test_sensitivity")
            or metrics.get("val_sensitivity")
            or metrics.get("sensitivity")
            or metrics.get("val_recall_weighted")
        ) if isinstance(metrics, dict) else None,
        "f1_score": (metrics.get("val_f1_score") or metrics.get("f1_score")) if isinstance(metrics, dict) else None,
        "load_error": load_error,
    }


def prediction_service_payload():
    latest = PredictionResult.objects.order_by("-generated_at").first()
    return {
        "status": "ok",
        "prediction_api_status": "Ready",
        "last_prediction_date": latest.generated_at.isoformat() if latest else None,
        "total_predictions": PredictionResult.objects.count(),
    }


def storage_status_payload():
    model_dir = Path(settings.BASE_DIR) / "models"
    upload_dir = Path(settings.MEDIA_ROOT) / "uploads"
    log_dir = Path(settings.BASE_DIR)
    usage_target = Path(settings.BASE_DIR)
    usage = shutil.disk_usage(usage_target)
    return {
        "status": "ok" if model_dir.exists() and upload_dir.exists() else "warning",
        "model_folder_status": folder_status(model_dir),
        "uploaded_dataset_folder_status": folder_status(upload_dir),
        "log_folder_status": folder_status(log_dir),
        "available_storage_bytes": usage.free,
        "available_storage_display": format_bytes(usage.free),
    }


def sync_status_payload():
    latest = EmrSyncLog.objects.order_by("-created_at").first()
    if not latest:
        return {
            "status": "warning",
            "label": "No sync records",
            "last_sync": None,
        }
    status = "ok" if latest.sync_status.lower() in {"ok", "success", "synced", "completed"} else "warning"
    return {
        "status": status,
        "label": latest.sync_status,
        "last_sync": latest.synced_at.isoformat() if latest.synced_at else latest.created_at.isoformat(),
    }


def folder_status(path):
    if not path.exists():
        return "Missing"
    if not path.is_dir():
        return "Not a folder"
    return "Ready" if os.access(path, os.R_OK) else "Needs attention"


def format_bytes(value):
    size = float(value)
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024 or unit == "TB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024


def pending_migration_count():
    executor = MigrationExecutor(connection)
    return len(executor.migration_plan(executor.loader.graph.leaf_nodes()))
