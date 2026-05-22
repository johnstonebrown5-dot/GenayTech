"""Helpers for Django migrations on MySQL 8+ (CHECK constraints on PositiveSmallIntegerField)."""


def drop_mysql_check_constraints_for_column(schema_editor, table_name, column_name):
    """Drop CHECK constraints on a table whose names reference a column."""
    if schema_editor.connection.vendor != 'mysql':
        return
    like = f'%{column_name}%'
    _drop_checks(schema_editor, table_name, constraint_name_like=like)


def drop_all_mysql_check_constraints(schema_editor, table_name):
    """Drop every CHECK constraint on a table (safe before AlterField on MySQL)."""
    if schema_editor.connection.vendor != 'mysql':
        return
    _drop_checks(schema_editor, table_name, constraint_name_like=None)


def _drop_checks(schema_editor, table_name, constraint_name_like=None):
    with schema_editor.connection.cursor() as cursor:
        if constraint_name_like:
            cursor.execute(
                """
                SELECT CONSTRAINT_NAME
                FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = %s
                  AND CONSTRAINT_TYPE = 'CHECK'
                  AND CONSTRAINT_NAME LIKE %s
                """,
                [table_name, constraint_name_like],
            )
        else:
            cursor.execute(
                """
                SELECT CONSTRAINT_NAME
                FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = %s
                  AND CONSTRAINT_TYPE = 'CHECK'
                """,
                [table_name],
            )
        for (name,) in cursor.fetchall():
            cursor.execute(f'ALTER TABLE `{table_name}` DROP CHECK `{name}`')


def drop_checks_for_app_models(apps, schema_editor, app_label, model_names):
    """Drop all CHECK constraints on the DB tables for the given models."""
    if schema_editor.connection.vendor != 'mysql':
        return
    seen_tables = set()
    for model_name in model_names:
        Model = apps.get_model(app_label, model_name)
        table = Model._meta.db_table
        if table in seen_tables:
            continue
        seen_tables.add(table)
        drop_all_mysql_check_constraints(schema_editor, table)
