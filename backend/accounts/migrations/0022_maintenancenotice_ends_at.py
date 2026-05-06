from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0033_user_deleted_at_user_deleted_by_user_is_deleted'),
    ]

    operations = [
        migrations.AddField(
            model_name='maintenancenotice',
            name='ends_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
