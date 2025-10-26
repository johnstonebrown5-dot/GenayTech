from django.db.models.signals import post_save
from django.dispatch import receiver

from academics.models import Student
from accounts.models import School
from .models import PocketMoneyWallet, ClassFee, Invoice, FeeCategory
from django.utils import timezone


@receiver(post_save, sender=Student)
def ensure_wallet_for_student(sender, instance: Student, created, **kwargs):
    """Always ensure a PocketMoneyWallet exists for each student.
    - On creation: create with 0 balance if missing.
    - On updates: also ensure it exists in case of historical data.
    """
    try:
        PocketMoneyWallet.objects.get_or_create(student=instance, defaults={"balance": 0})
    except Exception:
        # Best-effort; avoid breaking student save
        pass


@receiver(post_save, sender=School)
def ensure_boarding_fee_category(sender, instance: School, created, **kwargs):
    """Ensure each School has a non-deletable 'Boarding fees' FeeCategory with default description.
    Amounts are managed via ClassFee per class/term and default to 0 when created by admin.
    """
    try:
        FeeCategory.objects.get_or_create(
            school=instance,
            name='Boarding fees',
            defaults={
                'description': 'Boarding-only fee category (applies to boarders).',
            }
        )
    except Exception:
        # Silent best-effort
        pass

# Best-effort backfill on import (safe guard for existing schools)
try:
    for _school in School.objects.all():
        try:
            FeeCategory.objects.get_or_create(
                school=_school,
                name='Boarding fees',
                defaults={'description': 'Boarding-only fee category (applies to boarders).'}
            )
        except Exception:
            continue
except Exception:
    # Avoid crashing during migrations/app loading
    pass


@receiver(post_save, sender=Student)
def ensure_invoices_for_assigned_class(sender, instance: Student, created, **kwargs):
    """Whenever a student is created or updated, ensure invoices exist for
    any ClassFee configured for their class in the current academic term.

    Rules:
    - Determine current term by `academics.Term.is_current=True` in the student's school.
      Fallback: locate term by today's date within the academic year; fallback to today's year and term 1.
    - For each matching `ClassFee(klass=student.klass, year, term)`, create/update an `Invoice`.
    - Best-effort; never break student saves.
    """
    try:
        # Do not generate invoices for inactive students
        if not getattr(instance, 'is_active', True):
            return
        # Require a class assignment
        if not instance.klass_id:
            return

        today = timezone.now().date()
        school_id = getattr(instance.klass, 'school_id', None) or getattr(instance, 'school_id', None)
        year = None
        term_number = None

        # Resolve current term for the student's school
        try:
            from academics.models import Term, AcademicYear
            t = Term.objects.filter(academic_year__school_id=school_id, is_current=True).first()
            if not t:
                # Try by date containment
                t = Term.objects.filter(academic_year__school_id=school_id, start_date__lte=today, end_date__gte=today).first()
            if t:
                term_number = int(t.number)
                # Prefer AY end year; fallback to start year
                year = int(getattr(t.academic_year.end_date, 'year', None) or getattr(t.academic_year.start_date, 'year', today.year))
        except Exception:
            pass

        if year is None:
            year = int(today.year)
        if term_number is None:
            term_number = 1

        # Create/update invoices for all class fees in that period
        fees = ClassFee.objects.filter(klass_id=instance.klass_id, year=year, term=term_number)
        for cf in fees:
            try:
                # Only apply boarding-related fees to boarders
                cat_name = str(getattr(cf.fee_category, 'name', '') or '').strip().lower()
                is_boarding_category = ('board' in cat_name)  # matches 'boarding', 'boarding fees', etc.
                if is_boarding_category and str(getattr(instance, 'boarding_status', 'day')).lower() != 'boarding':
                    continue
            except Exception:
                pass
            inv, created_inv = Invoice.objects.get_or_create(
                student=instance,
                category=cf.fee_category,
                year=cf.year,
                term=cf.term,
                defaults={
                    'amount': cf.amount,
                    'due_date': cf.due_date,
                    'status': 'unpaid',
                }
            )
            if not created_inv:
                # Keep invoice in sync with current class fee
                updated = False
                if inv.amount != cf.amount:
                    inv.amount = cf.amount; updated = True
                if inv.due_date != cf.due_date:
                    inv.due_date = cf.due_date; updated = True
                if updated:
                    inv.save(update_fields=['amount','due_date'])

        # Removed: automatic per-student Boarding invoice creation. Boarding fees now come only from ClassFee
        # for the student's class and current period, while skipping non-boarders above.
    except Exception:
        # Silent fail to avoid blocking student saves
        pass
