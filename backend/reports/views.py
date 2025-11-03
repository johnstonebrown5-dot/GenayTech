from datetime import datetime, timedelta
from django.db.models import Sum, Avg, Count, Q, Case, When, IntegerField
from django.db.models.functions import TruncDate, TruncMonth
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache

from academics.models import Student, Class as Klass, Attendance, Assessment, ExamResult
from finance.models import Invoice, Payment
from accounts.models import User

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def summary(request):
    # Try to get cached data
    cache_key = f'reports_summary_{request.user.id}'
    cached_data = cache.get(cache_key)
    if cached_data:
        return Response(cached_data)
    
    # Scope to user's school if set
    school = getattr(request.user, 'school', None)

    # Optimize querysets with select_related and prefetch_related
    st_qs = Student.objects.select_related('klass')
    cl_qs = Klass.objects.select_related('teacher', 'school')
    att_qs = Attendance.objects.select_related('student__klass')
    inv_qs = Invoice.objects.select_related('student__klass')
    pay_qs = Payment.objects.select_related('invoice__student')
    teach_qs = User.objects.filter(role='teacher', is_active=True)
    assess_qs = Assessment.objects.select_related('student__klass')
    exam_results_qs = ExamResult.objects.select_related('student__klass', 'exam', 'subject')

    if school:
        cl_qs = cl_qs.filter(school=school)
        st_qs = st_qs.filter(klass__school=school)
        att_qs = att_qs.filter(student__klass__school=school)
        inv_qs = inv_qs.filter(student__klass__school=school)
        pay_qs = pay_qs.filter(invoice__student__klass__school=school)
        teach_qs = teach_qs.filter(school=school)
        assess_qs = assess_qs.filter(student__klass__school=school)
        exam_results_qs = exam_results_qs.filter(student__klass__school=school)

    # Exclude non-examinable subjects from all exam results based analytics
    exam_results_qs = exam_results_qs.filter(subject__is_examinable=True)

    # Get basic counts efficiently
    since = datetime.today().date() - timedelta(days=30)
    
    # Single aggregation for counts
    counts = {
        'students': st_qs.count(),
        'teachers': teach_qs.count(),
        'classes': cl_qs.count(),
        'assessments': assess_qs.count(),
        'exam_results': exam_results_qs.count(),
        'invoices': inv_qs.count(),
        'paid_invoices': inv_qs.filter(status='paid').count()
    }
    
    # Attendance aggregation in one query
    recent_att = att_qs.filter(date__gte=since)
    att_stats = recent_att.aggregate(
        total=Count('id'),
        present=Count(Case(When(status='present', then=1), output_field=IntegerField())),
        absent=Count(Case(When(status='absent', then=1), output_field=IntegerField())),
        late=Count(Case(When(status='late', then=1), output_field=IntegerField()))
    )
    
    total_marks = att_stats['total'] or 1
    attendance_rate = round((att_stats['present'] / total_marks) * 100, 1)
    
    # Financial aggregation
    finance_stats = {
        'total': inv_qs.aggregate(total=Sum('amount'))['total'] or 0,
        'collected': pay_qs.aggregate(total=Sum('amount'))['total'] or 0
    }
    finance_stats['outstanding'] = float(finance_stats['total']) - float(finance_stats['collected'])
    collection_rate = round((counts['paid_invoices'] / (counts['invoices'] or 1)) * 100, 1)
    
    # Attendance trend - optimized with grouping
    trend_start = datetime.today().date() - timedelta(days=13)
    attendance_by_date = att_qs.filter(date__gte=trend_start).values('date').annotate(
        total=Count('id'),
        present=Count(Case(When(status='present', then=1), output_field=IntegerField()))
    ).order_by('date')
    
    attendance_trend = []
    date_dict = {item['date']: item for item in attendance_by_date}
    for i in range(13, -1, -1):
        d = datetime.today().date() - timedelta(days=i)
        if d in date_dict:
            item = date_dict[d]
            rate = round((item['present'] / (item['total'] or 1)) * 100, 1)
        else:
            rate = 0
        attendance_trend.append({"date": d.isoformat(), "rate": rate})
    
    # Fees trend - optimized with grouping
    six_months_ago = datetime.today().date() - timedelta(days=180)
    fees_by_month = pay_qs.filter(created_at__date__gte=six_months_ago).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        collected=Sum('amount')
    ).order_by('month')
    
    fees_trend = []
    month_dict = {item['month'].strftime('%Y-%m'): float(item['collected']) for item in fees_by_month}
    for i in range(5, -1, -1):
        m = (datetime.today().date().replace(day=1) - timedelta(days=30*i))
        month_key = m.strftime('%Y-%m')
        fees_trend.append({"month": month_key, "collected": month_dict.get(month_key, 0)})

    # ===== Month-over-Month trends (current month vs previous month) =====
    today = datetime.today().date()
    current_month_start = today.replace(day=1)
    # previous month end: day 1 minus 1 day
    prev_month_end = current_month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    # Teachers added this month vs previous (User has date_joined)
    teachers_added_curr = teach_qs.filter(date_joined__date__gte=current_month_start, date_joined__date__lte=today).count()
    teachers_added_prev = teach_qs.filter(date_joined__date__gte=prev_month_start, date_joined__date__lte=prev_month_end).count()

    # Classes created this month vs previous (Class has created_at)
    classes_added_curr = cl_qs.filter(created_at__date__gte=current_month_start, created_at__date__lte=today).count()
    classes_added_prev = cl_qs.filter(created_at__date__gte=prev_month_start, created_at__date__lte=prev_month_end).count()

    # Attendance rate this month vs previous
    att_curr_qs = att_qs.filter(date__gte=current_month_start, date__lte=today)
    att_prev_qs = att_qs.filter(date__gte=prev_month_start, date__lte=prev_month_end)
    att_curr = att_curr_qs.aggregate(
        total=Count('id'),
        present=Count(Case(When(status='present', then=1), output_field=IntegerField())),
    )
    att_prev = att_prev_qs.aggregate(
        total=Count('id'),
        present=Count(Case(When(status='present', then=1), output_field=IntegerField())),
    )
    att_rate_curr = round(((att_curr['present'] or 0) / (att_curr['total'] or 1)) * 100, 1)
    att_rate_prev = round(((att_prev['present'] or 0) / (att_prev['total'] or 1)) * 100, 1)

    # Fees collected this month vs previous (by Payment.created_at)
    fees_collected_curr = float(pay_qs.filter(created_at__date__gte=current_month_start, created_at__date__lte=today).aggregate(total=Sum('amount'))['total'] or 0)
    fees_collected_prev = float(pay_qs.filter(created_at__date__gte=prev_month_start, created_at__date__lte=prev_month_end).aggregate(total=Sum('amount'))['total'] or 0)

    def pct_change(curr, prev):
        prev = float(prev or 0)
        curr = float(curr or 0)
        if prev == 0:
            return 0 if curr == 0 else 100
        return round(((curr - prev) / prev) * 100, 1)

    trends = {
        'teachers': pct_change(teachers_added_curr, teachers_added_prev),
        'classes': pct_change(classes_added_curr, classes_added_prev),
        'attendance': pct_change(att_rate_curr, att_rate_prev),
        'feesCollected': pct_change(fees_collected_curr, fees_collected_prev),
    }
    
    # Academic Performance - single query with aggregation using ExamResult
    academic_stats = exam_results_qs.aggregate(
        avg_score=Avg('marks'),
        excellent=Count(Case(When(marks__gte=80, then=1), output_field=IntegerField())),
        good=Count(Case(When(Q(marks__gte=60) & Q(marks__lt=80), then=1), output_field=IntegerField())),
        average=Count(Case(When(Q(marks__gte=40) & Q(marks__lt=60), then=1), output_field=IntegerField())),
        poor=Count(Case(When(marks__lt=40, then=1), output_field=IntegerField()))
    )
    
    # Class Performance - optimized with annotation using ExamResult
    class_performance = cl_qs.annotate(
        avg_score=Avg(
            'student__examresult__marks',
            filter=Q(student__examresult__subject__is_examinable=True)
        ),
        student_count=Count('student', distinct=True)
    ).values('name', 'avg_score', 'student_count')[:10]
    
    class_perf_list = [{
        'name': c['name'],
        'avgScore': round(float(c['avg_score'] or 0), 1),
        'students': c['student_count']
    } for c in class_performance]
    
    # Teacher Statistics - optimized with annotation
    teacher_stats = teach_qs.annotate(
        class_count=Count('class_teacher', distinct=True),
        student_count=Count('class_teacher__student', distinct=True)
    ).values('first_name', 'last_name', 'username', 'class_count', 'student_count')[:10]
    
    teacher_list = [{
        'name': f"{t['first_name']} {t['last_name']}".strip() or t['username'],
        'classes': t['class_count'],
        'students': t['student_count']
    } for t in teacher_stats]
    
    # Recent Payments - limit to 5
    recent_payments = pay_qs.select_related('invoice__student').order_by('-created_at')[:5]
    recent_payment_list = [{
        'student': p.invoice.student.name,
        'amount': float(p.amount),
        'date': p.created_at.date().isoformat()
    } for p in recent_payments]

    data = {
        'students': counts['students'],
        'teachers': counts['teachers'],
        'classes': counts['classes'],
        'attendanceRate': attendance_rate,
        'trends': trends,
        'fees': {
            'collected': float(finance_stats['collected']),
            'outstanding': float(finance_stats['outstanding']),
            'invoices': counts['invoices'],
            'paidInvoices': counts['paid_invoices'],
            'collectionRate': collection_rate,
            'total': float(finance_stats['total'])
        },
        'assessmentsCount': counts['assessments'] + counts['exam_results'],
        'attendanceTrend': attendance_trend,
        'feesTrend': fees_trend,
        'academic': {
            'avgScore': round(float(academic_stats['avg_score'] or 0), 1),
            'classPerformance': class_perf_list,
            'performanceDistribution': {
                'excellent': academic_stats['excellent'],
                'good': academic_stats['good'],
                'average': academic_stats['average'],
                'poor': academic_stats['poor']
            }
        },
        'administrative': {
            'teacherStats': teacher_list,
            'attendanceStatus': {
                'present': att_stats['present'],
                'absent': att_stats['absent'],
                'late': att_stats['late']
            },
            'recentPayments': recent_payment_list
        }
    }
    
    # Cache the data for 5 minutes
    cache.set(cache_key, data, 300)
    
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def clear_cache(request):
    """Clear the reports cache for the current user"""
    cache_key = f'reports_summary_{request.user.id}'
    cache.delete(cache_key)
    return Response({"message": "Cache cleared successfully"}, status=status.HTTP_200_OK)
