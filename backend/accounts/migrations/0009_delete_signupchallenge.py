from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0008_remove_user_is_verified"),
    ]

    operations = [
        migrations.DeleteModel(
            name="SignupChallenge",
        ),
    ]
