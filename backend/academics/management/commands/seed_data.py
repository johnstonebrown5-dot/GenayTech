from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from faker import Faker
import random
from datetime import date, timedelta
from academics.models import Subject, Stream, Class, TeacherProfile, Student, Competency, ClassSubjectTeacher, Exam, ExamResult
from accounts.models import School
from finance.models import FeeCategory, Invoice, Payment

User = get_user_model()

def kenyan_phone():
    return '07' + ''.join(str(random.randint(0, 9)) for _ in range(8))

class Command(BaseCommand):
    help = 'Seed the database with schools, classes, teachers, and students'

    def add_arguments(self, parser):
        parser.add_argument(
            '--schools',
            type=int,
            default=5,
            help='Number of schools to create (default: 5)'
        )
        parser.add_argument(
            '--teachers-per-school',
            type=int,
            default=30,
            help='Number of teachers per school (default: 30)'
        )
        parser.add_argument(
            '--students-per-school',
            type=int,
            default=900,
            help='Number of students per school (default: 900)'
        )
        parser.add_argument(
            '--streams-per-school',
            type=int,
            default=2,
            help='Number of streams per school (default: 2)'
        )
        parser.add_argument(
            '--fee-categories',
            type=int,
            default=3,
            help='Number of fee categories to create per school (default: 3)'
        )
        parser.add_argument(
            '--payments-per-student',
            type=int,
            default=2,
            help='At least this many payments per student (default: 2)'
        )
        parser.add_argument(
            '--common-exams',
            type=int,
            default=2,
            help='Number of common exams per class to generate with results (default: 2)'
        )

    def handle(self, *args, **options):
        fake = Faker()
        Faker.seed(42)  # For reproducible results
        random.seed(42)

        schools_count = options['schools']
        teachers_per_school = options['teachers_per_school']
        students_per_school = options['students_per_school']
        streams_per_school = options['streams_per_school']
        fee_categories_count = options.get('fee_categories', 3)
        payments_per_student = options.get('payments_per_student', 2)
        common_exams = options.get('common_exams', 2)

        self.stdout.write(self.style.WARNING('Clearing existing data...'))
        # Clear data in a specific order to avoid foreign key constraints
        Student.objects.all().delete()
        TeacherProfile.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        Class.objects.all().delete()
        Stream.objects.all().delete()
        Subject.objects.all().delete()
        # Do NOT delete School because other apps reference it with PROTECT FKs
        # School.objects.all().delete()
        Competency.objects.all().delete()
        self.stdout.write(self.style.WARNING('Note: Schools kept intact to avoid ProtectedError; data will be re-seeded for existing schools.'))
        self.stdout.write(self.style.SUCCESS('✓ Data cleared.'))

        self.stdout.write(
            self.style.SUCCESS(f'Starting to seed {schools_count} schools with:')
        )
        self.stdout.write(
            self.style.SUCCESS(f'  - {teachers_per_school} teachers per school')
        )
        self.stdout.write(
            self.style.SUCCESS(f'  - {students_per_school} students per school')
        )
        self.stdout.write(
            self.style.SUCCESS(f'  - Classes per school: {9 * streams_per_school} (9 grades x {streams_per_school} streams)')
        )

        # Subject catalog (requested)
        subject_catalog = [
            { 'name': 'Mathematics',           'abbr': 'MAT', 'category': 'science' },
            { 'name': 'English',               'abbr': 'ENG', 'category': 'language' },
            { 'name': 'Kiswahili',             'abbr': 'KIS', 'category': 'language' },
            { 'name': 'Integrated Science',    'abbr': 'ISC', 'category': 'science' },
            { 'name': 'Social Studies',        'abbr': 'SST', 'category': 'humanities' },
            { 'name': 'Arts',                  'abbr': 'ART', 'category': 'arts' },
            { 'name': 'Music',                 'abbr': 'MUS', 'category': 'arts' },
            { 'name': 'Religious Education',   'abbr': 'RE',  'category': 'humanities' },
            { 'name': 'Physical Education',    'abbr': 'PE',  'category': 'other' },
            { 'name': 'P.P.I',                 'abbr': 'PPI', 'category': 'other' },
        ]

        # Teacher names for variety
        teacher_first_names = [
            'John', 'Mary', 'Peter', 'Grace', 'David', 'Sarah', 'Michael', 'Elizabeth',
            'James', 'Patricia', 'Robert', 'Linda', 'William', 'Barbara', 'Richard',
            'Susan', 'Joseph', 'Jessica', 'Thomas', 'Nancy', 'Christopher', 'Betty',
            'Daniel', 'Helen', 'Matthew', 'Sandra', 'Anthony', 'Donna', 'Mark',
            'Carol', 'Donald', 'Ruth', 'Steven', 'Sharon', 'Paul', 'Michelle',
            'Andrew', 'Laura', 'Joshua', 'Sarah', 'Kenneth', 'Kimberly', 'Kevin',
            'Deborah', 'Brian', 'Dorothy', 'George', 'Amy', 'Timothy', 'Angela'
        ]

        teacher_last_names = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
            'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
            'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
            'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
            'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
            'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green'
        ]

        # Student names
        student_first_names = [
            'Aaliyah', 'Aaron', 'Abigail', 'Adam', 'Addison', 'Adrian', 'Aiden',
            'Alexander', 'Alexis', 'Alice', 'Allison', 'Alyssa', 'Amanda', 'Amelia',
            'Andrew', 'Angel', 'Anna', 'Anthony', 'Aria', 'Ariana', 'Ashley',
            'Aubrey', 'Audrey', 'Austin', 'Ava', 'Avery', 'Bailey', 'Bella',
            'Benjamin', 'Brooklyn', 'Caleb', 'Cameron', 'Carson', 'Carter', 'Charles',
            'Charlotte', 'Chase', 'Chloe', 'Christian', 'Christopher', 'Claire',
            'Cody', 'Colton', 'Connor', 'Cooper', 'Daniel', 'David', 'Delilah',
            'Dylan', 'Eleanor', 'Elena', 'Eli', 'Elijah', 'Elizabeth', 'Ella',
            'Ellie', 'Emily', 'Emma', 'Ethan', 'Eva', 'Evelyn', 'Faith', 'Gabriel',
            'Gavin', 'Genesis', 'Grace', 'Hailey', 'Hannah', 'Harper', 'Hayden',
            'Henry', 'Hunter', 'Ian', 'Isaac', 'Isabella', 'Isabelle', 'Isaiah',
            'Jack', 'Jackson', 'Jacob', 'Jake', 'James', 'Jasmine', 'Jason', 'Jayden',
            'Jeremiah', 'Jessica', 'John', 'Jonathan', 'Jordan', 'Joseph', 'Joshua',
            'Josiah', 'Julia', 'Julian', 'Justin', 'Kaitlyn', 'Katherine', 'Kayla',
            'Kaylee', 'Kennedy', 'Kevin', 'Khloe', 'Kylie', 'Landon', 'Lauren',
            'Layla', 'Leah', 'Leo', 'Levi', 'Liam', 'Lillian', 'Lily', 'Logan',
            'Lucas', 'Lucy', 'Luke', 'Lydia', 'Mackenzie', 'Madelyn', 'Madison',
            'Makayla', 'Mason', 'Matthew', 'Maya', 'Mia', 'Michael', 'Mila',
            'Morgan', 'Natalie', 'Nathan', 'Nevaeh', 'Nicholas', 'Noah', 'Nolan',
            'Olivia', 'Owen', 'Parker', 'Peyton', 'Piper', 'Quinn', 'Reagan',
            'Riley', 'Robert', 'Ryan', 'Sadie', 'Samantha', 'Samuel', 'Sarah',
            'Savannah', 'Scarlett', 'Sebastian', 'Serenity', 'Skylar', 'Sofia',
            'Sophia', 'Sophie', 'Stella', 'Sydney', 'Taylor', 'Trinity', 'Tyler',
            'Victoria', 'Violet', 'William', 'Wyatt', 'Xavier', 'Zachary', 'Zoe'
        ]

        student_last_names = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
            'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
            'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
            'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
            'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
            'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
            'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
            'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz',
            'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris',
            'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan',
            'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos',
            'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez',
            'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
            'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long',
            'Ross', 'Foster', 'Jimenez'
        ]

        # School names
        school_names = [
            'Riverside Academy', 'Green Valley High School', 'Central City School',
            'Mountain View Academy', 'Lakeside High School', 'Sunset Valley School',
            'Oak Ridge Academy', 'Maple Leaf High School', 'Pine Grove School',
            'Cedar Hill Academy'
        ]

        # Create schools (idempotent)
        schools = []
        for i in range(schools_count):
            school_name = school_names[i] if i < len(school_names) else f'School {i+1}'
            school_code = f'SCH{i+1:03d}'
            school, created = School.objects.get_or_create(
                code=school_code,
                defaults={
                    'name': school_name,
                    'address': fake.address(),
                    'motto': fake.sentence(),
                    'aim': fake.paragraph(),
                }
            )
            schools.append(school)
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created school: {school.name} ({school.code})')
                )

        # Create streams for each school
        streams = []
        stream_letters = [chr(ord('A') + i) for i in range(streams_per_school)]
        for school in schools:
            for stream_name in stream_letters:
                stream, created = Stream.objects.get_or_create(
                    name=stream_name,
                    school=school
                )
                streams.append(stream)
                if created:
                    self.stdout.write(
                        self.style.SUCCESS(f'Created stream: {stream.name} for {school.name}')
                    )

        # Create subjects
        subjects = []
        for school in schools:
            for spec in subject_catalog:
                subject_code = f"{school.code}-{spec['abbr']}"
                subject, created = Subject.objects.get_or_create(
                    code=subject_code,
                    defaults={
                        'name': spec['name'],
                        'category': spec['category'],
                        'school': school,
                    }
                )
                if created:
                    subjects.append(subject)
                    self.stdout.write(
                        self.style.SUCCESS(f"Created subject: {subject.name} for {school.name}")
                    )

        # Create classes
        total_classes_created = 0
        for school in schools:
            school_streams = [s for s in streams if s.school == school]
            school_subjects = list(Subject.objects.filter(school=school))

            # Create classes per school: 9 grades x N streams
            for grade in range(1, 10):  # Grades 1-9
                for stream in school_streams:
                    class_obj, created = Class.objects.get_or_create(
                        grade_level=str(grade),
                        stream=stream,
                        school=school,
                    )

                    if created:
                        # Assign ALL catalog subjects to class (as requested)
                        class_obj.subjects.set(school_subjects)
                        total_classes_created += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'Created class: {class_obj.name} for {school.name}')
                        )

        self.stdout.write(
            self.style.SUCCESS(f'Total classes created: {total_classes_created}')
        )

        # Create teachers
        total_teachers_created = 0
        for school in schools:
            # Fetch subjects from DB to include any that existed before this run
            school_subjects = list(Subject.objects.filter(school=school))

            for i in range(teachers_per_school):
                # Create user account for teacher
                first_name = random.choice(teacher_first_names)
                last_name = random.choice(teacher_last_names)
                # Add counter to ensure unique usernames
                username = f"{first_name.lower()}.{last_name.lower()}.{i+1:03d}.{school.code.lower()}"

                user = User.objects.create_user(
                    username=username,
                    email=f'{username}@school.com',
                    password='password123',
                    first_name=first_name,
                    last_name=last_name,
                    role='teacher',
                    phone=fake.phone_number(),
                    school=school
                )

                # Create teacher profile (random subset of catalog subjects for expertise)
                teacher_subjects = random.sample(school_subjects, min(len(school_subjects), random.randint(2, 5)))
                subjects_str = ', '.join([s.name for s in teacher_subjects])

                TeacherProfile.objects.create(
                    user=user,
                    subjects=subjects_str
                )

                total_teachers_created += 1
                if (i + 1) % 10 == 0:
                    self.stdout.write(
                        self.style.SUCCESS(f'Created {i+1} teachers for {school.name}')
                    )

        self.stdout.write(
            self.style.SUCCESS(f'Total teachers created: {total_teachers_created}')
        )

        # Assign class teachers and subject teachers per class
        for school in schools:
            school_classes = list(Class.objects.filter(school=school).select_related('stream'))
            school_teachers = list(User.objects.filter(school=school, role='teacher'))
            teacher_profiles = {tp.user_id: tp for tp in TeacherProfile.objects.filter(user__in=school_teachers)}

            # Class teacher assignment: ensure one class teacher per class
            # Try to avoid reusing teachers until necessary
            teacher_index = 0
            for klass in school_classes:
                if not school_teachers:
                    break
                teacher = school_teachers[teacher_index % len(school_teachers)]
                teacher_index += 1
                klass.teacher = teacher
                klass.save(update_fields=['teacher', 'updated_at'])
                # Update TeacherProfile.klass
                tp = teacher_profiles.get(teacher.id)
                if tp:
                    tp.klass = klass
                    tp.save(update_fields=['klass'])

            # Subject teacher assignment (ensure every class-subject has a teacher)
            for klass in school_classes:
                for subject in klass.subjects.all():
                    # P.P.I should be assigned to the class teacher (if available)
                    subj_name_norm = subject.name.replace('.', '').strip().lower()
                    if subj_name_norm == 'ppi' and klass.teacher:
                        assigned_teacher = klass.teacher
                    else:
                        # Prefer a teacher whose profile includes the subject name
                        preferred = []
                        for t in school_teachers:
                            tp = teacher_profiles.get(t.id)
                            subs = [s.strip().lower() for s in tp.subjects.split(',')] if tp and tp.subjects else []
                            if subject.name.lower() in subs:
                                preferred.append(t)
                        assigned_teacher = random.choice(preferred) if preferred else random.choice(school_teachers)
                    ClassSubjectTeacher.objects.get_or_create(
                        klass=klass,
                        subject=subject,
                        defaults={'teacher': assigned_teacher}
                    )

        # Create students
        total_students_created = 0
        for school in schools:
            school_classes = list(Class.objects.filter(school=school).order_by('grade_level', 'stream__name'))
            num_classes = len(school_classes)
            if num_classes == 0:
                continue
            per_class = students_per_school // num_classes
            remainder = students_per_school % num_classes

            admission_counter = 0
            for idx, klass in enumerate(school_classes):
                count_for_class = per_class + (1 if idx < remainder else 0)
                for j in range(count_for_class):
                    admission_counter += 1
                    # Create user account for student
                    first_name = random.choice(student_first_names)
                    last_name = random.choice(student_last_names)
                    username = f"{first_name.lower()}.{last_name.lower()}.{admission_counter:03d}.{school.code.lower()}"

                    # Generate random birth date (5-18 years old)
                    today = date.today()
                    start_date = today - timedelta(days=18*365)
                    end_date = today - timedelta(days=5*365)
                    dob = fake.date_between(start_date=start_date, end_date=end_date)

                    user = User.objects.create_user(
                        username=username,
                        email=f'{username}@student.com',
                        password='password123',
                        first_name=first_name,
                        last_name=last_name,
                        role='student',
                        phone=kenyan_phone(),
                        school=school
                    )

                    # Create student profile
                    admission_no = f'{school.code}-{admission_counter:04d}'

                    Student.objects.create(
                        admission_no=admission_no,
                        name=f'{first_name} {last_name}',
                        dob=dob,
                        gender=random.choice(['Male', 'Female']),
                        guardian_id=f'GUARD{admission_counter:04d}',
                        klass=klass,
                        user=user,
                        phone=kenyan_phone(),
                        email=f'{username}@student.com',
                        address=fake.address()
                    )

                    total_students_created += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Class {klass.name}: created {count_for_class} students')
                )

        self.stdout.write(
            self.style.SUCCESS(f'Total students created: {total_students_created}')
        )

        # Create some competencies
        competencies = [
            {'code': 'LIT', 'title': 'Literacy', 'description': 'Reading and writing skills'},
            {'code': 'NUM', 'title': 'Numeracy', 'description': 'Mathematical skills'},
            {'code': 'SCI', 'title': 'Scientific Thinking', 'description': 'Scientific method and reasoning'},
            {'code': 'SOC', 'title': 'Social Skills', 'description': 'Communication and collaboration'},
            {'code': 'CRE', 'title': 'Creative Expression', 'description': 'Artistic and creative abilities'},
        ]

        for comp_data in competencies:
            Competency.objects.get_or_create(
                code=comp_data['code'],
                defaults={
                    'title': comp_data['title'],
                    'description': comp_data['description'],
                    'level_scale': ['Emerging', 'Developing', 'Proficient', 'Mastered']
                }
            )

        # ===== Finance seeding: Fee Categories, Invoices, and Payments =====
        try:
            self.stdout.write(self.style.WARNING('Seeding finance data (fee categories, invoices, payments)...'))
            base_categories = ['Tuition', 'Transport', 'Lunch', 'Library', 'Activity']
            categories_by_school = {}
            for school in schools:
                cats = []
                for name in base_categories[:max(0, int(fee_categories_count))]:
                    cat, _ = FeeCategory.objects.get_or_create(
                        school=school,
                        name=name,
                        defaults={'description': f'{name} fee', 'is_special': False}
                    )
                    cats.append(cat)
                categories_by_school[school.id] = cats

            # Create one invoice per category per student, and ensure at least N payments per student
            from decimal import Decimal
            total_invoices = 0
            total_payments = 0
            current_year = timezone.now().year
            default_term = 1
            for school in schools:
                cats = categories_by_school.get(school.id, [])
                if not cats:
                    continue
                for stu in Student.objects.filter(klass__school=school):
                    student_invoices = []
                    for cat in cats:
                        amount = Decimal(random.randint(5000, 15000))
                        inv = Invoice.objects.create(
                            student=stu,
                            amount=amount,
                            status='unpaid',
                            category=cat,
                            year=current_year,
                            term=default_term,
                            due_date=timezone.now().date() + timedelta(days=30)
                        )
                        student_invoices.append(inv)
                        total_invoices += 1

                    # Ensure at least payments_per_student payments exist for this student
                    pay_needed = max(0, int(payments_per_student))
                    for k in range(pay_needed):
                        target_inv = student_invoices[0] if student_invoices else None
                        if not target_inv:
                            break
                        # Random partial payment between 20% and 60% of invoice
                        pay_amount = (target_inv.amount * Decimal(random.randint(20, 60)))/Decimal(100)
                        Payment.objects.create(
                            invoice=target_inv,
                            amount=pay_amount,
                            method='cash',
                            reference=f'RCPT-{stu.admission_no}-{k+1}',
                            recorded_by=None
                        )
                        total_payments += 1
            self.stdout.write(self.style.SUCCESS(f"✓ Finance: created ~{total_invoices} invoices and {total_payments} payments"))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Finance seeding skipped due to error: {e}"))

        # ===== Exams and Results seeding =====
        try:
            self.stdout.write(self.style.WARNING('Seeding exams and results for each class...'))
            exams_created = 0
            results_created = 0
            year = timezone.now().year
            term = 1
            for school in schools:
                school_classes = list(Class.objects.filter(school=school))
                for klass in school_classes:
                    class_subjects = list(klass.subjects.all())
                    if not class_subjects:
                        continue
                    for i in range(max(0, int(common_exams))):
                        exam = Exam.objects.create(
                            name=f"Common Exam {i+1}",
                            year=year,
                            term=term,
                            klass=klass,
                            date=timezone.now().date(),
                            total_marks=100,
                            published=True,
                            published_at=timezone.now(),
                        )
                        exams_created += 1
                        # Results for all students in class for all subjects
                        students = list(Student.objects.filter(klass=klass))
                        for stu in students:
                            for subj in class_subjects:
                                try:
                                    ExamResult.objects.create(
                                        exam=exam,
                                        student=stu,
                                        subject=subj,
                                        marks=float(random.randint(30, 99))
                                    )
                                    results_created += 1
                                except Exception:
                                    continue
            self.stdout.write(self.style.SUCCESS(f"✓ Exams: created {exams_created} exams and ~{results_created} results"))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Exam seeding skipped due to error: {e}"))

        self.stdout.write(
            self.style.SUCCESS('Database seeding completed successfully!')
        )
        self.stdout.write(
            self.style.SUCCESS(f'Summary:')
        )
        self.stdout.write(
            self.style.SUCCESS(f'  - Schools: {schools_count}')
        )
        self.stdout.write(
            self.style.SUCCESS(f'  - Classes: {total_classes_created}')
        )
        self.stdout.write(
            self.style.SUCCESS(f'  - Teachers: {total_teachers_created}')
        )
        self.stdout.write(
            self.style.SUCCESS(f'  - Students: {total_students_created}')
        )
