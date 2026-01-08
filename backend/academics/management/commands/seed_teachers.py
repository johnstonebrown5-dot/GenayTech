from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from faker import Faker
import random

from academics.models import Class, Subject, TeacherProfile, ClassSubjectTeacher
from accounts.models import School

User = get_user_model()

def kenyan_phone():
    return '07' + ''.join(str(random.randint(0, 9)) for _ in range(8))

class Command(BaseCommand):
    help = "Seed only teachers for existing schools. Optionally assign class teachers and subject teachers."

    def add_arguments(self, parser):
        parser.add_argument(
            '--teachers-per-school', type=int, default=10,
            help='Number of teachers to create per school (default: 10)'
        )
        parser.add_argument(
            '--assign-class-teachers', action='store_true', default=False,
            help='If set, assign a class teacher to each class (round-robin).'
        )
        parser.add_argument(
            '--assign-subjects', action='store_true', default=False,
            help='If set, ensure every (class, subject) has a ClassSubjectTeacher.'
        )

    def handle(self, *args, **options):
        fake = Faker()
        Faker.seed(42)
        random.seed(42)

        teachers_per_school = options['teachers_per_school']
        assign_class_teachers = options['assign_class_teachers']
        assign_subjects = options['assign_subjects']

        schools = list(School.objects.all())
        if not schools:
            self.stdout.write(self.style.ERROR('No schools found. Please create a school first.'))
            return

        total_teachers_created = 0
        for school in schools:
            self.stdout.write(self.style.NOTICE(f"Seeding teachers for {school.name} ({school.code})"))

            # Create teachers
            school_subjects = list(Subject.objects.filter(school=school))
            for i in range(teachers_per_school):
                first_name = fake.first_name()
                last_name = fake.last_name()
                username = f"{first_name.lower()}.{last_name.lower()}.{timezone.now().strftime('%y%m%d%H%M%S')}.{i:02d}.{school.code.lower()}"
                user = User.objects.create_user(
                    username=username,
                    email=f'{username}@school.com',
                    password='password123',
                    first_name=first_name,
                    last_name=last_name,
                    role='teacher',
                    phone=kenyan_phone(),
                    school=school,
                )
                # random subject expertise (2-5)
                teacher_subjects = random.sample(school_subjects, min(len(school_subjects), random.randint(2, 5))) if school_subjects else []
                subjects_str = ', '.join([s.name for s in teacher_subjects])
                TeacherProfile.objects.create(user=user, subjects=subjects_str)
                total_teachers_created += 1

            self.stdout.write(self.style.SUCCESS(f"Created {teachers_per_school} teachers for {school.name}"))

            # Assign class teachers
            if assign_class_teachers:
                teachers = list(User.objects.filter(school=school, role='teacher').order_by('id'))
                classes = list(Class.objects.filter(school=school).order_by('id'))
                if teachers and classes:
                    for idx, klass in enumerate(classes):
                        t = teachers[idx % len(teachers)]
                        if klass.teacher_id != t.id:
                            klass.teacher = t
                            klass.save(update_fields=['teacher', 'updated_at'])
                        tp = TeacherProfile.objects.filter(user=t).first()
                        if tp and tp.klass_id != klass.id:
                            tp.klass = klass
                            tp.save(update_fields=['klass'])
                    self.stdout.write(self.style.SUCCESS(f"Assigned class teachers for {len(classes)} classes in {school.name}"))

            # Assign subject teachers
            if assign_subjects:
                teachers = list(User.objects.filter(school=school, role='teacher'))
                teacher_profiles = {tp.user_id: tp for tp in TeacherProfile.objects.filter(user__in=teachers)}
                classes = list(Class.objects.filter(school=school))
                for klass in classes:
                    for subject in klass.subjects.all():
                        # P.P.I to class teacher if available
                        subj_name_norm = subject.name.replace('.', '').strip().lower()
                        assigned_teacher = None
                        if subj_name_norm == 'ppi' and klass.teacher_id:
                            assigned_teacher = klass.teacher
                        else:
                            # prefer expertise
                            preferred = []
                            for t in teachers:
                                tp = teacher_profiles.get(t.id)
                                subs = [s.strip().lower() for s in tp.subjects.split(',')] if tp and tp.subjects else []
                                if subject.name.lower() in subs:
                                    preferred.append(t)
                            assigned_teacher = random.choice(preferred) if preferred else (random.choice(teachers) if teachers else None)
                        if assigned_teacher:
                            ClassSubjectTeacher.objects.get_or_create(
                                klass=klass,
                                subject=subject,
                                defaults={'teacher': assigned_teacher}
                            )
                self.stdout.write(self.style.SUCCESS(f"Ensured subject teachers for all class-subjects in {school.name}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Total teachers created: {total_teachers_created}"))
