from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0014_deliverylog_error'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeliveryJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed')], db_index=True, default='pending', max_length=20)),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('max_attempts', models.PositiveIntegerField(default=10)),
                ('next_run_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('locked_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('last_error', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('message', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_job', to='communications.message')),
            ],
            options={
                'ordering': ['-created_at', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='deliveryjob',
            index=models.Index(fields=['status', 'next_run_at'], name='communicati_status_0c0f1f_idx'),
        ),
        migrations.AddIndex(
            model_name='deliveryjob',
            index=models.Index(fields=['message', 'status'], name='communicati_message_6c2d8e_idx'),
        ),
    ]
