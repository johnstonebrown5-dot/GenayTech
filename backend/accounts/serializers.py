from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import School

User = get_user_model()

class SchoolSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(required=False, allow_null=True)
    logo_url = serializers.SerializerMethodField()
    class Meta:
        model = School
        fields = [
            "id","name","code","address","motto","aim","logo","logo_url","social_links","homepage",
            "is_trial","trial_expires_at","trial_student_limit","feature_flags",
        ]

    def get_logo_url(self, obj):
        if not obj.logo:
            return ""
        request = self.context.get('request') if isinstance(self.context, dict) else None
        try:
            url = obj.logo.url
        except Exception:
            return ""
        if request:
            return request.build_absolute_uri(url)
        return url

class UserSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    profile_picture = serializers.ImageField(required=False, allow_null=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id","username","email","first_name","last_name",
            "role","phone","school","is_staff","is_superuser","email_verified","is_active",
            "profile_picture","avatar_url",
        ]

    def get_avatar_url(self, obj):
        url = None
        try:
            if getattr(obj, 'profile_picture', None):
                url = obj.profile_picture.url
        except Exception:
            url = None
        request = self.context.get('request') if isinstance(self.context, dict) else None
        if url and request:
            try:
                return request.build_absolute_uri(url)
            except Exception:
                return url
        return url
