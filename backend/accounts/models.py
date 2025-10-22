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
