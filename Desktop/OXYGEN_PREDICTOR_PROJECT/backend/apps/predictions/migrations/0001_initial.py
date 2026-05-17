# Generated for API-backed React integration.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("perioperative", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PredictionResult",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("predicted_probability", models.FloatField()),
                ("predicted_class", models.CharField(max_length=20)),
                ("risk_level", models.CharField(max_length=20)),
                ("recommendations", models.JSONField(blank=True, default=list)),
                ("contributing_factors", models.JSONField(blank=True, default=list)),
                ("model_version", models.CharField(default="v1.0", max_length=50)),
                ("generated_at", models.DateTimeField(auto_now_add=True)),
                ("record", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="prediction", to="perioperative.perioperativerecord")),
            ],
            options={"ordering": ["-generated_at"]},
        ),
    ]
