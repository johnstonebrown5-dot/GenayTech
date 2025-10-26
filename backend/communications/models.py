from django.db import models
from django.conf import settings

class Notification(models.Model):
    TYPE_CHOICES = (("in_app","In-App"),("sms","SMS"),("email","Email"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='in_app')
    date = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)

class DeliveryLog(models.Model):
    """Lightweight log of outbound communications attempts for admin/finance visibility."""
    class Channel(models.TextChoices):
        SMS = 'sms', 'SMS'
        EMAIL = 'email', 'Email'

    school = models.ForeignKey('accounts.School', null=True, blank=True, on_delete=models.SET_NULL, related_name='delivery_logs')
    channel = models.CharField(max_length=10, choices=Channel.choices)
    recipient = models.CharField(max_length=255)
    ok = models.BooleanField(default=False)
    message_snippet = models.CharField(max_length=300, blank=True, default='')
    context = models.CharField(max_length=100, blank=True, default='', help_text='e.g., message:123, campaign:45')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['channel', 'created_at']),
        ]
        ordering = ['-created_at', 'id']

    def __str__(self):
        return f"{self.channel.upper()} to {self.recipient} ({'OK' if self.ok else 'FAIL'})"

class Event(models.Model):
    AUDIENCE_CHOICES = (
        ("all", "All"),
        ("students", "Students"),
        ("teachers", "Teachers"),
        ("parents", "Parents"),
        ("staff", "Staff"),
    )
    VISIBILITY_CHOICES = (
        ("public", "Public"),
        ("internal", "Internal"),
    )

    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='events')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    start = models.DateTimeField()
    end = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='all')
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='internal')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Completion tracking
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_events')
    completion_comment = models.TextField(blank=True, default='')

    class Meta:
        ordering = ["start", "title"]

    def __str__(self):
        return f"{self.title} ({self.start:%Y-%m-%d})"

class ArrearsMessageCampaign(models.Model):
    """A campaign to message all students with outstanding fee balances.
    Optionally filter by class and minimum balance amount.
    """
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='arrears_campaigns')
    message = models.TextField()
    # Optional filter by class
    klass = models.ForeignKey('academics.Class', null=True, blank=True, on_delete=models.SET_NULL)
    # Only include students whose balance is greater than or equal to this
    min_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Delivery channels
    send_in_app = models.BooleanField(default=True)
    send_sms = models.BooleanField(default=False)
    send_email = models.BooleanField(default=False)
    email_subject = models.CharField(max_length=255, blank=True, default='')
    # Aggregate counters
    sent_count = models.IntegerField(default=0)
    # Per-channel counters for reporting
    sms_sent = models.IntegerField(default=0)
    sms_failed = models.IntegerField(default=0)
    email_sent = models.IntegerField(default=0)
    email_failed = models.IntegerField(default=0)
    # Async processing fields
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELED = 'canceled', 'Canceled'

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Cancellation request flag (checked by worker)
    cancel_requested = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Arrears Campaign #{self.id} ({self.school})"


# Messaging models: simple in-app messaging with role/user targeting within a school
class Message(models.Model):
    """Represents a message authored by a user within a school.
    A message can target:
      - specific users (via MessageRecipient rows)
      - a recipient role (admin/teacher/student/finance) within the same school
      - everyone in the school (audience = all)

    Role targeting is materialized into MessageRecipient rows at creation time for easier querying per user inbox.
    """
    class Audience(models.TextChoices):
        USERS = 'users', 'Specific Users'
        ROLE = 'role', 'Role'
        ALL = 'all', 'Entire School'

    class Roles(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        TEACHER = 'teacher', 'Teacher'
        STUDENT = 'student', 'Student'
        FINANCE = 'finance', 'Finance'

    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    # Targeting
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.USERS)
    recipient_role = models.CharField(max_length=20, choices=Roles.choices, null=True, blank=True)
    # Threading
    reply_to = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='replies')
    # Optional tag for system-generated messages to ease frontend filtering
    system_tag = models.CharField(max_length=30, null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['-created_at', 'id']

    def __str__(self):
        return f"Msg #{self.id} from {getattr(self.sender, 'username', 'user')}"


class MessageRecipient(models.Model):
    """Join table of message to recipient user with read status."""
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='recipients')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_messages')
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('message', 'user')
        indexes = [
            models.Index(fields=['user', 'read']),
        ]

