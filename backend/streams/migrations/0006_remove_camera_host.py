from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("streams", "0005_rename_camera_location"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="camera",
            name="host",
        ),
    ]
