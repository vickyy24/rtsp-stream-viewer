# Initial email-and-password account schema.
import django.db.models.functions.text
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("email", models.EmailField(max_length=254)),
                ("password", models.CharField(max_length=128)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        django.db.models.functions.text.Lower("email"),
                        name="accounts_user_email_ci_unique",
                    ),
                ],
            },
        ),
    ]
