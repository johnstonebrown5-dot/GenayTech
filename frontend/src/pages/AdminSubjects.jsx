import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { useNotification } from '../components/NotificationContext'
import { Link } from 'react-router-dom'

export default function AdminSubjects(){
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [teacherUsers, setTeacherUsers] = useState([])

  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  const [newSubject, setNewSubject] = useState({ code: '', name: '', category: 'other', is_examinable: true })

  const [classAssign, setClassAssign] = useState({ klass: '', subject_ids: [] })
  const [teacherAssign, setTeacherAssign] = useState({ teacher_id: '', subject_ids: [] })

  const { showSuccess, showError } = useNotification()

  const [showCreateSubject, setShowCreateSubject] = useState(false)
  const [showClassAllocation, setShowClassAllocation] = useState(false)
  const [showTeacherAllocation, setShowTeacherAllocation] = useState(false)
  const [showDirectory, setShowDirectory] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const [s, c, t, u] = await Promise.all([
        api.get('/academics/subjects/'),
        api.get('/academics/classes/'),
        api.get('/academics/teachers/'),
        api.get('/auth/users/?role=teacher')
      ])
      const sArr = Array.isArray(s.data) ? s.data : (Array.isArray(s.data?.results) ? s.data.results : [])
      const cArr = Array.isArray(c.data) ? c.data : (Array.isArray(c.data?.results) ? c.data.results : [])
      const tArrRaw = Array.isArray(t.data) ? t.data : (Array.isArray(t.data?.results) ? t.data.results : [])
      const tArr = tArrRaw.filter(teacher => teacher?.user?.is_active !== false)
      const uArrRaw = Array.isArray(u.data) ? u.data : (Array.isArray(u.data?.results) ? u.data.results : [])
      const uArr = uArrRaw.filter(user => user?.is_active !== false)
      setSubjects(sArr); setClasses(cArr); setTeachers(tArr); setTeacherUsers(uArr)
    } catch (e) {
      showError('Failed to Load Data', 'Could not load subjects/classes/teachers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() },[])

  const allTeacherDirectory = useMemo(()=>{
    // Start with teacher profiles
    const byUserId = new Set((teachers||[]).map(t=>t?.user?.id))
    // Users without teacher profile
    const missing = (teacherUsers||[]).filter(u=> !byUserId.has(u.id))
    return { profiles: teachers||[], missingUsers: missing }
  }, [teachers, teacherUsers])

  const createSubject = async (e) => {
    e.preventDefault()
    if (!newSubject.code || !newSubject.name) return
    try {
      setCreating(true)
      await api.post('/academics/subjects/', newSubject)
      setNewSubject({ code: '', name: '', category: 'other' })
      await load()
      showSuccess('Subject Created', 'New subject added to the curriculum')
    } catch (err) {
      showError('Creation Failed', 'Check that code is unique and try again')
    } finally {
      setCreating(false)
    }
  }

  const saveClassSubjects = async (e) => {
    e.preventDefault()
    if (!classAssign.klass) return
    try {
      await api.patch(`/academics/classes/${classAssign.klass}/`, { subject_ids: classAssign.subject_ids })
      showSuccess('Class Updated', 'Subjects allocated to class')
      await load()
    } catch (err) {
      showError('Update Failed', 'Could not allocate subjects to class')
    }
  }

  const saveTeacherSubjects = async (e) => {
    e.preventDefault()
    if (!teacherAssign.teacher_id) return
    try {
      const subNames = subjects.filter(s => teacherAssign.subject_ids.includes(s.id)).map(s => s.name)
      const val = String(teacherAssign.teacher_id)
      if (val.startsWith('t:')) {
        const tid = val.slice(2)
        await api.patch(`/academics/teachers/${tid}/`, { subjects: subNames.join(', ') })
      } else if (val.startsWith('u:')) {
        const uid = val.slice(2)
        // Create teacher profile if it doesn't exist, then set subjects
        const createRes = await api.post('/academics/teachers/', { user_id: Number(uid), subjects: subNames.join(', ') })
        // Optional: refresh selected to new profile id
        const newId = createRes?.data?.id
        if (newId) {
          setTeacherAssign(a=>({ ...a, teacher_id: `t:${newId}` }))
        }
      } else {
        // Backward compatibility: assume it is a teacher id
        await api.patch(`/academics/teachers/${val}/`, { subjects: subNames.join(', ') })
      }
      showSuccess('Teacher Updated', 'Subjects allocated to teacher')
      await load()
    } catch (err) {
      showError('Update Failed', 'Could not allocate subjects to teacher')
    }
  }

  const toggleId = (arr, id) => (arr.includes(id) ? arr.filter(i=>i!==id) : [...arr, id])

  return (
    <React.Fragment>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Subjects</h1>
            <p className="text-sm text-gray-600">Create subjects and allocate them to teachers and classes.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/teachers" className="px-3 py-1.5 rounded border hover:bg-gray-50">Teachers</Link>
          </div>
        </div>

        {/* Create Subject */}
        <form onSubmit={createSubject} className="bg-white rounded-xl shadow p-4 md:p-5 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-5 flex items-center justify-between mb-1">
            <div className="font-semibold">Create Subject</div>
            <button
              type="button"
              onClick={() => setShowCreateSubject(v => !v)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 text-xs"
              aria-label={showCreateSubject ? 'Collapse create subject' : 'Expand create subject'}
            >
              <span className={`transform transition-transform ${showCreateSubject ? 'rotate-0' : '-rotate-90'}`}>▾</span>
            </button>
          </div>
          {showCreateSubject && (
            <>
              <input className="border p-2 rounded" placeholder="Code (e.g., MATH)" value={newSubject.code} onChange={e=>setNewSubject({...newSubject, code:e.target.value})} />
              <input className="border p-2 rounded md:col-span-2" placeholder="Name (e.g., Mathematics)" value={newSubject.name} onChange={e=>setNewSubject({...newSubject, name:e.target.value})} />
              <select className="border p-2 rounded" value={newSubject.category} onChange={e=>setNewSubject({...newSubject, category:e.target.value})}>
                <option value="language">Language</option>
                <option value="science">Science</option>
                <option value="arts">Arts</option>
                <option value="humanities">Humanities</option>
                <option value="other">Other</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!newSubject.is_examinable} onChange={e=>setNewSubject({...newSubject, is_examinable: e.target.checked})} />
                <span>Examinable</span>
              </label>
              <div className="md:col-span-1 flex justify-end">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow" disabled={creating}>{creating? 'Creating...' : 'Add Subject'}</button>
              </div>
            </>
          )}
        </form>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Allocate to Class */}
          <form onSubmit={saveClassSubjects} className="bg-white rounded-xl shadow p-4 md:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Allocate Subjects to Class</div>
              <button
                type="button"
                onClick={() => setShowClassAllocation(v => !v)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 text-xs"
                aria-label={showClassAllocation ? 'Collapse class allocation' : 'Expand class allocation'}
              >
                <span className={`transform transition-transform ${showClassAllocation ? 'rotate-0' : '-rotate-90'}`}>▾</span>
              </button>
            </div>
            {showClassAllocation && (
              <>
                <select className="border p-2 rounded w-full" value={classAssign.klass} onChange={e=>setClassAssign({...classAssign, klass: e.target.value})}>
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  {subjects.map(s => {
                    const selected = classAssign.subject_ids.includes(s.id)
                    return (
                      <button type="button" key={s.id} onClick={()=>setClassAssign(a=>({...a, subject_ids: toggleId(a.subject_ids, s.id)}))} className={`px-2 py-1 rounded-full text-xs border ${selected? 'bg-purple-100 text-purple-700 border-purple-200' : 'hover:bg-gray-50'}`}>
                        {s.name}{s.is_examinable === false ? ' (Unexaminable)' : ''}
                      </button>
                    )
                  })}
                </div>
                <div className="text-xs text-gray-500">Tip: Click to toggle subjects.</div>
                <div className="flex justify-end"><button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60" disabled={!classAssign.klass}>Save Allocation</button></div>
              </>
            )}
          </form>

          {/* Allocate to Teacher */}
          <form onSubmit={saveTeacherSubjects} className="bg-white rounded-xl shadow p-4 md:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Allocate Subjects to Teacher</div>
              <button
                type="button"
                onClick={() => setShowTeacherAllocation(v => !v)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 text-xs"
                aria-label={showTeacherAllocation ? 'Collapse teacher allocation' : 'Expand teacher allocation'}
              >
                <span className={`transform transition-transform ${showTeacherAllocation ? 'rotate-0' : '-rotate-90'}`}>▾</span>
              </button>
            </div>
            {showTeacherAllocation && (
              <>
                <select className="border p-2 rounded w-full" value={teacherAssign.teacher_id} onChange={e=>setTeacherAssign({...teacherAssign, teacher_id: e.target.value})}>
                  <option value="">Select Teacher</option>
                  {allTeacherDirectory.profiles.map(t => (
                    <option key={t.id} value={`t:${t.id}`}>{t.user?.first_name} {t.user?.last_name} (@{t.user?.username})</option>
                  ))}
                  {allTeacherDirectory.missingUsers.length > 0 && (
                    <optgroup label="Users without teacher profile (will be created)">
                      {allTeacherDirectory.missingUsers.map(u => (
                        <option key={`u-${u.id}`} value={`u:${u.id}`}>
                          {(u.first_name||'') + ' ' + (u.last_name||'')} (@{u.username})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="flex flex-wrap gap-2">
                  {subjects.map(s => {
                    const selected = teacherAssign.subject_ids.includes(s.id)
                    return (
                      <button type="button" key={s.id} onClick={()=>setTeacherAssign(a=>({...a, subject_ids: toggleId(a.subject_ids, s.id)}))} className={`px-2 py-1 rounded-full text-xs border ${selected? 'bg-purple-100 text-purple-700 border-purple-200' : 'hover:bg-gray-50'}`}>
                        {s.name}{s.is_examinable === false ? ' (Unexaminable)' : ''}
                      </button>
                    )
                  })}
                </div>
                <div className="text-xs text-gray-500">Note: Teacher profiles store subject names; we save selected subjects as a comma-separated list of names.</div>
                <div className="flex justify-end"><button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60" disabled={!teacherAssign.teacher_id}>Save Allocation</button></div>
              </>
            )}
          </form>
        </div>

        {/* Subjects list */}
        <div className="bg-white rounded-xl shadow p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Subjects Directory</div>
            <button
              type="button"
              onClick={() => setShowDirectory(v => !v)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 text-xs"
              aria-label={showDirectory ? 'Collapse subjects directory' : 'Expand subjects directory'}
            >
              <span className={`transform transition-transform ${showDirectory ? 'rotate-0' : '-rotate-90'}`}>▾</span>
            </button>
          </div>
          {showDirectory && (
            <div className="grid md:grid-cols-3 gap-2">
              {subjects.map(s => (
                <Link key={s.id} to={`/admin/subjects/${s.id}`} className="border rounded p-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span>{s.name}</span>
                      {s.is_examinable === false && (
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium bg-white text-amber-700 border-amber-300">Unexaminable</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{s.code} · {(s.category||'other').toString().replace(/^./,c=>c.toUpperCase())}</div>
                  </div>
                </Link>
              ))}
              {!subjects.length && !loading && <div className="text-gray-500">No subjects yet.</div>}
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  )
}
