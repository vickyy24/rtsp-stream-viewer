from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_reorder_user_columns")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_verified",
            field=models.BooleanField(default=False),
        ),
    ]
