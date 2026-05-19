# Generated migration to fix duplicate check constraint names
# This migration is a no-op since the fields are already PositiveIntegerField

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0017_add_deliverylog_indexes'),
    ]

    operations = [
        # No-op - fields are already PositiveIntegerField in the database
        migrations.RunSQL("SELECT 1", reverse_sql="SELECT 1"),
    ]
