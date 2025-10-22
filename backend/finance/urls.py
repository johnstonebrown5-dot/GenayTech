from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import InvoiceViewSet, PaymentViewSet, FeeCategoryViewSet, ClassFeeViewSet, mpesa_callback, MpesaConfigViewSet, ExpenseCategoryViewSet, ExpenseViewSet, PocketMoneyWalletViewSet, PocketMoneyTransactionViewSet, PaymentMethodViewSet

router = DefaultRouter()
router.register('invoices', InvoiceViewSet)
router.register('payments', PaymentViewSet)
router.register('fee-categories', FeeCategoryViewSet)
router.register('class-fees', ClassFeeViewSet)
router.register('mpesa-configs', MpesaConfigViewSet, basename='mpesa-configs')
router.register('payment-methods', PaymentMethodViewSet, basename='payment-methods')
router.register('expense-categories', ExpenseCategoryViewSet)
router.register('expenses', ExpenseViewSet)
router.register('pocket-money-wallets', PocketMoneyWalletViewSet)
router.register('pocket-money-transactions', PocketMoneyTransactionViewSet)

urlpatterns = [
    # Public callback URL for Daraja STK push
    path('mpesa/callback/', mpesa_callback, name='mpesa-callback'),
]

# Include router-generated endpoints
urlpatterns += router.urls
