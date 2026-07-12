from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from faker import Faker
import random
from datetime import date, timedelta
from decimal import Decimal
from finance.models import Invoice, Payment, FeeCategory, ClassFee
from academics.models import Student, Class
from accounts.models import School

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed payment data - creates invoices and payments for students'

    def add_arguments(self, parser):
        parser.add_argument(
            '--invoices-per-student',
            type=int,
            default=3,
            help='Number of invoices per student (default: 3)'
        )
        parser.add_argument(
            '--payments-per-invoice',
            type=int,
            default=2,
            help='Average number of payments per invoice (default: 2)'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing payment and invoice data before seeding'
        )

    def handle(self, *args, **options):
        fake = Faker()
        Faker.seed(42)
        random.seed(42)

        invoices_per_student = options['invoices_per_student']
        payments_per_invoice = options['payments_per_invoice']
        clear_data = options['clear']

        if clear_data:
            self.stdout.write(self.style.WARNING('Clearing existing payment and invoice data...'))
            Payment.objects.all().delete()
            Invoice.objects.all().delete()
            ClassFee.objects.all().delete()
            FeeCategory.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('✓ Data cleared.'))

        # Get all schools
        schools = list(School.objects.all())
        if not schools:
            self.stdout.write(self.style.ERROR('No schools found. Please run seed_data first.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Found {len(schools)} schools'))

        # Fee categories to create
        fee_category_names = [
            ('Tuition', 'School tuition fees'),
            ('Transport', 'Transportation fees'),
            ('Lunch', 'Lunch and meals'),
            ('Activity', 'Extra-curricular activities'),
            ('Library', 'Library and books'),
            ('Lab', 'Laboratory fees'),
            ('Exam', 'Examination fees'),
            ('Uniform', 'School uniform'),
        ]

        # Create fee categories for each school
        self.stdout.write(self.style.SUCCESS('Creating fee categories...'))
        fee_categories_by_school = {}
        for school in schools:
            school_categories = []
            for cat_name, cat_desc in fee_category_names:
                category, created = FeeCategory.objects.get_or_create(
                    name=cat_name,
                    school=school,
                    defaults={'description': cat_desc}
                )
                school_categories.append(category)
                if created:
                    self.stdout.write(f'  ✓ Created {cat_name} for {school.name}')
            fee_categories_by_school[school.id] = school_categories

        # Create class fees (optional - for reference)
        self.stdout.write(self.style.SUCCESS('Creating class fees...'))
        current_year = date.today().year
        terms = [1, 2, 3]
        
        for school in schools:
            classes = list(Class.objects.filter(school=school))
            categories = fee_categories_by_school[school.id]
            
            for klass in classes:
                for term in terms:
                    # Assign 2-3 random fee categories to each class per term
                    selected_categories = random.sample(categories, random.randint(2, 3))
                    for category in selected_categories:
                        amount = Decimal(random.randint(5000, 50000))
                        due_date = date.today() + timedelta(days=random.randint(30, 90))
                        
                        ClassFee.objects.get_or_create(
                            fee_category=category,
                            klass=klass,
                            year=current_year,
                            term=term,
                            defaults={
                                'amount': amount,
                                'due_date': due_date,
                            }
                        )

        self.stdout.write(self.style.SUCCESS('✓ Class fees created'))

        # Get all students
        students = list(Student.objects.select_related('klass', 'klass__school').all())
        if not students:
            self.stdout.write(self.style.ERROR('No students found. Please run seed_data first.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Found {len(students)} students'))

        # Payment methods
        payment_methods = ['mpesa', 'bank', 'cash', 'cheque']
        payment_method_weights = [0.6, 0.2, 0.15, 0.05]  # Mpesa most common

        total_invoices_created = 0
        total_payments_created = 0

        self.stdout.write(self.style.SUCCESS('Creating invoices and payments...'))

        for student in students:
            school = student.klass.school if student.klass else None
            if not school:
                continue

            categories = fee_categories_by_school.get(school.id, [])
            if not categories:
                continue

            # Create invoices for this student
            for i in range(invoices_per_student):
                # Random category
                category = random.choice(categories)
                
                # Random amount between 5,000 and 50,000
                invoice_amount = Decimal(random.randint(5000, 50000))
                
                # Random term and year
                term = random.choice([1, 2, 3])
                year = random.choice([current_year - 1, current_year])
                
                # Random due date (past or future)
                days_offset = random.randint(-90, 90)
                due_date = date.today() + timedelta(days=days_offset)
                
                # Create invoice
                invoice = Invoice.objects.create(
                    student=student,
                    amount=invoice_amount,
                    status='unpaid',  # Will be updated after payments
                    category=category,
                    year=year,
                    term=term,
                    due_date=due_date,
                )
                total_invoices_created += 1

                # Create payments for this invoice
                # For the first invoice of each student, ensure at least 1 payment
                if i == 0:
                    num_payments = random.randint(1, payments_per_invoice + 1)
                else:
                    # Random number of payments (0 to payments_per_invoice + 1)
                    num_payments = random.randint(0, payments_per_invoice + 1)
                
                if num_payments > 0:
                    # Decide payment strategy
                    payment_strategy = random.choice(['full', 'partial', 'overpaid', 'underpaid'])
                    
                    if payment_strategy == 'full':
                        # Single payment covering full amount
                        method = random.choices(payment_methods, weights=payment_method_weights)[0]
                        reference = fake.bothify(text='???########') if method == 'mpesa' else fake.bothify(text='REF########')
                        
                        Payment.objects.create(
                            invoice=invoice,
                            amount=invoice_amount,
                            method=method,
                            reference=reference,
                            recorded_by=None,
                        )
                        total_payments_created += 1
                        invoice.status = 'paid'
                        
                    elif payment_strategy == 'partial':
                        # Multiple payments totaling less than invoice amount
                        remaining = float(invoice_amount)
                        for _ in range(num_payments):
                            # Pay 20-40% of remaining amount
                            payment_amount = Decimal(remaining * random.uniform(0.2, 0.4))
                            payment_amount = round(payment_amount, 2)
                            
                            method = random.choices(payment_methods, weights=payment_method_weights)[0]
                            reference = fake.bothify(text='???########') if method == 'mpesa' else fake.bothify(text='REF########')
                            
                            Payment.objects.create(
                                invoice=invoice,
                                amount=payment_amount,
                                method=method,
                                reference=reference,
                                recorded_by=None,
                            )
                            total_payments_created += 1
                            remaining -= float(payment_amount)
                        
                        invoice.status = 'partial'
                        
                    elif payment_strategy == 'overpaid':
                        # Payments totaling more than invoice (overpayment scenario)
                        total_paid = Decimal(0)
                        for _ in range(num_payments):
                            payment_amount = Decimal(float(invoice_amount) * random.uniform(0.4, 0.7))
                            payment_amount = round(payment_amount, 2)
                            
                            method = random.choices(payment_methods, weights=payment_method_weights)[0]
                            reference = fake.bothify(text='???########') if method == 'mpesa' else fake.bothify(text='REF########')
                            
                            Payment.objects.create(
                                invoice=invoice,
                                amount=payment_amount,
                                method=method,
                                reference=reference,
                                recorded_by=None,
                            )
                            total_payments_created += 1
                            total_paid += payment_amount
                        
                        invoice.status = 'paid' if total_paid >= invoice_amount else 'partial'
                        
                    else:  # underpaid
                        # Few small payments
                        for _ in range(min(num_payments, 2)):
                            payment_amount = Decimal(float(invoice_amount) * random.uniform(0.1, 0.3))
                            payment_amount = round(payment_amount, 2)
                            
                            method = random.choices(payment_methods, weights=payment_method_weights)[0]
                            reference = fake.bothify(text='???########') if method == 'mpesa' else fake.bothify(text='REF########')
                            
                            Payment.objects.create(
                                invoice=invoice,
                                amount=payment_amount,
                                method=method,
                                reference=reference,
                                recorded_by=None,
                            )
                            total_payments_created += 1
                        
                        invoice.status = 'partial'
                
                # Save invoice status
                invoice.save(update_fields=['status'])

            # Progress indicator
            if (students.index(student) + 1) % 100 == 0:
                self.stdout.write(
                    self.style.SUCCESS(f'  Processed {students.index(student) + 1}/{len(students)} students')
                )

        self.stdout.write(self.style.SUCCESS('✓ Payment seeding completed successfully!'))
        self.stdout.write(self.style.SUCCESS(f'Summary:'))
        self.stdout.write(self.style.SUCCESS(f'  - Fee Categories: {sum(len(cats) for cats in fee_categories_by_school.values())}'))
        self.stdout.write(self.style.SUCCESS(f'  - Invoices Created: {total_invoices_created}'))
        self.stdout.write(self.style.SUCCESS(f'  - Payments Created: {total_payments_created}'))
        
        # Calculate statistics
        paid_count = Invoice.objects.filter(status='paid').count()
        partial_count = Invoice.objects.filter(status='partial').count()
        unpaid_count = Invoice.objects.filter(status='unpaid').count()
        
        self.stdout.write(self.style.SUCCESS(f'\nInvoice Status Breakdown:'))
        self.stdout.write(self.style.SUCCESS(f'  - Paid: {paid_count}'))
        self.stdout.write(self.style.SUCCESS(f'  - Partial: {partial_count}'))
        self.stdout.write(self.style.SUCCESS(f'  - Unpaid: {unpaid_count}'))
