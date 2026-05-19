# Generated migration to fix duplicate check constraint names

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0017_add_deliverylog_indexes'),
    ]

    operations = [
        # Remove all check constraints on the table to avoid duplicates
        migrations.RunSQL(
            """
            SELECT CONCAT('ALTER TABLE communications_arrearsmessagecampaign DROP CONSTRAINT ', constraint_name, ';')
            FROM information_schema.table_constraints
            WHERE table_schema = DATABASE()
            AND table_name = 'communications_arrearsmessagecampaign'
            AND constraint_type = 'CHECK';
            """,
            reverse_sql="",
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
