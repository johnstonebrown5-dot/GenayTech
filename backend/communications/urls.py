from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import NotificationViewSet, EventViewSet, ArrearsMessageCampaignViewSet, MessageViewSet, ATSMSCallbackView, TextWaveSMSCallbackView, ContactInquiryView, UploadAdmissionLetterView, DeliveryLogViewSet, ReportIssueView, ServiceReviewView, PublicAlertBannerView

router = DefaultRouter()
router.register('notifications', NotificationViewSet, basename='notification')
router.register('events', EventViewSet, basename='event')
router.register('arrears-campaigns', ArrearsMessageCampaignViewSet, basename='arrears-campaign')
router.register('messages', MessageViewSet, basename='message')
router.register('delivery-logs', DeliveryLogViewSet, basename='delivery-log')

urlpatterns = router.urls + [
    path('alerts/banner/', PublicAlertBannerView.as_view(), name='public-alert-banner'),
    # Africa's Talking SMS delivery/inbound callbacks
    path('at/sms/callback/', ATSMSCallbackView.as_view(), name='at-sms-callback'),
    # TextWave SMS delivery/inbound callbacks
    path('textwave/sms/callback/', TextWaveSMSCallbackView.as_view(), name='textwave-sms-callback'),
    # Public contact inquiry endpoint
    path('contact-inquiry/', ContactInquiryView.as_view(), name='contact-inquiry'),
    # Public report issue endpoint
    path('report-issue/', ReportIssueView.as_view(), name='report-issue'),
    # Public service review endpoint
    path('service-reviews/', ServiceReviewView.as_view(), name='service-reviews'),
    # Public admission letter upload endpoint
    path('upload-admission-letter/', UploadAdmissionLetterView.as_view(), name='upload-admission-letter'),
]
