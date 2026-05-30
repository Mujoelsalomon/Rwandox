# Generated for API-backed React integration.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("patients", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PerioperativeRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("surgery_type", models.CharField(max_length=100)),
                ("urgency", models.CharField(choices=[("elective", "Elective"), ("emergency", "Emergency")], max_length=20)),
                ("surgery_duration", models.PositiveIntegerField(help_text="Duration in minutes")),
                ("blood_loss", models.CharField(blank=True, max_length=50)),
                ("ward", models.CharField(blank=True, max_length=50)),
                ("procedure_date", models.DateField(blank=True, null=True)),
                ("anesthesia_type", models.CharField(max_length=50)),
                ("asa_class", models.CharField(blank=True, max_length=10)),
                ("residual_effects", models.BooleanField(default=False)),
                ("opioid_use", models.BooleanField(default=False)),
                ("airway_event", models.CharField(blank=True, max_length=100)),
                ("recovery_status", models.CharField(blank=True, max_length=50)),
                ("postop_spo2", models.FloatField(blank=True, null=True)),
                ("respiratory_rate", models.PositiveIntegerField(blank=True, null=True)),
                ("pain_status", models.CharField(blank=True, max_length=50)),
                ("consciousness", models.CharField(blank=True, max_length=50)),
                ("time_since_surgery", models.PositiveIntegerField(blank=True, null=True)),
                ("oxygen_before_prediction", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="perioperative_records", to="patients.patient")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
