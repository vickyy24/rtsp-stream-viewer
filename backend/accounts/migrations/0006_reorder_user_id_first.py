from django.db import migrations


def reorder_user_id_first(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != "postgresql":
        raise RuntimeError("The accounts_user column-order migration requires PostgreSQL.")

    quote = schema_editor.quote_name
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = %s "
            "ORDER BY ordinal_position",
            ["accounts_user"],
        )
        columns = [row[0] for row in cursor.fetchall()]
        if not columns or columns[0] == "id":
            return

        cursor.execute(
            "SELECT ns.nspname, rel.relname, con.conname, pg_get_constraintdef(con.oid) "
            "FROM pg_constraint con "
            "JOIN pg_class rel ON rel.oid = con.conrelid "
            "JOIN pg_namespace ns ON ns.oid = rel.relnamespace "
            "WHERE con.confrelid = 'accounts_user'::regclass AND con.contype = 'f'"
        )
        foreign_keys = cursor.fetchall()
        for schema, table, name, _definition in foreign_keys:
            cursor.execute(
                f"ALTER TABLE {quote(schema)}.{quote(table)} DROP CONSTRAINT {quote(name)}"
            )

        cursor.execute('LOCK TABLE "accounts_user" IN ACCESS EXCLUSIVE MODE')
        cursor.execute(
            """
            CREATE TABLE accounts_user_reordered (
                id bigserial NOT NULL PRIMARY KEY,
                full_name varchar(150) NOT NULL,
                email varchar(254) NOT NULL,
                password varchar(128) NOT NULL,
                is_verified boolean NOT NULL DEFAULT false
            )
            """
        )
        cursor.execute(
            """
            INSERT INTO accounts_user_reordered (id, full_name, email, password, is_verified)
            SELECT id, full_name, email, password, is_verified FROM accounts_user
            """
        )
        cursor.execute(
            "CREATE UNIQUE INDEX accounts_user_reordered_email_ci_unique "
            "ON accounts_user_reordered (LOWER(email))"
        )
        cursor.execute('ALTER TABLE "accounts_user" RENAME TO "accounts_user_previous"')
        cursor.execute('ALTER TABLE "accounts_user_reordered" RENAME TO "accounts_user"')
        cursor.execute('DROP TABLE "accounts_user_previous"')
        cursor.execute(
            "ALTER SEQUENCE accounts_user_reordered_id_seq RENAME TO accounts_user_id_seq"
        )
        cursor.execute("ALTER INDEX accounts_user_reordered_pkey RENAME TO accounts_user_pkey")
        cursor.execute(
            "ALTER INDEX accounts_user_reordered_email_ci_unique "
            "RENAME TO accounts_user_email_ci_unique"
        )
        cursor.execute(
            "SELECT setval(pg_get_serial_sequence('accounts_user', 'id'), "
            "COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM accounts_user"
        )

        for schema, table, name, definition in foreign_keys:
            cursor.execute(
                f"ALTER TABLE {quote(schema)}.{quote(table)} "
                f"ADD CONSTRAINT {quote(name)} {definition}"
            )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_user_email_verification"),
        ("streams", "0007_camera_owner"),
    ]

    operations = [
        migrations.RunPython(reorder_user_id_first, migrations.RunPython.noop),
    ]
