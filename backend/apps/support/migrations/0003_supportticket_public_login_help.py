from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("support", "0002_supportticket_email_delivery_error"),
    ]

    operations = [
        migrations.AlterField(
            model_name="supportticket",
            name="email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AlterField(
            model_name="supportticket",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="support_tickets",
                to="auth.user",
            ),
        ),
    ]
