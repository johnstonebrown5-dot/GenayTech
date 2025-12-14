import React, { useEffect, useState } from 'react'
import api from '../api'
import Modal from '../components/Modal'
import { useNavigate } from 'react-router-dom'

export default function AdminExams(){
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [modalSubjects, setModalSubjects] = useState([]) // subjects for selected exam/class

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
  const [filterStatus, setFilterStatus] = useState('all') // all|published|unpublished

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

  const bulkPublishExams = async () => {
    const ids = Array.from(selected)
    if (ids.length===0) return
    if (!window.confirm(`Publish results for ${ids.length} selected exam(s)?`)) return
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
      setBanner(`Published results for ${exam.name}. Students have been notified.`)
      // Refresh list to reflect published flag
      load()
    } catch (err) {
      setBanner(err?.response?.data?.detail || 'Failed to publish results')
    } finally {
      setPublishingId(null)
    }
  }

  const load = async () => {
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
    // class filter
    const matchesClass = !filterClass || String(e.klass) === String(filterClass)
    // status filter
    const matchesStatus = filterStatus==='all' || (filterStatus==='published' ? !!e.published : !e.published)
    return matchesSearch && matchesGrade && matchesClass && matchesStatus
  })

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
    if (!window.confirm(`Delete ${ids.length} selected exam(s)? This cannot be undone.`)) return
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
    try{
      if (!window.confirm('Delete this exam? This cannot be undone.')) return
      setDeletingId(exam.id)
      await api.delete(`/academics/exams/${exam.id}/`)
      setDeletingId(null)
      load()
    }catch(err){
      setDeletingId(null)
      setBanner(err?.response?.data?.detail || 'Failed to delete exam')
    }
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
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Exams</h1>

        <div className="bg-white rounded-xl shadow-card border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="font-medium text-gray-800">Manage Exams</div>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto -mx-1 px-1">
            <button
              onClick={()=>setShowCalendar(true)}
              className="shrink-0 flex-1 sm:flex-none inline-flex items-center justify-center gap-0 sm:gap-2 bg-gray-800 text-white px-2.5 sm:px-3.5 py-2 rounded-lg hover:bg-gray-900"
              aria-label="View Calendar"
            >
              <span className="text-xs sm:text-sm font-semibold">Exam Calendar</span>
            </button>
            <button
              onClick={()=>setShowCreateExam(true)}
              className="shrink-0 flex-1 sm:flex-none inline-flex items-center justify-center gap-0 sm:gap-2 bg-blue-600 text-white px-2.5 sm:px-3.5 py-2 rounded-lg hover:bg-blue-700"
              aria-label="Create Exam"
            >
              <span className="text-xs sm:text-sm font-semibold">New Exam</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">Exams</h2>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
              aria-label={showFilters ? 'Hide filters' : 'Show filters'}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M6 12h12M10 19h4" />
              </svg>
              <span className="hidden xs:inline">Filters</span>
              <span className="xs:hidden">Filter</span>
            </button>
          </div>
          {banner && (
            <div className="mb-2 text-sm bg-blue-50 text-blue-800 px-3 py-2 rounded">{banner}</div>
          )}
          {/* Filters */}
          <div className={`${showFilters ? '' : 'hidden'} grid gap-2 md:gap-3 md:grid-cols-5 mb-3`}>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Search</span>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"/></svg>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, class, year" className="border pl-9 pr-9 py-2 rounded-lg w-full shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-gray-400" />
                {search && (
                  <button type="button" onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:bg-gray-100" aria-label="Clear search">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12"/></svg>
                  </button>
                )}
              </div>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Grade</span>
              <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} className="border p-2 rounded w-full bg-white">
                <option value="">All Grades</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Class</span>
              <select value={filterClass} onChange={e=>setFilterClass(e.target.value)} className="border p-2 rounded w-full bg-white">
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Status</span>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border p-2 rounded w-full bg-white">
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </label>
            <div className="flex items-end">
              <button onClick={()=>{setSearch('');setFilterGrade('');setFilterClass('');setFilterStatus('all')}} className="w-full border px-3 py-2 rounded">Clear</button>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Selected: {selected.size}</div>
            <div className="flex items-center gap-2">
              <button onClick={bulkPublishExams} disabled={selected.size===0 || bulkPublishing} className={`px-3 py-2 rounded ${selected.size===0? 'border text-gray-400' : 'bg-purple-600 text-white'}`}>{bulkPublishing? 'Publishing...' : 'Publish Selected'}</button>
              <button onClick={bulkDeleteExams} disabled={selected.size===0 || bulkDeleting} className={`px-3 py-2 rounded ${selected.size===0? 'border text-gray-400' : 'bg-red-600 text-white'}`}>{bulkDeleting? 'Deleting...' : 'Delete Selected'}</button>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {filteredExams.map(e => {
              const klassName = classes.find(c=>c.id===e.klass)?.name || e.klass
              const gradeLevel = classes.find(c=>c.id===e.klass)?.grade_level || ''
              return (
                <div key={e.id} className="p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <button onClick={()=>openByName(e.name)} className="font-medium text-blue-700 hover:underline" title="Show all classes for this exam name">{e.name}</button>
                    <div className="text-xs text-gray-500 truncate">{klassName} • {e.year} • T{e.term} • {e.date}</div>
                    <div className="text-[11px] text-gray-500">Total {e.total_marks}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${e.published? 'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-600'}`}>{e.published? 'Published':'Draft'}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>navigate(`/admin/exams/${e.id}/enter`)} className="text-blue-600 text-xs">Enter</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" /></th>
                  <th className="px-3 py-2">Name</th><th className="px-3 py-2">Year</th><th className="px-3 py-2">Term</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.map(e => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.has(e.id)} onChange={()=>toggleSelect(e.id)} aria-label={`Select exam ${e.name}`} /></td>
                    <td className="px-3 py-2">
                      <button onClick={()=>openByName(e.name)} className="text-blue-700 hover:underline" title="Show all classes for this exam name">{e.name}</button>
                    </td>
                    <td className="px-3 py-2">{e.year}</td>
                    <td className="px-3 py-2">T{e.term}</td>
                    <td className="px-3 py-2">{classes.find(c=>c.id===e.klass)?.name || e.klass}</td>
                    <td className="px-3 py-2">{e.date}</td>
                    <td className="px-3 py-2">{e.total_marks}</td>
                    <td className="px-3 py-2">{e.published ? (<span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">Published</span>) : (<span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">Draft</span>)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-3">
                        <button onClick={()=>openEdit(e)} className="text-gray-700">Edit</button>
                        <button onClick={()=>navigate(`/admin/exams/${e.id}/enter`)} className="text-blue-600">Enter Results</button>
                        <button onClick={()=>navigate(`/admin/results?exam=${e.id}&grade=${encodeURIComponent(classes.find(c=>c.id===e.klass)?.grade_level || '')}`)} className="text-indigo-700">Results Page</button>
                        <button onClick={()=>publishExam(e)} disabled={!!e.published || publishingId===e.id} className={`text-purple-700 ${e.published? 'opacity-50 cursor-not-allowed':''}`}>{publishingId===e.id ? 'Publishing...' : (e.published ? 'Published' : 'Publish')}</button>
                        <button onClick={()=>deleteExam(e)} disabled={deletingId===e.id} className={`text-red-700 ${deletingId===e.id? 'opacity-50':''}`}>{deletingId===e.id? 'Deleting...' : 'Delete'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            </div>
          )}
          <div className="flex justify-end gap-2 mt-1">
            <button type="button" onClick={()=>setShowCreateExam(false)} className="px-4 py-2 rounded border bg-white">Cancel</button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">Create</button>
          </div>
        </form>
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
                  <button onClick={()=>{ setDayOpen(false); navigate(`/admin/exams/${ev.id}/enter`) }} className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50">Enter</button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </React.Fragment>
  )
}
