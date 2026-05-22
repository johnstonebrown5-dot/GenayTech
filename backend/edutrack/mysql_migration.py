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


def _existing_index_names(schema_editor, table_name):
    """Return set of index names on a table."""
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, table_name)
    return {name for name, info in constraints.items() if info.get('index')}


def ensure_indexes_renamed_or_created(schema_editor, model, renames):
    """
    For each (old_name, new_name, fields): rename if old exists, else create new if missing.
    renames: iterable of (old_name, new_name, fields_list)
    """
    from django.db.models import Index

    table = model._meta.db_table
    existing = _existing_index_names(schema_editor, table)

    for old_name, new_name, fields in renames:
        if new_name in existing:
            continue
        if old_name in existing:
            old_index = Index(fields=fields, name=old_name)
            new_index = Index(fields=fields, name=new_name)
            schema_editor.rename_index(model, old_index, new_index)
            existing.discard(old_name)
            existing.add(new_name)
        else:
            schema_editor.add_index(model, Index(fields=fields, name=new_name))
            existing.add(new_name)


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
