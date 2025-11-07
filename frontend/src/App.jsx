import React from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { NotificationProvider } from './components/NotificationContext'
import NotificationContainer from './components/NotificationContainer'
import MessageNotifier from './components/MessageNotifier'
import BrowserNotificationPrompt from './components/BrowserNotificationPrompt'
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
import FinanceIncomingPayments from './pages/FinanceIncomingPayments';
import FinanceStaffPayroll from './pages/FinanceStaffPayroll';
import FinanceCashbook from './pages/FinanceCashbook';
import FinanceFeeRegister from './pages/FinanceFeeRegister';
import AdminStaffPayroll from './pages/AdminStaffPayroll';
import AdminStudents from './pages/AdminStudents'
import AdminTeachers from './pages/AdminTeachers'
import AdminStaff from './pages/AdminStaff'
import AdminTeacherProfile from './pages/AdminTeacherProfile'
import AdminStudentDashboard from './pages/AdminStudentDashboard'
import AdminStudentInvoices from './pages/AdminStudentInvoices'
import AdminStudentPayments from './pages/AdminStudentPayments'
import AdminCurriculum from './pages/AdminCurriculum'
import AdminReports from './pages/AdminReports'
import AdminClasses from './pages/AdminClasses'
import AdminClassProfile from './pages/AdminClassProfile'
import AdminClassPrintReportCards from './pages/AdminClassPrintReportCards'
import AdminUsers from './pages/AdminUsers'
import AdminSchool from './pages/AdminSchool'
import AdminProfile from './pages/AdminProfile'
import AdminExams from './pages/AdminExams'
import AdminEnterResults from './pages/AdminEnterResults'
import AdminResults from './pages/AdminResults'
import AdminFees from './pages/AdminFees'
import AdminDuties from './pages/AdminDuties'
import AdminEvents from './pages/AdminEvents'
import AdminAcademicCalendar from './pages/AdminAcademicCalendar'
import AdminSubjects from './pages/AdminSubjects'
import AdminSubjectProfile from './pages/AdminSubjectProfile'
import AdminWebsite from './pages/AdminWebsite'
import ReportIssue from './pages/ReportIssue'
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
import ReportIssuePrompt from './components/ReportIssuePrompt'
import ServiceReviewPopup from './components/ServiceReviewPopup'
import LockProvider from './components/LockProvider'
import PublicReceipt from './pages/PublicReceipt'
import NotFound from './pages/NotFound'
import Unauthorized from './pages/Unauthorized'
import ReAuth from './pages/ReAuth'
import HelpCenter from './pages/HelpCenter'
import FloatingHelpAction from './components/Help/FloatingHelpAction'
import LockPage from './pages/LockPage'

function ProtectedRoute({ children, roles, ownerRole }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-8">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (!roles) return children
  // Treat superuser/staff as admin
  const isAdminAccess = roles.includes('admin') && (user?.is_superuser || user?.is_staff || user?.role === 'admin')
  const hasRole = roles.includes(user?.role)
  if (isAdminAccess || hasRole) {
    // If user is accessing a route owned by a different role (e.g., admin -> teacher), require re-auth
    if (ownerRole && user?.role !== ownerRole) {
      return <Navigate to="/reauth" state={{ redirectTo: location.pathname }} replace />
    }
    return children
  }
  // If user has no explicit role but is superuser, allow admin
  if ((user?.is_superuser || user?.is_staff) && roles.includes('admin')) return children
  return <Navigate to="/unauthorized" state={{ from: location.pathname }} replace />
}

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  return <Navigate to={`/${user.role}`} />
}

export default function App() {
  const { pathname } = useLocation()
  const hideAssistant = pathname === '/login' || pathname === '/' || pathname === '/report-issue'
  return (
    <NotificationProvider>
      <AssistantProvider>
        <AuthProvider>
          <LockProvider>
            <MessageNotifier />
            <Routes>
            {/* Public landing page */}
            <Route path="/" element={<SchoolHome />} />
            <Route path="/receipt/:id" element={<PublicReceipt />} />
            <Route path="/teachers" element={<PublicTeachers />} />
            <Route path="/teachers/:id" element={<PublicTeacherProfile />} />
            <Route path="/admissions" element={<PublicAdmissions />} />
            <Route path="/news/:id" element={<PublicNewsDetail />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/trial" element={<TrialOnboarding />} />
            <Route path="/help" element={<ProtectedRoute roles={["admin","teacher","student","finance"]}><HelpCenter/></ProtectedRoute>} />
            <Route path="/lock" element={<ProtectedRoute roles={["admin","teacher","student","finance"]}><LockPage/></ProtectedRoute>} />
            <Route path="/app" element={<RoleRedirect />} />
            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard/></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute roles={["admin"]}><AdminStudents/></ProtectedRoute>} />
            <Route path="/admin/students/:id" element={<ProtectedRoute roles={["admin"]}><AdminStudentDashboard/></ProtectedRoute>} />
            <Route path="/admin/students/:id/invoices" element={<ProtectedRoute roles={["admin"]}><AdminStudentInvoices/></ProtectedRoute>} />
            <Route path="/admin/students/:id/payments" element={<ProtectedRoute roles={["admin"]}><AdminStudentPayments/></ProtectedRoute>} />
            <Route path="/admin/students/:id/report-card" element={<ProtectedRoute roles={["admin"]}><AdminLayout><StudentReportCardViewer/></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/teachers" element={<ProtectedRoute roles={["admin"]}><AdminTeachers/></ProtectedRoute>} />
            <Route path="/admin/staff" element={<ProtectedRoute roles={["admin"]}><AdminStaff/></ProtectedRoute>} />
            <Route path="/admin/staff-payroll" element={<ProtectedRoute roles={["admin"]}><AdminStaffPayroll/></ProtectedRoute>} />
            <Route path="/admin/teachers/:id" element={<ProtectedRoute roles={["admin"]}><AdminTeacherProfile/></ProtectedRoute>} />
            <Route path="/admin/classes" element={<ProtectedRoute roles={["admin"]}><AdminClasses/></ProtectedRoute>} />
            <Route path="/admin/classes/:id" element={<ProtectedRoute roles={["admin"]}><AdminClassProfile/></ProtectedRoute>} />
            <Route path="/admin/classes/:id/print-report-cards" element={<ProtectedRoute roles={["admin"]}><AdminClassPrintReportCards/></ProtectedRoute>} />
            <Route path="/admin/fees" element={<ProtectedRoute roles={["admin"]}><AdminFees/></ProtectedRoute>} />
            <Route path="/admin/curriculum" element={<ProtectedRoute roles={["admin"]}><AdminCurriculum/></ProtectedRoute>} />
            <Route path="/admin/subjects" element={<ProtectedRoute roles={["admin"]}><AdminSubjects/></ProtectedRoute>} />
            <Route path="/admin/subjects/:id" element={<ProtectedRoute roles={["admin"]}><AdminSubjectProfile/></ProtectedRoute>} />
            <Route path="/admin/exams" element={<ProtectedRoute roles={["admin"]}><AdminExams/></ProtectedRoute>} />
            <Route path="/admin/exams/:id/enter" element={<ProtectedRoute roles={["admin"]}><AdminEnterResults/></ProtectedRoute>} />
            <Route path="/admin/results" element={<ProtectedRoute roles={["admin"]}><AdminResults/></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><AdminReports/></ProtectedRoute>} />
            <Route path="/admin/duties" element={<ProtectedRoute roles={["admin"]}><AdminDuties/></ProtectedRoute>} />
            <Route path="/admin/school" element={<ProtectedRoute roles={["admin"]}><AdminSchool/></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsers/></ProtectedRoute>} />
            <Route path="/admin/events" element={<ProtectedRoute roles={["admin"]}><AdminEvents/></ProtectedRoute>} />
            <Route path="/admin/calendar" element={<ProtectedRoute roles={["admin"]}><AdminAcademicCalendar/></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute roles={["admin"]}><AdminLayout><Messages/></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/report-issue" element={<ProtectedRoute roles={["admin"]}><AdminLayout><ReportIssue/></AdminLayout></ProtectedRoute>} />
            {/* Public report issue page */}
            <Route path="/report-issue" element={<ReportIssue/>} />
            <Route path="/admin/website" element={<ProtectedRoute roles={["admin"]}><AdminWebsite/></ProtectedRoute>} />
            <Route path="/admin/profile" element={<ProtectedRoute roles={["admin"]}><AdminProfile/></ProtectedRoute>} />
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
            <Route path="/finance" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceDashboard/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/messages" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><Messages/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/expenses" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceExpenses/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/incoming" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceIncomingPayments/></FinanceLayout></ProtectedRoute>} />
            {/* Invoices route removed */}
            <Route path="/finance/payments" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinancePayments/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/reports" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceReports/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/cashbook" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceCashbook/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/fee-register" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceFeeRegister/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/settings" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceSettings/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/pocket-money" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinancePocketMoney/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/pocket-money/wallet/:studentId" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceStudentWallet/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/fee-categories" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceFeeCategories/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/class-fees" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><FinanceClassFees/></FinanceLayout></ProtectedRoute>} />
            <Route path="/finance/fees" element={<ProtectedRoute roles={["finance"]}><FinanceFees/></ProtectedRoute>} />
            <Route path="/finance/staff-payroll" element={<ProtectedRoute roles={["finance"]}><FinanceStaffPayroll/></ProtectedRoute>} />
            <Route path="/unauthorized" element={<Unauthorized/>} />
            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound/>} />
            </Routes>
            <NotificationContainer />
            <BrowserNotificationPrompt />
            <ReportIssuePrompt />
            <ServiceReviewPopup />
            {!hideAssistant && <FloatingActions />}
            {!hideAssistant && <FloatingHelpAction />}
            {!hideAssistant && <FloatingButton />}
            <AssistantPanel />
          </LockProvider>
        </AuthProvider>
      </AssistantProvider>
    </NotificationProvider>
  )
}

