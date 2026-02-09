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
from communications.utils import notify_payment_received, create_message_for_role, resolve_default_sender_id, send_sms, send_email_safe
from academics.models import Student, Subject


from .mpesa import MpesaClient
from .coop_stk import CoopStkClient
from .coop_api import CoopApiClient
from .models import Invoice, Payment, FeeCategory, ClassFee, MpesaConfig, ExpenseCategory, Expense, PocketMoneyWallet, PocketMoneyTransaction, PaymentMethod, IncomingPayment, StudentFee, StaffPayroll, StaffPayslip
from .serializers import InvoiceSerializer, PaymentSerializer, FeeCategorySerializer, ClassFeeSerializer, MpesaConfigSerializer, ExpenseCategorySerializer, ExpenseSerializer, PocketMoneyWalletSerializer, PocketMoneyTransactionSerializer, PaymentMethodSerializer, IncomingPaymentSerializer, StudentFeeSerializer, StaffPayrollSerializer, StaffPayslipSerializer
def _log_payment_health_event(*, school_id: int | None, method: str, ok: bool, context: str = '') -> None:
    try:
        from accounts.models import SystemHealthEvent
        m = str(method or '').lower()
        if m == 'mpesa':
            comp = SystemHealthEvent.Component.PAYMENT_MPESA
        elif m == 'bank':
            comp = SystemHealthEvent.Component.PAYMENT_BANK
        else:
            return
        SystemHealthEvent.objects.create(
            school_id=school_id,
            component=comp,
            ok=bool(ok),
            context=(context or '')[:255],
        )
    except Exception:
        pass

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
            'my', 'my_summary', 'stk_push', 'pay_balance_stk',
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
        prepaid_qs = IncomingPayment.objects.filter(matched_student_id=student_id, source='mpesa')
        if school:
            prepaid_qs = prepaid_qs.filter(matched_student__klass__school=school)
        prepaid_total = prepaid_qs.filter(status__in=['matched', 'reconciled'], notes__icontains='prepaid').aggregate(s=Sum('amount'))['s'] or 0
        balance = (total_billed or 0) - (total_paid or 0) - (prepaid_total or 0)
        return Response({
            'total_billed': float(total_billed),
            'total_paid': float(total_paid),
            'prepaid': float(prepaid_total or 0),
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
        # Apply standard DRF pagination so large invoice lists remain fast
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
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
        prepaid_qs = IncomingPayment.objects.filter(matched_student_id=student_id, source='mpesa')
        if school:
            prepaid_qs = prepaid_qs.filter(matched_student__klass__school=school)
        prepaid_total = prepaid_qs.filter(status__in=['matched', 'reconciled'], notes__icontains='prepaid').aggregate(s=Sum('amount'))['s'] or 0
        balance = (total_billed or 0) - (total_paid or 0) - (prepaid_total or 0)
        return Response({
            'total_billed': float(total_billed),
            'total_paid': float(total_paid),
            'prepaid': float(prepaid_total or 0),
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
        # Use grouped aggregations instead of per-student aggregate queries for performance
        student_ids = list(stu_qs.values_list('id', flat=True))

        if student_ids:
            inv_qs = Invoice.objects.filter(student_id__in=student_ids)
            if school:
                inv_qs = inv_qs.filter(student__klass__school=school)
            inv_totals = {
                row['student_id']: float(row['total'] or 0)
                for row in inv_qs.values('student_id').annotate(total=Sum('amount'))
            }

            pay_qs = Payment.objects.filter(invoice__student_id__in=student_ids)
            if school:
                pay_qs = pay_qs.filter(invoice__student__klass__school=school)
            pay_totals = {
                row['invoice__student_id']: float(row['total'] or 0)
                for row in pay_qs.values('invoice__student_id').annotate(total=Sum('amount'))
            }
        else:
            inv_totals = {}
            pay_totals = {}

        data = []
        # select_related to avoid extra queries when reading klass
        for stu in stu_qs.select_related('klass'):
            total_billed = inv_totals.get(stu.id, 0.0)
            total_paid = pay_totals.get(stu.id, 0.0)
            balance = float(total_billed) - float(total_paid)
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

        student_ids = list(stu_qs.values_list('id', flat=True))

        if student_ids:
            inv_qs = Invoice.objects.filter(student_id__in=student_ids)
            if school:
                inv_qs = inv_qs.filter(student__klass__school=school)
            inv_totals = {
                row['student_id']: float(row['total'] or 0)
                for row in inv_qs.values('student_id').annotate(total=Sum('amount'))
            }

            pay_qs = Payment.objects.filter(invoice__student_id__in=student_ids)
            if school:
                pay_qs = pay_qs.filter(invoice__student__klass__school=school)
            pay_totals = {
                row['invoice__student_id']: float(row['total'] or 0)
                for row in pay_qs.values('invoice__student_id').annotate(total=Sum('amount'))
            }
        else:
            inv_totals = {}
            pay_totals = {}

        rows = []
        for stu in stu_qs.select_related('klass'):
            total_billed = inv_totals.get(stu.id, 0.0)
            total_paid = pay_totals.get(stu.id, 0.0)
            balance = float(total_billed) - float(total_paid)
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
            _log_payment_health_event(school_id=None, method=str(request.data.get('method') or ''), ok=False, context='invoice_not_found')
            return Response({'detail': 'Invoice not found'}, status=404)

        user = request.user
        student_id = Student.objects.filter(user=user).values_list('id', flat=True).first()
        # Permission: students must own the invoice
        if user.role not in ('admin','finance'):
            if not student_id or invoice.student_id != student_id:
                _log_payment_health_event(school_id=getattr(getattr(invoice.student, 'klass', None), 'school_id', None), method=str(request.data.get('method') or ''), ok=False, context='forbidden')
                return Response({'detail': 'Forbidden'}, status=403)

        try:
            amount = float(request.data.get('amount', 0))
        except (TypeError, ValueError):
            _log_payment_health_event(school_id=getattr(getattr(invoice.student, 'klass', None), 'school_id', None), method=str(request.data.get('method') or ''), ok=False, context='invalid_amount')
            return Response({'detail': 'Invalid amount'}, status=400)
        if amount <= 0:
            _log_payment_health_event(school_id=getattr(getattr(invoice.student, 'klass', None), 'school_id', None), method=str(request.data.get('method') or ''), ok=False, context='amount_le_0')
            return Response({'detail': 'Amount must be greater than 0'}, status=400)

        method = request.data.get('method') or 'mpesa'
        # Enforce enabled methods per school
        school = getattr(invoice.student.klass, 'school', None)
        enabled = self._enabled_methods_for_school(school)
        if str(method).lower() not in enabled:
            _log_payment_health_event(school_id=getattr(school, 'id', None), method=str(method), ok=False, context='method_disabled')
            return Response({'detail': f'Payment method "{method}" is disabled by admin'}, status=400)
        # Students can only record M-Pesa payments; Bank/Cash restricted to Admin/Finance
        if user.role not in ('admin','finance') and str(method).lower() != 'mpesa':
            _log_payment_health_event(school_id=getattr(school, 'id', None), method=str(method), ok=False, context='student_restricted')
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

        _log_payment_health_event(school_id=getattr(school, 'id', None), method=str(method), ok=True, context=f"payment_id:{pay.id}")

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
            # Notify student/guardian of payment and updated balance
            try:
                notify_payment_received(inv, pay)
            except Exception:
                pass
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

    @action(detail=True, methods=['post'], url_path='stk_push')
    def stk_push(self, request, pk=None):
        """Initiate an Mpesa Daraja STK push for this invoice.
        Body: { phone: string, amount?: number, simulate?: bool }
        """
        invoice = Invoice.objects.select_related('student', 'student__klass').filter(pk=pk).first()
        if not invoice:
            return Response({'detail': 'Invoice not found'}, status=404)

        try:
            logger = logging.getLogger(__name__)
            user = request.user
            if getattr(user, 'role', None) not in ('admin', 'finance'):
                from academics.models import Student as _Student
                stu_id = _Student.objects.filter(user=user).values_list('id', flat=True).first()
                if not stu_id or invoice.student_id != stu_id:
                    return Response({'detail': 'Forbidden'}, status=403)

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

            school_id = getattr(getattr(invoice.student.klass, 'school', None), 'id', None)
            config = MpesaConfig.objects.filter(school_id=invoice.student.klass.school_id).first() if school_id else None
            required = ('MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORT_CODE', 'MPESA_PASSKEY')
            env_have_creds = all(os.getenv(k) for k in required)
            have_cfg_creds = False
            if config:
                # Guard against common misconfiguration: bogus shortcode/passkey saved in DB
                try:
                    sc = str(getattr(config, 'short_code', '') or '').strip()
                    pk = str(getattr(config, 'passkey', '') or '').strip()
                    looks_valid = sc.isdigit() and len(sc) >= 5 and len(pk) >= 10
                except Exception:
                    looks_valid = False
                have_cfg_creds = looks_valid and all([config.consumer_key, config.consumer_secret, config.short_code, config.passkey])
            have_creds = have_cfg_creds or env_have_creds
            default_sim = 'false' if have_creds else 'true'
            simulate = str(request.data.get('simulate', default_sim)).lower() in ('1', 'true', 'yes')
        except Exception as e:
            return Response({'detail': f'Invalid request: {e}'}, status=400)

        sch = getattr(invoice.student.klass, 'school', None)
        enabled = self._enabled_methods_for_school(sch)
        if 'mpesa' not in enabled:
            return Response({'detail': 'Mpesa payments are disabled by admin'}, status=400)

        logger.info("STK request init", extra={
            'invoice_id': invoice.id,
            'phone': phone[-4:],
            'amount': amount,
            'simulate': simulate,
        })
        if simulate:
            _log_payment_health_event(school_id=school_id, method='mpesa', ok=True, context='stk_pending_simulated')
            return Response({'status': 'pending', 'message': 'STK simulated.'}, status=202)

        if not have_creds:
            _log_payment_health_event(school_id=school_id, method='mpesa', ok=True, context='stk_pending_no_creds')
            return Response({'status': 'pending', 'message': 'STK credentials not configured; set MPESA_* env vars.'}, status=202)

        try:
            # Prefer per-school config if it looks valid; otherwise fall back to env.
            # If Daraja OAuth fails for config, also fall back to env automatically.
            if config and have_cfg_creds:
                try:
                    client = MpesaClient(
                        consumer_key=config.consumer_key,
                        consumer_secret=config.consumer_secret,
                        short_code=config.short_code,
                        passkey=config.passkey,
                        callback_url=(config.callback_url or os.getenv('MPESA_CALLBACK_URL')),
                        environment=config.environment,
                    )
                    resp = client.stk_push(phone=str(phone), amount=amount, account_ref=f"INV{invoice.id}")
                except Exception:
                    client = MpesaClient()
                    resp = client.stk_push(phone=str(phone), amount=amount, account_ref=f"INV{invoice.id}")
            else:
                client = MpesaClient()
                resp = client.stk_push(phone=str(phone), amount=amount, account_ref=f"INV{invoice.id}")
            checkout_id = resp.get('CheckoutRequestID') or ''
            if checkout_id:
                invoice.mpesa_transaction_id = checkout_id
                invoice.save(update_fields=['mpesa_transaction_id'])
            logger.info("STK initiated", extra={'invoice_id': invoice.id, 'checkout_request_id': checkout_id})
            return Response({'status': 'pending', 'message': 'STK initiated', 'daraja': resp}, status=202)
        except Exception as e:
            logger.exception("STK initiation failed", extra={'invoice_id': invoice.id})
            _log_payment_health_event(school_id=school_id, method='mpesa', ok=False, context='stk_initiation_failed')
            return Response({'detail': f'STK error: {e}'}, status=500)

    @action(detail=False, methods=['post'], url_path='pay-balance-stk')
    def pay_balance_stk(self, request):
        """Initiate an STK push to pay against overall balance (no specific invoice).
        Body: { phone: string, amount: number, simulate?: bool, student_id?: id }
        """
        user = request.user
        sid = request.data.get('student_id')
        if sid and getattr(user, 'role', None) in ('admin', 'finance'):
            stu = Student.objects.filter(id=sid).first()
        else:
            stu = Student.objects.filter(user=user).first()
        if not stu:
            return Response({'detail': 'Student not found or not specified'}, status=403)

        try:
            phone = (str(request.data.get('phone') or '').strip())
            if phone.startswith('+'):
                phone = phone[1:]
            if phone.startswith('0') and len(phone) == 10:
                phone = '254' + phone[1:]
            if not phone:
                return Response({'detail': 'phone is required'}, status=400)
            amount = float(request.data.get('amount') or 0)
            if amount <= 0:
                return Response({'detail': 'Amount must be greater than 0'}, status=400)
        except Exception as e:
            return Response({'detail': f'Invalid request: {e}'}, status=400)

        school = getattr(stu.klass, 'school', None)
        config = MpesaConfig.objects.filter(school=school).first() if school else None
        required = ('MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORT_CODE', 'MPESA_PASSKEY')
        env_have_creds = all(os.getenv(k) for k in required)
        have_cfg_creds = False
        if config:
            try:
                sc = str(getattr(config, 'short_code', '') or '').strip()
                pk = str(getattr(config, 'passkey', '') or '').strip()
                looks_valid = sc.isdigit() and len(sc) >= 5 and len(pk) >= 10
            except Exception:
                looks_valid = False
            have_cfg_creds = looks_valid and all([config.consumer_key, config.consumer_secret, config.short_code, config.passkey])
        have_creds = have_cfg_creds or env_have_creds

        default_sim = 'false' if have_creds else 'true'
        simulate = str(request.data.get('simulate', default_sim)).lower() in ('1', 'true', 'yes')

        enabled = self._enabled_methods_for_school(school)
        if 'mpesa' not in enabled:
            return Response({'detail': 'Mpesa payments are disabled'}, status=400)
        if simulate:
            _log_payment_health_event(school_id=getattr(school, 'id', None), method='mpesa', ok=True, context='stk_simulated')
            return Response({'status': 'pending', 'message': 'STK simulated.'}, status=202)
        if not have_creds:
            return Response({'detail': 'Mpesa credentials not configured'}, status=400)

        try:
            account_ref = stu.admission_no or f"STU{stu.id}"
            if config and have_cfg_creds:
                try:
                    client = MpesaClient(
                        consumer_key=config.consumer_key,
                        consumer_secret=config.consumer_secret,
                        short_code=config.short_code,
                        passkey=config.passkey,
                        callback_url=(config.callback_url or os.getenv('MPESA_CALLBACK_URL')),
                        environment=config.environment,
                    )
                    resp = client.stk_push(phone=str(phone), amount=amount, account_ref=account_ref)
                except Exception:
                    client = MpesaClient()
                    resp = client.stk_push(phone=str(phone), amount=amount, account_ref=account_ref)
            else:
                client = MpesaClient()
                resp = client.stk_push(phone=str(phone), amount=amount, account_ref=account_ref)
            return Response({'status': 'pending', 'message': 'STK initiated', 'daraja': resp}, status=202)
        except Exception as e:
            logging.getLogger(__name__).exception('STK initiation failed')
            return Response({'detail': f'STK error: {e}'}, status=500)


class IncomingPaymentViewSet(viewsets.ModelViewSet):
    queryset = IncomingPayment.objects.all()
    serializer_class = IncomingPaymentSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'source', 'matched_student']

    def get_queryset(self):
        qs = super().get_queryset()
        # Scope by school when possible (if matched_student exists)
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(matched_student__klass__school=school) | qs.filter(matched_student__isnull=True)
        return qs.order_by('-created_at')

    def _extract_admission_tokens(self, text: str) -> list[str]:
        try:
            import re
            raw = (text or '').strip()
            if not raw:
                return []
            # Split on non-alphanumeric, also include contiguous alphanum strings
            toks = re.split(r"[^A-Za-z0-9]+", raw.upper())
            toks = [t for t in toks if t]
            # Also keep versions without leading zeros
            out = set()
            for t in toks:
                out.add(t)
                out.add(t.lstrip('0'))
            return [t for t in out if t]
        except Exception:
            return []

    def _find_student_by_any(self, combined: str):
        tokens = self._extract_admission_tokens(combined)
        if not tokens:
            return None, 0.0
        # Try exact admission_no match among tokens
        qs = Student.objects.filter(admission_no__in=tokens)
        count = qs.count()
        if count == 1:
            return qs.first(), 1.0
        # Try case-insensitive exact
        qs = Student.objects.filter(admission_no__iexact=tokens[0])
        if qs.count() == 1:
            return qs.first(), 0.9
        # No confident match
        return None, 0.0

    def _allocate_fifo(self, student: Student, amount: float, method: str, reference: str, recorded_by):
        created_ids = []
        remaining = float(amount)
        inv_qs = Invoice.objects.filter(student=student).order_by('due_date', 'created_at', 'id')
        for inv in inv_qs:
            if remaining <= 0:
                break
            paid_so_far = float(inv.payments.aggregate(s=Sum('amount'))['s'] or 0)
            inv_balance = float(inv.amount) - paid_so_far
            if inv_balance <= 0:
                continue
            alloc = min(remaining, inv_balance)
            pay = Payment.objects.create(
                invoice=inv,
                amount=float(alloc),
                method=method,
                reference=reference,
                recorded_by=recorded_by if getattr(recorded_by, 'is_authenticated', False) else None,
            )
            # Notify student/guardian of payment and updated balance
            try:
                notify_payment_received(inv, pay)
            except Exception:
                pass
            created_ids.append(pay.id)
            # update invoice status
            new_paid = paid_so_far + float(alloc)
            if new_paid >= float(inv.amount):
                inv.status = 'paid'
            elif new_paid > 0:
                inv.status = 'partial'
            else:
                inv.status = 'unpaid'
            inv.save(update_fields=['status'])
            remaining -= alloc
        return created_ids, remaining

    @action(detail=False, methods=['post'], url_path='verify_mpesa')
    def verify_mpesa(self, request):
        receipt = str(request.data.get('receipt') or request.data.get('reference') or '').strip()
        if not receipt:
            return Response({'detail': 'receipt (M-Pesa code) is required'}, status=400)
        raw_amount = request.data.get('amount', None)
        amount = None
        if raw_amount is not None and str(raw_amount).strip() != '':
            try:
                amount = float(raw_amount)
            except (TypeError, ValueError):
                return Response({'detail': 'Invalid amount'}, status=400)
            if amount <= 0:
                return Response({'detail': 'Amount must be greater than 0'}, status=400)
        sid = request.data.get('student_id') or request.data.get('student')
        if not sid:
            return Response({'detail': 'student_id is required'}, status=400)

        school = getattr(getattr(request, 'user', None), 'school', None)
        stu_qs = Student.objects.filter(id=sid)
        if school:
            stu_qs = stu_qs.filter(klass__school=school)
        student = stu_qs.first()
        if not student:
            return Response({'detail': 'Student not found'}, status=404)

        existing_pay = Payment.objects.filter(reference__iexact=receipt, invoice__student=student).order_by('-id').first()
        if existing_pay:
            return Response({'status': 'exists', 'payment': PaymentSerializer(existing_pay).data}, status=200)

        # Receipt-only mode: just check existence and return not_found (no allocation possible without amount)
        if amount is None:
            existing_inc = IncomingPayment.objects.filter(reference__iexact=receipt, matched_student=student).order_by('-id').first()
            if existing_inc:
                return Response({'status': 'exists', 'incoming_payment': IncomingPaymentSerializer(existing_inc).data}, status=200)
            return Response({'status': 'not_found', 'detail': 'No payment found for this M-Pesa Transaction ID.'}, status=404)

        phone = str(request.data.get('phone') or '').strip()
        account_ref = str(request.data.get('account_ref') or request.data.get('accountReference') or (student.admission_no or '')).strip()

        inc = IncomingPayment.objects.create(
            source='mpesa',
            external_id=receipt[:100],
            amount=float(amount),
            currency='KES',
            reference=receipt[:100],
            narration='Manual verify',
            account_ref=account_ref[:100],
            phone=phone[:50],
            matched_student=student,
            status='matched',
            notes='verified manually',
        )

        created_ids, remaining = self._allocate_fifo(student, float(amount), 'mpesa', receipt, request.user)
        if created_ids:
            inc.status = 'reconciled'
            inc.matched_invoice = Invoice.objects.filter(student=student).order_by('-created_at', '-id').first()
            inc.save(update_fields=['status', 'matched_invoice'])

        if remaining > 0:
            try:
                IncomingPayment.objects.create(
                    source='mpesa',
                    external_id=f"{receipt[:90]}_PREPAID",
                    amount=float(remaining),
                    currency='KES',
                    reference=receipt[:100],
                    narration='Manual verify',
                    account_ref=account_ref[:100],
                    phone=phone[:50],
                    matched_student=student,
                    status='matched',
                    notes='prepaid credit (manual verify)',
                )
            except Exception:
                pass

        return Response({
            'status': 'verified',
            'incoming_payment': IncomingPaymentSerializer(inc).data,
            'created_payments': created_ids,
            'amount_allocated': float(amount - remaining),
            'amount_unallocated': float(remaining),
        }, status=201)

    @action(detail=False, methods=['post'], url_path='ingest', parser_classes=[JSONParser])
    def ingest(self, request):
        data = request.data or {}
        source = str(data.get('source') or 'coop').lower()
        if source not in ('coop', 'bank', 'mpesa'):
            source = 'coop'
        amt_raw = data.get('amount') or data.get('transaction_amount') or data.get('TransactionAmount')
        try:
            amount = float(amt_raw or 0)
        except Exception:
            return Response({'detail': 'Invalid amount'}, status=400)
        if not amount:
            return Response({'detail': 'Amount must be greater than 0'}, status=400)
        external_id = str(data.get('external_id') or data.get('transaction_id') or data.get('TransactionID') or '')[:100]
        reference = str(data.get('reference') or data.get('transaction_reference') or external_id)[:100]
        account_ref = str(data.get('account_ref') or data.get('AccountNumber') or data.get('account_number') or '')[:100]
        narration = str(data.get('narration') or data.get('description') or '')
        phone = str(data.get('phone') or data.get('MSISDN') or '')[:50]
        payer_name = str(data.get('payer_name') or data.get('CustomerName') or '')[:255]
        value_date = data.get('value_date') or data.get('transaction_date') or ''
        from django.utils.dateparse import parse_datetime, parse_date
        val_dt = None
        if value_date:
            val_dt = parse_datetime(value_date) or None
            if not val_dt:
                d = parse_date(value_date)
                if d is not None:
                    from datetime import datetime as _dt
                    val_dt = _dt.combine(d, _dt.min.time())
        obj, created_flag = IncomingPayment.objects.get_or_create(
            source=source,
            external_id=external_id,
            amount=amount,
            currency='KES',
            reference=reference,
            account_ref=account_ref,
            defaults={
                'narration': narration,
                'phone': phone,
                'payer_name': payer_name,
            },
        )
        if not created_flag:
            return Response({'detail': 'Duplicate or existing transaction', 'id': obj.id}, status=200)
        if val_dt is not None:
            obj.value_date = val_dt
            obj.save(update_fields=['value_date'])

        combined = ' '.join(filter(None, [obj.reference, obj.narration, obj.account_ref]))
        stu, conf = self._find_student_by_any(combined)
        auto_conf = 0.99
        if stu:
            obj.matched_student = stu
            obj.match_confidence = conf
            if conf >= auto_conf:
                method = 'bank'
                reference_str = obj.reference or obj.external_id or ''
                created_ids, remaining = self._allocate_fifo(stu, float(obj.amount), method, reference_str, request.user)
                if created_ids:
                    obj.status = 'reconciled'
                    obj.matched_invoice = Invoice.objects.filter(student=stu).order_by('-created_at', '-id').first()
                else:
                    obj.status = 'matched'
            else:
                obj.status = 'matched'
            obj.save(update_fields=['matched_student','match_confidence','status','matched_invoice'])
        return Response({'id': obj.id, 'status': obj.status, 'matched_student': getattr(obj.matched_student, 'id', None), 'match_confidence': obj.match_confidence}, status=201)

    @action(detail=False, methods=['post'], url_path='import_statement', parser_classes=[MultiPartParser, FormParser])
    def import_statement(self, request):
        file_obj = request.FILES.get('file') or request.FILES.get('statement')
        if not file_obj:
            return Response({'detail': 'Statement file is required (field name "file" or "statement")'}, status=400)

        source = str(request.data.get('source') or 'bank').lower()
        if source not in ('coop', 'bank'):
            source = 'bank'

        import csv
        from io import TextIOWrapper, StringIO

        # Read the uploaded file into text safely. Support generic text-based tables
        # (CSV, TSV, semicolon separated). If we cannot decode as text, return 400
        # instead of 500 so the user knows to upload a text export.
        try:
            raw = file_obj.read()
            if not raw:
                return Response({'detail': 'Uploaded file is empty.'}, status=400)
            try:
                text = raw.decode('utf-8')
            except Exception:
                try:
                    text = raw.decode('latin-1')
                except Exception:
                    return Response({'detail': 'Unsupported file encoding. Please upload a text-based export (CSV/TSV).'}, status=400)
        except Exception:
            return Response({'detail': 'Could not read uploaded file. Please try again or export as CSV.'}, status=400)

        # Try to sniff the delimiter (comma, semicolon, tab, etc.)
        try:
            sample = text[:4096]
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample)
            delimiter = dialect.delimiter
        except Exception:
            # Fallback to comma
            delimiter = ','

        reader = csv.DictReader(StringIO(text), delimiter=delimiter)
        if not reader.fieldnames:
            return Response({'detail': 'Could not detect columns in the file. Ensure the first row contains headers (e.g., Amount, Reference, AccountNumber).'}, status=400)

        created = 0
        skipped = 0

        for row in reader:
            if not row:
                continue
            # Normalise keys and values
            clean_row = { (k or '').strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k is not None }
            lower = {k.lower(): v for k, v in clean_row.items()}

            amt_raw = lower.get('amount') or lower.get('amt') or lower.get('transactionamount')
            ref = lower.get('reference') or lower.get('ref') or lower.get('transactionid') or ''
            acc_ref = lower.get('account_ref') or lower.get('accountref') or lower.get('account') or lower.get('accountnumber') or ''
            narr = lower.get('narration') or lower.get('details') or lower.get('description') or ''
            val_date = lower.get('valuedate') or lower.get('date') or ''

            try:
                amount = float(amt_raw or 0)
            except Exception:
                skipped += 1
                continue
            if not amount:
                skipped += 1
                continue

            try:
                obj, created_flag = IncomingPayment.objects.get_or_create(
                    source=source,
                    external_id=str(ref or '')[:100],
                    amount=amount,
                    currency='KES',
                    reference=str(ref or '')[:100],
                    account_ref=str(acc_ref or '')[:100],
                    defaults={
                        'narration': narr or '',
                    },
                )
                if not created_flag:
                    skipped += 1
                    continue
                if val_date:
                    from django.utils.dateparse import parse_datetime, parse_date
                    dt = parse_datetime(val_date) or None
                    if not dt:
                        d = parse_date(val_date)
                        if d is not None:
                            from datetime import datetime as _dt
                            dt = _dt.combine(d, _dt.min.time())
                    if dt is not None:
                        obj.value_date = dt
                        obj.save(update_fields=['value_date'])
                created += 1
            except Exception:
                skipped += 1

        if created == 0 and skipped > 0:
            # All rows failed; guide the user
            return Response({'detail': 'No rows could be imported. Ensure the file has columns like Amount, Reference, and AccountNumber or AccountRef.', 'imported': created, 'skipped': skipped}, status=400)

        return Response({'imported': created, 'skipped': skipped}, status=201 if created else 200)

    @action(detail=False, methods=['post'], url_path='fetch_coop')
    def fetch_coop(self, request):
        """Fetch transactions from Co-op OpenAPI and ingest as IncomingPayment.
        Body: {
          account_number: string (required),
          date_from: 'YYYY-MM-DD' (required),
          date_to: 'YYYY-MM-DD' (required),
          auto_match: bool (optional)
        }
        Requires COOP_* env vars to be configured. Uses admission/account refs for matching.
        """
        acct = request.data.get('account_number') or request.data.get('account')
        dfrom = request.data.get('date_from') or request.data.get('from')
        dto = request.data.get('date_to') or request.data.get('to')
        if not acct or not dfrom or not dto:
            return Response({'detail': 'account_number, date_from and date_to are required'}, status=400)
        try:
            client = CoopApiClient()
            items = client.get_transactions(str(acct), str(dfrom), str(dto))
        except Exception as e:
            return Response({'detail': f'Co-op API error: {e}'}, status=502)

        created = 0
        skipped = 0
        for it in items or []:
            # Normalize keys to lower-case for safety
            if isinstance(it, dict):
                lower = {str(k).lower(): v for k, v in it.items()}
            else:
                skipped += 1
                continue
            amt_raw = lower.get('amount') or lower.get('transactionamount') or lower.get('creditamount') or lower.get('debitamount')
            try:
                amount = float(amt_raw or 0)
            except Exception:
                skipped += 1
                continue
            if not amount:
                skipped += 1
                continue
            ref = lower.get('reference') or lower.get('ref') or lower.get('transactionid') or lower.get('transactionreference') or ''
            acc_ref = lower.get('accountref') or lower.get('account_reference') or lower.get('accountnumber') or ''
            narr = lower.get('narration') or lower.get('description') or lower.get('details') or ''
            val_date = lower.get('valuedate') or lower.get('transactiondate') or lower.get('date') or ''

            try:
                obj, created_flag = IncomingPayment.objects.get_or_create(
                    source='coop',
                    external_id=str(ref or '')[:100],
                    amount=amount,
                    currency='KES',
                    reference=str(ref or '')[:100],
                    account_ref=str(acc_ref or '')[:100],
                    defaults={
                        'narration': narr or '',
                    },
                )
                if not created_flag:
                    skipped += 1
                    continue
                if val_date:
                    from django.utils.dateparse import parse_datetime, parse_date
                    dt = parse_datetime(val_date) or None
                    if not dt:
                        d = parse_date(val_date)
                        if d is not None:
                            from datetime import datetime as _dt
                            dt = _dt.combine(d, _dt.min.time())
                    if dt is not None:
                        obj.value_date = dt
                        obj.save(update_fields=['value_date'])
                created += 1
            except Exception:
                skipped += 1

        # Optional auto-match pass after ingestion
        auto_match = str(request.data.get('auto_match', 'true')).lower() in ('1','true','yes')
        matched = 0
        if auto_match and created:
            qs = self.get_queryset().filter(status='pending', source='coop')[:500]
            for item in qs:
                combined = ' '.join(filter(None, [item.reference, item.narration, item.account_ref]))
                stu, conf = self._find_student_by_any(combined)
                if stu:
                    item.matched_student = stu
                    item.status = 'matched'
                    item.match_confidence = conf
                    item.save(update_fields=['matched_student','status','match_confidence'])
                    matched += 1

        return Response({'imported': created, 'skipped': skipped, 'auto_matched': matched}, status=201 if created else 200)

    @action(detail=False, methods=['post'], url_path='auto_match')
    def auto_match(self, request):
        """Try to match pending incoming payments to students by admission number.
        Returns counts and sample matches. Does not reconcile.
        Body: { limit?: number, status?: 'pending'|'matched' }
        """
        limit = 200
        try:
            if request.data.get('limit'):
                limit = min(1000, int(request.data.get('limit')))
        except Exception:
            pass
        status_filter = str(request.data.get('status') or 'pending')
        qs = self.get_queryset().filter(status=status_filter)[:limit]
        updated = 0
        results = []
        for item in qs:
            combined = ' '.join(filter(None, [item.reference, item.narration, item.account_ref]))
            stu, conf = self._find_student_by_any(combined)
            if stu:
                item.matched_student = stu
                item.status = 'matched'
                item.match_confidence = conf
                item.save(update_fields=['matched_student','status','match_confidence'])
                updated += 1
                results.append({'id': item.id, 'student_id': stu.id, 'admission_no': stu.admission_no, 'confidence': conf})
        return Response({'matched': updated, 'samples': results[:20]})

    @action(detail=False, methods=['post'], url_path='auto_reconcile')
    def auto_reconcile(self, request):
        try:
            limit = int(request.data.get('limit', 200))
        except Exception:
            limit = 200
        if limit <= 0:
            limit = 200
        try:
            min_conf = float(request.data.get('min_confidence', 0.9))
        except Exception:
            min_conf = 0.9
        method = str(request.data.get('method') or 'bank').lower()
        if method not in ('bank', 'mpesa', 'cash', 'cheque'):
            method = 'bank'
        source = request.data.get('source')
        qs = self.get_queryset().filter(status='matched')
        if source:
            qs = qs.filter(source=str(source).lower())
        qs = qs.filter(match_confidence__gte=min_conf)[:limit]
        reconciled = 0
        total_allocated = 0.0
        items = list(qs)
        for inc in items:
            if not inc.matched_student_id:
                continue
            student = inc.matched_student
            if not student:
                continue
            reference = inc.reference or inc.external_id or ''
            amount = float(inc.amount)
            created_ids, remaining = self._allocate_fifo(student, amount, method, reference, request.user)
            if created_ids:
                reconciled += 1
                total_allocated += (amount - remaining)
                inc.status = 'reconciled'
                inc.matched_invoice = Invoice.objects.filter(student=student).order_by('-created_at', '-id').first()
                inc.notes = (inc.notes or '')
                inc.save(update_fields=['status','matched_invoice','notes'])
        return Response({'reconciled': reconciled, 'total_allocated': total_allocated})

    @action(detail=True, methods=['post'], url_path='reconcile')
    def reconcile(self, request, pk=None):
        """Reconcile a single incoming payment by allocating it to a student's invoices.
        Body: { student?: id, admission_no?: string, invoice?: id, method?: 'bank'|'mpesa'|'cash' }
        - If invoice provided, allocate to that invoice only (up to remaining).
        - Otherwise allocate FIFO across student's invoices.
        Marks IncomingPayment as 'reconciled' and stores linkage.
        """
        try:
            inc = self.get_queryset().get(pk=pk)
        except IncomingPayment.DoesNotExist:
            return Response({'detail': 'Incoming payment not found'}, status=404)

        # Resolve student
        student = None
        sid = request.data.get('student')
        adm = request.data.get('admission_no')
        if sid:
            student = Student.objects.filter(id=sid).first()
        if not student and adm:
            student = Student.objects.filter(admission_no__iexact=str(adm).strip()).first()
        if not student and inc.matched_student_id:
            student = inc.matched_student
        if not student:
            # Try one more time from text
            combined = ' '.join(filter(None, [inc.reference, inc.narration, inc.account_ref]))
            student, _ = self._find_student_by_any(combined)
        if not student:
            return Response({'detail': 'No student resolved for reconciliation'}, status=400)

        method = str(request.data.get('method') or 'bank').lower()
        reference = inc.reference or inc.external_id or ''
        amount = float(inc.amount)

        created_ids = []
        remaining = amount

        inv_id = request.data.get('invoice')
        if inv_id:
            inv = Invoice.objects.filter(id=inv_id, student=student).first()
            if not inv:
                return Response({'detail': 'Invoice not found for student'}, status=404)
            paid_so_far = float(inv.payments.aggregate(s=Sum('amount'))['s'] or 0)
            inv_balance = float(inv.amount) - paid_so_far
            alloc = min(remaining, inv_balance)
            if alloc > 0:
                pay = Payment.objects.create(
                    invoice=inv,
                    amount=float(alloc),
                    method=method,
                    reference=reference,
                    recorded_by=request.user if request.user.is_authenticated else None,
                )
                created_ids.append(pay.id)
                # Notify student/guardian of payment and updated balance
                try:
                    notify_payment_received(inv, pay)
                except Exception:
                    pass
                new_paid = paid_so_far + float(alloc)
                if new_paid >= float(inv.amount):
                    inv.status = 'paid'
                elif new_paid > 0:
                    inv.status = 'partial'
                else:
                    inv.status = 'unpaid'
                inv.save(update_fields=['status'])
                remaining -= alloc
        else:
            created_ids, remaining = self._allocate_fifo(student, remaining, method, reference, request.user)

        # Update incoming payment status and links
        inc.matched_student = student
        if inv_id:
            inc.matched_invoice = Invoice.objects.filter(id=inv_id).first()
        inc.status = 'reconciled' if remaining <= 0.0001 or created_ids else 'matched'
        inc.save(update_fields=['matched_student','matched_invoice','status'])

        return Response({
            'incoming_payment': IncomingPaymentSerializer(inc).data,
            'created_payments': created_ids,
            'amount_allocated': float(amount - remaining),
            'amount_unallocated': float(remaining),
        }, status=200)

    @action(detail=False, methods=['post'], url_path='import-csv', parser_classes=[MultiPartParser, FormParser])
    def import_csv(self, request):
        """Import bank statement CSV as IncomingPayment entries.
        Expects a file under key 'file'. Optional fields in CSV (case-insensitive):
        amount, currency, reference, narration, account_ref, phone, value_date, external_id, source
        Query/body options:
          - auto_match: bool (default false) – run auto-match on created rows
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'file is required (CSV)'}, status=400)
        try:
            import csv
            import io
            from datetime import datetime
            content = file.read()
            if isinstance(content, bytes):
                text = content.decode('utf-8', errors='ignore')
            else:
                text = str(content)
            reader = csv.DictReader(io.StringIO(text))
        except Exception as e:
            return Response({'detail': f'Invalid CSV: {e}'}, status=400)

        def parse_float(v):
            try:
                return float(str(v).strip())
            except Exception:
                return None

        def parse_date(v):
            if not v:
                return None
            s = str(v).strip()
            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S'):
                try:
                    # naive datetime; DB will store as naive/aware depending on settings
                    return datetime.strptime(s, fmt)
                except Exception:
                    continue
            try:
                return datetime.fromisoformat(s)
            except Exception:
                return None

        created = 0
        skipped = []
        created_ids = []
        for row in reader:
            try:
                low = { (k or '').strip().lower(): (v if v is not None else '') for k, v in row.items() }
                amount = parse_float(low.get('amount'))
                if amount is None or amount <= 0:
                    skipped.append({'row': low, 'reason': 'invalid amount'})
                    continue
                currency = (low.get('currency') or 'KES').strip() or 'KES'
                reference = (low.get('reference') or '').strip()
                narration = (low.get('narration') or '').strip()
                account_ref = (low.get('account_ref') or low.get('accountreference') or low.get('billrefnumber') or '').strip()
                phone = (low.get('phone') or '').strip()
                ext_id = (low.get('external_id') or low.get('externalid') or '').strip()
                source = (low.get('source') or 'bank').strip().lower()
                value_date = parse_date(low.get('value_date') or low.get('date'))

                # Simple de-duplication: prefer (source, external_id), otherwise (reference, amount, date)
                exists = False
                q = IncomingPayment.objects.all()
                if ext_id:
                    exists = q.filter(source=source, external_id=ext_id).exists()
                if not exists and reference and value_date:
                    exists = q.filter(reference=reference, amount=amount, value_date=value_date).exists()
                if exists:
                    skipped.append({'row': low, 'reason': 'duplicate'})
                    continue

                inc = IncomingPayment.objects.create(
                    source=source,
                    external_id=ext_id,
                    amount=amount,
                    currency=currency,
                    reference=reference,
                    narration=narration,
                    account_ref=account_ref,
                    phone=phone,
                    value_date=value_date,
                    status='pending',
                )
                created += 1
                created_ids.append(inc.id)
            except Exception as e:
                skipped.append({'row': row, 'reason': str(e)})

        # Optional auto-match
        auto_match = str(request.data.get('auto_match', 'false')).lower() in ('1','true','yes')
        matched_count = 0
        if auto_match and created_ids:
            for inc_id in created_ids:
                item = IncomingPayment.objects.filter(id=inc_id).first()
                if not item:
                    continue
                combined = ' '.join(filter(None, [item.reference, item.narration, item.account_ref]))
                stu, conf = self._find_student_by_any(combined)
                if stu:
                    item.matched_student = stu
                    item.status = 'matched'
                    item.match_confidence = conf
                    item.save(update_fields=['matched_student','status','match_confidence'])
                    matched_count += 1

        return Response({
            'created': created,
            'matched': matched_count,
            'skipped': len(skipped),
            'skipped_samples': skipped[:10],
            'created_ids': created_ids[:50],
        }, status=201 if created else 200)

    @action(detail=True, methods=['post'], url_path='stk_push')
    def stk_push(self, request, pk=None):
        """Initiate an Mpesa STK push for this invoice.
        Body: { phone: string, amount?: number, simulate?: bool }
        """
        # Fetch by primary key directly; enforce authorization checks below
        invoice = Invoice.objects.select_related('student', 'student__klass').filter(pk=pk).first()
        if not invoice:
            return Response({'detail': 'Invoice not found'}, status=404)

        try:
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
        except Exception as e:
            return Response({'detail': f'Invalid request: {e}'}, status=400)

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
            _log_payment_health_event(school_id=getattr(getattr(invoice.student.klass, 'school', None), 'id', None), method='mpesa', ok=True, context='stk_pending_simulated')
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
                _log_payment_health_event(school_id=getattr(getattr(invoice.student.klass, 'school', None), 'id', None), method='mpesa', ok=False, context='stk_initiation_failed')
                return Response({'detail': f'STK error: {e}'}, status=500)
        # Fallback mocked when credentials missing
        _log_payment_health_event(school_id=getattr(getattr(invoice.student.klass, 'school', None), 'id', None), method='mpesa', ok=True, context='stk_pending_no_creds')
        return Response({'status':'pending','message':'STK credentials not configured; set MPESA_* env vars or use simulate=true.'}, status=202)

    @action(detail=False, methods=['post'], url_path='pay-balance-stk')
    def pay_balance_stk(self, request):
        """Initiate an STK push to pay against overall balance (no specific invoice).
        Body: { phone: string, amount: number, simulate?: bool, student_id?: id }
        - If student_id is provided and requester is admin/finance, it initiates for that student.
        - Otherwise it initiates for the current logged-in student.
        """
        user = request.user
        stu = None
        
        # Resolve student
        sid = request.data.get('student_id')
        if sid and user.role in ('admin', 'finance'):
            stu = Student.objects.filter(id=sid).first()
        else:
            stu = Student.objects.filter(user=user).first()

        if not stu:
            return Response({'detail': 'Student not found or not specified'}, status=403)
        
        try:
            phone = (str(request.data.get('phone') or '').strip())
            if phone.startswith('+'):
                phone = phone[1:]
            if phone.startswith('0') and len(phone) == 10:
                phone = '254' + phone[1:]
            if not phone:
                return Response({'detail': 'phone is required'}, status=400)
            amount = float(request.data.get('amount') or 0)
            if amount <= 0:
                return Response({'detail': 'Amount must be greater than 0'}, status=400)
        except Exception as e:
            return Response({'detail': f'Invalid request: {e}'}, status=400)

        # Determine credentials
        school = getattr(stu.klass, 'school', None)
        config = MpesaConfig.objects.filter(school=school).first() if school else None
        
        if config:
            have_creds = all([config.consumer_key, config.consumer_secret, config.short_code, config.passkey])
        else:
            required = ('MPESA_CONSUMER_KEY','MPESA_CONSUMER_SECRET','MPESA_SHORT_CODE','MPESA_PASSKEY')
            have_creds = all(os.getenv(k) for k in required)
            
        default_sim = 'false' if have_creds else 'true'
        simulate = str(request.data.get('simulate', default_sim)).lower() in ('1','true','yes')

        # Check if enabled
        enabled = self._enabled_methods_for_school(school)
        if 'mpesa' not in enabled:
            return Response({'detail': 'Mpesa payments are disabled'}, status=400)

        if simulate:
            _log_payment_health_event(school_id=getattr(school, 'id', None), method='mpesa', ok=True, context='stk_simulated')
            return Response({'status': 'pending', 'message': 'STK simulated.'}, status=202)

        if not have_creds:
            return Response({'detail': 'Mpesa credentials not configured'}, status=400)

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
            
            account_ref = stu.admission_no or f"STU{stu.id}"
            resp = client.stk_push(phone=str(phone), amount=amount, account_ref=account_ref)
            return Response({'status': 'pending', 'message': 'STK initiated', 'daraja': resp}, status=202)
        except Exception as e:
            logging.getLogger(__name__).exception('STK initiation failed')
            return Response({'detail': f'STK error: {e}'}, status=500)

    @action(detail=True, methods=['post'], url_path='coop_stk')
    def coop_stk(self, request, pk=None):
        """Initiate a Co-op Bank gateway STK push for this invoice.
        Body: { phone: string, amount?: number, simulate?: bool }
        Uses env vars COOP_* set in backend or server env.
        """
        if str(os.getenv('ENABLE_COOP_STK', '') or '').lower() not in ('1', 'true', 'yes'):
            return Response({'detail': 'Co-op STK is disabled. Use stk_push (Daraja) instead.'}, status=410)
        # Fetch by primary key directly; enforce authorization checks below
        invoice = Invoice.objects.select_related('student', 'student__klass').filter(pk=pk).first()
        if not invoice:
            return Response({'detail': 'Invoice not found'}, status=404)

        try:
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
        except Exception as e:
            return Response({'detail': f'Invalid request: {e}'}, status=400)

        logger.info("Co-op STK request init", extra={
            'invoice_id': invoice.id,
            'phone': phone[-4:],
            'amount': amount,
            'simulate': simulate,
        })
        if simulate:
            _log_payment_health_event(school_id=getattr(getattr(invoice.student.klass, 'school', None), 'id', None), method='bank', ok=True, context='coop_stk_pending_simulated')
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
                _log_payment_health_event(school_id=getattr(getattr(invoice.student.klass, 'school', None), 'id', None), method='bank', ok=False, context='coop_stk_initiation_failed')
                return Response({'detail': f'Co-op STK error: {e}'}, status=500)

        _log_payment_health_event(school_id=getattr(getattr(invoice.student.klass, 'school', None), 'id', None), method='bank', ok=True, context='coop_stk_pending_no_creds')
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
        instance = serializer.save(school=school)
        # Ensure only one active payroll per staff
        try:
            if getattr(instance, 'is_active', False):
                StaffPayroll.objects.filter(staff=instance.staff).exclude(id=instance.id).update(is_active=False)
        except Exception:
            pass

    def perform_update(self, serializer):
        instance = serializer.save()
        # If this payroll is (or was just set) active, deactivate others for the same staff
        try:
            if getattr(instance, 'is_active', False):
                StaffPayroll.objects.filter(staff=instance.staff).exclude(id=instance.id).update(is_active=False)
        except Exception:
            pass


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
        students = Student.objects.filter(klass=class_fee.klass)
        try:
            cat_name = str(getattr(class_fee.fee_category, 'name', '') or '').strip().lower()
            is_boarding_category = ('board' in cat_name)
        except Exception:
            is_boarding_category = False
        for stu in students:
            if is_boarding_category and str(getattr(stu, 'boarding_status', 'day')).lower() != 'boarding':
                continue
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
        try:
            cat_name = str(getattr(instance.fee_category, 'name', '') or '').strip().lower()
            is_boarding_category = ('board' in cat_name)
        except Exception:
            is_boarding_category = False
        for stu in students:
            if is_boarding_category and str(getattr(stu, 'boarding_status', 'day')).lower() != 'boarding':
                continue
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
                try:
                    cat_name = str(getattr(instance.fee_category, 'name', '') or '').strip().lower()
                    is_boarding_category = ('board' in cat_name)
                except Exception:
                    is_boarding_category = False
                for stu in students:
                    if is_boarding_category and str(getattr(stu, 'boarding_status', 'day')).lower() != 'boarding':
                        continue
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


class StudentFeeViewSet(viewsets.ModelViewSet):
    queryset = StudentFee.objects.all()
    serializer_class = StudentFeeSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['fee_category', 'student', 'year', 'term']

    def get_queryset(self):
        qs = super().get_queryset().select_related('fee_category', 'student')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(fee_category__school=school, student__school=school)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        # Create/update invoice for this student fee
        inv, created = Invoice.objects.get_or_create(
            student=instance.student,
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

    def perform_update(self, serializer):
        instance = serializer.save()
        inv, created = Invoice.objects.get_or_create(
            student=instance.student,
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
    account_ref = meta.get('AccountReference') or meta.get('BillRefNumber')

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

        # Notify student and guardian
        try:
            student = invoice.student
            msg = f"Dear {student.name}, payment of KES {amount} received for {invoice.category.name if invoice.category else 'Fees'}. Receipt: {receipt}. Balance: KES {float(invoice.amount) - total_paid}."
            if student.phone:
                send_sms(student.phone, msg, school_id=student.school_id)
            if student.email:
                send_email_safe("Fee Payment Received", msg, student.email, school_id=student.school_id)
        except Exception as e:
            logger.error(f"Notification failed: {e}")

    elif result_code == 0 and amount and not invoice:
        # Attempt to auto-allocate FIFO by student admission number in account_ref.
        # If there is no outstanding invoice balance, record as prepaid credit.
        allocated = False
        stu = None
        if account_ref:
            stu = Student.objects.filter(admission_no__iexact=str(account_ref).strip()).first()
        if stu:
            remaining = float(amount)
            inv_qs = Invoice.objects.filter(student=stu).order_by('due_date', 'created_at', 'id')
            for inv in inv_qs:
                if remaining <= 0:
                    break
                paid_so_far = float(inv.payments.aggregate(s=Sum('amount'))['s'] or 0)
                inv_balance = float(inv.amount) - paid_so_far
                if inv_balance <= 0:
                    continue
                alloc = min(remaining, inv_balance)
                pay = Payment.objects.create(
                    invoice=inv,
                    amount=float(alloc),
                    method='mpesa',
                    reference=receipt or (checkout_id or ''),
                    recorded_by=None,
                )
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
                allocated = True
            if remaining > 0:
                try:
                    IncomingPayment.objects.create(
                        source='mpesa',
                        external_id=str(checkout_id or ''),
                        amount=float(remaining),
                        currency='KES',
                        reference=str(receipt or ''),
                        narration='STK Callback',
                        account_ref=str(account_ref or ''),
                        phone=str(phone or ''),
                        matched_student=stu,
                        status='matched',
                        notes='prepaid credit (no outstanding balance at time of payment)',
                    )
                except Exception:
                    pass
        if not allocated:
            try:
                IncomingPayment.objects.create(
                    source='mpesa',
                    external_id=str(checkout_id or ''),
                    amount=float(amount),
                    currency='KES',
                    reference=str(receipt or ''),
                    narration='STK Callback',
                    account_ref=str(account_ref or ''),
                    phone=str(phone or ''),
                    status='pending',
                )
            except Exception:
                pass
    # Respond to Daraja per spec
    # If no invoice was tied to the CheckoutRequestID, try auto-allocate FIFO by account reference
    if result_code == 0 and not invoice and amount is not None:
        account_ref = None
        try:
            meta_items = stk_cb.get('CallbackMetadata', {}).get('Item', []) if isinstance(stk_cb.get('CallbackMetadata', {}), dict) else []
            meta = {item.get('Name'): item.get('Value') for item in meta_items if isinstance(item, dict)}
            account_ref = meta.get('AccountReference') or meta.get('BillRefNumber')
        except Exception:
            account_ref = None
        stu = None
        if account_ref:
            stu = Student.objects.filter(admission_no__iexact=str(account_ref).strip()).first()
        if stu:
            remaining = float(amount)
            inv_qs = Invoice.objects.filter(student=stu).order_by('due_date', 'created_at', 'id')
            for inv in inv_qs:
                if remaining <= 0:
                    break
                paid_so_far = float(inv.payments.aggregate(s=Sum('amount'))['s'] or 0)
                inv_balance = float(inv.amount) - paid_so_far
                if inv_balance <= 0:
                    continue
                alloc = min(remaining, inv_balance)
                Payment.objects.create(
                    invoice=inv,
                    amount=float(alloc),
                    method='mpesa',
                    reference=receipt or (checkout_id or ''),
                    recorded_by=None,
                )
                remaining -= alloc
                new_paid = paid_so_far + float(alloc)
                if new_paid >= float(inv.amount):
                    inv.status = 'paid'
                elif new_paid > 0:
                    inv.status = 'partial'
                else:
                    inv.status = 'unpaid'
                inv.save(update_fields=['status'])
        else:
            # Fallback to inbox for manual reconciliation
            try:
                IncomingPayment.objects.create(
                    source='mpesa',
                    external_id=str(checkout_id or ''),
                    amount=float(amount),
                    currency='KES',
                    reference=str(receipt or ''),
                    narration='Co-op STK Callback',
                    status='pending',
                )
            except Exception:
                pass
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


class StaffPayrollViewSet(viewsets.ModelViewSet):
    queryset = StaffPayroll.objects.all()
    serializer_class = StaffPayrollSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['staff', 'is_active']

    def get_queryset(self):
        qs = super().get_queryset().select_related('staff__user', 'school')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        serializer.save(school=school)


class StaffPayslipViewSet(viewsets.ModelViewSet):
    queryset = StaffPayslip.objects.all()
    serializer_class = StaffPayslipSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['staff', 'year', 'month']

    def get_queryset(self):
        qs = super().get_queryset().select_related('staff__user', 'school')
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        if school:
            qs = qs.filter(school=school)
        return qs.order_by('-year', '-month', '-id')

    def _sum_list(self, items):
        try:
            from decimal import Decimal
            total = Decimal('0')
            if isinstance(items, list):
                for it in items:
                    try:
                        total += Decimal(str(it.get('amount', 0)))
                    except Exception:
                        total += Decimal('0')
            return total
        except Exception:
            return 0

    def perform_create(self, serializer):
        school = getattr(getattr(self.request, 'user', None), 'school', None)
        data = dict(self.request.data)
        basic = serializer.validated_data.get('basic')
        allowances = serializer.validated_data.get('allowances') or []
        deductions = serializer.validated_data.get('deductions') or []
        try:
            gross = (basic or 0) + self._sum_list(allowances)
            net = gross - self._sum_list(deductions)
        except Exception:
            gross = serializer.validated_data.get('gross_pay') or 0
            net = serializer.validated_data.get('net_pay') or 0
        serializer.save(school=school, gross_pay=gross, net_pay=net)

    def perform_update(self, serializer):
        basic = serializer.validated_data.get('basic')
        allowances = serializer.validated_data.get('allowances')
        deductions = serializer.validated_data.get('deductions')
        if basic is not None or allowances is not None or deductions is not None:
            basic = basic if basic is not None else getattr(serializer.instance, 'basic', 0)
            allowances = allowances if allowances is not None else getattr(serializer.instance, 'allowances', [])
            deductions = deductions if deductions is not None else getattr(serializer.instance, 'deductions', [])
            try:
                gross = (basic or 0) + self._sum_list(allowances)
                net = gross - self._sum_list(deductions)
            except Exception:
                gross = getattr(serializer.instance, 'gross_pay', 0)
                net = getattr(serializer.instance, 'net_pay', 0)
            serializer.save(gross_pay=gross, net_pay=net)
        else:
            serializer.save()

    @action(detail=False, methods=['post'], url_path='run_scheduler')
    def run_scheduler(self, request):
        """Generate payslips for active payrolls whose payout_day equals today's day-of-month.
        Skips if a payslip for the staff/year/month already exists. Sends a message to admin & finance roles.
        """
        from decimal import Decimal
        try:
            school = getattr(getattr(request, 'user', None), 'school', None)
            school_id = getattr(school, 'id', None)
            if not school_id:
                return Response({ 'detail': 'No school context' }, status=400)
            today = timezone.now().date()
            year, month, day = today.year, today.month, today.day
            created = 0
            qs = StaffPayroll.objects.filter(school_id=school_id, is_active=True, payout_day=day)
            for pr in qs:
                # avoid duplicate for same month
                if StaffPayslip.objects.filter(school_id=school_id, staff_id=pr.staff_id, year=year, month=month).exists():
                    continue
                def _sum_list(items):
                    total = Decimal('0')
                    for it in (items or []):
                        try:
                            total += Decimal(str((it or {}).get('amount', 0)))
                        except Exception:
                            total += Decimal('0')
                    return total
                basic = Decimal(str(pr.base_salary or 0))
                allowances = pr.allowances or []
                deductions = pr.deductions or []
                gross = basic + _sum_list(allowances)
                net = gross - _sum_list(deductions)
                StaffPayslip.objects.create(
                    staff_id=pr.staff_id,
                    school_id=school_id,
                    year=year,
                    month=month,
                    basic=basic,
                    allowances=allowances,
                    deductions=deductions,
                    gross_pay=gross,
                    net_pay=net,
                    notes='Auto-generated by scheduler',
                )
                created += 1

            # Notify admin & finance
            try:
                sender_id = resolve_default_sender_id(school_id)
                if sender_id:
                    body = f"Payslip scheduler ran on {today:%Y-%m-%d}. Created: {created}."
                    create_message_for_role(school_id=school_id, sender_id=sender_id, body=body, role='admin')
                    create_message_for_role(school_id=school_id, sender_id=sender_id, body=body, role='finance')
            except Exception:
                pass

            return Response({ 'created': created, 'date': str(today) })
        except Exception as e:
            return Response({ 'detail': str(e) }, status=500)
