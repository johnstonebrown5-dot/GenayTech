import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_passwordresetcode'),
    ]

    operations = [
        migrations.CreateModel(
            name='SchoolDomain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(max_length=255, unique=True)),
                ('is_primary', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='domains', to='accounts.school')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['domain'], name='accounts_sc_domain_8cfd4e_idx'),
                    models.Index(fields=['school'], name='accounts_sc_school__7b8f1a_idx'),
                ],
            },
        ),
    ]
