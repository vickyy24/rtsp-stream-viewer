from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("streams", "0003_remove_unused_camera_fields"),
    ]

    operations = [
        migrations.RenameField(
            model_name="camera",
            old_name="name",
            new_name="camera_name",
        ),
    ]
