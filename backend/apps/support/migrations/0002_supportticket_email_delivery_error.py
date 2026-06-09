from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("support", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="supportticket",
            name="email_delivery_error",
            field=models.TextField(blank=True),
        ),
    ]
