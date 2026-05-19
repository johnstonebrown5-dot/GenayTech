# Generated migration to fix duplicate check constraint names

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0017_add_deliverylog_indexes'),
    ]

    operations = [
        # Remove old check constraints that might exist
        migrations.RunSQL(
            "ALTER TABLE communications_arrearsmessagecampaign DROP CONSTRAINT IF EXISTS communications_arrearsme_email_failed_f72719ac_check",
            reverse_sql=migrations.RunSQL.NOOP,
        ),
        migrations.RunSQL(
            "ALTER TABLE communications_arrearsmessagecampaign DROP CONSTRAINT IF EXISTS communications_arrearsme_email_sent_8c7f5e2c_check",
            reverse_sql=migrations.RunSQL.NOOP,
        ),
        migrations.RunSQL(
            "ALTER TABLE communications_arrearsmessagecampaign DROP CONSTRAINT IF EXISTS communications_arrearsme_sms_failed_3e8f5a2c_check",
            reverse_sql=migrations.RunSQL.NOOP,
        ),
        migrations.RunSQL(
            "ALTER TABLE communications_arrearsmessagecampaign DROP CONSTRAINT IF EXISTS communications_arrearsme_sms_sent_2d8f5a2c_check",
            reverse_sql=migrations.RunSQL.NOOP,
        ),
        # Now alter the fields to PositiveIntegerField with new constraints
        migrations.AlterField(
            model_name='arrearsmessagecampaign',
            name='email_failed',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='arrearsmessagecampaign',
            name='email_sent',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='arrearsmessagecampaign',
            name='sms_failed',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='arrearsmessagecampaign',
            name='sms_sent',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
