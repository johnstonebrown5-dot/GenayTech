from rest_framework import serializers
from .models import Invoice, Payment, FeeCategory, ClassFee, MpesaConfig, ExpenseCategory, Expense, PocketMoneyWallet, PocketMoneyTransaction, PaymentMethod, IncomingPayment

class PaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()

    def get_recorded_by_name(self, obj):
        user = getattr(obj, 'recorded_by', None)
        if not user:
            return None
        # Try common name attributes in order of preference
        for attr in ('name', 'full_name'):
            val = getattr(user, attr, None)
            if val:
                return str(val)
        # Try Django's get_full_name / get_username if available
        try:
            full = user.get_full_name()
            if full:
                return full
        except Exception:
            pass
        try:
            uname = user.get_username()
            if uname:
                return uname
        except Exception:
            pass
        # Fallback to string representation
        return str(user)

    def get_student(self, obj):
        try:
            inv = getattr(obj, 'invoice', None)
            stu = getattr(inv, 'student', None)
            if not stu:
                return None
            return {
                'id': getattr(stu, 'id', None),
                'name': getattr(stu, 'name', None) or str(stu),
                'admission_no': getattr(stu, 'admission_no', None),
                'class': str(getattr(stu, 'klass', '') or ''),
            }
        except Exception:
            return None

    class Meta:
        model = Payment
        fields = ['id','invoice','amount','method','reference','attachment','invoice_id','created_at','recorded_by','recorded_by_name','student']

class FeeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = ['id','name','description','school']
        read_only_fields = ['school']

class ClassFeeSerializer(serializers.ModelSerializer):
    fee_category_detail = FeeCategorySerializer(source='fee_category', read_only=True)
    # Read-only textual representation of the class (uses __str__ of Class)
    klass_detail = serializers.CharField(source='klass.__str__', read_only=True)
    # Optional write-only field to support assigning the same fee to multiple classes at once
    klasses = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, allow_empty=False
    )
    class Meta:
        model = ClassFee
        fields = ['id','fee_category','fee_category_detail','klass','klass_detail','klasses','amount','year','term','due_date','created_at']

    def validate(self, attrs):
        # Enforce uniqueness (fee_category, klass, year, term) with a clear message
        # Note: DB already has unique_together, but this provides a friendly 400 error
        fee_category = attrs.get('fee_category') or getattr(self.instance, 'fee_category', None)
        klass = attrs.get('klass') or getattr(self.instance, 'klass', None)
        year = attrs.get('year') or getattr(self.instance, 'year', None)
        term = attrs.get('term') or getattr(self.instance, 'term', None)
        # Allow boarding-related categories to be assigned per class; enforcement is in signals to skip day scholars.
        if fee_category and klass and year and term:
            qs = ClassFee.objects.filter(
                fee_category=fee_category,
                klass=klass,
                year=year,
                term=term,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    'non_field_errors': [
                        'This fee category is already assigned to the selected class for the specified academic year and term.'
                    ]
                })
        return super().validate(attrs)

class InvoiceSerializer(serializers.ModelSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    category_detail = FeeCategorySerializer(source='category', read_only=True)
    class Meta:
        model = Invoice
        fields = ['id','student','amount','status','category','category_detail','year','term','mpesa_transaction_id','due_date','created_at','payments']

class MpesaConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaConfig
        fields = '__all__'


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id','school','key','enabled','updated_at']
        read_only_fields = ['school','updated_at']

class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'


class PocketMoneyTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PocketMoneyTransaction
        fields = '__all__'


class PocketMoneyWalletSerializer(serializers.ModelSerializer):
    transactions = PocketMoneyTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = PocketMoneyWallet
        fields = '__all__'


class IncomingPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomingPayment
        fields = '__all__'
