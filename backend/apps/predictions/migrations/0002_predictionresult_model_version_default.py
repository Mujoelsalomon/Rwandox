from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("predictions", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="predictionresult",
            name="model_version",
            field=models.CharField(default="Not recorded", max_length=50),
        ),
    ]
