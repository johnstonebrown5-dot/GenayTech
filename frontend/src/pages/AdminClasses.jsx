import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'
import LoadingOverlay from '../components/LoadingOverlay'

export default function AdminClasses(){
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [streams, setStreams] = useState([])
  const [form, setForm] = useState({ grade_level:'', stream: '', subject_ids:[] })
  const [editing, setEditing] = useState(null)
  const [newSubject, setNewSubject] = useState({ code:'', name:'' })
  const [newStream, setNewStream] = useState({ name: '' })
  const [editingStream, setEditingStream] = useState(null)
  const [showClassModal, setShowClassModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showStreamModal, setShowStreamModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyMessage, setBusyMessage] = useState('Processing...')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterStream, setFilterStream] = useState('')
  const [search, setSearch] = useState('')
  const [streamStats, setStreamStats] = useState({}) // { [streamId]: { classes: number, students: number, loading: boolean } }
  const [showFilters, setShowFilters] = useState(true)
  const [showClassesSection, setShowClassesSection] = useState(true)
  const [showStreamsSection, setShowStreamsSection] = useState(true)

  const { showSuccess, showError } = useNotification()

  const load = async () => {
    setLoading(true)
    try {
      const [cl, sbj, st] = await Promise.all([
        api.get('/academics/classes/'),
        api.get('/academics/subjects/'),
        api.get('/academics/streams/'),
      ])
      const clArr = Array.isArray(cl.data) ? cl.data : (Array.isArray(cl.data?.results) ? cl.data.results : [])
      const sbjArr = Array.isArray(sbj.data) ? sbj.data : (Array.isArray(sbj.data?.results) ? sbj.data.results : [])
      const stArr = Array.isArray(st.data) ? st.data : (Array.isArray(st.data?.results) ? st.data.results : [])
      // Fetch full details for each class since list endpoint returns a lite serializer
      const detailed = await Promise.all(
        (clArr || []).map(async (c) => {
          try {
            const res = await api.get(`/academics/classes/${c.id}/`)
            return res.data || c
          } catch {
            return c
          }
        })
      )
      setClasses(detailed)
      setSubjects(sbjArr)
      setStreams(stArr)
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=>{ load() },[])

  const submit = async (e) => {
    e.preventDefault()
    try {
      setBusy(true); setBusyMessage(editing ? 'Updating class…' : 'Creating class…')
      if (editing) {
        await api.put(`/academics/classes/${editing}/`, form)
        showSuccess('Class Updated', 'Class has been successfully updated.')
      } else {
        await api.post('/academics/classes/', form)
        showSuccess('Class Created', 'Class has been successfully created.')
      }
      setForm({ grade_level:'', stream: '', subject_ids:[] })
      load()
    } catch (err) {
      showError('Failed to Save Class', 'There was an error saving the class. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const edit = (c) => {
    setEditing(c.id)
    const currentSubjectIds = Array.isArray(c.subjects) ? c.subjects.map(s=>s.id) : []
    setForm({ grade_level: c.grade_level, stream: c.stream, subject_ids: currentSubjectIds })
    setShowClassModal(true)
  }

  const del = async (id) => {
    if (!confirm('Delete this class?')) return
    try {
      setBusy(true); setBusyMessage('Deleting class…')
      await api.delete(`/academics/classes/${id}/`)
      load()
      showSuccess('Class Deleted', 'Class has been successfully deleted.')
    } catch (err) {
      showError('Failed to Delete Class', 'There was an error deleting the class. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const createSubject = async (e) => {
    e.preventDefault()
    if (!newSubject.code || !newSubject.name) return
    try {
      setBusy(true); setBusyMessage('Creating subject…')
      await api.post('/academics/subjects/', newSubject)
      setNewSubject({ code:'', name:'' })
      load()
      showSuccess('Subject Created', `Subject ${newSubject.name} (${newSubject.code}) has been successfully created.`)
    } catch (err) {
      showError('Failed to Create Subject', 'There was an error creating the subject. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const saveStream = async () => {
    if (!newStream.name) return;
    try {
      setBusy(true); setBusyMessage(editingStream ? 'Updating stream…' : 'Creating stream…')
      if (editingStream) {
        await api.put(`/academics/streams/${editingStream}/`, newStream);
        showSuccess('Stream Updated', 'Stream has been successfully updated.');
      } else {
        await api.post('/academics/streams/', newStream);
        showSuccess('Stream Created', `Stream ${newStream.name} has been successfully created.`);
      }
      setNewStream({ name: '' });
      setEditingStream(null);
      setShowStreamModal(false);
      load();
    } catch (err) {
      showError('Failed to Save Stream', 'There was an error saving the stream. Please try again.');
    } finally {
      setBusy(false)
    }
  };

  const delStream = async (id) => {
    if (!confirm('Delete this stream?')) return;
    try {
      setBusy(true); setBusyMessage('Deleting stream…')
      await api.delete(`/academics/streams/${id}/`);
      load();
      showSuccess('Stream Deleted', 'Stream has been successfully deleted.');
    } catch (err) {
      showError('Failed to Delete Stream', 'There was an error deleting the stream. Please try again.');
    } finally {
      setBusy(false)
    }
  };

  const editStream = (s) => {
    setEditingStream(s.id)
    setNewStream({ name: s.name })
    setShowStreamModal(true)
  }

  const normalizeGrade = (g) => {
    try{
      const m = String(g||'').match(/\d+/)
      return m ? `Grade ${parseInt(m[0],10)}` : String(g||'')
    }catch{ return String(g||'') }
  }
  const classMatches = (c) => {
    const gradeOk = !filterGrade || normalizeGrade(c.grade_level) === normalizeGrade(filterGrade)
    const streamId = c.stream_detail?.id ?? c.stream
    const streamOk = !filterStream || String(streamId) === String(filterStream)
    const q = search.trim().toLowerCase()
    if (!q) return gradeOk && streamOk
    const teacher = c.teacher_detail ? `${c.teacher_detail.first_name||''} ${c.teacher_detail.last_name||''} ${c.teacher_detail.username||''}`.toLowerCase() : ''
    const subjectsTxt = Array.isArray(c.subjects) ? c.subjects.map(s=>`${s.code} ${s.name}`).join(' ').toLowerCase() : ''
    const streamName = (c.stream_detail?.name || streams.find(s=>String(s.id)===String(streamId))?.name || '').toLowerCase()
    const hay = `${c.name||''} ${normalizeGrade(c.grade_level)} ${teacher} ${streamName} ${subjectsTxt}`.toLowerCase()
    return gradeOk && streamOk && hay.includes(q)
  }
  const filteredClasses = classes.filter(classMatches)

  const gradeColor = (g) => {
    const n = (() => { try { const m = String(g||'').match(/\d+/); return m ? parseInt(m[0],10) : null } catch { return null } })()
    const palette = [
      { border:'border-blue-200', badgeBg:'bg-blue-50', badgeText:'text-blue-700' },
      { border:'border-emerald-200', badgeBg:'bg-emerald-50', badgeText:'text-emerald-700' },
      { border:'border-amber-200', badgeBg:'bg-amber-50', badgeText:'text-amber-700' },
      { border:'border-violet-200', badgeBg:'bg-violet-50', badgeText:'text-violet-700' },
      { border:'border-rose-200', badgeBg:'bg-rose-50', badgeText:'text-rose-700' },
      { border:'border-cyan-200', badgeBg:'bg-cyan-50', badgeText:'text-cyan-700' },
      { border:'border-fuchsia-200', badgeBg:'bg-fuchsia-50', badgeText:'text-fuchsia-700' },
      { border:'border-lime-200', badgeBg:'bg-lime-50', badgeText:'text-lime-700' },
      { border:'border-sky-200', badgeBg:'bg-sky-50', badgeText:'text-sky-700' },
    ]
    const idx = n ? Math.max(1, Math.min(9, n)) - 1 : 0
    return palette[idx]
  }

  const isGrade9 = (c) => {
    const g = String(c?.grade_level || '').toLowerCase()
    return g.includes('grade 9') || g.trim() === '9'
  }

  const getPromoteLabel = (c) => (isGrade9(c) ? 'Mark as Graduated' : 'Promote')

  const handlePromote = async (c) => {
    const label = getPromoteLabel(c)
    const confirmText = isGrade9(c)
      ? `Mark all students in ${c.name} as graduated?`
      : `Promote all students in ${c.name} to the next class?`

    if (!window.confirm(confirmText)) return

    try {
      setBusy(true)
      setBusyMessage(isGrade9(c) ? 'Marking students as graduated…' : 'Promoting students…')

      const res = await api.post(`/academics/classes/${c.id}/promote/`)
      const detail = res?.data?.detail || 'Operation completed.'
      showSuccess(label, detail)

      await load()
    } catch (err) {
      const apiDetail = err?.response?.data?.detail
      const fallback = 'There was an error performing this action. If this is a promotion (not graduation), ensure the next class is empty before trying again.'
      showError(label + ' Failed', apiDetail || fallback)
    } finally {
      setBusy(false)
    }
  }

  const renderCard = (c) => {
    const pal = gradeColor(c.grade_level)
    const streamName = (() => {
      const fromDetail = c?.stream_detail?.name
      if (fromDetail) return fromDetail
      const sid = c.stream_detail?.id ?? c.stream
      return streams.find(s => String(s.id) === String(sid))?.name || '-'
    })()
    const teacherName = (() => {
      const t = c?.teacher_detail
      if (!t) return '-'
      const full = [t.first_name, t.last_name].filter(Boolean).join(' ').trim()
      return full || t.username || '-'
    })()
    return (
      <div 
        key={c.id} 
        onClick={() => navigate(`/admin/classes/${c.id}`)}
        className={`group relative bg-white border-2 ${pal.border} rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full cursor-pointer`}
      >
        <div className="p-4 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-base font-bold text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">
              {c.name}
            </div>
            <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${pal.badgeBg} ${pal.badgeText}`}>
              {c.grade_level}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="font-medium">Stream:</span>
              <span className="text-gray-900 font-semibold">{streamName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="font-medium">Teacher:</span>
              <span className="text-gray-900 font-semibold">{teacherName}</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Subjects</div>
            <div className="flex flex-wrap gap-1.5">
            {Array.isArray(c.subjects) && c.subjects.length>0 ? (
              <>
                {c.subjects.map(s => (
                  <span key={s.id} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200/50" title={s.name}>
                    {s.code}
                  </span>
                ))}
              </>
            ) : (
              <span className="text-xs italic text-gray-400">No subjects assigned</span>
            )}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t bg-gray-50/80 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <Link to={`/admin/classes/${c.id}?tab=results`} className="text-[11px] font-bold text-violet-700 hover:text-violet-900 flex items-center gap-1">
              <span>📊</span> Results
            </Link>
            <Link to={`/admin/classes/${c.id}?tab=subjects`} className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1">
              <span>📚</span> Subjects
            </Link>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-200/60">
            <button
              onClick={() => handlePromote(c)}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
            >
              <span>🚀</span> {getPromoteLabel(c)}
            </button>
            <div className="flex items-center gap-3">
              <button onClick={()=>edit(c)} className="text-[11px] font-bold text-blue-600 hover:text-blue-800">Edit</button>
              <button onClick={()=>del(c.id)} className="text-[11px] font-bold text-red-600 hover:text-red-800">Delete</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Compute per-stream stats: number of classes and number of students
  const fetchAllPaged = async (url) => {
    try{
      let out = []
      let next = url
      let guard = 0
      while (next && guard < 50){
        const res = await api.get(next)
        const d = res?.data
        if (Array.isArray(d)) { out = d; break }
        if (d && Array.isArray(d.results)) { out = out.concat(d.results); next = d.next; guard++; continue }
        break
      }
      return out
    }catch{ return [] }
  }

  const countStudentsForKlass = async (klassId) => {
    const list = await fetchAllPaged(`/academics/students/?klass=${klassId}`)
    return Array.isArray(list) ? list.length : 0
  }

  useEffect(() => {
    // Build classes count immediately; students count asynchronously
    const byStream = {}
    for (const s of streams){ byStream[String(s.id)] = { classes: 0, students: 0, loading: true } }
    for (const c of classes){
      const sid = String(c.stream_detail?.id ?? c.stream)
      if (!byStream[sid]) byStream[sid] = { classes: 0, students: 0, loading: true }
      byStream[sid].classes++
    }
    setStreamStats(byStream)
    // Fetch students per class and aggregate
    ;(async () => {
      try{
        const nextStats = { ...byStream }
        for (const s of streams){
          const sid = String(s.id)
          const classIds = classes.filter(c => String(c.stream_detail?.id ?? c.stream) === sid).map(c => c.id)
          let total = 0
          for (const cid of classIds){ total += await countStudentsForKlass(cid) }
          if (!nextStats[sid]) nextStats[sid] = { classes: classIds.length, students: 0, loading: false }
          nextStats[sid].students = total
          nextStats[sid].loading = false
        }
        setStreamStats(nextStats)
      }catch{}
    })()
  }, [classes, streams])

  return (
    <React.Fragment>
      <div>
        {busy && <LoadingOverlay message={busyMessage} transparent />}
        <div className="space-y-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Manage Classes</h1>
            <div className="text-sm text-gray-500">Create and organize classes, subjects, and streams</div>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between md:hidden">
            <div className="text-sm font-medium text-gray-700">Filters</div>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className="text-sm inline-flex items-center gap-1 px-3 py-1.5 border rounded-md bg-white shadow-sm"
            >
              <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
              <span className="text-xs text-gray-500">▾</span>
            </button>
          </div>

          <div className={`${showFilters ? '' : 'hidden'} md:grid bg-white rounded-lg shadow p-4 border border-gray-100 grid gap-3 md:grid-cols-4`}>
            <label className="text-sm">
              Grade
              <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} className="border p-2 rounded w-full mt-1">
                <option value="">All Grades</option>
                {Array.from({length:9}, (_,i)=>`Grade ${i+1}`).map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Stream
              <select value={filterStream} onChange={e=>setFilterStream(e.target.value)} className="border p-2 rounded w-full mt-1">
                <option value="">All Streams</option>
                {streams.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              Search
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search class, teacher, stream, subject" className="border p-2 rounded w-full mt-1" />
            </label>
            <div className="md:col-span-4 flex items-center gap-2">
              <div className="text-xs text-gray-500">Showing {filteredClasses.length} of {classes.length}</div>
              <button onClick={()=>{ setFilterGrade(''); setFilterStream(''); setSearch('') }} className="ml-auto px-3 py-1.5 border rounded text-sm">Clear Filters</button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-4 border border-gray-100 flex items-start justify-between">
              <div>
                <div className="font-semibold text-sm text-gray-900">Classes</div>
                <p className="text-xs text-gray-500 mt-1">Create or edit a class and assign subjects.</p>
              </div>
              <button
                aria-label="Add Class"
                onClick={()=>{ setEditing(null); setForm({ grade_level:'', stream: '', subject_ids:[] }); setShowClassModal(true) }}
                className="inline-flex items-center gap-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition-transform hover:scale-105"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-base leading-none">+</span>
                <span>{editing? 'Edit Class' : 'Add Class'}</span>
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-100 flex items-start justify-between">
              <div>
                <div className="font-semibold text-sm text-gray-900">Create Subject</div>
                <p className="text-xs text-gray-500 mt-1">Add a new subject to the curriculum.</p>
              </div>
              <button
                aria-label="Add Subject"
                onClick={()=>{ setNewSubject({ code:'', name:'' }); setShowSubjectModal(true) }}
                className="inline-flex items-center gap-1 rounded-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-xs font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1 transition-transform hover:scale-105"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-base leading-none">+</span>
                <span>Add Subject</span>
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-100 flex items-start justify-between">
              <div>
                <div className="font-semibold text-sm text-gray-900">Manage Streams</div>
                <p className="text-xs text-gray-500 mt-1">Add streams such as North, A, B, etc.</p>
              </div>
              <button
                aria-label="Add Stream"
                onClick={() => { setNewStream({ name: '' }); setShowStreamModal(true); }}
                className="inline-flex items-center gap-1 rounded-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 text-xs font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1 transition-transform hover:scale-105"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-base leading-none">+</span>
                <span>Add Stream</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-medium text-sm text-gray-900">Classes</h2>
              <button
                type="button"
                onClick={() => setShowClassesSection(v => !v)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 text-xs"
                aria-label={showClassesSection ? 'Collapse classes' : 'Expand classes'}
              >
                <span className={`transform transition-transform ${showClassesSection ? 'rotate-0' : '-rotate-90'}`}>▾</span>
              </button>
            </div>
            {showClassesSection && (
              <>
                {loading ? (
                  <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="bg-white border rounded-lg shadow-sm p-4 animate-pulse">
                        <div className="h-5 w-2/3 bg-gray-200 rounded" />
                        <div className="mt-2 h-4 w-1/3 bg-gray-200 rounded" />
                        <div className="mt-4 flex gap-2">
                          <div className="h-5 w-12 bg-gray-200 rounded" />
                          <div className="h-5 w-10 bg-gray-200 rounded" />
                          <div className="h-5 w-14 bg-gray-200 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredClasses.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">No classes yet. Click "Add Class" to create your first class.</div>
                ) : (
                  <div className="p-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-300">
                      {filteredClasses.map(renderCard)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-medium text-sm text-gray-900">Streams</h2>
              <button
                type="button"
                onClick={() => setShowStreamsSection(v => !v)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 text-xs"
                aria-label={showStreamsSection ? 'Collapse streams' : 'Expand streams'}
              >
                <span className={`transform transition-transform ${showStreamsSection ? 'rotate-0' : '-rotate-90'}`}>▾</span>
              </button>
            </div>
            {showStreamsSection && (
              <>
                {loading ? (
                  <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white border rounded-lg shadow-sm p-4 animate-pulse h-24" />
                    ))}
                  </div>
                ) : streams.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">No streams yet. Click "Add Stream" to create one.</div>
                ) : (
                  <div className="p-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {streams.map(s => {
                        const st = streamStats[String(s.id)] || { classes: 0, students: 0, loading: true }
                        return (
                          <div key={s.id} className="bg-white border-2 border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-4 hover:border-purple-200 transition-colors">
                            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-lg border border-purple-100">
                                  {s.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <div className="text-lg font-bold text-gray-900 leading-none">{s.name}</div>
                                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Stream</div>
                                </div>
                              </div>
                              <div className="text-[10px] font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-gray-500">ID: {s.id}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Classes</div>
                                <div className="text-xl font-black text-gray-900">{st.classes}</div>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Students</div>
                                <div className="text-xl font-black text-gray-900">{st.loading ? '...' : st.students}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 justify-end pt-2">
                              <button onClick={()=>editStream(s)} className="px-3 py-1.5 rounded-md text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">Edit</button>
                              <button onClick={()=>delStream(s.id)} className="px-3 py-1.5 rounded-md text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">Delete</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      {/* Class Modal */}
      <Modal open={showClassModal} onClose={()=>setShowClassModal(false)} title={editing? 'Edit Class':'Add Class'} size="lg">
        <form onSubmit={(e)=>{ submit(e); setShowClassModal(false) }} className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Grade</span>
            <select aria-label="Select Grade" className="border p-2 rounded" value={form.grade_level} onChange={e=>setForm({...form, grade_level:e.target.value})}>
              <option value="">Select Grade</option>
              {Array.from({length:9}, (_,i)=>`Grade ${i+1}`).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Stream</span>
            <select aria-label="Select Stream" className="border p-2 rounded" value={form.stream} onChange={e => setForm({ ...form, stream: e.target.value })} required>
              <option value="">Select Stream</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          
          <div className="md:col-span-2">
            <div className="text-sm text-gray-700 mb-1">Assign Subjects to this Class</div>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <label key={s.id} className="inline-flex items-center gap-2 border rounded px-2 py-1 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={form.subject_ids.includes(s.id)}
                    onChange={(e)=>{
                      const checked = e.target.checked
                      setForm(f => ({ ...f, subject_ids: checked ? [...f.subject_ids, s.id] : f.subject_ids.filter(id=>id!==s.id) }))
                    }}
                  />
                  <span className="text-sm"><span className="font-medium">{s.code}</span> — {s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowClassModal(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">{editing? 'Update Class':'Add Class'}</button>
          </div>
        </form>
      </Modal>

      {/* Stream Modal */}
      <Modal open={showStreamModal} onClose={()=>{ setShowStreamModal(false); setEditingStream(null); }} title={editingStream? 'Edit Stream':'Add Stream'} size="sm">
        <form onSubmit={e => { e.preventDefault(); saveStream(); }}>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-gray-700">Stream Name</span>
              <input aria-label="Stream Name" className="border p-2 rounded" placeholder="e.g., North" value={newStream.name} onChange={e=>setNewStream({...newStream, name:e.target.value})} required />
            </label>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={()=>{ setShowStreamModal(false); setEditingStream(null); }} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">{editingStream? 'Update Stream':'Add Stream'}</button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Subject Modal */}
      <Modal open={showSubjectModal} onClose={()=>setShowSubjectModal(false)} title="Create Subject" size="sm">
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Subject Code</span>
            <input aria-label="Subject Code" className="border p-2 rounded" placeholder="e.g., ENG" value={newSubject.code} onChange={e=>setNewSubject({...newSubject, code:e.target.value})} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Subject Name</span>
            <input aria-label="Subject Name" className="border p-2 rounded" placeholder="e.g., English" value={newSubject.name} onChange={e=>setNewSubject({...newSubject, name:e.target.value})} />
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowSubjectModal(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded" onClick={(e)=>{ e.preventDefault(); createSubject(e); setShowSubjectModal(false) }}>Add Subject</button>
          </div>
        </div>
      </Modal>
      </div>
    </React.Fragment>
  )
}
