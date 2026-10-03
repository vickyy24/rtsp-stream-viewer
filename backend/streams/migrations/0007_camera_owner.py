from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def give_existing_cameras_to_only_account(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Camera = apps.get_model("streams", "Camera")
    database = schema_editor.connection.alias
    users = User.objects.using(database).all()
    if users.count() == 1:
        user = users.first()
        Camera.objects.using(database).filter(owner__isnull=True).update(owner_id=user.pk)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_user_email_verification"),
        ("streams", "0006_remove_camera_host"),
    ]

    operations = [
        migrations.AddField(
            model_name="camera",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="cameras",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(give_existing_cameras_to_only_account, migrations.RunPython.noop),
    ]
