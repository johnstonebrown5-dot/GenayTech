# Generated manually - Add remarks field to grading bands

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('academics', '0038_optimize_database_storage'),
    ]

    operations = [
        migrations.AddField(
            model_name='stagegradingband',
            name='remarks',
            field=models.CharField(blank=True, help_text="Remark to show on report card (e.g., 'Excellent', 'Good')", max_length=100),
        ),
        migrations.AddField(
            model_name='subjectgradingband',
            name='remarks',
            field=models.CharField(blank=True, help_text="Remark to show on report card (e.g., 'Excellent', 'Good')", max_length=100),
        ),
    ]
