import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import Modal from '../components/Modal'
import { useNavigate } from 'react-router-dom'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { 
  Plus, 
  Calendar, 
  FileSpreadsheet, 
  Filter, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Trash2, 
  ChevronRight,
  ArrowUpDown,
  LayoutGrid,
  List,
  ChevronLeft,
  Eye,
  FileText,
  Send,
  Ban,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react'

const centerTextPlugin = {
  id: 'centerText',
  afterDraw: (chart, _args, pluginOptions) => {
    try {
      const opts = pluginOptions || {}
      const meta = chart.getDatasetMeta(0)
      const first = meta?.data?.[0]
      if (!first) return

      const text = opts.text ?? ''
      const subtext = opts.subtext ?? ''
      if (!text && !subtext) return

      const { ctx } = chart
      const x = first.x
      const y = first.y

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const mainSize = Number(opts.fontSize || 22)
      const subSize = Number(opts.subFontSize || 11)

      ctx.fillStyle = opts.color || '#111827'
      ctx.font = `900 ${mainSize}px Inter, ui-sans-serif, system-ui`
      ctx.fillText(String(text), x, subtext ? y - 6 : y)

      if (subtext) {
        ctx.fillStyle = opts.subColor || '#6b7280'
        ctx.font = `800 ${subSize}px Inter, ui-sans-serif, system-ui`
        ctx.fillText(String(subtext), x, y + 16)
      }

      ctx.restore()
    } catch {
      // no-op
    }
  },
}

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, centerTextPlugin)

function timeAgo(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function fmtDateBadge(dateValue) {
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return { m: '—', day: '—' }
  return {
    m: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    day: String(d.getDate()).padStart(2, '0'),
  }
}

function Card({ title, right, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-card ${className}`}>
      {(title || right) && (
        <div className="px-5 pt-5 pb-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-black text-gray-900">{title}</h3>}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function AdminExams(){
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [modalSubjects, setModalSubjects] = useState([]) // subjects for selected exam/class

  const [loading, setLoading] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('Confirm')
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmIntentText, setConfirmIntentText] = useState('')
  const [confirmButtonText, setConfirmButtonText] = useState('Confirm')
  const [confirmButtonClass, setConfirmButtonClass] = useState('bg-gray-900 hover:bg-black')
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmHandler, setConfirmHandler] = useState(null)

  const [showCreateExam, setShowCreateExam] = useState(false)
  const [showEnterResults, setShowEnterResults] = useState(false)
  const [examForm, setExamForm] = useState({ name:'Mid Term', year:new Date().getFullYear(), term:1, grades:[], classes:[], mode:'grade', date:new Date().toISOString().slice(0,10), total_marks:100 })
  const [selectedExam, setSelectedExam] = useState(null)
  const [results, setResults] = useState([]) // [{student, subject, marks}]
  const [status, setStatus] = useState('idle') // idle|saving|saved
  const [error, setError] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [resultsSummary, setResultsSummary] = useState({ subjects: [], students: [] })
  const [publishingId, setPublishingId] = useState(null)
  const [unpublishingId, setUnpublishingId] = useState(null)
  const [banner, setBanner] = useState('')
  const [currentTerm, setCurrentTerm] = useState(null)
  // Bulk selection
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkPublishing, setBulkPublishing] = useState(false)
  // Group by exam name modal
  const [groupedOpen, setGroupedOpen] = useState(false)
  const [groupedName, setGroupedName] = useState('')
  const [groupedItems, setGroupedItems] = useState([])
  // Edit/Delete
  const [showEditExam, setShowEditExam] = useState(false)
  const [editExam, setEditExam] = useState(null)
  const [editForm, setEditForm] = useState({ name:'', year:'', term:1, klass:'', date:'', total_marks:100 })
  const [deletingId, setDeletingId] = useState(null)
  // Filters
  const [search, setSearch] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterTerm, setFilterTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all|published|unpublished
  const [page, setPage] = useState(1)

  // Calendar state and helpers
  const [calMonth, setCalMonth] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const startOfMonth = (d) => { const x=new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x }
  const startOfCalendarGrid = (d) => { const first = startOfMonth(d); const day = first.getDay(); const gridStart = new Date(first); gridStart.setDate(first.getDate() - day); gridStart.setHours(0,0,0,0); return gridStart }
  const buildMonthGrid = (d) => { const start = startOfCalendarGrid(d); const days=[]; for(let i=0;i<42;i++){ const day=new Date(start); day.setDate(start.getDate()+i); day.setHours(0,0,0,0); days.push(day) } return days }
  const localKey = (dt) => { const d = new Date(dt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const monthDays = buildMonthGrid(calMonth)
  const examsByDate = (Array.isArray(exams) ? exams : []).reduce((m,e)=>{ const key = (e.date||'').slice(0,10); if(!key) return m; if(!m[key]) m[key]=[]; m[key].push(e); return m },{})
  const [dayOpen, setDayOpen] = useState(false)
  const [dayKey, setDayKey] = useState('')
  const [dayItems, setDayItems] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState('latest') // latest|oldest|published_first|unpublished_first

  const openConfirm = ({ title, message, intentText, confirmText, confirmClass, onConfirm }) => {
    setConfirmTitle(title || 'Confirm')
    setConfirmMessage(message || '')
    setConfirmIntentText(intentText || '')
    setConfirmButtonText(confirmText || 'Confirm')
    setConfirmButtonClass(confirmClass || 'bg-gray-900 hover:bg-black')
    setConfirmBusy(false)
    setConfirmHandler(() => onConfirm)
    setConfirmOpen(true)
  }

  const closeConfirm = () => {
    if (confirmBusy) return
    setConfirmOpen(false)
    setConfirmHandler(null)
    setConfirmMessage('')
    setConfirmIntentText('')
  }

  const runConfirm = async () => {
    if (!confirmHandler) return
    try{
      setConfirmBusy(true)
      await confirmHandler()
      setConfirmOpen(false)
      setConfirmHandler(null)
    }finally{
      setConfirmBusy(false)
    }
  }

  const bulkPublishExams = async () => {
    const ids = Array.from(selected)
    if (ids.length===0) return
    openConfirm({
      title: 'Publish results',
      message: `You are about to publish results for ${ids.length} selected exam(s).`,
      intentText: 'Please review your selection. Once published, students may immediately view results.',
      confirmText: 'Publish',
      confirmClass: 'bg-purple-600 hover:bg-purple-700',
      onConfirm: async () => {
        try{
          setBulkPublishing(true)
          const results = await Promise.allSettled(ids.map(id => api.post(`/academics/exams/${id}/publish/`)))
          const ok = results.filter(r=>r.status==='fulfilled').length
          const fail = results.length - ok
          setBanner(`Published ${ok} exam(s)${fail? `, ${fail} failed`:''}`)
        }catch(err){
          setBanner(err?.response?.data?.detail || 'Bulk publish failed')
        }finally{
          setBulkPublishing(false)
          setSelected(new Set())
          load()
        }
      }
    })
  }

  // Open modal showing all classes/grades that share the same exam name
  const openByName = async (name) => {
    if (!name) return
    try{
      setGroupedName(name)
      setGroupedItems([])
      const { data } = await api.get('/academics/exams/by-name', { params: { name, include_history: true } })
      const items = Array.isArray(data?.items) ? data.items : []
      setGroupedItems(items)
      setGroupedOpen(true)
    }catch(err){
      setBanner(err?.response?.data?.detail || 'Failed to load grouped exams')
    }
  }

  const publishExam = async (exam) => {
    if (!exam) return
    try {
      setPublishingId(exam.id)
      setBanner('')
      await api.post(`/academics/exams/${exam.id}/publish/`)
      const examName = exam?.name || (Array.isArray(exams) ? exams : []).find(x => x?.id === exam?.id)?.name || `Exam #${exam.id}`
      setBanner(`Published results for ${examName}. Students have been notified.`)
      // Refresh list to reflect published flag
      load()
    } catch (err) {
      setBanner(err?.response?.data?.detail || 'Failed to publish results')
    } finally {
      setPublishingId(null)
    }
  }

  const unpublishExam = async (exam) => {
    if (!exam) return
    openConfirm({
      title: 'Unpublish exam',
      message: `Unpublish “${exam?.name || (Array.isArray(exams) ? exams : []).find(x => x?.id === exam?.id)?.name || `Exam #${exam.id}` }”?`,
      intentText: 'Students will no longer see this exam/results once unpublished.',
      confirmText: 'Unpublish',
      confirmClass: 'bg-orange-600 hover:bg-orange-700',
      onConfirm: async () => {
        try{
          setUnpublishingId(exam.id)
          setBanner('')
          await api.post(`/academics/exams/${exam.id}/unpublish/`)
          const examName = exam?.name || (Array.isArray(exams) ? exams : []).find(x => x?.id === exam?.id)?.name || `Exam #${exam.id}`
          setBanner(`Unpublished ${examName}.`)
          load()
        }catch(err){
          setBanner(err?.response?.data?.detail || 'Failed to unpublish exam')
        }finally{
          setUnpublishingId(null)
        }
      }
    })
  }

  const load = async () => {
    try{
      setLoading(true)
      const [ex, cl, sbj, term] = await Promise.all([
        api.get('/academics/exams/', { params: { include_history: true } }),
        api.get('/academics/classes/'),
        api.get('/academics/subjects/'),
        api.get('/academics/terms/current/').catch(()=>({ data: null })),
      ])
      const exArr = Array.isArray(ex.data) ? ex.data : (Array.isArray(ex.data?.results) ? ex.data.results : [])
      const clArr = Array.isArray(cl.data) ? cl.data : (Array.isArray(cl.data?.results) ? cl.data.results : [])
      const sbjArr = Array.isArray(sbj.data) ? sbj.data : (Array.isArray(sbj.data?.results) ? sbj.data.results : [])
      setExams(exArr)
      setClasses(clArr)
      setSubjects(sbjArr)
      setCurrentTerm(term?.data || null)
      // Set defaults for modal: current term and today's date
      setExamForm(prev => ({
        ...prev,
        term: term?.data?.number || prev.term,
        date: prev.date || new Date().toISOString().slice(0,10),
      }))
    }catch(err){
      setBanner(err?.response?.data?.detail || 'Failed to load exams')
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [])

  // Derive grade options from classes
  const gradeOptions = Array.from(new Set((Array.isArray(classes)?classes:[]).map(c=>c.grade_level))).filter(Boolean)

  // Compute filtered list
  const filteredExams = (Array.isArray(exams)?exams:[]).filter(e => {
    const klass = (Array.isArray(classes)?classes:[]).find(c=>c.id===e.klass)
    const className = klass?.name || ''
    const gradeLevel = klass?.grade_level || ''
    // search
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || className.toLowerCase().includes(q) || String(e.year).includes(q)
    // grade filter
    const matchesGrade = !filterGrade || gradeLevel === filterGrade
    // term filter
    const matchesTerm = !filterTerm || String(e.term) === String(filterTerm)
    // class filter
    const matchesClass = !filterClass || String(e.klass) === String(filterClass)
    // status filter
    const matchesStatus = filterStatus==='all' || (filterStatus==='published' ? !!e.published : !e.published)
    return matchesSearch && matchesGrade && matchesTerm && matchesClass && matchesStatus
  })

  const sortedExams = [...filteredExams].sort((a,b) => {
    if (sortBy === 'published_first'){
      const ap = a.published ? 0 : 1
      const bp = b.published ? 0 : 1
      if (ap !== bp) return ap - bp
      return String(b.date || '').localeCompare(String(a.date || ''))
    }
    if (sortBy === 'unpublished_first'){
      const ap = a.published ? 1 : 0
      const bp = b.published ? 1 : 0
      if (ap !== bp) return ap - bp
      return String(b.date || '').localeCompare(String(a.date || ''))
    }
    if (sortBy === 'oldest'){
      return String(a.date || '').localeCompare(String(b.date || ''))
    }
    return String(b.date || '').localeCompare(String(a.date || ''))
  })

  const publishedCount = (Array.isArray(exams) ? exams : []).filter(e=>!!e.published).length
  const draftCount = (Array.isArray(exams) ? exams : []).filter(e=>!e.published).length

  // Right-panel analytics (screenshot-style)
  const overviewDonut = useMemo(() => ({
    labels: ['Published', 'Draft', 'Pending', 'Archived'],
    datasets: [{
      data: [publishedCount, draftCount, 0, 0],
      backgroundColor: ['#22c55e', '#7c3aed', '#f59e0b', '#94a3b8'],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }]
  }), [publishedCount, draftCount])

  const examsByClass = useMemo(() => {
    const map = new Map()
    ;(Array.isArray(exams) ? exams : []).forEach(e => {
      const klass = (Array.isArray(classes) ? classes : []).find(c => c.id === e.klass)
      const key = klass?.name || `Class ${e.klass}`
      map.set(key, (map.get(key) || 0) + 1)
    })
    const items = Array.from(map.entries()).map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
    return items
  }, [exams, classes])

  const examsByClassChart = useMemo(() => ({
    labels: examsByClass.map(i => i.label),
    datasets: [{
      label: 'Exams',
      data: examsByClass.map(i => i.value),
      backgroundColor: 'rgba(79,70,229,0.9)',
      borderRadius: 999,
      barThickness: 10,
    }]
  }), [examsByClass])

  const upcomingExams = useMemo(() => {
    const list = (Array.isArray(exams) ? exams : [])
      .filter(e => e?.date && new Date(e.date).getTime() >= new Date().setHours(0, 0, 0, 0))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 3)
    return list
  }, [exams])

  const latestPublished = useMemo(() => {
    const list = (Array.isArray(exams) ? exams : [])
      .filter(e => e?.published && e?.published_at)
      .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
    return list[0] || null
  }, [exams])

  // Selection helpers
  const allFilteredIds = filteredExams.map(e=>e.id)
  const allSelected = allFilteredIds.length>0 && allFilteredIds.every(id=>selected.has(id))
  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  const toggleSelectAll = () => {
    setSelected(prev => {
      const n = new Set(prev)
      const shouldSelect = !allSelected
      for (const id of allFilteredIds){
        if (shouldSelect) n.add(id); else n.delete(id)
      }
      return n
    })
  }

  const bulkDeleteExams = async () => {
    const ids = Array.from(selected)
    if (ids.length===0) return
    openConfirm({
      title: 'Delete exams',
      message: `Delete ${ids.length} selected exam(s)?`,
      intentText: 'This action cannot be undone. Exams and associated results may be lost.',
      confirmText: 'Delete',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        try{
          setBulkDeleting(true)
          const results = await Promise.allSettled(ids.map(id => api.delete(`/academics/exams/${id}/`)))
          const ok = results.filter(r=>r.status==='fulfilled').length
          const fail = results.length - ok
          setBanner(`Deleted ${ok} exam(s)${fail? `, ${fail} failed`:''}`)
        }catch(err){
          setBanner(err?.response?.data?.detail || 'Bulk delete failed')
        }finally{
          setBulkDeleting(false)
          setSelected(new Set())
          load()
        }
      }
    })
  }

  const openResults = async (exam) => {
    setSelectedExam(exam)
    const st = await api.get(`/academics/students/?klass=${exam.klass}`)
    const stArr = Array.isArray(st.data) ? st.data : (Array.isArray(st.data?.results) ? st.data.results : [])
    setStudents(stArr)
    // initialize results grid: each student x each subject in class subjects
    const klass = classes.find(c => c.id === exam.klass)
    // Only include examinable subjects
    const subjObjs = Array.isArray(klass?.subjects) ? klass.subjects.filter(s => s?.is_examinable) : []
    const subjectIds = subjObjs.map(s=>s.id)
    setModalSubjects(subjObjs)
    // Prefill with existing results for this exam
    let existing = []
    try{
      const { data } = await api.get(`/academics/exam_results/?exam=${exam.id}`)
      existing = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
    }catch{}
    const existingMap = new Map()
    existing.forEach(r => {
      existingMap.set(`${r.student}-${r.subject}`, r.marks)
    })
    const rows = []
    for (const s of stArr) {
      for (const sid of subjectIds) {
        const key = `${s.id}-${sid}`
        rows.push({ student: s.id, subject: sid, marks: existingMap.has(key) ? existingMap.get(key) : '' })
      }
    }
    setResults(rows)
    setShowEnterResults(true)
  }

  // Edit exam handlers
  const openEdit = (exam) => {
    if (!exam) return
    setEditExam(exam)
    setEditForm({
      name: exam.name || '',
      year: exam.year || new Date().getFullYear(),
      term: exam.term || 1,
      klass: exam.klass,
      date: exam.date,
      total_marks: exam.total_marks || 100,
    })
    setShowEditExam(true)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editExam) return
    try{
      setStatus('saving')
      await api.patch(`/academics/exams/${editExam.id}/`, {
        name: editForm.name,
        year: Number(editForm.year),
        term: Number(editForm.term),
        klass: Number(editForm.klass),
        date: editForm.date,
        total_marks: Number(editForm.total_marks) || 100,
      })
      setShowEditExam(false)
      setEditExam(null)
      setStatus('idle')
      load()
    }catch(err){
      setError(err?.response?.data ? JSON.stringify(err.response.data) : err?.message || 'Failed to update exam')
      setStatus('idle')
    }
  }

  const deleteExam = async (exam) => {
    if (!exam) return
    openConfirm({
      title: 'Delete exam',
      message: `Delete “${exam.name}”?`,
      intentText: 'This cannot be undone. Ensure you exported/verified results if needed.',
      confirmText: 'Delete',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        try{
          setDeletingId(exam.id)
          await api.delete(`/academics/exams/${exam.id}/`)
          setDeletingId(null)
          load()
        }catch(err){
          setDeletingId(null)
          setBanner(err?.response?.data?.detail || 'Failed to delete exam')
        }
      }
    })
  }

  const viewResults = async (exam) => {
    setSelectedExam(exam)
    setError('')
    const { data } = await api.get(`/academics/exams/${exam.id}/summary/`)
    setResultsSummary(data)
    setShowResults(true)
  }

  const createExam = async (e) => {
    e.preventDefault()
    setError('')
    const termVal = Number(examForm.term || currentTerm?.number || 1)
    const nameStr = String(examForm.name || '').trim()
    if (!nameStr) return setError('Provide a valid exam name')

    if (examForm.mode === 'classes'){
      const targets = (examForm.classes || []).map(Number).filter(Boolean)
      if (targets.length === 0) return setError('Select at least one class')
      for (const klass of targets){
        await api.post('/academics/exams/', {
          name: nameStr,
          term: termVal,
          year: Number(examForm.year),
          total_marks: Number(examForm.total_marks) || 100,
          date: examForm.date,
          klass,
        })
      }
    } else {
      const grades = Array.isArray(examForm.grades) ? examForm.grades.filter(Boolean) : []
      if (grades.length === 0) return setError('Select at least one grade')
      for (const g of grades){
        const payload = {
          names: [nameStr],
          term: termVal,
          year: Number(examForm.year),
          total_marks: Number(examForm.total_marks) || 100,
          date: examForm.date,
          grade: String(g).trim(),
          publish: false,
        }
        await api.post('/academics/exams/common-bulk-create/', payload)
      }
    }
    setShowCreateExam(false)
    setExamForm({ name:'Mid Term', year:new Date().getFullYear(), term:(currentTerm?.number || 1), grades:[], classes:[], mode:'grade', date:'', total_marks:100 })
    load()
  }

  const saveResults = async (e) => {
    e.preventDefault()
    setStatus('saving')
    setError('')
    try {
      // Convert results to API format
      const payload = results.map(r => ({
        exam: selectedExam.id,
        student: r.student,
        subject: r.subject,
        marks: parseFloat(r.marks) || 0
      }))
      await api.post(`/academics/exam_results/bulk/`, { results: payload })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : err?.message || 'Failed to save results')
      setStatus('idle')
    }
  }

  return (
    <React.Fragment>
      <div className="max-w-[1600px] mx-auto space-y-6 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
        {/* Header (matches screenshot style) */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <FileText size={22} />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">Exams Management</h1>
              <p className="text-gray-500 font-semibold text-sm">Create, manage and publish student examinations.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCalendar(true)}
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-4 py-2.5 rounded-xl font-black text-xs border border-gray-200 shadow-sm hover:bg-gray-50 transition-all"
            >
              <Calendar size={16} className="text-gray-500" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => navigate('/admin/results')}
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-4 py-2.5 rounded-xl font-black text-xs border border-gray-200 shadow-sm hover:bg-gray-50 transition-all"
            >
              <FileSpreadsheet size={16} className="text-gray-500" />
              <span>Results</span>
            </button>
            <button
              onClick={() => setShowCreateExam(true)}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-soft hover:bg-indigo-700 transition-all"
            >
              <Plus size={18} />
              <span>New Exam</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* LEFT: stats + table */}
          <div className="xl:col-span-2 space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black text-gray-900">{(Array.isArray(exams) ? exams.length : 0).toLocaleString()}</div>
                <div className="text-xs font-semibold text-gray-500">Total Examinations</div>
                <button type="button" className="mt-2 text-xs font-black text-indigo-600 hover:underline">View all ›</button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                    <CheckCircle2 size={18} />
                  </div>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">LIVE</span>
                </div>
                <div className="mt-3 text-2xl font-black text-gray-900">{publishedCount.toLocaleString()}</div>
                <div className="text-xs font-semibold text-gray-500">Published Exams</div>
                <button type="button" className="mt-2 text-xs font-black text-indigo-600 hover:underline">View all ›</button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
                    <Edit3 size={18} />
                  </div>
                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">DRAFT</span>
                </div>
                <div className="mt-3 text-2xl font-black text-gray-900">{draftCount.toLocaleString()}</div>
                <div className="text-xs font-semibold text-gray-500">Pending Publication</div>
                <button type="button" className="mt-2 text-xs font-black text-indigo-600 hover:underline">View all ›</button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
                    <LayoutGrid size={18} />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black text-gray-900">{(Array.isArray(classes) ? classes.length : 0).toLocaleString()}</div>
                <div className="text-xs font-semibold text-gray-500">Active Classes</div>
                <button type="button" className="mt-2 text-xs font-black text-indigo-600 hover:underline">View all ›</button>
              </div>
            </div>

            {/* Table card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden">
              {/* Toolbar row (screenshot-style) */}
              <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                      placeholder="Search exams, classes, or years..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm font-semibold"
                    />
                  </div>

                  <select
                    value={filterClass}
                    onChange={(e) => { setFilterClass(e.target.value); setPage(1) }}
                    className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold min-w-[160px]"
                  >
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  <select
                    value={filterTerm}
                    onChange={(e) => { setFilterTerm(e.target.value); setPage(1) }}
                    className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold min-w-[140px]"
                  >
                    <option value="">All Terms</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
                    className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold min-w-[150px]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="unpublished">Draft</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowFilters(v => !v)}
                    className={`h-10 px-4 rounded-xl border text-xs font-black inline-flex items-center gap-2 ${
                      showFilters ? 'bg-indigo-600 border-indigo-600 text-white shadow-soft' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Filter size={16} />
                    Filters
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSortBy('latest')}
                      className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-50"
                    >
                      Sort: Latest
                    </button>
                  </div>
                </div>

                {showFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setSearch(''); setFilterGrade(''); setFilterTerm(''); setFilterClass(''); setFilterStatus('all'); setPage(1) }}
                      className="h-10 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-50"
                    >
                      Reset
                    </button>
                    <div className="sm:col-span-3 text-xs text-gray-500 font-semibold flex items-center">
                      Showing {sortedExams.length.toLocaleString()} exams
                    </div>
                  </div>
                )}
              </div>

              {/* Bulk Action Bar */}
              {selected.size > 0 && (
                <div className="bg-indigo-600 px-5 py-3 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black">
                      {selected.size}
                    </div>
                    <span className="font-black">Exams Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={bulkPublishExams}
                      disabled={bulkPublishing}
                      className="h-9 px-3 rounded-xl bg-white text-indigo-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {bulkPublishing ? 'Publishing…' : 'Publish'}
                    </button>
                    <button
                      onClick={bulkDeleteExams}
                      disabled={bulkDeleting}
                      className="h-9 px-3 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {bulkDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                    <button onClick={() => setSelected(new Set())} className="h-9 w-9 rounded-xl bg-white/15 hover:bg-white/20 inline-flex items-center justify-center">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {banner && (
                <div className="m-5 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3 text-indigo-700">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="text-sm font-black">{banner}</p>
                  <button onClick={() => setBanner('')} className="ml-auto text-indigo-400 hover:text-indigo-600">
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Pagination */}
              {(() => {
                const PAGE_SIZE = 6
                const totalPages = Math.max(1, Math.ceil((sortedExams?.length || 0) / PAGE_SIZE))
                const start = (page - 1) * PAGE_SIZE
                const end = start + PAGE_SIZE
                const pageItems = (sortedExams || []).slice(start, end)

                return (
                  <>
                    {/* Table Container */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="p-6 w-12 text-center">
                    <div className="flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={allSelected} 
                        onChange={toggleSelectAll}
                        className="w-5 h-5 rounded-lg border-gray-200 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                      />
                    </div>
                  </th>
                  <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Exam Details</th>
                  <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Academic Info</th>
                  <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Date & Total</th>
                  <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageItems.map(e => {
                  const klass = classes.find(c => c.id === e.klass);
                  return (
                    <tr key={e.id} className={`group transition-all hover:bg-gray-50/80 ${selected.has(e.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            checked={selected.has(e.id)} 
                            onChange={() => toggleSelect(e.id)}
                            className="w-5 h-5 rounded-lg border-gray-200 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                          />
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => openByName(e.name)} 
                            className="text-base font-bold text-gray-900 hover:text-blue-600 text-left transition-colors"
                          >
                            {e.name}
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-wider">ID #{e.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-gray-700">{klass?.name || e.klass}</span>
                          <span className="text-xs font-medium text-gray-500">{e.year} • Term {e.term}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-gray-700">{e.date}</span>
                          <span className="text-xs font-medium text-gray-500">Max Marks: {e.total_marks}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        {e.published ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <CheckCircle2 size={14} />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-500 border border-gray-200">
                            <Edit3 size={14} />
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="p-6">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              navigate(`/admin/exams/${e.id}/enter`);
                            }}
                            onTouchEnd={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              navigate(`/admin/exams/${e.id}/enter`);
                            }}
                            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                            title="Enter Marks"
                            type="button"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button 
                            onClick={() => navigate(`/admin/results?exam=${e.id}&grade=${encodeURIComponent(klass?.grade_level || '')}`)}
                            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                            title="View Results"
                          >
                            <FileText size={18} />
                          </button>
                          <div className="w-px h-6 bg-gray-200 mx-1" />
                          {e.published ? (
                            <button 
                              onClick={() => unpublishExam(e)}
                              disabled={unpublishingId === e.id}
                              className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all shadow-sm active:scale-95"
                              title="Unpublish"
                            >
                              <Ban size={18} />
                            </button>
                          ) : (
                            <button 
                              onClick={() => publishExam(e)}
                              disabled={publishingId === e.id}
                              className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-sm active:scale-95"
                              title="Publish"
                            >
                              <Send size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => openEdit(e)}
                            className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-200 transition-all shadow-sm active:scale-95"
                            title="Edit Exam"
                          >
                            <MoreVertical size={18} />
                          </button>
                          <button 
                            onClick={() => deleteExam(e)}
                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                            title="Delete Exam"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
                      </table>
                    </div>

                    <div className="px-5 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-500">
                        Showing {(sortedExams?.length || 0) ? (start + 1) : 0} to {Math.min(end, sortedExams?.length || 0)} of {(sortedExams?.length || 0).toLocaleString()} exams
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="h-9 w-9 rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-40"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </>
                )
              })()}

          {loading && (
            <div className="p-20 flex flex-col items-center justify-center gap-4 text-gray-400">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
              <p className="font-bold text-gray-500">Retrieving examination records...</p>
            </div>
          )}
          
          {!loading && sortedExams.length === 0 && (
            <div className="p-20 flex flex-col items-center justify-center gap-4 text-gray-400">
              <div className="p-6 bg-gray-50 rounded-full">
                <Search size={48} className="text-gray-200" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">No exams found</p>
                <p className="text-sm font-medium">Try adjusting your filters or search query.</p>
              </div>
              <button 
                onClick={() => { setSearch(''); setFilterGrade(''); setFilterTerm(''); setFilterClass(''); setFilterStatus('all'); }}
                className="text-blue-600 font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
            </div>
          </div>

          {/* RIGHT: analytics panels */}
          <div className="space-y-6">
            <Card
              title="Exams Overview"
              right={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Term</span>}
            >
              <div className="h-[220px]">
                <Doughnut
                  data={overviewDonut}
                  options={{
                    maintainAspectRatio: false,
                    cutout: '72%',
                    plugins: {
                      legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, font: { size: 11, weight: '700' } } },
                      tooltip: { enabled: true },
                      centerText: { text: (Array.isArray(exams) ? exams.length : 0).toLocaleString(), subtext: 'Total', fontSize: 22, subFontSize: 11 },
                    },
                  }}
                />
              </div>
            </Card>

            <Card
              title="Exams by Class"
              right={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Term</span>}
            >
              <div className="h-[180px]">
                <Bar
                  data={examsByClassChart}
                  options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.20)' }, ticks: { font: { size: 10, weight: '700' }, color: '#6b7280' } },
                      y: { grid: { display: false }, ticks: { font: { size: 10, weight: '800' }, color: '#111827' } },
                    },
                  }}
                />
              </div>
            </Card>

            <Card
              title="Upcoming Exams"
              right={<button type="button" className="text-xs font-black text-indigo-600 hover:underline" onClick={() => setShowCalendar(true)}>View Calendar</button>}
            >
              <div className="space-y-3">
                {upcomingExams.length === 0 ? (
                  <div className="text-sm text-gray-500 font-semibold">No upcoming exams.</div>
                ) : (
                  upcomingExams.map((e) => {
                    const klass = classes.find(c => c.id === e.klass)
                    const badge = fmtDateBadge(e.date)
                    return (
                      <div key={e.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="w-12 rounded-xl border border-gray-200 bg-gray-50 text-center py-2">
                          <div className="text-[9px] font-black text-gray-500">{badge.m}</div>
                          <div className="text-base font-black text-gray-900 leading-none">{badge.day}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-gray-900 truncate">{e.name}</div>
                          <div className="text-xs font-semibold text-gray-500 truncate">{klass?.name || e.klass} • Term {e.term}</div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                          e.published ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {e.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

            <Card
              title="Recent Activity"
              right={<button type="button" className="text-xs font-black text-indigo-600 hover:underline" onClick={() => navigate('/admin/results')}>View All</button>}
            >
              {latestPublished ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-gray-900 truncate">
                      {latestPublished.name} was published
                    </div>
                    <div className="text-xs font-semibold text-gray-500">
                      By {String(latestPublished?.published_by_name || 'System')} • {timeAgo(latestPublished.published_at)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 font-semibold">No recent activity.</div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Create Exam Modal */}
      <Modal open={showCreateExam} onClose={()=>setShowCreateExam(false)} title="Create Exam" size="md">
        <form onSubmit={createExam} className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input className="border p-2 rounded bg-white placeholder-gray-400" placeholder="Name (e.g., Mid Term)" value={examForm.name} onChange={e=>setExamForm({...examForm, name:e.target.value})} required />
            <input className="border p-2 rounded bg-white placeholder-gray-400" type="number" placeholder="Year" value={examForm.year} onChange={e=>setExamForm({...examForm, year:e.target.value})} required />
            <select className="border p-2 rounded bg-white" value={examForm.term} onChange={e=>setExamForm({...examForm, term:Number(e.target.value)})}>
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={()=>setExamForm(prev=>({...prev, mode:'grade'}))} className={`px-3 py-1.5 rounded border ${examForm.mode==='grade'?'bg-blue-50 border-blue-300 text-blue-700':'bg-white'}`}>By Grade</button>
            <button type="button" onClick={()=>setExamForm(prev=>({...prev, mode:'classes'}))} className={`px-3 py-1.5 rounded border ${examForm.mode==='classes'?'bg-blue-50 border-blue-300 text-blue-700':'bg-white'}`}>By Classes</button>
          </div>
          {examForm.mode==='grade' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <select className="border p-2 rounded md:col-span-2 bg-white" multiple value={examForm.grades} onChange={e=>{
                const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
                setExamForm({...examForm, grades: opts})
              }}>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input className="border p-2 rounded bg-white" type="date" value={examForm.date} onChange={e=>setExamForm({...examForm, date:e.target.value})} required />
              <div className="md:col-span-3 flex items-center gap-2 text-sm">
                <button type="button" className="px-2 py-1 rounded border" onClick={()=> setExamForm(prev=>({...prev, grades: gradeOptions}))}>Select All Grades</button>
                <button type="button" className="px-2 py-1 rounded border" onClick={()=> setExamForm(prev=>({...prev, grades: []}))}>Clear</button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <select className="border p-2 rounded md:col-span-2 bg-white" multiple value={examForm.classes} onChange={e=>{
                const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
                setExamForm({...examForm, classes: opts})
              }} required>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.grade_level}</option>)}
              </select>
              <input className="border p-2 rounded bg-white" type="date" value={examForm.date} onChange={e=>setExamForm({...examForm, date:e.target.value})} required />
              <div className="md:col-span-3 flex items-center gap-2 text-sm">
                <button type="button" className="px-2 py-1 rounded border" onClick={()=> setExamForm(prev=>({...prev, classes: classes.map(c=>String(c.id))}))}>Select All Classes</button>
                <button type="button" className="px-2 py-1 rounded border" onClick={()=> setExamForm(prev=>({...prev, classes: []}))}>Clear</button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-1">
            <button type="button" onClick={()=>setShowCreateExam(false)} className="px-4 py-2 rounded border bg-white">Cancel</button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmOpen} onClose={closeConfirm} title={confirmTitle} size="sm">
        <div className="space-y-3">
          {confirmMessage && (
            <div className="text-sm text-gray-800">{confirmMessage}</div>
          )}
          {confirmIntentText && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {confirmIntentText}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeConfirm} disabled={confirmBusy} className={`px-4 py-2 rounded border bg-white ${confirmBusy? 'opacity-60 cursor-not-allowed':''}`}>Cancel</button>
            <button type="button" onClick={runConfirm} disabled={confirmBusy} className={`px-4 py-2 rounded text-white ${confirmButtonClass} ${confirmBusy? 'opacity-60 cursor-not-allowed':''}`}>{confirmBusy ? 'Please wait…' : confirmButtonText}</button>
          </div>
        </div>
      </Modal>

      {/* Edit Exam Modal */}
      <Modal open={showEditExam} onClose={()=>setShowEditExam(false)} title="Edit Exam" size="md">
        <form onSubmit={saveEdit} className="grid gap-3 md:grid-cols-3">
          {error && (
            <div className="md:col-span-3 bg-red-50 text-red-700 text-sm p-2 rounded">{typeof error === 'string' ? error : JSON.stringify(error)}</div>
          )}
          <input className="border p-2 rounded bg-white placeholder-gray-400" placeholder="Name (e.g., Opener)" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} required />
          <input className="border p-2 rounded bg-white placeholder-gray-400" type="number" placeholder="Year" value={editForm.year} onChange={e=>setEditForm({...editForm, year:e.target.value})} required />
          <select className="border p-2 rounded bg-white" value={editForm.term} onChange={e=>setEditForm({...editForm, term:Number(e.target.value)})}>
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
          <select className="border p-2 rounded md:col-span-2 bg-white" value={editForm.klass} onChange={e=>setEditForm({...editForm, klass:e.target.value})}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>)}
          </select>
          <input className="border p-2 rounded bg-white" type="date" value={editForm.date} onChange={e=>setEditForm({...editForm, date:e.target.value})} required />
          <input className="border p-2 rounded" type="number" min={1} value={editForm.total_marks} onChange={e=>setEditForm({...editForm, total_marks:e.target.value})} />
          <div className="md:col-span-3 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowEditExam(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button disabled={status==='saving'} className="bg-blue-600 text-white px-4 py-2 rounded">{status==='saving' ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Enter Results Modal */}
      <Modal open={showEnterResults} onClose={()=>setShowEnterResults(false)} title="Enter Results" size="xl">
        <form onSubmit={saveResults} className="space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Student</th>
                  {modalSubjects.map(s => (
                    <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map(stu => (
                  <tr key={stu.id}>
                    <td className="border px-2 py-1">{stu.name}</td>
                    {modalSubjects.map(s => {
                      const idx = results.findIndex(r => r.student===stu.id && r.subject===s.id)
                      const val = idx>-1 ? results[idx].marks : ''
                      return (
                        <td key={s.id} className="border px-2 py-1">
                          <input className="border p-1 rounded w-20 bg-white" value={val} onChange={e=>{
                            const v = e.target.value
                            setResults(prev => {
                              const copy = [...prev]
                              const i = copy.findIndex(r => r.student===stu.id && r.subject===s.id)
                              if (i>-1) copy[i] = { ...copy[i], marks: v }
                              return copy
                            })
                          }} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={()=>setShowEnterResults(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button disabled={status==='saving'} className={`text-white px-4 py-2 rounded ${status==='saved' ? 'bg-green-600' : 'bg-blue-600'}`}>{status==='saving' ? 'Saving...' : status==='saved' ? 'Saved' : 'Save Results'}</button>
          </div>
        </form>
      </Modal>

      {/* Results Summary Modal */}
      <Modal open={showResults} onClose={()=>setShowResults(false)} title="Results Summary" size="xl">
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{error}</div>}
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Student</th>
                  {resultsSummary.subjects.map(s => (
                    <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
                  ))}
                  <th className="border px-2 py-1 text-left">Total</th>
                  <th className="border px-2 py-1 text-left">Average</th>
                </tr>
              </thead>
              <tbody>
                {resultsSummary.students.map(st => (
                  <tr key={st.id}>
                    <td className="border px-2 py-1">{st.name}</td>
                    {resultsSummary.subjects.map(s => (
                      <td key={s.id} className="border px-2 py-1">{st.marks?.[String(s.id)] ?? '-'}</td>
                    ))}
                    <td className="border px-2 py-1 font-medium">{st.total}</td>
                    <td className="border px-2 py-1">{st.average}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button onClick={()=>setShowResults(false)} className="px-4 py-2 rounded border">Close</button>
          </div>
        </div>
      </Modal>

      {/* Calendar Modal */}
      <Modal open={showCalendar} onClose={()=>setShowCalendar(false)} title="Exam Calendar" size="xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-gray-900">{calMonth.toLocaleString(undefined,{ month:'long', year:'numeric' })}</div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setCalMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()-1); return d })} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Previous month">‹</button>
              <button onClick={()=>setCalMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()+1); return d })} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Next month">›</button>
              <button onClick={()=>setCalMonth(new Date())} className="px-2 py-1 text-xs rounded-full border border-gray-200 hover:bg-gray-50">Today</button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-[11px] font-semibold text-gray-500">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="px-1 py-1 text-center tracking-wide">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((d,i)=>{
              const key = localKey(d)
              const inMonth = d.getMonth()===calMonth.getMonth()
              const isToday = key===localKey(new Date())
              const items = examsByDate[key] || []
              return (
                <button type="button" key={i} onClick={()=>{ setDayKey(key); setDayItems(items); setDayOpen(true) }} className={`text-left relative rounded-xl min-h-[84px] p-2 text-xs border ${inMonth? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200/70'} hover:border-blue-300 hover:shadow-soft transition-all`}>
                  <div className="flex items-center justify-between">
                    <div className={`${inMonth? 'text-gray-800':'text-gray-400'} text-[11px] font-semibold`}>{d.getDate()}</div>
                    {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Today</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {items.slice(0,3).map(ev => {
                      const klassName = classes.find(c=>c.id===ev.klass)?.name || ev.klass
                      return (
                        <span key={ev.id} className="px-1.5 py-0.5 rounded-full text-[10px] border bg-rose-50 text-rose-700 border-rose-200 truncate max-w-full" title={`${ev.name} — ${klassName}`}>
                          {ev.name}
                        </span>
                      )
                    })}
                    {items.length>3 && <span className="text-[10px] text-gray-500">+{items.length-3} more</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </Modal>
      <Modal open={dayOpen} onClose={()=>setDayOpen(false)} title={`Exams — ${dayKey}`} size="md">
        <div className="space-y-2">
          {dayItems.length===0 ? (
            <div className="text-sm text-gray-600">No exams on this day.</div>
          ) : (
            dayItems.map(ev => (
              <div key={ev.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{ev.name}</div>
                  <div className="text-xs text-gray-600 truncate">{classes.find(c=>c.id===ev.klass)?.name || ev.klass} • {ev.date}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button onClick={()=>{ setDayOpen(false); openEdit(ev) }} className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50">Edit</button>
                  <button 
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDayOpen(false);
                      navigate(`/admin/exams/${ev.id}/enter`);
                    }}
                    onTouchEnd={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDayOpen(false);
                      navigate(`/admin/exams/${ev.id}/enter`);
                    }}
                    className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50 cursor-pointer"
                    type="button"
                  >Enter</button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Grouped by Exam Name Modal */}
      <Modal open={groupedOpen} onClose={()=>setGroupedOpen(false)} title={`Exams — ${groupedName}`} size="xl">
        <div className="space-y-3">
          {groupedItems.length === 0 ? (
            <div className="text-sm text-gray-600">No exams found for this name.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Grade</th>
                    <th className="border px-2 py-1 text-left">Class</th>
                    <th className="border px-2 py-1 text-left">Year</th>
                    <th className="border px-2 py-1 text-left">Term</th>
                    <th className="border px-2 py-1 text-left">Date</th>
                    <th className="border px-2 py-1 text-left">Status</th>
                    <th className="border px-2 py-1 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map(item => (
                    <tr key={item.id}>
                      <td className="border px-2 py-1">{item.grade_level_tag || item.klass?.grade_level || '-'}</td>
                      <td className="border px-2 py-1">{item.klass?.name || '-'}</td>
                      <td className="border px-2 py-1">{item.year}</td>
                      <td className="border px-2 py-1">T{item.term}</td>
                      <td className="border px-2 py-1">{item.date}</td>
                      <td className="border px-2 py-1">{item.published ? 'Published' : 'Draft'}</td>
                      <td className="border px-2 py-1">
                        <div className="flex gap-3">
                          <button onClick={()=>viewResults({ id: item.id })} className="text-green-700">View Results</button>
                          <button onClick={()=>navigate(`/admin/results?exam=${item.id}&grade=${encodeURIComponent(item.grade_level_tag || item.klass?.grade_level || '')}`)} className="text-indigo-700">Results Page</button>
                          <button onClick={()=>publishExam({ id: item.id, name: groupedName, published: item.published })} disabled={!!item.published} className={`text-purple-700 ${item.published? 'opacity-50 cursor-not-allowed':''}`}>{item.published ? 'Published' : 'Publish'}</button>
                          <button onClick={()=>unpublishExam({ id: item.id, name: groupedName, published: item.published })} disabled={!item.published} className={`text-orange-700 ${!item.published? 'opacity-50 cursor-not-allowed':''}`}>Unpublish</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={()=>setGroupedOpen(false)} className="px-4 py-2 rounded border">Close</button>
          </div>
        </div>
      </Modal>
    </React.Fragment>
  )
}
