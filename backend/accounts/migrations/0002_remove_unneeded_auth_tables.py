from django.db import migrations


LEGACY_TABLES = (
    "accounts_user_groups",
    "accounts_user_user_permissions",
    "auth_group_permissions",
    "auth_group",
    "auth_permission",
    "django_content_type",
)
LEGACY_USER_COLUMNS = (
    "last_login",
    "is_superuser",
    "first_name",
    "last_name",
    "is_staff",
    "is_active",
    "date_joined",
)


def remove_legacy_auth_schema(apps, schema_editor):
    connection = schema_editor.connection
    user_table = "accounts_user"
    with connection.cursor() as cursor:
        tables = set(connection.introspection.table_names(cursor))
        if user_table in tables:
            columns = {
                column.name
                for column in connection.introspection.get_table_description(cursor, user_table)
            }
            for column in LEGACY_USER_COLUMNS:
                if column in columns:
                    schema_editor.execute(
                        f'ALTER TABLE "{user_table}" DROP COLUMN "{column}"'
                    )

        tables = set(connection.introspection.table_names(cursor))
        for table in LEGACY_TABLES:
            if table in tables:
                schema_editor.execute(f'DROP TABLE "{table}"')


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [
        migrations.RunPython(remove_legacy_auth_schema),
    ]
