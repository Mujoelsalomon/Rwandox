import json
from django.core.management.base import BaseCommand

from apps.api.models import (
    Ward,
    SurgeryType,
    AnesthesiaType,
    ModelRegistry,
    ModelArtifact,
    TrainingJob,
    SystemSetting,
)


def qs_to_list(qs, fields):
    out = []
    for o in qs:
        d = {}
        for f in fields:
            v = getattr(o, f)
            try:
                if hasattr(v, 'isoformat'):
                    v = v.isoformat()
            except Exception:
                pass
            d[f] = v
        out.append(d)
    return out


class Command(BaseCommand):
    help = "List multiple tables for verification"

    def handle(self, *args, **options):
        data = {}
        data['wards'] = qs_to_list(Ward.objects.all(), ['id', 'name', 'description', 'is_active', 'created_at'])
        data['surgery_types'] = qs_to_list(SurgeryType.objects.all(), ['id', 'name', 'category', 'is_active', 'created_at'])
        data['anesthesia_types'] = qs_to_list(AnesthesiaType.objects.all(), ['id', 'name', 'is_active', 'created_at'])
        data['model_registry'] = qs_to_list(ModelRegistry.objects.all(), ['id', 'model_name', 'version', 'algorithm', 'is_active', 'created_at'])
        data['model_artifacts'] = qs_to_list(ModelArtifact.objects.all(), ['id', 'name', 'model_type', 'path', 'is_active', 'created_at'])
        data['training_jobs'] = qs_to_list(TrainingJob.objects.all(), ['id', 'job_id', 'dataset_path', 'model_type', 'status', 'created_at'])
        data['system_settings'] = qs_to_list(SystemSetting.objects.all(), ['id', 'setting_key', 'setting_value', 'updated_at'])

        self.stdout.write(json.dumps(data, indent=2, default=str))
