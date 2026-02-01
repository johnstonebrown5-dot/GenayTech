import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_backfill_school_domains'),
    ]

    operations = [
        migrations.CreateModel(
            name='SchoolIntegrationSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('smtp_host', models.CharField(blank=True, default='', max_length=255)),
                ('smtp_port', models.IntegerField(default=587)),
                ('smtp_username', models.CharField(blank=True, default='', max_length=255)),
                ('smtp_password', models.CharField(blank=True, default='', max_length=255)),
                ('smtp_use_tls', models.BooleanField(default=True)),
                ('smtp_use_ssl', models.BooleanField(default=False)),
                ('smtp_from_email', models.CharField(blank=True, default='', max_length=255)),
                ('sms_provider', models.CharField(blank=True, choices=[('africastalking', "Africa's Talking")], default='africastalking', max_length=50)),
                ('at_username', models.CharField(blank=True, default='', max_length=100)),
                ('at_api_key', models.CharField(blank=True, default='', max_length=255)),
                ('at_sender_id', models.CharField(blank=True, default='', max_length=50)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='integration_settings', to='accounts.school')),
            ],
        ),
    ]
