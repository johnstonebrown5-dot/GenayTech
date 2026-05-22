# Fixes MySQL error 3822: duplicate CHECK constraint when altering attempts field.

from django.db import migrations, models

from edutrack.mysql_migration import drop_mysql_check_constraints_for_column


def drop_attempts_check_constraints_forward(apps, schema_editor):
    drop_mysql_check_constraints_for_column(
        schema_editor, 'accounts_passwordresetcode', 'attempts'
    )


def drop_attempts_check_constraints_backward(apps, schema_editor):
    drop_attempts_check_constraints_forward(apps, schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0035_alter_demorequest_admin_first_name_and_more'),
    ]

    operations = [
        migrations.RunPython(drop_attempts_check_constraints_forward, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='passwordresetcode',
            name='attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
