from pathlib import Path
import json

import joblib


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATASET_PATH = BACKEND_DIR / "datasets" / "kibagabaga_oxygen_dataset_cleaned_dataset.xlsx"
DEFAULT_MODEL_PATH = BACKEND_DIR / "models" / "oxygen_virtual_dataset_random_forest.joblib"


def load_model_assets():
    artifacts_dir = Path(__file__).resolve().parent / "artifacts"
    feature_path = artifacts_dir / "feature_order.json"

    if feature_path.exists():
        feature_order = json.loads(feature_path.read_text())
    else:
        from .schema import FEATURE_ORDER
        feature_order = FEATURE_ORDER

    active_artifact = _active_model_artifact()
    latest_path = None if active_artifact else _latest_model_with_metadata()
    model_path = Path(active_artifact.path) if active_artifact else latest_path or DEFAULT_MODEL_PATH
    if not model_path.exists():
        _train_default_model()

    metadata = _metadata_for(model_path) or {}
    if metadata.get("columns"):
        feature_order = metadata["columns"]

    metadata["_model_name"] = active_artifact.name if active_artifact else "A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda"
    metadata["_model_path"] = str(model_path)
    metadata["_model_type"] = metadata.get("algorithm") or (active_artifact.model_type if active_artifact else "generic")
    metadata["_training_metrics"] = active_artifact.metrics if active_artifact else None
    metadata["_used_trained_model"] = bool(model_path.exists())

    model = joblib.load(model_path) if model_path.exists() else None
    return model, metadata, feature_order


def _active_model_artifact():
    try:
        from apps.api.model_bootstrap import active_model_artifact

        artifact = active_model_artifact()
        if artifact and artifact.path:
            path = Path(artifact.path)
            metadata = _metadata_for(path)
            calibrated = has_calibration_metadata(metadata) or has_calibration_metadata(getattr(artifact, "metrics", None))
            return artifact if path.exists() and calibrated else None
    except Exception:
        return None
    return None


def _latest_model_with_metadata():
    models_dir = BACKEND_DIR / "models"
    if not models_dir.exists():
        return None

    candidates = sorted(models_dir.glob("*.joblib"), key=lambda path: path.stat().st_mtime, reverse=True)
    calibrated = [path for path in candidates if has_calibration_metadata(_metadata_for(path))]
    if calibrated:
        return calibrated[0]
    return next((path for path in candidates if _metadata_for(path)), None)


def _metadata_for(model_path):
    metadata_path = Path(f"{model_path}.meta.json")
    if not metadata_path.exists():
        return None
    return json.loads(metadata_path.read_text())


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


def _train_default_model():
    from trainer import train_model

    return train_model(
        str(DEFAULT_DATASET_PATH),
        target_column="postoperative_oxygen_required",
        model_type="random_forest",
        output_path=str(DEFAULT_MODEL_PATH),
    )
