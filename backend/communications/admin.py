from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import Notification, Event, ArrearsMessageCampaign, Message, MessageRecipient, ServiceReview

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "type", "date", "read")
    list_filter = ("type", "read", "date")
    search_fields = ("user__username", "message")

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "school", "start", "end", "all_day", "audience", "visibility")
    list_filter = ("school", "audience", "visibility", "all_day", "start")
    search_fields = ("title", "description", "location", "school__name")
    ordering = ("start",)

@admin.register(ArrearsMessageCampaign)
class ArrearsMessageCampaignAdmin(admin.ModelAdmin):
    list_display = ("id", "school", "klass", "min_balance", "sent_count", "created_by", "created_at")
    list_filter = ("school", "klass")
    search_fields = ("message", "school__name")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "school", "sender", "audience", "recipient_role", "system_tag", "is_broadcast", "created_at")
    list_filter = ("school", "audience", "recipient_role", "system_tag", "is_broadcast")
    search_fields = ("body", "sender__username", "school__name", "system_tag")
    date_hierarchy = "created_at"

    # Only superusers can access this admin
    def has_view_permission(self, request, obj=None):
        return bool(request.user and request.user.is_superuser)

    def has_add_permission(self, request):
        return bool(request.user and request.user.is_superuser)

    def has_change_permission(self, request, obj=None):
        return bool(request.user and request.user.is_superuser)

    def has_delete_permission(self, request, obj=None):
        return bool(request.user and request.user.is_superuser)

    # Simplify the form to focus on broadcasting/system notices
    fields = ("body", "audience", "recipient_role", "system_tag", "is_broadcast")

    def save_model(self, request, obj, form, change):
        User = get_user_model()
        # Auto-assign sender and school on create
        if not change:
            obj.sender = request.user
            # Attempt to set school from the current user if available
            if hasattr(request.user, "school"):
                obj.school = request.user.school
        super().save_model(request, obj, form, change)

        # Materialize recipients only when creating, or when switching audience/role
        # Clear existing recipients then re-create for idempotency on change affecting audience
        obj.recipients.all().delete()

        recipients_qs = User.objects.none()
        school_id = getattr(obj.school, "id", None)
        if not school_id:
            return

        if obj.audience == Message.Audience.ALL:
            if request.user.is_superuser:
                recipients_qs = User.objects.all()
            else:
                recipients_qs = User.objects.filter(school_id=school_id)
        elif obj.audience == Message.Audience.ROLE and obj.recipient_role:
            recipients_qs = User.objects.filter(school_id=school_id, role=obj.recipient_role)
        else:
            # USERS audience is not supported via admin form (no picker); do nothing
            recipients_qs = User.objects.none()

        recipients = [MessageRecipient(message=obj, user=u) for u in recipients_qs]
        if recipients:
            MessageRecipient.objects.bulk_create(recipients, ignore_conflicts=True)


@admin.register(MessageRecipient)
class MessageRecipientAdmin(admin.ModelAdmin):
    list_display = ("id", "message", "user", "read", "read_at")
    list_filter = ("read",)
    search_fields = ("message__body", "user__username")


@admin.register(ServiceReview)
class ServiceReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "school", "user", "name", "rating", "created_at")
    list_filter = ("rating", "created_at", "school")
    search_fields = ("name", "email", "comment", "user__username", "school__name")
