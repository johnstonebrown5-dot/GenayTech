from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import InvoiceViewSet, PaymentViewSet, FeeCategoryViewSet, ClassFeeViewSet, mpesa_callback, coop_mpesa_callback, MpesaConfigViewSet, ExpenseCategoryViewSet, ExpenseViewSet, PocketMoneyWalletViewSet, PocketMoneyTransactionViewSet, PaymentMethodViewSet, IncomingPaymentViewSet, StudentFeeViewSet, StaffPayrollViewSet, StaffPayslipViewSet, superadmin_reset_fees, superadmin_reset_fees_otp_request, superadmin_reset_fees_otp_confirm

router = DefaultRouter()
router.trailing_slash = '/?'
router.register('invoices', InvoiceViewSet)
router.register('payments', PaymentViewSet)
router.register('fee-categories', FeeCategoryViewSet)
router.register('class-fees', ClassFeeViewSet)
router.register('student-fees', StudentFeeViewSet)
router.register('mpesa-configs', MpesaConfigViewSet, basename='mpesa-configs')
router.register('payment-methods', PaymentMethodViewSet, basename='payment-methods')
router.register('expense-categories', ExpenseCategoryViewSet)
router.register('expenses', ExpenseViewSet)
router.register('pocket-money-wallets', PocketMoneyWalletViewSet)
router.register('pocket-money-transactions', PocketMoneyTransactionViewSet)
router.register('incoming-payments', IncomingPaymentViewSet, basename='incoming-payments')
router.register('staff-payroll', StaffPayrollViewSet)
router.register('staff-payslips', StaffPayslipViewSet)

urlpatterns = [
    # Public callback URL for Daraja STK push
    path('mpesa/callback/', mpesa_callback, name='mpesa-callback'),
    # Public callback URL for Co-op STK push
    path('coop/mpesa/callback/', coop_mpesa_callback, name='coop-mpesa-callback'),
    # Superadmin-only destructive action (feature-flag gated per school)
    path('superadmin/reset-fees/', superadmin_reset_fees, name='superadmin-reset-fees'),
    path('superadmin/reset-fees/otp/request/', superadmin_reset_fees_otp_request, name='superadmin-reset-fees-otp-request'),
    path('superadmin/reset-fees/otp/confirm/', superadmin_reset_fees_otp_confirm, name='superadmin-reset-fees-otp-confirm'),
]

# Include router-generated endpoints
urlpatterns += router.urls
