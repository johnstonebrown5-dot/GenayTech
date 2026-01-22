import React from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom'
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
import TeacherPreviewResults from './pages/TeacherPreviewResults'
import TeacherAnalytics from './pages/TeacherAnalytics'
import TeacherProfile from './pages/TeacherProfile'
import TeacherManageClass from './pages/TeacherManageClass'
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
import FinanceStaffPayrollDetail from './pages/FinanceStaffPayrollDetail';
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
import TopProgress from './components/TopProgress'
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
import LockProvider from './components/LockProvider'
import PublicReceipt from './pages/PublicReceipt'
import NotFound from './pages/NotFound'
import Unauthorized from './pages/Unauthorized'
import ReAuth from './pages/ReAuth'
import HelpCenter from './pages/HelpCenter'
import FloatingHelpAction from './components/Help/FloatingHelpAction'
import LockPage from './pages/LockPage'
import MaintenancePage from './components/MaintenancePage'
import { maintenanceEnabled, maintenanceMessage, helpCenterPath } from './featureFlags'

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
  const nav = useNavigate()
  const [blockLandscape, setBlockLandscape] = React.useState(false)
  const hideAssistant = pathname === '/login' || pathname === '/' || pathname === '/report-issue'
  const isPublicLanding = pathname === '/'
  const prevPathRef = React.useRef(pathname)
  React.useEffect(() => {
    if (prevPathRef.current !== pathname) {
      try { window.dispatchEvent(new Event('route:transition:start')) } catch {}
      prevPathRef.current = pathname
    }
  }, [pathname])
  React.useEffect(() => {
    const evaluateOrientation = () => {
      try {
        const allowLandscape = typeof window !== 'undefined' && window.localStorage.getItem('eduTrackAllowLandscape') === '1'
        if (allowLandscape) {
          setBlockLandscape(false)
          return
        }
        if (typeof window === 'undefined') return
        const isSmallScreen = window.matchMedia && window.matchMedia('(max-width: 900px)').matches
        const isLandscape = window.innerWidth > window.innerHeight
        setBlockLandscape(isSmallScreen && isLandscape)
      } catch {}
    }

    evaluateOrientation()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', evaluateOrientation)
      window.addEventListener('orientationchange', evaluateOrientation)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', evaluateOrientation)
        window.removeEventListener('orientationchange', evaluateOrientation)
      }
    }
  }, [])
  React.useEffect(() => {
    try {
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone)
      if (!isStandalone) return
      if (pathname === '/' || pathname.startsWith('/teachers') || pathname.startsWith('/admissions') || pathname.startsWith('/featured') || pathname.startsWith('/news')) {
        if (pathname !== '/login') {
          nav('/login', { replace: true })
        }
      }
    } catch {}
  }, [pathname, nav])

  if (maintenanceEnabled) {
    return <MaintenancePage message={maintenanceMessage} helpPath={helpCenterPath} />
  }
  return (
    <NotificationProvider>
      <AssistantProvider>
        <AuthProvider>
          <LockProvider timeoutMs={5 * 60 * 1000}>
            <TopProgress />
            <MessageNotifier />
            {blockLandscape && (
              <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/95 text-white px-8 text-center">
                <h2 className="text-lg font-semibold tracking-wide mb-2">Rotate device to portrait</h2>
                <p className="text-sm text-slate-200 max-w-xs mb-6">EduTrack is best used in portrait mode on phones. Turn your device upright to continue, or allow landscape once below.</p>
                <button
                  type="button"
                  onClick={() => {
                    try { window.localStorage.setItem('eduTrackAllowLandscape', '1') } catch {}
                    setBlockLandscape(false)
                  }}
                  className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold shadow-md"
                >
                  Allow landscape on this device
                </button>
              </div>
            )}
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
            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminLayout><Outlet/></AdminLayout></ProtectedRoute>}>
              <Route index element={<AdminDashboard/>} />
              <Route path="students" element={<AdminStudents/>} />
              <Route path="students/:id" element={<AdminStudentDashboard/>} />
              <Route path="students/:id/invoices" element={<AdminStudentInvoices/>} />
              <Route path="students/:id/payments" element={<AdminStudentPayments/>} />
              <Route path="students/:id/report-card" element={<StudentReportCardViewer/>} />
              <Route path="teachers" element={<AdminTeachers/>} />
              <Route path="teachers/:id" element={<AdminTeacherProfile/>} />
              <Route path="staff" element={<AdminStaff/>} />
              <Route path="staff-payroll" element={<AdminStaffPayroll/>} />
              <Route path="staff-payroll/:id" element={<FinanceStaffPayrollDetail/>} />
              <Route path="classes" element={<AdminClasses/>} />
              <Route path="classes/:id" element={<AdminClassProfile/>} />
              <Route path="classes/:id/print-report-cards" element={<AdminClassPrintReportCards/>} />
              <Route path="fees" element={<AdminFees/>} />
              <Route path="subjects" element={<AdminSubjects/>} />
              <Route path="subjects/:id" element={<AdminSubjectProfile/>} />
              <Route path="exams" element={<AdminExams/>} />
              <Route path="exams/:id/enter" element={<AdminEnterResults/>} />
              <Route path="results" element={<AdminResults/>} />
              <Route path="reports" element={<AdminReports/>} />
              <Route path="duties" element={<AdminDuties/>} />
              <Route path="school" element={<AdminSchool/>} />
              <Route path="users" element={<AdminUsers/>} />
              <Route path="events" element={<AdminEvents/>} />
              <Route path="calendar" element={<AdminAcademicCalendar/>} />
              <Route path="messages" element={<Messages/>} />
              <Route path="report-issue" element={<ReportIssue/>} />
              <Route path="website" element={<AdminWebsite/>} />
              <Route path="profile" element={<AdminProfile/>} />
              <Route path="timetable" element={<AdminTimetable/>} />
              <Route path="timetable/class" element={<ClassTimetable/>} />
              <Route path="timetable/teacher" element={<TeacherTimetableView/>} />
            </Route>
            <Route path="/featured/:slug" element={<FeaturedPost/>} />
            <Route path="/teacher" element={<ProtectedRoute roles={["teacher","admin"]}><TeacherLayout><Outlet/></TeacherLayout></ProtectedRoute>}>
              <Route index element={<TeacherDashboard/>} />
              <Route path="messages" element={<Messages/>} />
              <Route path="classes" element={<TeacherClasses/>} />
              <Route path="attendance" element={<TeacherAttendance/>} />
              <Route path="lessons" element={<TeacherLessons/>} />
              <Route path="grades" element={<TeacherGrades/>} />
              <Route path="preview-results" element={<TeacherPreviewResults/>} />
              <Route path="admin/enter/:id" element={<AdminEnterResults readOnly={true} />} />
              <Route path="results" element={<TeacherResults/>} />
              <Route path="analytics" element={<TeacherAnalytics/>} />
              <Route path="profile" element={<TeacherProfile/>} />
              <Route path="manage-class" element={<TeacherManageClass/>} />
              <Route path="students/:id" element={<AdminStudentDashboard/>} />
              <Route path="timetable" element={<TeacherTimetable/>} />
              <Route path="block-timetable" element={<TeacherBlockTimetable/>} />
              <Route path="events" element={<TeacherEvents/>} />
              <Route path="students/:id/report-card" element={<StudentReportCardViewer/>} />
            </Route>
            <Route path="/student" element={<ProtectedRoute roles={["student","admin"]}><StudentLayout><Outlet/></StudentLayout></ProtectedRoute>}>
              <Route index element={<StudentDashboard/>} />
              <Route path="messages" element={<Messages/>} />
              <Route path="academics" element={<StudentDashboard/>} />
              <Route path="report-card" element={<StudentReportCard/>} />
              <Route path="finance" element={<StudentDashboard/>} />
            </Route>
            <Route path="/finance" element={<ProtectedRoute roles={["finance"]}><FinanceLayout><Outlet/></FinanceLayout></ProtectedRoute>}>
              <Route index element={<FinanceDashboard/>} />
              <Route path="messages" element={<Messages/>} />
              <Route path="expenses" element={<FinanceExpenses/>} />
              <Route path="incoming" element={<FinanceIncomingPayments/>} />
              <Route path="payments" element={<FinancePayments/>} />
              <Route path="reports" element={<FinanceReports/>} />
              <Route path="cashbook" element={<FinanceCashbook/>} />
              <Route path="fee-register" element={<FinanceFeeRegister/>} />
              <Route path="settings" element={<FinanceSettings/>} />
              <Route path="pocket-money" element={<FinancePocketMoney/>} />
              <Route path="pocket-money/wallet/:studentId" element={<FinanceStudentWallet/>} />
              <Route path="fee-categories" element={<FinanceFeeCategories/>} />
              <Route path="class-fees" element={<FinanceClassFees/>} />
              <Route path="fees" element={<FinanceFees/>} />
              <Route path="staff-payroll" element={<FinanceStaffPayroll/>} />
              <Route path="staff-payroll/:id" element={<FinanceStaffPayrollDetail/>} />
            </Route>
            <Route path="/unauthorized" element={<Unauthorized/>} />
            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound/>} />
            </Routes>
            <NotificationContainer />
            {!isPublicLanding && <BrowserNotificationPrompt />}
            {!isPublicLanding && <ReportIssuePrompt />}
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
