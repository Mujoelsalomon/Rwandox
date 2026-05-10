import joblib
import os
from typing import Any

try:
    import xgboost as xgb
except Exception:
    xgb = None

try:
    import lightgbm as lgb
except Exception:
    lgb = None

def load_model(path: str, model_type: str) -> Any:
    """Load a model file given its path and declared type.

    Supports: 'xgboost', 'lightgbm', 'sklearn' (generic joblib),
    and any scikit-learn compatible estimator saved via joblib.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model file not found: {path}")

    model_type = model_type.lower()
    # Prefer joblib-loaded sklearn objects for generality
    if model_type in ("sklearn", "svm", "knn", "mlp", "naive_bayes"):
        return joblib.load(path)

    if model_type == "xgboost":
        # Try joblib first
        try:
            return joblib.load(path)
        except Exception:
            if xgb is None:
                raise RuntimeError("xgboost not installed")
            booster = xgb.Booster()
            booster.load_model(path)
            return booster

    if model_type == "lightgbm":
        try:
            return joblib.load(path)
        except Exception:
            if lgb is None:
                raise RuntimeError("lightgbm not installed")
            return lgb.Booster(model_file=path)

    # Fallback to joblib
    return joblib.load(path)


def predict_proba(model: Any, X):
    """Return probability of positive class for binary tasks.

    Handles scikit-learn, xgboost.Booster, and lightgbm.Booster.
    """
    # scikit-learn style
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)
        # If multiclass, assume positive class is last
        if probs.ndim == 2:
            return probs[:, 1] if probs.shape[1] > 1 else probs[:, 0]
        return probs

    # xgboost.Booster
    if xgb is not None and isinstance(model, xgb.Booster):
        dmat = xgb.DMatrix(X)
        preds = model.predict(dmat)
        return preds

    # lightgbm.Booster
    if lgb is not None and isinstance(model, lgb.Booster):
        preds = model.predict(X)
        return preds

    # fallback: use predict and assume output is probability-like
    if hasattr(model, "predict"):
        preds = model.predict(X)
        return preds

    raise RuntimeError("Model does not support prediction interface")


def save_model(model: Any, path: str):
    """Save a model object to path using joblib."""
    dirname = os.path.dirname(path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    joblib.dump(model, path)

