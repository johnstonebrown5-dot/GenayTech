import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

const centerTextPlugin = {
  id: 'centerText',
  afterDraw: (chart, _args, pluginOptions) => {
    try {
      const opts = pluginOptions || {}
      const meta = chart.getDatasetMeta(0)
      const first = meta?.data?.[0]
      if (!first) return

      const text = opts.text ?? ''
      const subtext = opts.subtext ?? ''
      if (!text && !subtext) return

      const { ctx } = chart
      const x = first.x
      const y = first.y

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const mainSize = Number(opts.fontSize || 22)
      const subSize = Number(opts.subFontSize || 11)

      ctx.fillStyle = opts.color || '#111827'
      ctx.font = `900 ${mainSize}px Inter, ui-sans-serif, system-ui`
      ctx.fillText(String(text), x, subtext ? y - 6 : y)

      if (subtext) {
        ctx.fillStyle = opts.subColor || '#6b7280'
        ctx.font = `800 ${subSize}px Inter, ui-sans-serif, system-ui`
        ctx.fillText(String(subtext), x, y + 16)
      }

      ctx.restore()
    } catch (e) {
      // no-op
    }
  },
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, centerTextPlugin)

function Card({ title, right, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-card ${className}`}>
      {(title || right) && (
        <div className="px-5 pt-5 pb-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-black text-gray-900">{title}</h3>}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

function StatMini({ icon, label, value, trend, trendColor = 'text-emerald-600', onClick }) {
  const hasTrend = typeof trend === 'number' && !Number.isNaN(trend)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-200 shadow-soft hover:shadow-card transition-shadow px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-lg">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-gray-500">{label}</div>
          <div className="mt-1 text-lg font-black text-gray-900 leading-tight">{value}</div>
          {hasTrend && (
            <div className={`mt-1 text-[10px] font-bold ${trendColor}`}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(Math.round(trend))}% this month
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function formatKES(n) {
  const v = Number(n || 0)
  return `KES ${v.toLocaleString()}`
}

function timeAgo(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [academicYears, setAcademicYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [recentStudents, setRecentStudents] = useState([])
  const [events, setEvents] = useState([])
  const [activity, setActivity] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const [summaryRes, yearsRes, studentsRes, eventsRes, teachersRes, paymentsRes, examsRes] = await Promise.allSettled([
          api.get('/reports/summary/'),
          api.get('/academics/academic_years/').catch(() => ({ data: [] })),
          api.get('/academics/students/', { params: { page_size: 5, ordering: '-id' }, _skipGlobalLoading: true }).catch(() => ({ data: [] })),
          api.get('/communications/events/', { _skipGlobalLoading: true }).catch(() => ({ data: [] })),
          api.get('/academics/teachers/', { params: { page_size: 5, ordering: '-id' }, _skipGlobalLoading: true }).catch(() => ({ data: [] })),
          api.get('/finance/incoming-payments/', { params: { page_size: 3, ordering: '-id' }, _skipGlobalLoading: true }).catch(() => ({ data: [] })),
          api.get('/academics/exams/', { params: { page_size: 3, ordering: '-id', include_history: true }, _skipGlobalLoading: true }).catch(() => ({ data: [] })),
        ])

        const summary = summaryRes.status === 'fulfilled' ? summaryRes.value?.data : null
        const years = yearsRes.status === 'fulfilled'
          ? (Array.isArray(yearsRes.value?.data) ? yearsRes.value.data : (yearsRes.value?.data?.results || []))
          : []
        const students = studentsRes.status === 'fulfilled'
          ? (Array.isArray(studentsRes.value?.data) ? studentsRes.value.data : (studentsRes.value?.data?.results || []))
          : []
        const baseEvents = eventsRes.status === 'fulfilled'
          ? (Array.isArray(eventsRes.value?.data) ? eventsRes.value.data : (eventsRes.value?.data?.results || []))
          : []
        const teachers = teachersRes.status === 'fulfilled'
          ? (Array.isArray(teachersRes.value?.data) ? teachersRes.value.data : (teachersRes.value?.data?.results || []))
          : []
        const payments = paymentsRes.status === 'fulfilled'
          ? (Array.isArray(paymentsRes.value?.data) ? paymentsRes.value.data : (paymentsRes.value?.data?.results || []))
          : []
        const exams = examsRes.status === 'fulfilled'
          ? (Array.isArray(examsRes.value?.data) ? examsRes.value.data : (examsRes.value?.data?.results || []))
          : []

        const examEvents = exams.map((x) => {
          const dateStr = x.date || x.exam_date || x.scheduled_date || new Date().toISOString().slice(0, 10)
          return {
            id: `exam-${x.id}`,
            title: `Mid Term Exam: ${x.name || 'Exam'}`,
            start: `${dateStr}T09:00:00`,
            end: `${dateStr}T11:00:00`,
            source: 'exam',
          }
        })

        const activityItems = []

        const newestPayment = (payments || [])
          .slice()
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
        if (newestPayment?.created_at) {
          activityItems.push({
            icon: '💳',
            title: 'Fee payment received',
            subtitle: `${newestPayment?.student?.name || 'Student'} • ${formatKES(newestPayment?.amount || 0)}`,
            when: timeAgo(newestPayment.created_at),
          })
        }

        const newestEvent = (baseEvents || [])
          .slice()
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
        if (newestEvent?.created_at) {
          activityItems.push({
            icon: '📅',
            title: 'Event scheduled',
            subtitle: newestEvent?.title || 'Event',
            when: timeAgo(newestEvent.created_at),
          })
        }

        const newestPublishedExam = (exams || [])
          .filter((x) => x?.published_at)
          .slice()
          .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))[0]
        if (newestPublishedExam?.published_at) {
          activityItems.push({
            icon: '📝',
            title: 'Exam published',
            subtitle: newestPublishedExam?.name || 'Exam',
            when: timeAgo(newestPublishedExam.published_at),
          })
        }

        const latestAttendance = Array.isArray(summary?.attendanceTrend) ? summary.attendanceTrend[summary.attendanceTrend.length - 1] : null
        if (latestAttendance?.date) {
          activityItems.push({
            icon: '✅',
            title: 'Attendance updated',
            subtitle: `Rate: ${Number(latestAttendance?.rate || 0)}%`,
            when: timeAgo(latestAttendance.date),
          })
        }

        if (!mounted) return
        setStats(summary || { error: true })
        setAcademicYears(years)
        setSelectedYearId((years && years[0] && String(years[0].id)) || '')
        setRecentStudents(students)
        setEvents([...baseEvents, ...examEvents])
        setActivity(activityItems)
      } catch (e) {
        if (!mounted) return
        setStats({ error: true })
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [])

  const yearLabel = useMemo(() => {
    const y = academicYears.find((x) => String(x.id) === String(selectedYearId))
    return y?.label || y?.name || '2024 - 2025'
  }, [academicYears, selectedYearId])

  const quickActions = useMemo(() => ([
    { label: 'Add Student', icon: '👤', onClick: () => navigate('/admin/students') },
    { label: 'Add Teacher', icon: '👩‍🏫', onClick: () => navigate('/admin/teachers') },
    { label: 'Add Class', icon: '🏫', onClick: () => navigate('/admin/classes') },
    { label: 'Send Notice', icon: '✉️', onClick: () => navigate('/admin/messages') },
    { label: 'Take Attendance', icon: '✅', onClick: () => navigate('/admin/reports') },
    { label: 'Generate Report', icon: '📄', onClick: () => navigate('/admin/reports') },
  ]), [navigate])

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return (Array.isArray(events) ? events : [])
      .map((e) => ({ ...e, startDate: new Date(e.start) }))
      .filter((e) => e.start && !Number.isNaN(e.startDate.getTime()) && e.startDate >= now)
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, 3)
  }, [events])

  const statConfig = useMemo(() => {
    const s = stats || {}
    const feesCollected = s?.fees?.collected ?? s?.feesCollected ?? 0
    const newAdmissions = s?.newAdmissions ?? s?.new_admissions ?? 0
    return [
      { icon: '🎓', label: 'Total Students', value: Number(s.students || 0).toLocaleString(), trend: s?.trends?.students, onClick: () => navigate('/admin/students') },
      { icon: '👩‍🏫', label: 'Teachers', value: Number(s.teachers || 0).toLocaleString(), trend: s?.trends?.teachers, onClick: () => navigate('/admin/teachers') },
      { icon: '🏫', label: 'Classes', value: Number(s.classes || 0).toLocaleString(), trend: s?.trends?.classes, onClick: () => navigate('/admin/classes') },
      { icon: '✅', label: 'Attendance', value: `${Number(s.attendanceRate || 0)}%`, trend: s?.trends?.attendance, onClick: () => navigate('/admin/reports') },
      { icon: '💰', label: 'Fees Collected', value: formatKES(feesCollected), trend: s?.trends?.feesCollected, onClick: () => navigate('/admin/fees') },
      { icon: '🧾', label: 'New Admissions', value: Number(newAdmissions || 0).toLocaleString(), trend: s?.trends?.newAdmissions, onClick: () => navigate('/admin/students') },
    ]
  }, [stats, navigate])

  const attendanceLine = useMemo(() => {
    const trend = Array.isArray(stats?.attendanceTrend) ? stats.attendanceTrend : null
    const labels = (trend && trend.length > 0)
      ? trend.map((t) => {
        const d = new Date(t.date)
        return Number.isNaN(d.getTime())
          ? String(t.date || '')
          : d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
      })
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const values = (trend && trend.length > 0)
      ? trend.map((t) => Math.round(Number(t.rate || 0)))
      : labels.map(() => 0)

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Attendance',
            data: values,
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79,70,229,0.12)',
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280' } },
          y: { min: 0, max: 100, grid: { color: '#eef2ff' }, ticks: { color: '#6b7280', callback: (v) => `${v}%` } },
        },
      },
    }
  }, [stats])

  const studentsByGrade = useMemo(() => {
    const raw = stats?.studentsByGrade || stats?.gradeCounts || null
    const labels = raw && typeof raw === 'object' ? Object.keys(raw) : []
    const data = raw && typeof raw === 'object' ? Object.values(raw).map((x) => Number(x || 0)) : []
    const total = data.reduce((a, b) => a + b, 0)
    const palette = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#22c55e', '#e11d48', '#0ea5e9', '#a855f7']
    return {
      total,
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: labels.map((_, idx) => palette[idx % palette.length]),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, color: '#374151', font: { size: 11, weight: '700' } } },
          centerText: { text: total || 0, subtext: 'Total' },
        },
      },
    }
  }, [stats])

  const teachersByDept = useMemo(() => {
    const raw = stats?.teachersByDepartment || null
    const labels = raw && typeof raw === 'object' ? Object.keys(raw) : ['Mathematics', 'Science', 'Languages', 'Humanities', 'Arts & Sports']
    const data = raw && typeof raw === 'object' ? Object.values(raw).map((x) => Number(x || 0)) : [8, 6, 4, 4, 2]
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Teachers',
            data,
            backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' } },
          y: { grid: { display: false }, ticks: { color: '#374151', font: { size: 11, weight: '700' } } },
        },
      },
    }
  }, [stats])

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!stats || stats.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        Failed to load dashboard data. Please refresh and try again.
      </div>
    )
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-elevated">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-black tracking-tight">Welcome back, Admin <span aria-hidden="true">👋</span></div>
            <div className="mt-1 text-sm text-white/85 font-medium">Here’s what’s happening at your school today.</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="h-10 rounded-xl bg-white/95 text-gray-900 border border-white/50 px-3 pr-8 text-sm font-semibold shadow-sm focus:outline-none"
              >
                {academicYears.length === 0 ? (
                  <option value="">{yearLabel}</option>
                ) : academicYears.map((y) => (
                  <option key={y.id} value={String(y.id)}>{y.label || y.name}</option>
                ))}
              </select>
            </div>
            {/* Decorative illustration */}
            <div className="hidden md:flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 border border-white/15">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-10 h-10 text-white/90">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2.5 7.5 12 12l9.5-4.5L12 3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 9.5v5c0 1.5 2.5 3.5 5.5 3.5s5.5-2 5.5-3.5v-5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.5 7.5v6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        {/* Left */}
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statConfig.map((s) => (
              <StatMini key={s.label} icon={s.icon} label={s.label} value={s.value} trend={s.trend} onClick={s.onClick} />
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card
              title="Attendance Overview"
              right={<button onClick={() => navigate('/admin/reports')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">This Year ▾</button>}
              className="lg:col-span-1"
            >
              <div className="h-56">
                <Line data={attendanceLine.data} options={attendanceLine.options} />
              </div>
            </Card>

            <Card
              title="Students by Grade"
              right={<button onClick={() => navigate('/admin/students')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">This Year ▾</button>}
              className="lg:col-span-1"
            >
              <div className="relative h-56">
                <Doughnut data={studentsByGrade.data} options={studentsByGrade.options} />
              </div>
            </Card>

            <Card
              title="Teachers by Department"
              right={<button onClick={() => navigate('/admin/teachers')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">This Year ▾</button>}
              className="lg:col-span-1"
            >
              <div className="h-56">
                <Bar data={teachersByDept.data} options={teachersByDept.options} />
              </div>
            </Card>
          </div>

          {/* Recent Students Table */}
          <Card
            title="Recent Students"
            right={
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/admin/students')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View All</button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b">
                    <th className="py-2 pr-4 text-left">Student</th>
                    <th className="py-2 pr-4 text-left">Grade</th>
                    <th className="py-2 pr-4 text-left">Class</th>
                    <th className="py-2 pr-4 text-left">Attendance</th>
                    <th className="py-2 pr-4 text-left">Fees Status</th>
                    <th className="py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(recentStudents || []).slice(0, 5).map((st) => {
                    const name = st.full_name || st.name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student'
                    const grade = st?.klass_detail?.grade_level || st.grade || st.grade_level || st.level || '-'
                    const klass = st?.klass_detail?.name || st.class_name || st.classroom || st.klass_name || '-'
                    const attendance = st.attendance_rate || st.attendanceRate
                    const fees = st.fees_status || st.feesStatus
                    const active = typeof st.is_active === 'boolean' ? st.is_active : true
                    return (
                      <tr key={st.id || name} className="text-gray-800">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black">
                              {String(name)[0]?.toUpperCase() || 'S'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 truncate">{name}</div>
                              <div className="text-xs text-gray-500 truncate">{st.student_code || st.admission_no || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">{grade}</td>
                        <td className="py-3 pr-4">{klass}</td>
                        <td className="py-3 pr-4">{attendance == null ? '—' : `${Number(attendance || 0)}%`}</td>
                        <td className="py-3 pr-4">
                          {fees ? (
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${
                              String(fees).toLowerCase() === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : String(fees).toLowerCase() === 'partial'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {fees}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${
                            active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {(!recentStudents || recentStudents.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">No students found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Card title="Quick Actions">
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 shadow-soft p-3 text-center"
                >
                  <div className="mx-auto w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-lg">{a.icon}</div>
                  <div className="mt-2 text-[11px] font-bold text-gray-700 leading-tight">{a.label}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card
            title="Recent Activity"
            right={<button onClick={() => navigate('/admin/reports')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View All</button>}
          >
            <div className="space-y-3">
              {(activity || []).slice(0, 5).map((a, idx) => (
                <div key={`${a.title}-${idx}`} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">{a.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-gray-900">{a.title}</div>
                    <div className="text-xs text-gray-500 truncate">{a.subtitle}</div>
                  </div>
                  <div className="text-xs text-gray-400 font-semibold whitespace-nowrap">{a.when}</div>
                </div>
              ))}
              {(activity || []).length === 0 && <div className="text-sm text-gray-500">No recent activity.</div>}
            </div>
          </Card>

          <Card
            title="Upcoming Events"
            right={<button onClick={() => navigate('/admin/events')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View Calendar</button>}
          >
            <div className="space-y-3">
              {upcomingEvents.map((e) => (
                <div key={e.id || e.title} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-3">
                  <div className="text-sm font-black text-gray-900 truncate">{e.title}</div>
                  <div className="mt-1 text-xs text-gray-600 font-semibold">
                    {new Date(e.start).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} •{' '}
                    {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {upcomingEvents.length === 0 && <div className="text-sm text-gray-500">No upcoming events.</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
