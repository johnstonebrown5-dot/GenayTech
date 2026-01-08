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
from django.db import IntegrityError
from django.db.models import Q
from django.utils.text import slugify
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from .models import School, EmailVerificationToken, NonTeachingStaff, PasswordResetCode
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
from datetime import timedelta
import secrets
from django.utils import timezone
from academics.models import Class as Klass
from academics.models import Student
from django.db.models import Q
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import requests

User = get_user_model()

@api_view(["GET","PATCH"]) 
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me(request):
    """Get or update the authenticated user's profile.
    PATCH accepts: first_name, last_name, email, phone and an optional avatar file under
    any of the keys: 'profile_picture', 'avatar', or 'photo'.
    """
    user = request.user
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
    data = request.data
    username = data.get('username')
    password = data.get('password') or User.objects.make_random_password()
    role = data.get('role')
    if not username or not role:
        return Response({"detail": "username and role are required"}, status=400)
    school_id = data.get('school') or getattr(request.user.school, 'id', None)
    try:
        user = User.objects.create_user(
            username=username,
            password=password,
            role=role,
            email=data.get('email',''),
            first_name=data.get('first_name',''),
            last_name=data.get('last_name',''),
            phone=data.get('phone',''),
            school_id=school_id,
        )
    except IntegrityError as e:
        # Most likely a duplicate username or school constraint
        return Response({"detail": "Username already exists or violates a constraint", "error": str(e)}, status=400)
    return Response(UserSerializer(user, context={"request": request}).data, status=201)


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
        f"Hello {user.first_name or user.username},\n\n"
        f"Your EduTrack password reset code is: {code}.\n"
        "This code will expire in 15 minutes. If you did not request this, you can ignore this email.\n\n"
        "Thanks,\nEduTrack"
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'no-reply@edutrack.local',
            recipient_list=[raw_email],
            fail_silently=True,
        )
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
        # Prefer school with id=1, else fallback to oldest
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
def school_public(request):
    """Public read-only school info for the landing page.
    Optional query params:
      - code: school.code to select a specific school
    Returns the first available school if not provided/found.
    """
    code = (request.query_params.get('code') or '').strip()
    school = None
    if code:
        school = School.objects.filter(code=code).first()
    if not school:
        # Prefer school with id=1, else fallback to oldest
        school = School.objects.filter(id=1).first() or School.objects.order_by('id').first()
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


# Public endpoint: create a trial school + admin
@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def trial_signup(request):
    """
    Create a trial School and an Admin user.
    Body: {school_name, admin_email, admin_password, admin_first_name, admin_last_name, phone}
    Returns: {access, refresh, user, school}
    """
    data = request.data or {}
    school_name = (data.get('school_name') or '').strip()
    admin_email = (data.get('admin_email') or '').strip().lower()
    admin_password = data.get('admin_password') or ''
    admin_first_name = (data.get('admin_first_name') or '').strip()
    admin_last_name = (data.get('admin_last_name') or '').strip()
    phone = (data.get('phone') or '').strip()
    honeypot = (data.get('website') or '').strip()

    if not school_name or not admin_email or not admin_password:
        return Response({"detail": "school_name, admin_email and admin_password are required"}, status=400)

    # Honeypot: reject bots that fill hidden field
    if honeypot:
        return Response({"detail": "Invalid submission"}, status=400)

    # Simple IP rate limiting: max 5 attempts per hour per IP
    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
    cache_key = f"trial_signup:{ip}"
    attempts = cache.get(cache_key, 0)
    if attempts and int(attempts) >= 5:
        return Response({"detail": "Rate limit exceeded. Please try again later."}, status=429)
    cache.set(cache_key, int(attempts) + 1, 60 * 60)

    # Generate a unique school code
    base_code = slugify(school_name)[:30] or 'school'
    code = base_code
    i = 1
    while School.objects.filter(code=code).exists():
        code = f"{base_code}-{i}"
        i += 1

    # Create school
    # Create school with trial flags
    school = School.objects.create(
        name=school_name,
        code=code,
        is_trial=True,
        trial_expires_at=timezone.now() + timedelta(days=14),
        trial_student_limit=100,
        feature_flags={"pos": False, "sms": False},
    )

    # Create admin user
    username = admin_email
    if User.objects.filter(username=username).exists():
        return Response({"detail": "A user with this email already exists"}, status=400)

    user = User.objects.create_user(
        username=username,
        email=admin_email,
        password=admin_password,
        role='admin',
        first_name=admin_first_name,
        last_name=admin_last_name,
        phone=phone,
        school=school,
    )

    # Issue auth tokens
    refresh = RefreshToken.for_user(user)
    payload = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user, context={"request": request}).data,
        "school": SchoolSerializer(school, context={"request": request}).data,
    }
    # Create verification token
    token = secrets.token_urlsafe(48)
    EmailVerificationToken.objects.create(
        user=user,
        token=token,
        expires_at=timezone.now() + timedelta(days=3),
    )
    verify_url = request.build_absolute_uri(f"/api/auth/verify-email/?token={token}")
    # Send welcome email (best-effort)
    try:
        send_mail(
            subject="Welcome to EduTrack — Your 14‑day trial",
            message=(
                f"Hi {admin_first_name or 'there'},\n\n"
                f"Your trial school '{school.name}' has been created. You can sign in with {admin_email}.\n\n"
                f"Trial ends on {school.trial_expires_at.date() if school.trial_expires_at else ''}.\n\n"
                "Please verify your email by opening this link: " + verify_url + "\n\n"
                "Thanks for trying EduTrack!"
            ),
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'no-reply@edutrack.local',
            recipient_list=[admin_email],
            fail_silently=True,
        )
    except Exception:
        pass

    return Response(payload, status=201)


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
    user.save(update_fields=['email_verified'])
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
