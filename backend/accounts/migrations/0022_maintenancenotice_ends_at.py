from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_merge_0020_demorequest_0020_demorequest_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='maintenancenotice',
            name='ends_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
