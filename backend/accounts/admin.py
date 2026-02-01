from django.contrib import admin
from .models import School, SchoolDomain, SchoolIntegrationSettings, User, NonTeachingStaff


class SchoolDomainInline(admin.TabularInline):
    model = SchoolDomain
    extra = 1


class SchoolIntegrationSettingsInline(admin.StackedInline):
    model = SchoolIntegrationSettings
    extra = 0

@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name")
    search_fields = ("code", "name")
    inlines = (SchoolDomainInline, SchoolIntegrationSettingsInline)

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "first_name", "last_name", "role", "school", "is_active")
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    search_fields = ("username", "first_name", "last_name", "email")


@admin.register(NonTeachingStaff)
class NonTeachingStaffAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "school", "department", "position", "is_active")
    list_filter = ("school", "department", "is_active")
    search_fields = ("user__username", "user__first_name", "user__last_name", "national_id", "kra_pin")
