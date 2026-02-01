from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_schoolintegrationsettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='school',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
    ]
