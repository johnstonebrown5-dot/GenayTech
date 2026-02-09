from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import School, NonTeachingStaff

User = get_user_model()

class SchoolSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(required=False, allow_null=True)
    logo_url = serializers.SerializerMethodField()
    class Meta:
        model = School
        fields = [
            "id","name","code","is_active","address","motto","aim","logo","logo_url","social_links","homepage",
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
    student_admission_no = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id","username","email","first_name","last_name",
            "role","phone","school","is_staff","is_superuser","email_verified","is_active",
            "profile_picture","avatar_url","student_admission_no",
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

    def get_student_admission_no(self, obj):
        try:
            if str(getattr(obj, 'role', '') or '').lower() != 'student':
                return None
        except Exception:
            return None
        try:
            stu = getattr(obj, "student", None)
        except Exception:
            stu = None
        try:
            if stu is not None and getattr(stu, "admission_no", None):
                return stu.admission_no
        except Exception:
            pass
        # Fallback: lightweight lookup by user id
        try:
            from academics.models import Student  # local import to avoid circulars
            uid = getattr(obj, "id", None)
            if not uid:
                return None
            stu = Student.objects.filter(user_id=uid).only("admission_no").first()
            return getattr(stu, "admission_no", None) if stu is not None else None
        except Exception:
            return None


class NonTeachingStaffSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(write_only=True, required=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = NonTeachingStaff
        fields = [
            'id','user','user_id','school','department','position','national_id','kra_pin','nhif_no','nssf_no','address','emergency_contact','hire_date','is_active','created_at','updated_at'
        ]
        read_only_fields = ['school','created_at','updated_at','user']

    def create(self, validated_data):
        user_id = validated_data.pop('user_id', None)
        if not user_id:
            raise serializers.ValidationError({'user_id': 'This field is required'})
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({'user_id': 'User not found'})
        if not validated_data.get('school'):
            req = self.context.get('request') if isinstance(self.context, dict) else None
            school = getattr(getattr(getattr(req, 'user', None), 'school', None), 'id', None)
            if school:
                validated_data['school_id'] = school
        obj = NonTeachingStaff.objects.create(user=user, **validated_data)
        return obj

    def update(self, instance, validated_data):
        validated_data.pop('user_id', None)
        return super().update(instance, validated_data)
