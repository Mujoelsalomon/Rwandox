import json
from functools import lru_cache
from pathlib import Path

import joblib


def _default_feature_order():
    from .schema import FEATURE_ORDER

    artifacts_dir = Path(__file__).resolve().parent / "artifacts"
    feature_path = artifacts_dir / "feature_order.json"
    if feature_path.exists():
        return json.loads(feature_path.read_text(encoding="utf-8"))
    return FEATURE_ORDER


@lru_cache(maxsize=8)
def _load_bundle(path_str: str, mtime_ns: int):
    path = Path(path_str)
    model = joblib.load(path)
    meta_path = Path(f"{path}.meta.json")
    metadata = {}
    if meta_path.exists():
        metadata = json.loads(meta_path.read_text(encoding="utf-8"))
    feature_order = metadata.get("raw_columns") or metadata.get("columns") or _default_feature_order()
    return model, metadata, feature_order


def load_model_assets(model_path: str = None):
    if not model_path:
        return None, None, _default_feature_order(), {}

    path = Path(model_path)
    if not path.exists():
        return None, None, _default_feature_order(), {}

    model, metadata, feature_order = _load_bundle(str(path.resolve()), path.stat().st_mtime_ns)
    return model, None, feature_order, metadata
