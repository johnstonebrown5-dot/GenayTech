# Generated manually to fix broken pipe issues by optimizing database queries

from django.db import migrations, models

from edutrack.mysql_migration import ensure_indexes_renamed_or_created


_DELIVERYLOG_INDEXES = (
    (None, 'comm_del_school_created_idx', ['school_id', 'created_at']),
    (None, 'comm_del_school_channel_created_idx', ['school_id', 'channel', 'created_at']),
    (None, 'comm_del_school_status_idx', ['school_id', 'status']),
)


def ensure_deliverylog_indexes_forward(apps, schema_editor):
    DeliveryLog = apps.get_model('communications', 'deliverylog')
    ensure_indexes_renamed_or_created(schema_editor, DeliveryLog, _DELIVERYLOG_INDEXES)


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0016_rename_communicati_status_0c0f1f_idx_communicati_status_d3cac2_idx_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddIndex(
                    model_name='deliverylog',
                    index=models.Index(fields=['school_id', 'created_at'], name='comm_del_school_created_idx'),
                ),
                migrations.AddIndex(
                    model_name='deliverylog',
                    index=models.Index(fields=['school_id', 'channel', 'created_at'], name='comm_del_school_channel_created_idx'),
                ),
                migrations.AddIndex(
                    model_name='deliverylog',
                    index=models.Index(fields=['school_id', 'status'], name='comm_del_school_status_idx'),
                ),
            ],
            database_operations=[
                migrations.RunPython(ensure_deliverylog_indexes_forward, migrations.RunPython.noop),
            ],
        ),
    ]
