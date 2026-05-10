import json
from django.core.management.base import BaseCommand

from apps.api.models import ModelRegistry


class Command(BaseCommand):
    help = "List rows in ModelRegistry table as JSON"

    def handle(self, *args, **options):
        rows = ModelRegistry.objects.all().order_by('-created_at')
        out = []
        for r in rows:
            out.append({
                'id': r.id,
                'model_name': r.model_name,
                'version': r.version,
                'algorithm': r.algorithm,
                'auc': float(r.auc) if r.auc is not None else None,
                'is_active': r.is_active,
                'created_at': r.created_at.isoformat(),
            })
        self.stdout.write(json.dumps(out, indent=2))
