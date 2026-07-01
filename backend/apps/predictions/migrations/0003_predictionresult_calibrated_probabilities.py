# Generated for calibrated postoperative oxygen prediction probabilities.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("predictions", "0002_predictionresult_model_version_default"),
    ]

    operations = [
        migrations.AddField(
            model_name="predictionresult",
            name="raw_probability",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="predictionresult",
            name="calibrated_probability",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="predictionresult",
            name="display_probability",
            field=models.CharField(blank=True, default="", max_length=12),
        ),
        migrations.AddField(
            model_name="predictionresult",
            name="selected_threshold",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="predictionresult",
            name="model_name",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
    ]
