# Generated migration to add index on DeliveryLog.context field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0019_fix_duplicate_check_constraints'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='deliverylog',
            index=models.Index(fields=['context'], name='communications_del_context_idx'),
        ),
    ]
