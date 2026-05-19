# Generated manually to fix broken pipe issues by optimizing database queries

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0016_rename_communicati_status_0c0f1f_idx_communicati_status_d3cac2_idx_and_more'),
    ]

    operations = [
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
    ]
