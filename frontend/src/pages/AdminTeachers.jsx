import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'
import { Link } from 'react-router-dom'
import { 
  Users, 
  UserCheck, 
  BookOpen, 
  Plus, 
  UserPlus, 
  ClipboardCheck, 
  Filter, 
  Search, 
  ChevronDown, 
  X, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  LayoutGrid,
  MoreVertical,
  ArrowRight
} from 'lucide-react'
import { toast } from 'react-hot-toast'

// Simple in-memory cache so revisiting this page in the same session can
// reuse previously loaded data without refetching immediately.
let cachedTeachers = null
let cachedClasses = null
let cachedSubjects = null
let cachedUsers = null
let teachersCacheTimestamp = 0
const TEACHERS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export default function AdminTeachers(){
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [users, setUsers] = useState([])
  const [pastTeachers, setPastTeachers] = useState([])
  const [form, setForm] = useState({ user_id:'', subjects:'', klass:'' })
  const [newTeacher, setNewTeacher] = useState({ username:'', password:'', first_name:'', last_name:'', email:'' })
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showRelease, setShowRelease] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState(null)
  const [releasing, setReleasing] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterSubject, setFilterSubject] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterAssigned, setFilterAssigned] = useState('all')
  const [statIndex, setStatIndex] = useState(0)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [page, setPage] = useState(1)

  const { showSuccess, showError } = useNotification()

  const load = async () => {
    try {
      setLoading(true)
      const [t, cl, u, s] = await Promise.all([
        api.get('/academics/teachers/'),
        api.get('/academics/classes/'),
        api.get('/auth/users/?role=teacher'),
        api.get('/academics/subjects/')
      ])
      const tArr = Array.isArray(t.data) ? t.data : (Array.isArray(t.data?.results) ? t.data.results : [])
      const clArr = Array.isArray(cl.data) ? cl.data : (Array.isArray(cl.data?.results) ? cl.data.results : [])
      const uArr = Array.isArray(u.data) ? u.data : (Array.isArray(u.data?.results) ? u.data.results : [])
      const sArr = Array.isArray(s.data) ? s.data : (Array.isArray(s.data?.results) ? s.data.results : [])
      const activeTeachers = tArr.filter(t => t?.user?.is_active !== false)
      const archivedTeachers = tArr.filter(t => t?.user?.is_active === false)
      setTeachers(activeTeachers)
      setPastTeachers(archivedTeachers)
      setClasses(clArr)
      const activeUsers = uArr.filter(u => u?.is_active !== false)
      setUsers(activeUsers)
      setSubjects(sArr)
      // Update cache
      cachedTeachers = activeTeachers
      cachedClasses = clArr
      cachedSubjects = sArr
      cachedUsers = activeUsers
      teachersCacheTimestamp = Date.now()
    } catch (e) {
      showError('Failed to Load Teachers', 'There was a problem loading teachers data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=>{ 
    // Try hydrate from cache first
    const now = Date.now()
    if (
      cachedTeachers &&
      cachedClasses &&
      cachedSubjects &&
      cachedUsers &&
      now - teachersCacheTimestamp < TEACHERS_CACHE_TTL_MS
    ){
      setTeachers(cachedTeachers)
      setPastTeachers(Array.isArray(pastTeachers) ? pastTeachers : [])
      setClasses(cachedClasses)
      setUsers(cachedUsers)
      setSubjects(cachedSubjects)
      setLoading(false)
    } else {
      load()
    }
  },[])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(max-width: 640px)')
    const onChange = (e) => setIsCompact(!!(e && e.matches))
    setIsCompact(mql.matches)
    try { mql.addEventListener('change', onChange) } catch { try { mql.addListener(onChange) } catch {} }
    return () => { try { mql.removeEventListener('change', onChange) } catch { try { mql.removeListener(onChange) } catch {} } }
  }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      setAssigning(true)
      await api.post('/academics/teachers/', { ...form, klass: form.klass || null })
      setForm({ user_id:'', subjects:'', klass:'' })
      load()
      showSuccess('Teacher Assigned', 'Teacher has been successfully assigned to subjects and class.')
    } catch (err) {
      showError('Failed to Assign Teacher', 'There was an error assigning the teacher. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  const createTeacherUser = async (e) => {
    e.preventDefault()
    try {
      setCreating(true)
      const { data } = await api.post('/auth/users/create/', { ...newTeacher, role: 'teacher' })
      // refresh user list and preselect the newly created user
      const res = await api.get('/auth/users/?role=teacher')
      const uArr = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.results) ? res.data.results : [])
      setUsers(uArr)
      setForm(f => ({ ...f, user_id: data.id }))
      setNewTeacher({ username:'', password:'', first_name:'', last_name:'', email:'' })
      showSuccess('Teacher User Created', `Teacher user account for ${data.first_name} ${data.last_name} has been created successfully.`)
      setShowCreateUser(false)
      setShowAssign(true)
    } catch (err) {
      showError('Failed to Create Teacher User', 'There was an error creating the teacher user account. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const directory = useMemo(() => {
    const list = Array.isArray(teachers) ? teachers : []
    const byUserId = new Set(list.map(t => t?.user?.id))
    const missing = (Array.isArray(users) ? users : []).filter(u => !byUserId.has(u.id)).map(u => ({ id: null, user: u, subjects: '', klass_detail: null }))
    return [...list, ...missing]
  }, [teachers, users])

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = directory
    return base.filter(t => {
      const u = t.user || {}
      const name = `${u.username || ''} ${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
      const subjStr = (t.subjects || '').toLowerCase()
      const klassName = `${t.klass_detail?.name || ''}`.toLowerCase()
      const matchesSearch = !q || name.includes(q) || subjStr.includes(q) || klassName.includes(q)

      if (!matchesSearch) return false

      // Department filter (based on Subject.category)
      if (filterSubject) {
        const dept = String(filterSubject || '').trim().toLowerCase()
        const deptSet = new Set(
          (subjects || [])
            .filter(s => {
              const nm = String(s?.name || '').toLowerCase()
              const cd = String(s?.code || '').toLowerCase()
              return (nm && subjStr.includes(nm)) || (cd && subjStr.includes(cd))
            })
            .map(s => String(s?.category || '').trim().toLowerCase())
            .filter(Boolean)
        )
        if (!deptSet.has(dept)) return false
      }

      // Class filter
      if (filterClass) {
        const klassId = String(t.klass_detail?.id || '')
        if (klassId !== String(filterClass)) return false
      }

      // Assigned filter
      if (filterAssigned === 'assigned' && !t.klass_detail?.id) return false
      if (filterAssigned === 'unassigned' && !!t.klass_detail?.id) return false

      return true
    })
  }, [directory, search, filterSubject, filterClass, filterAssigned, subjects])

  const filteredPastTeachers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = Array.isArray(pastTeachers) ? pastTeachers : []
    return base.filter(t => {
      const u = t.user || {}
      const name = `${u.username || ''} ${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
      const subjStr = (t.subjects || '').toLowerCase()
      const klassName = `${t.klass_detail?.name || ''}`.toLowerCase()
      const matchesSearch = !q || name.includes(q) || subjStr.includes(q) || klassName.includes(q)

      if (!matchesSearch) return false

      if (filterSubject) {
        const dept = String(filterSubject || '').trim().toLowerCase()
        const deptSet = new Set(
          (subjects || [])
            .filter(s => {
              const nm = String(s?.name || '').toLowerCase()
              const cd = String(s?.code || '').toLowerCase()
              return (nm && subjStr.includes(nm)) || (cd && subjStr.includes(cd))
            })
            .map(s => String(s?.category || '').trim().toLowerCase())
            .filter(Boolean)
        )
        if (!deptSet.has(dept)) return false
      }

      if (filterClass) {
        const klassId = String(t.klass_detail?.id || '')
        if (klassId !== String(filterClass)) return false
      }

      return true
    })
  }, [pastTeachers, search, filterSubject, filterClass, subjects])

  const activeTeachersCount = Array.isArray(teachers) ? teachers.length : 0
  const assignedTeachersCount = useMemo(() => (
    Array.isArray(teachers) ? teachers.filter(t => t.klass_detail?.id).length : 0
  ), [teachers])
  const coveredSubjectsCount = useMemo(() => {
    const set = new Set()
    ;(Array.isArray(teachers) ? teachers : []).forEach(t => {
      ;(t.subjects || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(s => set.add(s.toLowerCase()))
    })
    return set.size
  }, [teachers])

  const departmentOptions = useMemo(() => {
    const list = Array.isArray(subjects) ? subjects : []
    return Array.from(
      new Set(list.map(s => String(s?.category || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))
  }, [subjects])

  const departmentsCount = departmentOptions.length

  const averageExperienceYears = useMemo(() => {
    // Optional backend field support (if later added). Fallback: 0.
    const list = Array.isArray(teachers) ? teachers : []
    const values = list
      .map(t => Number(t?.years_experience))
      .filter(v => Number.isFinite(v) && v >= 0)
    if (values.length === 0) return 0
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    return Math.round(avg * 10) / 10
  }, [teachers])

  const statItems = useMemo(() => ([
    { title: 'Active Teachers', value: loading ? 0 : activeTeachersCount, icon: '👩‍🏫', accent: 'from-brand-500 to-brand-600' },
    { title: 'Assigned Teachers', value: loading ? 0 : assignedTeachersCount, icon: '🏫', accent: 'from-emerald-500 to-emerald-600' },
    { title: 'Subjects Covered', value: loading ? 0 : coveredSubjectsCount, icon: '📚', accent: 'from-fuchsia-500 to-fuchsia-600' },
  ]), [loading, activeTeachersCount, assignedTeachersCount, coveredSubjectsCount])

  useEffect(() => {
    if (!isCompact) return
    const id = setInterval(() => {
      setStatIndex((i) => (i + 1) % (statItems.length || 1))
    }, 3000)
    return () => clearInterval(id)
  }, [isCompact, statItems.length])

  // Quick assign subjects modal
  const [showQuickAssign, setShowQuickAssign] = useState(false)
  const [qaTeacher, setQaTeacher] = useState({ teacherId:'', userId:'', name:'' })
  const [qaSelected, setQaSelected] = useState([])
  const [qaSaving, setQaSaving] = useState(false)
  const [qaSearch, setQaSearch] = useState('')

  const openQuickAssign = (t) => {
    const teacherId = t.id ? String(t.id) : ''
    const userId = t.user?.id ? String(t.user.id) : ''
    const name = `${t.user?.first_name||''} ${t.user?.last_name||''}`.trim() || (t.user?.username||'')
    // Preselect based on existing subjects string
    const subjStr = (t.subjects || '').toLowerCase()
    const pre = (subjects||[])
      .filter(s => subjStr.includes((s.name||'').toLowerCase()) || subjStr.includes((s.code||'').toLowerCase()))
      .map(s => s.id)
    setQaTeacher({ teacherId, userId, name })
    setQaSelected(pre)
    setShowQuickAssign(true)
  }

  const toggleQa = (id) => {
    setQaSelected(a => a.includes(id) ? a.filter(x=>x!==id) : [...a, id])
  }

  const openRelease = (teacher) => {
    if (!teacher?.id) return
    setReleaseTarget(teacher)
    setShowRelease(true)
  }

  const releaseTeacher = async () => {
    if (!releaseTarget?.id) return
    try {
      setReleasing(true)
      const summary = await api.post(`/academics/teachers/${releaseTarget.id}/release/`).then(res => res.data?.summary || {})
      await load()
      const classesCleared = summary?.classes_unassigned || 0
      const subjectsCleared = summary?.subject_assignments_removed || 0
      const timetableCleared = summary?.timetable_entries_cleared || 0
      showSuccess('Teacher Released', `Portal access disabled. Cleared ${classesCleared} class, ${subjectsCleared} subject and ${timetableCleared} timetable assignments.`)
    } catch (err) {
      showError('Release Failed', err?.response?.data?.detail || 'Could not release this teacher. Please try again.')
    } finally {
      setReleasing(false)
      setShowRelease(false)
      setReleaseTarget(null)
    }
  }

  const saveQuickAssign = async (e) => {
    e?.preventDefault?.()
    if (!qaTeacher.userId && !qaTeacher.teacherId) return
    try{
      setQaSaving(true)
      const names = (subjects||[]).filter(s=> qaSelected.includes(s.id)).map(s=> s.name)
      if (qaTeacher.teacherId) {
        await api.patch(`/academics/teachers/${qaTeacher.teacherId}/`, { subjects: names.join(', ') })
      } else if (qaTeacher.userId) {
        // create teacher profile then set subjects
        const { data } = await api.post('/academics/teachers/', { user_id: Number(qaTeacher.userId), subjects: names.join(', ') })
        setQaTeacher(t => ({ ...t, teacherId: String(data?.id||'') }))
      }
      await load()
      setShowQuickAssign(false)
    } catch (err) {
      showError('Failed to Save', 'Could not assign subjects to this teacher')
    } finally {
      setQaSaving(false)
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto pb-24 space-y-6">
      {/* Page hero (matches reference screenshot) */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 px-6 py-7 md:px-8 md:py-8 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.9),transparent_26%),radial-gradient(circle_at_78%_38%,rgba(255,255,255,0.35),transparent_28%)]" />
        <div className="pointer-events-none absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
              <Users size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Teachers</h1>
              <p className="text-white/80 text-sm font-semibold">Manage your academic staff and their assignments</p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-10 px-4 rounded-xl bg-white/15 border border-white/25 text-white text-sm font-black focus:outline-none"
            >
              <option value={selectedYear}>{selectedYear}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center">
            <Users size={18} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Teachers</div>
            <div className="text-2xl font-black text-gray-900 leading-none">{activeTeachersCount}</div>
            <div className="text-[11px] font-semibold text-gray-500">Active teachers</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
            <UserCheck size={18} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Assigned</div>
            <div className="text-2xl font-black text-gray-900 leading-none">{assignedTeachersCount}</div>
            <div className="text-[11px] font-semibold text-gray-500">With class assignments</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 flex items-center justify-center">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Subjects Covered</div>
            <div className="text-2xl font-black text-gray-900 leading-none">{coveredSubjectsCount}</div>
            <div className="text-[11px] font-semibold text-gray-500">Across all classes</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center">
            <LayoutGrid size={18} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Departments</div>
            <div className="text-2xl font-black text-gray-900 leading-none">{departmentsCount}</div>
            <div className="text-[11px] font-semibold text-gray-500">Academic departments</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-100 flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Average Experience</div>
            <div className="text-2xl font-black text-gray-900 leading-none">{averageExperienceYears}</div>
            <div className="text-[11px] font-semibold text-gray-500">Years</div>
          </div>
        </div>
      </div>

      {/* Directory + filters (screenshot layout) */}
      {(() => {
        const PAGE_SIZE = 10
        const totalPages = Math.max(1, Math.ceil((filteredTeachers?.length || 0) / PAGE_SIZE))
        const pageTeachers = (filteredTeachers || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

        return (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative flex-1 min-w-[220px] max-w-[420px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Search teachers by name, email or ID..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm font-semibold"
                  />
                </div>

                <select
                  value={filterSubject}
                  onChange={(e) => { setFilterSubject(e.target.value); setPage(1) }}
                  className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold min-w-[190px]"
                >
                  <option value="">All Departments</option>
                  {departmentOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={filterAssigned}
                  onChange={(e) => { setFilterAssigned(e.target.value); setPage(1) }}
                  className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold min-w-[150px]"
                >
                  <option value="all">All Status</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>

                <select
                  disabled
                  className="h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold min-w-[170px] text-gray-400"
                  title="Qualifications filter is not configured yet"
                >
                  <option>All Qualifications</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:border-gray-900 transition-all inline-flex items-center gap-2 shadow-sm"
                  onClick={() => toast('Export coming soon')}
                >
                  Export
                </button>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 transition-all inline-flex items-center gap-2 shadow-soft"
                  onClick={() => setShowCreateUser(true)}
                >
                  <Plus size={16} />
                  Add Teacher
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em]">
                    <th className="px-5 py-4">Teacher</th>
                    <th className="px-5 py-4">Department</th>
                    <th className="px-5 py-4">Subjects</th>
                    <th className="px-5 py-4">Classes</th>
                    <th className="px-5 py-4">Experience</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="px-5 py-5"><div className="h-10 bg-gray-50 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : pageTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-gray-500 font-semibold">
                        No teachers found.
                      </td>
                    </tr>
                  ) : (
                    pageTeachers.map((t) => {
                      const subj = (t.subjects || '').split(',').map(s => s.trim()).filter(Boolean)
                      const subjStr = String(t.subjects || '').toLowerCase()
                      const deptList = Array.from(new Set(
                        (subjects || [])
                          .filter(s => {
                            const nm = String(s?.name || '').toLowerCase()
                            const cd = String(s?.code || '').toLowerCase()
                            return (nm && subjStr.includes(nm)) || (cd && subjStr.includes(cd))
                          })
                          .map(s => String(s?.category || '').trim())
                          .filter(Boolean)
                      ))
                      const dept = deptList[0] || '—'
                      const exp = Number(t?.years_experience)
                      const expLabel = Number.isFinite(exp) ? `${Math.round(exp * 10) / 10} years` : '—'
                      const active = t?.user?.is_active !== false
                      return (
                        <tr key={t.id || `u-${t.user?.id}`} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                                {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-black text-gray-900 truncate">{t.user?.first_name} {t.user?.last_name}</div>
                                <div className="text-xs font-semibold text-gray-500 truncate">{t.user?.email || `@${t.user?.username}`}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">
                              {dept}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1.5 max-w-[320px]">
                              {subj.length ? subj.slice(0, 4).map((s, idx) => (
                                <span key={idx} className="px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-100">
                                  {s}
                                </span>
                              )) : (
                                <span className="text-xs font-semibold text-gray-400">—</span>
                              )}
                              {subj.length > 4 && <span className="text-xs font-black text-gray-400">+{subj.length - 4}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-semibold text-gray-700">
                            {t.klass_detail?.name ? (
                              <div className="leading-tight">
                                <div>{t.klass_detail.name}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-semibold text-gray-700">{expLabel}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                              {active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openQuickAssign(t)}
                                className="h-9 w-9 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-indigo-600 hover:text-indigo-600 transition-all"
                                title="Edit subjects"
                              >
                                <Edit3 size={16} className="mx-auto" />
                              </button>
                              {t.id ? (
                                <button
                                  type="button"
                                  onClick={() => openRelease(t)}
                                  className="h-9 w-9 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-rose-600 hover:text-rose-600 transition-all"
                                  title="Release teacher"
                                >
                                  <X size={16} className="mx-auto" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowAssign(true)}
                                  className="h-9 px-3 rounded-xl bg-white border border-gray-200 text-indigo-600 hover:border-indigo-600 transition-all font-black text-[10px] uppercase tracking-widest"
                                  title="Assign"
                                >
                                  Assign
                                </button>
                              )}
                              <button
                                type="button"
                                className="h-9 w-9 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-gray-700 transition-all"
                                title="More"
                                onClick={() => toast('More actions coming soon')}
                              >
                                <MoreVertical size={16} className="mx-auto" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
              <div className="text-xs font-semibold text-gray-500">
                Showing {(filteredTeachers?.length || 0) ? ((page - 1) * PAGE_SIZE + 1) : 0} to {Math.min(page * PAGE_SIZE, filteredTeachers?.length || 0)} of {(filteredTeachers?.length || 0).toLocaleString()} teachers
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-40"
                >
                  ‹
                </button>
                <div className="h-9 min-w-[36px] px-3 rounded-xl bg-indigo-600 text-white font-black text-sm inline-flex items-center justify-center">
                  {page}
                </div>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>

            {/* Modals */}
            <Modal open={showQuickAssign} onClose={() => setShowQuickAssign(false)} title={`Assign Subjects — ${qaTeacher.name}`} size="lg">
              <form onSubmit={saveQuickAssign} className="grid gap-3">
                <input className="border p-2 rounded" placeholder="Search subjects..." value={qaSearch} onChange={(e) => setQaSearch(e.target.value)} />
                <div className="max-h-64 overflow-auto border rounded p-2 bg-white">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(subjects || [])
                      .filter((s) => {
                        const q = qaSearch.trim().toLowerCase()
                        if (!q) return true
                        return (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q)
                      })
                      .map((s) => {
                        const checked = qaSelected.includes(s.id)
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="h-4 w-4" checked={checked} onChange={() => toggleQa(s.id)} />
                            <span>
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs mr-1">{s.code}</span>
                              {s.name}
                            </span>
                          </label>
                        )
                      })}
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => setShowQuickAssign(false)} className="px-3 py-2 rounded border">Cancel</button>
                  <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60" disabled={qaSaving}>
                    {qaSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </Modal>

            <Modal open={showCreateUser} onClose={() => !creating && setShowCreateUser(false)} title="Create Teacher User" size="lg">
              <form onSubmit={createTeacherUser} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-gray-600">First name</span>
                    <input className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.first_name} onChange={(e) => setNewTeacher((t) => ({ ...t, first_name: e.target.value }))} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-gray-600">Last name</span>
                    <input className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.last_name} onChange={(e) => setNewTeacher((t) => ({ ...t, last_name: e.target.value }))} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-gray-600">Username</span>
                    <input className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.username} onChange={(e) => setNewTeacher((t) => ({ ...t, username: e.target.value }))} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-gray-600">Password</span>
                    <input type="password" className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.password} onChange={(e) => setNewTeacher((t) => ({ ...t, password: e.target.value }))} required />
                  </label>
                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">Email (optional)</span>
                    <input type="email" className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.email} onChange={(e) => setNewTeacher((t) => ({ ...t, email: e.target.value }))} />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowCreateUser(false)} disabled={creating} className="h-11 px-5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60">Cancel</button>
                  <button type="submit" disabled={creating} className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60">
                    {creating ? 'Creating…' : 'Create User'}
                  </button>
                </div>
              </form>
            </Modal>

            <Modal open={showAssign} onClose={() => !assigning && setShowAssign(false)} title="Assign Subjects & Class" size="lg">
              <form onSubmit={create} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">Teacher User</span>
                    <select className="h-11 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={form.user_id} onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))} required>
                      <option value="">Select teacher user…</option>
                      {(users || []).map((u) => (
                        <option key={u.id} value={u.id}>{u.first_name} {u.last_name} (@{u.username})</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">Subjects (comma separated)</span>
                    <input className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" placeholder="e.g. Mathematics, English" value={form.subjects} onChange={(e) => setForm((f) => ({ ...f, subjects: e.target.value }))} />
                  </label>
                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">Primary Class (optional)</span>
                    <select className="h-11 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={form.klass || ''} onChange={(e) => setForm((f) => ({ ...f, klass: e.target.value }))}>
                      <option value="">No class</option>
                      {(classes || []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name} {c.grade_level ? `- ${c.grade_level}` : ''}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAssign(false)} disabled={assigning} className="h-11 px-5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60">Cancel</button>
                  <button type="submit" disabled={assigning} className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60">
                    {assigning ? 'Saving…' : 'Save Assignment'}
                  </button>
                </div>
              </form>
            </Modal>

            <Modal open={showRelease} onClose={() => !releasing && setShowRelease(false)} title="Release Teacher" size="md">
              <div className="space-y-4">
                <div className="text-sm text-gray-700">
                  Release <span className="font-semibold">{releaseTarget?.user?.first_name} {releaseTarget?.user?.last_name}</span> (@{releaseTarget?.user?.username})?
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  This will disable portal access and clear class/subject/timetable assignments.
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowRelease(false)} disabled={releasing} className="h-11 px-5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60">Cancel</button>
                  <button type="button" onClick={releaseTeacher} disabled={releasing} className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-60">
                    {releasing ? 'Releasing…' : 'Release'}
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        )
      })()}

      {pastTeachers.length > 0 && (
        <div className="rounded-2xl border border-gray-200 p-4 md:p-5 bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-gray-900">Past Participants</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600 font-bold">{filteredPastTeachers.length}</span>
            </div>
            <div className="text-xs text-gray-500 font-semibold">Released teachers archived for reference.</div>
          </div>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Subjects</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPastTeachers.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-gray-500">No matching past participants.</td></tr>
                ) : (
                  filteredPastTeachers.map((t) => {
                    const subj = (t.subjects || '').split(',').map((s) => s.trim()).filter(Boolean)
                    return (
                      <tr key={t.id} className="border-t">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-black">
                              {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{t.user?.first_name} {t.user?.last_name}</div>
                              <div className="text-xs text-gray-500">@{t.user?.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {subj.length ? subj.map((s, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600">{s}</span>
                            )) : <span className="text-gray-500">-</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700 font-bold">Released</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
