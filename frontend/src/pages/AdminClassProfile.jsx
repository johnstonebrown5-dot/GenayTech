import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import api from '../api'

export default function AdminClassProfile(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [klass, setKlass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('class') // class | subjects | students | results
  const [searchParams, setSearchParams] = useSearchParams()
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [exams, setExams] = useState([])
  const [recentExam, setRecentExam] = useState(null)
  const [recentSummary, setRecentSummary] = useState({ subjects: [], students: [] })
  const [loadingResults, setLoadingResults] = useState(false)
  const [gradePerf, setGradePerf] = useState([]) // [{klass, klass_name, mean}]
  const [loadingGradePerf, setLoadingGradePerf] = useState(false)
  const [teachers, setTeachers] = useState([])
  const [allTeachers, setAllTeachers] = useState([])
  const [subjectTeachers, setSubjectTeachers] = useState([])
  const [teacherUsers, setTeacherUsers] = useState([])
  const [classHistory, setClassHistory] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [showAddStudents, setShowAddStudents] = useState(false)
  const [unassigned, setUnassigned] = useState([])
  const [unassignedSearch, setUnassignedSearch] = useState('')
  const [selectedUnassigned, setSelectedUnassigned] = useState([])
  const [addingStudents, setAddingStudents] = useState(false)
  const [addStudentsError, setAddStudentsError] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({ subject: '', teacher: '' })
  // Assign subjects modal state
  const [showAssignSubjects, setShowAssignSubjects] = useState(false)
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [subjectSearch, setSubjectSearch] = useState('')
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([])
  const [showReassignCT, setShowReassignCT] = useState(false)
  const [reassignTeacher, setReassignTeacher] = useState('')
  const availableCTs = useMemo(() => {
    const cid = String(id)
    const list = Array.isArray(teachers) ? teachers : []
    const preferred = list.filter(t => {
      const tk = t?.klass
      // allow if unassigned OR already assigned to this class
      return tk === null || tk === '' || typeof tk === 'undefined' || String(tk) === cid
    })
    // Fallback: if none match (e.g., everyone is assigned elsewhere), show all teachers
    return preferred.length > 0 ? preferred : list
  }, [teachers, id])

  useEffect(() => {
    let cancelled = false
    async function load(){
      try {
        setLoading(true)
        const { data } = await api.get(`/academics/classes/${id}/`)
        if (!cancelled) setKlass(data)
      } catch (e) {
        if (!cancelled) setError('Failed to load class')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function loadHistory(){
      try {
        setLoadingHistory(true)
        setHistoryError('')
        const { data } = await api.get(`/academics/classes/${id}/history/`)
        if (!cancelled) setClassHistory(data)
      } catch (e) {
        if (!cancelled) { setHistoryError('Failed to load class history'); setClassHistory(null) }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }
    if (activeTab === 'class') loadHistory()
    return ()=>{ cancelled = true }
  }, [id, activeTab])

  useEffect(() => {
    try{
      const t = (searchParams.get('tab') || '').toLowerCase()
      if (['class','subjects','students','results'].includes(t)) {
        setActiveTab(t)
      }
    }catch{}
  }, [searchParams])

  // Load students for this class (use dedicated endpoint to avoid pagination issues)
  useEffect(() => {
    let cancelled = false
    async function loadStudents(){
      try {
        setLoadingStudents(true)
        // Prefer class-specific roster endpoint
        let data = null
        try {
          const res = await api.get(`/academics/classes/${id}/students/`)
          data = res.data
        } catch (err) {
          // Fallback to generic endpoint with class filter (handle pagination too)
          const res2 = await api.get(`/academics/students/?classId=${encodeURIComponent(id)}`)
          data = Array.isArray(res2.data) ? res2.data : (Array.isArray(res2.data?.results) ? res2.data.results : [])
        }
        if (!cancelled) setStudents(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setStudents([])
      } finally {
        if (!cancelled) setLoadingStudents(false)
      }
    }
    if (activeTab === 'students' || !students.length) {
      loadStudents()
    }
    return () => { cancelled = true }
  }, [id, activeTab])

  const openAddStudents = async () => {
    setShowAddStudents(true)
    setAddStudentsError('')
    setSelectedUnassigned([])
    try {
      const all = []
      let url = '/academics/students/'
      for (let i = 0; i < 50; i++) {
        const res = await api.get(url)
        const data = res.data
        if (Array.isArray(data)) {
          all.push(...data)
          break
        }
        const pageItems = Array.isArray(data?.results) ? data.results : []
        all.push(...pageItems)
        const next = data?.next
        if (!next) break
        try {
          const nextUrl = new URL(next, window.location.origin)
          url = nextUrl.pathname + nextUrl.search
        } catch {
          url = next
        }
      }
      const filtered = all.filter(s => !s.klass && !s.is_graduated && s.is_active !== false)
      setUnassigned(filtered)
    } catch {
      setUnassigned([])
    }
  }

  const toggleUnassigned = (sid) => {
    setSelectedUnassigned(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid])
  }

  const saveAddStudents = async () => {
    if (!selectedUnassigned.length) { setShowAddStudents(false); return }
    try {
      setAddingStudents(true)
      setAddStudentsError('')
      await api.post(`/academics/classes/${id}/add-students/`, { students: selectedUnassigned })
      const res = await api.get(`/academics/classes/${id}/students/`)
      setStudents(Array.isArray(res.data) ? res.data : [])
      setShowAddStudents(false)
    } catch (e) {
      setAddStudentsError(e?.response?.data?.detail || 'Failed to add students')
    } finally {
      setAddingStudents(false)
    }
  }

  const subjects = Array.isArray(klass?.subjects) ? klass.subjects : []
  // Keep selected list in sync with current class when opening modal
  useEffect(() => {
    if (!showAssignSubjects) return
    setSelectedSubjectIds(subjects.map(s => s.id))
  }, [showAssignSubjects, subjects])

  const openAssignSubjects = async () => {
    try {
      setShowAssignSubjects(true)
      // Load ALL subjects (handle paginated responses)
      const all = []
      let url = '/academics/subjects/'
      for (let i = 0; i < 50; i++) { // safety upper bound
        const res = await api.get(url)
        const data = res.data
        if (Array.isArray(data)) {
          all.push(...data)
          break
        }
        const pageItems = Array.isArray(data?.results) ? data.results : []
        all.push(...pageItems)
        const next = data?.next
        if (!next) break
        // If next is absolute, convert to relative path for api client
        try {
          const nextUrl = new URL(next, window.location.origin)
          url = nextUrl.pathname + nextUrl.search
        } catch {
          url = next
        }
      }
      setAvailableSubjects(all)
    } catch {
      setAvailableSubjects([])
    }
  }

  const toggleSubject = (id) => {
    setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const saveAssignedSubjects = async () => {
    try {
      await api.patch(`/academics/classes/${id}/`, { subject_ids: selectedSubjectIds })
      // refresh class details to reflect selected subjects
      const { data } = await api.get(`/academics/classes/${id}/`)
      setKlass(data)
      setShowAssignSubjects(false)
    } catch {
      setShowAssignSubjects(false)
    }
  }
  // Teachers for dropdown: prefer server-filtered list; otherwise filter locally from the full list
  const filteredTeachers = useMemo(() => {
    const dedupByUserId = (arr) => {
      const seen = new Set()
      const out = []
      for (const t of arr) {
        const uid = t?.user?.id
        if (!uid || !seen.has(uid)) { out.push(t); if (uid) seen.add(uid) }
      }
      return out
    }
    if (subjectTeachers.length) return dedupByUserId(subjectTeachers)
    const base = dedupByUserId([...(allTeachers.length ? allTeachers : teachers), ...teacherUsers])
    if (!assignForm.subject) return base
    const subj = subjects.find(s => String(s.id) === String(assignForm.subject))
    if (!subj) return base
    const code = (subj.code || '').toLowerCase()
    const name = (subj.name || '').toLowerCase()
    const matched = base.filter(t => {
      const subjStr = (t.subjects || t.user?.subjects || '').toLowerCase()
      return (code && subjStr.includes(code)) || (name && subjStr.includes(name))
    })
    // If nothing matched (e.g., subjects not filled on profiles), show all school teachers
    return matched.length ? matched : base
  }, [assignForm.subject, subjects, teachers, allTeachers, subjectTeachers, teacherUsers])
  const classStudents = useMemo(() => {
    const cid = String(id)
    return students.filter(s => String(s.klass) === cid || String(s.klass_detail?.id || '') === cid)
  }, [students, id])
  const handleDownloadCsv = () => {
    const rows = [
      ['Admission No','Name','Guardian Phone']
    ]
    for (const s of classStudents) {
      rows.push([
        String(s.admission_no || ''),
        String(s.name || ''),
        String(s.guardian_id || '')
      ])
    }
    const csv = rows.map(r => r.map(v => '"' + String(v).replaceAll('"','""') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(klass?.name || 'class').replaceAll(' ','_')}_students.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const handlePrintList = () => {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    const title = `${klass?.name || 'Class'} — Students`
    const rows = classStudents.map(s => `<tr><td style="padding:6px;border:1px solid #e5e7eb">${s.admission_no||''}</td><td style="padding:6px;border:1px solid #e5e7eb">${s.name||''}</td><td style="padding:6px;border:1px solid #e5e7eb">${s.guardian_id||''}</td></tr>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial">
      <h2 style="margin:0 0 12px 0">${title}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr>
          <th style="text-align:left;padding:6px;border:1px solid #e5e7eb;background:#f9fafb">Admission No</th>
          <th style="text-align:left;padding:6px;border:1px solid #e5e7eb;background:#f9fafb">Name</th>
          <th style="text-align:left;padding:6px;border:1px solid #e5e7eb;background:#f9fafb">Guardian Phone</th>
        </tr></thead>
        <tbody>${rows || ''}</tbody>
      </table>
    </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }
  const handlePrintResults = () => {
    if (!recentExam) return
    const w = window.open('', '_blank', 'width=1000,height=800')
    if (!w) return
    const title = `${klass?.name || 'Class'} — ${recentExam.name || 'Exam'} Results`
    const subjHeaders = (recentSummary.subjects||[]).map(s => `<th style="border:1px solid #e5e7eb;padding:6px;text-align:center">${s.code||''}</th>`).join('')
    const bodyRows = (recentSummary.students||[]).map(st => {
      const cells = (recentSummary.subjects||[]).map(s => `<td style="border:1px solid #e5e7eb;padding:6px;text-align:center">${st.marks?.[String(s.id)] ?? '-'}</td>`).join('')
      const avg = typeof st.average === 'number' ? Number(st.average).toFixed(1) : (st.average || '-')
      return `<tr>
        <td style="position:sticky;left:0;background:#fff;border:1px solid #e5e7eb;padding:6px">${st.name||''}</td>
        ${cells}
        <td style="border:1px solid #e5e7eb;padding:6px;text-align:right;font-weight:600">${st.total ?? '-'}</td>
        <td style="border:1px solid #e5e7eb;padding:6px;text-align:right">${avg}</td>
      </tr>`
    }).join('')
    const meta = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px 0;font-size:12px;color:#374151">
        <div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;padding:6px 10px"><span style="font-size:10px;color:#6b7280">Exam</span> <span style="margin-left:8px;font-weight:600">${recentExam.name||'-'}</span></div>
        <div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;padding:6px 10px"><span style="font-size:10px;color:#6b7280">Year</span> <span style="margin-left:8px;font-weight:600">${recentExam.year||'-'}</span></div>
        <div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;padding:6px 10px"><span style="font-size:10px;color:#6b7280">Term</span> <span style="margin-left:8px;font-weight:600">T${recentExam.term||'-'}</span></div>
        <div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;padding:6px 10px"><span style="font-size:10px;color:#6b7280">Date</span> <span style="margin-left:8px;font-weight:600">${recentExam.date||'-'}</span></div>
      </div>`
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @media print {
          thead { position: sticky; top: 0; }
          .page-break { page-break-inside: avoid; }
        }
        table { border-collapse: collapse; width: 100%; font-size: 12px }
        th { background:#f9fafb }
      </style>
    </head><body style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial">
      <h2 style="margin:0 0 6px 0">${title}</h2>
      ${meta}
      <div class="page-break">
        <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:8px">
          <table>
            <thead>
              <tr>
                <th style="position:sticky;left:0;background:#f9fafb;border:1px solid #e5e7eb;padding:6px;text-align:left">Student</th>
                ${subjHeaders}
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:right">Total</th>
                <th style="border:1px solid #e5e7eb;padding:6px;text-align:right">Average</th>
              </tr>
            </thead>
            <tbody>${bodyRows || ''}</tbody>
          </table>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); }</script>
    </body></html>`)
    w.document.close()
    w.focus()
  }
  const genderStats = useMemo(() => {
    const boys = classStudents.filter(s => (s.gender || '').toLowerCase().startsWith('m')).length
    const girls = classStudents.filter(s => (s.gender || '').toLowerCase().startsWith('f')).length
    const total = classStudents.length
    return { boys, girls, total }
  }, [classStudents])

  // Load exams and derive most recent for this class
  useEffect(() => {
    let cancelled = false
    async function loadExams(){
      try {
        const { data } = await api.get('/academics/exams/', { params: { include_history: true } })
        if (cancelled) return
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
        setExams(arr)
        // filter by class id
        const cid = Number(id)
        const forClass = arr.filter(e => Number(e.klass) === cid)
        if (forClass.length === 0) { setRecentExam(null); return }
        // sort by date then id as fallback
        forClass.sort((a,b)=>{
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          if (db !== da) return db - da
          return (b.id||0) - (a.id||0)
        })
        const latest = forClass[0]
        setRecentExam(latest)
      } catch (e) {
        if (!cancelled) { setExams([]); setRecentExam(null) }
      }
    }
    loadExams()
    return ()=>{ cancelled = true }
  }, [id])

  // When recentExam changes, load its summary
  useEffect(() => {
    let cancelled = false
    async function loadSummary(){
      if (!recentExam?.id) { setRecentSummary({ subjects: [], students: [] }); return }
      try {
        setLoadingResults(true)
        const { data } = await api.get(`/academics/exams/${recentExam.id}/summary/`)
        if (!cancelled) setRecentSummary(data)
      } catch (e) {
        if (!cancelled) setRecentSummary({ subjects: [], students: [] })
      } finally {
        if (!cancelled) setLoadingResults(false)
      }
    }
    loadSummary()
    return ()=>{ cancelled = true }
  }, [recentExam])

  // Load teachers for assignment (admin scope)
  useEffect(() => {
    let cancelled = false
    async function loadTeachers(){
      try {
        const { data } = await api.get('/academics/teachers/')
        if (!cancelled) {
          const list = (Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])).filter(t => t?.user?.is_active !== false)
          setTeachers(list)
          setAllTeachers(list)
        }
      } catch (e) {
        if (!cancelled) { setTeachers([]); setAllTeachers([]) }
      }
      // Best effort: also load plain users with role=teacher for fallback
      try {
        const res = await api.get('/auth/users/?role=teacher')
        if (!cancelled) {
          const uArr = (Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.results) ? res.data.results : [])).filter(u => u?.is_active !== false)
          // Normalize into teacher-like objects
          const mapped = uArr.map(u=>({ id: null, user: u, subjects: '', klass: null, klass_detail: null }))
          setTeacherUsers(mapped)
        }
      } catch {}
    }
    loadTeachers()
    return ()=>{ cancelled = true }
  }, [])

  const subjectAssignments = useMemo(() => {
    const map = {}
    for (const a of (klass?.subject_teachers || [])) {
      map[String(a.subject)] = a
    }
    return map
  }, [klass])

  const openAssign = async (subjectId) => {
    const subjId = subjectId || ''
    setAssignForm({ subject: subjId, teacher: subjectAssignments[String(subjId)]?.teacher || '' })
    setShowAssignModal(true)
    // Load teachers filtered by subject for smaller dropdown and accuracy
    if (subjId) {
      try {
        // Try by subject id
        let out = []
        try {
          const r1 = await api.get(`/academics/teachers/?subject=${subjId}`)
          out = (Array.isArray(r1.data) ? r1.data : (Array.isArray(r1.data?.results) ? r1.data.results : [])).filter(t => t?.user?.is_active !== false)
        } catch {}
        // If empty, try by code or name
        if (!out.length) {
          const subj = (Array.isArray(subjects) ? subjects : []).find(s => String(s.id) === String(subjId)) || {}
          const code = encodeURIComponent(subj.code || '')
          const name = encodeURIComponent(subj.name || '')
          if (code) {
            try {
              const r2 = await api.get(`/academics/teachers/?code=${code}`)
              out = (Array.isArray(r2.data) ? r2.data : (Array.isArray(r2.data?.results) ? r2.data.results : out)).filter(t => t?.user?.is_active !== false)
            } catch {}
          }
          if (!out.length && name) {
            try {
              const r3 = await api.get(`/academics/teachers/?name=${name}&school=`)
              out = (Array.isArray(r3.data) ? r3.data : (Array.isArray(r3.data?.results) ? r3.data.results : out)).filter(t => t?.user?.is_active !== false)
            } catch {}
          }
        }
        if (!out.length) {
          try {
            const r4 = await api.get('/academics/teachers/?school=')
            out = (Array.isArray(r4.data) ? r4.data : (Array.isArray(r4.data?.results) ? r4.data.results : [])).filter(t => t?.user?.is_active !== false)
          } catch {}
        }
        setSubjectTeachers(out)
      } catch (e) {
        /* ignore; fallback to previously loaded all teachers */
      }
    }
  }

  const saveAssignment = async (e) => {
    e?.preventDefault?.()
    try {
      // If an assignment exists for this subject, delete then re-create (simpler client-side)
      const existing = subjectAssignments[String(assignForm.subject)]
      if (existing) {
        await api.delete(`/academics/class_subject_teachers/${existing.id}/`)
      }
      await api.post('/academics/class_subject_teachers/', {
        klass: Number(id),
        subject: Number(assignForm.subject),
        teacher: Number(assignForm.teacher)
      })
      // Refresh class to get updated assignments
      const { data } = await api.get(`/academics/classes/${id}/`)
      setKlass(data)
      setShowAssignModal(false)
    } catch (e) {
      // no-op basic error; could show notification if context exists
      setShowAssignModal(false)
    }
  }

  const [assignSearch, setAssignSearch] = useState('')
  const displayTeachers = useMemo(()=>{
    const q = assignSearch.trim().toLowerCase()
    if (!q) return filteredTeachers
    return filteredTeachers.filter(t => {
      const u = t.user || {}
      const name = `${u.first_name||''} ${u.last_name||''} ${u.username||''}`.toLowerCase()
      const subs = (t.subjects||'').toLowerCase()
      return name.includes(q) || subs.includes(q)
    })
  }, [filteredTeachers, assignSearch])

  return (
    <React.Fragment>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{klass?.name || 'Class'}</h1>
            <div className="text-sm text-gray-500">Grade: {klass?.grade_level || '-'} • Stream: {klass?.stream_detail?.name || '-'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 hover:bg-gray-200">Back</button>
            <Link to="/admin/classes" className="px-3 py-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">All Classes</Link>
            <Link to={`/admin/classes/${id}/print-report-cards`} className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700">Print Report Cards</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow border border-gray-100">
          <div className="px-4 pt-3">
            <div className="flex gap-1 border-b overflow-x-auto no-scrollbar -mx-2 px-2">
              {[
                { key: 'class', label: 'Class' },
                { key: 'subjects', label: 'Subjects' },
                { key: 'students', label: 'Students' },
                { key: 'results', label: 'Results' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={()=>setActiveTab(t.key)}
                  className={`shrink-0 px-3 py-2 text-sm border-b-2 -mb-px rounded-t ${activeTab===t.key ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                >{t.label}</button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {loading && <div>Loading class...</div>}
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {!loading && !error && klass && (
              <>
                {activeTab === 'class' && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50 shadow-sm">
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">Grade</div>
                        <div className="mt-1 text-lg font-semibold text-gray-800">{klass?.grade_level || '-'}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50 shadow-sm">
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">Stream</div>
                        <div className="mt-1 text-lg font-semibold text-gray-800">{klass?.stream_detail?.name || '-'}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-fuchsia-100 bg-fuchsia-50 shadow-sm">
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">Class Teacher</div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="font-medium truncate">{klass?.teacher_detail ? `${klass.teacher_detail.first_name} ${klass.teacher_detail.last_name}` : '—'}</div>
                          <button onClick={()=>{ setReassignTeacher(String(klass?.teacher_detail?.id||'')); setShowReassignCT(true) }} className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">Reassign</button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-gray-800">Class History</div>
                        {loadingHistory && <div className="text-xs text-gray-500">Loading…</div>}
                      </div>
                      {historyError && <div className="text-xs text-red-600 mb-2">{historyError}</div>}
                      {!classHistory ? (
                        <div className="text-sm text-gray-500">No history yet.</div>
                      ) : (
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
                            <div className="rounded-lg border border-indigo-200 overflow-hidden bg-white">
                              <div className="px-3 py-2 text-sm font-medium bg-indigo-50 border-b border-indigo-100">Students In</div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-indigo-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Student</th>
                                      <th className="px-3 py-2 text-left">From</th>
                                      <th className="px-3 py-2 text-left">When</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(classHistory.students_in||[]).length === 0 ? (
                                      <tr><td className="px-3 py-3 text-gray-500" colSpan={3}>No entries.</td></tr>
                                    ) : (
                                      classHistory.students_in.map((h, i) => (
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
                            </div>
                            <div className="rounded-lg border border-rose-200 overflow-hidden bg-white">
                              <div className="px-3 py-2 text-sm font-medium bg-rose-50 border-b border-rose-100">Students Out</div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-rose-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Student</th>
                                      <th className="px-3 py-2 text-left">To</th>
                                      <th className="px-3 py-2 text-left">When</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(classHistory.students_out||[]).length === 0 ? (
                                      <tr><td className="px-3 py-3 text-gray-500" colSpan={3}>No entries.</td></tr>
                                    ) : (
                                      classHistory.students_out.map((h, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-rose-50/50'}>
                                          <td className="px-3 py-2 border-t">{h.student_name}</td>
                                          <td className="px-3 py-2 border-t">{h.to || '-'}</td>
                                          <td className="px-3 py-2 border-t">{h.year ? `${h.year}-T${h.term||'-'}` : (h.created_at || '').slice(0,10)}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg border border-amber-200 overflow-hidden bg-white">
                            <div className="px-3 py-2 text-sm font-medium bg-amber-50 border-b border-amber-100">Exams by Term</div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead className="bg-amber-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Term</th>
                                    <th className="px-3 py-2 text-left">Exams</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(classHistory.exams_by_term||[]).length === 0 ? (
                                    <tr><td className="px-3 py-3 text-gray-500" colSpan={2}>No exams.</td></tr>
                                  ) : (
                                    classHistory.exams_by_term.map((r, i) => (
                                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-3 py-2 border-t">{r.year ? `${r.year}-T${r.term}` : '-'}</td>
                                        <td className="px-3 py-2 border-t">{r.exams}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50 shadow-sm">
                        <div className="text-sm font-semibold mb-2 text-gray-800">Gender Distribution</div>
                        <div className="flex items-end gap-6 h-24">
                          <div className="flex flex-col items-center flex-1">
                            <div className="w-10 bg-blue-500 rounded-t" style={{height: `${genderStats.total? Math.round((genderStats.boys/genderStats.total)*100) : 0}%`}}></div>
                            <div className="text-xs text-gray-600 mt-1">Boys ({genderStats.boys})</div>
                          </div>
                          <div className="flex flex-col items-center flex-1">
                            <div className="w-10 bg-pink-500 rounded-t" style={{height: `${genderStats.total? Math.round((genderStats.girls/genderStats.total)*100) : 0}%`}}></div>
                            <div className="text-xs text-gray-600 mt-1">Girls ({genderStats.girls})</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">Total: {genderStats.total}</div>
                      </div>

                      <div className="md:col-span-2 p-4 rounded-xl border border-violet-200 bg-violet-50 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-800">Performance vs same grade</div>
                          {loadingGradePerf && <div className="text-xs text-gray-500">Loading…</div>}
                        </div>
                        {gradePerf.length === 0 ? (
                          <div className="text-sm text-gray-500">No recent exams available for this grade.</div>
                        ) : (
                          <div className="space-y-2">
                            {(() => {
                              const max = Math.max(...gradePerf.map(g=>g.mean||0), 1)
                              return gradePerf.map(g => (
                                <div key={g.klass} className="flex items-center gap-3">
                                  <div className={`text-xs w-28 ${String(g.klass)===String(klass?.id)?'font-semibold text-indigo-700':'text-gray-700'}`}>{g.klass_name}</div>
                                  <div className="flex-1 bg-gray-100 rounded h-3">
                                    <div className={`${String(g.klass)===String(klass?.id)?'bg-indigo-600':'bg-gray-400'} h-3 rounded`} style={{width: `${Math.min(100, (g.mean/max)*100)}%`}}></div>
                                  </div>
                                  <div className="w-12 text-right text-xs text-gray-700">{Number(g.mean||0).toFixed(1)}</div>
                                </div>
                              ))
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'subjects' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">Subjects</div>
                      <div className="flex gap-2">
                        <button onClick={openAssignSubjects} className="text-sm px-3 py-1.5 rounded border bg-white hover:bg-gray-50">Assign Subjects</button>
                        {subjects.length > 0 && (
                          <button onClick={()=>openAssign(subjects[0]?.id)} className="text-sm px-3 py-1.5 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100">Assign Teacher</button>
                        )}
                      </div>
                    </div>
                    {subjects.length === 0 ? (
                      <div className="text-sm text-gray-500">No subjects assigned.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {subjects.map(s => {
                          const a = subjectAssignments[String(s.id)]
                          return (
                            <div key={s.id} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 border rounded-xl px-3 py-2 bg-white">
                              <div className="min-w-0">
                                <Link to={`/admin/subjects/${s.id}`} className="inline-flex items-center gap-2 hover:underline">
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{s.code}</span>
                                  <span className="text-gray-800 truncate">{s.name}</span>
                                </Link>
                              </div>
                              <div className="text-sm text-gray-600 min-w-0">
                                {a?.teacher_detail ? (
                                  <span className="truncate block">Teacher: {a.teacher_detail.first_name} {a.teacher_detail.last_name}</span>
                                ) : (
                                  <span className="text-gray-400">No teacher</span>
                                )}
                              </div>
                              <div className="sm:text-right">
                                <button
                                  onClick={()=>openAssign(s.id)}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${a
                                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                >
                                  {a ? 'Change' : 'Assign'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'students' && (
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="text-sm text-gray-600">Students in {klass?.name}</div>
                      <div className="flex gap-2">
                        <button onClick={openAddStudents} className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700">Add Students</button>
                        <button onClick={handlePrintList} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-gray-700">Print List</button>
                        <button onClick={handleDownloadCsv} className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700">Download CSV</button>
                      </div>
                    </div>
                    {loadingStudents ? (
                      <div className="text-sm text-gray-500">Loading students...</div>
                    ) : classStudents.length === 0 ? (
                      <div className="text-sm text-gray-500">No students enrolled in this class.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left whitespace-nowrap">Admission No</th>
                              <th className="px-3 py-2 text-left whitespace-nowrap">Name</th>
                              <th className="px-3 py-2 text-left whitespace-nowrap">Guardian Phone</th>
                              <th className="px-3 py-2 text-right"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStudents.map((s, idx) => (
                              <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-3 py-2 font-mono text-xs border-t">{s.admission_no}</td>
                                <td className="px-3 py-2 border-t">
                                  <Link to={`/admin/students/${s.id}`} className="text-blue-700 hover:underline">{s.name}</Link>
                                </td>
                                <td className="px-3 py-2 border-t">{s.guardian_id || 'N/A'}</td>
                                <td className="px-3 py-2 text-right border-t">
                                  <Link to={`/admin/students/${s.id}`} className="inline-flex items-center px-2 py-1 rounded border text-xs hover:bg-white">View</Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'results' && (
                  <div className="space-y-3">
                    <div className="text-xs sm:text-sm text-gray-600">Most Recent Exam</div>
                    {!recentExam ? (
                      <div className="text-sm text-gray-500">No exams found for this class.</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <div className="px-2.5 py-1 rounded border bg-gray-50 text-xs sm:text-sm"><span className="text-[10px] sm:text-xs text-gray-500">Exam</span> <span className="ml-2 font-medium text-xs sm:text-sm">{recentExam.name}</span></div>
                          <div className="px-2.5 py-1 rounded border bg-gray-50 text-xs sm:text-sm"><span className="text-[10px] sm:text-xs text-gray-500">Year</span> <span className="ml-2 font-medium text-xs sm:text-sm">{recentExam.year}</span></div>
                          <div className="px-2.5 py-1 rounded border bg-gray-50 text-xs sm:text-sm"><span className="text-[10px] sm:text-xs text-gray-500">Term</span> <span className="ml-2 font-medium text-xs sm:text-sm">T{recentExam.term}</span></div>
                          <div className="px-2.5 py-1 rounded border bg-gray-50 text-xs sm:text-sm"><span className="text-[10px] sm:text-xs text-gray-500">Date</span> <span className="ml-2 font-medium text-xs sm:text-sm">{recentExam.date || '-'}</span></div>
                        </div>
                        {loadingResults ? (
                          <div className="text-sm text-gray-500">Loading results...</div>
                        ) : (
                          <>
                            <div className="md:hidden text-xs text-gray-500">Swipe horizontally to see all subjects.</div>
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                              <table className="min-w-full text-xs md:text-sm">
                              <thead className="sticky top-0 bg-gray-50 z-10">
                                <tr>
                                  <th className="border px-2 py-1 text-left whitespace-nowrap sticky left-0 bg-gray-50">Student</th>
                                  {recentSummary.subjects.map(s => (
                                    <th key={s.id} className="border px-2 py-1 text-center whitespace-nowrap">{s.code}</th>
                                  ))}
                                  <th className="border px-2 py-1 text-right whitespace-nowrap">Total</th>
                                  <th className="border px-2 py-1 text-right whitespace-nowrap">Average</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recentSummary.students.length === 0 ? (
                                  <tr><td className="px-2 py-3 text-sm text-gray-500" colSpan={(recentSummary.subjects?.length||0)+3}>No results captured for this exam yet.</td></tr>
                                ) : (
                                  recentSummary.students.map(st => (
                                    <tr key={st.id} className="hover:bg-gray-50">
                                      <td className="border px-2 py-1 sticky left-0 bg-white">{st.name}</td>
                                      {recentSummary.subjects.map(s => (
                                        <td key={s.id} className="border px-2 py-1 text-center">{st.marks?.[String(s.id)] ?? '-'}</td>
                                      ))}
                                      <td className="border px-2 py-1 font-medium text-right">{st.total}</td>
                                      <td className="border px-2 py-1 text-right">{typeof st.average === 'number' ? Number(st.average).toFixed(1) : (st.average || '-')}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              </table>
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-2">
                          <button onClick={handlePrintResults} className="inline-flex items-center gap-2 px-3 py-1.5 rounded border bg-white hover:bg-gray-50 w-fit">Print Results</button>
                          <Link to={`/admin/results?exam=${recentExam.id}&grade=${encodeURIComponent(klass?.grade_level || '')}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 w-fit">Open in Results</Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {/* Assign Subjects Modal */}
      <Modal open={showAssignSubjects} onClose={()=>setShowAssignSubjects(false)} title={`Assign Subjects • Selected ${selectedSubjectIds.length}`} size="lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input value={subjectSearch} onChange={e=>setSubjectSearch(e.target.value)} placeholder="Search subjects..." className="w-full border rounded px-3 py-2" />
            <button onClick={()=>setSelectedSubjectIds(availableSubjects.map(s=>s.id))} className="px-2 py-1 text-xs rounded border">Select All</button>
            <button onClick={()=>setSelectedSubjectIds([])} className="px-2 py-1 text-xs rounded border">Clear</button>
          </div>
          <div className="max-h-80 overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Include</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                </tr>
              </thead>
              <tbody>
                {availableSubjects
                  .filter(s => {
                    const q = subjectSearch.trim().toLowerCase()
                    if (!q) return true
                    return (s.code||'').toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q)
                  })
                  .map((s, i) => (
                    <tr key={s.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                      <td className="px-3 py-2 border-t">
                        <input type="checkbox" checked={selectedSubjectIds.includes(s.id)} onChange={()=>toggleSubject(s.id)} />
                      </td>
                      <td className="px-3 py-2 border-t font-mono text-xs">{s.code}</td>
                      <td className="px-3 py-2 border-t">{s.name}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={()=>setShowAssignSubjects(false)} className="px-3 py-1.5 rounded border">Cancel</button>
            <button onClick={saveAssignedSubjects} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
          </div>
        </div>
      </Modal>
      {/* Assign Subject Teacher Modal */}
      <Modal open={showAssignModal} onClose={()=>setShowAssignModal(false)} title="Assign Subject Teacher" size="sm">
        <form onSubmit={saveAssignment} className="grid gap-3">
          <div className="grid gap-1">
            <span className="text-sm text-gray-700">Subject</span>
            <div className="flex items-center gap-2">
              <select className="border p-2 rounded w-full" value={assignForm.subject} onChange={e=>{ setAssignForm({...assignForm, subject:e.target.value}); setSubjectTeachers([]) }} required>
                <option value="">Select Subject</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </div>
            {!!assignForm.subject && (()=>{
              const s = subjects.find(x=> String(x.id)===String(assignForm.subject))
              return s ? <div className="text-xs text-gray-500">Selected: <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 mr-1">{s.code}</span>{s.name}</div> : null
            })()}
          </div>

          <div className="grid gap-1">
            <span className="text-sm text-gray-700">Teacher</span>
            <input className="border p-2 rounded" placeholder="Search teacher by name, username, or subject" value={assignSearch} onChange={e=>setAssignSearch(e.target.value)} />
            <select className="border p-2 rounded w-full" value={assignForm.teacher} onChange={e=>setAssignForm({...assignForm, teacher:e.target.value})} required>
              <option value="">Select Teacher</option>
              {displayTeachers.length === 0 ? (
                <option disabled value="">No matching teachers</option>
              ) : (
                displayTeachers.map(t => (
                  <option key={t.user?.id || t.id} value={t.user?.id || t.id}>
                    {(t.user?.first_name || '') + ' ' + (t.user?.last_name || '')}
                    {t.user?.username ? ` (@${t.user.username})` : ''}
                    {t.subjects ? ` — ${t.subjects}` : ''}
                  </option>
                ))
              )}
            </select>
            <div className="text-xs text-gray-500">Tip: Use search to narrow down teachers. List shows school‑wide teachers.</div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowAssignModal(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </Modal>
      {/* Reassign Class Teacher Modal */}
      <Modal open={showReassignCT} onClose={()=>setShowReassignCT(false)} title="Reassign Class Teacher" size="sm">
        <form onSubmit={async (e)=>{
          e.preventDefault()
          try{
            const payload = { teacher: reassignTeacher ? Number(reassignTeacher) : null }
            await api.patch(`/academics/classes/${id}/`, payload)
            const { data } = await api.get(`/academics/classes/${id}/`)
            setKlass(data)
            setShowReassignCT(false)
          }catch(err){
            // Surface errors to aid debugging (instead of failing silently)
            console.error('Failed to reassign class teacher', err?.response || err)
            const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Unknown error')
            try { alert(`Failed to save: ${msg}`) } catch(_) {}
            setShowReassignCT(false)
          }
        }} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Select Teacher</span>
            <select className="border p-2 rounded" value={reassignTeacher} onChange={e=>setReassignTeacher(e.target.value)} required>
              <option value="">Choose a teacher</option>
              {availableCTs.map(t=> (
                <option key={t.user?.id || `tp-${t.id}`} value={t.user?.id || ''}>
                  {(t.user?.first_name||'') + ' ' + (t.user?.last_name||'') + (t.user?.username ? ` (@${t.user.username})` : '')}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowReassignCT(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={showAddStudents} onClose={()=>setShowAddStudents(false)} title={`Add Students to ${klass?.name||'Class'}`} size="lg">
        <div className="space-y-3">
          {addStudentsError && <div className="text-sm text-red-600">{addStudentsError}</div>}
          <div className="flex items-center gap-2">
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Search by name or admission no" value={unassignedSearch} onChange={e=>setUnassignedSearch(e.target.value)} />
            <div className="text-xs text-gray-500">{selectedUnassigned.length} selected</div>
          </div>
          <div className="max-h-80 overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left">Admission No</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Guardian Phone</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const q = unassignedSearch.trim().toLowerCase()
                  const list = q ? unassigned.filter(s => String(s.admission_no||'').toLowerCase().includes(q) || String(s.name||'').toLowerCase().includes(q)) : unassigned
                  if (!list.length) return (<tr><td className="px-3 py-3 text-gray-500" colSpan={4}>No unassigned students found.</td></tr>)
                  return list.map(s => (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedUnassigned.includes(s.id)} onChange={()=>toggleUnassigned(s.id)} /></td>
                      <td className="px-3 py-2">{s.admission_no}</td>
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2">{s.guardian_id || '-'}</td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={()=>setShowAddStudents(false)} className="px-4 py-2 border rounded">Cancel</button>
            <button onClick={saveAddStudents} disabled={addingStudents || selectedUnassigned.length===0} className="px-5 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">{addingStudents ? 'Adding…' : 'Add Selected'}</button>
          </div>
        </div>
      </Modal>
    </React.Fragment>
  )
}
