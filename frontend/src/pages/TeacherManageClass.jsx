import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../auth'
import AdminClassPrintReportCards from './AdminClassPrintReportCards'

export default function TeacherManageClass(){
  const { user } = useAuth()
  const [myClass, setMyClass] = useState(null)
  const [classesLoading, setClassesLoading] = useState(true)
  const search = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search) : null
  const initialTab = (search?.get('tab') || 'add')
  const initialInnerView = (search?.get('view') || '')
  const [tab, setTab] = useState(initialTab) // info | add | edit | fees

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try{
        const [meRes, clsRes] = await Promise.all([
          api.get('/auth/me/').catch(()=>({ data:null })),
          api.get('/academics/classes/mine/').catch(()=>({ data:[] })),
        ])
        if (!mounted) return
        const meId = String(meRes?.data?.id || user?.id || '')
        const classes = Array.isArray(clsRes?.data)? clsRes.data : []
        const mine = classes.find(c => {
          const candIds = [c?.teacher, c?.teacher_detail?.id, c?.teacher_detail?.user?.id].map(v=> (v==null? '' : String(v)))
          return candIds.includes(meId)
        })
        setMyClass(mine || null)
      }catch{ if(mounted) setMyClass(null) }
      finally{ if(mounted) setClassesLoading(false) }
    })()
    return () => { mounted = false }
  }, [user?.id])

  if (classesLoading) return <div className="p-4">Loading...</div>
  if (!myClass) return (
    <div className="p-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
        You are not assigned as a class teacher for any class.
      </div>
    </div>
  )

  return (
    <div className="px-0 md:px-0 max-w-full overflow-hidden">
      <div className="mb-3 px-4 md:px-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Manage My Class</h1>
          <div className="text-sm text-slate-600">{myClass?.name || 'Class'} · ID {myClass?.id}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 px-4 md:px-0 scrollbar-hide no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        <TabButton active={tab==='info'} onClick={()=>setTab('info')}>Class Info</TabButton>
        <TabButton active={tab==='add'} onClick={()=>setTab('add')}>Add Student</TabButton>
        <TabButton active={tab==='edit'} onClick={()=>setTab('edit')}>Edit Students</TabButton>
        <TabButton active={tab==='message'} onClick={()=>setTab('message')}>Message Students</TabButton>
        <TabButton active={tab==='fees'} onClick={()=>setTab('fees')}>Send Fees Notifications</TabButton>
        <TabButton active={tab==='reportcards'} onClick={()=>setTab('reportcards')}>Report Cards</TabButton>
      </div>
      <div className="w-full">
        {tab === 'info' && <ClassInfoPanel classId={myClass.id} initialInnerTab={initialInnerView} />}
        {tab === 'add' && <AddStudentPanel classId={myClass.id} />}
        {tab === 'edit' && <EditStudentsPanel classId={myClass.id} />}
        {tab === 'message' && <MessageStudentsPanel classId={myClass.id} />}
        {tab === 'fees' && <FeesNotifyPanel classId={myClass.id} />}
        {tab === 'reportcards' && <TeacherClassReportCardsPanel classId={myClass.id} />}
      </div>
    </div>
  )
}

function TeacherClassReportCardsPanel({ classId }){
  return (
    <div className="rounded-none sm:rounded-xl border-t border-b sm:border border-gray-200 bg-white p-0 shadow w-full">
      <AdminClassPrintReportCards classIdProp={classId} embedded={true} />
    </div>
  )
}

function TabButton({ active, onClick, children }){
  return (
    <button onClick={onClick} className={`${active? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'} border border-slate-200 px-3 py-1.5 rounded-lg text-sm shadow-sm whitespace-nowrap flex-shrink-0 transition-colors`}>
      {children}
    </button>
  )
}

function AddStudentPanel({ classId }){
  const [form, setForm] = useState({ admission_no:'', name:'', dob:'', gender:'' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const set = (k,v)=> setForm(prev => ({ ...prev, [k]: v }))

  const submit = async (e) => {
    e?.preventDefault?.()
    setSaving(true); setError(''); setDone(null)
    try{
      const payload = { ...form }
      if (!String(payload.dob || '').trim()) payload.dob = null
      const { data } = await api.post(`/academics/classes/${classId}/add-student/`, payload)
      setDone(data)
      setForm({ admission_no:'', name:'', dob:'', gender:'' })
    }catch(err){ setError(err?.response?.data?.detail || 'Failed to add student') }
    finally{ setSaving(false) }
  }

  return (
    <div className="rounded-none sm:rounded-xl border-t border-b sm:border border-gray-200 bg-white p-4 shadow w-full">
      <div className="font-medium mb-3">Add a new student to this class</div>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{String(error)}</div>}
      {done && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">Student added. ID {done?.id}</div>}
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Text label="Admission No" value={form.admission_no} onChange={v=>set('admission_no', v)} required />
        <Text label="Full Name" value={form.name} onChange={v=>set('name', v)} required />
        <Text label="Date of Birth (optional)" type="date" value={form.dob} onChange={v=>set('dob', v)} />
        <Select label="Gender" value={form.gender} onChange={v=>set('gender', v)} options={[{value:'male',label:'Male'},{value:'female',label:'Female'}]} required />
        <Text label="Guardian Phone" value={form.guardian_id||''} onChange={v=>set('guardian_id', v)} />
        <Text label="Guardian Name" value={form.guardian_name||''} onChange={v=>set('guardian_name', v)} />
        <Text label="Email" value={form.email||''} onChange={v=>set('email', v)} />
        <Text label="Address" value={form.address||''} onChange={v=>set('address', v)} />
        <div className="md:col-span-2 flex items-center gap-2">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{saving? 'Saving...' : 'Add Student'}</button>
        </div>
      </form>
    </div>
  )
}

function EditStudentsPanel({ classId }){
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try{
      const { data } = await api.get(`/academics/classes/${classId}/students/`)
      setList(Array.isArray(data)? data : [])
    }catch(err){ setError('Failed to load students') }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ load() }, [classId])

  const filtered = list.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      String(s.name||'').toLowerCase().includes(q) ||
      String(s.admission_no||'').toLowerCase().includes(q)
    )
  })

  return (
    <div className="rounded-none sm:rounded-xl border-t border-b sm:border border-gray-200 bg-white p-4 shadow w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="font-medium">Edit students (limited fields)</div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or ADM..."
              value={searchDraft}
              onChange={(e)=> setSearchDraft(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 w-56"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.35-4.65a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          </div>
          <button onClick={()=> setSearch(searchDraft)} className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white">Search</button>
          <button onClick={()=> { setSearch(''); setSearchDraft('') }} className="text-sm px-3 py-1.5 rounded border">Clear</button>
          <button onClick={load} className="text-sm px-3 py-1.5 rounded border">Refresh</button>
        </div>
      </div>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{String(error)}</div>}
      {loading ? <div>Loading...</div> : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Admission No</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Gender</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Guardian Phone</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No students found</td></tr>
              ) : filtered.map(s => (
                <React.Fragment key={s.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-sm text-slate-700">{s.admission_no}</td>
                    <td className="px-4 py-2 text-sm font-medium text-slate-900">
                      <Link to={`/teacher/students/${s.id}`} className="text-indigo-700 hover:underline">{s.name}</Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-700">{s.gender || '-'}</td>
                    <td className="px-4 py-2 text-sm text-slate-700">{s.guardian_id || '-'}</td>
                    <td className="px-4 py-2">
                      <button onClick={()=> setExpandedId(expandedId===s.id? null : s.id)} className="text-xs px-2.5 py-1.5 rounded border">{expandedId===s.id? 'Hide' : 'Edit'}</button>
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr>
                      <td colSpan="5" className="px-4 py-3 bg-gray-50">
                        <StudentEditForm student={s} onSaved={load} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StudentEditForm({ student, onSaved }){
  const [form, setForm] = useState({
    dob: student?.dob || '',
    gender: student?.gender || '',
    guardian_id: student?.guardian_id || '',
    guardian_name: student?.guardian_name || '',
    email: student?.email || '',
    address: student?.address || '',
    boarding_status: student?.boarding_status || 'day',
    is_active: student?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const set = (k,v)=> setForm(prev => ({ ...prev, [k]: v }))

  const submit = async (e) => {
    e?.preventDefault?.()
    setSaving(true); setMsg('')
    try{
      await api.patch(`/academics/students/${student.id}/teacher-update/`, form)
      setMsg('Saved')
      onSaved?.()
    }catch(err){ setMsg(err?.response?.data?.detail || 'Save failed') }
    finally{ setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Text label="Date of Birth" type="date" value={form.dob||''} onChange={v=>set('dob', v)} />
      <Select label="Gender" value={form.gender||''} onChange={v=>set('gender', v)} options={[{value:'male',label:'Male'},{value:'female',label:'Female'}]} />
      <Text label="Guardian Phone" value={form.guardian_id||''} onChange={v=>set('guardian_id', v)} />
      <Text label="Guardian Name" value={form.guardian_name||''} onChange={v=>set('guardian_name', v)} />
      <Text label="Email" value={form.email||''} onChange={v=>set('email', v)} />
      <Text label="Address" value={form.address||''} onChange={v=>set('address', v)} />
      <Select label="Boarding" value={form.boarding_status||'day'} onChange={v=>set('boarding_status', v)} options={[{value:'day',label:'Day'},{value:'boarding',label:'Boarding'}]} />
      <Select label="Active" value={String(form.is_active)} onChange={v=>set('is_active', v==='true')} options={[{value:'true',label:'Active'},{value:'false',label:'Inactive'}]} />
      <div className="md:col-span-3 flex items-center gap-2">
        <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 text-white">{saving? 'Saving...' : 'Save'}</button>
        {msg && <div className="text-sm text-slate-600">{msg}</div>}
      </div>
    </form>
  )
}

function MessageStudentsPanel({ classId }){
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')
  const [category, setCategory] = useState('all')
  const [channel, setChannel] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortMode, setSortMode] = useState('newest')
  const [selected, setSelected] = useState(() => new Set())
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [deleteDays, setDeleteDays] = useState('30')
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const loadLogs = async () => {
    setLogsLoading(true); setLogsError('')
    try{
      const { data } = await api.get(`/academics/classes/${classId}/message-logs/?limit=200`)
      setLogs(Array.isArray(data?.items) ? data.items : [])
    }catch(err){
      setLogs([])
      setLogsError(err?.response?.data?.detail || 'Failed to load logs')
    }finally{
      setLogsLoading(false)
    }
  }

  const deleteOldLogs = async () => {
    setDeleting(true)
    setDeleteMsg('')
    try{
      const days = parseInt(String(deleteDays || '').trim(), 10)
      const body = Number.isFinite(days) && days > 0 ? { days } : { days: 30 }
      const { data } = await api.post(`/academics/classes/${classId}/delete-old-logs/`, body)
      const n = Number(data?.deleted || 0)
      setDeleteMsg(`Deleted ${n} old log(s)`)
      loadLogs()
    }catch(err){
      setDeleteMsg(err?.response?.data?.detail || 'Delete failed')
    }finally{
      setDeleting(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [classId])

  const filteredLogs = useMemo(() => {
    return (logs || []).filter(it => {
      if (category !== 'all' && String(it?.category || '') !== category) return false
      if (channel !== 'all' && String(it?.channel || '') !== channel) return false
      if (statusFilter !== 'all'){
        const ok = Boolean(it?.ok)
        if (statusFilter === 'ok' && !ok) return false
        if (statusFilter === 'fail' && ok) return false
      }
      return true
    })
  }, [logs, category, channel, statusFilter])

  const sortedLogs = useMemo(() => {
    const arr = Array.isArray(filteredLogs) ? [...filteredLogs] : []
    const toTime = (x) => {
      try{
        return x?.created_at ? new Date(x.created_at).getTime() : 0
      }catch{ return 0 }
    }
    if (sortMode === 'oldest'){
      arr.sort((a,b) => toTime(a) - toTime(b))
      return arr
    }
    if (sortMode === 'failed_first'){
      arr.sort((a,b) => {
        const af = (a?.channel !== 'in_app') && (a?.ok === false)
        const bf = (b?.channel !== 'in_app') && (b?.ok === false)
        if (af !== bf) return af ? -1 : 1
        return toTime(b) - toTime(a)
      })
      return arr
    }
    arr.sort((a,b) => toTime(b) - toTime(a))
    return arr
  }, [filteredLogs, sortMode])

  const selectableIds = useMemo(() => {
    const ids = []
    for (const it of (sortedLogs || [])){
      const id = String(it?.id || '')
      const isDl = id.startsWith('dl:')
      const ch = String(it?.channel || '')
      const isFailed = (it?.ok === false)
      if (isDl && (ch === 'sms' || ch === 'email') && isFailed){
        ids.push(id)
      }
    }
    return ids
  }, [sortedLogs])

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisibleFailed = () => {
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = selectableIds.length > 0 && selectableIds.every(x => next.has(x))
      if (allSelected){
        selectableIds.forEach(x => next.delete(x))
      }else{
        selectableIds.forEach(x => next.add(x))
      }
      return next
    })
  }

  const resendSelected = async () => {
    const ids = Array.from(selected)
      .map(x => String(x).startsWith('dl:') ? String(x).slice(3) : '')
      .filter(Boolean)
    if (ids.length === 0) return
    setResending(true)
    setResendMsg('')
    try{
      const { data } = await api.post(`/academics/classes/${classId}/retry-delivery-logs/`, { ids })
      const results = Array.isArray(data?.results) ? data.results : []
      const okCount = results.filter(r => r?.ok).length
      setResendMsg(`Resent ${okCount}/${results.length}`)
      setSelected(new Set())
      loadLogs()
    }catch(err){
      setResendMsg(err?.response?.data?.detail || 'Resend failed')
    }finally{
      setResending(false)
    }
  }

  const submit = async (e) => {
    e?.preventDefault?.()
    setSending(true); setError(''); setResult(null)
    try{
      const body = { message: String(message || '').trim() }
      const { data } = await api.post(`/academics/classes/${classId}/message-students/`, body)
      setResult(data)
      setMessage('')
      loadLogs()
    }catch(err){
      setError(err?.response?.data?.detail || 'Failed to send message')
    }finally{
      setSending(false)
    }
  }

  return (
    <div className="rounded-none sm:rounded-xl border-t border-b sm:border border-gray-200 bg-white p-4 shadow w-full">
      <div className="font-medium mb-3">Message all students in this class</div>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{String(error)}</div>}
      {result && (
        <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
          Sent. In-app recipients: {result?.in_app_recipients || 0}. SMS OK: {result?.sms_ok || 0}/{result?.sms_attempts || 0}. Email OK: {result?.email_ok || 0}/{result?.email_attempts || 0}.
        </div>
      )}
      <form onSubmit={submit} className="grid grid-cols-1 gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Message *</span>
          <textarea
            value={message}
            onChange={(e)=>setMessage(e.target.value)}
            required
            rows={5}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Type your message to all students..."
          />
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={sending} className="px-4 py-2 rounded bg-blue-600 text-white">{sending? 'Sending...' : 'Send Message'}</button>
        </div>
      </form>

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="font-medium">Sent Messages Logs</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden text-sm px-3 py-1.5 rounded border bg-white flex items-center gap-1"
            >
              <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button type="button" onClick={loadLogs} className="text-sm px-3 py-1.5 rounded border bg-white">Refresh</button>
          </div>
        </div>

        <div className={`${showFilters ? 'flex' : 'hidden md:flex'} flex-col md:flex-row md:items-end gap-3 mb-3 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg border md:border-0`}>
          <div className="grid grid-cols-2 md:flex gap-2">
            <Select
              label="Category"
              value={category}
              onChange={setCategory}
              options={[{value:'all',label:'All'},{value:'class',label:'Class Messages'},{value:'fees',label:'Fees Notifications'}]}
            />
            <Select
              label="Channel"
              value={channel}
              onChange={setChannel}
              options={[{value:'all',label:'All'},{value:'in_app',label:'In-app'},{value:'sms',label:'SMS'},{value:'email',label:'Email'}]}
            />
          </div>
          <div className="grid grid-cols-2 md:flex gap-2">
            <Select
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{value:'all',label:'All'},{value:'ok',label:'OK'},{value:'fail',label:'Failed'}]}
            />
            <Select
              label="Sort"
              value={sortMode}
              onChange={setSortMode}
              options={[{value:'newest',label:'Newest first'},{value:'oldest',label:'Oldest first'},{value:'failed_first',label:'Failed first'}]}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="text-sm text-slate-600">
            Failed deliveries: {selectableIds.length}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={()=> { setStatusFilter('fail'); setSortMode('failed_first') }}
              className="text-sm px-3 py-1.5 rounded border bg-white flex-1 sm:flex-none"
            >
              Failed Only
            </button>
            <button
              type="button"
              disabled={resending || selected.size === 0}
              onClick={resendSelected}
              className={`${(resending || selected.size === 0) ? 'opacity-50 cursor-not-allowed' : ''} text-sm px-3 py-1.5 rounded bg-blue-600 text-white flex-1 sm:flex-none`}
            >
              {resending ? '...' : `Resend (${selected.size})`}
            </button>
          </div>
          <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 w-full sm:w-auto">
            <label className="flex-1 grid text-xs">
              <span className="text-slate-600 mb-1">Clean logs older than (days)</span>
              <input type="number" min="1" value={deleteDays} onChange={e=>setDeleteDays(e.target.value)} className="px-2 py-1.5 border rounded w-full bg-white" />
            </label>
            <button type="button" disabled={deleting} onClick={deleteOldLogs} className={`${deleting? 'opacity-50 cursor-not-allowed':''} text-sm px-3 py-1.5 rounded border bg-white h-[34px]`}>{deleting? '...' : 'Delete'}</button>
          </div>
        </div>

        {(resendMsg || deleteMsg) && <div className="mb-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-2">{String(resendMsg || deleteMsg)}</div>}

        {logsError && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{String(logsError)}</div>}
        {logsLoading ? (
          <div className="text-sm text-slate-600">Loading logs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      onChange={toggleAllVisibleFailed}
                      checked={selectableIds.length > 0 && selectableIds.every(x => selected.has(x))}
                      disabled={selectableIds.length === 0}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">When</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Channel</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipient</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Message</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sender</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedLogs.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-500">No logs found</td></tr>
                ) : sortedLogs.map(it => {
                  const when = it?.created_at ? new Date(it.created_at).toLocaleString() : '-'
                  const ok = Boolean(it?.ok)
                  const statusText = (String(it?.channel || '') === 'in_app') ? 'OK' : (ok ? 'OK' : 'FAILED')
                  const id = String(it?.id || '')
                  const isDl = id.startsWith('dl:')
                  const ch = String(it?.channel || '')
                  const canSelect = isDl && (ch === 'sms' || ch === 'email') && (it?.ok === false)
                  return (
                    <tr key={it.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { if (canSelect) toggleOne(id) }}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          disabled={!canSelect}
                          checked={canSelect && selected.has(id)}
                          onChange={(e)=> { e.stopPropagation(); toggleOne(id) }}
                        />
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{when}</td>
                      <td className="px-4 py-2 text-sm text-slate-700 capitalize">{String(it?.category || '-')}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{String(it?.channel || '-')}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`${statusText==='OK'? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'} text-xs px-2 py-1 rounded border`}>{statusText}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">{String(it?.recipient || 'students')}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 max-w-[520px]">
                        <div className="line-clamp-2">{String(it?.message || '')}</div>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">{String(it?.sender || '-')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function FeesNotifyPanel({ classId }){
  const [channel, setChannel] = useState('sms')
  const [minBalance, setMinBalance] = useState('0')
  const [includeZero, setIncludeZero] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [balances, setBalances] = useState({ items: [], total_balance: 0, count: 0 })
  const [statuses, setStatuses] = useState({}) // { [student_id]: { sms: {ok, created_at} | null, email: {ok, created_at} | null } }

  const loadBalances = async () => {
    try{
      const params = new URLSearchParams()
      if (!includeZero) params.set('include_zero','false')
      if (minBalance && parseFloat(minBalance||'0')>0) params.set('min_balance', String(minBalance))
      const { data } = await api.get(`/academics/classes/${classId}/fees-balances/?${params.toString()}`)
      setBalances({
        items: Array.isArray(data?.items)? data.items : [],
        total_balance: data?.total_balance || 0,
        count: data?.count || 0,
      })
    }catch(e){ /* silent */ }
  }

  const loadStatuses = async () => {
    try{
      const { data } = await api.get(`/academics/classes/${classId}/fees-status/`)
      const map = {}
      for (const it of (data?.items||[])){
        map[String(it.student_id)] = {
          sms: it.sms || null,
          email: it.email || null,
        }
      }
      setStatuses(map)
    }catch(e){ setStatuses({}) }
  }

  useEffect(()=>{ loadBalances(); loadStatuses() }, [classId])

  const submit = async (e) => {
    e?.preventDefault?.()
    setSending(true); setError(''); setResult(null)
    try{
      const body = { channel, min_balance: parseFloat(minBalance||'0'), include_zero: includeZero }
      const { data } = await api.post(`/academics/classes/${classId}/share-fees/`, body)
      setResult(data)
      loadBalances();
      // Give a short delay for DeliveryLog entries to persist then refresh statuses
      setTimeout(() => { loadStatuses() }, 600)
    }catch(err){ setError(err?.response?.data?.detail || 'Failed to send notifications') }
    finally{ setSending(false) }
  }

  return (
    <div className="rounded-none sm:rounded-xl border-t border-b sm:border border-gray-200 bg-white p-4 shadow w-full">
      <div className="font-medium mb-3">Send fees notifications to this class</div>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{String(error)}</div>}
      {result && (
        <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
          Sent: {result.students_notified || 0}, SMS attempts: {result.sms_sent_attempts || 0}, Email attempts: {result.email_sent_attempts || 0}
        </div>
      )}
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select label="Channel" value={channel} onChange={setChannel} options={[{value:'sms',label:'SMS only'},{value:'both',label:'SMS + Email'}]} />
        <Text label="Min Balance" type="number" value={minBalance} onChange={setMinBalance} />
        <Checkbox label="Include zero/negative balances" checked={includeZero} onChange={setIncludeZero} />
        <div className="md:col-span-3">
          <button type="submit" disabled={sending} className="px-4 py-2 rounded bg-blue-600 text-white">{sending? 'Sending...' : 'Send Notifications'}</button>
          <button type="button" onClick={loadBalances} className="ml-2 px-3 py-2 rounded border">Refresh List</button>
        </div>
      </form>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-slate-700">Students with balances: <span className="font-medium">{balances.count}</span>. Total: <span className="font-semibold">{Number(balances.total_balance||0).toFixed(2)}</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Admission No</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Billed</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Paid</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Balance</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Guardian Phone</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SMS Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {(balances.items||[]).length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-500">No students with balances under current filters.</td></tr>
              ) : (balances.items||[]).map(row => (
                <tr key={row.student?.id}>
                  <td className="px-4 py-2 font-mono text-sm text-slate-700">{row.student?.admission_no}</td>
                  <td className="px-4 py-2 text-sm font-medium text-slate-900">{row.student?.name}</td>
                  <td className="px-4 py-2 text-sm">{Number(row.total_billed||0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm">{Number(row.total_paid||0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm font-semibold text-rose-700">{Number(row.balance||0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm">{row.guardian_phone || '-'}</td>
                  <td className="px-4 py-2 text-sm">{
                    renderStatusCell({
                      status: statuses[String(row.student?.id)]?.sms,
                      onResend: async () => {
                        try{
                          await api.post(`/academics/classes/${classId}/fees-resend/`, { student_id: row.student?.id, channel: 'sms' })
                        }catch{}
                        setTimeout(() => { /* refresh statuses after log write */ loadStatuses() }, 500)
                      }
                    })
                  }</td>
                  <td className="px-4 py-2 text-sm">{
                    renderStatusCell({
                      status: statuses[String(row.student?.id)]?.email,
                      onResend: async () => {
                        try{
                          await api.post(`/academics/classes/${classId}/fees-resend/`, { student_id: row.student?.id, channel: 'email' })
                        }catch{}
                        setTimeout(() => { loadStatuses() }, 500)
                      }
                    })
                  }</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Text({ label, value, onChange, type='text', required }){
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-700">{label}{required? ' *':''}</span>
      <input type={type} value={value||''} onChange={e=>onChange(e.target.value)} required={required}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
    </label>
  )
}

function Select({ label, value, onChange, options=[], required }){
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-700">{label}{required? ' *':''}</span>
      <select value={value||''} onChange={e=>onChange(e.target.value)} required={required}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200">
        <option value="">-- Select --</option>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  )
}

function Checkbox({ label, checked, onChange }){
  return (
    <label className="inline-flex items-center gap-2 text-sm mt-2">
      <input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)} />
      <span className="text-slate-700">{label}</span>
    </label>
  )
}

function renderStatusCell({ status, onResend }){
  if (!status) return <span className="text-slate-400">-</span>
  const ok = !!status.ok
  const dt = status.created_at ? new Date(status.created_at) : null
  const time = dt? dt.toLocaleString() : ''
  return (
    <span className={ok? 'text-emerald-700' : 'text-rose-700'}>
      {ok? 'Sent' : 'Failed'}{time? ` · ${time}` : ''}
      {!ok && (
        <button onClick={onResend} className="ml-2 inline-flex items-center px-2 py-0.5 text-xs rounded border border-rose-300 text-rose-700 hover:bg-rose-50">
          Resend
        </button>
      )}
    </span>
  )
}

function ClassInfoPanel({ classId, initialInnerTab }){
  const [klass, setKlass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showIn, setShowIn] = useState(false)
  const [showOut, setShowOut] = useState(false)
  const subjectAssignments = useMemo(() => {
    const map = {}
    for (const a of (klass?.subject_teachers || [])) {
      map[String(a.subject)] = a
    }
    return map
  }, [klass])
  const [innerTab, setInnerTab] = useState(initialInnerTab === 'results' ? 'results' : 'info')
  const [exams, setExams] = useState([])
  const [recentExam, setRecentExam] = useState(null)
  const [recentSummary, setRecentSummary] = useState({ subjects: [], students: [] })
  const [loadingResults, setLoadingResults] = useState(false)
  // Compare other stream
  const [showCompare, setShowCompare] = useState(false)
  const [sameGradeClasses, setSameGradeClasses] = useState([])
  const [compareClassId, setCompareClassId] = useState('')
  const [compareExam, setCompareExam] = useState(null)
  const [compareSummary, setCompareSummary] = useState({ subjects: [], students: [] })
  const [loadingCompare, setLoadingCompare] = useState(false)
  const resultsTableRef = useRef(null)
  const [shareChannel, setShareChannel] = useState('sms')
  // Roster map for resolving names in delivery logs even if summary is empty
  const [studentsMap, setStudentsMap] = useState({})
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState('')
  const [includeBreakdown, setIncludeBreakdown] = useState(true)
  const [includePositions, setIncludePositions] = useState(true)
  const [resultsTotals, setResultsTotals] = useState({ sms:{sent:0,failed:0}, email:{sent:0,failed:0} })
  const [resultsStatusItems, setResultsStatusItems] = useState([])
  const [showResultsLog, setShowResultsLog] = useState(false)
  const [classExams, setClassExams] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try{
        setLoading(true); setError('')
        const { data } = await api.get(`/academics/classes/${classId}/`)
        if (!cancelled) setKlass(data)
      }catch(e){ if(!cancelled) setError('Failed to load class info') }
      finally{ if(!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [classId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try{
        setLoadingHistory(true)
        const { data } = await api.get(`/academics/classes/${classId}/history/`)
        if (!cancelled) setHistory(data)
      }catch{ if(!cancelled) setHistory(null) }
      finally{ if(!cancelled) setLoadingHistory(false) }
    })()
    return () => { cancelled = true }
  }, [classId])

  // Load exams for this class and pick latest when Results tab is opened
  useEffect(() => {
    if (innerTab !== 'results') return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/academics/exams/', { params: { include_history: true } })
        if (cancelled) return
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
        setExams(arr)
        const cid = Number(classId)
        const isPublished = (e) => !!(e?.published || e?.is_published || String(e?.status||'').toLowerCase()==='published')
        const forClass = arr.filter(e => Number(e.klass) === cid && isPublished(e))
        if (!forClass.length) { setClassExams([]); setRecentExam(null); return }
        forClass.sort((a,b)=>{
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          if (db !== da) return db - da
          return (b.id||0) - (a.id||0)
        })
        setClassExams(forClass)
        setRecentExam(forClass[0])
      } catch {
        if (!cancelled) { setExams([]); setRecentExam(null) }
      }
    })()
    return ()=>{ cancelled = true }
  }, [classId, innerTab])

  // Load summary for the selected recent exam
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!recentExam?.id) { setRecentSummary({ subjects: [], students: [] }); return }
      try {
        setLoadingResults(true)
        const { data } = await api.get(`/academics/exams/${recentExam.id}/summary/`)
        if (!cancelled) setRecentSummary(data)
      } catch {
        if (!cancelled) setRecentSummary({ subjects: [], students: [] })
      } finally {
        if (!cancelled) setLoadingResults(false)
      }
    })()
    return ()=>{ cancelled = true }
  }, [recentExam])

  // Load results delivery status (sent vs failed) for current exam
  const loadResultsStatus = async () => {
    if (!recentExam?.id) { setResultsTotals({ sms:{sent:0,failed:0}, email:{sent:0,failed:0} }); setResultsStatusItems([]); return }
    try{
      const { data } = await api.get(`/academics/classes/${classId}/results-status/`, { params: { exam: recentExam.id } })
      const totals = data?.totals || { sms:{sent:0,failed:0}, email:{sent:0,failed:0} }
      setResultsTotals({
        sms: { sent: Number(totals?.sms?.sent||0), failed: Number(totals?.sms?.failed||0) },
        email: { sent: Number(totals?.email?.sent||0), failed: Number(totals?.email?.failed||0) },
      })
      setResultsStatusItems(Array.isArray(data?.items)? data.items : [])
    }catch{
      setResultsTotals({ sms:{sent:0,failed:0}, email:{sent:0,failed:0} })
      setResultsStatusItems([])
    }
  }

  useEffect(() => { if (innerTab==='results') loadResultsStatus() }, [innerTab, recentExam?.id])

  // Load class roster when viewing Results so we can map student_id -> name for logs
  useEffect(() => {
    if (innerTab !== 'results') return
    let cancelled = false
    ;(async () => {
      try{
        const { data } = await api.get(`/academics/classes/${classId}/students/`)
        if (cancelled) return
        const arr = Array.isArray(data)? data : []
        const map = {}
        for (const s of arr){ map[String(s.id)] = { name: s.name, admission_no: s.admission_no } }
        setStudentsMap(map)
      }catch{ setStudentsMap({}) }
    })()
    return ()=>{ cancelled = true }
  }, [classId, innerTab])

  // Load classes in same grade for compare (when toggled open)
  useEffect(() => {
    if (!showCompare) return
    let cancelled = false
    ;(async () => {
      try{
        const { data } = await api.get('/academics/classes/')
        if (cancelled) return
        const arr = Array.isArray(data)? data : (Array.isArray(data?.results)? data.results : [])
        const grade = String(klass?.grade_level || '')
        const currentId = String(klass?.id || '')
        const filtered = arr.filter(c => String(c.grade_level||'') === grade && String(c.id) !== currentId)
        setSameGradeClasses(filtered)
        if (filtered.length && !compareClassId){ setCompareClassId(String(filtered[0].id)) }
      }catch{ setSameGradeClasses([]) }
    })()
    return ()=>{ cancelled = true }
  }, [showCompare, klass, compareClassId])

  // Load other stream latest exam + summary when a class is selected
  useEffect(() => {
    if (!showCompare || !compareClassId) return
    let cancelled = false
    ;(async () => {
      try{
        setLoadingCompare(true)
        const exRes = await api.get('/academics/exams/', { params: { include_history: true } })
        if (cancelled) return
        const arr = Array.isArray(exRes.data) ? exRes.data : (Array.isArray(exRes.data?.results) ? exRes.data.results : [])
        const forClass = arr.filter(e => String(e.klass) === String(compareClassId))
        if (!forClass.length){ setCompareExam(null); setCompareSummary({subjects:[], students:[]}); setLoadingCompare(false); return }
        forClass.sort((a,b)=>{
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          if (db !== da) return db - da
          return (b.id||0) - (a.id||0)
        })
        const latest = forClass[0]
        setCompareExam(latest)
        try{
          const sumRes = await api.get(`/academics/exams/${latest.id}/summary/`)
          if (!cancelled) setCompareSummary(sumRes.data)
        }catch{ if(!cancelled) setCompareSummary({subjects:[], students:[]}) }
      }catch{ if(!cancelled){ setCompareExam(null); setCompareSummary({subjects:[], students:[]}) } }
      finally{ if(!cancelled) setLoadingCompare(false) }
    })()
    return ()=>{ cancelled = true }
  }, [showCompare, compareClassId])

  return (
    <div className="rounded-none sm:rounded-xl border-t border-b sm:border border-gray-200 bg-white p-4 shadow w-full">
      <div className="flex items-center gap-2 mb-3">
        <button
          className={`px-3 py-1.5 rounded ${innerTab==='info' ? 'bg-blue-600 text-white' : 'bg-white border manage-toggle'} text-sm`}
          onClick={()=>setInnerTab('info')}
        >Class Information</button>
        <button
          className={`px-3 py-1.5 rounded ${innerTab==='results' ? 'bg-blue-600 text-white' : 'bg-white border manage-toggle'} text-sm`}
          onClick={()=>setInnerTab('results')}
        >Results</button>
      </div>
      {loading && <div>Loading…</div>}
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
      {!loading && !error && innerTab==='info' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 px-4 md:px-0">
            <InfoCard label="Grade" value={klass?.grade_level || '-'} color="indigo" icon="school" />
            <InfoCard label="Stream" value={klass?.stream_detail?.name || '-'} color="emerald" icon="layers" />
            <InfoCard label="Class Teacher" value={(klass?.teacher_detail ? `${klass.teacher_detail.first_name} ${klass.teacher_detail.last_name}` : '—')} color="fuchsia" icon="user" />
          </div>

          <div className="p-3 rounded-none sm:rounded-xl border-t border-b sm:border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-800">Class History</div>
              {loadingHistory && <div className="text-xs text-gray-500">Loading…</div>}
            </div>
            {!history ? (
              <div className="text-sm text-gray-500">No history yet.</div>
            ) : (
              <div className="grid md:grid-cols-3 gap-3">
                <div className="md:col-span-2 grid md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-indigo-200 overflow-hidden bg-white">
                    <button 
                      onClick={() => setShowIn(!showIn)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium bg-indigo-50 border-b border-indigo-100 hover:bg-indigo-100 transition-colors"
                    >
                      <span>Students In</span>
                      <svg className={`w-4 h-4 transition-transform ${showIn ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showIn && (
                      <div className="max-h-64 overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-indigo-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Student</th>
                              <th className="px-3 py-2 text-left">From</th>
                              <th className="px-3 py-2 text-left">When</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(history.students_in||[]).length === 0 ? (
                              <tr><td className="px-3 py-3 text-gray-500" colSpan={3}>No entries.</td></tr>
                            ) : (
                              (history.students_in||[]).slice(0,20).map((h, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-indigo-50/50'}>
                                  <td className="px-3 py-2 border-t">{h.student_name}</td>
                                  <td className="px-3 py-2 border-t">{h.from || '-'}</td>
                                  <td className="px-3 py-2 border-t">{h.year ? `${h.year}-T${h.term||'-'}` : (h.created_at || '').slice(0,10)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-amber-200 overflow-hidden bg-white">
                    <button 
                      onClick={() => setShowOut(!showOut)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium bg-amber-50 border-b border-amber-100 hover:bg-amber-100 transition-colors"
                    >
                      <span>Students Out</span>
                      <svg className={`w-4 h-4 transition-transform ${showOut ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showOut && (
                      <div className="max-h-64 overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-amber-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Student</th>
                              <th className="px-3 py-2 text-left">To</th>
                              <th className="px-3 py-2 text-left">When</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(history.students_out||[]).length === 0 ? (
                              <tr><td className="px-3 py-3 text-gray-500" colSpan={3}>No entries.</td></tr>
                            ) : (
                              (history.students_out||[]).slice(0,20).map((h, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'}>
                                  <td className="px-3 py-2 border-t">{h.student_name}</td>
                                  <td className="px-3 py-2 border-t">{h.to || '-'}</td>
                                  <td className="px-3 py-2 border-t">{h.year ? `${h.year}-T${h.term||'-'}` : (h.created_at || '').slice(0,10)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border bg-white">
                  <div className="px-3 py-2 text-sm font-medium bg-gray-50 border-b">Summary</div>
                  <div className="p-3 text-sm text-gray-700 space-y-1">
                    <div>Total events: <span className="font-medium">{history?.summary?.total_events ?? 0}</span></div>
                    <div>Promoted: <span className="font-medium">{history?.summary?.promoted ?? 0}</span></div>
                    <div>Assigned: <span className="font-medium">{history?.summary?.assigned ?? 0}</span></div>
                    <div>Moved: <span className="font-medium">{history?.summary?.moved ?? 0}</span></div>
                    <div>Graduated: <span className="font-medium">{history?.summary?.graduated ?? 0}</span></div>
                    <div>Unassigned: <span className="font-medium">{history?.summary?.unassigned ?? 0}</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-none sm:rounded-xl border-t border-b sm:border border-gray-200 bg-white">
            <div className="px-3 py-2 text-sm font-semibold text-gray-800 border-b bg-gray-50">Subject Teachers</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Subject</th>
                    <th className="px-3 py-2 text-left">Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(klass?.subjects) && klass.subjects.length > 0 ? (
                    klass.subjects.map((s, idx) => {
                      const a = subjectAssignments[String(s.id)]
                      const t = a?.teacher_detail
                      const name = t ? `${t.first_name} ${t.last_name}` : '—'
                      return (
                        <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 border-t font-mono text-xs">{s.code}</td>
                          <td className="px-3 py-2 border-t">{s.name}</td>
                          <td className="px-3 py-2 border-t">{name}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr><td className="px-3 py-3 text-gray-500" colSpan={3}>No subjects assigned.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {!loading && !error && innerTab==='results' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-gray-700">
            {recentExam ? (
              <>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Exam</span>
                  <select
                    className="border rounded px-2 py-1 text-xs bg-white"
                    value={String(recentExam.id)}
                    onChange={e=>{
                      const id = e.target.value
                      const found = classExams.find(ex => String(ex.id)===id)
                      if (found) setRecentExam(found)
                    }}
                  >
                    {classExams.length === 0 ? (
                      <option value={String(recentExam.id)}>{recentExam.name}</option>
                    ) : classExams.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name} — {ex.year} — T{ex.term}</option>
                    ))}
                  </select>
                </label>
                <div className="px-2.5 py-1 rounded border bg-gray-50">Year: <span className="font-medium ml-1">{recentExam.year}</span></div>
                <div className="px-2.5 py-1 rounded border bg-gray-50">Term: <span className="font-medium ml-1">T{recentExam.term}</span></div>
                <div className="px-2.5 py-1 rounded border bg-gray-50">Date: <span className="font-medium ml-1">{recentExam.date || '-'}</span></div>
                <button
                  type="button"
                  onClick={() => {
                    try{
                      const published = !!(recentExam?.published || String(recentExam?.status||'').toLowerCase()==='published')
                      if (!published){
                        alert('Only published results can be printed. Please ask the admin to publish this exam first.')
                        return
                      }
                      const html = resultsTableRef.current?.outerHTML || ''
                      const w = window.open('', '_blank')
                      if (w){
                        const ts = new Date().toLocaleString()
                        const title = `${recentExam?.name||'Results'} - ${klass?.name||''}`
                        w.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}h1{font-size:16px;margin:0 0 8px}h2{font-size:13px;margin:0 0 12px;color:#475569}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;font-size:12px}th{background:#f8fafc;text-align:left}</style></head><body><h1>${title}</h1><h2>Year ${recentExam?.year||''} · Term ${recentExam?.term||''} · Date ${recentExam?.date||''} · Printed ${ts}</h2>${html}</body></html>`)
                        w.document.close()
                        w.focus()
                        w.print()
                        w.close()
                      }
                    }catch{}
                  }}
                  className="ml-2 px-2.5 py-1 rounded border text-xs bg-white hover:bg-gray-50"
                >Print Results</button>
                <select
                  className="border rounded px-2 py-1 text-xs bg-white"
                  value={shareChannel}
                  onChange={e=>setShareChannel(e.target.value)}
                >
                  <option value="sms">Share: SMS only</option>
                  <option value="both">Share: SMS + Email</option>
                </select>
                <label className="inline-flex items-center gap-1 text-xs ml-1">
                  <input type="checkbox" checked={includeBreakdown} onChange={e=>setIncludeBreakdown(e.target.checked)} />
                  <span>Include subject marks</span>
                </label>
                <label className="inline-flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={includePositions} onChange={e=>setIncludePositions(e.target.checked)} />
                  <span>Include positions</span>
                </label>
                <button
                  type="button"
                  disabled={sharing}
                  onClick={async () => {
                    setSharing(true); setShareMsg('')
                    try{
                      const payload = {
                        exam_id: recentExam?.id,
                        channel: shareChannel,
                        // backend may ignore unknown flags safely
                        include_subject_breakdown: includeBreakdown,
                        include_positions: includePositions ? 'class_and_grade' : false,
                      }
                      const { data } = await api.post(`/academics/classes/${classId}/share-results/`, payload)
                      setShareMsg(`Queued: SMS ${data?.sms_sent_attempts||0}, Email ${data?.email_sent_attempts||0}`)
                      // Refresh delivery status shortly after queueing
                      setTimeout(() => { loadResultsStatus() }, 700)
                    }catch(err){ setShareMsg(err?.response?.data?.detail || 'Failed to share') }
                    finally{ setSharing(false) }
                  }}
                  className={`px-2.5 py-1 rounded text-xs ${sharing? 'bg-gray-100 border' : 'bg-blue-600 text-white'}`}
                >{sharing? 'Sharing…' : 'Share Results'}</button>
                {shareMsg && <span className="text-xs text-slate-600">{shareMsg}</span>}
                <span className="ml-2 text-xs text-slate-700 border rounded px-2 py-1 bg-white">
                  SMS: <span className="text-emerald-700">Sent {resultsTotals.sms.sent}</span> · <span className="text-rose-700">Failed {resultsTotals.sms.failed}</span>
                </span>
                <span className="text-xs text-slate-700 border rounded px-2 py-1 bg-white">
                  Email: <span className="text-emerald-700">Sent {resultsTotals.email.sent}</span> · <span className="text-rose-700">Failed {resultsTotals.email.failed}</span>
                </span>
                <button type="button" onClick={() => loadResultsStatus()} className="text-xs underline">Refresh</button>
                <button type="button" onClick={()=> setShowResultsLog(v=>!v)} className="text-xs underline">{showResultsLog? 'Hide Logs' : 'View Logs'}</button>
                <button
                  type="button"
                  onClick={()=>setShowCompare(v=>!v)}
                  className="ml-2 px-2.5 py-1 rounded border text-xs bg-white hover:bg-gray-50"
                >{showCompare? 'Hide Compare' : 'Compare Other Stream'}</button>
              </>
            ) : (
              <div className="text-sm text-gray-500">No exams found for this class.</div>
            )}
          </div>
          {loadingResults ? (
            <div className="text-sm text-gray-500">Loading results...</div>
          ) : recentExam && !showCompare && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table ref={resultsTableRef} className="min-w-full text-xs md:text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="border px-2 py-1 text-left whitespace-nowrap sticky left-0 bg-gray-50">Student</th>
                    {recentSummary.subjects.map(s => (
                      <th key={s.id} className="border px-2 py-1 text-center whitespace-nowrap">{s.code}</th>
                    ))}
                    <th className="border px-2 py-1 text-right whitespace-nowrap">Total</th>
                    <th className="border px-2 py-1 text-right whitespace-nowrap">Mean</th>
                    <th className="border px-2 py-1 text-right whitespace-nowrap">Position</th>
                    <th className="border px-2 py-1 text-right whitespace-nowrap">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSummary.students.length === 0 ? (
                    <tr><td className="px-2 py-3 text-sm text-gray-500" colSpan={(recentSummary.subjects?.length||0)+5}>No results captured for this exam yet.</td></tr>
                  ) : (
                    recentSummary.students.map(st => (
                      <tr key={st.id} className="hover:bg-gray-50">
                        <td className="border px-2 py-1 sticky left-0 bg-white">{st.name}</td>
                        {recentSummary.subjects.map(s => (
                          <td key={s.id} className="border px-2 py-1 text-center">{st.marks?.[String(s.id)] ?? '-'}</td>
                        ))}
                        <td className="border px-2 py-1 font-medium text-right">{st.total}</td>
                        <td className="border px-2 py-1 text-right">{formatMean(computeStudentMean(st, (recentSummary.subjects||[]).length))}</td>
                        <td className="border px-2 py-1 text-right">{resolvePosition(st, recentSummary.students)}</td>
                        <td className="border px-2 py-1 text-right">{resolveGrade(st)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {showResultsLog && (
                <div className="p-3 border-t bg-gray-50">
                  <div className="text-xs font-medium text-gray-700 mb-2">Delivery Logs (latest status per student)</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="border px-2 py-1 text-left">Student</th>
                          <th className="border px-2 py-1 text-left">SMS</th>
                          <th className="border px-2 py-1 text-left">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(resultsStatusItems||[]).length === 0 ? (
                          <tr><td className="px-2 py-2 text-gray-500" colSpan={3}>No delivery entries yet.</td></tr>
                        ) : (
                          (resultsStatusItems||[]).map((it,i) => {
                            const st = (recentSummary?.students||[]).find(s => String(s.id)===String(it.student_id))
                            const roster = studentsMap[String(it.student_id)]
                            const label = st?.name || roster?.name || `#${it.student_id}`
                            const cell = (obj) => (!obj ? '-' : (obj.ok ? `Sent · ${new Date(obj.created_at).toLocaleString()}` : `Failed · ${new Date(obj.created_at).toLocaleString()}`))
                            return (
                              <tr key={`${it.student_id}-${i}`} className={i%2===0? 'bg-white' : 'bg-gray-50'}>
                                <td className="border px-2 py-1">{label}</td>
                                <td className="border px-2 py-1"><span className={it.sms?.ok? 'text-emerald-700' : 'text-rose-700'}>{cell(it.sms)}</span></td>
                                <td className="border px-2 py-1"><span className={it.email?.ok? 'text-emerald-700' : 'text-rose-700'}>{cell(it.email)}</span></td>
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
          )}
          {showCompare && (
            <div className="mt-4 rounded-lg border border-indigo-200">
              <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center gap-2 text-sm">
                <div className="font-medium text-indigo-800">Compare with other stream</div>
                <select
                  className="border rounded px-2 py-1 text-xs bg-white"
                  value={compareClassId}
                  onChange={e=>setCompareClassId(e.target.value)}
                >
                  {sameGradeClasses.length === 0 ? <option value="">No other streams</option> : sameGradeClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {loadingCompare && <span className="text-xs text-gray-600">Loading…</span>}
              </div>
              <div className="p-3 overflow-x-auto">
                {!compareExam ? (
                  <div className="text-sm text-gray-500">No recent exam found for selected class.</div>
                ) : (
                  (() => {
                    const combined = buildCombinedList(
                      recentSummary?.students || [],
                      compareSummary?.students || [],
                      klass?.name || 'Class A',
                      (sameGradeClasses.find(c=> String(c.id)===String(compareClassId))?.name) || 'Other Stream'
                    )
                    const means = computeCompareMeans(
                      recentSummary?.students || [],
                      recentSummary?.subjects?.length || 0,
                      compareSummary?.students || [],
                      compareSummary?.subjects?.length || 0
                    )
                    return (
                      <table className="min-w-full text-xs md:text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="border px-2 py-1 text-left whitespace-nowrap">Student</th>
                            <th className="border px-2 py-1 text-left whitespace-nowrap">Class</th>
                            <th className="border px-2 py-1 text-right whitespace-nowrap">Total</th>
                            <th className="border px-2 py-1 text-right whitespace-nowrap">Position</th>
                            <th className="border px-2 py-1 text-right whitespace-nowrap">Grade</th>
                            <th className="border px-2 py-1 text-right whitespace-nowrap">Mean</th>
                            <th className="border px-2 py-1 text-right whitespace-nowrap">Mean (This Class)</th>
                            <th className="border px-2 py-1 text-right whitespace-nowrap">Mean (Other Class)</th>
                            <th className="border px-2 py-1 text-right whitespace-nowrap">Mean (Combined)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combined.length === 0 ? (
                            <tr><td className="px-2 py-3 text-sm text-gray-500" colSpan={9}>No results to compare.</td></tr>
                          ) : (
                            combined.map((r,i) => (
                              <tr key={`${r.source}-${r.id}-${i}`} className="hover:bg-gray-50">
                                <td className="border px-2 py-1">{r.name}</td>
                                <td className="border px-2 py-1">{r.class_name}</td>
                                <td className="border px-2 py-1 text-right">{r.total}</td>
                                <td className="border px-2 py-1 text-right">{r.position}</td>
                                <td className="border px-2 py-1 text-right">{r.grade}</td>
                                <td className="border px-2 py-1 text-right">{
                                  (()=>{
                                    const subjCount = r.source === 'A' ? (recentSummary?.subjects?.length||0) : (compareSummary?.subjects?.length||0)
                                    return formatMean(computeStudentMean(r._ref, subjCount))
                                  })()
                                }</td>
                                <td className="border px-2 py-1 text-right">{formatMean(means.classA)}</td>
                                <td className="border px-2 py-1 text-right">{formatMean(means.classB)}</td>
                                <td className="border px-2 py-1 text-right">{formatMean(means.combined)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )
                  })()
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function resolvePosition(st, students){
  if (st && (st.position || st.pos || st.rank)) return st.position || st.pos || st.rank
  // Derive position by total if not provided
  try{
    const arr = Array.isArray(students) ? [...students] : []
    arr.sort((a,b)=> (Number(b.total||0) - Number(a.total||0)))
    let lastTotal = null
    let pos = 0
    for (let i=0;i<arr.length;i++){
      const t = Number(arr[i].total||0)
      if (lastTotal === null || t < lastTotal){ pos = i+1; lastTotal = t }
      if (arr[i].id === st.id) return pos
    }
  }catch{}
  return '-'
}

function resolveGrade(st){
  // Prefer server-provided grade if available
  if (st && (st.grade || st.Grade)) return st.grade || st.Grade
  // Fallback: derive from average if present but do not assume school's exact bands; show '-' if unknown
  if (typeof st?.average === 'number'){
    const a = Number(st.average)
    // Conservative generic bands; adjust only if server provides grade
    if (a >= 80) return 'A'
    if (a >= 70) return 'B'
    if (a >= 60) return 'C'
    if (a >= 50) return 'D'
    return 'E'
  }
  return '-'
}

function computeStudentMean(st, subjectsCount){
  if (typeof st?.average === 'number') return Number(st.average)
  const t = Number(st?.total || 0)
  const n = Number(subjectsCount || 0)
  return n > 0 ? (t / n) : NaN
}

function formatMean(v){
  return (typeof v === 'number' && !isNaN(v)) ? Number(v).toFixed(1) : '-'
}

function computeCompareMeans(studentsA, subjectsA, studentsB, subjectsB){
  const meanOf = (arr, subjCount) => {
    const vals = (Array.isArray(arr) ? arr : []).map(s => computeStudentMean(s, subjCount)).filter(v => !isNaN(v))
    if (!vals.length) return NaN
    const sum = vals.reduce((a,b)=>a+b, 0)
    return sum / vals.length
  }
  const mA = meanOf(studentsA, subjectsA)
  const mB = meanOf(studentsB, subjectsB)
  let mC = NaN
  const nA = (Array.isArray(studentsA) ? studentsA : []).filter(s => !isNaN(computeStudentMean(s, subjectsA))).length
  const nB = (Array.isArray(studentsB) ? studentsB : []).filter(s => !isNaN(computeStudentMean(s, subjectsB))).length
  if (!isNaN(mA) && !isNaN(mB)){
    mC = (mA * nA + mB * nB) / Math.max(1, (nA + nB))
  } else if (!isNaN(mA)) {
    mC = mA
  } else if (!isNaN(mB)) {
    mC = mB
  }
  return { classA: mA, classB: mB, combined: mC }
}

function buildCombinedList(currentStudents, otherStudents, classAName, classBName){
  const safeName = (x) => (x == null ? '' : String(x))
  const rowsA = (Array.isArray(currentStudents) ? currentStudents : []).map(s => ({
    id: s.id,
    name: safeName(s.name),
    total: Number(s.total || 0),
    grade: resolveGrade(s),
    class_name: classAName || 'Class A',
    source: 'A',
    _ref: s,
  }))
  const rowsB = (Array.isArray(otherStudents) ? otherStudents : []).map(s => ({
    id: s.id,
    name: safeName(s.name),
    total: Number(s.total || 0),
    grade: resolveGrade(s),
    class_name: classBName || 'Class B',
    source: 'B',
    _ref: s,
  }))
  const combined = [...rowsA, ...rowsB]
  // Sort by total desc
  combined.sort((a,b)=> (Number(b.total||0) - Number(a.total||0)))
  // Assign positions with ties sharing rank
  let lastTotal = null
  let pos = 0
  for (let i=0;i<combined.length;i++){
    const t = Number(combined[i].total || 0)
    if (lastTotal === null || t < lastTotal){ pos = i+1; lastTotal = t }
    combined[i].position = pos
  }
  return combined
}

function InfoCard({ label, value, color='indigo', icon }){
  const palettes = {
    indigo: { 
      wrap: 'border-indigo-100 bg-gradient-to-br from-indigo-50 to-white', 
      title: 'text-indigo-600', 
      val: 'text-indigo-900',
      iconBg: 'bg-indigo-100 text-indigo-600'
    },
    emerald: { 
      wrap: 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white', 
      title: 'text-emerald-600', 
      val: 'text-emerald-900',
      iconBg: 'bg-emerald-100 text-emerald-600'
    },
    fuchsia: { 
      wrap: 'border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-white', 
      title: 'text-fuchsia-600', 
      val: 'text-fuchsia-900',
      iconBg: 'bg-fuchsia-100 text-fuchsia-600'
    },
  }
  const pal = palettes[color] || palettes.indigo
  
  const icons = {
    school: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 14l9-5-9-5-9 5 9 5z" />
        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.052 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
    layers: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    user: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  }

  return (
    <div className={`p-4 rounded-2xl border shadow-sm ${pal.wrap} flex items-center gap-4 transition-all hover:shadow-md`}>
      {icon && (
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${pal.iconBg}`}>
          {icons[icon]}
        </div>
      )}
      <div>
        <div className={`text-[11px] uppercase font-bold tracking-wider ${pal.title}`}>{label}</div>
        <div className={`mt-0.5 text-lg font-bold ${pal.val}`}>{value}</div>
      </div>
    </div>
  )
}
