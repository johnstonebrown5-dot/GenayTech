from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from django.utils.dateparse import parse_datetime
from django.db.models import Q
from django.db.models import Sum, F, Value, DecimalField
from django.db.models.functions import Coalesce
from .models import Notification, Event, DeliveryLog
from .serializers import NotificationSerializer, EventSerializer, ArrearsMessageCampaignSerializer, MessageSerializer, DeliveryLogSerializer, ServiceReviewSerializer
from .models import ArrearsMessageCampaign, Message, MessageRecipient
from .serializers import MessageSerializer
from academics.models import Student
from .utils import render_template, send_sms, send_email_safe, process_arrears_campaign, queue_message_delivery, deliver_message_collect, log_delivery
import threading
from django.utils import timezone
from django.conf import settings
import logging
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os, time


class PublicAlertBannerView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser, FormParser]

    def get(self, request):
        code = str(request.query_params.get('code') or '').strip()
        school = None
        if code:
            try:
                from accounts.models import School
                school = School.objects.filter(code=code).first()
            except Exception:
                school = None
        if not school:
            school = getattr(request, 'school', None)

        if not school:
            try:
                if getattr(request, 'user', None) is not None and request.user.is_authenticated:
                    school = getattr(request.user, 'school', None)
            except Exception:
                school = None

        if not school:
            return Response({'id': None, 'message': '', 'created_at': None}, status=status.HTTP_200_OK)

        try:
            msg = (
                Message.objects
                .filter(school_id=getattr(school, 'id', None), system_tag__iexact='alert', is_broadcast=True)
                .order_by('-created_at', '-id')
                .first()
            )
        except Exception:
            msg = None

        if not msg:
            return Response({'id': None, 'message': '', 'created_at': None}, status=status.HTTP_200_OK)

        return Response({'id': msg.id, 'message': msg.body or '', 'created_at': msg.created_at}, status=status.HTTP_200_OK)

class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # user sees own notifications
        qs = super().get_queryset()
        return qs.filter(user=self.request.user)

class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Event.objects.all()
        # Restrict to user's school
        if getattr(user, 'school_id', None):
            qs = qs.filter(school_id=user.school_id)
        else:
            # No school assigned -> empty set
            qs = qs.none()

        # Optional filtering by date overlap
        start_param = self.request.query_params.get('start')
        end_param = self.request.query_params.get('end')
        start_dt = parse_datetime(start_param) if start_param else None
        end_dt = parse_datetime(end_param) if end_param else None
        if start_dt and end_dt:
            # events that overlap [start_dt, end_dt]
            qs = qs.filter(~(Q(end__lt=start_dt) | Q(start__gt=end_dt)))
        elif start_dt:
            qs = qs.filter(end__gte=start_dt)
        elif end_dt:
            qs = qs.filter(start__lte=end_dt)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(school=getattr(user, 'school', None), created_by=user)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark/unmark an event as completed and optionally attach a comment."""
        instance = self.get_object()
        completed = request.data.get('completed', True)
        try:
            completed = bool(int(completed)) if isinstance(completed, str) and completed.isdigit() else bool(completed)
        except Exception:
            completed = bool(completed)
        comment = request.data.get('comment', None)

        if completed:
            instance.completed = True
            instance.completed_at = timezone.now()
            instance.completed_by = request.user
            if comment is not None:
                instance.completion_comment = str(comment)
        else:
            instance.completed = False
            instance.completed_at = None
            instance.completed_by = None
            if comment is not None:
                instance.completion_comment = str(comment)

        instance.save()
        data = self.get_serializer(instance).data
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='update-fields')
    def update_fields(self, request, pk=None):
        """Convenience partial-update endpoint that ignores non-editable fields."""
        instance = self.get_object()
        data = request.data.copy()
        # Protect non-editable fields via this action
        for k in ['school', 'created_by', 'created_at', 'updated_at', 'id']:
            data.pop(k, None)
        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class IsAdminOrFinance(permissions.BasePermission):
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', None)
        return bool(request.user and request.user.is_authenticated and role in ('admin','finance'))


class DeliveryLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DeliveryLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrFinance]

    def get_queryset(self):
        user = self.request.user
        qs = DeliveryLog.objects.all()
        # Scope to user's school
        if getattr(user, 'school_id', None):
            qs = qs.filter(school_id=user.school_id)
        else:
            qs = qs.none()
        # Optional channel filter
        ch = self.request.query_params.get('channel')
        if ch in ('sms','email'):
            qs = qs.filter(channel=ch)
        return qs.order_by('-created_at','id')

    @action(detail=False, methods=['get'])
    def recent(self, request):
        try:
            limit_param = request.query_params.get('limit')
            limit = int(limit_param) if (limit_param and str(limit_param).isdigit()) else 50
            limit = max(1, min(limit, 200))
        except Exception:
            limit = 50
        qs = self.get_queryset()[:limit]
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=False, methods=["post"])
    def retry(self, request):
        """Retry delivery for one or more DeliveryLog records.
        Body: {id: <int>} or {ids: [<int>, ...]}
        Resends using the stored recipient and message_snippet via the same channel.
        Creates a new DeliveryLog entry with context 'retry_of:<id>'.
        """
        user = request.user
        school_id = getattr(user, 'school_id', None)
        if not school_id:
            return Response({"detail": "No school"}, status=status.HTTP_400_BAD_REQUEST)

        ids = request.data.get('ids') or request.data.get('id')
        if ids is None:
            return Response({"detail": "id or ids required"}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(ids, (list, tuple)):
            ids = [ids]
        # Coerce to ints safely
        cleaned = []
        for x in ids:
            try:
                cleaned.append(int(x))
            except Exception:
                continue
        if not cleaned:
            return Response({"detail": "No valid ids"}, status=status.HTTP_400_BAD_REQUEST)

        logs = DeliveryLog.objects.filter(id__in=cleaned, school_id=school_id)
        results = []
        for rec in logs:
            ok = False
            try:
                if rec.channel == 'sms':
                    ok = send_sms(rec.recipient, rec.message_snippet or '', school_id=getattr(rec, 'school_id', None) or school_id)
                elif rec.channel == 'email':
                    subj = "Delivery retry"
                    ok = send_email_safe(subj, rec.message_snippet or '', rec.recipient, school_id=getattr(rec, 'school_id', None) or school_id)
            except Exception:
                ok = False
            try:
                ctx = (f"retry_of:{rec.id};" + (rec.context or ''))[:100]
                log_delivery(school_id=rec.school_id, channel=rec.channel, recipient=rec.recipient, ok=bool(ok), message=rec.message_snippet or '', context=ctx)
            except Exception:
                pass
            results.append({"id": rec.id, "ok": bool(ok), "channel": rec.channel, "recipient": rec.recipient})
        return Response({"results": results})

    @action(detail=False, methods=["post"], url_path="reset")
    def reset(self, request):
        """Delete all DeliveryLog rows for the current user's school.
        This effectively resets the dashboard counters to 0.
        """
        user = request.user
        school_id = getattr(user, 'school_id', None)
        if not school_id:
            return Response({"detail": "No school"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            deleted_count, _ = DeliveryLog.objects.filter(school_id=school_id).delete()
        except Exception:
            return Response({"detail": "Reset failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({"deleted": deleted_count})


class ArrearsMessageCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = ArrearsMessageCampaignSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrFinance]

    def get_queryset(self):
        user = self.request.user
        qs = ArrearsMessageCampaign.objects.all()
        # Scope to user's school
        if getattr(user, 'school_id', None):
            qs = qs.filter(school_id=user.school_id)
        else:
            qs = qs.none()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(school=getattr(user, 'school', None), created_by=user)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        campaign = self.get_object()
        # Mark queued/running and spawn background thread
        if campaign.status in [ArrearsMessageCampaign.Status.RUNNING]:
            return Response({'detail': 'Campaign already running.'}, status=status.HTTP_409_CONFLICT)
        campaign.status = ArrearsMessageCampaign.Status.QUEUED
        campaign.started_at = timezone.now()
        campaign.sent_count = 0
        campaign.error_message = ''
        campaign.save(update_fields=['status','started_at','sent_count','error_message'])

        t = threading.Thread(target=process_arrears_campaign, args=(campaign.id,), daemon=True)
        t.start()

        return Response({'status': 'queued', 'id': campaign.id}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        campaign = self.get_object()
        data = ArrearsMessageCampaignSerializer(campaign).data
        return Response(data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        camp = self.get_object()
        # Only same-school admin/finance allowed (enforced by IsAdminOrFinance and queryset scoping)
        if camp.status not in [ArrearsMessageCampaign.Status.QUEUED, ArrearsMessageCampaign.Status.RUNNING]:
            return Response({'detail': 'Campaign not active'}, status=status.HTTP_409_CONFLICT)
        camp.cancel_requested = True
        camp.status = ArrearsMessageCampaign.Status.CANCELED
        camp.finished_at = timezone.now()
        camp.save(update_fields=['cancel_requested', 'status', 'finished_at'])
        return Response({'status': 'canceled'})

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        camp = self.get_object()
        if camp.status != ArrearsMessageCampaign.Status.CANCELED:
            return Response({'detail': 'Campaign not canceled'}, status=status.HTTP_409_CONFLICT)
        camp.cancel_requested = False
        camp.status = ArrearsMessageCampaign.Status.QUEUED
        camp.started_at = timezone.now()
        camp.sent_count = 0
        camp.error_message = ''
        camp.save(update_fields=['cancel_requested','status','started_at','sent_count','error_message'])
        t = threading.Thread(target=process_arrears_campaign, args=(camp.id,), daemon=True)
        t.start()
        return Response({'status': 'queued'})

    @action(detail=False, methods=['get'], url_path='latest-progress')
    def latest_progress(self, request):
        """Return progress for the latest queued/running campaign for current user's school.
        Uses DeliveryLog entries to count processed per channel and computes expected_total
        from the students queryset and selected channels.
        """
        user = request.user
        school_id = getattr(user, 'school_id', None)
        if not school_id:
            return Response({'detail': 'No school'}, status=status.HTTP_400_BAD_REQUEST)
        camp = (
            ArrearsMessageCampaign.objects
            .filter(school_id=school_id, status__in=[ArrearsMessageCampaign.Status.QUEUED, ArrearsMessageCampaign.Status.RUNNING])
            .order_by('-created_at')
            .first()
        )
        if not camp:
            return Response({'detail': 'no_active_campaign'}, status=status.HTTP_404_NOT_FOUND)

        # Compute expected_total = number_of_students * number_of_channels_selected (sms/email)
        try:
            from academics.models import Student
            from django.db.models import Sum, F, Value, DecimalField, OuterRef, Subquery
            from django.db.models.functions import Coalesce
            from finance.models import Invoice, Payment
            students = Student.objects.filter(klass__school_id=camp.school_id, is_active=True)
            if getattr(camp, 'klass_id', None):
                students = students.filter(klass_id=camp.klass_id)
            billed_sq = (
                Invoice.objects
                .filter(student_id=OuterRef('pk'))
                .values('student_id')
                .annotate(s=Sum('amount'))
                .values('s')[:1]
            )
            paid_sq = (
                Payment.objects
                .filter(invoice__student_id=OuterRef('pk'))
                .values('invoice__student_id')
                .annotate(s=Sum('amount'))
                .values('s')[:1]
            )
            students = students.annotate(
                billed=Coalesce(Subquery(billed_sq), Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))),
                paid=Coalesce(Subquery(paid_sq), Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))),
            ).annotate(balance=F('billed') - F('paid'))
            try:
                threshold = float(getattr(camp, 'min_balance', 0) or 0)
            except Exception:
                threshold = 0.0
            if threshold < 0:
                threshold = 0.0
            students = students.filter(balance__gt=threshold)
            n_students = students.count()
        except Exception:
            n_students = 0

        channels = (1 if camp.send_sms else 0) + (1 if camp.send_email else 0)
        expected_total = n_students * channels

        # Processed counts via DeliveryLog context
        dl = DeliveryLog.objects.filter(school_id=school_id, context__contains=f"campaign:{camp.id}")
        sms_sent = dl.filter(channel='sms', ok=True).count()
        sms_failed = dl.filter(channel='sms', ok=False).count()
        email_sent = dl.filter(channel='email', ok=True).count()
        email_failed = dl.filter(channel='email', ok=False).count()
        processed_total = sms_sent + sms_failed + email_sent + email_failed
        percent = int((processed_total / expected_total) * 100) if expected_total > 0 else 0

        return Response({
            'campaign': camp.id,
            'status': camp.status,
            'expected_total': expected_total,
            'processed_total': processed_total,
            'percent': percent,
            'sms': {'sent': sms_sent, 'failed': sms_failed},
            'email': {'sent': email_sent, 'failed': email_failed},
        })


class MessageViewSet(viewsets.ModelViewSet):
    """Inbox-focused messages. Default list() returns current user's inbox.
    Additional actions:
     - outbox: list messages sent by current user
     - mark-read: mark a message as read for current user
    Create enforces role-based targeting rules (also in serializer).
    """
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Inbox: messages where user is a recipient
        return Message.objects.filter(
            recipients__user_id=user.id
        ).select_related('sender').prefetch_related('recipients').order_by('-created_at', 'id')

    def perform_create(self, serializer):
        # serializer handles school, sender, recipients
        msg = serializer.save()
        # Queue async delivery to email/SMS
        if getattr(settings, 'MESSAGES_QUEUE_DELIVERY', True):
            try:
                queue_message_delivery(msg.id)
            except Exception:
                pass

    @action(detail=True, methods=['post'], url_path='send-now')
    def send_now(self, request, pk=None):
        """Synchronously deliver the message (email/SMS) and return aggregated results.
        In-app is considered 'created' if `MessageRecipient` rows exist.
        """
        try:
            # Ensure the current user is the sender or admin of same school
            msg = Message.objects.select_related('school', 'sender').get(pk=pk)
            user = request.user
            if getattr(user, 'role', '') != 'admin' and getattr(msg, 'sender_id', None) != getattr(user, 'id', None):
                return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        except Message.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        results = deliver_message_collect(msg.id)
        return Response(results, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='system')
    def system(self, request):
        """Return system-tagged messages for the current user's inbox (system_tag not null)."""
        user = request.user
        qs = Message.objects.filter(
            recipients__user_id=user.id,
            system_tag__isnull=False,
        ).select_related('sender').prefetch_related('recipients').order_by('-created_at','id')
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=False, methods=['get'])
    def outbox(self, request):
        user = request.user
        qs = Message.objects.filter(sender_id=user.id).select_related('sender').prefetch_related('recipients').order_by('-created_at', 'id')
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        user = request.user
        try:
            mr = MessageRecipient.objects.get(message_id=pk, user_id=user.id)
        except MessageRecipient.DoesNotExist:
            return Response({'detail': 'Not a recipient'}, status=status.HTTP_404_NOT_FOUND)
        if not mr.read:
            mr.read = True
            mr.read_at = timezone.now()
            mr.save(update_fields=['read', 'read_at'])
        return Response({'detail': 'ok'})


# Africa's Talking SMS delivery/inbound callback handler
logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class ATSMSCallbackView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Simple health-check endpoint if AT probes with GET
        return Response({'detail': 'ok'}, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            # AT typically posts form-encoded data; DRF parses into request.data
            payload = dict(request.data)
            # Flatten single-value lists that may come from QueryDict
            for k, v in list(payload.items()):
                if isinstance(v, list) and len(v) == 1:
                    payload[k] = v[0]
            logger.info("AT SMS callback: %s", payload)
        except Exception:
            logger.exception("Failed to process AT SMS callback")
        # Always return 204 quickly to prevent AT retries
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_exempt, name='dispatch')
class ContactInquiryView(APIView):
    """Public endpoint to send inquiries to the EduTrack team email.
    Accepts JSON or form data with fields: name, sender, message, channel, origin.
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser, FormParser]

    def post(self, request):
        try:
            name = str(request.data.get('name', '')).strip()
            sender = str(request.data.get('sender', '')).strip()
            message = str(request.data.get('message', '')).strip()
            channel = str(request.data.get('channel', '')).strip() or 'email'
            origin = str(request.data.get('origin', '')).strip() or request.META.get('HTTP_REFERER', '')

            subject = f"EduTrack Inquiry via Landing Page"
            lines = [
                f"Name: {name}",
                f"From: {sender}",
                f"Channel: {channel}",
                f"Origin: {origin}",
                "",
                message or "(No message provided)",
            ]
            body = "\n".join(lines)

            # Send to support mailbox
            send_email_safe(subject, body, "edutrack46@gmail.com", school_id=None)
            return Response({"detail": "sent"}, status=status.HTTP_200_OK)
        except Exception:
            logger.exception("Failed to send contact inquiry email")
            return Response({"detail": "failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class ReportIssueView(APIView):
    """Public endpoint to report an issue to developers.
    Accepts JSON or multipart with fields: title, description, severity, page_url, screenshot (file) or screenshot_url.
    If the user is authenticated, their identity is included; otherwise marked as Guest.
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        try:
            user = getattr(request, 'user', None)
            title = str(request.data.get('title', '')).strip() or 'Issue Report'
            description = str(request.data.get('description', '')).strip()
            severity = str(request.data.get('severity', '')).strip() or 'normal'
            page_url = str(request.data.get('page_url', '')).strip() or request.META.get('HTTP_REFERER', '')
            screenshot_url = str(request.data.get('screenshot_url', '')).strip()

            # Optional file upload
            uploaded_url = ''
            f = request.FILES.get('screenshot') or request.FILES.get('file')
            if f:
                ts = int(time.time())
                name = f"issues/{ts}_{os.path.basename(f.name)}"
                try:
                    path = default_storage.save(name, ContentFile(f.read()))
                    try:
                        uploaded_url = default_storage.url(path)
                    except Exception:
                        uploaded_url = f"/{path.lstrip('/')}"
                    if not (uploaded_url.startswith('http://') or uploaded_url.startswith('https://')):
                        uploaded_url = request.build_absolute_uri(uploaded_url)
                except Exception:
                    uploaded_url = ''

            who = ''
            try:
                if getattr(user, 'is_authenticated', False):
                    who = f"{getattr(user, 'username', '')} (id={getattr(user,'id','')}, role={getattr(user,'role','')})"
                else:
                    # Try accept name/email from request for guests
                    guest_name = str(request.data.get('name', '')).strip()
                    guest_email = str(request.data.get('email', '')).strip()
                    who = guest_name or 'Guest'
                    if guest_email:
                        who += f" <{guest_email}>"
            except Exception:
                pass
            school_id = getattr(getattr(user, 'school', None), 'id', None) or getattr(user, 'school_id', None)
            origin = request.META.get('HTTP_ORIGIN', '') or request.META.get('HTTP_HOST', '')

            lines = [
                f"Title: {title}",
                f"Severity: {severity}",
                f"From User: {who}",
                f"School ID: {school_id}",
                f"Page URL: {page_url}",
                f"Origin: {origin}",
                "",
                description or "(No description provided)",
            ]
            if uploaded_url:
                lines += ["", f"Screenshot: {uploaded_url}"]
            elif screenshot_url:
                lines += ["", f"Screenshot: {screenshot_url}"]

            body = "\n".join(lines)
            subject = f"Issue Report: {title}"

            # Send to developer/support mailbox
            to_addr = getattr(settings, 'SUPPORT_EMAIL', 'edutrack46@gmail.com')
            ok = False
            try:
                # Prefer replies to go directly to the reporting user (or provided guest email)
                user_email = str(getattr(user, 'email', '') or request.data.get('email') or '').strip()
                display_name = (str(getattr(user, 'first_name', '') or '').strip() or getattr(user, 'username', '') or str(request.data.get('name') or 'User'))
                reply_list = [user_email] if user_email else None
                ok = send_email_safe(subject, body, to_addr, reply_to=reply_list, from_name=display_name, school_id=school_id)
            except Exception:
                ok = False
            if not ok:
                return Response({"detail": "email_failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({"detail": "sent"}, status=status.HTTP_200_OK)
        except Exception:
            logger.exception("Failed to submit issue report")
            return Response({"detail": "failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class UploadAdmissionLetterView(APIView):
    """Public endpoint to upload an admission letter PDF (multipart/form-data, field name 'file').
    Returns: {url: <absolute_url>}"""
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get('file')
        if not f:
            return Response({"detail": "file is required"}, status=400)
        # simple validation
        if not str(f.name).lower().endswith(('.pdf', '.png', '.jpg', '.jpeg')):
            return Response({"detail": "Only PDF or image files are allowed"}, status=400)
        ts = int(time.time())
        name = f"admissions/{ts}_{os.path.basename(f.name)}"
        try:
            path = default_storage.save(name, ContentFile(f.read()))
            try:
                url = default_storage.url(path)
            except Exception:
                url = f"/{path.lstrip('/')}"
            if not (url.startswith('http://') or url.startswith('https://')):
                url = request.build_absolute_uri(url)
            return Response({"url": url})
        except Exception:
            logger.exception("Failed to upload admission letter")
            return Response({"detail": "upload_failed"}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class ServiceReviewView(APIView):
    """Public endpoint for posting a service review (rating 1-5, optional comment, name/email).
    Authenticated user and school are attached automatically if available.
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser, FormParser]

    def post(self, request):
        data = request.data.copy()
        # Normalize field names
        if 'pageUrl' in data and 'page_url' not in data:
            data['page_url'] = data.get('pageUrl')
        serializer = ServiceReviewSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            obj = serializer.save()
            return Response({"detail": "ok", "id": obj.id}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
