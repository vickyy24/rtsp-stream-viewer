from django.db import migrations, models


def preserve_unverified_legacy_signups(apps, schema_editor):
    database = schema_editor.connection.alias
    User = apps.get_model("accounts", "User")
    Camera = apps.get_model("streams", "Camera")

    for user in User.objects.using(database).filter(is_verified=False).iterator():
        # Keep legacy camera records, but detach them from an account that never
        # completed verification. They must not be silently reassigned later.
        Camera.objects.using(database).filter(owner_id=user.pk).update(owner_id=None)
        user.delete(using=database)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_signup_challenge"),
        ("streams", "0007_camera_owner"),
    ]

    operations = [
        migrations.RunPython(preserve_unverified_legacy_signups, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="user",
            name="is_verified",
        ),
    ]
