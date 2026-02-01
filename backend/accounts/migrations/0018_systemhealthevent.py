from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_school_is_active'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemHealthEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('component', models.CharField(choices=[('sms', 'SMS'), ('email', 'Email'), ('login', 'Login'), ('queries', 'Fetching Queries'), ('payment_mpesa', 'Payments (M-Pesa)'), ('payment_bank', 'Payments (Bank)')], db_index=True, max_length=32)),
                ('ok', models.BooleanField(db_index=True, default=False)),
                ('context', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('school', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='system_health_events', to='accounts.school')),
            ],
            options={
                'ordering': ['-created_at', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='systemhealthevent',
            index=models.Index(fields=['created_at'], name='accounts_sys_created_3c9a2b_idx'),
        ),
        migrations.AddIndex(
            model_name='systemhealthevent',
            index=models.Index(fields=['component', 'created_at'], name='accounts_sys_compone_f4a9a0_idx'),
        ),
        migrations.AddIndex(
            model_name='systemhealthevent',
            index=models.Index(fields=['component', 'ok', 'created_at'], name='accounts_sys_compone_87772c_idx'),
        ),
    ]
