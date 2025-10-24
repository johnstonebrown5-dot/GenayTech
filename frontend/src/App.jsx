import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { NotificationProvider } from './components/NotificationContext'
import NotificationContainer from './components/NotificationContainer'
import MessageNotifier from './components/MessageNotifier'
import LoginPage from './pages/LoginPage'
import SchoolHome from './pages/SchoolHome'
import FeaturedPost from './pages/FeaturedPost'
import TrialOnboarding from './pages/TrialOnboarding'
import AdminDashboard from './pages/AdminDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherClasses from './pages/TeacherClasses'
import TeacherAttendance from './pages/TeacherAttendance'
import TeacherLessons from './pages/TeacherLessons'
import TeacherGrades from './pages/TeacherGrades'
import TeacherResults from './pages/TeacherResults'
import TeacherAnalytics from './pages/TeacherAnalytics'
import TeacherProfile from './pages/TeacherProfile'
import TeacherLayout from './components/TeacherLayout'
import StudentDashboard from './pages/StudentDashboard'
import StudentReportCard from './pages/StudentReportCard'
import StudentReportCardViewer from './pages/StudentReportCardViewer'
import StudentLayout from './components/StudentLayout'
import FinanceDashboard from './pages/FinanceDashboard';
import FinanceLayout from './components/FinanceLayout';
import FinanceExpenses from './pages/FinanceExpenses';
import FinancePayments from './pages/FinancePayments';
import FinanceReports from './pages/FinanceReports';
import FinanceSettings from './pages/FinanceSettings';
import FinancePocketMoney from './pages/FinancePocketMoney';
import FinanceStudentWallet from './pages/FinanceStudentWallet';
import FinanceFeeCategories from './pages/FinanceFeeCategories';
import FinanceClassFees from './pages/FinanceClassFees';
import FinanceFees from './pages/FinanceFees';
import AdminStudents from './pages/AdminStudents'
import AdminTeachers from './pages/AdminTeachers'
import AdminTeacherProfile from './pages/AdminTeacherProfile'
import AdminStudentDashboard from './pages/AdminStudentDashboard'
import AdminStudentInvoices from './pages/AdminStudentInvoices'
import AdminStudentPayments from './pages/AdminStudentPayments'
import AdminCurriculum from './pages/AdminCurriculum'
import AdminReports from './pages/AdminReports'
import AdminClasses from './pages/AdminClasses'
import AdminClassProfile from './pages/AdminClassProfile'
import AdminUsers from './pages/AdminUsers'
import AdminSchool from './pages/AdminSchool'
import AdminExams from './pages/AdminExams'
import AdminEnterResults from './pages/AdminEnterResults'
import AdminResults from './pages/AdminResults'
import AdminFees from './pages/AdminFees'
import AdminEvents from './pages/AdminEvents'
import AdminAcademicCalendar from './pages/AdminAcademicCalendar'
import AdminSubjects from './pages/AdminSubjects'
import AdminSubjectProfile from './pages/AdminSubjectProfile'
import AdminWebsite from './pages/AdminWebsite'
import PublicTeachers from './pages/PublicTeachers'
import PublicTeacherProfile from './pages/PublicTeacherProfile'
import PublicAdmissions from './pages/PublicAdmissions'
import PublicNewsDetail from './pages/PublicNewsDetail'
import Messages from './pages/Messages'
import AdminLayout from './components/AdminLayout'
import AdminTimetable from './pages/AdminTimetable'
import ClassTimetable from './pages/ClassTimetable'
import TeacherTimetableView from './pages/TeacherTimetableView'
import TeacherTimetable from './pages/TeacherTimetable'
import TeacherBlockTimetable from './pages/TeacherBlockTimetable'
import TeacherEvents from './pages/TeacherEvents'
import { AssistantProvider } from './components/Assistant/AssistantContext'
import FloatingButton from './components/Assistant/FloatingButton'
import AssistantPanel from './components/Assistant/AssistantPanel'
import FloatingActions from './components/FloatingActions'

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (!roles) return children
  // Treat superuser/staff as admin
  const isAdminAccess = roles.includes('admin') && (user?.is_superuser || user?.is_staff || user?.role === 'admin')
  const hasRole = roles.includes(user?.role)
  if (isAdminAccess || hasRole) return children
  // If user has no explicit role but is superuser, allow admin
  if ((user?.is_superuser || user?.is_staff) && roles.includes('admin')) return children
  return <Navigate to={`/${user?.role || 'login'}`} />
}

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  return <Navigate to={`/${user.role}`} />
}

export default function App() {
  return (
    <NotificationProvider>
      <AssistantProvider>
        <AuthProvider>
          <MessageNotifier />
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<SchoolHome />} />
            <Route path="/teachers" element={<PublicTeachers />} />
            <Route path="/teachers/:id" element={<PublicTeacherProfile />} />
            <Route path="/admissions" element={<PublicAdmissions />} />
            <Route path="/news/:id" element={<PublicNewsDetail />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/trial" element={<TrialOnboarding />} />
            <Route path="/app" element={<RoleRedirect />} />
            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard/></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute roles={["admin"]}><AdminStudents/></ProtectedRoute>} />
            <Route path="/admin/students/:id" element={<ProtectedRoute roles={["admin"]}><AdminStudentDashboard/></ProtectedRoute>} />
            <Route path="/admin/students/:id/invoices" element={<ProtectedRoute roles={["admin"]}><AdminStudentInvoices/></ProtectedRoute>} />
            <Route path="/admin/students/:id/payments" element={<ProtectedRoute roles={["admin"]}><AdminStudentPayments/></ProtectedRoute>} />
            <Route path="/admin/students/:id/report-card" element={<ProtectedRoute roles={["admin"]}><StudentReportCardViewer/></ProtectedRoute>} />
            <Route path="/admin/teachers" element={<ProtectedRoute roles={["admin"]}><AdminTeachers/></ProtectedRoute>} />
            <Route path="/admin/teachers/:id" element={<ProtectedRoute roles={["admin"]}><AdminTeacherProfile/></ProtectedRoute>} />
            <Route path="/admin/classes" element={<ProtectedRoute roles={["admin"]}><AdminClasses/></ProtectedRoute>} />
            <Route path="/admin/classes/:id" element={<ProtectedRoute roles={["admin"]}><AdminClassProfile/></ProtectedRoute>} />
            <Route path="/admin/fees" element={<ProtectedRoute roles={["admin"]}><AdminFees/></ProtectedRoute>} />
            <Route path="/admin/curriculum" element={<ProtectedRoute roles={["admin"]}><AdminCurriculum/></ProtectedRoute>} />
            <Route path="/admin/subjects" element={<ProtectedRoute roles={["admin"]}><AdminSubjects/></ProtectedRoute>} />
            <Route path="/admin/subjects/:id" element={<ProtectedRoute roles={["admin"]}><AdminSubjectProfile/></ProtectedRoute>} />
            <Route path="/admin/exams" element={<ProtectedRoute roles={["admin"]}><AdminExams/></ProtectedRoute>} />
            <Route path="/admin/exams/:id/enter" element={<ProtectedRoute roles={["admin"]}><AdminEnterResults/></ProtectedRoute>} />
            <Route path="/admin/results" element={<ProtectedRoute roles={["admin"]}><AdminResults/></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><AdminReports/></ProtectedRoute>} />
            <Route path="/admin/school" element={<ProtectedRoute roles={["admin"]}><AdminSchool/></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsers/></ProtectedRoute>} />
            <Route path="/admin/events" element={<ProtectedRoute roles={["admin"]}><AdminEvents/></ProtectedRoute>} />
            <Route path="/admin/calendar" element={<ProtectedRoute roles={["admin"]}><AdminAcademicCalendar/></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute roles={["admin"]}><AdminLayout><Messages/></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/website" element={<ProtectedRoute roles={["admin"]}><AdminLayout><AdminWebsite/></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/timetable" element={<ProtectedRoute roles={["admin"]}><AdminTimetable/></ProtectedRoute>} />
            <Route path="/admin/timetable/class" element={<ProtectedRoute roles={["admin","teacher"]}><ClassTimetable/></ProtectedRoute>} />
            <Route path="/admin/timetable/teacher" element={<ProtectedRoute roles={["admin"]}><TeacherTimetableView/></ProtectedRoute>} />
            <Route path="/featured/:slug" element={<FeaturedPost/>} />
            <Route path="/teacher" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherDashboard/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/messages" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><Messages/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/classes" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherClasses/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/attendance" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherAttendance/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/lessons" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherLessons/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/grades" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherGrades/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/results" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherResults/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/analytics" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherAnalytics/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/profile" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherProfile/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/timetable" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherTimetable/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/block-timetable" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherBlockTimetable/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/events" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><TeacherEvents/></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/students/:id/report-card" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><StudentReportCardViewer/></TeacherLayout></ProtectedRoute>} />
            <Route path="/student" element={<ProtectedRoute roles={["student","admin"]}><StudentLayout><StudentDashboard/></StudentLayout></ProtectedRoute>} />
            <Route path="/student/messages" element={<ProtectedRoute roles={["student","admin"]}><StudentLayout><Messages/></StudentLayout></ProtectedRoute>} />
            <Route path="/student/academics" element={<ProtectedRoute roles={["student","admin"]}><StudentLayout><StudentDashboard/></StudentLayout></ProtectedRoute>} />
            <Route path="/student/report-card" element={<ProtectedRoute roles={["student","admin"]}><StudentLayout><StudentReportCard/></StudentLayout></ProtectedRoute>} />
            <Route path="/student/finance" element={<ProtectedRoute roles={["student","admin"]}><StudentLayout><StudentDashboard/></StudentLayout></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinanceDashboard/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/messages" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><Messages/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/expenses" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinanceExpenses/></FinanceLayout></ProtectedRoute>} />
            {/* Invoices route removed */}
            <Route path="/finance/payments" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinancePayments/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/reports" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinanceReports/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/settings" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinanceSettings/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/pocket-money" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinancePocketMoney/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/pocket-money/wallet/:studentId" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinanceStudentWallet/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/fee-categories" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinanceFeeCategories/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/class-fees" element={<ProtectedRoute roles={["finance","admin"]}><FinanceLayout><FinanceClassFees/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/fees" element={<ProtectedRoute roles={["finance","admin"]}><FinanceFees/></ProtectedRoute>} />
          </Routes>
          <NotificationContainer />
          <FloatingActions />
          <FloatingButton />
          <AssistantPanel />
        </AuthProvider>
      </AssistantProvider>
    </NotificationProvider>
  )
}
