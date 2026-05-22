# Fixes MySQL error 3822: duplicate CHECK constraint when altering attempts field.
# Safe to re-run if a previous migrate attempt partially applied the constraint.

from django.db import migrations, models


def _drop_attempts_check_constraints(schema_editor):
    if schema_editor.connection.vendor != 'mysql':
        return
    table = 'accounts_passwordresetcode'
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT CONSTRAINT_NAME
            FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = %s
              AND CONSTRAINT_TYPE = 'CHECK'
              AND CONSTRAINT_NAME LIKE %s
            """,
            [table, '%attempts%'],
        )
        for (name,) in cursor.fetchall():
            cursor.execute(f'ALTER TABLE `{table}` DROP CHECK `{name}`')


def drop_attempts_check_constraints_forward(apps, schema_editor):
    _drop_attempts_check_constraints(schema_editor)


def drop_attempts_check_constraints_backward(apps, schema_editor):
    _drop_attempts_check_constraints(schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0035_alter_demorequest_admin_first_name_and_more'),
    ]

    operations = [
        migrations.RunPython(
            drop_attempts_check_constraints_forward,
            drop_attempts_check_constraints_backward,
        ),
        migrations.AlterField(
            model_name='passwordresetcode',
            name='attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
