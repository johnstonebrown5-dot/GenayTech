from django.db import models
from django.conf import settings

class Notification(models.Model):
    TYPE_CHOICES = (("in_app","In-App"),("sms","SMS"),("email","Email"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    type = models.CharField(max_length=15, choices=TYPE_CHOICES, default='in_app')
    date = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)

class DeliveryLog(models.Model):
    """Lightweight log of outbound communications attempts for admin/finance visibility."""
    class Channel(models.TextChoices):
        SMS = 'sms', 'SMS'
        EMAIL = 'email', 'Email'

    class Status(models.TextChoices):
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'
        QUEUED = 'queued', 'Queued'
        PENDING = 'pending', 'Pending'

    school = models.ForeignKey('accounts.School', null=True, blank=True, on_delete=models.SET_NULL, related_name='delivery_logs')
    channel = models.CharField(max_length=10, choices=Channel.choices)
    recipient = models.CharField(max_length=150)
    ok = models.BooleanField(default=False)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    message_snippet = models.TextField(blank=True, default='')
    error = models.TextField(blank=True, default='')
    context = models.CharField(max_length=50, blank=True, default='', help_text='e.g., message:123, campaign:45, type:verification')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['channel', 'created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['school_id', 'created_at']),
            models.Index(fields=['school_id', 'channel', 'created_at']),
            models.Index(fields=['school_id', 'status']),
            models.Index(fields=['context']),  # Add index for context__contains queries
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
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=150, blank=True)
    start = models.DateTimeField()
    end = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    audience = models.CharField(max_length=15, choices=AUDIENCE_CHOICES, default='all')
    visibility = models.CharField(max_length=15, choices=VISIBILITY_CHOICES, default='internal')
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
    min_balance = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    # Delivery channels
    send_in_app = models.BooleanField(default=True)
    send_sms = models.BooleanField(default=False)
    send_email = models.BooleanField(default=False)
    email_subject = models.CharField(max_length=150, blank=True, default='')
    # Aggregate counters
    sent_count = models.PositiveIntegerField(default=0)
    # Per-channel counters for reporting
    sms_sent = models.PositiveIntegerField(default=0)
    sms_failed = models.PositiveIntegerField(default=0)
    email_sent = models.PositiveIntegerField(default=0)
    email_failed = models.PositiveIntegerField(default=0)
    # Async processing fields
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELED = 'canceled', 'Canceled'

    status = models.CharField(max_length=15, choices=Status.choices, default=Status.QUEUED)
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

# New: store service reviews/ratings
class ServiceReview(models.Model):
    school = models.ForeignKey('accounts.School', null=True, blank=True, on_delete=models.SET_NULL, related_name='service_reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='service_reviews')
    name = models.CharField(max_length=50, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    rating = models.PositiveSmallIntegerField(help_text='1-5')
    comment = models.TextField(blank=True, default='')
    page_url = models.CharField(max_length=300, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['rating', 'created_at']),
        ]
        ordering = ['-created_at', 'id']

    def __str__(self):
        who = self.name or getattr(self.user, 'username', '') or 'Guest'
        return f"{who} rated {self.rating}"


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
    # Delivery channels (in-app is always on; email/SMS are optional)
    send_sms = models.BooleanField(default=True)
    send_email = models.BooleanField(default=True)
    # Targeting
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.USERS)
    recipient_role = models.CharField(max_length=15, choices=Roles.choices, null=True, blank=True)
    # Threading
    reply_to = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='replies')
    # Optional tag for system-generated messages to ease frontend filtering
    system_tag = models.CharField(max_length=20, null=True, blank=True, db_index=True)
    is_broadcast = models.BooleanField(default=False, db_index=True)

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


class DeliveryJob(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    message = models.OneToOneField(Message, on_delete=models.CASCADE, related_name='delivery_job')
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING, db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=10)
    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'next_run_at']),
            models.Index(fields=['message', 'status']),
        ]
        ordering = ['-created_at', 'id']

    def __str__(self):
        return f"DeliveryJob #{self.id} msg={getattr(self.message, 'id', None)} {self.status}"

