import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'
import { Link } from 'react-router-dom'
import StatCard from '../components/StatCard'

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
    } catch (e) {
      showError('Failed to Load Teachers', 'There was a problem loading teachers data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=>{ load() },[])

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
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Teachers</h1>
            <p className="text-sm text-gray-600">Create teacher accounts, assign subjects and class, and manage the directory.</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible py-1 -mx-1 px-1">
            <Link to="/admin/subjects" className="shrink-0 px-3 py-1.5 rounded border hover:bg-gray-50">Subjects</Link>
            <button onClick={()=>setShowAssign(true)} className="shrink-0 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white">Assign Subjects & Class</button>
          </div>
        </div>
        {isCompact ? (
          <div className="space-y-2">
            {statItems.map((item, i) => (
              <div key={item.title} className={i === statIndex ? 'block' : 'hidden'}>
                <StatCard
                  title={item.title}
                  value={item.value}
                  icon={item.icon}
                  accent={item.accent}
                  animate
                  format={(v)=>v.toLocaleString()}
                  trend={0}
                  size="sm"
                />
              </div>
            ))}
            <div className="flex justify-center gap-1.5 pt-1">
              {statItems.map((_, i) => (
                <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${i===statIndex? 'bg-indigo-600':'bg-gray-300'}`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {statItems.map(item => (
              <StatCard
                key={item.title}
                title={item.title}
                value={item.value}
                icon={item.icon}
                accent={item.accent}
                animate
                format={(v)=>v.toLocaleString()}
                trend={0}
              />
            ))}
          </div>
        )}
        <div className="relative overflow-hidden rounded-2xl shadow-elevated p-5 text-white bg-gradient-to-r from-brand-600 via-indigo-600 to-fuchsia-600">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white/90">Quick Actions</div>
              <div className="text-lg font-semibold">Create or Assign Teacher</div>
              <div className="text-xs text-white/80">Add a teacher user, then assign subjects and class</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setShowCreateUser(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-md">Create User</button>
              <button onClick={()=>setShowAssign(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-md">Assign</button>
            </div>
          </div>
        </div>
        {/* Mobile toolbar */}
        <div className="md:hidden space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search teachers..."
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <button
              onClick={()=> setShowFilters(v=>!v)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
            >Filters</button>
          </div>
          {showFilters && (
            <div className="p-3 rounded-xl border border-gray-200 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 space-y-2">
              <select
                value={filterSubject}
                onChange={(e)=>setFilterSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Subjects</option>
                {(subjects||[]).map(s => (
                  <option key={s.id} value={s.id}>{s.code ? `${s.code} — ${s.name}` : s.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <select
                  value={filterClass}
                  onChange={(e)=>setFilterClass(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.grade_level ? `- ${c.grade_level}` : ''}</option>
                  ))}
                </select>
                <select
                  value={filterAssigned}
                  onChange={(e)=>setFilterAssigned(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={()=>{ setFilterSubject(''); setFilterClass(''); setFilterAssigned('all'); setSearch('') }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >Clear</button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={()=> setShowCreateUser(true)}
          aria-label="Create teacher"
          title="Create teacher"
          className="md:hidden fixed right-4 bottom-24 z-40 px-3.5 py-2 rounded-full text-sm font-semibold bg-indigo-600 text-white shadow-soft"
        >
          + Create
        </button>

        {/* Action Modals */}
        <Modal open={showCreateUser} onClose={()=>setShowCreateUser(false)} title="Create Teacher User" size="lg">
          <form onSubmit={createTeacherUser} className="grid gap-3 md:grid-cols-3">
            <input className="border p-2 rounded" placeholder="Username" value={newTeacher.username} onChange={e=>setNewTeacher({...newTeacher, username:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Password" type="password" value={newTeacher.password} onChange={e=>setNewTeacher({...newTeacher, password:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Email" type="email" value={newTeacher.email} onChange={e=>setNewTeacher({...newTeacher, email:e.target.value})} />
            <input className="border p-2 rounded" placeholder="First name" value={newTeacher.first_name} onChange={e=>setNewTeacher({...newTeacher, first_name:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Last name" value={newTeacher.last_name} onChange={e=>setNewTeacher({...newTeacher, last_name:e.target.value})} />
            <div className="md:col-span-3 flex justify-end">
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow" disabled={creating}>
                {creating? 'Creating...' : 'Create Teacher User'}
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-500 mt-2">After creating a teacher user, they will appear in the selector for assignment.</p>
        </Modal>

        <Modal open={showRelease} onClose={()=>!releasing && setShowRelease(false)} title="Release Teacher" size="md">
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              This will disable the teacher's portal access, unassign them from their class and subjects, and clear any timetable allocations.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 text-sm">
              <strong>Teacher:</strong> {releaseTarget?.user?.first_name} {releaseTarget?.user?.last_name} (@{releaseTarget?.user?.username})
            </div>
            <p className="text-sm text-gray-600">This action cannot be undone automatically. Are you sure you want to proceed?</p>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={()=>!releasing && setShowRelease(false)} className="px-3 py-1.5 rounded border text-sm" disabled={releasing}>
              Cancel
            </button>
            <button type="button" onClick={releaseTeacher} className="px-3 py-1.5 rounded text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60" disabled={releasing}>
              {releasing ? 'Releasing...' : 'Release Teacher'}
            </button>
          </div>
        </Modal>

        <Modal open={showAssign} onClose={()=>setShowAssign(false)} title="Assign Subjects & Class" size="lg">
          <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
            <select className="border p-2 rounded" value={form.user_id} onChange={e=>setForm({...form, user_id:e.target.value})} disabled={loading}>
              <option value="">Select Teacher User</option>
              {users.map(u=> <option key={u.id} value={u.id}>{u.username} — {u.first_name} {u.last_name}</option>)}
            </select>
            <input className="border p-2 rounded" placeholder="Subjects (comma separated)" value={form.subjects} onChange={e=>setForm({...form, subjects:e.target.value})} />
            <select className="border p-2 rounded" value={form.klass} onChange={e=>setForm({...form, klass:e.target.value})} disabled={loading}>
              <option value="">Assign Class</option>
              {classes.map(c=> <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>)}
            </select>
            <div className="md:col-span-3 flex justify-end">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow disabled:opacity-60" disabled={assigning || loading || !form.user_id}>
                {assigning? 'Saving...' : 'Assign / Update'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Directory */}
        <div className="rounded-2xl border border-gray-200 p-4 md:p-5 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 shadow-card">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold">Teachers Directory</h2>
            <div className="hidden md:block">
              <input className="w-64 border p-2 rounded-lg" placeholder="Search name, subject or class" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 mb-2">
            <select
              value={filterSubject}
              onChange={(e)=>setFilterSubject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Subjects</option>
              {(subjects||[]).map(s => (
                <option key={s.id} value={s.id}>{s.code ? `${s.code} — ${s.name}` : s.name}</option>
              ))}
            </select>
            <select
              value={filterClass}
              onChange={(e)=>setFilterClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.grade_level ? `- ${c.grade_level}` : ''}</option>
              ))}
            </select>
            <select
              value={filterAssigned}
              onChange={(e)=>setFilterAssigned(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <button
              onClick={()=>{ setFilterSubject(''); setFilterClass(''); setFilterAssigned('all'); setSearch('') }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >Clear</button>
          </div>
          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {loading ? (
              <div className="py-6 text-center text-gray-500">Loading...</div>
            ) : filteredTeachers.length === 0 ? (
              <div className="py-6 text-center text-gray-500">No teachers found.</div>
            ) : (
              filteredTeachers.map(t => {
                const subj = (t.subjects || '')
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean)
                const Container = t.id ? Link : 'div'
                const containerProps = t.id ? { to: `/admin/teachers/${t.id}` } : {}
                return (
                  <Container key={t.id || `u-${t.user?.id}`} {...containerProps} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 shadow-card p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-white flex items-center justify-center font-semibold ring-1 ring-white/30">
                        {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.user?.first_name} {t.user?.last_name}</div>
                        <div className="text-xs text-gray-500 truncate">@{t.user?.username}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {subj.slice(0,3).map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-full text-[11px] bg-purple-100 text-purple-700">{s}</span>
                          ))}
                          {subj.length>3 && <span className="text-[11px] text-gray-500">+{subj.length-3} more</span>}
                          {!subj.length && <span className="text-[11px] text-gray-500">No subjects</span>}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {t.klass_detail?.name ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">{t.klass_detail.name}</span>
                      ) : <span className="text-xs text-gray-500">-</span>}
                      <button type="button" onClick={(e)=>{ e.preventDefault(); openQuickAssign(t) }} className="px-3.5 py-3 text-sm rounded-lg border border-gray-200 bg-white/80 hover:bg-gray-50">Assign Subjects</button>
                      {t.id && (
                        <button
                          type="button"
                          onClick={(e)=>{ e.preventDefault(); openRelease(t) }}
                          className="px-3.5 py-3 text-sm rounded-lg border border-red-200 bg-white/80 text-red-600 hover:bg-red-50"
                        >
                          Release
                        </button>
                      )}
                    </div>
                  </Container>
                )
              })
            )}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">Subjects</th>
                  <th className="py-2 px-3">Class</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="py-6 text-center text-gray-500">Loading...</td></tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-gray-500">No teachers found.</td></tr>
                ) : (
                  filteredTeachers.map(t => {
                    const subj = (t.subjects || '')
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)
                    return (
                      <tr key={t.id || `u-${t.user?.id}`} className="border-t hover:bg-gray-50/60">
                        <td className="py-2 px-3">
                          {t.id ? (
                            <Link to={`/admin/teachers/${t.id}`} className="flex items-center gap-2 group">
                              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
                                {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium group-hover:underline">{t.user?.first_name} {t.user?.last_name}</div>
                                <div className="text-xs text-gray-500">@{t.user?.username}</div>
                              </div>
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
                                {(t.user?.first_name?.[0] || t.user?.username?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium">{t.user?.first_name} {t.user?.last_name}</div>
                                <div className="text-xs text-gray-500">@{t.user?.username}</div>
                                <div className="text-[11px] text-gray-500">Not yet assigned</div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {subj.length ? subj.map((s, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{s}</span>
                            )) : <span className="text-gray-500">-</span>}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {t.klass_detail?.name ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">{t.klass_detail.name}</span>
                          ) : <span className="text-gray-500">-</span>}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button type="button" onClick={()=>openQuickAssign(t)} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">Assign Subjects</button>
                          {t.id && (
                            <button
                              type="button"
                              onClick={()=>openRelease(t)}
                              className="ml-2 px-2 py-1 rounded border border-red-200 text-xs text-red-600 hover:bg-red-50"
                            >
                              Release
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
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
    </AdminLayout>
  )
}
