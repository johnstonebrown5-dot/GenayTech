$#!/usr/bin/env python
"""
Standalone data seeding script for Genay Technologies
Run this script to seed the database with schools, classes, teachers, and students.
"""

import os
import sys
import django
from faker import Faker
import random
from datetime import date, timedelta

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edutrack.settings')

# Setup Django
django.setup()

from django.contrib.auth import get_user_model
from academics.models import Subject, Stream, Class, TeacherProfile, Student, Competency
from accounts.models import School

User = get_user_model()

def kenyan_phone():
    return '07' + ''.join(str(random.randint(0, 9)) for _ in range(8))

def seed_data():
    fake = Faker()
    Faker.seed(42)  # For reproducible results
    random.seed(42)

    print("Starting to seed database with realistic data...")

    # Configuration
    schools_count = 5
    teachers_per_school = 30
    students_per_school = 900
    classes_per_school = 18

    print(f'Seeding {schools_count} schools with:')
    print(f'  - {teachers_per_school} teachers per school')
    print(f'  - {students_per_school} students per school')
    print(f'  - {classes_per_school} classes per school')

    # Subject names for seeding
    subject_names = [
        'Mathematics', 'English', 'Kiswahili', 'Science', 'Social Studies',
        'Religious Education', 'Physical Education', 'Art', 'Music',
        'Computer Studies', 'Home Science', 'Agriculture', 'Business Studies'
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
            print(f'✓ Created school: {school.name} ({school.code})')

    # Create streams for each school
    streams = []
    for school in schools:
        for stream_name in ['A', 'B', 'C']:
            stream, created = Stream.objects.get_or_create(
                name=stream_name,
                school=school
            )
            streams.append(stream)
            if created:
                print(f'✓ Created stream: {stream.name} for {school.name}')

    # Create subjects
    subjects = []
    for subject_name in subject_names:
        # Create subject for each school
        for school in schools:
            subject_code = f"{school.code}-{subject_name[:3].upper()}"
            subject, created = Subject.objects.get_or_create(
                code=subject_code,
                defaults={
                    'name': subject_name,
                    'school': school,
                }
            )
            subjects.append(subject)
            if created:
                print(f'✓ Created subject: {subject.name} for {school.name}')

    # Create classes
    total_classes_created = 0
    for school in schools:
        school_streams = [s for s in streams if s.school == school]
        # Fetch subjects from DB to include any that existed before this run
        school_subjects = list(Subject.objects.filter(school=school))

        # Create classes: 2 classes per grade for grades 1-9
        for grade in range(1, 10):  # Grades 1-9
            for class_num in range(1, 3):  # 2 classes per grade
                for stream in school_streams:
                    class_name = f'Grade {grade}{stream.name}'

                    # Create class
                    class_obj = Class.objects.create(
                        name=class_name,
                        grade_level=str(grade),
                        stream=stream,
                        school=school
                    )

                    # Assign subjects to class
                    class_subjects = random.sample(school_subjects, min(8, len(school_subjects)))
                    class_obj.subjects.set(class_subjects)

                    total_classes_created += 1
                    print(f'✓ Created class: {class_obj.name} for {school.name}')

    print(f'✓ Total classes created: {total_classes_created}')

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
                phone=kenyan_phone(),
                school=school
            )

            # Create teacher profile
            teacher_subjects = random.sample(school_subjects, random.randint(2, 5))
            subjects_str = ', '.join([s.name for s in teacher_subjects])

            teacher_profile = TeacherProfile.objects.create(
                user=user,
                subjects=subjects_str
            )

            total_teachers_created += 1
            if (i + 1) % 10 == 0:
                print(f'✓ Created {i+1} teachers for {school.name}')

    print(f'✓ Total teachers created: {total_teachers_created}')

    # Create students
    total_students_created = 0
    for school in schools:
        school_classes = list(Class.objects.filter(school=school))

        for i in range(students_per_school):
            # Create user account for student
            first_name = random.choice(student_first_names)
            last_name = random.choice(student_last_names)
            username = f"{first_name.lower()}.{last_name.lower()}.{i+1:03d}.{school.code.lower()}"

            # Generate random birth date (5-18 years old)
            today = date.today()
            start_date = today - timedelta(days=18*365)
            end_date = today - timedelta(days=5*365)
            random_date = fake.date_between(start_date=start_date, end_date=end_date)
            dob = random_date

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
            admission_no = f'{school.code}-{i+1:04d}'

            # Assign random class
            student_class = random.choice(school_classes)

            student = Student.objects.create(
                admission_no=admission_no,
                name=f'{first_name} {last_name}',
                dob=dob,
                gender=random.choice(['Male', 'Female']),
                guardian_id=f'GUARD{i+1:04d}',
                klass=student_class,
                user=user,
                phone=kenyan_phone(),
                email=f'{username}@student.com',
                address=fake.address()
            )

            total_students_created += 1
            if (i + 1) % 100 == 0:
                print(f'✓ Created {i+1} students for {school.name}')

    print(f'✓ Total students created: {total_students_created}')

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

    print('✓ Database seeding completed successfully!')
    print('Summary:')
    print(f'  - Schools: {schools_count}')
    print(f'  - Classes: {total_classes_created}')
    print(f'  - Teachers: {total_teachers_created}')
    print(f'  - Students: {total_students_created}')

    print('\nNote: All users have the default password "password123"')
    print('You can change passwords later through the admin interface.')

if __name__ == '__main__':
    try:
        seed_data()
    except Exception as e:
        print(f'Error during seeding: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
