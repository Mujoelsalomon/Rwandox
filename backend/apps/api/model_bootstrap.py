import json
import math
from pathlib import Path

from django.conf import settings

from .models import ModelArtifact


MODEL_NAME = "A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda"


def bootstrap_model_artifacts(models_dir=None):
    custom_models_dir = models_dir is not None
    models_dir = Path(models_dir) if models_dir else Path(settings.BASE_DIR) / "models"
    existing_active = ModelArtifact.objects.filter(is_active=True).first()
    if not custom_models_dir and ModelArtifact.objects.exists():
        return {"created": 0, "active": existing_active or ModelArtifact.objects.first()}
    if not models_dir.exists():
        return {"created": 0, "active": None}

    created = 0
    candidates = sorted(models_dir.glob("*.joblib"), key=lambda path: path.stat().st_mtime, reverse=True)
    for path in candidates:
        metadata = metadata_for(path)
        if metadata is None:
            continue

        artifact, was_created = ModelArtifact.objects.get_or_create(
            path=str(path),
            defaults={
                "name": MODEL_NAME,
                "model_type": metadata.get("algorithm") or model_type_from_name(path.name),
                "metrics": metrics_from_metadata(metadata),
                "is_active": False,
            },
        )
        if was_created:
            created += 1
        elif not artifact.metrics:
            artifact.metrics = metrics_from_metadata(metadata)
            artifact.save(update_fields=["metrics"])

    active = ModelArtifact.objects.filter(is_active=True).first()
    if active and Path(active.path).exists():
        return {"created": created, "active": active}

    newest = next((ModelArtifact.objects.filter(path=str(path)).first() for path in candidates if metadata_for(path)), None)
    if newest:
        ModelArtifact.objects.update(is_active=False)
        newest.is_active = True
        newest.save(update_fields=["is_active"])
        active = newest

    return {"created": created, "active": active}


def active_model_artifact():
    return bootstrap_model_artifacts()["active"]


def metadata_for(model_path):
    metadata_path = Path(f"{model_path}.meta.json")
    if not metadata_path.exists():
        return None
    try:
        return json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def metrics_from_metadata(metadata):
    metrics = dict(metadata.get("performance_metrics") or {})
    for key in (
        "row_count",
        "training_row_count",
        "validation_row_count",
        "validation_size",
        "feature_count",
        "numeric_feature_count",
        "categorical_feature_count",
        "dataset_cleaning",
        "model_parameters",
        "class_weights",
        "weighting_method",
        "selected_threshold",
        "threshold_selection",
        "class_distribution",
        "cross_validation",
        "final_test_metrics",
        "calibration",
        "subgroup_report",
        "top_predictors",
        "random_seed",
        "training_date",
        "model_version",
    ):
        if key in metadata:
            metrics[key] = metadata[key]
    if isinstance(metadata.get("final_test_metrics"), dict):
        metrics.update(metadata["final_test_metrics"])
    return json_safe(metrics)


def json_safe(value):
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    return value


def model_type_from_name(name):
    known_prefixes = (
        "logistic_regression",
        "random_forest",
        "naive_bayes",
        "tab_transformer",
        "lightgbm",
        "xgboost",
        "knn",
        "svm",
        "mlp",
    )
    return next((prefix for prefix in known_prefixes if name.startswith(prefix)), "generic")
