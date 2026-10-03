from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("streams", "0004_rename_camera_name"),
    ]

    operations = [
        migrations.RenameField(
            model_name="camera",
            old_name="location",
            new_name="camera_location",
        ),
    ]
