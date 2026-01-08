from datetime import date
import random

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from accounts.models import School
from academics.models import Stream, Class, TeacherProfile, Student
from finance.models import FeeCategory, Invoice, Payment


class Command(BaseCommand):
    help = "Seed demo data: 1 school, 2 streams, 9 classes per stream, 30 teachers, 50 students per class, 2 fee categories, 3 payments per student."

    def handle(self, *args, **options):
        User = get_user_model()

        # --- School ---
        school, created = School.objects.get_or_create(
            code="DEMO001",
            defaults={
                "name": "Demo School",
                "address": "Demo Address",
                "motto": "Learning for Life",
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created school: {school}"))
        else:
            self.stdout.write(self.style.WARNING(f"Using existing school: {school}"))

        # --- Streams ---
        stream_names = ["East", "West"]
        streams = []
        for name in stream_names:
            stream, _ = Stream.objects.get_or_create(name=name, school=school)
            streams.append(stream)
        self.stdout.write(self.style.SUCCESS(f"Ensured {len(streams)} streams"))

        # --- Classes ---
        classes = []
        for stream in streams:
            for grade in range(1, 10):  # 9 classes per stream
                klass, _ = Class.objects.get_or_create(
                    school=school,
                    stream=stream,
                    grade_level=str(grade),
                )
                classes.append(klass)
        self.stdout.write(self.style.SUCCESS(f"Ensured {len(classes)} classes"))

        # --- Teachers (Users + TeacherProfile) ---
        teachers = []
        for i in range(1, 31):  # 30 teachers
            username = f"teacher{i}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@demo.local",
                    "role": User.Roles.TEACHER,
                    "school": school,
                },
            )
            if created:
                user.set_password("password123")
                user.is_staff = True
                user.save(update_fields=["password", "is_staff"])
            teachers.append(user)
            TeacherProfile.objects.get_or_create(user=user, defaults={"subjects": "Math, English"})
        self.stdout.write(self.style.SUCCESS(f"Ensured {len(teachers)} teachers"))

        # Assign a class teacher for each class (cycle through teachers)
        for idx, klass in enumerate(classes):
            teacher = teachers[idx % len(teachers)]
            if klass.teacher_id != teacher.id:
                klass.teacher = teacher
                klass.save(update_fields=["teacher"])
        self.stdout.write(self.style.SUCCESS("Assigned class teachers"))

        # --- Fee categories ---
        fee_categories = []
        for name in ["Tuition", "Development"]:
            cat, _ = FeeCategory.objects.get_or_create(
                school=school,
                name=name,
                defaults={"description": f"{name} fees"},
            )
            fee_categories.append(cat)
        self.stdout.write(self.style.SUCCESS(f"Ensured {len(fee_categories)} fee categories"))

        current_year = timezone.now().year

        # --- Students, Invoices, Payments ---
        total_students = 0
        total_invoices = 0
        total_payments = 0

        for klass in classes:
            for n in range(1, 51):  # 50 students per class
                admission_no = f"{klass.id:03d}{n:03d}"
                student, created = Student.objects.get_or_create(
                    admission_no=admission_no,
                    defaults={
                        "name": f"Student {klass.grade_level} {klass.stream.name} #{n}",
                        "dob": date(2012, 1, 1),
                        "gender": random.choice(["Male", "Female"]),
                        "klass": klass,
                        "school": school,
                    },
                )
                if created:
                    total_students += 1

                # For simplicity, create one invoice per student per first fee category
                category = fee_categories[0]
                invoice, inv_created = Invoice.objects.get_or_create(
                    student=student,
                    category=category,
                    year=current_year,
                    term=1,
                    defaults={
                        "amount": 10000,
                        "status": "unpaid",
                    },
                )
                if inv_created:
                    total_invoices += 1

                # Create up to 3 payments per student if not already present
                existing_payments = invoice.payments.count()
                for p in range(existing_payments, 3):
                    amount = 10000 / 3
                    Payment.objects.create(
                        invoice=invoice,
                        amount=amount,
                        method="cash",
                        reference=f"PMT-{student.admission_no}-{p+1}",
                    )
                    total_payments += 1

        self.stdout.write(self.style.SUCCESS(f"Seed complete: {total_students} new students, {total_invoices} new invoices, {total_payments} new payments."))
