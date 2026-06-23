from pathlib import Path
from django.core.management.base import BaseCommand

from apps.api.model_bootstrap import bootstrap_model_artifacts


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

        result = bootstrap_model_artifacts(base)
        active = result["active"]

        if active:
            self.stdout.write(self.style.SUCCESS(f"Active model: {Path(active.path).name} -> id={active.id}"))
        self.stdout.write(self.style.SUCCESS(f"Done. {result['created']} files imported."))
