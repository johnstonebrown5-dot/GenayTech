from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Notification, Event, ArrearsMessageCampaign, Message, MessageRecipient, DeliveryLog
from accounts.models import School

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
        fields = ['id','school','channel','recipient','ok','message_snippet','context','created_at']
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

    class Meta:
        model = Message
        fields = [
            'id', 'school', 'sender', 'sender_username', 'body', 'created_at',
            'audience', 'recipient_role', 'reply_to', 'recipients', 'recipient_ids',
            'system_tag', 'is_broadcast'
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

        # Pop non-model fields
        recipient_ids = self.initial_data.get('recipient_ids', [])

        msg = Message.objects.create(
            school=school,
            sender=user,
            body=validated_data['body'],
            audience=audience,
            recipient_role=recipient_role,
            reply_to=reply_to if reply_to else None,
        )

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
            recipients_qs = recipients_qs.filter(role='admin')
        elif role == 'finance':
            recipients_qs = recipients_qs.filter(role__in=['admin','teacher','student'])
        elif role == 'student':
            recipients_qs = recipients_qs.filter(role__in=['admin','finance'])

        recipients = [MessageRecipient(message=msg, user=r) for r in recipients_qs]
        if recipients:
            MessageRecipient.objects.bulk_create(recipients, ignore_conflicts=True)

        return msg
