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

      // Subject filter
      if (filterSubject) {
        const sObj = (subjects||[]).find(s => String(s.id) === String(filterSubject))
        const sName = (sObj?.name || '').toLowerCase()
        const sCode = (sObj?.code || '').toLowerCase()
        const subMatch = (sName && subjStr.includes(sName)) || (sCode && subjStr.includes(sCode))
        if (!subMatch) return false
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
        const sObj = (subjects||[]).find(s => String(s.id) === String(filterSubject))
        const sName = (sObj?.name || '').toLowerCase()
        const sCode = (sObj?.code || '').toLowerCase()
        const subMatch = (sName && subjStr.includes(sName)) || (sCode && subjStr.includes(sCode))
        if (!subMatch) return false
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
    <div className="min-h-screen bg-gray-50/50 pb-20 text-left">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 text-left">
            <div className="text-left">
              <div className="flex items-center gap-2 text-indigo-600 mb-1">
                <Users size={20} />
                <span className="text-sm font-bold uppercase tracking-wider">Academic Staff</span>
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                Manage <span className="text-indigo-600">Teachers</span>
              </h1>
              <p className="text-gray-500 mt-1 font-medium">Create accounts, assign subjects, and manage the directory</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <Link to="/admin/subjects" className="h-12 px-6 rounded-2xl bg-white border-2 border-gray-100 text-gray-700 font-black hover:border-gray-900 hover:text-gray-900 transition-all flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto">
                <BookOpen size={18} />
                Subjects
              </Link>
              <button 
                onClick={()=>setShowAssign(true)}
                className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 w-full sm:w-auto"
              >
                <ClipboardCheck size={18} />
                Assign Subjects & Class
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-6 sm:mt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-4">
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                <Users size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">{activeTeachersCount}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Active Teachers</div>
              </div>
              </div>
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                <UserCheck size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">{assignedTeachersCount}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Assigned</div>
              </div>
              </div>
              <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center shadow-sm">
                <BookOpen size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">{coveredSubjectsCount}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Subjects Covered</div>
              </div>
              </div>
              <div className="bg-gray-900 p-4 rounded-2xl shadow-xl flex items-center justify-between group text-left">
              <div className="text-left">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">Active Directory</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <CheckCircle2 size={20} />
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8 text-left">
        {/* Quick Actions Card */}
        <div className="bg-white rounded-[2rem] p-5 sm:p-8 border-2 border-gray-100 shadow-sm mb-8 sm:mb-12 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 sm:gap-8 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 text-left w-full md:w-auto">
            <div className="flex items-center gap-3 mb-4 text-left">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <UserPlus size={28} />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Onboard Faculty</h2>
                <p className="text-sm font-medium text-gray-500 italic">Add new teacher users and set their initial access</p>
              </div>
            </div>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <button 
              onClick={()=>setShowCreateUser(true)}
              className="h-12 px-8 rounded-2xl bg-white border-2 border-gray-100 text-gray-700 font-black text-xs uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
            >
              <Plus size={18} /> Create User
            </button>
            <button 
              onClick={()=>setShowAssign(true)}
              className="h-12 px-8 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 w-full sm:w-auto"
            >
              <ClipboardCheck size={18} /> Assign Now
            </button>
          </div>
        </div>

        {/* Directory Card */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden text-left">
          <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-gray-50/50 to-white text-left">
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center shadow-sm">
                <LayoutGrid size={24} />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Teachers Directory</h2>
                <p className="text-xs font-medium text-gray-500 italic uppercase tracking-widest text-left">Global Staff Listing</p>
              </div>

            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
              <div className="relative group w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  value={search} 
                  onChange={e=>setSearch(e.target.value)}
                  placeholder="Search staff..."
                  className="h-12 w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold focus:border-indigo-500 transition-all outline-none"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`h-12 px-6 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest w-full sm:w-auto ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'}`}
              >
                <Filter size={18} />
                Filters
                <ChevronDown size={16} className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="p-8 bg-gray-50 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-300 text-left">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Subject Expertise</label>
                <select 
                  value={filterSubject} 
                  onChange={e=>setFilterSubject(e.target.value)}
                  className="w-full h-11 bg-white border-2 border-white rounded-xl px-4 text-sm font-bold text-gray-700 shadow-sm focus:border-indigo-500 transition-all outline-none appearance-none"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Class Responsibility</label>
                <select 
                  value={filterClass} 
                  onChange={e=>setFilterClass(e.target.value)}
                  className="w-full h-11 bg-white border-2 border-white rounded-xl px-4 text-sm font-bold text-gray-700 shadow-sm focus:border-indigo-500 transition-all outline-none appearance-none"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-3 text-left">
                <button 
                  onClick={()=>{ setFilterSubject(''); setFilterClass(''); setFilterAssigned('all'); setSearch('') }}
                  className="h-11 px-6 rounded-xl bg-white border-2 border-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:border-gray-900 hover:text-gray-900 transition-all flex-1"
                >
                  Reset
                </button>
                <div className="flex-1 flex flex-col justify-center text-left">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Matches</div>
                  <div className="text-xl font-black text-indigo-600">{filteredTeachers.length} <span className="text-gray-300 text-xs font-bold uppercase tracking-widest ml-1">staff</span></div>
                </div>
              </div>
            </div>
          )}

          <div className="p-0 text-left">
            <div className="md:hidden p-4 sm:p-6 grid gap-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 animate-pulse">
                    <div className="h-10 bg-white/70 rounded-xl" />
                  </div>
                ))
              ) : filteredTeachers.length === 0 ? (
                <div className="py-10 text-center text-gray-500">No staff records</div>
              ) : (
                filteredTeachers.map(t => {
                  const subj = (t.subjects || '').split(',').map(s => s.trim()).filter(Boolean)
                  return (
                    <div key={t.id || `u-${t.user?.id}`} className="p-4 rounded-[2rem] border border-gray-100 bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0">
                            {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-gray-900 truncate">
                              {t.user?.first_name} {t.user?.last_name}
                            </div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">@{t.user?.username}</div>
                          </div>
                        </div>
                        {t.klass_detail?.name ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider shrink-0">
                            <CheckCircle2 size={12} />
                            {t.klass_detail.name}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest shrink-0">None</span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {subj.length ? subj.slice(0, 6).map((s, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-50 text-purple-600 border border-purple-100 uppercase tracking-wider">
                            {s}
                          </span>
                        )) : (
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">Unassigned</span>
                        )}
                        {subj.length > 6 && (
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">+{subj.length - 6} more</span>
                        )}
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={()=>openQuickAssign(t)}
                          className="flex-1 h-11 rounded-2xl bg-white border-2 border-gray-100 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:border-indigo-600 transition-all active:scale-95"
                        >
                          Edit Subjects
                        </button>
                        {t.id && (
                          <button
                            type="button"
                            onClick={()=>openRelease(t)}
                            className="h-11 w-11 rounded-2xl bg-white border-2 border-gray-100 text-gray-300 hover:text-rose-600 hover:border-rose-600 transition-all active:scale-95"
                            title="Release Staff"
                          >
                            <X size={18} className="mx-auto" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 text-left">
                  <th className="py-6 px-8 text-left">Staff Member</th>
                  <th className="py-6 px-8 text-left">Subject Assignments</th>
                  <th className="py-6 px-8 text-center">Primary Class</th>
                  <th className="py-6 px-8 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-left">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="py-8 px-8"><div className="h-12 bg-gray-50 rounded-2xl w-full" /></td>
                    </tr>
                  ))
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border-2 border-gray-100 border-dashed">
                        <Users size={40} className="text-gray-200" />
                      </div>
                      <h3 className="text-gray-400 font-black uppercase tracking-widest text-sm mb-1">No staff records</h3>
                      <p className="text-gray-400 text-xs font-medium italic">Adjust filters or create a new user</p>
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map(t => {
                    const subj = (t.subjects || '').split(',').map(s => s.trim()).filter(Boolean)
                    return (
                      <tr key={t.id || `u-${t.user?.id}`} className="group hover:bg-gray-50/50 transition-colors text-left">
                        <td className="py-6 px-8 text-left">
                          <Link to={t.id ? `/admin/teachers/${t.id}` : '#'} className="flex items-center gap-4 group/item text-left">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-base shadow-sm ring-2 ring-transparent group-hover/item:ring-indigo-100 transition-all shrink-0">
                              {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="text-left">
                              <div className="font-black text-gray-900 tracking-tight leading-none mb-1 group-hover/item:text-indigo-600 transition-colors text-left">
                                {t.user?.first_name} {t.user?.last_name}
                              </div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">@{t.user?.username}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="py-6 px-8 text-left">
                          <div className="flex flex-wrap gap-1.5 max-w-md text-left">
                            {subj.length > 0 ? subj.map((s, idx) => (
                              <span key={idx} className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-50 text-purple-600 border border-purple-100 uppercase tracking-wider">
                                {s}
                              </span>
                            )) : <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">Unassigned</span>}
                          </div>
                        </td>
                        <td className="py-6 px-8 text-center">
                          {t.klass_detail?.name ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">
                              <CheckCircle2 size={12} />
                              {t.klass_detail.name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">None</span>
                          )}
                        </td>
                        <td className="py-6 px-8 text-right">
                          <div className="flex items-center justify-end gap-2 text-right">
                            <button 
                              onClick={()=>openQuickAssign(t)}
                              className="h-9 px-4 rounded-xl bg-white border-2 border-gray-100 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:border-indigo-600 transition-all active:scale-95 shadow-sm"
                            >
                              Edit Subjects
                            </button>
                            {t.id && (
                              <button 
                                onClick={()=>openRelease(t)}
                                className="h-9 w-9 flex items-center justify-center rounded-xl bg-white border-2 border-gray-100 text-gray-300 hover:text-rose-600 hover:border-rose-600 transition-all active:scale-95 shadow-sm"
                                title="Release Staff"
                              >
                                <X size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              </table>
            </div>
          </div>
          {/* Quick Assign Modal */}
          <Modal open={showQuickAssign} onClose={()=>setShowQuickAssign(false)} title={`Assign Subjects — ${qaTeacher.name}`} size="lg">
            <form onSubmit={saveQuickAssign} className="grid gap-3">
              <input className="border p-2 rounded" placeholder="Search subjects..." value={qaSearch} onChange={e=>setQaSearch(e.target.value)} />
              <div className="max-h-64 overflow-auto border rounded p-2 bg-white">
                <div className="grid sm:grid-cols-2 gap-2">
                  {(subjects||[])
                    .filter(s=>{ const q = qaSearch.trim().toLowerCase(); if(!q) return true; return (s.name||'').toLowerCase().includes(q) || (s.code||'').toLowerCase().includes(q) })
                    .map(s=>{
                      const checked = qaSelected.includes(s.id)
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="h-4 w-4" checked={checked} onChange={()=>toggleQa(s.id)} />
                          <span><span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs mr-1">{s.code}</span>{s.name}</span>
                        </label>
                      )
                    })}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={()=>setShowQuickAssign(false)} className="px-3 py-2 rounded border">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60" disabled={qaSaving}>{qaSaving? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </Modal>

          <Modal open={showCreateUser} onClose={()=>!creating && setShowCreateUser(false)} title="Create Teacher User" size="lg">
            <form onSubmit={createTeacherUser} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-gray-600">First name</span>
                  <input className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.first_name} onChange={e=>setNewTeacher(t=>({ ...t, first_name: e.target.value }))} required />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-gray-600">Last name</span>
                  <input className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.last_name} onChange={e=>setNewTeacher(t=>({ ...t, last_name: e.target.value }))} required />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-gray-600">Username</span>
                  <input className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.username} onChange={e=>setNewTeacher(t=>({ ...t, username: e.target.value }))} required />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-gray-600">Password</span>
                  <input type="password" className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.password} onChange={e=>setNewTeacher(t=>({ ...t, password: e.target.value }))} required />
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">Email (optional)</span>
                  <input type="email" className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={newTeacher.email} onChange={e=>setNewTeacher(t=>({ ...t, email: e.target.value }))} />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowCreateUser(false)} disabled={creating} className="h-11 px-5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={creating} className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60">
                  {creating ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </Modal>

          <Modal open={showAssign} onClose={()=>!assigning && setShowAssign(false)} title="Assign Subjects & Class" size="lg">
            <form onSubmit={create} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">Teacher User</span>
                  <select className="h-11 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={form.user_id} onChange={e=>setForm(f=>({ ...f, user_id: e.target.value }))} required>
                    <option value="">Select teacher user…</option>
                    {(users||[]).map(u => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name} (@{u.username})</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">Subjects (comma separated)</span>
                  <input className="h-11 px-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" placeholder="e.g. Mathematics, English" value={form.subjects} onChange={e=>setForm(f=>({ ...f, subjects: e.target.value }))} />
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">Primary Class (optional)</span>
                  <select className="h-11 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" value={form.klass || ''} onChange={e=>setForm(f=>({ ...f, klass: e.target.value }))}>
                    <option value="">No class</option>
                    {(classes||[]).map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.grade_level ? `- ${c.grade_level}` : ''}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowAssign(false)} disabled={assigning} className="h-11 px-5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={assigning} className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60">
                  {assigning ? 'Saving…' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </Modal>

          <Modal open={showRelease} onClose={()=>!releasing && setShowRelease(false)} title="Release Teacher" size="md">
            <div className="space-y-4">
              <div className="text-sm text-gray-700">
                Release <span className="font-semibold">{releaseTarget?.user?.first_name} {releaseTarget?.user?.last_name}</span> (@{releaseTarget?.user?.username})?
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                This will disable portal access and clear class/subject/timetable assignments.
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowRelease(false)} disabled={releasing} className="h-11 px-5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60">Cancel</button>
                <button type="button" onClick={releaseTeacher} disabled={releasing} className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-60">
                  {releasing ? 'Releasing…' : 'Release'}
                </button>
              </div>
            </div>
          </Modal>
        </div>

        {pastTeachers.length > 0 && (
          <div className="rounded-2xl border border-gray-200 p-4 md:p-5 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 shadow-card">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Past Participants</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600">{filteredPastTeachers.length}</span>
              </div>
              <div className="text-xs text-gray-500">Released teachers archived for reference.</div>
            </div>

            <div className="grid gap-2 md:hidden">
              {filteredPastTeachers.length === 0 ? (
                <div className="py-6 text-center text-gray-500">No matching past participants.</div>
              ) : (
                filteredPastTeachers.map(t => {
                  const subj = (t.subjects || '')
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean)
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-semibold">
                          {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{t.user?.first_name} {t.user?.last_name}</div>
                          <div className="text-xs text-gray-500 truncate">@{t.user?.username}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {subj.length ? subj.slice(0,3).map((s, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-full text-[11px] bg-purple-50 text-purple-600">{s}</span>
                            )) : <span className="text-[11px] text-gray-500">No subjects recorded</span>}
                            {subj.length>3 && <span className="text-[11px] text-gray-500">+{subj.length-3} more</span>}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-200 text-gray-600">Released</span>
                    </div>
                  )
                })
              )}
            </div>

            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3">Subjects</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPastTeachers.length === 0 ? (
                    <tr><td colSpan={3} className="py-6 text-center text-gray-500">No matching past participants.</td></tr>
                  ) : (
                    filteredPastTeachers.map(t => {
                      const subj = (t.subjects || '')
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean)
                      return (
                        <tr key={t.id} className="border-t">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-semibold">
                                {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium">{t.user?.first_name} {t.user?.last_name}</div>
                                <div className="text-xs text-gray-500">@{t.user?.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              {subj.length ? subj.map((s, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600">{s}</span>
                              )) : <span className="text-gray-500">-</span>}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600">Released</span>
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
    </div>
  )
}
