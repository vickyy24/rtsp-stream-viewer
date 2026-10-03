import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_reorder_user_id_first"),
    ]

    operations = [
        migrations.CreateModel(
            name="SignupChallenge",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("full_name", models.CharField(max_length=150)),
                ("password_hash", models.CharField(max_length=128)),
                ("code_hash", models.CharField(max_length=64)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("expires_at", models.DateTimeField()),
                ("last_sent_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
        ),
    ]
