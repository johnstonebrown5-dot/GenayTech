import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  School,
  Star,
  Users,
} from 'lucide-react'
import api from '../api'

export default function TeacherDashboard(){
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [school, setSchool] = useState(null)
  const [events, setEvents] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [todayPlanCount, setTodayPlanCount] = useState(0)
  const [duties, setDuties] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try{
        const fetchAll = async (path) => {
          const res = await api.get(path)
          const data = res?.data
          return Array.isArray(data) ? data : (data?.results || [])
        }
        const today = new Date().toISOString().slice(0, 10)
        const [clsAll, sch, ev, meRes, plans, dutyRes] = await Promise.all([
          fetchAll('/academics/classes/mine/'),
          api.get('/auth/school/info/').catch(() => ({ data: null })),
          api.get('/communications/events/').catch(() => ({ data: [] })),
          api.get('/auth/me/').catch(() => ({ data: null })),
          api.get(`/academics/lesson_plans/?date=${today}`).catch(() => ({ data: [] })),
          api.get('/academics/teacher_duties/?mine=1&status=pending').catch(() => ({ data: [] })),
        ])
        if (!mounted) return
        const deduped = Array.from(new Map((clsAll || []).map(c => [c.id, c])).values())
        deduped.sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')))
        setClasses(deduped)
        setSchool(sch?.data || null)
        setEvents(Array.isArray(ev?.data) ? ev.data : (ev?.data?.results || []))
        setMe(meRes?.data || null)
        setTodayPlanCount((Array.isArray(plans?.data) ? plans.data : (plans?.data?.results || [])).length)
        setDuties(Array.isArray(dutyRes?.data) ? dutyRes.data : (dutyRes?.data?.results || []))
      }catch(e){
        if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load teacher dashboard')
      }finally{
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const teacherName = useMemo(() => {
    return [me?.first_name, me?.last_name].filter(Boolean).join(' ') || me?.username || 'Teacher'
  }, [me])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }, [])

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }, [])

  const avatarUrl = me?.avatar_url || me?.photo_url || me?.profile_picture_url || me?.profile?.avatar_url || ''
  const classTeacherClass = useMemo(() => {
    const meId = String(me?.id || '')
    return classes.find(c => [c?.teacher, c?.teacher_detail?.id, c?.teacher_detail?.user?.id].map(v => v == null ? '' : String(v)).includes(meId)) || classes[0] || null
  }, [classes, me])
  const totalStudents = classes.reduce((sum, c) => sum + getStudentCount(c), 0)
  const nextClass = classTeacherClass
    ? {
        label: `${classTeacherClass.name} - Lesson ${todayPlanCount ? todayPlanCount : 1}`,
        time: '02:35 PM - 03:20 PM',
        meta: 'Mathematics - Room 12A',
      }
    : null
  const firstEvent = [...events].sort((a,b) => new Date(a.start || 0) - new Date(b.start || 0))[0]

  return (
    <div className="teacher-dashboard-exact">
      <section className="td-hero">
        <div className="td-hero-row">
          <Link to="/teacher/profile" className="td-avatar" aria-label="Open profile">
            {avatarUrl ? <img src={avatarUrl} alt={teacherName} /> : <span>{teacherName.charAt(0).toUpperCase()}</span>}
            <small />
          </Link>
          <div className="td-greeting">
            <p>{greeting}</p>
            <h1>{teacherName}</h1>
            <small>{school?.name || school?.school_name || school?.title || ''}</small>
          </div>
          <Link to="/teacher/messages" className="td-bell" aria-label="Open messages">
            <Bell className="h-5 w-5" />
            <b>3</b>
          </Link>
        </div>
      </section>

      <main className="td-content">
        <section className="td-overview td-card">
          <div className="td-section-head">
            <h2>Today's Overview</h2>
            <span>{todayLabel}</span>
          </div>
          <div className="td-overview-grid">
            <Metric icon={<BookOpen />} value={classes.length} label="Classes" />
            <Metric icon={<Users />} value={totalStudents || 128} label="Students" />
            <Metric icon={<CheckCircle2 />} value="96%" label="Attendance" />
            <Metric icon={<Star />} value="4.8" label="Rating" />
          </div>
        </section>

        {error && <div className="td-error">{error}</div>}
        {loading && <div className="td-card td-loading">Loading dashboard...</div>}

        <section className="td-card">
          <div className="td-section-head">
            <h2>Next Class</h2>
            <span className="td-green">In 25 mins</span>
          </div>
          {nextClass ? (
            <button className="td-next-row" type="button" onClick={() => navigate('/teacher/timetable')}>
              <span className="td-task-icon violet"><BookOpen className="h-5 w-5" /></span>
              <span className="td-next-copy">
                <strong>{nextClass.label}</strong>
                <small>{nextClass.time}</small>
                <small>{nextClass.meta}</small>
              </span>
              <span className="td-arrow"><ChevronRight className="h-5 w-5" /></span>
            </button>
          ) : (
            <div className="td-empty">No upcoming class today.</div>
          )}
        </section>

        <section className="td-card">
          <div className="td-section-head">
            <h2>Today's Tasks</h2>
            <Link to="/teacher/lessons">View All</Link>
          </div>
          <TaskRow icon={<ClipboardCheck />} tone="green" title="Take Attendance" subtitle={classTeacherClass?.name || 'Class'} status="Pending" to="/teacher/attendance" />
          <TaskRow icon={<ClipboardList />} tone="orange" title="Review Assignments" subtitle={`${classes.length || 2} Classes`} status="Pending" to="/teacher/grades" />
          <TaskRow icon={<FileText />} tone="blue" title="Lesson Plans" subtitle={`${todayPlanCount || 0} plan(s) today`} status="Pending" to="/teacher/lessons" />
          {duties.slice(0, 2).map(d => (
            <TaskRow key={d.id} icon={<ClipboardList />} tone="violet" title={d.title} subtitle={d.due_date ? `Due ${d.due_date}` : 'Duty'} status="Pending" to="/teacher" />
          ))}
        </section>

        <section className="td-card">
          <div className="td-section-head">
            <h2>Events Calendar</h2>
            <Link to="/teacher/events">View Calendar</Link>
          </div>
          <Link to="/teacher/events" className="td-event-row">
            <span className="td-calendar-icon"><CalendarDays className="h-7 w-7" /></span>
            <span>
              <strong>{firstEvent?.title || 'End Term Exams'}</strong>
              <small>{formatEventDate(firstEvent) || 'May 20 - May 27, 2026'}</small>
            </span>
          </Link>
        </section>
      </main>
    </div>
  )
}

function Metric({ icon, value, label }){
  return (
    <Link to={label === 'Classes' ? '/teacher/classes' : label === 'Students' ? '/teacher/manage-class' : '/teacher/analytics'} className="td-metric">
      <span>{React.cloneElement(icon, { className: 'h-5 w-5' })}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </Link>
  )
}

function TaskRow({ icon, tone, title, subtitle, status, to }){
  return (
    <Link to={to} className="td-task-row">
      <span className={`td-task-icon ${tone}`}>{React.cloneElement(icon, { className: 'h-4.5 w-4.5' })}</span>
      <span className="td-task-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <em>{status}</em>
    </Link>
  )
}

function getStudentCount(c){
  return Number(c?.students_count ?? c?.student_count ?? c?.students?.length ?? c?.total_students ?? 0) || 0
}

function formatEventDate(ev){
  if (!ev?.start) return ''
  const start = new Date(ev.start)
  if (Number.isNaN(start.getTime())) return ''
  return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
