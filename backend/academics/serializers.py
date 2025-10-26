from rest_framework import serializers
from .models import (
    Class, Student, Competency, Assessment, Attendance, TeacherProfile, Subject, SubjectComponent,
    Exam, ExamResult, AcademicYear, Term, Stream, LessonPlan, ClassSubjectTeacher, SubjectGradingBand,
    Room, TimetableEntry,
    TimetableTemplate, PeriodSlotTemplate, TimetablePlan, TimetableClassConfig, ClassSubjectQuota,
    TeacherAvailability, TimetableVersion
)
from django.contrib.auth import get_user_model

User = get_user_model()

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id','code','name','category','is_priority','is_examinable','school']

class SubjectComponentSerializer(serializers.ModelSerializer):
    subject_detail = SubjectSerializer(source='subject', read_only=True)
    class Meta:
        model = SubjectComponent
        fields = ['id','subject','subject_detail','code','name','max_marks','weight','order']

class StreamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stream
        fields = ['id', 'name', 'school']
        extra_kwargs = {
            'school': {'read_only': True}
        }

class SubjectGradingBandSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectGradingBand
        fields = ['id','subject','grade','min','max','order']

class TeacherUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id','username','first_name','last_name','email','role']

class ClassSubjectTeacherSerializer(serializers.ModelSerializer):
    teacher_detail = TeacherUserSerializer(source='teacher', read_only=True)
    class Meta:
        model = ClassSubjectTeacher
        fields = ['id','klass','subject','teacher','teacher_detail','assigned_at']

class ClassSerializer(serializers.ModelSerializer):
    subjects = SubjectSerializer(many=True, read_only=True)
    subject_ids = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(), many=True, write_only=True, required=False, source='subjects')
    stream_detail = StreamSerializer(source='stream', read_only=True)
    subject_teachers = ClassSubjectTeacherSerializer(many=True, read_only=True)
    teacher_detail = TeacherUserSerializer(source='teacher', read_only=True)

    class Meta:
        model = Class
        fields = ['id', 'name', 'grade_level', 'stream', 'stream_detail', 'teacher', 'teacher_detail', 'school', 'subjects', 'subject_ids', 'subject_teachers']
        extra_kwargs = {
            'school': {'read_only': True},
            'name': {'read_only': True}
        }

# Lightweight class serializer for list views where only basic labels are needed
class ClassLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ['id', 'name', 'grade_level']

class StudentSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user', write_only=True, required=False, allow_null=True)
    # Include class details for better display on dashboards
    klass_detail = ClassSerializer(source='klass', read_only=True)
    photo_url = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = Student
        fields = [
            'id','admission_no','name','dob','gender','upi_number','guardian_id','guardian_name','guardian_passport_no','birth_certificate_no','klass','klass_detail','user','user_id',
            'passport_no','phone','email','address','photo','photo_url',
            'is_graduated','graduation_year','boarding_status','is_active'
        ]

    def get_photo_url(self, obj):
        request = self.context.get('request')
        if getattr(obj, 'photo', None):
            try:
                url = obj.photo.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            except Exception:
                return None

# Lightweight student list serializer for faster collections
class StudentListSerializer(serializers.ModelSerializer):
    klass_detail = ClassLiteSerializer(source='klass', read_only=True)
    photo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Student
        fields = [
            'id','admission_no','name','dob','gender','upi_number','guardian_id','guardian_name','guardian_passport_no','birth_certificate_no','klass','klass_detail','photo','photo_url',
            'is_graduated','graduation_year','boarding_status','is_active'
        ]

    def get_photo_url(self, obj):
        request = self.context.get('request')
        if getattr(obj, 'photo', None):
            try:
                url = obj.photo.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            except Exception:
                return None
        return None
        return None

class CompetencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Competency
        fields = ['id','code','title','description','level_scale']

class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = ['id','student','teacher','competency','level','comment','evidence','date']

class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ['id','student','date','status','recorded_by']

    


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id','name','school']
        extra_kwargs = {
            'school': {'read_only': True}
        }


class TimetableEntrySerializer(serializers.ModelSerializer):
    klass_detail = ClassSerializer(source='klass', read_only=True)
    subject_detail = SubjectSerializer(source='subject', read_only=True)
    teacher_detail = TeacherUserSerializer(source='teacher', read_only=True)
    room_detail = RoomSerializer(source='room', read_only=True)
    plan = serializers.PrimaryKeyRelatedField(queryset=TimetablePlan.objects.all(), required=False, allow_null=True)
    version = serializers.PrimaryKeyRelatedField(queryset=TimetableVersion.objects.all(), required=False, allow_null=True)

    class Meta:
        model = TimetableEntry
        fields = [
            'id','term','day_of_week','start_time','end_time', 'plan', 'version',
            'klass','klass_detail','subject','subject_detail','teacher','teacher_detail','room','room_detail',
            'notes','created_at','updated_at'
        ]


class PeriodSlotTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeriodSlotTemplate
        fields = ['id','template','period_index','start_time','end_time','kind','label']


class TimetableTemplateSerializer(serializers.ModelSerializer):
    periods = PeriodSlotTemplateSerializer(many=True, read_only=True)
    class Meta:
        model = TimetableTemplate
        fields = ['id','school','name','default_period_minutes','start_of_day','days_active','is_default','periods']
        extra_kwargs = { 'school': {'read_only': True} }


class TermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ['id','academic_year','number','name','start_date','end_date','is_current']


class AcademicYearSerializer(serializers.ModelSerializer):
    terms = TermSerializer(many=True, read_only=True)
    class Meta:
        model = AcademicYear
        fields = ['id','school','label','start_date','end_date','is_current','terms']
        extra_kwargs = {
            'school': {'read_only': True}
        }


class LessonPlanSerializer(serializers.ModelSerializer):
    term_detail = TermSerializer(source='term', read_only=True)
    class Meta:
        model = LessonPlan
        fields = ['id','teacher','klass','subject','term','term_detail','week','date','topic','objectives','activities','resources','assessment','created_at']


class TimetablePlanSerializer(serializers.ModelSerializer):
    template_detail = TimetableTemplateSerializer(source='template', read_only=True)
    term_detail = TermSerializer(source='term', read_only=True)
    class Meta:
        model = TimetablePlan
        fields = ['id','school','term','term_detail','template','template_detail','name','status','notes','created_by','created_at','updated_at','block_assignments']
        extra_kwargs = { 'school': {'read_only': True}, 'created_by': {'read_only': True} }


class TimetableClassConfigSerializer(serializers.ModelSerializer):
    klass_detail = ClassSerializer(source='klass', read_only=True)
    room_detail = RoomSerializer(source='room_preference', read_only=True)
    class Meta:
        model = TimetableClassConfig
        fields = ['id','plan','klass','klass_detail','room_preference','room_detail','active_days_override','period_minutes_override']


class ClassSubjectQuotaSerializer(serializers.ModelSerializer):
    subject_detail = SubjectSerializer(source='subject', read_only=True)
    klass_detail = ClassSerializer(source='klass', read_only=True)
    class Meta:
        model = ClassSubjectQuota
        fields = ['id','plan','klass','klass_detail','subject','subject_detail','weekly_periods','min_gap_periods']


class TeacherAvailabilitySerializer(serializers.ModelSerializer):
    teacher_detail = TeacherUserSerializer(source='teacher', read_only=True)
    class Meta:
        model = TeacherAvailability
        fields = ['id','teacher','teacher_detail','day_of_week','start_time','end_time','is_available']


class TimetableVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimetableVersion
        fields = ['id','plan','label','is_current','rationale','created_by','created_at']


class TeacherProfileSerializer(serializers.ModelSerializer):
    user = TeacherUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user', write_only=True)
    # Include class details so the frontend can show the actual class name (e.g., "Grade 6 C")
    klass_detail = ClassSerializer(source='klass', read_only=True)
    can_manage_timetable = serializers.BooleanField(required=False)
    class Meta:
        model = TeacherProfile
        fields = ['id','user','user_id','subjects','klass','klass_detail','can_manage_timetable','tsc_number']


class ExamSerializer(serializers.ModelSerializer):
    inferred_academic_year = serializers.SerializerMethodField(read_only=True)
    inferred_term = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = Exam
        fields = ['id','name','year','term','klass','date','total_marks','published','published_at','grade_level_tag','inferred_academic_year','inferred_term']

    def _infer_year_and_term(self, exam):
        school = getattr(getattr(exam.klass, 'school', None), 'id', None)
        if not school or not exam.date:
            return None, None
        ay = AcademicYear.objects.filter(school_id=school, start_date__lte=exam.date, end_date__gte=exam.date).first()
        if not ay:
            return None, None
        term = Term.objects.filter(academic_year=ay, start_date__lte=exam.date, end_date__gte=exam.date).first()
        return ay, term

    def get_inferred_academic_year(self, obj):
        ay, _ = self._infer_year_and_term(obj)
        if not ay:
            return None
        return { 'id': ay.id, 'label': ay.label, 'start_date': ay.start_date, 'end_date': ay.end_date }

    def get_inferred_term(self, obj):
        ay, term = self._infer_year_and_term(obj)
        if not (ay and term):
            return None
        return { 'id': term.id, 'number': term.number, 'name': term.name, 'start_date': term.start_date, 'end_date': term.end_date, 'academic_year': ay.id }


class ExamResultSerializer(serializers.ModelSerializer):
    component_detail = SubjectComponentSerializer(source='component', read_only=True)
    subject_detail = SubjectSerializer(source='subject', read_only=True)
    exam_detail = ExamSerializer(source='exam', read_only=True)
    # Optional: allows teacher to specify the total marks the entered score is out of.
    # Backend will scale the stored marks to the component/exam scale.
    out_of = serializers.FloatField(write_only=True, required=False, allow_null=True)
    percentage = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = ExamResult
        fields = ['id','exam','exam_detail','student','subject','subject_detail','component','component_detail','marks','out_of','percentage']

    def validate(self, attrs):
        # Block results for non-examinable subjects
        subject = attrs.get('subject') or getattr(self.instance, 'subject', None)
        # Block results for inactive students
        student = attrs.get('student') or getattr(self.instance, 'student', None)
        try:
            if student is not None:
                # Ensure current is_active value
                active = getattr(student, 'is_active', None)
                if active is None:
                    from .models import Student as _Student
                    active = bool(_Student.objects.filter(pk=student.pk).values_list('is_active', flat=True).first())
                if not active:
                    raise serializers.ValidationError({'student': 'Inactive students cannot have exam results recorded.'})
        except Exception:
            pass
        if subject is not None:
            try:
                # Ensure we have the latest value of is_examinable
                if hasattr(subject, 'is_examinable'):
                    examinable = bool(subject.is_examinable)
                else:
                    examinable = bool(Subject.objects.filter(pk=subject.pk).values_list('is_examinable', flat=True).first())
                if not examinable:
                    raise serializers.ValidationError({'subject': 'This subject is not examinable. Results cannot be recorded.'})
            except Exception:
                pass
        return super().validate(attrs)

    def get_percentage(self, obj):
        # Compute percentage based on component.max_marks, else exam.total_marks, else 100
        try:
            target_max = None
            component = getattr(obj, 'component', None)
            if component and getattr(component, 'max_marks', None) is not None:
                target_max = float(component.max_marks)
            elif getattr(obj, 'exam', None) and getattr(obj.exam, 'total_marks', None) is not None:
                target_max = float(obj.exam.total_marks)
            if not target_max:
                target_max = 100.0
            return round((float(obj.marks) / target_max) * 100.0, 2) if target_max else None
        except Exception:
            return None
