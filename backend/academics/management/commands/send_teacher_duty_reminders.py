from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from communications.models import Notification
from academics.models import TeacherDuty
from django.conf import settings
from communications.utils import create_personalized_messages_for_users

class Command(BaseCommand):
    help = 'Send daily in-app reminders for pending teacher duties that have not been reminded today.'

    def handle(self, *args, **options):
        today = timezone.localdate()
        now = timezone.now()
        sent = 0
        errors = 0
        # Select eligible duties: pending, remind_daily, not reminded today
        qs = (
            TeacherDuty.objects
            .select_related('teacher', 'created_by', 'school')
            .filter(status='pending', remind_daily=True)
        )
        user_pairs = []
        for duty in qs:
            try:
                last = duty.last_reminded_at
                if last is not None and getattr(last, 'date', None) is not None:
                    if last.date() == today:
                        continue
                # Build in-app message
                due = f" (Due {duty.due_date.isoformat()})" if duty.due_date else ''
                msg = f"Reminder: '{duty.title}' is still pending.{due}"
                # Create in-app notification
                if getattr(duty, 'teacher_id', None):
                    Notification.objects.create(user_id=duty.teacher_id, message=msg, type='in_app')
                    sent += 1
                    # Mirror to messages so frontend MessageNotifier (which polls messages) can raise browser notifications
                    user_pairs.append((duty.teacher_id, msg))
                # Update last_reminded_at atomically
                duty.last_reminded_at = now
                duty.save(update_fields=['last_reminded_at'])
            except Exception:
                errors += 1
                continue
        # Create personalized chat messages in one batch per school context, using a generic sender
        try:
            # Resolve a sender: prefer the admin who created any duty, else fallback to any available default via utility
            # We'll just pick the created_by of the most recent duty as sender if present
            sender_id = None
            for d in qs.order_by('-created_at'):
                if getattr(d, 'created_by_id', None):
                    sender_id = d.created_by_id
                    break
            # Fallback: attempt to resolve default sender via utility
            if user_pairs and sender_id is None:
                # communications.utils handles fallback if sender_id invalid, but it expects a valid id; keep None -> skip
                pass
            if user_pairs and sender_id:
                # Use school from any duty
                school_id = None
                for d in qs:
                    if getattr(d, 'school_id', None):
                        school_id = d.school_id
                        break
                if school_id:
                    create_personalized_messages_for_users(
                        school_id=school_id,
                        sender_id=sender_id,
                        user_body_pairs=user_pairs,
                        system_tag='duty-reminder',
                        queue_delivery=False,
                    )
        except Exception:
            # Don't fail the job due to chat mirror
            pass
        self.stdout.write(self.style.SUCCESS(f"Duty reminders sent: {sent}; errors: {errors}"))
