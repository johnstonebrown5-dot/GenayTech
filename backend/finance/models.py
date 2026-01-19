from django.db import models
from django.conf import settings
from academics.models import Student

class FeeCategory(models.Model):
    """A fee category such as Tuition, Transport, Lunch, etc., scoped to a School."""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    # If true, this category is intended for per-student assignments ("per head")
    is_special = models.BooleanField(default=False)
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE)

    class Meta:
        unique_together = ("school", "name")

    def __str__(self):
        return f"{self.name}"

    def delete(self, using=None, keep_parents=False):
        # Prevent deletion of the system 'Boarding fees' category
        try:
            if str(self.name).strip().lower() == 'boarding fees':
                from django.core.exceptions import ValidationError
                raise ValidationError("'Boarding fees' category cannot be deleted.")
        except Exception:
            # If anything goes wrong, fall back to safe behavior and block deletion
            from django.core.exceptions import ValidationError
            raise ValidationError("This fee category is protected and cannot be deleted.")
        return super().delete(using=using, keep_parents=keep_parents)

class ClassFee(models.Model):
    """Assign a FeeCategory to a Class for a given academic year/term with an amount and due date."""
    TERM_CHOICES = (
        (1, 'Term 1'),
        (2, 'Term 2'),
        (3, 'Term 3'),
    )
    fee_category = models.ForeignKey(FeeCategory, on_delete=models.CASCADE, related_name='class_fees')
    klass = models.ForeignKey('academics.Class', on_delete=models.CASCADE, related_name='class_fees')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    year = models.IntegerField()
    term = models.IntegerField(choices=TERM_CHOICES)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("fee_category", "klass", "year", "term")

    def __str__(self):
        return f"{self.fee_category.name} - {self.klass} {self.year} T{self.term}"

class StudentFee(models.Model):
    """Assign a FeeCategory to a specific Student for a given academic year/term.

    Used for personalized (per-head) fees. Typically paired with FeeCategory.is_special=True.
    """
    TERM_CHOICES = (
        (1, 'Term 1'),
        (2, 'Term 2'),
        (3, 'Term 3'),
    )
    fee_category = models.ForeignKey(FeeCategory, on_delete=models.CASCADE, related_name='student_fees')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='student_fees')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    year = models.IntegerField()
    term = models.IntegerField(choices=TERM_CHOICES)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("fee_category", "student", "year", "term")

    def __str__(self):
        return f"{self.fee_category.name} - {self.student.name} {self.year} T{self.term}"

# Per-school Mpesa/Daraja configuration
class MpesaConfig(models.Model):
    ENV_CHOICES = (('sandbox', 'Sandbox'), ('production', 'Production'))
    school = models.OneToOneField('accounts.School', on_delete=models.CASCADE, related_name='mpesa_config')
    consumer_key = models.CharField(max_length=255)
    consumer_secret = models.CharField(max_length=255)
    short_code = models.CharField(max_length=20, help_text='Till or PayBill number')
    passkey = models.CharField(max_length=255, help_text='Lipa Na Mpesa Online passkey')
    callback_url = models.URLField(blank=True, help_text='Public HTTPS callback URL for STK push callbacks')
    environment = models.CharField(max_length=12, choices=ENV_CHOICES, default='sandbox')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Mpesa Configuration'
        verbose_name_plural = 'Mpesa Configurations'

    def __str__(self):
        return f"{self.school} Mpesa ({self.environment})"

class Invoice(models.Model):
    STATUS_CHOICES = (("paid","Paid"),("unpaid","Unpaid"),("partial","Partial"))
    TERM_CHOICES = (
        (1, 'Term 1'),
        (2, 'Term 2'),
        (3, 'Term 3'),
    )
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    category = models.ForeignKey('finance.FeeCategory', null=True, blank=True, on_delete=models.SET_NULL, related_name='invoices')
    year = models.IntegerField(null=True, blank=True)
    term = models.IntegerField(choices=TERM_CHOICES, null=True, blank=True)
    mpesa_transaction_id = models.CharField(max_length=100, blank=True)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Payment(models.Model):
    invoice = models.ForeignKey(Invoice, related_name='payments', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    METHOD_CHOICES = (
        ('mpesa', 'M-Pesa'),
        ('bank', 'Bank'),
        ('cash', 'Cash'),
        ('cheque', 'Cheque'),
    )
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='mpesa')
    reference = models.CharField(max_length=100, blank=True)
    attachment = models.FileField(upload_to='payment_attachments/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"Payment {self.amount} for Invoice {self.invoice_id}"


class PaymentMethod(models.Model):
    """Configurable payment method enabled per school.

    When at least one record exists for a school, only methods with enabled=True are allowed.
    If no records exist for a school, all built-in methods are implicitly allowed for backward compatibility.
    """
    METHOD_CHOICES = (
        ('mpesa', 'M-Pesa'),
        ('bank', 'Bank'),
        ('cash', 'Cash'),
        ('cheque', 'Cheque'),
    )
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='payment_methods')
    key = models.CharField(max_length=20, choices=METHOD_CHOICES)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("school", "key")
        verbose_name = 'Payment Method'
        verbose_name_plural = 'Payment Methods'

    def __str__(self):
        return f"{self.school} – {self.get_key_display()} ({'Enabled' if self.enabled else 'Disabled'})"


class IncomingPayment(models.Model):
    """External/unreconciled payment inbox entry.

    Used to capture inflows fetched from bank/M-Pesa statements or webhooks before
    allocating them to a specific student and invoice. Auto-matching tries to find
    a Student by admission number in the reference/narration/account reference.
    """
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('matched', 'Matched (Student identified)'),
        ('reconciled', 'Reconciled (Applied to invoices)'),
        ('ignored', 'Ignored'),
    )
    SOURCE_CHOICES = (
        ('coop', 'Co-op'),
        ('mpesa', 'M-Pesa'),
        ('bank', 'Bank'),
        ('manual', 'Manual'),
    )

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='bank')
    external_id = models.CharField(max_length=100, blank=True, help_text='Provider reference/unique id')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='KES')
    reference = models.CharField(max_length=100, blank=True, help_text='Receipt/transaction code')
    narration = models.TextField(blank=True)
    account_ref = models.CharField(max_length=100, blank=True, help_text='Account reference passed to gateway (e.g., INV123, admission no)')
    phone = models.CharField(max_length=50, blank=True)
    payer_name = models.CharField(max_length=255, blank=True)
    value_date = models.DateTimeField(null=True, blank=True)

    matched_student = models.ForeignKey('academics.Student', null=True, blank=True, on_delete=models.SET_NULL, related_name='incoming_payments')
    matched_invoice = models.ForeignKey('finance.Invoice', null=True, blank=True, on_delete=models.SET_NULL, related_name='incoming_matches')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    match_confidence = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['source', 'external_id']),
        ]
        verbose_name = 'Incoming Payment'
        verbose_name_plural = 'Incoming Payments'

    def __str__(self):
        return f"Inbox {self.source} {self.external_id or self.reference or ''} {self.amount} {self.currency}"


class ExpenseCategory(models.Model):
    """A category for expenses, e.g., Salaries, Utilities, Supplies."""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='expense_categories')

    class Meta:
        unique_together = ("school", "name")
        verbose_name_plural = "Expense Categories"

    def __str__(self):
        return self.name


class Expense(models.Model):
    """Represents a single expense record."""
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='expenses')
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses', null=True, blank=True)
    # Optional free-text name of the payee/vendor/supplier
    payee = models.CharField(max_length=255, blank=True, default='')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField()
    date = models.DateField()
    attachment = models.FileField(upload_to='expense_attachments/', null=True, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Expense: {self.category.name} - {self.amount}"


class PocketMoneyWallet(models.Model):
    """Represents a student's pocket money wallet."""
    student = models.OneToOneField('academics.Student', on_delete=models.CASCADE, related_name='pocket_money_wallet')
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student.name}'s Wallet (Balance: {self.balance})"


class PocketMoneyTransaction(models.Model):
    """Represents a single transaction (deposit or withdrawal) for a student's wallet."""
    TRANSACTION_TYPE_CHOICES = (
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
    )
    wallet = models.ForeignKey(PocketMoneyWallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.transaction_type.capitalize()} of {self.amount} for {self.wallet.student.name}"


class StaffPayroll(models.Model):
    staff = models.ForeignKey('accounts.NonTeachingStaff', on_delete=models.CASCADE, related_name='payrolls')
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='staff_payrolls')
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    allowances = models.JSONField(default=list, blank=True)
    deductions = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    # Day of month (1-31) when payslip should be auto-generated for the active payroll
    payout_day = models.IntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class StaffPayslip(models.Model):
    staff = models.ForeignKey('accounts.NonTeachingStaff', on_delete=models.CASCADE, related_name='payslips')
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='staff_payslips')
    year = models.IntegerField()
    month = models.IntegerField()
    basic = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    allowances = models.JSONField(default=list, blank=True)
    deductions = models.JSONField(default=list, blank=True)
    gross_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['school','staff','year','month'], name='uniq_staff_month_school')
        ]
        indexes = [
            models.Index(fields=['school','staff','year','month'])
        ]
