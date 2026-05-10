import json
from pathlib import Path

import joblib
from django.core.management.base import BaseCommand

from apps.api.models import ModelArtifact


MODEL_TYPE_MAP = {
    "RandomForestClassifier": "random_forest",
    "LogisticRegression": "logistic_regression",
    "KNeighborsClassifier": "knn",
    "SVC": "svm",
    "MLPClassifier": "mlp",
    "GaussianNB": "naive_bayes",
    "XGBClassifier": "xgboost",
    "LGBMClassifier": "lightgbm",
}


def _infer_model_type(model, filename: str) -> str:
    class_name = type(model).__name__
    if class_name in MODEL_TYPE_MAP:
        return MODEL_TYPE_MAP[class_name]

    lower_name = filename.lower()
    for candidate in MODEL_TYPE_MAP.values():
        if candidate in lower_name:
            return candidate
    return class_name.lower() or "unknown"


def _build_metrics(model, path: Path) -> dict:
    metrics = {
        "estimator_class": type(model).__name__,
        "estimator_module": type(model).__module__,
    }

    if hasattr(model, "n_features_in_"):
        metrics["n_features"] = int(model.n_features_in_)

    if hasattr(model, "classes_"):
        metrics["classes"] = [str(value) for value in model.classes_]

    feature_names = getattr(model, "feature_names_in_", None)
    if feature_names is not None:
        metrics["feature_names"] = [str(value) for value in feature_names]

    meta_path = Path(f"{path}.meta.json")
    if meta_path.exists():
        try:
            metrics["training_metadata"] = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            metrics["training_metadata"] = {"warning": f"Could not parse {meta_path.name}"}

    return metrics


class Command(BaseCommand):
    help = "Import model files from backend/models into ModelArtifact table"

    def add_arguments(self, parser):
        parser.add_argument("--dir", help="Directory to scan (defaults to backend/models)")

    def handle(self, *args, **options):
        base = options.get("dir")
        if not base:
            base = Path(__file__).resolve().parents[4] / "models"
        else:
            base = Path(base)

        self.stdout.write(f"Scanning for model files in {base}")
        if not base.exists():
            self.stderr.write("Models directory does not exist")
            return

        imported = 0
        updated = 0
        for path in sorted(base.iterdir()):
            if not path.is_file() or path.suffix != ".joblib":
                continue

            try:
                model = joblib.load(path)
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"Skipping {path.name}: {exc}"))
                continue

            defaults = {
                "name": path.name,
                "model_type": _infer_model_type(model, path.name),
                "metrics": _build_metrics(model, path),
                "is_active": False,
            }
            artifact, created = ModelArtifact.objects.update_or_create(
                path=str(path),
                defaults=defaults,
            )

            if created:
                imported += 1
                self.stdout.write(self.style.SUCCESS(f"Imported {path.name} -> id={artifact.id}"))
            else:
                updated += 1
                self.stdout.write(self.style.SUCCESS(f"Updated {path.name} -> id={artifact.id}"))

        self.stdout.write(self.style.SUCCESS(f"Done. imported={imported}, updated={updated}"))
