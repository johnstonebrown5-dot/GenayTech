from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0024_alter_user_profile_picture'),
    ]

    operations = [
        migrations.CreateModel(
            name='DashboardShowcaseItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True, default='')),
                ('image_url', models.URLField(max_length=600)),
                ('public_id', models.CharField(blank=True, default='', max_length=300)),
                ('sort_order', models.IntegerField(db_index=True, default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='dashboard_showcase_items', to='accounts.user')),
            ],
            options={
                'ordering': ['sort_order', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='dashboardshowcaseitem',
            index=models.Index(fields=['sort_order', 'id'], name='accounts_da_sort_or_e39192_idx'),
        ),
        migrations.AddIndex(
            model_name='dashboardshowcaseitem',
            index=models.Index(fields=['created_at'], name='accounts_da_created_98f73c_idx'),
        ),
    ]
