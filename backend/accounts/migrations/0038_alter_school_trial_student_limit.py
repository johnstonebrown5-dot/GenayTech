# Fixes MySQL duplicate CHECK when converting IntegerField -> PositiveSmallIntegerField.

from django.db import migrations, models

from edutrack.mysql_migration import drop_mysql_check_constraints_for_column


def drop_school_integration_checks(apps, schema_editor):
    drop_mysql_check_constraints_for_column(
        schema_editor, 'accounts_school', 'trial_student_limit'
    )
    drop_mysql_check_constraints_for_column(
        schema_editor, 'accounts_schoolintegrationsettings', 'smtp_port'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0037_alter_passwordresetcode_attempts'),
    ]

    operations = [
        migrations.RunPython(drop_school_integration_checks, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='school',
            name='trial_student_limit',
            field=models.PositiveSmallIntegerField(default=100),
        ),
        migrations.AlterField(
            model_name='schoolintegrationsettings',
            name='smtp_port',
            field=models.PositiveSmallIntegerField(default=587),
        ),
    ]
