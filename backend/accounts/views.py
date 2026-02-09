from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
import json
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from edutrack.pagination import CustomPageNumberPagination
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, SchoolSerializer, NonTeachingStaffSerializer
from .permissions import IsAdminOrStaff
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils.text import slugify
from django.utils.crypto import get_random_string
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from .models import School, SchoolDomain, SchoolIntegrationSettings, EmailVerificationToken, DemoRequest, NonTeachingStaff, PasswordResetCode, SystemHealthEvent, MaintenanceNotice, SystemConfig
from django.contrib.auth.hashers import make_password
from rest_framework.exceptions import AuthenticationFailed
from django.apps import apps as django_apps
from django.db.models import ForeignKey, OneToOneField
from django.core.cache import cache
from django.template.loader import render_to_string
from django.conf import settings
from datetime import timedelta, datetime
import secrets
from django.utils import timezone
from academics.models import Class as Klass
from academics.models import Student
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import requests
from communications.utils import send_email_safe_html, send_email_safe
from django.utils.dateparse import parse_datetime, parse_date
from time import perf_counter
from django.db import connection
import os

User = get_user_model()


def _resolve_user_school_id(user) -> int | None:
    user_school_id = getattr(getattr(user, 'school', None), 'id', None)
    if user_school_id:
        return user_school_id

    uid = getattr(user, 'id', None)
    if not uid:
        return None

    try:
        from academics.models import Student, Class, TeacherProfile, ClassSubjectTeacher  # type: ignore
    except Exception:
        Student = Class = TeacherProfile = ClassSubjectTeacher = None  # type: ignore

    if Student is not None:
        try:
            row = (
                Student.objects
                .filter(user_id=uid)
                .values('klass__school_id', 'school_id')
                .first()
            )
            if row:
                user_school_id = row.get('klass__school_id') or row.get('school_id') or None
        except Exception:
            pass

    if user_school_id is None and Class is not None:
        try:
            sid = (
                Class.objects
                .filter(teacher_id=uid)
                .values_list('school_id', flat=True)
                .first()
            )
            if sid:
                user_school_id = sid
        except Exception:
            pass

    if user_school_id is None and TeacherProfile is not None:
        try:
            sid = (
                TeacherProfile.objects
                .filter(user_id=uid)
                .values_list('klass__school_id', flat=True)
                .first()
            )
            if sid:
                user_school_id = sid
        except Exception:
            pass

    if user_school_id is None and ClassSubjectTeacher is not None:
        try:
            sid = (
                ClassSubjectTeacher.objects
                .filter(teacher_id=uid)
                .values_list('klass__school_id', flat=True)
                .first()
            )
            if sid:
                user_school_id = sid
        except Exception:
            pass

    if user_school_id is None:
        try:
            from .models import NonTeachingStaff  # local import
            sid = (
                NonTeachingStaff.objects
                .filter(user_id=uid)
                .values_list('school_id', flat=True)
                .first()
            )
            if sid:
                user_school_id = sid
        except Exception:
            pass

    return user_school_id


def _log_system_health_event(*, school_id: int | None, component: str, ok: bool, context: str = '') -> None:
    try:
        SystemHealthEvent.objects.create(
            school_id=school_id,
            component=component,
            ok=bool(ok),
            context=(context or '')[:255],
        )
    except Exception:
        pass


class TokenObtainPairViewWithLogging(TokenObtainPairView):
    class Serializer(TokenObtainPairSerializer):
        def validate(self, attrs):
            data = super().validate(attrs)
            u = getattr(self, 'user', None)
            if u is not None:
                if not (getattr(u, 'is_superuser', False) or getattr(u, 'is_staff', False)):
                    try:
                        sch = getattr(u, 'school', None)
                        is_trial_school = bool(getattr(sch, 'is_trial', False)) if sch is not None else False
                    except Exception:
                        is_trial_school = False
                    if is_trial_school and str(getattr(u, 'role', '') or '').lower() == 'admin':
                        if not bool(getattr(u, 'email_verified', False)):
                            raise AuthenticationFailed('Email not verified')
            return data

    serializer_class = Serializer

    def post(self, request, *args, **kwargs):
        username = None
        try:
            username = (request.data or {}).get('username') or (request.data or {}).get('email')
        except Exception:
            username = None

        school_id = None
        if username:
            try:
                u = User.objects.filter(username__iexact=str(username)).only('id', 'school_id').first()
                school_id = getattr(u, 'school_id', None)
            except Exception:
                school_id = None

        try:
            resp = super().post(request, *args, **kwargs)
        except Exception as e:
            _log_system_health_event(school_id=school_id, component=SystemHealthEvent.Component.LOGIN, ok=False, context=f"exception:{type(e).__name__}")
            raise

        ok = int(getattr(resp, 'status_code', 500) or 500) < 400
        _log_system_health_event(
            school_id=school_id,
            component=SystemHealthEvent.Component.LOGIN,
            ok=bool(ok),
            context=f"status:{getattr(resp, 'status_code', '')}",
        )
        return resp

@api_view(["GET","PATCH"]) 
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me(request):
    """Get or update the authenticated user's profile.
    PATCH accepts: first_name, last_name, email, phone and an optional avatar file under
    any of the keys: 'profile_picture', 'avatar', or 'photo'.
    """
    user = request.user
    try:
        if not getattr(user, 'is_superuser', False):
            sch = getattr(user, 'school', None)
            if sch is not None and getattr(sch, 'is_active', True) is False:
                return Response({"detail": "School is inactive"}, status=403)
    except Exception:
        pass
    if request.method == 'GET':
        return Response(UserSerializer(user, context={"request": request}).data)

    # PATCH update
    data = request.data
    changed_fields = []
    for field in ("first_name","last_name","email","phone"):
        if field in data and data.get(field) is not None:
            setattr(user, field, data.get(field))
            changed_fields.append(field)
    # Accept avatar file under multiple common keys
    file_key = None
    for k in ("profile_picture","avatar","photo"):
        if k in request.FILES:
            file_key = k
            break
    if file_key:
        user.profile_picture = request.FILES[file_key]
        changed_fields.append('profile_picture')
    # Support URL-only avatar updates (e.g., uploaded to Cloudinary on the client)
    # If no file uploaded but an avatar_url is provided, fetch and store it
    if not file_key:
        try:
            avatar_url = data.get('avatar_url') or data.get('avatar') or data.get('photo_url')
        except Exception:
            avatar_url = None
        if avatar_url:
            try:
                resp = requests.get(str(avatar_url), timeout=15)
                resp.raise_for_status()
                # Infer a safe extension
                ext = ''
                try:
                    ct = resp.headers.get('content-type', '')
                    if 'png' in ct:
                        ext = '.png'
                    elif 'jpeg' in ct or 'jpg' in ct:
                        ext = '.jpg'
                    elif 'webp' in ct:
                        ext = '.webp'
                except Exception:
                    ext = ''
                name_part = f"user_{getattr(user, 'id', 'me')}"
                fname = f"avatar_{name_part}{ext or '.jpg'}"
                user.profile_picture = ContentFile(resp.content, name=fname)
                changed_fields.append('profile_picture')
            except Exception:
                # Ignore failures; client can retry or upload a file directly
                pass
    if changed_fields:
        user.save(update_fields=list(set(changed_fields)))
    return Response(UserSerializer(user, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users(request):
    """List users scoped to the current user's school by default (including staff/superusers).
    Supports filtering by `?role=teacher|admin|student|finance`.
    Staff/Superusers may explicitly override with `?school=<id>` to view another school.
    """
    role = request.query_params.get('role')
    q = request.query_params.get('q')
    param_school_id = request.query_params.get('school')
    include_orphans = str(request.query_params.get('include_orphans', '')).lower() in ('1','true','yes')
    qs = User.objects.all().select_related('school', 'student')
    # Scope by school: default to the request user's school for all roles
    user_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
    # Resolve school from related models if missing (student/teacher/staff)
    if not user_school_id:
        try:
            from academics.models import Student, Class, TeacherProfile, ClassSubjectTeacher  # type: ignore
        except Exception:
            Student = Class = TeacherProfile = ClassSubjectTeacher = None  # type: ignore
        # Student → class.school or student.school
        if user_school_id is None and Student is not None:
            try:
                row = (
                    Student.objects
                    .filter(user_id=getattr(request.user, 'id', None))
                    .values('klass__school_id', 'school_id')
                    .first()
                )
                if row:
                    user_school_id = row.get('klass__school_id') or row.get('school_id') or None
            except Exception:
                pass
        # Class teacher → Class.school
        if user_school_id is None and Class is not None:
            try:
                sid = (
                    Class.objects
                    .filter(teacher_id=getattr(request.user, 'id', None))
                    .values_list('school_id', flat=True)
                    .first()
                )
                if sid:
                    user_school_id = sid
            except Exception:
                pass
        # TeacherProfile → klass.school
        if user_school_id is None and TeacherProfile is not None:
            try:
                sid = (
                    TeacherProfile.objects
                    .filter(user_id=getattr(request.user, 'id', None))
                    .values_list('klass__school_id', flat=True)
                    .first()
                )
                if sid:
                    user_school_id = sid
            except Exception:
                pass
        # Subject teacher mapping → klass.school
        if user_school_id is None and ClassSubjectTeacher is not None:
            try:
                sid = (
                    ClassSubjectTeacher.objects
                    .filter(teacher_id=getattr(request.user, 'id', None))
                    .values_list('klass__school_id', flat=True)
                    .first()
                )
                if sid:
                    user_school_id = sid
            except Exception:
                pass
        # Non-teaching staff → profile.school
        if user_school_id is None:
            try:
                from .models import NonTeachingStaff  # local import
                sid = (
                    NonTeachingStaff.objects
                    .filter(user_id=getattr(request.user, 'id', None))
                    .values_list('school_id', flat=True)
                    .first()
                )
                if sid:
                    user_school_id = sid
            except Exception:
                pass
    if param_school_id:
        # Explicit override only for staff/superusers
        if request.user.is_superuser or request.user.is_staff:
            qs = qs.filter(school_id=param_school_id)
        else:
            # Non-staff cannot override; keep to their school
            if user_school_id:
                qs = qs.filter(school_id=user_school_id)
            else:
                qs = qs.none()
    else:
        # No override provided: if the requester has a school, scope to it and any related links
        if user_school_id:
            school_q = (
                Q(school_id=user_school_id) |
                Q(student__klass__school_id=user_school_id) |
                Q(student__school_id=user_school_id) |
                Q(class_teacher__school_id=user_school_id) |
                Q(teacherprofile__klass__school_id=user_school_id) |
                Q(non_teaching_profile__school_id=user_school_id)
            )
            orphan_q = Q()
            if include_orphans:
                orphan_q = Q(school__isnull=True) & Q(role__in=['admin','teacher','finance','non_teaching','student'])
            try:
                from academics.models import ClassSubjectTeacher  # local import to avoid hard dep at import time
                subject_teacher_ids = ClassSubjectTeacher.objects.filter(
                    klass__school_id=user_school_id
                ).values_list('teacher_id', flat=True)
                qs = qs.filter(school_q | orphan_q | Q(id__in=subject_teacher_ids)).distinct()
            except Exception:
                qs = qs.filter(school_q | orphan_q).distinct()
        elif not (request.user.is_superuser or request.user.is_staff):
            # Regular users without a school should see nothing
            qs = qs.none()
    if role:
        qs = qs.filter(role=role)
    if q:
        q = q.strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q) |
                Q(student__admission_no__icontains=q)
            )
    # Order by stable key
    qs = qs.order_by('id')

    # Narrow fields to those used by UserSerializer and nested SchoolSerializer
    try:
        qs = qs.only(
            'id','username','first_name','last_name','email','role','phone','is_staff','is_superuser','email_verified','is_active','profile_picture',
            'school','school__id','school__name','school__code','school__address','school__motto','school__aim','school__logo','school__social_links',
            'school__is_trial','school__trial_expires_at','school__trial_student_limit','school__feature_flags',
            # Student fields used by serializer helpers
            'student__admission_no','student__name','student__photo',
        )
    except Exception:
        # Fallback if .only causes issues
        pass

    # Paginate (supports ?page_size up to 2000 via CustomPageNumberPagination)
    paginator = CustomPageNumberPagination()
    page = paginator.paginate_queryset(qs, request)
    if page is not None:
        ser = UserSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(ser.data)
    return Response(UserSerializer(qs, many=True, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def create_user(request):
    """Admin creates a user. Body: username, password, role, first_name, last_name, email, phone, school(optional id)
    Returns created user profile.
    """
    t0 = perf_counter()
    data = request.data or {}

    username = (data.get('username') or '').strip()
    role = (data.get('role') or '').strip()
    password = data.get('password') or get_random_string(12)

    if not username or not role:
        return Response({"detail": "username and role are required"}, status=400)

    username = username.lower()

    try:
        allowed_roles = {c[0] for c in getattr(User, 'Roles').choices}
    except Exception:
        allowed_roles = {'admin', 'teacher', 'student', 'finance', 'non_teaching'}
    if role not in allowed_roles:
        return Response({"detail": "Invalid role", "role": role}, status=400)

    school_id = data.get('school')
    if school_id in ('', None):
        school_id = _resolve_user_school_id(request.user)
    try:
        if school_id not in (None, ''):
            school_id = int(school_id)
    except Exception:
        return Response({"detail": "Invalid school id"}, status=400)

    if not (request.user.is_superuser or request.user.is_staff) and not school_id:
        return Response({"detail": "Cannot determine your school. Add a school to your account or pass school id."}, status=400)

    email = (data.get('email') or '').strip()
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    phone = (data.get('phone') or '').strip()

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                password=password,
                role=role,
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                school_id=school_id,
            )
    except IntegrityError as e:
        return Response({"detail": "Username already exists or violates a constraint", "error": str(e)}, status=400)
    except Exception as e:
        return Response({"detail": "Failed to create user", "error": f"{type(e).__name__}: {e}"}, status=400)

    payload = UserSerializer(user, context={"request": request}).data
    payload["_create_user_ms"] = int((perf_counter() - t0) * 1000)
    return Response(payload, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def update_user_status(request):
    """Activate/deactivate user: body {user_id, is_active} """
    user_id = request.data.get('user_id')
    is_active = request.data.get('is_active')
    if user_id is None or is_active is None:
        return Response({"detail": "user_id and is_active required"}, status=400)
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)
    # Scope: only modify users within your school unless staff/superuser
    if not (request.user.is_superuser or request.user.is_staff):
        req_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
        if not req_school_id or u.school_id != req_school_id:
            return Response({"detail": "Not allowed: user is not in your school"}, status=403)
        # Also prevent modifying staff/superusers
        if u.is_superuser or u.is_staff:
            return Response({"detail": "Not allowed to modify staff/superuser accounts"}, status=403)
    u.is_active = bool(is_active)
    u.save(update_fields=['is_active'])
    return Response(UserSerializer(u, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def reset_password(request):
    """Reset a user's password: body {user_id, new_password} """
    user_id = request.data.get('user_id')
    new_password = request.data.get('new_password')
    if not user_id or not new_password:
      return Response({"detail": "user_id and new_password required"}, status=400)
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)
    # Scope: only modify users within your school unless staff/superuser
    if not (request.user.is_superuser or request.user.is_staff):
        req_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
        if not req_school_id or u.school_id != req_school_id:
            return Response({"detail": "Not allowed: user is not in your school"}, status=403)
        # Prevent resetting staff/superuser accounts
        if u.is_superuser or u.is_staff:
            return Response({"detail": "Not allowed to reset staff/superuser passwords"}, status=403)
    u.set_password(new_password)
    u.save(update_fields=['password'])
    return Response({"detail": "Password reset"})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
@parser_classes([JSONParser])
def users_delete_otp_request(request):
    data = request.data or {}
    raw_ids = data.get('user_ids')
    if raw_ids is None:
        raw_ids = data.get('user_id')
    if raw_ids is None:
        return Response({"detail": "user_id or user_ids is required"}, status=400)

    if isinstance(raw_ids, (list, tuple)):
        ids = list(raw_ids)
    else:
        ids = [raw_ids]

    try:
        ids = [int(x) for x in ids if x is not None and str(x).strip() != '']
    except Exception:
        return Response({"detail": "Invalid user_ids"}, status=400)
    ids = sorted(set(ids))
    if not ids:
        return Response({"detail": "user_ids cannot be empty"}, status=400)

    admin_email = (getattr(request.user, 'email', '') or '').strip().lower()
    if not admin_email:
        return Response({"detail": "Your account has no email address. Add an email to receive OTP."}, status=400)

    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
    rate_key = f"del_user_req:{request.user.id}:{ip}"
    attempts = cache.get(rate_key, 0)
    if attempts and int(attempts) >= 10:
        return Response({"detail": "Too many requests. Try again later."}, status=429)
    cache.set(rate_key, int(attempts) + 1, 60 * 60)

    code_int = secrets.randbelow(900000) + 100000
    code = f"{code_int:06d}"
    expires_in = 15 * 60
    cache_key = f"del_user_otp:{request.user.id}"
    cache.set(
        cache_key,
        {
            'code': code,
            'expires_at': int(timezone.now().timestamp()) + expires_in,
            'attempts': 0,
            'user_ids': ids,
        },
        expires_in,
    )

    subject = "EduTrack delete user verification code"
    text_message = (
        "Use this 6-digit verification code to confirm deleting user account(s):\n\n"
        f"{code}\n\n"
        "This code expires in 15 minutes. If you did not request this, you can safely ignore this email."
    )
    try:
        html_message = render_to_string(
            'verification_code_email.html',
            {
                'brand': 'EduTrack',
                'title': 'Confirm delete user',
                'intro': f"Enter the verification code below to confirm deleting {len(ids)} user account(s).",
                'code': code,
                'footer': 'This code expires in 15 minutes. If you did not request this, you can safely ignore this email.',
            },
        )
    except Exception:
        html_message = ''
    try:
        send_email_safe_html(subject, text_message, html_message, admin_email, school_id=getattr(request.user, 'school_id', None))
    except Exception:
        pass

    return Response({"detail": "OTP sent"})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
@parser_classes([JSONParser])
def users_delete_otp_confirm(request):
    data = request.data or {}
    code = (data.get('code') or '').strip()
    raw_ids = data.get('user_ids')
    if raw_ids is None:
        raw_ids = data.get('user_id')
    if not code or raw_ids is None:
        return Response({"detail": "code and user_id/user_ids are required"}, status=400)

    if isinstance(raw_ids, (list, tuple)):
        ids = list(raw_ids)
    else:
        ids = [raw_ids]
    try:
        ids = [int(x) for x in ids if x is not None and str(x).strip() != '']
    except Exception:
        return Response({"detail": "Invalid user_ids"}, status=400)
    ids = sorted(set(ids))
    if not ids:
        return Response({"detail": "user_ids cannot be empty"}, status=400)

    cache_key = f"del_user_otp:{request.user.id}"
    rec = cache.get(cache_key)
    if not rec:
        return Response({"detail": "OTP expired. Request a new one."}, status=400)

    now_ts = int(timezone.now().timestamp())
    exp = int(rec.get('expires_at') or 0)
    if exp and now_ts >= exp:
        cache.delete(cache_key)
        return Response({"detail": "OTP expired. Request a new one."}, status=400)
    if int(rec.get('attempts') or 0) >= 5:
        cache.delete(cache_key)
        return Response({"detail": "Too many attempts. Request a new OTP."}, status=400)

    expected_ids = sorted([int(x) for x in (rec.get('user_ids') or [])])
    if expected_ids != ids:
        return Response({"detail": "OTP does not match this delete request. Request a new OTP."}, status=400)

    if str(rec.get('code') or '') != code:
        rec['attempts'] = int(rec.get('attempts') or 0) + 1
        ttl = max(1, exp - now_ts) if exp else 60
        cache.set(cache_key, rec, ttl)
        return Response({"detail": "Invalid OTP"}, status=400)

    if request.user.id in ids:
        return Response({"detail": "You cannot delete your own account"}, status=403)

    qs = User.objects.filter(id__in=ids)
    found_ids = set(qs.values_list('id', flat=True))
    missing = [i for i in ids if i not in found_ids]
    if missing:
        return Response({"detail": f"User(s) not found: {', '.join([str(x) for x in missing])}"}, status=404)

    if not request.user.is_superuser:
        if qs.filter(Q(is_superuser=True) | Q(is_staff=True)).exists():
            return Response({"detail": "Not allowed to delete staff/superuser accounts"}, status=403)

    if not (request.user.is_superuser or request.user.is_staff):
        req_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
        if not req_school_id:
            return Response({"detail": "Not allowed"}, status=403)
        if qs.exclude(school_id=req_school_id).exists():
            return Response({"detail": "Not allowed: one or more users are not in your school"}, status=403)

    with transaction.atomic():
        deleted_count = 0
        for u in qs.select_for_update():
            u.delete()
            deleted_count += 1

    cache.delete(cache_key)
    return Response({"detail": "User(s) deleted", "deleted": deleted_count})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Authenticated user changes their own password.
    Body: {old_password, new_password}
    """
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    if not old_password or not new_password:
        return Response({"detail": "old_password and new_password required"}, status=400)
    user = request.user
    if not user.check_password(old_password):
        return Response({"detail": "Old password is incorrect"}, status=400)
    if len(new_password) < 6:
        return Response({"detail": "New password must be at least 6 characters"}, status=400)
    user.set_password(new_password)
    user.save(update_fields=['password'])
    return Response({"detail": "Password changed"})


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def password_reset_request(request):
    """Public endpoint: request a 6-digit password reset code to be sent to the user's email.
    Body: { email }
    Always returns 200 to avoid leaking which emails exist.
    """
    data = request.data or {}
    raw_email = (data.get('email') or '').strip().lower()
    if not raw_email:
        return Response({"detail": "email is required"}, status=400)

    # Simple rate limiting per email/IP
    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
    cache_key = f"pwd_reset_req:{raw_email}:{ip}"
    attempts = cache.get(cache_key, 0)
    if attempts and int(attempts) >= 5:
        # Pretend success but do nothing
        return Response({"detail": "If this email exists, a code has been sent."})
    cache.set(cache_key, int(attempts) + 1, 60 * 60)

    try:
        user = User.objects.get(email__iexact=raw_email)
    except User.DoesNotExist:
        # Do not reveal whether email exists
        return Response({"detail": "If this email exists, a code has been sent."})

    # Invalidate previous codes for this user/email
    PasswordResetCode.objects.filter(user=user, email__iexact=raw_email, is_used=False).delete()

    # Generate 6-digit numeric code
    code_int = secrets.randbelow(900000) + 100000
    code = f"{code_int:06d}"

    expires_at = timezone.now() + timedelta(minutes=15)
    PasswordResetCode.objects.create(user=user, email=raw_email, code=code, expires_at=expires_at)

    # Send email best-effort
    subject = "EduTrack password reset code"
    message = (
        f"Use this 6-digit verification code to reset your EduTrack password:\n\n"
        f"{code}\n\n"
        "This code expires in 15 minutes. If you did not request this, you can safely ignore this email."
    )
    html_message = render_to_string(
        'verification_code_email.html',
        {
            'brand': 'EduTrack',
            'title': 'Verify your email address',
            'intro': 'To reset your password, please enter the verification code below in the app.',
            'code': code,
            'footer': 'This code expires in 15 minutes. If you did not request this, you can safely ignore this email.',
        },
    )
    try:
        send_email_safe_html(subject, message, html_message, raw_email, school_id=getattr(user, 'school_id', None))
    except Exception:
        # Do not expose internal errors to client
        pass

    return Response({"detail": "If this email exists, a code has been sent."})


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def password_reset_verify(request):
    """Public endpoint: verify a 6-digit code without changing the password.
    Body: { email, code }
    Used by the frontend to decide whether to show the new password modal.
    """
    data = request.data or {}
    raw_email = (data.get('email') or '').strip().lower()
    code = (data.get('code') or '').strip()

    if not raw_email or not code:
        return Response({"detail": "email and code are required"}, status=400)

    try:
        user = User.objects.get(email__iexact=raw_email)
    except User.DoesNotExist:
        # Do not reveal whether email exists
        return Response({"detail": "Invalid code or email"}, status=400)

    rec = (
        PasswordResetCode.objects
        .filter(user=user, email__iexact=raw_email, is_used=False)
        .order_by('-created_at')
        .first()
    )
    if not rec:
        return Response({"detail": "Invalid code or email"}, status=400)

    # Check expiry & attempts
    if rec.is_expired() or rec.attempts >= 5:
        rec.is_used = True
        rec.save(update_fields=['is_used', 'attempts'])
        return Response({"detail": "Code expired. Please request a new one."}, status=400)

    if rec.code != code:
        rec.attempts += 1
        rec.save(update_fields=['attempts'])
        return Response({"detail": "Invalid code or email"}, status=400)

    # Valid code, but do not mark as used so it can be used shortly for confirm
    return Response({"detail": "Code verified"})


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def password_reset_confirm(request):
    """Public endpoint: verify a 6-digit code and set a new password.
    Body: { email, code, new_password }
    """
    data = request.data or {}
    raw_email = (data.get('email') or '').strip().lower()
    code = (data.get('code') or '').strip()
    new_password = data.get('new_password') or ''

    if not raw_email or not code or not new_password:
        return Response({"detail": "email, code and new_password are required"}, status=400)
    if len(new_password) < 6:
        return Response({"detail": "New password must be at least 6 characters"}, status=400)

    try:
        user = User.objects.get(email__iexact=raw_email)
    except User.DoesNotExist:
        # Do not reveal whether email exists
        return Response({"detail": "Invalid code or email"}, status=400)

    rec = (
        PasswordResetCode.objects
        .filter(user=user, email__iexact=raw_email, code=code, is_used=False)
        .order_by('-created_at')
        .first()
    )
    if not rec:
        return Response({"detail": "Invalid code or email"}, status=400)

    # Check expiry & attempts
    if rec.is_expired() or rec.attempts >= 5:
        rec.is_used = True
        rec.save(update_fields=['is_used', 'attempts'])
        return Response({"detail": "Code expired. Please request a new one."}, status=400)

    if rec.code != code:
        rec.attempts += 1
        rec.save(update_fields=['attempts'])
        return Response({"detail": "Invalid code or email"}, status=400)

    # All good: update password
    user.set_password(new_password)
    user.save(update_fields=['password'])
    rec.is_used = True
    rec.attempts += 1
    rec.save(update_fields=['is_used', 'attempts'])
    # Clean up older codes for this user/email
    PasswordResetCode.objects.filter(user=user, email__iexact=raw_email).exclude(id=rec.id).delete()

    return Response({"detail": "Password has been reset. You can now log in with your new password."})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def update_user(request):
    """Update a user's profile (no password updates here).
    Body can include: user_id (required), first_name, last_name, email, phone, username, role.
    Role changes are allowed but only for non-staff/superuser targets and subject to school scoping.
    """
    user_id = request.data.get('user_id')
    if not user_id:
        return Response({"detail": "user_id is required"}, status=400)
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)

    # School scoping and protections
    if not (request.user.is_superuser or request.user.is_staff):
        req_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
        if not req_school_id or u.school_id != req_school_id:
            return Response({"detail": "Not allowed: user is not in your school"}, status=403)
        if u.is_superuser or u.is_staff:
            return Response({"detail": "Not allowed to modify staff/superuser accounts"}, status=403)

    # Apply allowed fields only (explicit allowlist)
    allowed_fields = ['first_name','last_name','email','phone','username']
    requested_role = request.data.get('role', None)
    for field in allowed_fields:
        if field in request.data and request.data.get(field) is not None:
            setattr(u, field, request.data.get(field))
    # Handle role update with strict checks
    if requested_role is not None:
        # Only allow valid roles defined on the model
        valid_roles = {c[0] for c in User._meta.get_field('role').choices}
        if requested_role not in valid_roles:
            return Response({"detail": "Invalid role"}, status=400)
        # Prevent modifying staff/superuser roles via this endpoint
        if u.is_superuser or u.is_staff:
            return Response({"detail": "Not allowed to modify staff/superuser accounts"}, status=403)
        # Non-staff requesters are limited to their school (already enforced above) and cannot set privileged Django flags here
        u.role = requested_role
        allowed_fields.append('role')

    # Explicitly ignore any 'password' in payload
    u.save(update_fields=[f for f in allowed_fields if f in request.data or f == 'role' and requested_role is not None])
    return Response(UserSerializer(u, context={"request": request}).data)


@api_view(["GET","PUT","PATCH"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def school_me(request):
    """Get or update the current admin's School. PUT/PATCH accepts name, code, address."""
    school = getattr(request.user, 'school', None)
    if request.method == 'GET':
        if not school:
            return Response({"detail": "No school linked to this admin"}, status=404)
        return Response(SchoolSerializer(school, context={"request": request}).data)

    # Update (PUT/PATCH)
    if not school:
        return Response({"detail": "No school linked. Create a School and link the user via Django Admin first."}, status=400)

    # Build a plain payload dict (avoid QueryDict string coercion) and coerce social_links
    data = request.data
    social_raw = data.get('social_links')
    parsed_social = {}
    if isinstance(social_raw, (dict, list)):
        parsed_social = social_raw
    elif social_raw in (None, '', b''):
        parsed_social = {}
    elif isinstance(social_raw, (bytes, bytearray)):
        try:
            parsed_social = json.loads(social_raw.decode('utf-8'))
        except Exception:
            parsed_social = {}
    elif isinstance(social_raw, str):
        try:
            parsed_social = json.loads(social_raw)
        except Exception:
            parsed_social = {}

    # Parse homepage JSON (optional)
    homepage_raw = data.get('homepage')
    parsed_homepage = {}
    if isinstance(homepage_raw, (dict, list)):
        parsed_homepage = homepage_raw
    elif homepage_raw in (None, '', b''):
        parsed_homepage = {}
    elif isinstance(homepage_raw, (bytes, bytearray)):
        try:
            parsed_homepage = json.loads(homepage_raw.decode('utf-8'))
        except Exception:
            parsed_homepage = {}
    elif isinstance(homepage_raw, str):
        try:
            parsed_homepage = json.loads(homepage_raw)
        except Exception:
            parsed_homepage = {}

    # Start from existing homepage and merge to avoid wiping other sections
    existing_homepage = getattr(school, 'homepage', {}) or {}
    if isinstance(parsed_homepage, dict):
        merged_homepage = {**existing_homepage, **parsed_homepage}
    else:
        merged_homepage = existing_homepage

    # Handle optional headteacher fields and photo; place under homepage.headteacher
    try:
        if 'headteacher_photo' in request.FILES:
            infile = request.FILES['headteacher_photo']
            # Save under a predictable folder
            path = default_storage.save(f"headteacher/{getattr(school, 'id', 'school')}_{infile.name}", infile)
            photo_url = request.build_absolute_uri(default_storage.url(path))
            headteacher = dict(merged_homepage.get('headteacher') or {})
            headteacher['photo'] = photo_url
            merged_homepage['headteacher'] = headteacher
        # Simple text fields can arrive either inside homepage JSON or as flat form fields
        ht = dict(merged_homepage.get('headteacher') or {})
        if data.get('headteacher_name') is not None:
            ht['name'] = data.get('headteacher_name')
        if data.get('headteacher_title') is not None:
            ht['title'] = data.get('headteacher_title')
        if data.get('headteacher_message') is not None:
            ht['message'] = data.get('headteacher_message')
        if ht:
            merged_homepage['headteacher'] = ht
    except Exception:
        # Ignore upload failure silently (no crash); client can retry
        pass

    payload = {
        'name': data.get('name', school.name),
        'code': data.get('code', school.code),
        'address': data.get('address', school.address),
        'motto': data.get('motto', getattr(school, 'motto', '')),
        'aim': data.get('aim', getattr(school, 'aim', '')),
        'social_links': parsed_social,
        'homepage': merged_homepage,
    }
    if 'logo' in request.FILES:
        payload['logo'] = request.FILES['logo']
    # Support URL-only uploads: accept logo_url and fetch remote image
    logo_url = data.get('logo_url')
    if not payload.get('logo') and logo_url:
        try:
            resp = requests.get(logo_url, timeout=15)
            resp.raise_for_status()
            # Derive a safe filename
            ext = ''
            try:
                ct = resp.headers.get('content-type','')
                if 'png' in ct: ext = '.png'
                elif 'jpeg' in ct or 'jpg' in ct: ext = '.jpg'
                elif 'webp' in ct: ext = '.webp'
            except Exception:
                pass
            name_part = slugify(getattr(school, 'code', '') or getattr(school, 'id', 'school')) or 'school'
            fname = f"logo_{name_part}{ext or '.jpg'}"
            payload['logo'] = ContentFile(resp.content, name=fname)
        except Exception:
            # If fetch fails, ignore; client can retry
            pass

    serializer = SchoolSerializer(school, data=payload, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(SchoolSerializer(school, context={"request": request}).data)


@api_view(["GET","POST"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def non_teaching_staff(request):
    user_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
    if request.method == 'GET':
        qs = NonTeachingStaff.objects.all().select_related('user','school')
        if user_school_id:
            qs = qs.filter(school_id=user_school_id)
        ser = NonTeachingStaffSerializer(qs, many=True, context={"request": request})
        return Response(ser.data)
    # POST
    data = dict(request.data)
    if not user_school_id:
        return Response({"detail": "User has no linked school"}, status=400)
    data['school'] = user_school_id
    try:
        # Coerce user_id to int
        if 'user_id' in data and data['user_id'] is not None:
            data['user_id'] = int(data['user_id'])
    except Exception:
        pass
    ser = NonTeachingStaffSerializer(data=data, context={"request": request})
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(NonTeachingStaffSerializer(obj, context={"request": request}).data, status=201)


@api_view(["GET","PATCH","DELETE"])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def non_teaching_staff_detail(request, id: int):
    user_school_id = getattr(getattr(request.user, 'school', None), 'id', None)
    try:
        obj = NonTeachingStaff.objects.select_related('user','school').get(id=id)
    except NonTeachingStaff.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if user_school_id and obj.school_id != user_school_id and not (request.user.is_staff or request.user.is_superuser):
        return Response({"detail": "Not allowed"}, status=403)
    if request.method == 'GET':
        return Response(NonTeachingStaffSerializer(obj, context={"request": request}).data)
    if request.method == 'DELETE':
        obj.delete()
        return Response(status=204)
    # PATCH
    data = request.data
    ser = NonTeachingStaffSerializer(obj, data=data, partial=True, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(NonTeachingStaffSerializer(obj, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def school_teachers_public(request):
    """Public list of teachers for a school. Optional ?code=<school_code>.
    Returns a minimal list of teacher profiles (id, name, email, avatar_url, role).
    """
    code = (request.query_params.get('code') or '').strip()
    qs = User.objects.filter(role='teacher')
    if code:
        qs = qs.filter(school__code=code)
    else:
        school = getattr(request, 'school', None)
        if not school:
            school = School.objects.filter(id=1).first() or School.objects.order_by('id').first()
        if school:
            qs = qs.filter(school_id=school.id)
        else:
            qs = qs.none()
    qs = qs.select_related('school').order_by('first_name','last_name','id')
    data = []
    for u in qs:
        try:
            avatar_url = ''
            if getattr(u, 'profile_picture', None):
                avatar_url = request.build_absolute_uri(u.profile_picture.url)
        except Exception:
            avatar_url = ''
        # Determine if this teacher is assigned as a class teacher to any class in the same school
        is_class_teacher = False
        try:
            is_class_teacher = Klass.objects.filter(teacher_id=u.id, school_id=getattr(u, 'school_id', None)).exists()
        except Exception:
            is_class_teacher = False
        data.append({
            'id': u.id,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'email': u.email,
            'role': u.role,
            'avatar_url': avatar_url,
            'is_class_teacher': is_class_teacher,
        })
    return Response({'results': data})


@api_view(["GET"])
@permission_classes([AllowAny])
def teacher_public_detail(request, id: int):
    """Public teacher detail by ID with minimal profile and classes taught.
    """
    try:
        u = User.objects.select_related('school').get(id=id, role='teacher')
    except User.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    try:
        avatar_url = ''
        if getattr(u, 'profile_picture', None):
            avatar_url = request.build_absolute_uri(u.profile_picture.url)
    except Exception:
        avatar_url = ''
    is_class_teacher = False
    try:
        is_class_teacher = Klass.objects.filter(teacher_id=u.id, school_id=getattr(u, 'school_id', None)).exists()
    except Exception:
        is_class_teacher = False
    # List classes where teacher is class teacher
    classes = list(Klass.objects.filter(teacher_id=u.id).order_by('grade_level', 'id').values('id','grade_level','stream__name'))
    data = {
        'id': u.id,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'email': u.email,
        'avatar_url': avatar_url,
        'is_class_teacher': is_class_teacher,
        'classes': [
            {
                'id': c['id'],
                'label': f"{c['grade_level']} {c.get('stream__name') or ''}".strip(),
            } for c in classes
        ],
    }
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def site_context(request):
    """Return whether the current request host resolves to a school.

    Optional query params:
      - code: school.code to explicitly select a school

    Unlike school_public, this does NOT fall back to the first school.
    """
    code = (request.query_params.get('code') or '').strip()
    school = None
    if code:
        school = School.objects.filter(code=code).first()
    if not school:
        school = getattr(request, 'school', None)
    try:
        if school is not None and getattr(school, 'is_active', True) is False:
            school = None
    except Exception:
        school = None
    return Response({
        'has_school': bool(school),
        'school_id': getattr(school, 'id', None) if school else None,
        'school_code': getattr(school, 'code', None) if school else None,
        'school_name': getattr(school, 'name', None) if school else None,
    })


def _get_or_create_maintenance_notice():
    notice = MaintenanceNotice.objects.order_by('id').first()
    if notice is not None:
        return notice
    try:
        return MaintenanceNotice.objects.create(enabled=False, message='')
    except Exception:
        return MaintenanceNotice.objects.order_by('id').first()


def _broadcast_maintenance_alert_to_all_schools(*, sender, body: str) -> None:
    try:
        from communications.models import Message, MessageRecipient
        from django.contrib.auth import get_user_model
        User = get_user_model()
    except Exception:
        return

    schools = School.objects.filter(is_active=True).only('id')
    for s in schools:
        try:
            msg = Message.objects.create(
                school_id=s.id,
                sender=sender,
                body=str(body or ''),
                audience=Message.Audience.ALL,
                recipient_role=None,
                reply_to=None,
                system_tag='Alert',
                is_broadcast=True,
            )
        except Exception:
            continue

        try:
            batch = []
            it = User.objects.filter(school_id=s.id).values_list('id', flat=True).iterator(chunk_size=2000)
            for uid in it:
                batch.append(MessageRecipient(message_id=msg.id, user_id=uid))
                if len(batch) >= 1000:
                    MessageRecipient.objects.bulk_create(batch, ignore_conflicts=True)
                    batch = []
            if batch:
                MessageRecipient.objects.bulk_create(batch, ignore_conflicts=True)
        except Exception:
            pass


def _clear_all_alert_broadcasts() -> None:
    try:
        from communications.models import Message
        # Uncheck is_broadcast for all Alert-tagged messages across all schools
        Message.objects.filter(system_tag__iexact='alert', is_broadcast=True).update(is_broadcast=False)
    except Exception:
        pass


@api_view(["GET"])
@permission_classes([AllowAny])
def maintenance_notice(request):
    notice = _get_or_create_maintenance_notice()
    return Response({
        'enabled': bool(getattr(notice, 'enabled', False)),
        'message': getattr(notice, 'message', '') or '',
        'updated_at': getattr(notice, 'updated_at', None),
    })


def _get_or_create_system_config():
    cfg = SystemConfig.objects.order_by('id').first()
    if cfg is not None:
        return cfg
    try:
        return SystemConfig.objects.create(default_domain='')
    except Exception:
        return SystemConfig.objects.order_by('id').first()


@api_view(["GET"])
@permission_classes([AllowAny])
def system_config_public(request):
    cfg = _get_or_create_system_config()
    default_domain = ''
    try:
        default_domain = (cfg.default_domain or '').strip().lower()
    except Exception:
        default_domain = ''
    if not default_domain:
        try:
            default_domain = str(getattr(settings, 'TENANT_BASE_DOMAIN', '') or '').strip().lower().lstrip('.')
        except Exception:
            default_domain = ''
    return Response({
        'default_domain': default_domain or '',
        'updated_at': getattr(cfg, 'updated_at', None) if cfg else None,
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def superadmin_maintenance_notice(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    notice = _get_or_create_maintenance_notice()
    if notice is None:
        return Response({'detail': 'Maintenance notice not available'}, status=500)

    if request.method == 'PATCH':
        data = request.data or {}
        if 'enabled' in data:
            notice.enabled = bool(data.get('enabled'))
        if 'message' in data:
            notice.message = str(data.get('message') or '')
        notice.save(update_fields=['enabled', 'message', 'updated_at'])
        try:
            if bool(notice.enabled):
                _broadcast_maintenance_alert_to_all_schools(
                    sender=request.user,
                    body=(notice.message or ''),
                )
            else:
                _clear_all_alert_broadcasts()
            
        except Exception:
            pass

    return Response({
        'enabled': bool(notice.enabled),
        'message': notice.message or '',
        'updated_at': notice.updated_at,
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def superadmin_system_config(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    cfg = _get_or_create_system_config()
    if cfg is None:
        return Response({'detail': 'System config not available'}, status=500)

    if request.method == 'PATCH':
        data = request.data or {}
        if 'default_domain' in data:
            cfg.default_domain = str(data.get('default_domain') or '')
        cfg.save(update_fields=['default_domain', 'updated_at'])

    return Response({
        'default_domain': cfg.default_domain or '',
        'updated_at': cfg.updated_at,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def school_public(request):
    """Public read-only school info for the landing page.
    Optional query params:
      - code: school.code to select a specific school
    Returns the first available school if not provided/found.
    """
    code = (request.query_params.get('code') or '').strip()
    school = None
    if code:
        school = School.objects.filter(code=code, is_deleted=False).first()
    if not school:
        school = getattr(request, 'school', None)
    if not school:
        school = School.objects.filter(is_deleted=False).filter(id=1).first() or School.objects.filter(is_deleted=False).order_by('id').first()
    if not school:
        return Response({
            "name": "",
            "code": "",
            "address": "",
            "motto": "",
            "aim": "",
            "logo_url": "",
            "social_links": {},
        })
    # Base serialized data
    payload = SchoolSerializer(school, context={"request": request}).data
    # Compute live metrics
    try:
        student_qs = Student.objects.filter(
            Q(school_id=school.id) | Q(klass__school_id=school.id)
        ).filter(is_graduated=False).distinct()
        student_count = student_qs.count()
    except Exception:
        student_count = 0
    try:
        teacher_count = User.objects.filter(role='teacher', school_id=school.id, is_active=True).count()
    except Exception:
        teacher_count = 0
    # Merge into homepage.stats and overwrite with live values for these keys
    hp = payload.get('homepage') or {}
    stats = dict(hp.get('stats') or {})
    stats['students'] = student_count
    stats['teachers'] = teacher_count
    stats['satisfaction'] = '98%'
    # Compute/refresh ratio if possible
    if teacher_count > 0:
        try:
            ratio_val = max(1, round(student_count / teacher_count))
            stats['ratio'] = f"{ratio_val}:1"
        except Exception:
            pass
    hp['stats'] = stats
    payload['homepage'] = hp
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def school_info(request):
    """Return the School object linked to the authenticated user's account (read-only)."""
    school = getattr(request.user, 'school', None)
    if not school:
        return Response({"detail": "No school linked to this user"}, status=404)
    return Response(SchoolSerializer(school, context={"request": request}).data)


def _frontend_verify_url(request, token: str) -> str:
    try:
        base = getattr(settings, 'FRONTEND_URL', '') or ''
    except Exception:
        base = ''
    base = str(base).rstrip('/')
    # Never emit localhost-based links (common when env vars are missing in production)
    lowered = base.lower()
    if base and (('localhost' not in lowered) and ('127.0.0.1' not in lowered)):
        return f"{base}/verify-email?token={token}"
    return request.build_absolute_uri(f"/api/auth/verify-email/?token={token}")


def _handle_demo_request(request):
    data = request.data or {}
    school_name = (data.get('school_name') or '').strip()
    admin_email = (data.get('admin_email') or '').strip().lower()
    admin_password = data.get('admin_password') or ''
    admin_first_name = (data.get('admin_first_name') or '').strip()
    admin_last_name = (data.get('admin_last_name') or '').strip()
    phone = (data.get('phone') or '').strip()
    domain = (data.get('domain') or '').strip()
    honeypot = (data.get('website') or '').strip()

    if not school_name or not admin_email or not admin_password:
        return Response({"detail": "school_name, admin_email and admin_password are required"}, status=400)
    if honeypot:
        return Response({"detail": "Invalid submission"}, status=400)

    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
    cache_key = f"demo_request:{ip}"
    attempts = cache.get(cache_key, 0)
    if attempts and int(attempts) >= 10:
        return Response({"detail": "Rate limit exceeded. Please try again later."}, status=429)
    cache.set(cache_key, int(attempts) + 1, 60 * 60)

    normalized_domain = _normalize_domain(domain)
    if normalized_domain and SchoolDomain.objects.filter(domain__iexact=normalized_domain).exists():
        return Response({"detail": "Domain already in use"}, status=400)

    if DemoRequest.objects.filter(admin_email__iexact=admin_email, status=DemoRequest.Status.PENDING).exists():
        return Response({"detail": "A demo request for this email is already pending"}, status=400)

    DemoRequest.objects.create(
        school_name=school_name,
        domain=normalized_domain,
        admin_email=admin_email,
        admin_first_name=admin_first_name,
        admin_last_name=admin_last_name,
        phone=phone,
        password_hash=make_password(admin_password),
        status=DemoRequest.Status.PENDING,
    )
    return Response({"detail": "Demo request submitted"}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def request_demo(request):
    return _handle_demo_request(request)


# Public endpoint: create a trial school + admin
@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def trial_signup(request):
    return _handle_demo_request(request)


@api_view(["GET"])
@permission_classes([AllowAny])
def verify_email(request):
    token = request.query_params.get('token', '').strip()
    if not token:
        return Response({"detail": "token is required"}, status=400)
    try:
        rec = EmailVerificationToken.objects.select_related('user').get(token=token)
    except EmailVerificationToken.DoesNotExist:
        return Response({"detail": "Invalid or expired token"}, status=400)
    if rec.is_expired():
        rec.delete()
        return Response({"detail": "Token expired"}, status=400)
    user = rec.user
    user.email_verified = True
    user.is_active = True
    user.save(update_fields=['email_verified', 'is_active'])
    rec.delete()
    return Response({"detail": "Email verified"})


@api_view(["POST"]) 
@permission_classes([IsAuthenticated])
def logout(request):
    """Blacklist the provided refresh token to log out the current session.
    Body: {refresh: <refresh_token>}
    """
    refresh = (request.data.get('refresh') or '').strip()
    if not refresh:
        return Response({"detail": "refresh is required"}, status=400)
    try:
        token = RefreshToken(refresh)
        token.blacklist()
        return Response({"detail": "Logged out"})
    except Exception as e:
        return Response({"detail": "Invalid token"}, status=400)


@api_view(["POST"]) 
@permission_classes([IsAuthenticated])
def logout_all(request):
    """Blacklist all outstanding refresh tokens for the current user (global logout)."""
    try:
        tokens = OutstandingToken.objects.filter(user=request.user)
        count = 0
        for t in tokens:
            try:
                BlacklistedToken.objects.get_or_create(token=t)
                count += 1
            except Exception:
                pass
        return Response({"detail": "Logged out from all sessions", "blacklisted": count})
    except Exception as e:
        return Response({"detail": "Failed to logout all"}, status=500)


def _normalize_domain(raw: str) -> str:
    normalized_domain = str(raw or '').strip().lower()
    if normalized_domain.startswith('http://'):
        normalized_domain = normalized_domain[7:]
    elif normalized_domain.startswith('https://'):
        normalized_domain = normalized_domain[8:]
    normalized_domain = normalized_domain.split('/', 1)[0].strip()
    normalized_domain = normalized_domain.split(':', 1)[0].strip()
    if normalized_domain.startswith('www.'):
        normalized_domain = normalized_domain[4:]
    return normalized_domain


def _default_domain_for_school(school) -> str:
    base = _normalize_domain(getattr(settings, 'TENANT_BASE_DOMAIN', '') or '')
    if not base:
        return ''
    code = (getattr(school, 'code', None) or '').strip().lower()
    if not code:
        return ''
    return f"{code}.{base}"


def _create_primary_domain_for_school(school, preferred_domain: str = ''):
    normalized = _normalize_domain(preferred_domain or '')
    if normalized:
        if SchoolDomain.objects.filter(domain__iexact=normalized).exists():
            raise ValueError('Domain already in use')
        return SchoolDomain.objects.create(school=school, domain=normalized, is_primary=True)

    base_candidate = _default_domain_for_school(school)
    if not base_candidate:
        return None
    candidate = _normalize_domain(base_candidate)
    if not candidate:
        return None
    if not SchoolDomain.objects.filter(domain__iexact=candidate).exists():
        return SchoolDomain.objects.create(school=school, domain=candidate, is_primary=True)

    sid = getattr(school, 'id', None)
    if sid:
        candidate2 = _normalize_domain(f"{getattr(school, 'code', 'school')}-{sid}.{_normalize_domain(getattr(settings, 'TENANT_BASE_DOMAIN', '') or '')}")
        if candidate2 and not SchoolDomain.objects.filter(domain__iexact=candidate2).exists():
            return SchoolDomain.objects.create(school=school, domain=candidate2, is_primary=True)

    i = 2
    base = _normalize_domain(getattr(settings, 'TENANT_BASE_DOMAIN', '') or '')
    while base:
        candidateN = _normalize_domain(f"{getattr(school, 'code', 'school')}-{i}.{base}")
        if candidateN and not SchoolDomain.objects.filter(domain__iexact=candidateN).exists():
            return SchoolDomain.objects.create(school=school, domain=candidateN, is_primary=True)
        i += 1
        if i > 50:
            break
    return None


def _require_superuser(request):
    if not getattr(request.user, 'is_superuser', False):
        return Response({"detail": "Not allowed"}, status=403)
    return None


def _purge_school_from_db(*, school_id: int) -> None:
    """Hard-delete a school and as much dependent data as possible."""
    with transaction.atomic():
        school = School.objects.select_for_update().filter(id=school_id).first()
        if school is None:
            return

        # Resolve core related IDs
        try:
            from academics.models import Student, Class as Klass
        except Exception:
            Student = None  # type: ignore
            Klass = None  # type: ignore

        class_ids = []
        if Klass is not None:
            try:
                class_ids = list(Klass.objects.filter(school_id=school_id).values_list('id', flat=True))
            except Exception:
                class_ids = []

        student_ids = []
        if Student is not None:
            try:
                student_ids = list(
                    Student.objects.filter(Q(school_id=school_id) | Q(klass__school_id=school_id)).values_list('id', flat=True)
                )
            except Exception:
                student_ids = []

        user_qs = User.objects.filter(school_id=school_id).exclude(is_superuser=True)
        user_ids = []
        try:
            user_ids = list(user_qs.values_list('id', flat=True))
        except Exception:
            user_ids = []

        # Communications
        try:
            from communications.models import Message, ArrearsMessageCampaign, Event, DeliveryLog, ServiceReview
            Message.objects.filter(school_id=school_id).delete()
            ArrearsMessageCampaign.objects.filter(school_id=school_id).delete()
            Event.objects.filter(school_id=school_id).delete()
            DeliveryLog.objects.filter(school_id=school_id).delete()
            ServiceReview.objects.filter(school_id=school_id).delete()
        except Exception:
            pass

        # Finance
        try:
            from finance.models import (
                FeeCategory,
                ClassFee,
                StudentFee,
                Invoice,
                PaymentMethod,
                MpesaConfig,
                IncomingPayment,
                ExpenseCategory,
                Expense,
                StaffPayroll,
                StaffPayslip,
                PocketMoneyWallet,
            )
            if student_ids:
                # Invoice delete cascades payments
                Invoice.objects.filter(student_id__in=student_ids).delete()
                StudentFee.objects.filter(student_id__in=student_ids).delete()
                PocketMoneyWallet.objects.filter(student_id__in=student_ids).delete()
                IncomingPayment.objects.filter(
                    Q(matched_student_id__in=student_ids) | Q(matched_invoice__student_id__in=student_ids)
                ).delete()
            if class_ids:
                ClassFee.objects.filter(klass_id__in=class_ids).delete()

            StaffPayslip.objects.filter(school_id=school_id).delete()
            StaffPayroll.objects.filter(school_id=school_id).delete()
            Expense.objects.filter(school_id=school_id).delete()
            ExpenseCategory.objects.filter(school_id=school_id).delete()
            PaymentMethod.objects.filter(school_id=school_id).delete()
            MpesaConfig.objects.filter(school_id=school_id).delete()
            # QuerySet.delete bypasses FeeCategory.delete override (which blocks protected categories)
            FeeCategory.objects.filter(school_id=school_id).delete()
        except Exception:
            pass

        # Accounts app dependents
        try:
            from .models import NonTeachingStaff
            NonTeachingStaff.objects.filter(school_id=school_id).delete()
        except Exception:
            pass
        try:
            EmailVerificationToken.objects.filter(user_id__in=user_ids).delete()
        except Exception:
            pass
        try:
            DemoRequest.objects.filter(created_school_id=school_id).delete()
        except Exception:
            pass

        # Generic cleanup for any other models that directly FK/OneToOne to School.
        # This covers most academics/reports/etc tables without having to list them manually.
        for model in django_apps.get_models():
            try:
                if model is School or model is User:
                    continue
                for field in model._meta.fields:
                    if isinstance(field, (ForeignKey, OneToOneField)) and getattr(field.remote_field, 'model', None) is School:
                        model.objects.filter(**{field.name: school_id}).delete()
                        break
            except Exception:
                continue

        # Academics: students are SET_NULL to school/class in a few places; explicitly remove them
        if Student is not None:
            try:
                Student.objects.filter(Q(school_id=school_id) | Q(klass__school_id=school_id)).delete()
            except Exception:
                pass

        # Finally remove users and school
        try:
            user_qs.delete()
        except Exception:
            pass
        school.delete()


def _generate_unique_school_code(school_name: str) -> str:
    base_code = slugify(school_name)[:30] or 'school'
    code = base_code
    i = 1
    while School.objects.filter(code=code).exists():
        code = f"{base_code}-{i}"
        i += 1
    return code


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_demo_requests(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    status_filter = (request.query_params.get('status') or '').strip().lower()
    q = (request.query_params.get('q') or '').strip()

    qs = DemoRequest.objects.all().select_related('approved_by', 'rejected_by', 'created_school', 'created_user')
    if status_filter:
        qs = qs.filter(status__iexact=status_filter)
    if q:
        qs = qs.filter(
            Q(school_name__icontains=q) |
            Q(admin_email__icontains=q) |
            Q(domain__icontains=q)
        )
    qs = qs.order_by('-created_at', '-id')

    out = []
    for r in qs[:500]:
        out.append({
            'id': r.id,
            'school_name': r.school_name,
            'domain': r.domain,
            'admin_email': r.admin_email,
            'admin_first_name': r.admin_first_name,
            'admin_last_name': r.admin_last_name,
            'phone': r.phone,
            'status': r.status,
            'created_at': r.created_at,
            'approved_at': r.approved_at,
            'approved_by': getattr(getattr(r, 'approved_by', None), 'username', None),
            'rejected_at': r.rejected_at,
            'rejected_by': getattr(getattr(r, 'rejected_by', None), 'username', None),
            'rejection_reason': r.rejection_reason,
            'created_school_id': getattr(r.created_school, 'id', None),
            'created_user_id': getattr(r.created_user, 'id', None),
        })
    return Response({'results': out})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_demo_request_approve(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        with transaction.atomic():
            try:
                r = DemoRequest.objects.select_for_update().get(id=id)
            except DemoRequest.DoesNotExist:
                return Response({'detail': 'Not found'}, status=404)
            if r.status != DemoRequest.Status.PENDING:
                return Response({'detail': 'Only pending requests can be approved'}, status=400)

            if User.objects.filter(username__iexact=r.admin_email).exists():
                return Response({'detail': 'A user with this email already exists'}, status=400)

            if r.domain and SchoolDomain.objects.filter(domain__iexact=r.domain).exists():
                return Response({'detail': 'Domain already in use'}, status=400)

            code = _generate_unique_school_code(r.school_name)
            school = School.objects.create(
                name=r.school_name,
                code=code,
                is_trial=True,
                trial_expires_at=timezone.now() + timedelta(days=14),
                trial_student_limit=100,
                feature_flags={"pos": False, "sms": False},
            )
            if r.domain or getattr(settings, 'TENANT_BASE_DOMAIN', None):
                _create_primary_domain_for_school(school, r.domain)

            user = User(
                username=r.admin_email,
                email=r.admin_email,
                role='admin',
                first_name=r.admin_first_name,
                last_name=r.admin_last_name,
                phone=r.phone,
                school=school,
                is_active=True,
                email_verified=False,
            )
            user.password = r.password_hash
            user.save()

            token = secrets.token_urlsafe(48)
            EmailVerificationToken.objects.create(
                user=user,
                token=token,
                expires_at=timezone.now() + timedelta(days=3),
            )
            verify_url = _frontend_verify_url(request, token)

            r.status = DemoRequest.Status.APPROVED
            r.approved_at = timezone.now()
            r.approved_by = request.user
            r.created_school = school
            r.created_user = user
            r.save(update_fields=['status', 'approved_at', 'approved_by', 'created_school', 'created_user'])

        try:
            send_email_safe(
                subject='EduTrack demo approved — verify your email',
                message=(
                    f"Hi {r.admin_first_name or 'there'},\n\n"
                    f"Your EduTrack demo request for '{r.school_name}' has been approved.\n\n"
                    "Please verify your email using this link:\n"
                    f"{verify_url}\n\n"
                    "After verifying your email, you can log in using your email and password."
                ),
                recipient=r.admin_email,
                school_id=getattr(school, 'id', None),
            )
        except Exception:
            pass

        return Response({'detail': 'Approved and verification email sent'})
    except ValueError:
        return Response({'detail': 'Domain already in use'}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_demo_request_reject(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    with transaction.atomic():
        try:
            r = DemoRequest.objects.select_for_update().get(id=id)
        except DemoRequest.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        if r.status != DemoRequest.Status.PENDING:
            return Response({'detail': 'Only pending requests can be rejected'}, status=400)

        reason = (request.data or {}).get('reason')
        reason = str(reason or '').strip()

        r.status = DemoRequest.Status.REJECTED
        r.rejected_at = timezone.now()
        r.rejected_by = request.user
        r.rejection_reason = reason
        r.save(update_fields=['status', 'rejected_at', 'rejected_by', 'rejection_reason'])
    return Response({'detail': 'Rejected'})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def superadmin_schools(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    if request.method == 'GET':
        qs = School.objects.filter(is_deleted=False).order_by('id').prefetch_related('domains')
        data = []
        for s in qs:
            domains = list(s.domains.all().order_by('-is_primary', 'id').values('id', 'domain', 'is_primary', 'created_at'))
            primary = None
            for d in domains:
                if d.get('is_primary'):
                    primary = d.get('domain')
                    break
            data.append({
                'id': s.id,
                'name': s.name,
                'code': s.code,
                'is_active': getattr(s, 'is_active', True),
                'address': s.address,
                'motto': s.motto,
                'aim': s.aim,
                'social_links': s.social_links,
                'homepage': s.homepage,
                'is_trial': s.is_trial,
                'trial_expires_at': s.trial_expires_at,
                'trial_student_limit': s.trial_student_limit,
                'feature_flags': s.feature_flags,
                'domains': domains,
                'primary_domain': primary,
            })
        return Response({'results': data})

    data = request.data or {}
    name = (data.get('name') or '').strip()
    code = (data.get('code') or '').strip()
    domain = (data.get('domain') or '').strip()
    if not name:
        return Response({"detail": "name is required"}, status=400)
    if not code:
        base_code = slugify(name)[:30] or 'school'
        code = base_code
        i = 1
        while School.objects.filter(code=code).exists():
            code = f"{base_code}-{i}"
            i += 1
    normalized_domain = _normalize_domain(domain)
    if normalized_domain and SchoolDomain.objects.filter(domain__iexact=normalized_domain).exists():
        return Response({"detail": "Domain already in use"}, status=400)

    try:
        is_trial = bool(data.get('is_trial')) if data.get('is_trial') is not None else True
    except Exception:
        is_trial = True
    try:
        trial_student_limit = int(data.get('trial_student_limit')) if data.get('trial_student_limit') is not None else 100
    except Exception:
        trial_student_limit = 100
    try:
        feature_flags = data.get('feature_flags') if isinstance(data.get('feature_flags'), dict) else {}
    except Exception:
        feature_flags = {}

    try:
        with transaction.atomic():
            school = School.objects.create(
                name=name,
                code=code,
                is_active=True,
                address=(data.get('address') or ''),
                motto=(data.get('motto') or ''),
                aim=(data.get('aim') or ''),
                social_links=data.get('social_links') if isinstance(data.get('social_links'), dict) else {},
                homepage=data.get('homepage') if isinstance(data.get('homepage'), dict) else {},
                is_trial=is_trial,
                trial_student_limit=trial_student_limit,
                feature_flags=feature_flags,
            )
            if normalized_domain or getattr(settings, 'TENANT_BASE_DOMAIN', None):
                _create_primary_domain_for_school(school, normalized_domain)
    except ValueError:
        return Response({"detail": "Domain already in use"}, status=400)

    return Response({'id': school.id}, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_system_analysis(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from django.db.models import Max, Count
    from finance.models import Invoice, Payment
    from communications.models import Event, DeliveryLog

    def _db_size_bytes():
        try:
            vendor = getattr(connection, 'vendor', '')
        except Exception:
            vendor = ''
        try:
            if vendor == 'postgresql':
                with connection.cursor() as cur:
                    cur.execute("SELECT pg_database_size(current_database())")
                    row = cur.fetchone()
                    return int(row[0] or 0) if row else 0
            if vendor == 'sqlite':
                db_name = (settings.DATABASES.get('default') or {}).get('NAME')
                if db_name and os.path.exists(db_name):
                    return int(os.path.getsize(db_name) or 0)
                return 0
            if vendor == 'mysql':
                db = (settings.DATABASES.get('default') or {}).get('NAME')
                if not db:
                    return 0
                with connection.cursor() as cur:
                    cur.execute(
                        "SELECT COALESCE(SUM(data_length+index_length),0) FROM information_schema.tables WHERE table_schema=%s",
                        [db],
                    )
                    row = cur.fetchone()
                    return int(row[0] or 0) if row else 0
        except Exception:
            return 0
        return 0

    now = timezone.now()
    try:
        days_param = request.query_params.get('days')
        window_days = int(days_param) if (days_param and str(days_param).isdigit()) else 30
        window_days = max(1, min(window_days, 365))
    except Exception:
        window_days = 30
    window_start = now - timedelta(days=window_days)

    deliv_agg = {}
    try:
        for row in (
            DeliveryLog.objects
            .filter(created_at__gte=window_start)
            .values('school_id', 'channel', 'ok')
            .annotate(c=Count('id'))
        ):
            sid = row.get('school_id')
            channel = row.get('channel')
            ok = bool(row.get('ok'))
            c = int(row.get('c') or 0)
            deliv_agg.setdefault(sid, {}).setdefault(channel, {}).setdefault(ok, 0)
            deliv_agg[sid][channel][ok] += c
    except Exception:
        deliv_agg = {}

    event_agg = {}
    try:
        for row in (
            SystemHealthEvent.objects
            .filter(created_at__gte=window_start)
            .values('school_id', 'component', 'ok')
            .annotate(c=Count('id'))
        ):
            sid = row.get('school_id')
            comp = row.get('component')
            ok = bool(row.get('ok'))
            c = int(row.get('c') or 0)
            event_agg.setdefault(sid, {}).setdefault(comp, {}).setdefault(ok, 0)
            event_agg[sid][comp][ok] += c
    except Exception:
        event_agg = {}

    out = []
    total_db_bytes = _db_size_bytes()

    schools = School.objects.filter(is_deleted=False).order_by('id')
    for s in schools:
        sid = s.id
        is_active = bool(getattr(s, 'is_active', True))

        lat = {}
        t0 = perf_counter()
        students_qs = Student.objects.filter(Q(school_id=sid) | Q(klass__school_id=sid)).filter(is_graduated=False).distinct()
        students_count = students_qs.count()
        lat['students_count_ms'] = round((perf_counter() - t0) * 1000.0, 2)

        t0 = perf_counter()
        classes_count = Klass.objects.filter(school_id=sid).count()
        lat['classes_count_ms'] = round((perf_counter() - t0) * 1000.0, 2)

        t0 = perf_counter()
        teachers_count = User.objects.filter(role='teacher', school_id=sid, is_active=True).count()
        lat['teachers_count_ms'] = round((perf_counter() - t0) * 1000.0, 2)

        t0 = perf_counter()
        invoices_qs = Invoice.objects.filter(student__klass__school_id=sid)
        invoices_count = invoices_qs.count()
        lat['invoices_count_ms'] = round((perf_counter() - t0) * 1000.0, 2)

        t0 = perf_counter()
        payments_qs = Payment.objects.filter(invoice__student__klass__school_id=sid)
        payments_count = payments_qs.count()
        lat['payments_count_ms'] = round((perf_counter() - t0) * 1000.0, 2)

        events_qs = Event.objects.filter(school_id=sid)
        events_count = events_qs.count()

        delivery_qs = DeliveryLog.objects.filter(school_id=sid)
        delivery_total = delivery_qs.count()
        delivery_failed = delivery_qs.filter(ok=False).count()
        delivery_fail_rate = round((delivery_failed / delivery_total) * 100.0, 2) if delivery_total else 0.0

        last_invoice_at = invoices_qs.aggregate(m=Max('created_at')).get('m')
        last_payment_at = payments_qs.aggregate(m=Max('created_at')).get('m')
        last_event_at = events_qs.aggregate(m=Max('updated_at')).get('m')
        last_delivery_at = delivery_qs.aggregate(m=Max('created_at')).get('m')

        last_activity_at = None
        for dt in [last_payment_at, last_invoice_at, last_event_at, last_delivery_at]:
            if dt and (last_activity_at is None or dt > last_activity_at):
                last_activity_at = dt

        days_since_activity = None
        if last_activity_at:
            try:
                days_since_activity = (now - last_activity_at).days
            except Exception:
                days_since_activity = None

        data_points = int(
            (students_count or 0)
            + (teachers_count or 0)
            + (classes_count or 0)
            + (invoices_count or 0)
            + (payments_count or 0)
            + (events_count or 0)
            + (delivery_total or 0)
        )

        avg_latency_ms = round((sum(lat.values()) / len(lat.values())) if lat else 0.0, 2)

        sms_ok = int(((deliv_agg.get(sid, {}).get('sms', {}) or {}).get(True, 0)) or 0)
        sms_fail = int(((deliv_agg.get(sid, {}).get('sms', {}) or {}).get(False, 0)) or 0)
        sms_total = sms_ok + sms_fail

        email_ok = int(((deliv_agg.get(sid, {}).get('email', {}) or {}).get(True, 0)) or 0)
        email_fail = int(((deliv_agg.get(sid, {}).get('email', {}) or {}).get(False, 0)) or 0)
        email_total = email_ok + email_fail

        login_ok = int(((event_agg.get(sid, {}).get(SystemHealthEvent.Component.LOGIN, {}) or {}).get(True, 0)) or 0)
        login_fail = int(((event_agg.get(sid, {}).get(SystemHealthEvent.Component.LOGIN, {}) or {}).get(False, 0)) or 0)
        login_total = login_ok + login_fail

        mpesa_ok = int(((event_agg.get(sid, {}).get(SystemHealthEvent.Component.PAYMENT_MPESA, {}) or {}).get(True, 0)) or 0)
        mpesa_fail = int(((event_agg.get(sid, {}).get(SystemHealthEvent.Component.PAYMENT_MPESA, {}) or {}).get(False, 0)) or 0)
        mpesa_total = mpesa_ok + mpesa_fail

        bank_ok = int(((event_agg.get(sid, {}).get(SystemHealthEvent.Component.PAYMENT_BANK, {}) or {}).get(True, 0)) or 0)
        bank_fail = int(((event_agg.get(sid, {}).get(SystemHealthEvent.Component.PAYMENT_BANK, {}) or {}).get(False, 0)) or 0)
        bank_total = bank_ok + bank_fail

        query_threshold_ms = 25.0
        query_ok = bool(avg_latency_ms <= query_threshold_ms)

        score = 100.0
        if not is_active:
            score = 0.0
        else:
            if delivery_total >= 10:
                score -= min(30.0, (delivery_fail_rate / 100.0) * 60.0)
            if days_since_activity is None:
                score -= 30.0
            else:
                score -= min(40.0, float(max(0, days_since_activity)) * 2.0)
            score -= min(20.0, avg_latency_ms / 50.0)
        score = max(0.0, min(100.0, score))

        out.append({
            'id': sid,
            'name': s.name,
            'code': s.code,
            'is_active': is_active,
            'is_trial': bool(getattr(s, 'is_trial', False)),
            'trial_expires_at': s.trial_expires_at,
            'trial_student_limit': getattr(s, 'trial_student_limit', None),
            'counts': {
                'students': students_count,
                'teachers': teachers_count,
                'classes': classes_count,
                'invoices': invoices_count,
                'payments': payments_count,
                'events': events_count,
                'delivery_logs': delivery_total,
            },
            'delivery': {
                'total': delivery_total,
                'failed': delivery_failed,
                'fail_rate_pct': delivery_fail_rate,
                'last_at': last_delivery_at,
            },
            'activity': {
                'last_activity_at': last_activity_at,
                'days_since_activity': days_since_activity,
                'last_payment_at': last_payment_at,
                'last_invoice_at': last_invoice_at,
                'last_event_at': last_event_at,
            },
            'performance': {
                'avg_latency_ms': avg_latency_ms,
                'breakdown_ms': lat,
            },
            'storage': {
                'data_points': data_points,
                'estimated_db_bytes': 0,
                'estimated_db_gb': 0,
            },
            'health_score': round(score, 1),
            'components': {
                'window_days': window_days,
                'sms': {
                    'total': sms_total,
                    'failed': sms_fail,
                    'fail_rate_pct': round((sms_fail / sms_total) * 100.0, 2) if sms_total else 0.0,
                },
                'email': {
                    'total': email_total,
                    'failed': email_fail,
                    'fail_rate_pct': round((email_fail / email_total) * 100.0, 2) if email_total else 0.0,
                },
                'login': {
                    'total': login_total,
                    'failed': login_fail,
                    'fail_rate_pct': round((login_fail / login_total) * 100.0, 2) if login_total else 0.0,
                },
                'payment_mpesa': {
                    'total': mpesa_total,
                    'failed': mpesa_fail,
                    'fail_rate_pct': round((mpesa_fail / mpesa_total) * 100.0, 2) if mpesa_total else 0.0,
                },
                'payment_bank': {
                    'total': bank_total,
                    'failed': bank_fail,
                    'fail_rate_pct': round((bank_fail / bank_total) * 100.0, 2) if bank_total else 0.0,
                },
                'queries': {
                    'total': 1,
                    'failed': 0 if query_ok else 1,
                    'fail_rate_pct': 0.0 if query_ok else 100.0,
                    'avg_latency_ms': avg_latency_ms,
                    'threshold_ms': query_threshold_ms,
                },
            },
        })

    total_points = sum((i.get('storage') or {}).get('data_points') or 0 for i in out) or 0
    if total_db_bytes > 0 and total_points > 0:
        for i in out:
            pts = (i.get('storage') or {}).get('data_points') or 0
            est = int((total_db_bytes * float(pts)) / float(total_points)) if pts else 0
            i['storage']['estimated_db_bytes'] = est
            i['storage']['estimated_db_gb'] = round(est / (1024**3), 4)

    totals = {
        'schools': len(out),
        'data_points': total_points,
        'db_size_bytes': total_db_bytes,
        'db_size_gb': round(total_db_bytes / (1024**3), 4) if total_db_bytes else 0,
        'students': sum((i.get('counts') or {}).get('students') or 0 for i in out),
        'teachers': sum((i.get('counts') or {}).get('teachers') or 0 for i in out),
        'classes': sum((i.get('counts') or {}).get('classes') or 0 for i in out),
        'invoices': sum((i.get('counts') or {}).get('invoices') or 0 for i in out),
        'payments': sum((i.get('counts') or {}).get('payments') or 0 for i in out),
        'events': sum((i.get('counts') or {}).get('events') or 0 for i in out),
        'avg_latency_ms': round((sum((i.get('performance') or {}).get('avg_latency_ms') or 0 for i in out) / len(out)) if out else 0.0, 2),
    }

    def _sum_component(key: str, field: str) -> int:
        return int(sum((((i.get('components') or {}).get(key) or {}).get(field) or 0) for i in out) or 0)

    query_slow = int(sum(1 for i in out if (((i.get('components') or {}).get('queries') or {}).get('failed') or 0) == 1))
    components = {
        'window_days': window_days,
        'sms': {
            'total': _sum_component('sms', 'total'),
            'failed': _sum_component('sms', 'failed'),
        },
        'email': {
            'total': _sum_component('email', 'total'),
            'failed': _sum_component('email', 'failed'),
        },
        'login': {
            'total': _sum_component('login', 'total'),
            'failed': _sum_component('login', 'failed'),
        },
        'payment_mpesa': {
            'total': _sum_component('payment_mpesa', 'total'),
            'failed': _sum_component('payment_mpesa', 'failed'),
        },
        'payment_bank': {
            'total': _sum_component('payment_bank', 'total'),
            'failed': _sum_component('payment_bank', 'failed'),
        },
        'queries': {
            'total': len(out),
            'failed': query_slow,
            'threshold_ms': 25.0,
        },
    }

    for k, v in components.items():
        if k in ('window_days', 'queries'):
            continue
        t = int(v.get('total') or 0)
        f = int(v.get('failed') or 0)
        v['fail_rate_pct'] = round((f / t) * 100.0, 2) if t else 0.0
    try:
        qt = int(components.get('queries', {}).get('total') or 0)
        qf = int(components.get('queries', {}).get('failed') or 0)
        components['queries']['fail_rate_pct'] = round((qf / qt) * 100.0, 2) if qt else 0.0
    except Exception:
        pass

    return Response({
        'generated_at': now,
        'totals': totals,
        'components': components,
        'schools': out,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_delivery_logs(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from communications.models import DeliveryLog

    qs = DeliveryLog.objects.all().select_related('school').order_by('-created_at', 'id')

    ch = (request.query_params.get('channel') or '').strip().lower()
    if ch in ('sms', 'email'):
        qs = qs.filter(channel=ch)

    ok_param = request.query_params.get('ok')
    if ok_param is not None and str(ok_param).strip() != '':
        s = str(ok_param).strip().lower()
        if s in ('1', 'true', 'yes', 'ok'):
            qs = qs.filter(ok=True)
        elif s in ('0', 'false', 'no', 'fail'):
            qs = qs.filter(ok=False)

    school_id = request.query_params.get('school_id')
    if school_id is not None and str(school_id).strip() != '':
        try:
            qs = qs.filter(school_id=int(school_id))
        except Exception:
            pass

    q = (request.query_params.get('q') or '').strip()
    if q:
        qs = qs.filter(
            Q(recipient__icontains=q)
            | Q(message_snippet__icontains=q)
            | Q(context__icontains=q)
            | Q(school__name__icontains=q)
            | Q(school__code__icontains=q)
        )

    since = request.query_params.get('since')
    if since:
        dt = parse_datetime(str(since))
        if not dt:
            d = parse_date(str(since))
            if d:
                dt = datetime(d.year, d.month, d.day, 0, 0, 0)
        if dt:
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            qs = qs.filter(created_at__gte=dt)

    until = request.query_params.get('until')
    if until:
        dt = parse_datetime(str(until))
        if not dt:
            d = parse_date(str(until))
            if d:
                dt = datetime(d.year, d.month, d.day, 23, 59, 59)
        if dt:
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            qs = qs.filter(created_at__lte=dt)

    paginator = CustomPageNumberPagination()
    page = paginator.paginate_queryset(qs, request)
    rows = []
    for rec in page:
        sch = getattr(rec, 'school', None)
        rows.append({
            'id': rec.id,
            'school_id': getattr(rec, 'school_id', None),
            'school_name': getattr(sch, 'name', '') if sch else '',
            'school_code': getattr(sch, 'code', '') if sch else '',
            'channel': rec.channel,
            'recipient': rec.recipient,
            'ok': bool(rec.ok),
            'message_snippet': rec.message_snippet,
            'context': rec.context,
            'created_at': rec.created_at,
        })
    return paginator.get_paginated_response(rows)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_system_health_events(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    qs = SystemHealthEvent.objects.all().select_related('school').order_by('-created_at', 'id')

    comp = (request.query_params.get('component') or '').strip().lower()
    if comp:
        allowed = {c[0] for c in SystemHealthEvent.Component.choices}
        if comp in allowed:
            qs = qs.filter(component=comp)

    ok_param = request.query_params.get('ok')
    if ok_param is not None and str(ok_param).strip() != '':
        s = str(ok_param).strip().lower()
        if s in ('1', 'true', 'yes', 'ok'):
            qs = qs.filter(ok=True)
        elif s in ('0', 'false', 'no', 'fail'):
            qs = qs.filter(ok=False)

    school_id = request.query_params.get('school_id')
    if school_id is not None and str(school_id).strip() != '':
        try:
            qs = qs.filter(school_id=int(school_id))
        except Exception:
            pass

    q = (request.query_params.get('q') or '').strip()
    if q:
        qs = qs.filter(
            Q(context__icontains=q)
            | Q(school__name__icontains=q)
            | Q(school__code__icontains=q)
        )

    since = request.query_params.get('since')
    if since:
        dt = parse_datetime(str(since))
        if not dt:
            d = parse_date(str(since))
            if d:
                dt = datetime(d.year, d.month, d.day, 0, 0, 0)
        if dt:
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            qs = qs.filter(created_at__gte=dt)

    until = request.query_params.get('until')
    if until:
        dt = parse_datetime(str(until))
        if not dt:
            d = parse_date(str(until))
            if d:
                dt = datetime(d.year, d.month, d.day, 23, 59, 59)
        if dt:
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            qs = qs.filter(created_at__lte=dt)

    paginator = CustomPageNumberPagination()
    page = paginator.paginate_queryset(qs, request)
    rows = []
    for rec in page:
        sch = getattr(rec, 'school', None)
        rows.append({
            'id': rec.id,
            'school_id': getattr(rec, 'school_id', None),
            'school_name': getattr(sch, 'name', '') if sch else '',
            'school_code': getattr(sch, 'code', '') if sch else '',
            'component': rec.component,
            'ok': bool(rec.ok),
            'context': rec.context,
            'created_at': rec.created_at,
        })
    return paginator.get_paginated_response(rows)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def superadmin_school_detail(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        school = School.objects.prefetch_related('domains').get(id=id)
    except School.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if request.method == 'GET':
        domains = list(school.domains.all().order_by('-is_primary', 'id').values('id', 'domain', 'is_primary', 'created_at'))
        return Response({
            'id': school.id,
            'name': school.name,
            'code': school.code,
            'is_active': getattr(school, 'is_active', True),
            'address': school.address,
            'motto': school.motto,
            'aim': school.aim,
            'social_links': school.social_links,
            'homepage': school.homepage,
            'is_trial': school.is_trial,
            'trial_expires_at': school.trial_expires_at,
            'trial_student_limit': school.trial_student_limit,
            'feature_flags': school.feature_flags,
            'domains': domains,
        })

    if request.method == 'DELETE':
        if bool(getattr(school, 'is_deleted', False)):
            return Response({"detail": "Already deleted"}, status=400)
        school.is_deleted = True
        school.deleted_at = timezone.now()
        school.deleted_by = request.user
        try:
            school.is_active = False
        except Exception:
            pass
        school.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'is_active'])
        return Response({"detail": "Moved to recycle bin"}, status=200)

    data = request.data or {}
    update_fields = []
    for field in ('name', 'code', 'address', 'motto', 'aim'):
        if field in data and data.get(field) is not None:
            setattr(school, field, data.get(field))
            update_fields.append(field)
    for field in ('social_links', 'homepage', 'feature_flags'):
        if field in data and isinstance(data.get(field), dict):
            setattr(school, field, data.get(field))
            update_fields.append(field)
    if 'is_active' in data and data.get('is_active') is not None:
        school.is_active = bool(data.get('is_active'))
        update_fields.append('is_active')
    if 'is_trial' in data and data.get('is_trial') is not None:
        school.is_trial = bool(data.get('is_trial'))
        update_fields.append('is_trial')
    if 'trial_student_limit' in data and data.get('trial_student_limit') is not None:
        try:
            school.trial_student_limit = int(data.get('trial_student_limit'))
            update_fields.append('trial_student_limit')
        except Exception:
            return Response({"detail": "Invalid trial_student_limit"}, status=400)
    if 'trial_expires_at' in data:
        raw = data.get('trial_expires_at')
        if raw in (None, ''):
            school.trial_expires_at = None
            update_fields.append('trial_expires_at')
        else:
            parsed = parse_datetime(str(raw))
            if parsed is None:
                d = parse_date(str(raw))
                if d is not None:
                    parsed = timezone.datetime(d.year, d.month, d.day, 0, 0, 0)
            if parsed is None:
                return Response({"detail": "Invalid trial_expires_at"}, status=400)
            school.trial_expires_at = parsed
            update_fields.append('trial_expires_at')
    if update_fields:
        school.save(update_fields=list(set(update_fields)))
    return Response({"detail": "updated"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def superadmin_school_add_domain(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        school = School.objects.get(id=id)
    except School.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    data = request.data or {}
    domain = _normalize_domain(data.get('domain') or '')
    if not domain:
        return Response({"detail": "domain is required"}, status=400)
    if SchoolDomain.objects.filter(domain__iexact=domain).exists():
        return Response({"detail": "Domain already in use"}, status=400)
    try:
        is_primary = bool(data.get('is_primary'))
    except Exception:
        is_primary = False

    with transaction.atomic():
        if is_primary:
            SchoolDomain.objects.filter(school_id=school.id, is_primary=True).update(is_primary=False)
        d = SchoolDomain.objects.create(school=school, domain=domain, is_primary=is_primary)
    return Response({"id": d.id, "domain": d.domain, "is_primary": d.is_primary}, status=201)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def superadmin_domain_detail(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        dom = SchoolDomain.objects.select_related('school').get(id=id)
    except SchoolDomain.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if request.method == 'DELETE':
        dom.delete()
        return Response(status=204)

    data = request.data or {}
    if 'domain' in data and data.get('domain') is not None:
        new_domain = _normalize_domain(data.get('domain') or '')
        if not new_domain:
            return Response({"detail": "Invalid domain"}, status=400)
        if SchoolDomain.objects.exclude(id=dom.id).filter(domain__iexact=new_domain).exists():
            return Response({"detail": "Domain already in use"}, status=400)
        dom.domain = new_domain
    if 'is_primary' in data and data.get('is_primary') is not None:
        make_primary = bool(data.get('is_primary'))
        with transaction.atomic():
            if make_primary:
                SchoolDomain.objects.filter(school_id=dom.school_id, is_primary=True).exclude(id=dom.id).update(is_primary=False)
            dom.is_primary = make_primary
            dom.save(update_fields=['domain', 'is_primary'] if 'domain' in data else ['is_primary'])
        return Response({"detail": "updated"})

    dom.save(update_fields=['domain'])
    return Response({"detail": "updated"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_recycle_bin_schools(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    qs = School.objects.filter(is_deleted=True).prefetch_related('domains').order_by('-deleted_at', '-id')
    data = []
    for s in qs[:1000]:
        domains = list(s.domains.all().order_by('-is_primary', 'id').values('id', 'domain', 'is_primary', 'created_at'))
        primary = None
        for d in domains:
            if d.get('is_primary'):
                primary = d.get('domain')
                break
        data.append({
            'id': s.id,
            'name': s.name,
            'code': s.code,
            'is_active': getattr(s, 'is_active', True),
            'deleted_at': getattr(s, 'deleted_at', None),
            'deleted_by': getattr(getattr(s, 'deleted_by', None), 'username', None),
            'domains': domains,
            'primary_domain': primary,
        })
    return Response({'results': data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_recycle_bin_school_restore(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        school = School.objects.get(id=id)
    except School.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if not bool(getattr(school, 'is_deleted', False)):
        return Response({"detail": "Not in recycle bin"}, status=400)

    school.is_deleted = False
    school.deleted_at = None
    school.deleted_by = None
    try:
        school.is_active = True
    except Exception:
        pass
    school.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'is_active'])
    return Response({"detail": "restored"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def superadmin_recycle_bin_school_purge(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        school = School.objects.only('id', 'is_deleted').get(id=id)
    except School.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if not bool(getattr(school, 'is_deleted', False)):
        return Response({"detail": "Not in recycle bin"}, status=400)
    try:
        _purge_school_from_db(school_id=school.id)
        return Response(status=204)
    except Exception as e:
        return Response({"detail": "Failed to purge school", "error": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_recycle_bin_exams(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import Exam
    qs = Exam.objects.filter(is_deleted=True).select_related('klass', 'klass__school', 'klass__stream').order_by('-deleted_at', '-id')
    out = []
    for e in qs[:2000]:
        school = getattr(getattr(e, 'klass', None), 'school', None)
        out.append({
            'id': e.id,
            'school_id': getattr(school, 'id', None),
            'school_name': getattr(school, 'name', '') if school else '',
            'name': e.name,
            'year': e.year,
            'term': e.term,
            'date': e.date,
            'klass_id': getattr(e, 'klass_id', None),
            'klass_name': getattr(getattr(e, 'klass', None), 'name', '') if getattr(e, 'klass', None) else '',
            'published': bool(getattr(e, 'published', False)),
            'deleted_at': getattr(e, 'deleted_at', None),
            'deleted_by': getattr(getattr(e, 'deleted_by', None), 'username', None),
        })
    return Response({'results': out})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_recycle_bin_exam_restore(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import Exam
    try:
        exam = Exam.objects.get(id=id)
    except Exam.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if not bool(getattr(exam, 'is_deleted', False)):
        return Response({"detail": "Not in recycle bin"}, status=400)
    Exam.objects.filter(id=exam.id).update(is_deleted=False, deleted_at=None, deleted_by=None)
    return Response({"detail": "restored"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def superadmin_recycle_bin_exam_purge(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import Exam
    try:
        exam = Exam.objects.only('id', 'is_deleted').get(id=id)
    except Exam.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if not bool(getattr(exam, 'is_deleted', False)):
        return Response({"detail": "Not in recycle bin"}, status=400)
    exam.delete()
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_recycle_bin_academic_years(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import AcademicYear
    qs = AcademicYear.objects.filter(is_deleted=True).select_related('school').order_by('-deleted_at', '-id')
    out = []
    for ay in qs[:2000]:
        school = getattr(ay, 'school', None)
        out.append({
            'id': ay.id,
            'school_id': getattr(ay, 'school_id', None),
            'school_name': getattr(school, 'name', '') if school else '',
            'label': ay.label,
            'start_date': ay.start_date,
            'end_date': ay.end_date,
            'is_current': bool(getattr(ay, 'is_current', False)),
            'deleted_at': getattr(ay, 'deleted_at', None),
            'deleted_by': getattr(getattr(ay, 'deleted_by', None), 'username', None),
        })
    return Response({'results': out})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_recycle_bin_academic_year_restore(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import AcademicYear, Term
    try:
        ay = AcademicYear.objects.get(id=id)
    except AcademicYear.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if not bool(getattr(ay, 'is_deleted', False)):
        return Response({"detail": "Not in recycle bin"}, status=400)
    AcademicYear.objects.filter(id=ay.id).update(is_deleted=False, deleted_at=None, deleted_by=None)
    # Best-effort restore of terms under that year
    try:
        Term.objects.filter(academic_year_id=ay.id).update(is_deleted=False, deleted_at=None, deleted_by=None)
    except Exception:
        pass
    return Response({"detail": "restored"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def superadmin_recycle_bin_academic_year_purge(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import AcademicYear
    try:
        ay = AcademicYear.objects.only('id', 'is_deleted').get(id=id)
    except AcademicYear.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if not bool(getattr(ay, 'is_deleted', False)):
        return Response({"detail": "Not in recycle bin"}, status=400)
    ay.delete()
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_recycle_bin_terms(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import Term
    qs = Term.objects.filter(is_deleted=True).select_related('academic_year', 'academic_year__school').order_by('-deleted_at', '-id')
    out = []
    for t in qs[:2000]:
        ay = getattr(t, 'academic_year', None)
        school = getattr(ay, 'school', None) if ay else None
        out.append({
            'id': t.id,
            'school_id': getattr(school, 'id', None),
            'school_name': getattr(school, 'name', '') if school else '',
            'academic_year_id': getattr(t, 'academic_year_id', None),
            'academic_year_label': getattr(ay, 'label', '') if ay else '',
            'number': t.number,
            'name': t.name,
            'start_date': t.start_date,
            'end_date': t.end_date,
            'is_current': bool(getattr(t, 'is_current', False)),
            'deleted_at': getattr(t, 'deleted_at', None),
            'deleted_by': getattr(getattr(t, 'deleted_by', None), 'username', None),
        })
    return Response({'results': out})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_recycle_bin_term_restore(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import Term
    try:
        t = Term.objects.get(id=id)
    except Term.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if not bool(getattr(t, 'is_deleted', False)):
        return Response({"detail": "Not in recycle bin"}, status=400)
    Term.objects.filter(id=t.id).update(is_deleted=False, deleted_at=None, deleted_by=None)
    return Response({"detail": "restored"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def superadmin_recycle_bin_term_purge(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    from academics.models import Term
    try:
        t = Term.objects.only('id', 'is_deleted').get(id=id)
    except Term.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    if not bool(getattr(t, 'is_deleted', False)):
        return Response({"detail": "Not in recycle bin"}, status=400)
    t.delete()
    return Response(status=204)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_recycle_bin_clear(request):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    purged = 0
    failed = 0

    # Purge academics first (for non-deleted schools)
    try:
        from academics.models import Exam, AcademicYear, Term
        exam_ids = list(Exam.objects.filter(is_deleted=True).values_list('id', flat=True)[:1000])
        for eid in exam_ids:
            try:
                Exam.objects.filter(id=int(eid), is_deleted=True).delete()
                purged += 1
            except Exception:
                failed += 1

        term_ids = list(Term.objects.filter(is_deleted=True).values_list('id', flat=True)[:1000])
        for tid in term_ids:
            try:
                Term.objects.filter(id=int(tid), is_deleted=True).delete()
                purged += 1
            except Exception:
                failed += 1

        ay_ids = list(AcademicYear.objects.filter(is_deleted=True).values_list('id', flat=True)[:1000])
        for aid in ay_ids:
            try:
                AcademicYear.objects.filter(id=int(aid), is_deleted=True).delete()
                purged += 1
            except Exception:
                failed += 1
    except Exception:
        pass

    # Purge deleted schools last (cascades everything under them)
    school_ids = list(School.objects.filter(is_deleted=True).values_list('id', flat=True)[:500])
    for sid in school_ids:
        try:
            _purge_school_from_db(school_id=int(sid))
            purged += 1
        except Exception:
            failed += 1
    return Response({'purged': purged, 'failed': failed, 'attempted': (len(school_ids) or 0)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_create_school_admin(request):
    """Superuser-only: Create a School Admin and allocate to a school.
    Body: username (required), password (optional), email, first_name, last_name, phone, school_id (required)
    Returns the created user.
    """
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    data = request.data or {}
    username = data.get('username')
    school_id = data.get('school_id')
    if not username or not school_id:
        return Response({"detail": "username and school_id are required"}, status=400)
    password = data.get('password') or get_random_string(12)
    try:
        with transaction.atomic():
            # Validate school exists
            school = School.objects.filter(id=school_id, is_deleted=False).only('id').first()
            if not school:
                return Response({"detail": "School not found"}, status=404)
            user = User.objects.create_user(
                username=username,
                password=password,
                role='admin',
                email=data.get('email',''),
                first_name=data.get('first_name',''),
                last_name=data.get('last_name',''),
                phone=data.get('phone',''),
                school_id=school.id,
            )
    except IntegrityError as e:
        return Response({"detail": "Username already exists or violates a constraint", "error": str(e)}, status=400)
    return Response(UserSerializer(user, context={"request": request}).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def superadmin_assign_school_admin(request):
    """Superuser-only: Assign an existing user as School Admin to a school.
    Body: user_id (required), school_id (required)
    Sets role to 'admin' and assigns the school.
    """
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    uid = request.data.get('user_id')
    school_id = request.data.get('school_id')
    if not uid or not school_id:
        return Response({"detail": "user_id and school_id are required"}, status=400)
    user = User.objects.filter(id=uid).first()
    if not user:
        return Response({"detail": "User not found"}, status=404)
    school = School.objects.filter(id=school_id, is_deleted=False).only('id').first()
    if not school:
        return Response({"detail": "School not found"}, status=404)
    # Update
    user.role = 'admin'
    user.school_id = school.id
    user.save(update_fields=['role','school'])
    return Response(UserSerializer(user, context={"request": request}).data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def superadmin_school_integrations(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        school = School.objects.get(id=id)
    except School.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    obj, _ = SchoolIntegrationSettings.objects.get_or_create(school=school)

    if request.method == 'GET':
        return Response({
            'school_id': school.id,
            'smtp_host': obj.smtp_host,
            'smtp_port': obj.smtp_port,
            'smtp_username': obj.smtp_username,
            'smtp_use_tls': obj.smtp_use_tls,
            'smtp_use_ssl': obj.smtp_use_ssl,
            'smtp_from_email': obj.smtp_from_email,
            'smtp_password_set': bool(obj.smtp_password),
            'sms_provider': obj.sms_provider,
            'at_username': obj.at_username,
            'at_sender_id': obj.at_sender_id,
            'at_api_key_set': bool(obj.at_api_key),
            'updated_at': obj.updated_at,
        })

    data = request.data or {}
    update_fields = []
    for field in ('smtp_host', 'smtp_username', 'smtp_from_email', 'sms_provider', 'at_username', 'at_sender_id'):
        if field in data and data.get(field) is not None:
            setattr(obj, field, str(data.get(field) or ''))
            update_fields.append(field)
    if 'smtp_port' in data and data.get('smtp_port') is not None:
        try:
            obj.smtp_port = int(data.get('smtp_port'))
            update_fields.append('smtp_port')
        except Exception:
            return Response({"detail": "Invalid smtp_port"}, status=400)
    if 'smtp_use_tls' in data and data.get('smtp_use_tls') is not None:
        obj.smtp_use_tls = bool(data.get('smtp_use_tls'))
        update_fields.append('smtp_use_tls')
    if 'smtp_use_ssl' in data and data.get('smtp_use_ssl') is not None:
        obj.smtp_use_ssl = bool(data.get('smtp_use_ssl'))
        update_fields.append('smtp_use_ssl')
    if 'smtp_password' in data:
        raw = data.get('smtp_password')
        if raw is None:
            pass
        else:
            obj.smtp_password = str(raw)
            update_fields.append('smtp_password')
    if 'at_api_key' in data:
        raw = data.get('at_api_key')
        if raw is None:
            pass
        else:
            obj.at_api_key = str(raw)
            update_fields.append('at_api_key')

    if update_fields:
        obj.save(update_fields=list(set(update_fields)))
    return Response({"detail": "updated"})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def superadmin_school_payment_methods(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        school = School.objects.get(id=id)
    except School.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    from finance.models import PaymentMethod

    if not PaymentMethod.objects.filter(school=school).exists():
        for key in ['cash', 'mpesa', 'bank', 'cheque']:
            PaymentMethod.objects.get_or_create(school=school, key=key, defaults={'enabled': True})

    if request.method == 'GET':
        rows = list(PaymentMethod.objects.filter(school=school).order_by('key').values('id', 'key', 'enabled', 'updated_at'))
        return Response({'school_id': school.id, 'results': rows})

    data = request.data or {}
    methods = data.get('methods') if isinstance(data.get('methods'), dict) else None
    if methods is None:
        methods = {}
        for k in ['cash', 'mpesa', 'bank', 'cheque']:
            if k in data:
                methods[k] = data.get(k)
    if not isinstance(methods, dict) or not methods:
        return Response({"detail": "No methods provided"}, status=400)

    with transaction.atomic():
        for key, enabled in methods.items():
            k = str(key).strip().lower()
            if k not in ('cash', 'mpesa', 'bank', 'cheque'):
                continue
            PaymentMethod.objects.update_or_create(
                school=school,
                key=k,
                defaults={'enabled': bool(enabled)},
            )

    rows = list(PaymentMethod.objects.filter(school=school).order_by('key').values('id', 'key', 'enabled', 'updated_at'))
    return Response({'school_id': school.id, 'results': rows})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def superadmin_school_mpesa_config(request, id: int):
    denied = _require_superuser(request)
    if denied is not None:
        return denied

    try:
        school = School.objects.get(id=id)
    except School.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    from finance.models import MpesaConfig

    cfg = MpesaConfig.objects.filter(school=school).first()

    if request.method == 'GET':
        if not cfg:
            return Response({'school_id': school.id, 'exists': False})
        return Response({
            'school_id': school.id,
            'exists': True,
            'environment': cfg.environment,
            'short_code': cfg.short_code,
            'callback_url': cfg.callback_url,
            'consumer_key': cfg.consumer_key,
            'consumer_secret_set': bool(cfg.consumer_secret),
            'passkey_set': bool(cfg.passkey),
            'updated_at': cfg.updated_at,
        })

    data = request.data or {}
    fields = {}
    for k in ('consumer_key', 'short_code', 'callback_url', 'environment'):
        if k in data and data.get(k) is not None:
            fields[k] = str(data.get(k) or '')
    for k in ('consumer_secret', 'passkey'):
        if k in data:
            raw = data.get(k)
            if raw is None:
                continue
            fields[k] = str(raw)

    if not cfg:
        required = ['consumer_key', 'consumer_secret', 'short_code', 'passkey']
        if not all(fields.get(r) for r in required):
            return Response({"detail": "Missing required fields"}, status=400)
        cfg = MpesaConfig.objects.create(school=school, **fields)
    else:
        for k, v in fields.items():
            setattr(cfg, k, v)
        cfg.save()

    return Response({
        'school_id': school.id,
        'exists': True,
        'environment': cfg.environment,
        'short_code': cfg.short_code,
        'callback_url': cfg.callback_url,
        'consumer_key': cfg.consumer_key,
        'consumer_secret_set': bool(cfg.consumer_secret),
        'passkey_set': bool(cfg.passkey),
        'updated_at': cfg.updated_at,
    })
