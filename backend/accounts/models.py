from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class School(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
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

    def __str__(self):
        return self.name

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
