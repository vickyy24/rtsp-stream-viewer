from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("streams", "0002_camera_owner"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="camera",
            name="owner",
        ),
        migrations.RemoveField(
            model_name="camera",
            name="updated_at",
        ),
    ]
