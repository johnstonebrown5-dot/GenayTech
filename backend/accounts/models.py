from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class School(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey('accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='deleted_schools')
    address = models.TextField(blank=True)
    motto = models.CharField(max_length=255, blank=True)
    aim = models.TextField(blank=True)
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    social_links = models.JSONField(default=dict, blank=True)  # {"facebook":"","twitter":"","instagram":"","youtube":"","website":""}
    homepage = models.JSONField(default=dict, blank=True)  # Arbitrary config used by public landing page
    # Trial flags
    is_trial = models.BooleanField(default=True)
    trial_expires_at = models.DateTimeField(null=True, blank=True)
    trial_student_limit = models.IntegerField(default=100)
    feature_flags = models.JSONField(default=dict, blank=True)  # e.g., {"pos": false, "sms": false}
    # Highly destructive admin actions (disabled/hidden by default)
    enable_fee_reset = models.BooleanField(default=False, db_index=True)

    def __str__(self):
        return self.name


class SchoolDomain(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='domains')
    domain = models.CharField(max_length=255, unique=True)
    is_primary = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["domain"]),
            models.Index(fields=["school"]),
        ]

    def save(self, *args, **kwargs):
        if self.domain:
            self.domain = str(self.domain).strip().lower()
            if self.domain.startswith('www.'):
                self.domain = self.domain[4:]
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.domain} -> {self.school_id}"


class SchoolIntegrationSettings(models.Model):
    SMS_PROVIDER_CHOICES = (
        ('textwave', 'TextWave'),
        ('africastalking', "Africa's Talking"),
    )

    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='integration_settings')

    smtp_host = models.CharField(max_length=255, blank=True, default='')
    smtp_port = models.IntegerField(default=587)
    smtp_username = models.CharField(max_length=255, blank=True, default='')
    smtp_password = models.CharField(max_length=255, blank=True, default='')
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)
    smtp_from_email = models.CharField(max_length=255, blank=True, default='')

    sms_provider = models.CharField(max_length=50, choices=SMS_PROVIDER_CHOICES, blank=True, default='textwave')
    at_username = models.CharField(max_length=100, blank=True, default='')
    at_api_key = models.CharField(max_length=255, blank=True, default='')
    at_sender_id = models.CharField(max_length=50, blank=True, default='')

    textwave_base_url = models.CharField(max_length=255, blank=True, default='')
    textwave_api_key = models.CharField(max_length=255, blank=True, default='')
    textwave_sender_id = models.CharField(max_length=50, blank=True, default='')

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.school_id} integrations"

class User(AbstractUser):
    class Roles(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        TEACHER = 'teacher', 'Teacher'
        STUDENT = 'student', 'Student'
        FINANCE = 'finance', 'Finance'
        NON_TEACHING = 'non_teaching', 'Non-Teaching Staff'

    role = models.CharField(max_length=20, choices=Roles.choices)
    phone = models.CharField(max_length=20, blank=True)
    school = models.ForeignKey(School, null=True, blank=True, on_delete=models.SET_NULL)
    email_verified = models.BooleanField(default=False)
    # Avatar/profile picture for UI
    profile_picture = models.ImageField(upload_to='avatars/', null=True, blank=True)


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_tokens')
    token = models.CharField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() >= self.expires_at


class DemoRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    school_name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, blank=True, default='')
    admin_email = models.EmailField()
    admin_first_name = models.CharField(max_length=150, blank=True, default='')
    admin_last_name = models.CharField(max_length=150, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    password_hash = models.CharField(max_length=255, blank=True, default='')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey('accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_demo_requests')
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey('accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='rejected_demo_requests')
    rejection_reason = models.TextField(blank=True, default='')

    created_school = models.ForeignKey(School, null=True, blank=True, on_delete=models.SET_NULL, related_name='demo_requests')
    created_user = models.ForeignKey('accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='demo_requests')

    class Meta:
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['admin_email']),
        ]
        ordering = ['-created_at', '-id']


class PasswordResetCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_codes')
    email = models.EmailField()
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["email", "code"]),
            models.Index(fields=["expires_at"]),
        ]

    def is_expired(self):
        return timezone.now() >= self.expires_at

class NonTeachingStaff(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='non_teaching_profile')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='non_teaching_staff')
    department = models.CharField(max_length=100, blank=True)
    position = models.CharField(max_length=100, blank=True)
    national_id = models.CharField(max_length=50, blank=True)
    kra_pin = models.CharField(max_length=50, blank=True)
    nhif_no = models.CharField(max_length=50, blank=True)
    nssf_no = models.CharField(max_length=50, blank=True)
    address = models.CharField(max_length=255, blank=True)
    emergency_contact = models.JSONField(default=dict, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        try:
            full_name = (self.user.get_full_name() or self.user.username)
        except Exception:
            full_name = str(getattr(self.user, 'username', 'Staff'))
        return f"{full_name} ({self.position or 'Staff'})"


class SystemHealthEvent(models.Model):
    class Component(models.TextChoices):
        SMS = 'sms', 'SMS'
        EMAIL = 'email', 'Email'
        LOGIN = 'login', 'Login'
        QUERIES = 'queries', 'Fetching Queries'
        PAYMENT_MPESA = 'payment_mpesa', 'Payments (M-Pesa)'
        PAYMENT_BANK = 'payment_bank', 'Payments (Bank)'

    school = models.ForeignKey(School, null=True, blank=True, on_delete=models.SET_NULL, related_name='system_health_events')
    component = models.CharField(max_length=32, choices=Component.choices, db_index=True)
    ok = models.BooleanField(default=False, db_index=True)
    context = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['component', 'created_at']),
            models.Index(fields=['component', 'ok', 'created_at']),
        ]
        ordering = ['-created_at', 'id']


class MaintenanceNotice(models.Model):
    enabled = models.BooleanField(default=False)
    message = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Maintenance: {'ON' if self.enabled else 'OFF'}"


class SystemConfig(models.Model):
    default_domain = models.CharField(max_length=255, blank=True, default='')
    
    # Onboarding Videos - Main/Overview
    teacher_onboarding_video_url = models.URLField(max_length=500, blank=True, default='')
    teacher_onboarding_video_url_mobile = models.URLField(max_length=500, blank=True, default='')
    
    # Onboarding Videos - Specific Operations
    video_url_messages = models.URLField(max_length=500, blank=True, default='')
    video_url_messages_mobile = models.URLField(max_length=500, blank=True, default='')
    
    video_url_grades = models.URLField(max_length=500, blank=True, default='')
    video_url_grades_mobile = models.URLField(max_length=500, blank=True, default='')
    
    video_url_attendance = models.URLField(max_length=500, blank=True, default='')
    video_url_attendance_mobile = models.URLField(max_length=500, blank=True, default='')
    
    video_url_print_results = models.URLField(max_length=500, blank=True, default='')
    video_url_print_results_mobile = models.URLField(max_length=500, blank=True, default='')
    
    video_url_results = models.URLField(max_length=500, blank=True, default='')
    video_url_results_mobile = models.URLField(max_length=500, blank=True, default='')
    
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.default_domain:
            d = str(self.default_domain).strip().lower()
            if d.startswith('http://'):
                d = d[7:]
            elif d.startswith('https://'):
                d = d[8:]
            d = d.split('/', 1)[0].strip()
            d = d.split(':', 1)[0].strip()
            if d.startswith('www.'):
                d = d[4:]
            self.default_domain = d
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"SystemConfig({self.default_domain or 'unset'})"
