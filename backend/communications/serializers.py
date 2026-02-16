from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Notification, Event, ArrearsMessageCampaign, Message, MessageRecipient, DeliveryLog, ServiceReview
from accounts.models import School
from academics.models import Student

User = get_user_model()

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id','user','message','type','date','read']

class EventSerializer(serializers.ModelSerializer):
    created_by_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'school', 'title', 'description', 'location', 'start', 'end', 'all_day',
            'audience', 'visibility', 'created_by', 'created_by_username', 'created_at', 'updated_at',
            'completed', 'completed_at', 'completed_by', 'completion_comment'
        ]
        read_only_fields = ['school', 'created_by', 'created_by_username', 'created_at', 'updated_at', 'completed_at', 'completed_by']

    def get_created_by_username(self, obj):
        return getattr(obj.created_by, 'username', None)

    def validate(self, attrs):
        start = attrs.get('start') or getattr(self.instance, 'start', None)
        end = attrs.get('end') or getattr(self.instance, 'end', None)
        if start and end and end < start:
            raise serializers.ValidationError({"end": "End must be after start."})
        return attrs

class ArrearsMessageCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArrearsMessageCampaign
        fields = [
            'id', 'school', 'message', 'klass', 'min_balance',
            'send_in_app', 'send_sms', 'send_email', 'email_subject',
            'status', 'started_at', 'finished_at', 'error_message',
            'sent_count', 'sms_sent', 'sms_failed', 'email_sent', 'email_failed',
            'created_by', 'created_at', 'cancel_requested'
        ]
        read_only_fields = ['school', 'status', 'started_at', 'finished_at', 'error_message', 'sent_count', 'sms_sent', 'sms_failed', 'email_sent', 'email_failed', 'created_by', 'created_at', 'cancel_requested']

    def validate_message(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Message cannot be empty')
        return value

class DeliveryLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryLog
        fields = ['id','school','channel','recipient','ok','message_snippet','error','context','created_at']
        read_only_fields = fields


class MessageRecipientSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = MessageRecipient
        fields = ['id', 'user', 'username', 'read', 'read_at']
        read_only_fields = ['username', 'read_at']

    def get_username(self, obj):
        return getattr(obj.user, 'username', None)


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.SerializerMethodField(read_only=True)
    recipients = MessageRecipientSerializer(many=True, read_only=True)
    # For creation convenience
    recipient_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)
    send_sms = serializers.BooleanField(required=False)
    send_email = serializers.BooleanField(required=False)

    class Meta:
        model = Message
        fields = [
            'id', 'school', 'sender', 'sender_username', 'body', 'created_at',
            'audience', 'recipient_role', 'reply_to', 'recipients', 'recipient_ids',
            'system_tag', 'is_broadcast', 'send_sms', 'send_email'
        ]
        read_only_fields = ['school', 'sender', 'sender_username', 'created_at', 'recipients', 'system_tag', 'is_broadcast']

    def get_sender_username(self, obj):
        return getattr(obj.sender, 'username', None)

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentication required')

        audience = attrs.get('audience') or getattr(self.instance, 'audience', None)
        recipient_role = attrs.get('recipient_role')
        recipient_ids = self.initial_data.get('recipient_ids', [])
        reply_to = attrs.get('reply_to')

        # Validate reply_to belongs to same school
        if reply_to and getattr(user, 'school_id', None) and reply_to.school_id != user.school_id:
            raise serializers.ValidationError({'reply_to': 'Reply must be within your school'})

        # Role-based send permissions
        role = getattr(user, 'role', None)
        allowed = False
        if role == 'admin':
            allowed = True
        elif role == 'teacher':
            # Teacher can message admin only (role or specific users who are admins)
            if audience == Message.Audience.ROLE and recipient_role == 'admin':
                allowed = True
            elif audience == Message.Audience.USERS and recipient_ids:
                # Will be re-checked on create
                allowed = True
        elif role == 'finance':
            # Finance can message admin, teachers, and students
            if audience == Message.Audience.ROLE and recipient_role in ('admin','teacher','student'):
                allowed = True
            elif audience == Message.Audience.USERS and recipient_ids:
                allowed = True
        elif role == 'student':
            # Students can message admin and finance
            if audience == Message.Audience.ROLE and recipient_role in ('admin','finance'):
                allowed = True
            elif audience == Message.Audience.USERS and recipient_ids:
                allowed = True

        # Prevent non-admins from broadcasting to all
        if audience == Message.Audience.ALL:
            allowed = (role == 'admin')

        if not allowed:
            raise serializers.ValidationError({'audience': 'Not allowed for your role'})

        # Additional required fields
        if audience == Message.Audience.ROLE and not recipient_role:
            raise serializers.ValidationError({'recipient_role': 'recipient_role is required for role audience'})
        if audience == Message.Audience.USERS and not recipient_ids:
            raise serializers.ValidationError({'recipient_ids': 'Provide at least one recipient id'})

        # Basic body check
        body = attrs.get('body') or self.initial_data.get('body')
        if not body or not str(body).strip():
            raise serializers.ValidationError({'body': 'Message body cannot be empty'})

        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        school = getattr(user, 'school', None)
        audience = validated_data.get('audience')
        recipient_role = validated_data.get('recipient_role')
        reply_to = validated_data.get('reply_to')

        send_sms = self.initial_data.get('send_sms', True)
        send_email = self.initial_data.get('send_email', True)

        # Enforce rule: Students messaging Finance or Teachers only get Email forwarding, no SMS.
        if user.role == 'student':
            if audience == Message.Audience.ROLE and recipient_role in ('finance', 'teacher'):
                send_sms = False
            elif audience == Message.Audience.USERS:
                # If any recipient is a teacher or finance, we'll be conservative and disable SMS for the whole message
                # or we could filter later, but disabling at message level is safer for this rule.
                try:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    has_staff_recipient = User.objects.filter(id__in=recipient_ids, role__in=['teacher', 'finance']).exists()
                    if has_staff_recipient:
                        send_sms = False
                except Exception:
                    pass

        try:
            send_sms = bool(send_sms)
        except Exception:
            send_sms = True
        try:
            send_email = bool(send_email)
        except Exception:
            send_email = True

        # Pop non-model fields
        recipient_ids = self.initial_data.get('recipient_ids', [])

        msg = Message.objects.create(
            school=school,
            sender=user,
            body=validated_data['body'],
            audience=audience,
            recipient_role=recipient_role,
            reply_to=reply_to if reply_to else None,
            send_sms=send_sms,
            send_email=send_email,
        )

        if audience == Message.Audience.ALL:
            try:
                msg.system_tag = 'Alert'
                msg.is_broadcast = True
                msg.save(update_fields=['system_tag', 'is_broadcast'])
            except Exception:
                pass

        # Resolve recipients according to audience with role constraints
        recipients_qs = User.objects.none()
        if audience == Message.Audience.ALL:
            recipients_qs = User.objects.filter(school_id=school.id)
        elif audience == Message.Audience.ROLE:
            recipients_qs = User.objects.filter(school_id=school.id, role=recipient_role)
        elif audience == Message.Audience.USERS:
            recipients_qs = User.objects.filter(id__in=recipient_ids, school_id=school.id)

        # Enforce role-based constraints on USERS audience by filtering only allowed targets
        role = getattr(user, 'role', None)
        if role == 'teacher':
            # Teachers can always message admins directly.
            admin_q = Q(role='admin')
            # Additionally, allow class teachers to message students in their own classes.
            try:
                allowed_student_ids = list(
                    Student.objects.filter(
                        klass__teacher_id=user.id,
                        is_active=True,
                        user__isnull=False,
                    ).values_list('user_id', flat=True)
                )
            except Exception:
                allowed_student_ids = []
            student_q = Q(role='student', id__in=allowed_student_ids) if allowed_student_ids else Q(pk__in=[])
            recipients_qs = recipients_qs.filter(admin_q | student_q)
        elif role == 'finance':
            recipients_qs = recipients_qs.filter(role__in=['admin','teacher','student'])
        elif role == 'student':
            recipients_qs = recipients_qs.filter(role__in=['admin','finance'])

        recipients = [MessageRecipient(message=msg, user=r) for r in recipients_qs]
        if recipients:
            MessageRecipient.objects.bulk_create(recipients, ignore_conflicts=True)

        return msg


class ServiceReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceReview
        fields = ['id','school','user','name','email','rating','comment','page_url','created_at']
        read_only_fields = ['id','school','user','created_at']

    def validate_rating(self, value):
        if value is None:
            raise serializers.ValidationError('rating is required')
        try:
            v = int(value)
        except Exception:
            raise serializers.ValidationError('rating must be an integer from 1 to 5')
        if v < 1 or v > 5:
            raise serializers.ValidationError('rating must be between 1 and 5')
        return v

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        school = getattr(user, 'school', None)
        return ServiceReview.objects.create(
            school=school,
            user=user if getattr(user, 'is_authenticated', False) else None,
            **validated_data
        )
