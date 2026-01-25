from django.db.models.signals import post_save
from django.dispatch import receiver
from django.apps import apps
from django.conf import settings
import threading

@receiver(post_save, sender='accounts.School')
def create_default_subjects_for_school(sender, instance, created, **kwargs):
    """Create default subjects when a School is created.
    Defaults as priority subjects: Mathematics, English, Kiswahili, P.P.I
    Codes are namespaced by school code to satisfy Subject.code uniqueness.
    """
    if not created:
        return

    Subject = apps.get_model('academics', 'Subject')
    # name, abbr, category, is_priority
    defaults = [
        ("Mathematics", "MAT", "science", True),
        ("English", "ENG", "language", True),
        ("Kiswahili", "KIS", "language", True),
        ("P.P.I", "PPI", "other", True),
    ]
    for name, abbr, category, is_priority in defaults:
        code = f"{instance.code}-{abbr}"
        Subject.objects.get_or_create(
            code=code,
            defaults={
                'category': category,
                'is_priority': is_priority,
                'school': instance,
                # Mark P.P.I as non-examinable
                'is_examinable': False if name.strip().lower() == 'p.p.i' else True,
            }
        )


@receiver(post_save, sender='academics.Student')
def notify_student_enrollment(sender, instance, created, **kwargs):
    """Send notifications after a student is created (enrolled)."""
    if not created:
        return
    # Short-circuit all outbound messaging during bulk seeding or when disabled
    if getattr(settings, 'DISABLE_ACCOUNT_MESSAGING', False):
        return
    try:
        from communications.utils import notify_enrollment
        threading.Thread(target=notify_enrollment, args=(instance,), daemon=True).start()
    except Exception:
        # Avoid breaking save flow
        pass


@receiver(post_save, sender='academics.Student')
def sync_user_active_status(sender, instance, created, **kwargs):
    """Keep the linked User.is_active in sync with Student.is_active.
    When a student is marked inactive, their user account is disabled (cannot log in).
    When reactivated, re-enable login.
    """
    try:
        user = getattr(instance, 'user', None)
        if user is None:
            return
        desired = bool(getattr(instance, 'is_active', True))
        # Only update if different to avoid extra writes
        if bool(getattr(user, 'is_active', True)) != desired:
            user.is_active = desired
            user.save(update_fields=['is_active'])
    except Exception:
        # Never block student saves
        pass
