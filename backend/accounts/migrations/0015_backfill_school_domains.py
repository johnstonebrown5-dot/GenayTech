import os

from django.db import migrations


def forwards(apps, schema_editor):
    School = apps.get_model('accounts', 'School')
    SchoolDomain = apps.get_model('accounts', 'SchoolDomain')

    base = str(os.getenv('TENANT_BASE_DOMAIN', 'edutrack.local') or '').strip().lower().lstrip('.')
    if not base:
        return

    for s in School.objects.all().only('id', 'code'):
        try:
            has_domain = SchoolDomain.objects.filter(school_id=s.id).exists()
        except Exception:
            has_domain = True
        if has_domain:
            continue
        code = str(getattr(s, 'code', '') or '').strip().lower()
        if not code:
            continue
        dom = f"{code}.{base}"
        dom = dom.strip().lower()
        if dom.startswith('www.'):
            dom = dom[4:]
        if not dom:
            continue
        if SchoolDomain.objects.filter(domain__iexact=dom).exists():
            dom = f"{code}-{s.id}.{base}"
        if SchoolDomain.objects.filter(domain__iexact=dom).exists():
            continue
        SchoolDomain.objects.create(school_id=s.id, domain=dom, is_primary=True)


def backwards(apps, schema_editor):
    return


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_schooldomain'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
