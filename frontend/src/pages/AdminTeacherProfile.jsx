import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

export default function AdminTeacherProfile(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [teacher, setTeacher] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [classes, setClasses] = useState([])
  const [subjectsCatalog, setSubjectsCatalog] = useState([])
  const [subjectSearch, setSubjectSearch] = useState('')
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set())
  const { showSuccess, showError } = useNotification()

  // editable form fields
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone: '',
    subjects: '',
    klass: '',
    tsc_number: '',
  })

  useEffect(()=>{
    let cancelled = false
    async function load(){
      try {
        setLoading(true)
        const [tRes, cRes, sRes] = await Promise.all([
          api.get(`/academics/teachers/${id}/`),
          api.get('/academics/classes/'),
          api.get('/academics/subjects/')
        ])
        if (!cancelled) {
          setTeacher(tRes.data)
          // Coerce to array in case API is paginated {results: [...]} or returns non-array
          const cls = Array.isArray(cRes.data) ? cRes.data : (Array.isArray(cRes.data?.results) ? cRes.data.results : [])
          setClasses(cls)
          const subs = Array.isArray(sRes.data) ? sRes.data : (Array.isArray(sRes.data?.results) ? sRes.data.results : [])
          setSubjectsCatalog(subs)
          setForm({
            first_name: tRes.data?.user?.first_name || '',
            last_name: tRes.data?.user?.last_name || '',
            email: tRes.data?.user?.email || '',
            username: tRes.data?.user?.username || '',
            phone: tRes.data?.user?.phone || '',
            subjects: tRes.data?.subjects || '',
            klass: tRes.data?.klass || '',
            tsc_number: tRes.data?.tsc_number || '',
          })
          // Initialize selection from existing subjects string (match by code or name)
          const subjStr = (tRes.data?.subjects || '').toLowerCase()
          const preSel = new Set(
            (subs||[])
              .filter(s=> subjStr.includes((s.code||'').toLowerCase()) || subjStr.includes((s.name||'').toLowerCase()))
              .map(s=> String(s.id))
          )
          setSelectedSubjectIds(preSel)
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load teacher profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return ()=>{ cancelled = true }
  },[id])

  const subjects = (teacher?.subjects || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const save = async (e) => {
    e?.preventDefault?.()
    if (!teacher?.user?.id) return
    try {
      setSaving(true)
      // 1) Update user personal info (no password)
      await api.patch('/auth/users/update/', {
        user_id: teacher.user.id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        username: form.username,
        phone: form.phone,
      })
      // 2) Update teacher profile subjects and klass
      const body = { subjects: form.subjects || '' }
      if (form.tsc_number !== undefined) body.tsc_number = form.tsc_number || null
      // Allow clearing class by setting null
      if (form.klass === '' || form.klass === null) {
        body.klass = null
      } else {
        body.klass = form.klass
      }
      await api.patch(`/academics/teachers/${id}/`, body)
      // 3) If a class selected, set class teacher to this user (best-effort)
      if (form.klass) {
        await api.patch(`/academics/classes/${form.klass}/`, { teacher: teacher.user.id })
      }
      // reload
      const { data } = await api.get(`/academics/teachers/${id}/`)
      setTeacher(data)
      setForm(f => ({ ...f, subjects: data.subjects || '', klass: data.klass || '' }))
      showSuccess('Profile Updated', 'Teacher profile and assignments have been updated.')
    } catch (err) {
      showError('Update Failed', 'Could not update teacher. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <React.Fragment>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-semibold">
              {(teacher?.user?.first_name?.[0] || teacher?.user?.username?.[0] || '?').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">
                {teacher?.user?.first_name} {teacher?.user?.last_name}
              </h1>
              <div className="text-sm text-gray-500 truncate">@{teacher?.user?.username}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button onClick={()=>navigate(-1)} className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 shadow-sm transition-colors flex-1 sm:flex-none">Back</button>
            <Link to="/admin/teachers" className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 shadow-sm transition-colors flex-1 sm:flex-none">Directory</Link>
            <button onClick={save} disabled={saving || loading} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-60 transition-colors w-full sm:w-auto">{saving? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>

        <form onSubmit={save} className="bg-white rounded-2xl shadow-md border border-gray-100 ring-1 ring-blue-50 overflow-hidden">
          <div className="border-b px-4 py-3">
            <div className="text-base md:text-lg font-semibold text-gray-800">Teacher Profile</div>
            <div className="text-xs text-gray-500">Edit personal info and assignments</div>
          </div>
          <div className="p-4 md:p-6 space-y-4 pb-24 sm:pb-6">
          {loading && <div>Loading profile...</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {!loading && !error && teacher && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-600 text-sm font-medium">First name</label>
                <input className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium">Last name</label>
                <input className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium">Email</label>
                <input type="email" className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium">Username</label>
                <input className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium">Phone</label>
                <input className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-600 text-sm font-medium">Subjects</label>
                <div className="mt-1 grid gap-2">
                  <input
                    className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors"
                    placeholder="Search subjects..."
                    value={subjectSearch}
                    onChange={e=>setSubjectSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-auto rounded-lg border border-gray-200 p-2 bg-white">
                    <div className="grid sm:grid-cols-2 gap-2">
                      {(subjectsCatalog||[])
                        .filter(s=>{
                          const q = subjectSearch.trim().toLowerCase()
                          if(!q) return true
                          return (s.code||'').toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q)
                        })
                        .map(s=>{
                          const sid = String(s.id)
                          const checked = selectedSubjectIds.has(sid)
                          return (
                            <label key={sid} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={checked}
                                onChange={e=>{
                                  setSelectedSubjectIds(prev=>{
                                    const next = new Set(Array.from(prev))
                                    if(e.target.checked) next.add(sid); else next.delete(sid)
                                    // sync to form.subjects as comma separated names
                                    const names = (subjectsCatalog||[])
                                      .filter(x=> next.has(String(x.id)))
                                      .map(x=> x.name || x.code || '')
                                      .filter(Boolean)
                                    setForm(f=>({ ...f, subjects: names.join(', ') }))
                                    return next
                                  })
                                }}
                              />
                              <span><span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs align-middle mr-1">{s.code}</span>{s.name}</span>
                            </label>
                          )
                        })}
                    </div>
                  </div>
                  {form.subjects && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.subjects.split(',').map(s=>s.trim()).filter(Boolean).map((s,i)=>(
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 border border-purple-200">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium">T.S.C number</label>
                <input className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" value={form.tsc_number} onChange={e=>setForm({...form, tsc_number:e.target.value})} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium">Assigned Class (Class Teacher)</label>
                <select className="w-full border border-gray-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" value={form.klass || ''} onChange={e=>setForm({...form, klass:e.target.value})}>
                  <option value="">No Class</option>
                  {(Array.isArray(classes) ? classes : []).map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 mt-1">Selecting a class will also set this teacher as the class teacher.</div>
              </div>
              <div className="md:col-span-2">
                <div className="sm:static fixed left-0 right-0 bottom-0 sm:bottom-auto sm:left-auto sm:right-auto bg-white/90 backdrop-blur border-t sm:border-0 p-3 sm:p-0 z-20">
                  <div className="max-w-screen-2xl mx-auto px-4 sm:px-0">
                    <div className="flex gap-2 justify-end">
                      <button type="submit" disabled={saving} className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-60 transition-colors">{saving? 'Saving...' : 'Save Changes'}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </form>
      </div>
    </React.Fragment>
  )
}
