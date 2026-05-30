import os
from pathlib import Path
from django.core.management.base import BaseCommand

from apps.api.models import ModelArtifact


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

        added = 0
        for p in sorted(base.iterdir()):
            if p.is_file():
                name = p.name
                existing = ModelArtifact.objects.filter(path=str(p)).first()
                if existing:
                    continue
                ma = ModelArtifact.objects.create(
                    name=name,
                    path=str(p),
                    model_type=(name.split('_')[0] if '_' in name else ''),
                    metrics=None,
                    is_active=False,
                )
                added += 1
                self.stdout.write(self.style.SUCCESS(f"Imported {name} -> id={ma.id}"))

        self.stdout.write(self.style.SUCCESS(f"Done. {added} files imported."))
