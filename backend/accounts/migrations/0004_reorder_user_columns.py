from django.db import migrations


def put_full_name_first(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != "postgresql":
        raise RuntimeError("The accounts_user column-order migration requires PostgreSQL.")

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = %s "
            "ORDER BY ordinal_position",
            ["accounts_user"],
        )
        columns = [row[0] for row in cursor.fetchall()]
        if not columns or columns[0] == "full_name":
            return

        cursor.execute('LOCK TABLE "accounts_user" IN ACCESS EXCLUSIVE MODE')
        cursor.execute(
            """
            CREATE TABLE accounts_user_reordered (
                full_name varchar(150) NOT NULL,
                id bigserial NOT NULL PRIMARY KEY,
                email varchar(254) NOT NULL,
                password varchar(128) NOT NULL
            )
            """
        )
        cursor.execute(
            """
            INSERT INTO accounts_user_reordered (full_name, id, email, password)
            SELECT full_name, id, email, password FROM accounts_user
            """
        )
        cursor.execute(
            "CREATE UNIQUE INDEX accounts_user_reordered_email_ci_unique "
            "ON accounts_user_reordered (LOWER(email))"
        )
        cursor.execute('ALTER TABLE "accounts_user" RENAME TO "accounts_user_previous"')
        cursor.execute(
            'ALTER TABLE "accounts_user_reordered" RENAME TO "accounts_user"'
        )
        cursor.execute('DROP TABLE "accounts_user_previous"')
        cursor.execute(
            "ALTER SEQUENCE accounts_user_reordered_id_seq RENAME TO accounts_user_id_seq"
        )
        cursor.execute(
            "ALTER INDEX accounts_user_reordered_pkey RENAME TO accounts_user_pkey"
        )
        cursor.execute(
            "ALTER INDEX accounts_user_reordered_email_ci_unique "
            "RENAME TO accounts_user_email_ci_unique"
        )
        cursor.execute(
            "SELECT setval(pg_get_serial_sequence('accounts_user', 'id'), "
            "COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM accounts_user"
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_user_full_name"),
    ]

    operations = [
        migrations.RunPython(put_full_name_first, migrations.RunPython.noop),
    ]
