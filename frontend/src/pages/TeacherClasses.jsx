import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileText,
  Plus,
  Search,
} from 'lucide-react'
import api from '../api'

export default function TeacherClasses(){
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try{
        const res = await api.get('/academics/classes/mine/')
        if (!mounted) return
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
        const base = Array.from(new Map(list.map(c => [c.id, c])).values())
        const details = await Promise.all(base.map(async (c) => {
          try{
            const needsCount = c?.students_count == null && c?.student_count == null && c?.total_students == null && !Array.isArray(c?.students)
            const needsSubjects = !Array.isArray(c?.subjects) || c.subjects.length === 0
            if (!needsCount && !needsSubjects) return c
            const r = await api.get(`/academics/classes/${c.id}/`)
            return r?.data ? { ...c, ...r.data } : c
          }catch{
            return c
          }
        }))
        if (!mounted) return
        setClasses(details)
      }catch(e){
        if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load classes')
      }finally{
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const visibleClasses = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return classes
    return classes.filter(c => (
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.grade_level || '').toLowerCase().includes(q) ||
      String(c.stream_name || c?.stream_detail?.name || '').toLowerCase().includes(q)
    ))
  }, [classes, search])

  return (
    <div className="teacher-phone-screen teacher-classes-screen">
      <div className="teacher-phone-status" aria-hidden>
        <span>9:41</span>
        <span>▮▮▮  Wi-Fi  ▰</span>
      </div>

      <div className="teacher-screen-title">
        <h1>My Classes</h1>
        <button type="button" className="teacher-floating-plus" onClick={() => navigate('/teacher/manage-class?tab=add')} aria-label="Add student">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="teacher-pill-tabs">
        <button className="active" type="button">All Classes</button>
        <button type="button" onClick={() => navigate('/teacher/grades')}>Grades</button>
      </div>

      <label className="teacher-reference-search">
        <Search className="h-4 w-4" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classes..." />
      </label>

      {loading && <div className="teacher-reference-card">Loading classes...</div>}
      {error && <div className="teacher-reference-error">{error}</div>}

      <div className="teacher-class-cards">
        {!loading && visibleClasses.map((klass, index) => (
          <ClassCard key={klass.id} klass={klass} index={index} navigate={navigate} />
        ))}
        {!loading && visibleClasses.length === 0 && (
          <div className="teacher-reference-card">No classes found.</div>
        )}
      </div>
    </div>
  )
}

function ClassCard({ klass, index, navigate }){
  const tones = [
    { icon: 'green', progress: '#22c55e', percent: 85 },
    { icon: 'purple', progress: '#4d32d9', percent: 62 },
    { icon: 'orange', progress: '#f97316', percent: 74 },
  ]
  const tone = tones[index % tones.length]
  const students = Number(klass?.students_count ?? klass?.student_count ?? klass?.students?.length ?? klass?.total_students ?? 0) || 0
  const subjects = Array.isArray(klass?.subjects) ? klass.subjects : []
  const subject = subjects[0]?.name || subjects[0]?.code || 'Mathematics'

  return (
    <article
      className="teacher-class-card-exact cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/teacher/grades?class=${klass.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/teacher/grades?class=${klass.id}`)
      }}
    >
      <div className="teacher-class-card-head">
        <span className={`teacher-class-card-icon ${tone.icon}`}>
          <BookOpen className="h-5 w-5" />
        </span>
        <span className="teacher-class-card-title">
          <strong>{klass.name}</strong>
          <small>{students} Students</small>
        </span>
        <em>Active</em>
      </div>

      <div className="teacher-class-progress">
        <div>
          <span>{subject}</span>
          <b>{tone.percent}% Syllabus</b>
        </div>
        <i><u style={{ width: `${tone.percent}%`, background: tone.progress }} /></i>
      </div>

      <div className="teacher-card-action-grid">
        <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/teacher/attendance?class=${klass.id}`) }}>
          <CalendarCheck className="h-4 w-4" />
          <span>Attendance</span>
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/teacher/grades?class=${klass.id}`) }}>
          <ClipboardList className="h-4 w-4" />
          <span>Assignments</span>
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); navigate('/teacher/lessons') }}>
          <FileText className="h-4 w-4" />
          <span>Lesson Plans</span>
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/teacher/classes/${klass.id}/print-report-cards`) }}>
          <BarChart3 className="h-4 w-4" />
          <span>Reports</span>
        </button>
      </div>
    </article>
  )
}
