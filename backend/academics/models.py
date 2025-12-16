from django.db import models
from django.db import IntegrityError
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from datetime import date, datetime, timedelta, time

class Subject(models.Model):
    CATEGORY_CHOICES = (
        ("language", "Language"),
        ("science", "Science"),
        ("arts", "Arts"),
        ("humanities", "Humanities"),
        ("other", "Other"),
    )
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
    is_priority = models.BooleanField(default=False, help_text="If true, this subject is prioritized in timetable generation.")
    is_examinable = models.BooleanField(default=True, help_text="If false, this subject is excluded from exams, results, and analytics.")
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, null=True, blank=True)
    def __str__(self):
        return f"{self.code} - {self.name}"

class SubjectComponent(models.Model):
    """A component/paper of a subject (e.g., English -> Paper 1, Paper 2).
    Keeps Subject as the atomic unit across timetable/assignments while allowing
    results to be captured per component.
    """
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='components')
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    max_marks = models.FloatField(null=True, blank=True, help_text="Optional max marks for this component")
    weight = models.FloatField(null=True, blank=True, help_text="Optional weight for aggregation (defaults to simple sum)")
    order = models.IntegerField(default=0)

    class Meta:
        unique_together = ("subject", "code")
        ordering = ["subject", "order", "code"]

    def __str__(self):
        return f"{self.subject.code} - {self.code} ({self.name})"

class Stream(models.Model):
    name = models.CharField(max_length=100)
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('name', 'school')

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """
        On save, ensure related classes are updated when stream name or school changes.
        - On rename: Update class names to reflect the new stream name
        - On school change: Update class school to match the stream's school
        """
        # Check if this is an existing instance and get the old values
        if self.pk:
            old_instance = Stream.objects.get(pk=self.pk)
            name_changed = old_instance.name != self.name
            school_changed = old_instance.school_id != self.school_id
        else:
            name_changed = True
            school_changed = True

        # Save the stream first
        super().save(*args, **kwargs)
        
        try:
            from django.apps import apps
            ClassModel = apps.get_model('academics', 'Class')
            classes = ClassModel.objects.filter(stream=self).only('id', 'grade_level', 'stream', 'school')
            
            for c in classes:
                update_fields = []
                
                # If school changed, update the class's school
                if school_changed and c.school_id != self.school_id:
                    c.school = self.school
                    update_fields.append('school')
                
                # If name changed, update the class name
                if name_changed:
                    update_fields.append('name')
                
                # Only save if there are fields to update
                if update_fields:
                    c.save(update_fields=update_fields)
                    
        except Exception as e:
            # Log the error but don't break the save operation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error updating related classes for stream {self.id}: {str(e)}")

class Class(models.Model):
    """
    Represents a class in the school system.
    The name is automatically generated from the grade level and stream name.
    Format: 'Grade X [Stream Name]' (e.g., 'Grade 1 East')
    """
    name = models.CharField(max_length=100, blank=True, editable=False)  # Auto-generated, not editable
    grade_level = models.CharField(max_length=20, help_text="Grade level (e.g., '1', 'Grade 1')")
    stream = models.ForeignKey(Stream, on_delete=models.PROTECT, related_name='classes')
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, 
                              on_delete=models.SET_NULL, related_name='class_teacher')
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='classes')
    subjects = models.ManyToManyField(Subject, blank=True, related_name='classes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Classes'
        unique_together = ('grade_level', 'stream', 'school')
        ordering = ['grade_level', 'stream__name']

    @staticmethod
    def format_grade_level(grade_level):
        """Standardize the grade level format to 'Grade X'.
        
        Args:
            grade_level (str): The grade level to format (e.g., '1', 'Grade 1', 'G1')
            
        Returns:
            str: Formatted grade level (e.g., 'Grade 1')
        """
        if not grade_level:
            return ""
            
        # Remove any non-digit characters
        import re
        grade_num = re.sub(r'\D', '', str(grade_level))
        
        # If we found a number, format it as 'Grade X'
        if grade_num.isdigit():
            return f"Grade {int(grade_num)}"
        return str(grade_level).strip()
    
    def clean(self):
        """Validate that required fields are present."""
        if not self.grade_level:
            raise DjangoValidationError("Grade level is required")
        if not self.stream:
            raise DjangoValidationError("Stream is required")
        if not self.school:
            raise DjangoValidationError("School is required")
            
        # Format the grade level
        self.grade_level = self.format_grade_level(self.grade_level)
        
    def get_class_name(self):
        """Generate a consistent class name based on grade level and stream."""
        if not self.grade_level or not self.stream:
            return ""
        
        # Format the grade level
        formatted_grade = self.format_grade_level(self.grade_level)
        # Special case: Graduated class should render as just 'Graduated'
        if str(formatted_grade).strip().lower() == 'graduated':
            return 'Graduated'
        
        # Return the class name in the format 'Grade X [Stream Name]'
        return f"{formatted_grade} {self.stream.name}".strip()
    
    def save(self, *args, **kwargs):
        # Format the grade level
        if self.grade_level:
            self.grade_level = self.format_grade_level(self.grade_level)
            
        # Always generate the name from grade level and stream
        if self.grade_level and self.stream:
            self.name = self.get_class_name()
        else:
            raise ValueError("Both grade_level and stream are required to generate class name")
            
        # Clean and validate
        self.full_clean()
            
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name or f"Class object ({self.pk})"

    @staticmethod
    def get_or_create_graduated_class(school):
        """Return a per-school special 'Graduated' class (not part of normal classes).
        Creates a dedicated Stream named 'Graduated' if missing, and a Class with
        grade_level='Graduated'. Name will render as 'Graduated'.
        """
        if not school:
            return None
        try:
            # Ensure a 'Graduated' stream exists for this school
            stream, _ = Stream.objects.get_or_create(school=school, name='Graduated')
            # Class unique_together uses (grade_level, stream, school), so this is unique
            klass, _ = Class.objects.get_or_create(
                school=school,
                stream=stream,
                grade_level='Graduated',
                defaults={
                    'teacher': None,
                }
            )
            return klass
        except Exception:
            return None

class TeacherProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subjects = models.CharField(max_length=255, blank=True)
    klass = models.ForeignKey(Class, null=True, blank=True, on_delete=models.SET_NULL)
    # Allows delegating timetable management to selected teachers
    can_manage_timetable = models.BooleanField(default=False, help_text="If true, this teacher can manage timetable data (create/update).")
    tsc_number = models.CharField(max_length=50, null=True, blank=True, unique=True, help_text="T.S.C number")

class Student(models.Model):
    admission_no = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    dob = models.DateField()
    gender = models.CharField(max_length=20)
    upi_number = models.CharField(max_length=50, blank=True)
    guardian_id = models.CharField(max_length=100, blank=True)
    guardian_name = models.CharField(max_length=255, blank=True)
    guardian_passport_no = models.CharField(max_length=50, blank=True)
    birth_certificate_no = models.CharField(max_length=50, blank=True)
    klass = models.ForeignKey(Class, null=True, on_delete=models.SET_NULL)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    # Keep school for scoping when klass is null (graduated)
    school = models.ForeignKey('accounts.School', null=True, blank=True, on_delete=models.SET_NULL, related_name='students')
    # Extra personal information fields
    passport_no = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    photo = models.ImageField(upload_to='student_photos/', null=True, blank=True)
    # Graduation status
    is_graduated = models.BooleanField(default=False)
    graduation_year = models.IntegerField(null=True, blank=True)
    # Boarding status
    boarding_status = models.CharField(
        max_length=10,
        choices=(('day', 'Day'), ('boarding', 'Boarding')),
        default='day',
        help_text='Whether the student is a day scholar or a boarder.'
    )
    is_active = models.BooleanField(default=True, help_text='When false, the student is inactive: excluded from exams, fees, messaging, and login disabled.')

class TeacherDuty(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('done', 'Done'),
        ('canceled', 'Canceled'),
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_duties')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_duties')
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    remind_daily = models.BooleanField(default=True)
    last_reminded_at = models.DateTimeField(null=True, blank=True)
    school = models.ForeignKey('accounts.School', null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['teacher','status']),
        ]

    def __str__(self):
        return f"{self.title} -> {getattr(self.teacher, 'username', self.teacher_id)} ({self.status})"

class StudentClassHistory(models.Model):
    ACTION_CHOICES = (
        ('assigned', 'Assigned'),
        ('promoted', 'Promoted'),
        ('moved', 'Moved'),
        ('graduated', 'Graduated'),
        ('unassigned', 'Unassigned'),
    )
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='class_history')
    from_class = models.ForeignKey('academics.Class', null=True, blank=True, on_delete=models.SET_NULL, related_name='history_from')
    to_class = models.ForeignKey('academics.Class', null=True, blank=True, on_delete=models.SET_NULL, related_name='history_to')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default='moved')
    year = models.IntegerField(null=True, blank=True)
    term = models.IntegerField(null=True, blank=True)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

class Competency(models.Model):
    code = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    level_scale = models.JSONField(default=list)  # ["Emerging","Developing","Proficient","Mastered"]

class Assessment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    competency = models.ForeignKey(Competency, on_delete=models.CASCADE)
    level = models.CharField(max_length=50)
    comment = models.TextField(blank=True)
    evidence = models.FileField(upload_to='evidence/', blank=True, null=True)
    date = models.DateField(auto_now_add=True)

class Portfolio(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

class Attendance(models.Model):
    STATUS_CHOICES = (
        ("present","Present"),
        ("absent","Absent"),
        ("late","Late"),
    )
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    class Meta:
        unique_together = ("student","date")


# ===== Exams =====
class LessonPlan(models.Model):
    """Simple lesson plan authored by a teacher for a specific class and optional subject."""
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    klass = models.ForeignKey(Class, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True)
    # Optional explicit date of lesson; for planning by week/term use fields below
    date = models.DateField()
    # New: plan scoping by academic term and week number (1-13)
    term = models.ForeignKey('Term', on_delete=models.SET_NULL, null=True, blank=True, related_name='lesson_plans')
    week = models.IntegerField(null=True, blank=True, help_text="Week number within the term (1-13)")
    topic = models.CharField(max_length=255)
    objectives = models.TextField(blank=True)
    activities = models.TextField(blank=True)
    resources = models.TextField(blank=True)
    assessment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        subj = f" - {self.subject.code}" if self.subject else ""
        scope = f" T{getattr(self.term, 'number', '')} W{self.week}" if (self.term_id and self.week) else ""
        return f"{self.date} {self.klass}{subj}{scope}: {self.topic}"

# ===== Exams =====
class Exam(models.Model):
    TERM_CHOICES = (
        (1, 'Term 1'),
        (2, 'Term 2'),
        (3, 'Term 3'),
    )
    name = models.CharField(max_length=100)
    year = models.IntegerField()
    term = models.IntegerField(choices=TERM_CHOICES)
    klass = models.ForeignKey(Class, on_delete=models.CASCADE)
    date = models.DateField()
    total_marks = models.IntegerField(default=100)
    # Derive school from class -> school for scoping
    published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    # Snapshot the grade level at the time the exam was created to avoid issues after promotions
    grade_level_tag = models.CharField(max_length=20, blank=True, db_index=True, help_text="Grade level at the time the exam was set (e.g., 'Grade 4')")

    class Meta:
        ordering = ['name', 'year', 'term', 'klass__grade_level', 'klass__stream__name', 'date', 'id']

    def __str__(self):
        return f"{self.name} {self.year} T{self.term} - {self.klass}"

    def save(self, *args, **kwargs):
        # Ensure grade_level_tag is set on creation and remains stable after class promotions
        try:
            if not self.grade_level_tag and getattr(self, 'klass', None) and getattr(self.klass, 'grade_level', None):
                self.grade_level_tag = self.klass.grade_level
        except Exception:
            pass

        # Auto-format the exam name as '<BaseName> Term <term> <year>'
        # BaseName is the provided name with any existing 'Term X YYYY' suffix removed
        try:
            import re
            raw_name = (self.name or '').strip() or 'Exam'
            # Strip existing suffix patterns like ' - Term 3', 'Term 3 2025', ' - 2025', etc.
            base = re.sub(r"\s*[-,]*\s*Term\s*\d+\s*(\d{4})?$", "", raw_name, flags=re.IGNORECASE).strip()
            if not base:
                base = 'Exam'
            yr = None
            # Prefer explicit year field
            if getattr(self, 'year', None):
                try:
                    yr = int(self.year)
                except Exception:
                    yr = None
            # Fallback: infer from AcademicYear by date and school
            if yr is None and getattr(self, 'date', None) and getattr(self, 'klass', None) and getattr(self.klass, 'school_id', None):
                from .models import AcademicYear
                ay = AcademicYear.objects.filter(
                    school_id=self.klass.school_id,
                    start_date__lte=self.date,
                    end_date__gte=self.date,
                ).first()
                if ay:
                    try:
                        yr = int(getattr(ay.end_date, 'year', None) or getattr(ay.start_date, 'year', None))
                    except Exception:
                        yr = None
            # Build formatted name
            if getattr(self, 'term', None):
                if yr is not None:
                    self.name = f"{base} Term {int(self.term)} {yr}"
                else:
                    self.name = f"{base} Term {int(self.term)}"
        except Exception:
            # Keep provided name on any failure
            pass
        super().save(*args, **kwargs)


class ExamResult(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='results')
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    component = models.ForeignKey('SubjectComponent', on_delete=models.CASCADE, null=True, blank=True, related_name='results')
    marks = models.FloatField()

    class Meta:
        unique_together = ("exam","student","subject","component")


# ===== Class Subject Teacher Assignment =====
class ClassSubjectTeacher(models.Model):
    """Assign a subject teacher for a specific class and subject.
    This allows scenarios like: Grade 1 East — Science → Teacher X
    """
    klass = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='subject_teachers')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("klass", "subject")

    def __str__(self):
        return f"{self.klass} — {self.subject.code} → {getattr(self.teacher, 'username', self.teacher_id)}"

# ===== Grading =====
class SubjectGradingBand(models.Model):
    """Configurable grading bands per subject.
    Example rows: (A,80,100), (B,70,79)...
    """
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='grading_bands')
    grade = models.CharField(max_length=5)
    min = models.IntegerField()
    max = models.IntegerField()
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "-max"]
        unique_together = ("subject", "grade")

    def __str__(self):
        return f"{self.subject.code} {self.grade} ({self.min}-{self.max})"

# ===== Academic Calendar =====
class AcademicYear(models.Model):
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE)
    label = models.CharField(max_length=20, help_text="Display label e.g. 2024/2025")
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        unique_together = ("school", "label")
        ordering = ["-start_date"]

    def clean(self):
        # Basic date validation
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise DjangoValidationError({"end_date": "End date must be after start date"})

        # Ensure no overlap with other academic years in the same school
        qs = AcademicYear.objects.filter(school=self.school)
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if self.start_date and self.end_date:
            overlap = qs.filter(start_date__lte=self.end_date, end_date__gte=self.start_date).exists()
            if overlap:
                raise DjangoValidationError("Academic year dates overlap with an existing year for this school.")

    def promote_classes(self):
        """Promote all classes to the next grade level for the new academic year.
        - Increments the grade level number if it can be extracted
        - Skips classes that don't follow the expected format
        """
        from django.db import transaction
        
        # Get all classes from the previous academic year
        classes = Class.objects.filter(school=self.school).select_related('stream')
        
        with transaction.atomic():
            # Build a human-readable summary of actions for UI/debugging
            summary = {
                'school_id': getattr(self.school, 'id', None),
                'label': getattr(self, 'label', None),
                'graduated_classes': [],
                'moved_classes': [],  # moved to existing target
                'renamed_classes': [],  # in-place rename
                'skipped': [],  # classes skipped with reason
            }
            for class_obj in classes:
                try:
                    # Skip if no grade level or stream
                    if not class_obj.grade_level or not class_obj.stream:
                        summary['skipped'].append({'class_id': class_obj.id, 'name': getattr(class_obj, 'name', ''), 'reason': 'missing grade_level or stream'})
                        continue
                        
                    # Format the current grade level to ensure consistency
                    current_grade = Class.format_grade_level(class_obj.grade_level)
                    
                    # Extract the numeric part from the formatted grade
                    import re
                    # Prefer explicit pattern 'Grade <num>'
                    m_named = re.search(r'\bgrade\s*(\d{1,2})\b', current_grade, flags=re.IGNORECASE)
                    match = m_named if m_named else re.search(r'\b(\d{1,2})\b', current_grade)
                    if not match:
                        summary['skipped'].append({'class_id': class_obj.id, 'name': getattr(class_obj, 'name', ''), 'reason': f'no numeric grade in "{current_grade}"'})
                        continue
                        
                    # Increment the grade number
                    try:
                        current_grade_num = int(match.group(1) if match.lastindex else match.group())
                    except Exception:
                        summary['skipped'].append({'class_id': class_obj.id, 'name': getattr(class_obj, 'name', ''), 'reason': f'failed to parse grade from "{current_grade}"'})
                        continue
                    # Graduation rule: ONLY Grade 9 graduates. Others must be promoted.
                    if current_grade_num == 9:
                        grad_year = None
                        try:
                            # Prefer academic year end_date year
                            if getattr(self, 'end_date', None):
                                grad_year = int(self.end_date.year)
                            else:
                                # Fallback: try to parse label like "2024/2025" -> 2025
                                parts = [int(p) for p in re.findall(r'\d{4}', str(getattr(self, 'label', '')))]
                                if parts:
                                    grad_year = parts[-1]
                        except Exception:
                            grad_year = None
                        # Graduate students one-by-one, but block if fee balance > 0
                        moved_count = 0
                        not_cleared = []
                        for stu in class_obj.student_set.select_for_update().all():
                            try:
                                from finance.models import Invoice, Payment
                                from django.db.models import Sum
                                total_billed = Invoice.objects.filter(student=stu).aggregate(s=Sum('amount'))['s'] or 0
                                total_paid = Payment.objects.filter(invoice__student=stu).aggregate(s=Sum('amount'))['s'] or 0
                                balance = float(total_billed or 0) - float(total_paid or 0)
                            except Exception:
                                balance = 0
                            if balance > 0:
                                # Do NOT graduate; keep in class to allow clearance
                                not_cleared.append({'student_id': stu.id, 'name': stu.name, 'balance': balance})
                                continue
                            # Mark graduated students as inactive and clear class assignment
                            try:
                                # Record history: graduated
                                StudentClassHistory.objects.create(
                                    student=stu,
                                    from_class=class_obj,
                                    to_class=None,
                                    action='graduated',
                                    year=grad_year,
                                    term=None,
                                    note='Auto graduation'
                                )
                            except Exception:
                                pass
                            stu.klass = None
                            stu.is_graduated = True
                            stu.is_active = False
                            stu.graduation_year = grad_year
                            stu.school = class_obj.school
                            stu.save(update_fields=['klass','is_graduated','is_active','graduation_year','school'])
                            moved_count += 1
                        summary['graduated_classes'].append({
                            'class_id': class_obj.id,
                            'from': getattr(class_obj, 'name', ''),
                            'students': moved_count,
                            'graduation_year': grad_year,
                        })
                        # If all students were graduated (no students left in the class), clear the class teacher
                        if moved_count > 0 and not class_obj.student_set.exists():
                            class_obj.teacher = None
                            class_obj.save(update_fields=['teacher'])
                        if not_cleared:
                            summary.setdefault('not_cleared', []).extend(not_cleared)
                    else:
                        new_grade_num = current_grade_num + 1
                        # Check if a destination class already exists (same stream & school)
                        target = Class.objects.filter(
                            school=class_obj.school,
                            stream=class_obj.stream,
                            grade_level=Class.format_grade_level(str(new_grade_num))
                        ).first()
                        if target:
                            # Enforce: only promote into an empty target class
                            if target.student_set.exists():
                                summary['skipped'].append({'class_id': class_obj.id, 'name': getattr(class_obj, 'name', ''), 'reason': f'target class {getattr(target, "name", "")} is not empty'})
                            else:
                                # Reassign class teacher to the destination class and clear from the old class
                                target.teacher = class_obj.teacher
                                target.save(update_fields=['teacher'])
                                class_obj.teacher = None
                                class_obj.save(update_fields=['teacher'])
                                # Move students one-by-one to the existing destination class
                                moved_count = 0
                                for stu in class_obj.student_set.select_for_update().all():
                                    try:
                                        StudentClassHistory.objects.create(
                                            student=stu,
                                            from_class=class_obj,
                                            to_class=target,
                                            action='promoted',
                                            year=getattr(self.end_date, 'year', None) if getattr(self, 'end_date', None) else None,
                                            term=None,
                                            note='Auto promotion to next grade'
                                        )
                                    except Exception:
                                        pass
                                    stu.klass = target
                                    stu.is_graduated = False
                                    stu.school = class_obj.school
                                    stu.save(update_fields=['klass','is_graduated','school'])
                                    moved_count += 1
                                summary['moved_classes'].append({
                                    'from_id': class_obj.id,
                                    'from': getattr(class_obj, 'name', ''),
                                    'to_id': target.id,
                                    'to': getattr(target, 'name', ''),
                                    'students': moved_count,
                                })
                        else:
                            # In-place promote: update this class's grade_level so name regenerates
                            try:
                                class_obj.grade_level = str(new_grade_num)
                                # Save triggers name regeneration in Class.save(); may raise IntegrityError if target exists
                                class_obj.save(update_fields=['grade_level', 'name'])
                                # Students stay in the same class (now renamed)
                                summary['renamed_classes'].append({
                                    'class_id': class_obj.id,
                                    'from': f"{current_grade} {class_obj.stream.name}",
                                    'to': class_obj.name,
                                    'students': class_obj.student_set.count(),
                                })
                            except IntegrityError:
                                # Fallback: destination exists, move students instead
                                target = Class.objects.filter(
                                    school=class_obj.school,
                                    stream=class_obj.stream,
                                    grade_level=Class.format_grade_level(str(new_grade_num))
                                ).first()
                                if not target:
                                    raise
                                # Reassign teacher during fallback as well
                                target.teacher = class_obj.teacher
                                target.save(update_fields=['teacher'])
                                class_obj.teacher = None
                                class_obj.save(update_fields=['teacher'])
                                # Move students one-by-one
                                moved_count = 0
                                for stu in class_obj.student_set.select_for_update().all():
                                    try:
                                        StudentClassHistory.objects.create(
                                            student=stu,
                                            from_class=class_obj,
                                            to_class=target,
                                            action='promoted',
                                            year=getattr(self.end_date, 'year', None) if getattr(self, 'end_date', None) else None,
                                            term=None,
                                            note='Auto promotion (fallback move)'
                                        )
                                    except Exception:
                                        pass
                                    stu.klass = target
                                    stu.is_graduated = False
                                    stu.school = class_obj.school
                                    stu.save(update_fields=['klass','is_graduated','school'])
                                    moved_count += 1
                                summary['moved_classes'].append({
                                    'from_id': class_obj.id,
                                    'from': getattr(class_obj, 'name', ''),
                                    'to_id': target.id,
                                    'to': getattr(target, 'name', ''),
                                    'students': moved_count,
                                })
                    
                    # Log the promotion
                    import logging
                    logger = logging.getLogger(__name__)
                    if current_grade_num == 9:
                        logger.info(f"Graduated students from {class_obj.name}; max grade reached")
                    else:
                        logger.info(f"Promoted class {class_obj.get_class_name()} to Grade {new_grade_num} {class_obj.stream.name}")
                    
                except Exception as e:
                    # Log error but continue with other classes
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error promoting class {getattr(class_obj, 'id', 'unknown')}: {str(e)}", 
                               exc_info=True)
                    summary['skipped'].append({'class_id': getattr(class_obj, 'id', None), 'name': getattr(class_obj, 'name', ''), 'reason': f'error: {str(e)}'})

            return summary
    def save(self, *args, **kwargs):
        # Check if this is an existing instance being set as current
        if self.pk:
            old_instance = AcademicYear.objects.get(pk=self.pk)
            if not old_instance.is_current and self.is_current:
                # A new academic year is being set as current
                # Find and unset any other current academic year for this school
                AcademicYear.objects.filter(
                    school=self.school, 
                    is_current=True
                ).exclude(pk=self.pk).update(is_current=False)
        
        self.full_clean()
        super().save(*args, **kwargs)
        
        # If set as current, unset others for the same school
        if self.is_current:
            AcademicYear.objects.filter(school=self.school).exclude(pk=self.pk).update(is_current=False)

        # Auto-generate default terms if none exist: 3 terms x 3 months, with 1-month holidays between
        if not self.terms.exists() and self.start_date and self.end_date:
            def last_day_of_month(y, m):
                if m == 12:
                    return date(y, 12, 31)
                first_next = date(y, m+1, 1)
                return first_next - timedelta(days=1)

            def add_months(d: date, months: int) -> date:
                y = d.year + (d.month - 1 + months) // 12
                m = (d.month - 1 + months) % 12 + 1
                day = min(d.day, last_day_of_month(y, m).day)
                return date(y, m, day)

            # Helper to create an event (term or holiday)
            def create_event(school, title, start_d: date, end_d: date):
                if start_d > end_d:
                    return
                try:
                    from communications.models import Event
                    # Normalize datetimes to all-day
                    tz = timezone.get_current_timezone()
                    start_dt = tz.localize(datetime.combine(start_d, datetime.min.time()))
                    end_dt = tz.localize(datetime.combine(end_d, datetime.max.time()))
                    # Avoid duplicates by title/school/date range
                    exists = Event.objects.filter(
                        school=school, title=title, start__date=start_d, end__date=end_d
                    ).exists()
                    if not exists:
                        Event.objects.create(
                            school=school,
                            title=title,
                            description=f"Auto-generated event for {title}",
                            start=start_dt,
                            end=end_dt,
                            all_day=True,
                            audience='all',
                            visibility='internal',
                        )
                except Exception:
                    # Swallow errors to avoid breaking save flow if communications app not ready
                    pass

            # Build schedule
            current_start = self.start_date
            for n in range(1, 4):
                term_label = f"{self.label} - Term {n}"
                term_end = add_months(current_start, 3) - timedelta(days=1)
                if term_end > self.end_date:
                    term_end = self.end_date
                # Create term
                t = Term.objects.create(
                    academic_year=self,
                    number=n,
                    name='',
                    start_date=current_start,
                    end_date=term_end,
                    is_current=(n == 1 and self.is_current),
                )
                # Create corresponding event
                create_event(self.school, term_label, t.start_date, t.end_date)

                # Compute holiday (1 month) if room remains and not after last term
                if n < 3:
                    hol_start = t.end_date + timedelta(days=1)
                    hol_end = add_months(hol_start, 1) - timedelta(days=1)
                    if hol_start <= self.end_date and hol_start <= hol_end:
                        if hol_end > self.end_date:
                            hol_end = self.end_date
                        create_event(self.school, f"{self.label} - Holiday {n}", hol_start, hol_end)
                        # Next term start after holiday
                        current_start = hol_end + timedelta(days=1)
                    else:
                        # No room for holiday; next term starts next day
                        current_start = t.end_date + timedelta(days=1)

    def __str__(self):
        return f"{self.label} ({self.school})"


class Term(models.Model):
    TERM_CHOICES = (
        (1, 'Term 1'),
        (2, 'Term 2'),
        (3, 'Term 3'),
    )
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='terms')
    number = models.IntegerField(choices=TERM_CHOICES)
    name = models.CharField(max_length=50, blank=True, help_text="Optional custom name e.g. Trinity Term")
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        unique_together = ("academic_year", "number")
        ordering = ["academic_year__start_date", "number"]

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise DjangoValidationError({"end_date": "End date must be after start date"})

        # Ensure term falls within the academic year
        ay = self.academic_year
        if ay and self.start_date and self.end_date:
            if self.start_date < ay.start_date or self.end_date > ay.end_date:
                raise DjangoValidationError("Term dates must fall within the academic year's start and end dates.")

        # Prevent overlapping with other terms in the same academic year
        qs = Term.objects.filter(academic_year=self.academic_year)
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if self.start_date and self.end_date and qs.filter(start_date__lte=self.end_date, end_date__gte=self.start_date).exists():
            raise DjangoValidationError("Term dates overlap with another term in this academic year.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        if self.is_current:
            Term.objects.filter(academic_year=self.academic_year).exclude(pk=self.pk).update(is_current=False)

        # Create or update a corresponding Event entry
        try:
            from communications.models import Event
            school = self.academic_year.school
            title = f"{self.academic_year.label} - Term {self.number}"
            tz = timezone.get_current_timezone()
            start_dt = timezone.make_aware(datetime.combine(self.start_date, datetime.min.time()), tz)
            end_dt = timezone.make_aware(datetime.combine(self.end_date, datetime.max.time()), tz)
            qs = Event.objects.filter(
                school=school,
                title=title,
                start__date=self.start_date,
                end__date=self.end_date,
            )
            if qs.exists():
                qs.update(
                    description=f"Auto-synced event for {title}",
                    start=start_dt,
                    end=end_dt,
                    all_day=True,
                    audience='all',
                    visibility='internal',
                )
            else:
                Event.objects.create(
                    school=school,
                    title=title,
                    description=f"Auto-synced event for {title}",
                    start=start_dt,
                    end=end_dt,
                    all_day=True,
                    audience='all',
                    visibility='internal',
                )
        except Exception:
            pass

    def __str__(self):
        return f"{self.academic_year.label} - T{self.number}"

    def delete(self, *args, **kwargs):
        # Attempt to remove the matching event
        try:
            from communications.models import Event
            title = f"{self.academic_year.label} - Term {self.number}"
            Event.objects.filter(
                school=self.academic_year.school,
                title=title,
                start__date=self.start_date,
                end__date=self.end_date,
            ).delete()
        except Exception:
            pass
        return super().delete(*args, **kwargs)

# ===== Timetable =====
class Room(models.Model):
    """A physical or virtual room where lessons occur."""
    name = models.CharField(max_length=100)
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='rooms')

    class Meta:
        unique_together = ("school", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({getattr(self.school, 'name', self.school_id)})"


class TimetableEntry(models.Model):
    """Single lesson slot in the timetable.
    Constraints:
    - Within a specific term
    - For a specific class (klass) and subject
    - Optional explicit teacher; if blank, infer from ClassSubjectTeacher when rendering
    - Prevent overlaps for the same class, teacher, and room within the same day/term
    """
    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6
    SUNDAY = 7
    DAY_CHOICES = (
        (MONDAY, 'Monday'),
        (TUESDAY, 'Tuesday'),
        (WEDNESDAY, 'Wednesday'),
        (THURSDAY, 'Thursday'),
        (FRIDAY, 'Friday'),
        (SATURDAY, 'Saturday'),
        (SUNDAY, 'Sunday'),
    )

    term = models.ForeignKey(Term, on_delete=models.CASCADE, related_name='timetable_entries')
    day_of_week = models.IntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()

    klass = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='timetable_entries')
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name='timetable_entries')
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='timetable_entries')
    room = models.ForeignKey(Room, null=True, blank=True, on_delete=models.SET_NULL, related_name='timetable_entries')

    # Optional grouping/versioning
    plan = models.ForeignKey('TimetablePlan', null=True, blank=True, on_delete=models.SET_NULL, related_name='entries')
    version = models.ForeignKey('TimetableVersion', null=True, blank=True, on_delete=models.SET_NULL, related_name='entries')

    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["term__start_date", "day_of_week", "start_time"]
        indexes = [
            models.Index(fields=["term", "day_of_week", "klass"]),
            models.Index(fields=["term", "day_of_week", "teacher"]),
            models.Index(fields=["term", "day_of_week", "room"]),
            models.Index(fields=["version", "day_of_week", "klass", "start_time"]),
            models.Index(fields=["version", "day_of_week", "teacher", "start_time"]),
            models.Index(fields=["version", "day_of_week", "room", "start_time"]),
        ]

    def clean(self):
        # Basic validation
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise DjangoValidationError({"end_time": "End time must be after start time"})

        # Ensure class belongs to the same school as the room (if provided)
        if self.room and self.klass and self.room.school_id != self.klass.school_id:
            raise DjangoValidationError({"room": "Room must belong to the same school as the class"})

        # Ensure subject is part of the class's subjects
        if self.klass and self.subject and not self.klass.subjects.filter(id=self.subject_id).exists():
            raise DjangoValidationError({"subject": "Subject is not assigned to this class"})

        # Overlap checks within same term and day
        def overlaps(qs):
            return qs.filter(
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
            ).exists()

        if self.term_id and self.day_of_week and self.start_time and self.end_time:
            base_qs = TimetableEntry.objects.filter(term=self.term, day_of_week=self.day_of_week)
            if self.pk:
                base_qs = base_qs.exclude(pk=self.pk)

            # Class overlap
            if self.klass_id and overlaps(base_qs.filter(klass_id=self.klass_id)):
                raise DjangoValidationError("Class has another entry overlapping this time")

            # Teacher overlap
            if self.teacher_id and overlaps(base_qs.filter(teacher_id=self.teacher_id)):
                raise DjangoValidationError("Teacher has another entry overlapping this time")

            # Room overlap
            if self.room_id and overlaps(base_qs.filter(room_id=self.room_id)):
                raise DjangoValidationError("Room is occupied during this time")

        # Ensure time falls within the term dates (optional soft check; times are not dated)
        # Skipped because entries are weekly patterns

    def __str__(self):
        dow = dict(self.DAY_CHOICES).get(self.day_of_week, self.day_of_week)
        return f"{self.klass} {self.subject.code} {dow} {self.start_time}-{self.end_time}"


# ===== Timetable Planning (Templates, Plans, Versions) =====
class TimetableTemplate(models.Model):
    """Reusable weekly template defining days and period structure for lessons/breaks/lunch."""
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='timetable_templates')
    name = models.CharField(max_length=100)
    default_period_minutes = models.IntegerField(default=40)
    start_of_day = models.TimeField(default=time(8, 0))
    # Store active day numbers (1=Mon ... 5=Fri) as list
    days_active = models.JSONField(default=list)
    is_default = models.BooleanField(default=False)

    class Meta:
        unique_together = ("school", "name")
        ordering = ["school", "name"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            TimetableTemplate.objects.filter(school=self.school).exclude(pk=self.pk).update(is_default=False)

    def __str__(self):
        return f"{self.name} ({getattr(self.school,'name', self.school_id)})"


class PeriodSlotTemplate(models.Model):
    KIND_CHOICES = (
        ('lesson', 'Lesson'),
        ('break', 'Break'),
        ('lunch', 'Lunch'),
    )
    template = models.ForeignKey(TimetableTemplate, on_delete=models.CASCADE, related_name='periods')
    period_index = models.IntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='lesson')
    label = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["template", "period_index"]
        unique_together = ("template", "period_index")

    def clean(self):
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise DjangoValidationError({"end_time": "End time must be after start time"})

    def __str__(self):
        return f"{self.template.name} P{self.period_index} {self.start_time}-{self.end_time} ({self.kind})"


class TimetablePlan(models.Model):
    """Plan binds a template to a specific term and scope of classes; versions store generated entries."""
    school = models.ForeignKey('accounts.School', on_delete=models.CASCADE, related_name='timetable_plans')
    term = models.ForeignKey(Term, on_delete=models.CASCADE, related_name='timetable_plans')
    template = models.ForeignKey(TimetableTemplate, on_delete=models.PROTECT, related_name='plans')
    name = models.CharField(max_length=120)
    status = models.CharField(max_length=20, default='draft')  # draft|generated|published|archived
    notes = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    # Persist block assignments so teachers on other devices can see them.
    # Shape: { "<day>-<classId>-<periodIndex>": { "subjectId": <id> } }
    block_assignments = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("school", "term", "name")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} — {self.term}"


class TimetableClassConfig(models.Model):
    plan = models.ForeignKey(TimetablePlan, on_delete=models.CASCADE, related_name='class_configs')
    klass = models.ForeignKey(Class, on_delete=models.CASCADE)
    room_preference = models.ForeignKey(Room, null=True, blank=True, on_delete=models.SET_NULL)
    active_days_override = models.JSONField(null=True, blank=True)
    period_minutes_override = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ("plan", "klass")

    def __str__(self):
        return f"{self.plan.name} — {self.klass}"


class ClassSubjectQuota(models.Model):
    plan = models.ForeignKey(TimetablePlan, on_delete=models.CASCADE, related_name='subject_quotas')
    klass = models.ForeignKey(Class, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    weekly_periods = models.IntegerField()
    min_gap_periods = models.IntegerField(default=0)

    class Meta:
        unique_together = ("plan", "klass", "subject")

    def __str__(self):
        return f"{self.klass} {self.subject.code}: {self.weekly_periods}/wk"


class TeacherAvailability(models.Model):
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    day_of_week = models.IntegerField(choices=TimetableEntry.DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ["teacher", "day_of_week", "start_time"]

    def clean(self):
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise DjangoValidationError({"end_time": "End time must be after start time"})

    def __str__(self):
        return f"{getattr(self.teacher,'username', self.teacher_id)} D{self.day_of_week} {self.start_time}-{self.end_time} {'FREE' if self.is_available else 'BLOCK'}"


class TimetableVersion(models.Model):
    plan = models.ForeignKey(TimetablePlan, on_delete=models.CASCADE, related_name='versions')
    label = models.CharField(max_length=50)
    is_current = models.BooleanField(default=False)
    rationale = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("plan", "label")
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_current:
            TimetableVersion.objects.filter(plan=self.plan).exclude(pk=self.pk).update(is_current=False)

    def __str__(self):
        return f"{self.plan.name} — {self.label}{' (current)' if self.is_current else ''}"
