from pathlib import Path
import json


def load_model_assets():
    artifacts_dir = Path(__file__).resolve().parent / "artifacts"
    feature_path = artifacts_dir / "feature_order.json"

    if feature_path.exists():
        feature_order = json.loads(feature_path.read_text())
    else:
        from .schema import FEATURE_ORDER
        feature_order = FEATURE_ORDER

    # Replace these placeholders with actual joblib-loaded objects later.
    model = None
    preprocessor = None
    return model, preprocessor, feature_order
