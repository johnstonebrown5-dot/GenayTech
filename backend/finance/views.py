from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, JSONParser, FormParser
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import os
import logging
from .mpesa import MpesaClient
from .coop_stk import CoopStkClient
from .models import Invoice, Payment, FeeCategory, ClassFee, MpesaConfig, ExpenseCategory, Expense, PocketMoneyWallet, PocketMoneyTransaction, PaymentMethod
from .serializers import InvoiceSerializer, PaymentSerializer, FeeCategorySerializer, ClassFeeSerializer, MpesaConfigSerializer, ExpenseCategorySerializer, ExpenseSerializer, PocketMoneyWalletSerializer, PocketMoneyTransactionSerializer, PaymentMethodSerializer
from academics.models import Student

class IsFinanceOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ('finance','admin')

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student', 'category', 'year', 'term', 'status']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # Allow non-admin access to specific actions (e.g., students initiating STK)
    def get_permissions(self):
        # Actions that only require authentication (student-facing)
        relaxed = {
            'my', 'my_summary', 'stk_push', 'coop_stk',
            'student_summary', 'summary', 'arrears', 'arrears_export'
        }
        if getattr(self, 'action', None) in relaxed:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    # Helper: enabled payment methods for a school (defaults to all if none configured)
    def _enabled_methods_for_school(self, school):
        try:
            qs = PaymentMethod.objects.filter(school=school)
            if not qs.exists():
                return {'mpesa','bank','cash','cheque'}
            return set(qs.filter(enabled=True).values_list('key', flat=True))
        except Exception:
            return {'mpesa','bank','cash','cheque'}

    def get_queryset(self):
        qs = super().get_queryset().select_related('student')
        # Scope to user's school if available
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(student__klass__school=school)
        # Optional filter by student provided by filterset_fields
        return qs

    @action(detail=False, methods=['get'], url_path='student-summary')
    def student_summary(self, request):
        """Return totals for a given student: total billed, total paid, and balance.
        Params: student=<student_id>
        """
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'detail': 'student query param is required'}, status=400)
        # Scope to school
        school = getattr(getattr(request, 'user', None), 'school', None)
        inv_qs = Invoice.objects.filter(student_id=student_id)
        if school:
            inv_qs = inv_qs.filter(student__klass__school=school)
        total_billed = inv_qs.aggregate(s=Sum('amount'))['s'] or 0
        pay_qs = Payment.objects.filter(invoice__student_id=student_id)
        if school:
            pay_qs = pay_qs.filter(invoice__student__klass__school=school)
        total_paid = pay_qs.aggregate(s=Sum('amount'))['s'] or 0
        balance = (total_billed or 0) - (total_paid or 0)
        return Response({
            'total_billed': float(total_billed),
            'total_paid': float(total_paid),
            'balance': float(balance),
        })

    @action(detail=False, methods=['get'], url_path='my', permission_classes=[permissions.IsAuthenticated])
    def my_invoices(self, request):
        """List invoices for the authenticated student user."""
        user = request.user
        # Avoid triggering OneToOne DoesNotExist by querying safely
        student_id = Student.objects.filter(user=user).values_list('id', flat=True).first()
        if not student_id and user.role not in ('admin','finance'):
            return Response({'detail': 'Not a student account'}, status=403)
        qs = self.get_queryset()
        if student_id:
            qs = qs.filter(student_id=student_id)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-summary', permission_classes=[permissions.IsAuthenticated])
    def my_summary(self, request):
        """Totals for the authenticated student user (or admin can pass ?student=<id>)."""
        user = request.user
        student_id = request.query_params.get('student')
        if not student_id:
            student_id = Student.objects.filter(user=user).values_list('id', flat=True).first()
        if not student_id and user.role not in ('admin','finance'):
            return Response({'detail': 'Not a student account'}, status=403)
        school = getattr(getattr(request, 'user', None), 'school', None)
        inv_qs = Invoice.objects.all()
        if student_id:
            inv_qs = inv_qs.filter(student_id=student_id)
        if school:
            inv_qs = inv_qs.filter(student__klass__school=school)
        total_billed = inv_qs.aggregate(s=Sum('amount'))['s'] or 0
        pay_qs = Payment.objects.all()
        if student_id:
            pay_qs = pay_qs.filter(invoice__student_id=student_id)
        if school:
            pay_qs = pay_qs.filter(invoice__student__klass__school=school)
        total_paid = pay_qs.aggregate(s=Sum('amount'))['s'] or 0
        balance = (total_billed or 0) - (total_paid or 0)
        return Response({
            'total_billed': float(total_billed),
            'total_paid': float(total_paid),
            'balance': float(balance),
        })

    @action(detail=False, methods=['get'], url_path='arrears')
    def arrears(self, request):
        """Return list of students with outstanding balances (arrears), with totals per student.
        Optional query params: klass (class id), min_balance
        """
        school = getattr(getattr(request, 'user', None), 'school', None)
        klass_id = request.query_params.get('klass')
        min_balance = float(request.query_params.get('min_balance', 0))

        stu_qs = Student.objects.filter(is_active=True)
        if school:
            stu_qs = stu_qs.filter(klass__school=school)
        if klass_id:
            stu_qs = stu_qs.filter(klass_id=klass_id)

        data = []
        for stu in stu_qs:
            inv_qs = Invoice.objects.filter(student=stu)
            if school:
                inv_qs = inv_qs.filter(student__klass__school=school)
            total_billed = inv_qs.aggregate(s=Sum('amount'))['s'] or 0
            pay_qs = Payment.objects.filter(invoice__student=stu)
            if school:
                pay_qs = pay_qs.filter(invoice__student__klass__school=school)
            total_paid = pay_qs.aggregate(s=Sum('amount'))['s'] or 0
            balance = float(total_billed or 0) - float(total_paid or 0)
            if balance > min_balance:
                data.append({
                    'student_id': stu.id,
                    'student_name': stu.name,
                    'class': str(stu.klass) if stu.klass_id else None,
                    'total_billed': float(total_billed),
                    'total_paid': float(total_paid),
                    'balance': float(balance),
                })
        # Sort by largest balance first
        data.sort(key=lambda x: x['balance'], reverse=True)
        return Response(data)

    @action(detail=False, methods=['get'], url_path='arrears/export')
    def arrears_export(self, request):
        """Export arrears data as CSV. Accepts same filters as arrears: klass, min_balance."""
        import csv
        from django.http import HttpResponse
        school = getattr(getattr(request, 'user', None), 'school', None)
        klass_id = request.query_params.get('klass')
        try:
            min_balance = float(request.query_params.get('min_balance', 0))
        except Exception:
            min_balance = 0

        stu_qs = Student.objects.filter(is_active=True)
        if school:
            stu_qs = stu_qs.filter(klass__school=school)
        if klass_id:
            stu_qs = stu_qs.filter(klass_id=klass_id)

        rows = []
        for stu in stu_qs:
            inv_qs = Invoice.objects.filter(student=stu)
            if school:
                inv_qs = inv_qs.filter(student__klass__school=school)
            total_billed = inv_qs.aggregate(s=Sum('amount'))['s'] or 0
            pay_qs = Payment.objects.filter(invoice__student=stu)
            if school:
                pay_qs = pay_qs.filter(invoice__student__klass__school=school)
            total_paid = pay_qs.aggregate(s=Sum('amount'))['s'] or 0
            balance = float(total_billed or 0) - float(total_paid or 0)
            if balance > min_balance:
                rows.append([
                    stu.id,
                    stu.name,
                    str(getattr(stu, 'klass', '') or ''),
                    float(total_billed or 0),
                    float(total_paid or 0),
                    float(balance or 0),
                ])

        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="arrears.csv"'
        w = csv.writer(resp)
        w.writerow(['Student ID','Student Name','Class','Total Billed','Total Paid','Balance'])
        for r in rows:
            w.writerow(r)
        return resp

    @action(detail=False, methods=['get'], url_path='verify_reference', permission_classes=[permissions.IsAuthenticated])
    def verify_reference(self, request):
        """Verify a payment by reference code.
        Params: reference (required), invoice (optional), amount (optional)
        Checks basic format and whether the reference already exists.
        Returns { valid_format, duplicate, matches_invoice, conflicts: [...]}.
        """
        import re
        ref = (request.query_params.get('reference') or '').strip()
        if not ref:
            return Response({'detail': 'reference is required'}, status=400)
        # Basic Mpesa code format A-Z/0-9 length 8-20 (flexible)
        valid_format = bool(re.fullmatch(r'[A-Z0-9]{8,20}', ref, flags=0))
        qs = self.get_queryset().filter(reference__iexact=ref)
        duplicate = qs.exists()
        conflicts = [
            {
                'id': p.id,
                'invoice': getattr(p.invoice, 'id', None),
                'amount': float(getattr(p, 'amount', 0) or 0),
                'created_at': getattr(p, 'created_at', None),
                'method': getattr(p, 'method', ''),
            }
            for p in qs[:5]
        ]
        invoice_id = request.query_params.get('invoice')
        matches_invoice = False
        if invoice_id and duplicate:
            matches_invoice = qs.filter(invoice_id=invoice_id).exists()
        return Response({
            'valid_format': valid_format,
            'duplicate': duplicate,
            'matches_invoice': matches_invoice,
            'conflicts': conflicts,
        })

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Provides a high-level summary of school finances for the dashboard.
        Accepts `start_date` and `end_date` query parameters.
        """
        school = getattr(getattr(request, 'user', None), 'school', None)
        
        # Date range filtering
        end_date = request.query_params.get('end_date')
        start_date = request.query_params.get('start_date')
        try:
            if end_date:
                end_date = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d'))
            else:
                end_date = timezone.now()
            
            if start_date:
                start_date = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
            else:
                start_date = end_date - timedelta(days=30)
        except (ValueError, TypeError):
            end_date = timezone.now()
            start_date = end_date - timedelta(days=30)

        # Previous period for trend calculation
        prev_start_date = start_date - (end_date - start_date)
        prev_end_date = start_date

        # Helper to calculate totals for a given period
        def get_period_totals(start, end):
            invoice_qs = Invoice.objects.filter(created_at__range=(start, end))
            payment_qs = Payment.objects.filter(created_at__range=(start, end))
            expense_qs = Expense.objects.filter(date__range=(start, end))
            if school:
                invoice_qs = invoice_qs.filter(student__klass__school=school)
                payment_qs = payment_qs.filter(invoice__student__klass__school=school)
                expense_qs = expense_qs.filter(school=school)

            total_billed = invoice_qs.aggregate(total=Sum('amount'))['total'] or 0
            total_revenue = payment_qs.aggregate(total=Sum('amount'))['total'] or 0
            total_expenses = expense_qs.aggregate(total=Sum('amount'))['total'] or 0
            outstanding_fees = total_billed - total_revenue
            collection_rate = (total_revenue / total_billed * 100) if total_billed > 0 else 100
            return {
                'total_revenue': total_revenue,
                'outstanding_fees': outstanding_fees,
                'collection_rate': collection_rate,
                'total_expenses': total_expenses,
            }

        current_period = get_period_totals(start_date, end_date)
        previous_period = get_period_totals(prev_start_date, prev_end_date)

        # Trend calculation
        def calculate_trend(current, previous):
            if previous == 0: return 100 if current > 0 else 0
            return ((current - previous) / previous) * 100

        trends = {
            'totalRevenue': calculate_trend(current_period['total_revenue'], previous_period['total_revenue']),
            'outstandingFees': calculate_trend(current_period['outstanding_fees'], previous_period['outstanding_fees']),
            'collectionRate': current_period['collection_rate'] - previous_period['collection_rate'],
            'totalExpenses': calculate_trend(current_period['total_expenses'], previous_period['total_expenses']),
        }

        # Other data (not date-range dependent for now)
        payment_qs = Payment.objects.all()
        if school:
            payment_qs = payment_qs.filter(invoice__student__klass__school=school)

        twelve_months_ago = timezone.now() - timedelta(days=365)
        revenue_trend_qs = payment_qs.filter(created_at__gte=twelve_months_ago) \
            .annotate(month=TruncMonth('created_at')) \
            .values('month') \
            .annotate(amount=Sum('amount')) \
            .order_by('month')
        revenue_trend = [{'month': r['month'].strftime('%b %Y'), 'amount': float(r['amount'])} for r in revenue_trend_qs]

        recent_transactions = payment_qs.order_by('-created_at')[:10]
        recent_transactions_data = [
            {'id': p.id, 'date': p.created_at, 'amount': p.amount, 'type': p.method, 'status': 'completed'}
            for p in recent_transactions
        ]

        expense_qs = Expense.objects.all()
        if school: expense_qs = expense_qs.filter(school=school)
        expense_breakdown_qs = expense_qs.values('category__name').annotate(amount=Sum('amount')).order_by('-amount')
        expense_breakdown = [{'category': item['category__name'], 'amount': float(item['amount'])} for item in expense_breakdown_qs]

        return Response({
            'totalRevenue': current_period['total_revenue'],
            'outstandingFees': current_period['outstanding_fees'],
            'collectionRate': round(current_period['collection_rate'], 2),
            'totalExpenses': current_period['total_expenses'],
            'trends': trends,
            'revenueTrend': revenue_trend,
            'expenseBreakdown': expense_breakdown,
            'recentTransactions': recent_transactions_data,
        })

    @action(detail=True, methods=['post'], url_path='pay', permission_classes=[permissions.IsAuthenticated])
    def pay(self, request, pk=None):
        """Record a payment against this invoice.
        Body: { amount: number, method?: 'mpesa'|'bank'|'cash', reference?: string }
        Students can only pay their own invoices. Finance/Admin can pay any.
        """
        try:
            invoice = self.get_queryset().get(pk=pk)
        except Invoice.DoesNotExist:
            return Response({'detail': 'Invoice not found'}, status=404)

        user = request.user
        student_id = Student.objects.filter(user=user).values_list('id', flat=True).first()
        # Permission: students must own the invoice
        if user.role not in ('admin','finance'):
            if not student_id or invoice.student_id != student_id:
                return Response({'detail': 'Forbidden'}, status=403)

        try:
            amount = float(request.data.get('amount', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid amount'}, status=400)
        if amount <= 0:
            return Response({'detail': 'Amount must be greater than 0'}, status=400)

        method = request.data.get('method') or 'mpesa'
        # Enforce enabled methods per school
        school = getattr(invoice.student.klass, 'school', None)
        enabled = self._enabled_methods_for_school(school)
        if str(method).lower() not in enabled:
            return Response({'detail': f'Payment method "{method}" is disabled by admin'}, status=400)
        # Students can only record M-Pesa payments; Bank/Cash restricted to Admin/Finance
        if user.role not in ('admin','finance') and str(method).lower() != 'mpesa':
            return Response({'detail': 'Only M-Pesa payments are allowed for students'}, status=403)
        reference = request.data.get('reference') or ''
        attachment = request.FILES.get('attachment')

        # Create payment
        pay = Payment.objects.create(
            invoice=invoice,
            amount=amount,
            method=method,
            reference=reference,
            attachment=attachment,
            recorded_by=user if user.is_authenticated else None,
        )

        # Update invoice status based on total paid
        totals = invoice.payments.aggregate(s=Sum('amount'))
        total_paid = float(totals['s'] or 0)
        if total_paid >= float(invoice.amount):
            invoice.status = 'paid'
        elif 0 < total_paid < float(invoice.amount):
            invoice.status = 'partial'
        else:
            invoice.status = 'unpaid'
        invoice.save(update_fields=['status'])

        # Notify student of payment and updated balance
        try:
            from communications.utils import notify_payment_received
            notify_payment_received(invoice, pay)
        except Exception as e:
            pass

        return Response({
            'payment': PaymentSerializer(pay).data,
            'invoice': InvoiceSerializer(invoice, context={'request': request}).data,
        }, status=201)

    @action(detail=False, methods=['post'], url_path='pay_student', permission_classes=[IsFinanceOrAdmin])
    def pay_student(self, request):
        """Apply a lump-sum payment to a student's outstanding invoices (FIFO).
        Body: { student: <id>, amount: number, method?: 'mpesa'|'bank'|'cash', reference?: string }
        Returns { created_payments: [ids], amount_allocated, amount_unallocated }
        """
        try:
            student_id = int(request.data.get('student'))
        except (TypeError, ValueError):
            return Response({'detail': 'student is required'}, status=400)
        # Ensure student exists and (if applicable) belongs to the same school
        school = getattr(getattr(request, 'user', None), 'school', None)
        stu_qs = Student.objects.filter(id=student_id)
        if school:
            stu_qs = stu_qs.filter(klass__school=school)
        if not stu_qs.exists():
            return Response({'detail': 'Student not found'}, status=404)
        try:
            amount = float(request.data.get('amount', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid amount'}, status=400)
        if amount <= 0:
            return Response({'detail': 'Amount must be greater than 0'}, status=400)

        method = request.data.get('method') or 'cash'
        # Enforce enabled methods per school
        enabled = self._enabled_methods_for_school(school)
        if str(method).lower() not in enabled:
            return Response({'detail': f'Payment method "{method}" is disabled by admin'}, status=400)
        reference = request.data.get('reference') or ''

        inv_qs = Invoice.objects.filter(student_id=student_id).order_by('created_at', 'id')
        if school:
            inv_qs = inv_qs.filter(student__klass__school=school)

        remaining = amount
        created_ids = []

        for inv in inv_qs:
            if remaining <= 0:
                break
            # compute remaining on invoice
            paid_so_far = float(inv.payments.aggregate(s=Sum('amount'))['s'] or 0)
            inv_balance = float(inv.amount) - paid_so_far
            if inv_balance <= 0:
                # already settled
                continue
            alloc = min(remaining, inv_balance)
            try:
                pay = Payment.objects.create(
                    invoice=inv,
                    amount=float(alloc),
                    method=method,
                    reference=reference,
                    recorded_by=request.user if getattr(request, 'user', None) and request.user.is_authenticated else None,
                )
            except Exception as e:
                return Response({'detail': f'Failed to create payment: {e}'}, status=500)
            created_ids.append(pay.id)
            remaining -= alloc
            # update invoice status
            new_paid = paid_so_far + float(alloc)
            if new_paid >= float(inv.amount):
                inv.status = 'paid'
            elif new_paid > 0:
                inv.status = 'partial'
            else:
                inv.status = 'unpaid'
            inv.save(update_fields=['status'])

        return Response({
            'created_payments': created_ids,
            'amount_allocated': float(amount - remaining),
            'amount_unallocated': float(remaining),
        }, status=201)

    @action(detail=True, methods=['post'], url_path='stk_push', permission_classes=[permissions.IsAuthenticated])
    def stk_push(self, request, pk=None):
        """Initiate an Mpesa STK push for this invoice.
        Body: { phone: string, amount?: number, simulate?: bool }
        For demo, if simulate is true (default), record payment immediately.
        """
        try:
            invoice = self.get_queryset().get(pk=pk)
        except Invoice.DoesNotExist:
            return Response({'detail': 'Invoice not found'}, status=404)

        logger = logging.getLogger(__name__)
        # Students can only initiate STK for their own invoice
        user = request.user
        if getattr(user, 'role', None) not in ('admin','finance'):
            from academics.models import Student as _Student
            stu_id = _Student.objects.filter(user=user).values_list('id', flat=True).first()
            if not stu_id or invoice.student_id != stu_id:
                return Response({'detail': 'Forbidden'}, status=403)
        phone = (request.data.get('phone') or '').strip()
        # Normalize phone to 2547XXXXXXXX format required by Daraja
        if phone.startswith('+'):
            phone = phone[1:]
        if phone.startswith('0') and len(phone) == 10:
            phone = '254' + phone[1:]
        if not phone:
            return Response({'detail': 'phone is required'}, status=400)
        try:
            amount = float(request.data.get('amount') or invoice.amount)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid amount'}, status=400)
        # Determine credentials: prefer per-school config; fallback to env vars
        school = getattr(getattr(invoice.student.klass, 'school', None), 'id', None)
        config = None
        if school:
            config = MpesaConfig.objects.filter(school_id=invoice.student.klass.school_id).first()
        if config:
            have_creds = all([config.consumer_key, config.consumer_secret, config.short_code, config.passkey])
        else:
            required = ('MPESA_CONSUMER_KEY','MPESA_CONSUMER_SECRET','MPESA_SHORT_CODE','MPESA_PASSKEY')
            have_creds = all(os.getenv(k) for k in required)
        default_sim = 'false' if have_creds else 'true'
        simulate = str(request.data.get('simulate', default_sim)).lower() in ('1','true','yes')

        # Validate Mpesa method is enabled
        sch = getattr(invoice.student.klass, 'school', None)
        enabled = self._enabled_methods_for_school(sch)
        if 'mpesa' not in enabled:
            return Response({'detail': 'Mpesa payments are disabled by admin'}, status=400)

        # In production, integrate with Mpesa API here and return CheckoutRequestID.
        # For now, simulate immediate success if simulate=True.
        logger.info("STK request init", extra={
            'invoice_id': invoice.id,
            'phone': phone[-4:],  # mask
            'amount': amount,
            'simulate': simulate,
        })
        if simulate:
            # Simulation mode: do NOT create a payment. Just acknowledge request.
            # Frontend may show progress and will not find a new payment unless created manually.
            return Response({
                'status': 'pending',
                'message': 'STK simulated (no payment created). Use real mode or callback to record payment.',
            }, status=202)

        # If not simulating, try real Daraja if credentials present (school-specific or env)
        if have_creds:
            try:
                if config:
                    client = MpesaClient(
                        consumer_key=config.consumer_key,
                        consumer_secret=config.consumer_secret,
                        short_code=config.short_code,
                        passkey=config.passkey,
                        callback_url=(config.callback_url or os.getenv('MPESA_CALLBACK_URL')),
                        environment=config.environment,
                    )
                else:
                    client = MpesaClient()
                resp = client.stk_push(phone=str(phone), amount=amount, account_ref=f"INV{invoice.id}")
                # Save CheckoutRequestID on the invoice to reconcile on callback
                checkout_id = resp.get('CheckoutRequestID') or ''
                if checkout_id:
                    invoice.mpesa_transaction_id = checkout_id
                    invoice.save(update_fields=['mpesa_transaction_id'])
                logger.info("STK initiated", extra={'invoice_id': invoice.id, 'checkout_request_id': checkout_id})
                return Response({
                    'status': 'pending',
                    'message': 'STK initiated',
                    'daraja': resp,
                }, status=202)
            except Exception as e:
                logger.exception("STK initiation failed", extra={'invoice_id': invoice.id})
                return Response({'detail': f'STK error: {e}'}, status=500)
        # Fallback mocked when credentials missing
        return Response({'status':'pending','message':'STK credentials not configured; set MPESA_* env vars or use simulate=true.'}, status=202)

    @action(detail=True, methods=['post'], url_path='coop_stk', permission_classes=[permissions.IsAuthenticated])
    def coop_stk(self, request, pk=None):
        """Initiate a Co-op Bank gateway STK push for this invoice.
        Body: { phone: string, amount?: number, simulate?: bool }
        Uses env vars COOP_* set in backend or server env.
        """
        try:
            invoice = self.get_queryset().get(pk=pk)
        except Invoice.DoesNotExist:
            return Response({'detail': 'Invoice not found'}, status=404)

        logger = logging.getLogger(__name__)
        phone = (request.data.get('phone') or '').strip()
        if phone.startswith('+'):
            phone = phone[1:]
        if phone.startswith('0') and len(phone) == 10:
            phone = '254' + phone[1:]
        if not phone:
            return Response({'detail': 'phone is required'}, status=400)
        try:
            amount = float(request.data.get('amount') or invoice.amount)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid amount'}, status=400)

        # Validate Mpesa method is enabled for the school
        sch = getattr(invoice.student.klass, 'school', None)
        enabled = self._enabled_methods_for_school(sch)
        if 'mpesa' not in enabled:
            return Response({'detail': 'Mpesa payments are disabled by admin'}, status=400)

        # Determine if credentials exist for Co-op client
        have_creds = all(os.getenv(k) for k in ('COOP_CLIENT_ID','COOP_CLIENT_SECRET','COOP_BASE_URL','COOP_TOKEN_URL','COOP_SHORT_CODE','COOP_PASSKEY'))
        default_sim = 'false' if have_creds else 'true'
        simulate = str(request.data.get('simulate', default_sim)).lower() in ('1','true','yes')

        logger.info("Co-op STK request init", extra={
            'invoice_id': invoice.id,
            'phone': phone[-4:],
            'amount': amount,
            'simulate': simulate,
        })
        if simulate:
            return Response({'status': 'pending', 'message': 'Co-op STK simulated. Configure COOP_* env vars or set simulate=false.'}, status=202)

        if have_creds:
            try:
                client = CoopStkClient()
                resp = client.stk_push(phone=str(phone), amount=amount, account_ref=f"INV{invoice.id}")
                checkout_id = resp.get('CheckoutRequestID') or resp.get('checkoutRequestID') or ''
                if checkout_id:
                    invoice.mpesa_transaction_id = checkout_id
                    invoice.save(update_fields=['mpesa_transaction_id'])
                logger.info("Co-op STK initiated", extra={'invoice_id': invoice.id, 'checkout_request_id': checkout_id})
                return Response({'status': 'pending', 'message': 'STK initiated', 'coop': resp}, status=202)
            except Exception as e:
                logger.exception("Co-op STK initiation failed", extra={'invoice_id': invoice.id})
                return Response({'detail': f'Co-op STK error: {e}'}, status=500)

        return Response({'status': 'pending', 'message': 'Co-op credentials not configured; set COOP_* env vars or use simulate=true.'}, status=202)

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['invoice__student', 'invoice']

    def get_queryset(self):
        qs = super().get_queryset().select_related('invoice', 'invoice__student')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(invoice__student__klass__school=school)
        # Optional filters via query params
        params = self.request.query_params
        # Filter by class id
        klass_id = params.get('klass')
        if klass_id:
            qs = qs.filter(invoice__student__klass_id=klass_id)
        # Filter by payment method (accepts case-insensitive values like CASH, Mpesa, bank)
        method = params.get('method')
        if method:
            qs = qs.filter(method__iexact=str(method).strip())
        # Date range (inclusive) on created_at
        # Accept aliases date_from/date_to used by frontend
        start_date = params.get('start_date') or params.get('date_from')
        end_date = params.get('end_date') or params.get('date_to')
        from datetime import datetime
        from django.utils import timezone
        try:
            if start_date:
                start = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
                qs = qs.filter(created_at__gte=start)
        except Exception:
            pass
        try:
            if end_date:
                end = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d'))
                # include entire day
                from datetime import timedelta
                qs = qs.filter(created_at__lt=end + timedelta(days=1))
        except Exception:
            pass
        return qs

    @action(detail=False, methods=['get'], url_path='export')
    def export_csv(self, request):
        """Export filtered payments as CSV for download/print.
        Accepts same query params as list plus: klass, start_date, end_date.
        """
        import csv
        from django.http import HttpResponse
        qs = self.filter_queryset(self.get_queryset()).order_by('created_at')
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="payments.csv"'
        w = csv.writer(resp)
        w.writerow(['Payment ID','Date','Amount','Method','Reference','Invoice ID','Student ID','Student Name','Class'])
        for p in qs:
            stu = getattr(p.invoice, 'student', None)
            w.writerow([
                p.id,
                getattr(p, 'created_at', ''),
                float(getattr(p, 'amount', 0) or 0),
                getattr(p, 'method', ''),
                getattr(p, 'reference', ''),
                getattr(p.invoice, 'id', ''),
                getattr(stu, 'id', ''),
                getattr(stu, 'name', ''),
                str(getattr(stu, 'klass', '') or ''),
            ])
        return resp

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, pk=None):
        """Return structured data suitable for rendering/printing a payment receipt.
        Frontend can format this as a printable page.
        """
        try:
            pay = self.get_queryset().get(pk=pk)
        except Payment.DoesNotExist:
            return Response({'detail': 'Payment not found'}, status=404)
        inv = pay.invoice
        stu = inv.student if inv else None
        school = getattr(getattr(stu, 'klass', None), 'school', None)
        # Compute invoice and student balances
        paid_on_invoice = 0.0
        if inv:
            from django.db.models import Sum as _Sum
            paid_on_invoice = float(inv.payments.aggregate(s=_Sum('amount'))['s'] or 0)
        invoice_amount = float(getattr(inv, 'amount', 0) or 0)
        invoice_balance = max(0.0, invoice_amount - paid_on_invoice)

        stu_total_billed = 0.0
        stu_total_paid = 0.0
        if stu:
            from django.db.models import Sum as _Sum
            stu_total_billed = float(Invoice.objects.filter(student=stu).aggregate(s=_Sum('amount'))['s'] or 0)
            stu_total_paid = float(Payment.objects.filter(invoice__student=stu).aggregate(s=_Sum('amount'))['s'] or 0)
        student_balance = max(0.0, stu_total_billed - stu_total_paid)

        # Current term billed/paid and balances to compute arrears
        current_term_billed = 0.0
        current_term_paid = 0.0
        current_term_balance = 0.0
        arrears_balance = 0.0
        try:
            if inv and stu and inv.year and inv.term:
                from django.db.models import Sum as _Sum
                invs_this_term = Invoice.objects.filter(student=stu, year=inv.year, term=inv.term)
                current_term_billed = float(invs_this_term.aggregate(s=_Sum('amount'))['s'] or 0)
                pays_this_term = Payment.objects.filter(invoice__in=invs_this_term)
                current_term_paid = float(pays_this_term.aggregate(s=_Sum('amount'))['s'] or 0)
                current_term_balance = max(0.0, current_term_billed - current_term_paid)
                arrears_balance = max(0.0, student_balance - current_term_balance)
        except Exception:
            pass

        # Prepare school details (including absolute logo URL if available)
        def school_payload(school_obj):
            if not school_obj:
                return {'id': None, 'name': None}
            try:
                logo_url = school_obj.logo.url if getattr(school_obj, 'logo', None) else None
                if logo_url and request:
                    try:
                        logo_url = request.build_absolute_uri(logo_url)
                    except Exception:
                        pass
            except Exception:
                logo_url = None
            return {
                'id': getattr(school_obj, 'id', None),
                'name': str(school_obj) if school_obj else None,
                'address': getattr(school_obj, 'address', None),
                'motto': getattr(school_obj, 'motto', None),
                'logo_url': logo_url,
            }

        data = {
            'receipt_no': f"RCPT-{pay.id}",
            'date': getattr(pay, 'created_at', None),
            'amount': float(pay.amount),
            'method': pay.method,
            'reference': pay.reference,
            'recorded_by': getattr(getattr(pay, 'recorded_by', None), 'id', None),
            'recorded_by_name': (lambda u: (
                (getattr(u, 'name', None) or getattr(u, 'full_name', None) or
                 (getattr(u, 'get_full_name', lambda: '')() or getattr(u, 'get_username', lambda: '')()) or str(u))
                if u else None))(getattr(pay, 'recorded_by', None)),
            'invoice': inv.id if inv else None,
            'invoice_amount': invoice_amount if inv else None,
            'invoice_paid': paid_on_invoice,
            'invoice_balance': invoice_balance,
            'student': {
                'id': getattr(stu, 'id', None),
                'name': getattr(stu, 'name', None),
                'class': str(getattr(stu, 'klass', '') or ''),
                'admission_no': getattr(stu, 'admission_no', None),
            },
            'school': school_payload(school),
            'student_total_billed': stu_total_billed,
            'student_total_paid': stu_total_paid,
            'student_balance': student_balance,
            'current_term_billed': current_term_billed,
            'current_term_paid': current_term_paid,
            'current_term_balance': current_term_balance,
            'arrears_balance': arrears_balance,
        }

        # Include fee assignments for the student's class for the invoice's period
        try:
            if inv and stu and getattr(stu, 'klass_id', None) and inv.year and inv.term:
                qs = ClassFee.objects.filter(klass_id=stu.klass_id, year=inv.year, term=inv.term).select_related('fee_category')
                data['fee_assignments'] = [
                    {
                        'category': getattr(cf.fee_category, 'name', None),
                        'amount': float(cf.amount or 0),
                        'year': cf.year,
                        'term': cf.term,
                        'due_date': cf.due_date,
                    }
                    for cf in qs
                ]
        except Exception:
            pass
        return Response(data)


class FeeCategoryViewSet(viewsets.ModelViewSet):
    queryset = FeeCategory.objects.all()
    serializer_class = FeeCategorySerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'name']

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        serializer.save(school=school)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        else:
            qs = qs.none()
        return qs

    def list(self, request, *args, **kwargs):
        # Auto-seed default methods for the school when none exist
        school = getattr(getattr(request, 'user', None), 'school', None)
        if school and not PaymentMethod.objects.filter(school=school).exists():
            for key in ['cash','mpesa','bank','cheque']:
                PaymentMethod.objects.get_or_create(school=school, key=key, defaults={'enabled': True})
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        serializer.save(school=school)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except Exception as e:
            # Convert model-level protection errors into a user-friendly response
            msg = str(e)
            if 'Boarding fees' in msg or 'protected' in msg.lower():
                return Response({'detail': "'Boarding fees' category cannot be deleted."}, status=400)
            return Response({'detail': msg or 'Deletion failed'}, status=400)


class ClassFeeViewSet(viewsets.ModelViewSet):
    queryset = ClassFee.objects.all()
    serializer_class = ClassFeeSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['fee_category', 'klass', 'year', 'term']

    def get_queryset(self):
        qs = super().get_queryset().select_related('fee_category', 'klass')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(klass__school=school, fee_category__school=school)
        return qs

    def perform_create(self, serializer):
        class_fee = serializer.save()
        # Auto-generate invoices for all students in the class for the given period
        students = Student.objects.filter(klass=class_fee.klass)
        for stu in students:
            # Avoid duplicate invoice for same category/year/term
            inv, created = Invoice.objects.get_or_create(
                student=stu,
                category=class_fee.fee_category,
                year=class_fee.year,
                term=class_fee.term,
                defaults={
                    'amount': class_fee.amount,
                    'due_date': class_fee.due_date,
                    'status': 'unpaid',
                }
            )
            if not created:
                # If invoice exists, update amount and due date if needed
                inv.amount = class_fee.amount
                inv.due_date = class_fee.due_date
                inv.save(update_fields=['amount', 'due_date'])

    def perform_update(self, serializer):
        """When a ClassFee is updated, ensure all affected students' invoices are
        created/updated so student balances always reflect all assignments for their class.
        """
        instance = serializer.save()
        students = Student.objects.filter(klass=instance.klass)
        for stu in students:
            inv, created = Invoice.objects.get_or_create(
                student=stu,
                category=instance.fee_category,
                year=instance.year,
                term=instance.term,
                defaults={
                    'amount': instance.amount,
                    'due_date': instance.due_date,
                    'status': 'unpaid',
                }
            )
            if not created:
                updated = False
                if inv.amount != instance.amount:
                    inv.amount = instance.amount; updated = True
                if inv.due_date != instance.due_date:
                    inv.due_date = instance.due_date; updated = True
                if updated:
                    inv.save(update_fields=['amount','due_date'])

    def create(self, request, *args, **kwargs):
        """Support assigning the same fee to multiple classes by accepting a
        write-only 'klasses' array in the request body. Falls back to default
        single-class behavior if 'klasses' is not provided.
        """
        data = request.data
        klasses = data.get('klasses')

        # Normalize possible string inputs to list where applicable
        if isinstance(klasses, str):
            # Accept comma separated values "1,2,3"
            try:
                klasses = [int(k.strip()) for k in klasses.split(',') if k.strip()]
            except Exception:
                klasses = None

        if not klasses:
            # Standard single create path
            return super().create(request, *args, **kwargs)

        # Validate common fields once
        created = []
        errors = []
        common = {
            'fee_category': data.get('fee_category'),
            'amount': data.get('amount'),
            'year': data.get('year'),
            'term': data.get('term'),
            'due_date': data.get('due_date'),
        }
        for kid in klasses:
            item = {**common, 'klass': kid}
            serializer = self.get_serializer(data=item)
            if serializer.is_valid():
                instance = serializer.save()
                # generate invoices per created class fee
                students = Student.objects.filter(klass_id=kid)
                for stu in students:
                    inv, inv_created = Invoice.objects.get_or_create(
                        student=stu,
                        category=instance.fee_category,
                        year=instance.year,
                        term=instance.term,
                        defaults={
                            'amount': instance.amount,
                            'due_date': instance.due_date,
                            'status': 'unpaid',
                        }
                    )
                    if not inv_created:
                        inv.amount = instance.amount
                        inv.due_date = instance.due_date
                        inv.save(update_fields=['amount', 'due_date'])
                created.append(self.get_serializer(instance).data)
            else:
                errors.append({'klass': kid, 'errors': serializer.errors})

        status_code = 201 if created and not errors else (207 if created and errors else 400)
        return Response({'created': created, 'errors': errors}, status=status_code)
        

# Public endpoint for Safaricom Daraja STK callback
@csrf_exempt
def mpesa_callback(request):
    logger = logging.getLogger(__name__)
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        data = {}

    # Expected structure: { Body: { stkCallback: { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata: { Item: [ {Name, Value}, ... ] } } } }
    stk_cb = (
        data.get('Body', {})
            .get('stkCallback', {})
    )
    checkout_id = stk_cb.get('CheckoutRequestID')
    result_code = stk_cb.get('ResultCode')
    # Build a lookup for metadata items
    meta_items = stk_cb.get('CallbackMetadata', {}).get('Item', []) if isinstance(stk_cb.get('CallbackMetadata', {}), dict) else []
    meta = {item.get('Name'): item.get('Value') for item in meta_items if isinstance(item, dict)}
    receipt = meta.get('MpesaReceiptNumber') or meta.get('M-PESAReceiptNumber')
    amount = meta.get('Amount')
    phone = meta.get('PhoneNumber') or meta.get('MSISDN')

    # Find invoice by previously saved CheckoutRequestID
    invoice = None
    if checkout_id:
        invoice = Invoice.objects.filter(mpesa_transaction_id=checkout_id).first()

    logger.info("STK callback received", extra={'checkout_request_id': checkout_id, 'result_code': result_code})
    # If payment successful, record it
    if result_code == 0 and invoice and amount:
        pay = Payment.objects.create(
            invoice=invoice,
            amount=float(amount),
            method='mpesa',
            reference=receipt or (checkout_id or ''),
            recorded_by=None,
        )
        logger.info("Payment recorded from callback", extra={'invoice_id': invoice.id, 'payment_id': pay.id, 'receipt': receipt})
        # Update invoice status
        totals = invoice.payments.aggregate(s=Sum('amount'))
        total_paid = float(totals['s'] or 0)
        if total_paid >= float(invoice.amount):
            invoice.status = 'paid'
        elif 0 < total_paid < float(invoice.amount):
            invoice.status = 'partial'
        else:
            invoice.status = 'unpaid'
        invoice.save(update_fields=['status'])

    # Respond to Daraja per spec
    return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})


# Public endpoint for Co-op gateway STK callback (expected same Safaricom structure)
@csrf_exempt
def coop_mpesa_callback(request):
    logger = logging.getLogger(__name__)
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        data = {}

    stk_cb = (
        data.get('Body', {})
            .get('stkCallback', {})
    )
    checkout_id = stk_cb.get('CheckoutRequestID')
    result_code = stk_cb.get('ResultCode')
    meta_items = stk_cb.get('CallbackMetadata', {}).get('Item', []) if isinstance(stk_cb.get('CallbackMetadata', {}), dict) else []
    meta = {item.get('Name'): item.get('Value') for item in meta_items if isinstance(item, dict)}
    receipt = meta.get('MpesaReceiptNumber') or meta.get('M-PESAReceiptNumber')
    amount = meta.get('Amount')

    invoice = Invoice.objects.filter(mpesa_transaction_id=checkout_id).first() if checkout_id else None
    logger.info("Co-op STK callback received", extra={'checkout_request_id': checkout_id, 'result_code': result_code})

    if result_code == 0 and invoice and amount:
        pay = Payment.objects.create(
            invoice=invoice,
            amount=float(amount),
            method='mpesa',
            reference=receipt or (checkout_id or ''),
            recorded_by=None,
        )
        totals = invoice.payments.aggregate(s=Sum('amount'))
        total_paid = float(totals['s'] or 0)
        if total_paid >= float(invoice.amount):
            invoice.status = 'paid'
        elif 0 < total_paid < float(invoice.amount):
            invoice.status = 'partial'
        else:
            invoice.status = 'unpaid'
        invoice.save(update_fields=['status'])

    return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})


class MpesaConfigViewSet(viewsets.ModelViewSet):
    queryset = MpesaConfig.objects.all()
    serializer_class = MpesaConfigSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school']

    def get_queryset(self):
        qs = super().get_queryset()
        # Scope to the admin/finance user's school
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        else:
            # No school: empty queryset for safety
            qs = qs.none()
        return qs

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        serializer.save(school=school)


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'name']

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        serializer.save(school=school)


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'category', 'date']

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        serializer.save(school=school, recorded_by=self.request.user)


class PocketMoneyWalletViewSet(viewsets.ModelViewSet):
    queryset = PocketMoneyWallet.objects.all()
    serializer_class = PocketMoneyWalletSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['student']

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(student__klass__school=school)
        return qs


class PocketMoneyTransactionViewSet(viewsets.ModelViewSet):
    queryset = PocketMoneyTransaction.objects.all()
    serializer_class = PocketMoneyTransactionSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['wallet', 'transaction_type']

    def get_queryset(self):
        qs = super().get_queryset()
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(wallet__student__klass__school=school)
        return qs

    def perform_create(self, serializer):
        transaction = serializer.save(recorded_by=self.request.user)
        wallet = transaction.wallet
        if transaction.transaction_type == 'deposit':
            wallet.balance += transaction.amount
        elif transaction.transaction_type == 'withdrawal':
            wallet.balance -= transaction.amount
        wallet.save()
