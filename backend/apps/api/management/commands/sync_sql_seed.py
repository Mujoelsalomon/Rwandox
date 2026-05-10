from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.api.models import (
    Ward,
    SurgeryType,
    AnesthesiaType,
    ModelRegistry,
    SystemSetting,
)


TABLE_MAP = {
    "ward": (Ward, ["name", "description", "is_active"]),
    "surgery_type": (SurgeryType, ["name", "category", "is_active"]),
    "anesthesia_type": (AnesthesiaType, ["name", "is_active"]),
    "model_registry": (
        ModelRegistry,
        [
            "model_name",
            "version",
            "algorithm",
            "auc",
            "sensitivity",
            "specificity",
            "precision_score",
            "recall_score",
            "f1_score",
            "is_active",
        ],
    ),
    "system_settings": (SystemSetting, ["setting_key", "setting_value", "description"]),
}


def table_exists(table_name):
    with connection.cursor() as cur:
        cur.execute(
            "SELECT to_regclass(%s)", [table_name]
        )
        return cur.fetchone()[0] is not None


def get_columns(table_name):
    with connection.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name=%s",
            [table_name],
        )
        return [r[0] for r in cur.fetchall()]


class Command(BaseCommand):
    help = "Sync rows from raw SQL seed tables into Django models"

    def handle(self, *args, **options):
        found = False
        for tbl, (model_cls, cols) in TABLE_MAP.items():
            if not table_exists(tbl):
                self.stdout.write(f"Table {tbl} not found, skipping")
                continue
            found = True
            db_cols = get_columns(tbl)
            select_cols = [c for c in cols if c in db_cols]
            if not select_cols:
                self.stdout.write(f"No matching columns in {tbl}, skipping")
                continue

            qcols = ", ".join(select_cols)
            with connection.cursor() as cur:
                cur.execute(f"SELECT {qcols} FROM {tbl}")
                rows = cur.fetchall()

            created = 0
            with transaction.atomic():
                for row in rows:
                    data = dict(zip(select_cols, row))
                    # Normalize boolean/int flags
                    if "is_active" in data and data["is_active"] is None:
                        data["is_active"] = False
                    # Map keys to model field names where necessary
                    if tbl == "system_settings":
                        obj, created_flag = model_cls.objects.update_or_create(
                            setting_key=data.get("setting_key"),
                            defaults={
                                "setting_value": data.get("setting_value", ""),
                                "description": data.get("description", ""),
                            },
                        )
                    else:
                        # For other simple models, try create unless exists by unique fields
                        defaults = {k: v for k, v in data.items() if k != "name"}
                        if "name" in data:
                            obj, created_flag = model_cls.objects.update_or_create(
                                name=data.get("name"), defaults=defaults
                            )
                        elif "model_name" in data and "version" in data:
                            obj, created_flag = model_cls.objects.update_or_create(
                                model_name=data.get("model_name"),
                                version=data.get("version"),
                                defaults={
                                    "algorithm": data.get("algorithm"),
                                    "auc": data.get("auc"),
                                    "sensitivity": data.get("sensitivity"),
                                    "specificity": data.get("specificity"),
                                    "precision_score": data.get("precision_score"),
                                    "recall_score": data.get("recall_score"),
                                    "f1_score": data.get("f1_score"),
                                    "is_active": data.get("is_active", False),
                                },
                            )
                        else:
                            # fallback: create
                            obj = model_cls.objects.create(**data)
                            created_flag = True

                    if created_flag:
                        created += 1

            self.stdout.write(self.style.SUCCESS(f"Synced {created} rows into {model_cls.__name__}"))

        if not found:
            self.stdout.write("No known raw seed tables found in DB.")
