from rest_framework.routers import DefaultRouter
from .views import (
    ClassViewSet, StudentViewSet, CompetencyViewSet,
    AssessmentViewSet, AttendanceViewSet, TeacherProfileViewSet,
    import_students, import_competencies,
    ExamViewSet, ExamResultViewSet,
    AcademicYearViewSet, TermViewSet, StreamViewSet,
    LessonPlanViewSet, ClassSubjectTeacherViewSet, SubjectGradingBandViewSet,
    RoomViewSet, TimetableEntryViewSet, SubjectComponentViewSet, TeacherDutyViewSet,
    TimetableTemplateViewSet, PeriodSlotTemplateViewSet, TimetablePlanViewSet, TimetableClassConfigViewSet,
    ClassSubjectQuotaViewSet, TeacherAvailabilityViewSet, TimetableVersionViewSet
)
from .views import SubjectViewSet

router = DefaultRouter()
router.register('classes', ClassViewSet)
router.register('students', StudentViewSet)
router.register('competencies', CompetencyViewSet)
router.register('assessments', AssessmentViewSet)
router.register('attendance', AttendanceViewSet)
router.register('teachers', TeacherProfileViewSet)
router.register('teacher_duties', TeacherDutyViewSet)
router.register('subjects', SubjectViewSet)
router.register('subject_components', SubjectComponentViewSet)
router.register('lesson_plans', LessonPlanViewSet)
router.register('exams', ExamViewSet)
router.register('exam_results', ExamResultViewSet)
router.register('academic_years', AcademicYearViewSet)
router.register('terms', TermViewSet)
router.register('streams', StreamViewSet)
router.register('class_subject_teachers', ClassSubjectTeacherViewSet)
router.register('subject_grading', SubjectGradingBandViewSet)
router.register('rooms', RoomViewSet)
router.register('timetable_entries', TimetableEntryViewSet)
router.register('timetable/templates', TimetableTemplateViewSet)
router.register('timetable/periods', PeriodSlotTemplateViewSet)
router.register('timetable/plans', TimetablePlanViewSet)
router.register('timetable/class_configs', TimetableClassConfigViewSet)
router.register('timetable/quotas', ClassSubjectQuotaViewSet)
router.register('timetable/availability', TeacherAvailabilityViewSet)
router.register('timetable/versions', TimetableVersionViewSet)

from django.urls import path

urlpatterns = [
] + router.urls + [
    path('import/students/', import_students, name='import-students'),
    path('import/competencies/', import_competencies, name='import-competencies'),
]
