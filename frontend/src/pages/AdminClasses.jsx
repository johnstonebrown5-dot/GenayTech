import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'
import LoadingOverlay from '../components/LoadingOverlay'
import { 
  Filter, 
  Search, 
  Plus, 
  BookOpen, 
  Layers, 
  LayoutGrid, 
  ChevronDown, 
  X, 
  CheckCircle2, 
  BarChart3, 
  ArrowRight,
  Edit3,
  Trash2,
  GraduationCap,
  Info
} from 'lucide-react'
import { toast } from 'react-hot-toast'

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
  const [showFilters, setShowFilters] = useState(false)
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

  const del = async (c) => {
    const studentCount = Number(c?.students_count || 0)
    if (studentCount > 0) {
      toast.error(`Cannot delete class "${c.name}" because it has ${studentCount} students. Move or remove students first.`)
      return
    }
    
    if (!window.confirm(`Delete class "${c.name}"? This action cannot be undone.`)) return
    try {
      setBusy(true); setBusyMessage('Deleting class…')
      await api.delete(`/academics/classes/${c.id}/`)
      load()
      toast.success('Class deleted successfully')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete class')
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

  const delStream = async (s) => {
    const stats = streamStats[String(s.id)] || { classes: 0 }
    if (stats.classes > 0) {
      toast.error(`Cannot delete stream "${s.name}" because it has ${stats.classes} classes assigned. Move or delete the classes first.`)
      return
    }

    if (!window.confirm(`Delete stream "${s.name}"?`)) return;
    try {
      setBusy(true); setBusyMessage('Deleting stream…')
      await api.delete(`/academics/streams/${s.id}/`);
      load();
      toast.success('Stream deleted successfully')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete stream')
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
              <button onClick={()=>del(c)} className="text-[11px] font-bold text-red-600 hover:text-red-800">Delete</button>
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
      <div className="min-h-screen bg-gray-50/50 pb-20">
        {busy && <LoadingOverlay message={busyMessage} transparent />}
        
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <LayoutGrid size={20} />
                  <span className="text-sm font-bold uppercase tracking-wider">Management</span>
                </div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  Manage <span className="text-blue-600">Classes</span>
                </h1>
                <p className="text-gray-500 mt-1 font-medium">Organize classes, streams, and subject allocations</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group w-full sm:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    value={search} 
                    onChange={e=>setSearch(e.target.value)}
                    placeholder="Search classes..."
                    className="h-12 w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold focus:border-blue-500 transition-all outline-none"
                  />
                </div>
                
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-12 px-6 rounded-2xl border-2 transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'}`}
                >
                  <Filter size={18} />
                  Filters
                  <ChevronDown size={16} className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Expandable Filters */}
            {showFilters && (
              <div className="mt-6 p-6 bg-gray-50 rounded-[2rem] border-2 border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-300">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Grade Level</label>
                  <select 
                    value={filterGrade} 
                    onChange={e=>setFilterGrade(e.target.value)}
                    className="w-full h-11 bg-white border-2 border-white rounded-xl px-4 text-sm font-bold text-gray-700 shadow-sm focus:border-blue-500 transition-all outline-none appearance-none"
                  >
                    <option value="">All Grades</option>
                    {Array.from({length:9}, (_,i)=>`Grade ${i+1}`).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Stream</label>
                  <select 
                    value={filterStream} 
                    onChange={e=>setFilterStream(e.target.value)}
                    className="w-full h-11 bg-white border-2 border-white rounded-xl px-4 text-sm font-bold text-gray-700 shadow-sm focus:border-blue-500 transition-all outline-none appearance-none"
                  >
                    <option value="">All Streams</option>
                    {streams.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-3 text-left">
                  <button 
                    onClick={()=>{ setFilterGrade(''); setFilterStream(''); setSearch('') }}
                    className="h-11 px-6 rounded-xl bg-white border-2 border-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:border-gray-900 hover:text-gray-900 transition-all flex-1"
                  >
                    Clear All
                  </button>
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Matches</div>
                    <div className="text-xl font-black text-blue-600">{filteredClasses.length} <span className="text-gray-300 text-xs font-bold uppercase tracking-widest ml-1">results</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-6 py-8">
          {/* Quick Access Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-[2rem] p-6 border-2 border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group flex flex-col justify-between h-48">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LayoutGrid size={28} />
                </div>
                <button 
                  onClick={()=>{ setEditing(null); setForm({ grade_level:'', stream: '', subject_ids:[] }); setShowClassModal(true) }}
                  className="h-10 px-4 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Plus size={14} /> New Class
                </button>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Classes</h3>
                <p className="text-xs font-medium text-gray-500 italic">Create or edit a class and assign subjects.</p>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 border-2 border-gray-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all group flex flex-col justify-between h-48">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen size={28} />
                </div>
                <button 
                  onClick={()=>{ setNewSubject({ code:'', name:'' }); setShowSubjectModal(true) }}
                  className="h-10 px-4 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Plus size={14} /> New Subject
                </button>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Subjects</h3>
                <p className="text-xs font-medium text-gray-500 italic">Add a new subject to the curriculum.</p>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 border-2 border-gray-100 shadow-sm hover:shadow-xl hover:shadow-purple-500/5 transition-all group flex flex-col justify-between h-48">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Layers size={28} />
                </div>
                <button 
                  onClick={() => { setNewStream({ name: '' }); setShowStreamModal(true); }}
                  className="h-10 px-4 rounded-xl bg-purple-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-200 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Plus size={14} /> New Stream
                </button>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Streams</h3>
                <p className="text-xs font-medium text-gray-500 italic">Add streams like North, A, B, etc.</p>
              </div>
            </div>
          </div>

          {/* Classes Section */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden mb-12">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                  <LayoutGrid size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Classes Directory</h2>
                  <p className="text-xs font-medium text-gray-500 italic uppercase tracking-widest">Active Academic Periods</p>
                </div>
              </div>
              <button
                onClick={() => setShowClassesSection(!showClassesSection)}
                className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <ChevronDown size={20} className={`transform transition-transform ${showClassesSection ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {showClassesSection && (
              <div className="p-8">
                {loading ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-64 rounded-[2rem] bg-gray-50 animate-pulse border border-gray-100" />
                    ))}
                  </div>
                ) : filteredClasses.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border-2 border-gray-100 border-dashed">
                      <LayoutGrid size={40} className="text-gray-200" />
                    </div>
                    <h3 className="text-gray-400 font-black uppercase tracking-widest text-sm mb-1">No classes found</h3>
                    <p className="text-gray-400 text-xs font-medium">Try adjusting your filters or add a new class</p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredClasses.map(renderCard)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Streams Section */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm">
                  <Layers size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Streams Management</h2>
                  <p className="text-xs font-medium text-gray-500 italic uppercase tracking-widest">Class grouping units</p>
                </div>
              </div>
              <button
                onClick={() => setShowStreamsSection(!showStreamsSection)}
                className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <ChevronDown size={20} className={`transform transition-transform ${showStreamsSection ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showStreamsSection && (
              <div className="p-8">
                {loading ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-48 rounded-[2rem] bg-gray-50 animate-pulse border border-gray-100" />
                    ))}
                  </div>
                ) : streams.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border-2 border-gray-100 border-dashed">
                      <Layers size={40} className="text-gray-200" />
                    </div>
                    <h3 className="text-gray-400 font-black uppercase tracking-widest text-sm mb-1">No streams yet</h3>
                    <p className="text-gray-400 text-xs font-medium">Add a stream to start organizing classes</p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {streams.map(s => {
                      const st = streamStats[String(s.id)] || { classes: 0, students: 0, loading: true }
                      return (
                        <div key={s.id} className="bg-white border-2 border-gray-50 rounded-[2rem] p-6 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/5 transition-all group relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform" />
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 font-black text-xl border border-purple-100">
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={()=>editStream(s)} className="p-2 text-gray-300 hover:text-blue-600 transition-colors"><Edit3 size={16} /></button>
                                <button onClick={()=>delStream(s)} className="p-2 text-gray-300 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                              </div>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1">{s.name}</h3>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Stream Unit</div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center">Classes</div>
                                <div className="text-lg font-black text-gray-900 text-center">{st.classes}</div>
                              </div>
                              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center">Students</div>
                                <div className="text-lg font-black text-gray-900 text-center">{st.loading ? '...' : st.students}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Class Modal */}
        <Modal open={showClassModal} onClose={()=>setShowClassModal(false)} title={editing? 'Edit Academic Class':'New Academic Class'} size="lg">
          <form onSubmit={(e)=>{ submit(e); setShowClassModal(false) }} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Grade Level</label>
                <select 
                  className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 text-sm font-bold text-gray-900 focus:border-blue-500 transition-all outline-none appearance-none"
                  value={form.grade_level} 
                  onChange={e=>setForm({...form, grade_level:e.target.value})}
                  required
                >
                  <option value="">Select Grade...</option>
                  {Array.from({length:9}, (_,i)=>`Grade ${i+1}`).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Target Stream</label>
                <select 
                  className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 text-sm font-bold text-gray-900 focus:border-blue-500 transition-all outline-none appearance-none"
                  value={form.stream} 
                  onChange={e => setForm({ ...form, stream: e.target.value })} 
                  required
                >
                  <option value="">Select Stream...</option>
                  {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            
            <div className="space-y-3 text-left">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Subject Allocation</label>
              <div className="bg-gray-50 rounded-[2rem] border-2 border-gray-100 p-6 max-h-[350px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subjects.map(s => {
                    const isChecked = form.subject_ids.includes(s.id)
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setForm(f => ({ ...f, subject_ids: isChecked ? f.subject_ids.filter(id=>id!==s.id) : [...f.subject_ids, s.id] }))}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isChecked ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-white text-gray-600 hover:border-blue-100'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${isChecked ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                            {s.code}
                          </div>
                          <span className="text-xs font-bold truncate max-w-[140px]">{s.name}</span>
                        </div>
                        {isChecked && <CheckCircle2 size={16} />}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2 px-2">
                <Info size={14} className="text-gray-400" />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Select all subjects that students in this class will take</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={()=>setShowClassModal(false)} 
                className="px-8 py-3 rounded-2xl border-2 border-gray-100 font-black text-xs uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button className="px-10 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">
                {editing ? 'Update Registry' : 'Confirm Creation'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Stream Modal */}
        <Modal open={showStreamModal} onClose={()=>{ setShowStreamModal(false); setEditingStream(null); }} title={editingStream? 'Edit Stream Unit':'New Stream Unit'} size="sm">
          <form onSubmit={e => { e.preventDefault(); saveStream(); }} className="space-y-6">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Identification Name</label>
              <input 
                className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 text-sm font-bold text-gray-900 focus:border-purple-500 transition-all outline-none"
                placeholder="e.g., North, West, Alpha" 
                value={newStream.name} 
                onChange={e=>setNewStream({...newStream, name:e.target.value})} 
                required 
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={()=>{ setShowStreamModal(false); setEditingStream(null); }} 
                className="px-6 py-3 rounded-2xl border-2 border-gray-100 font-black text-xs uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button type="submit" className="px-8 py-3 rounded-2xl bg-purple-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all active:scale-95">
                {editingStream? 'Save Changes':'Create Unit'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Subject Modal */}
        <Modal open={showSubjectModal} onClose={()=>setShowSubjectModal(false)} title="New Curriculum Subject" size="sm">
          <div className="space-y-6">
            <div className="grid gap-6">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Subject Code</label>
                <input 
                  className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 text-sm font-bold text-gray-900 focus:border-emerald-500 transition-all outline-none"
                  placeholder="e.g., ENG, MATH" 
                  value={newSubject.code} 
                  onChange={e=>setNewSubject({...newSubject, code:e.target.value})} 
                />
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Full Designation</label>
                <input 
                  className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 text-sm font-bold text-gray-900 focus:border-emerald-500 transition-all outline-none"
                  placeholder="e.g., English Literature" 
                  value={newSubject.name} 
                  onChange={e=>setNewSubject({...newSubject, name:e.target.value})} 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={()=>setShowSubjectModal(false)} 
                className="px-6 py-3 rounded-2xl border-2 border-gray-100 font-black text-xs uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={(e)=>{ e.preventDefault(); createSubject(e); setShowSubjectModal(false) }}
                className="px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
              >
                Register Subject
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </React.Fragment>
  )
}
