import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import AdminResults from './AdminResults'

export default function TeacherResults(){
  return <AdminResults />
}

function TeacherResultsLegacy(){
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [publishedExams, setPublishedExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [viewMode, setViewMode] = useState('class') // 'class' | 'grade'
  const [selectedBlock, setSelectedBlock] = useState('') // name-year-term key
  const [selectedGrade, setSelectedGrade] = useState('')
  const [summary, setSummary] = useState(null)
  const [gradeSummaries, setGradeSummaries] = useState([])
  const [gradeStudents, setGradeStudents] = useState([])
  const [gradeSubjects, setGradeSubjects] = useState([]) // subjects included in grade combined list
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Grading bands (admin-defined). We'll pick the first subject with configured bands as the global for overall Grade.
  const [globalBands, setGlobalBands] = useState(null)

  // Load all classes (not just teacher's) so teachers can view any class
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try{
        setLoading(true); setError('')
        const { data } = await api.get('/academics/classes/')
        if (!mounted) return
        const list = Array.isArray(data) ? data : []
        setClasses(list)
        if (list.length){ setSelectedClass(String(list[0].id)) }
        const firstGrade = list.find(c=> c.grade_level!=null)?.grade_level
        setSelectedGrade(String(firstGrade || ''))
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load classes') }
      finally{ if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [])

  const currentClass = useMemo(() => classes.find(c => String(c.id)===String(selectedClass)) || null, [classes, selectedClass])
  const uniqueGrades = useMemo(()=> Array.from(new Set((classes||[]).map(c=> c.grade_level).filter(Boolean))), [classes])
  const currentGrade = useMemo(() => {
    if (viewMode==='grade') return selectedGrade || uniqueGrades[0] || ''
    return currentClass?.grade_level || ''
  }, [viewMode, selectedGrade, uniqueGrades, currentClass])

  // Build exam blocks (name+year+term) for current grade
  const examBlocks = useMemo(()=>{
    const keyOf = (e)=> `${e.name||''}__${e.year||''}__${e.term||''}`
    const labelOf = (e)=> `${e.name || 'Exam'} • ${e.year} • T${e.term}`
    const map = new Map()
    for (const e of publishedExams){
      const k = keyOf(e)
      if (!map.has(k)) map.set(k, { key:k, label: labelOf(e) })
    }
    return Array.from(map.values())
  }, [publishedExams])

  // Load published exams for the current grade (fallbacks included)
  useEffect(() => {
    if (!currentGrade){ setPublishedExams([]); setSelectedExam(''); return }
    let mounted = true
    ;(async () => {
      try{
        setError('')
        // Try to get all exams and then filter by class grade and published
        const fetchAll = async (url) => {
          let out = []
          let next = url
          let guard = 0
          while (next && guard < 50){
            const res = await api.get(next)
            const data = res?.data
            if (Array.isArray(data)) { out = data; break }
            if (data && Array.isArray(data.results)) { out = out.concat(data.results); next = data.next; guard++; continue }
            break
          }
          return out
        }
        const all = await fetchAll('/academics/exams/?include_history=true')
        // helper to resolve class id/name on exam object
        const getKlassId = (e) => String(e?.klass ?? e?.class ?? e?.klass_id ?? e?.class_id ?? '')
        const isPublished = (e) => !!(e?.published || e?.is_published || String(e?.status||'').toLowerCase()==='published')
        // keep only exams that belong to the selected grade; prefer stable grade_level_tag on the exam
        const normalize = (g)=> String(g||'').trim()
        const examsForGrade = all.filter(e => {
          const tag = normalize(e?.grade_level_tag)
          if (tag) return tag === normalize(currentGrade) && isPublished(e)
          // Fallback: resolve via class list if tag missing
          const cid = getKlassId(e)
          const cls = classes.find(c => String(c.id)===String(cid))
          return !!(cls && normalize(cls.grade_level)===normalize(currentGrade) && isPublished(e))
        })
        // sort by date desc then id desc
        examsForGrade.sort((a,b)=>{
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          if (db !== da) return db - da
          return (b.id||0) - (a.id||0)
        })
        if (mounted){
          setPublishedExams(examsForGrade)
          setSelectedExam(examsForGrade[0]?.id ? String(examsForGrade[0].id) : '')
        }
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load exams') }
    })()
    return () => { mounted = false }
  }, [currentGrade, classes])

  // Load summary for selected exam (class view)
  useEffect(() => {
    if (viewMode !== 'class'){ setSummary(null); return }
    if (!selectedExam){ setSummary(null); return }
    let mounted = true
    ;(async () => {
      try{
        setLoading(true); setError('')
        const { data } = await api.get(`/academics/exams/${selectedExam}/summary/`)
        let payload = data || null
        // Hydrate with roster if no students returned yet, so teachers can still see their list
        try{
          if (payload && Array.isArray(payload.students) && payload.students.length===0){
            const klassId = payload?.exam?.klass || publishedExams.find(e=> String(e.id)===String(selectedExam))?.klass
            if (klassId){
              const res = await api.get(`/academics/students/?klass=${encodeURIComponent(klassId)}`)
              const roster = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
              const students = roster.map((s, idx)=> ({ id: s.id, name: s.name, marks: {}, subject_percentages: {}, total: 0, average: 0, position: idx+1 }))
              payload = { ...payload, students }
            }
          }
          // If subjects missing, fetch from class details to render subject columns and percentages
          if (payload && (!Array.isArray(payload.subjects) || payload.subjects.length===0)){
            const klassId = payload?.exam?.klass || publishedExams.find(e=> String(e.id)===String(selectedExam))?.klass
            if (klassId){
              try{
                const kres = await api.get(`/academics/classes/${encodeURIComponent(klassId)}/`)
                const subs = Array.isArray(kres?.data?.subjects) ? kres.data.subjects : []
                const examSubs = subs.filter(s=> s?.is_examinable !== false).map(s=>({ id: s.id, code: s.code, name: s.name }))
                if (examSubs.length){ payload = { ...payload, subjects: examSubs } }
              }catch{}
            }
          }
        }catch{}
        if (mounted) setSummary(payload)
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load summary') }
      finally{ if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [selectedExam, viewMode])

  // Load grade-level summaries for selected block (grade view)
  useEffect(()=>{
    if (viewMode !== 'grade'){ setGradeSummaries([]); setGradeStudents([]); setGradeSubjects([]); return }
    if (!selectedBlock || !currentGrade){ setGradeSummaries([]); setGradeStudents([]); setGradeSubjects([]); return }
    let mounted = true
    ;(async()=>{
      try{
        setLoading(true); setError('')
        // Exams in selected block for classes of this grade
        const inBlock = publishedExams.filter(e=> `${e.name||''}__${e.year||''}__${e.term||''}` === selectedBlock)
        // Map classId -> examId (there should be one per class)
        const wanted = inBlock.filter(e=>{
          const cls = classes.find(c=> String(c.id)===String(e.klass || e.class || e.klass_id || e.class_id))
          return cls && String(cls.grade_level)===String(currentGrade)
        })
        const summaries = []
        const combined = []
        const subjectsMap = new Map()
        for (const e of wanted){
          try{
            const id = e.id
            const { data } = await api.get(`/academics/exams/${id}/summary/`)
            const classId = String(e.klass || e.class || e.klass_id || e.class_id)
            const className = classes.find(c=> String(c.id)===classId)?.name || classId
            summaries.push({ classId, className, mean: data?.class_mean ?? null, size: Array.isArray(data?.students)? data.students.length : null })
            // collect student rows
            const studs = Array.isArray(data?.students) ? data.students : []
            const subs = Array.isArray(data?.subjects) ? data.subjects : []
            for (const s of subs){
              if (s && s.id != null && !subjectsMap.has(String(s.id))){
                subjectsMap.set(String(s.id), s)
              }
            }
            for (const s of studs){
              combined.push({
                id: s.id,
                name: s.name,
                classId,
                className,
                total: s.total ?? null,
                average: s.average ?? null,
                marks: s.marks || {},
                subject_percentages: s.subject_percentages || {},
              })
            }
          }catch{}
        }
        // sort by class name
        summaries.sort((a,b)=> String(a.className||'').localeCompare(String(b.className||'')))
        // Compute totals/averages based on subject percentages, then compute positions by total desc
        const allSubs = Array.from(subjectsMap.values())
        for (const st of combined){
          let sum = 0
          let cnt = 0
          for (const sub of allSubs){
            const pct = Number(st?.subject_percentages?.[String(sub.id)])
            if (Number.isFinite(pct)) { sum += pct; cnt += 1 }
          }
          st.total = Math.round(sum * 100) / 100
          st.average = cnt ? (Math.round((sum / cnt) * 100) / 100) : 0
        }
        combined.sort((a,b)=> (Number(b.total)||0) - (Number(a.total)||0))
        let lastTotal = null, lastPos = 0
        for (let i=0;i<combined.length;i++){
          const t = Number(combined[i].total)||0
          if (t!==lastTotal){ lastPos = i+1; lastTotal = t }
          combined[i].position = lastPos
        }
        if (mounted) {
          setGradeSummaries(summaries)
          setGradeStudents(combined)
          setGradeSubjects(Array.from(subjectsMap.values()))
        }
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load grade overview') }
      finally{ if (mounted) setLoading(false) }
    })()
    return ()=>{ mounted=false }
  }, [viewMode, selectedBlock, currentGrade, publishedExams, classes])

  const classNameById = (id) => classes.find(c=>String(c.id)===String(id))?.name || id

  // Convert numeric score to letter grade using admin-defined bands (fallback to defaults)
  const letterFromBands = (score, bands) => {
    const n = Number(score)
    if (!Number.isFinite(n)) return '-'
    const arr = Array.isArray(bands) ? [...bands] : []
    arr.sort((a,b)=> (a.order??0) - (b.order??0))
    for (const b of arr){
      const min = Number(b.min), max = Number(b.max)
      if (Number.isFinite(min) && Number.isFinite(max)){
        if (n >= min && n <= max) return String(b.grade || '-')
      }
    }
    if (n >= 80) return 'A'
    if (n >= 70) return 'B'
    if (n >= 60) return 'C'
    if (n >= 50) return 'D'
    return 'E'
  }
  const toGrade = (avg) => letterFromBands(avg, globalBands)

  const pctTotalAndAvg = (st) => {
    // Prefer server-computed totals/averages from summary
    const t = Number(st?.total)
    const a = Number(st?.average)
    if (Number.isFinite(t) && Number.isFinite(a)) return { sum: t, avg: a }
    // Fallback to compute from subject_percentages if provided
    const subs = Array.isArray(summary?.subjects) ? summary.subjects : []
    let sum = 0
    let cnt = 0
    for (const s of subs){
      const pct = Number(st?.subject_percentages?.[String(s.id)])
      if (Number.isFinite(pct)) { sum += pct; cnt += 1 }
    }
    const avg = cnt ? (sum / cnt) : 0
    return { sum, avg }
  }

  const formatMean = (value) => {
    const v = Number(value)
    if (!Number.isFinite(v)) return '-'
    const r = Math.round(v * 100) / 100
    return Number.isInteger(r) ? String(r) : r.toFixed(2)
  }

  // Fetch grading bands for subjects of the current summary; choose first non-empty as global bands
  useEffect(() => {
    let active = true
    ;(async () => {
      try{
        const ids = Array.isArray(summary?.subjects) ? summary.subjects.map(s=>s.id).filter(Boolean) : []
        if (ids.length === 0) { setGlobalBands(null); return }
        for (const sid of ids){
          try{
            const res = await api.get(`/academics/subject_grading/?subject=${sid}`)
            const bands = Array.isArray(res?.data) ? res.data : []
            if (active && bands.length){ setGlobalBands(bands); break }
          }catch{}
        }
      }catch{}
    })()
    return () => { active = false }
  }, [summary?.subjects])

  const downloadCSV = (filename, rows) => {
    const csv = rows.map(r=> r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  const printHTML = (title, html) => {
    const w = window.open('', '_blank'); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>:root{--print-scale:1.33;} body{font-family:Arial, sans-serif; padding:12px; font-size:calc(12px * var(--print-scale));} h1{font-size:calc(15px * var(--print-scale)); margin:0 0 8px;} table{border-collapse:collapse; width:100%; table-layout:fixed; font-size:calc(11px * var(--print-scale));} th,td{border:1px solid #ddd; padding:2px 4px; line-height:1.1; text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;} th{background:#f8f8f8; font-size:calc(10px * var(--print-scale)); text-transform:uppercase; letter-spacing:.3px;} thead th:nth-child(n+3):not(:nth-last-child(-n+2)){font-size:calc(9px * var(--print-scale)); letter-spacing:.2px; white-space:normal; overflow:visible; text-overflow:clip;}</style></head><body>${html}</body></html>`); w.document.close(); w.focus(); w.print()
  }
  const handleClassPrint = () => {
    if (!summary) return
    const cols = [ 'POS','Student', ...summary.subjects.map(s=> s.code || s.name), 'Total','Grade' ]
    const rows = summary.students.map(st=> {
      const { sum, avg } = pctTotalAndAvg(st)
      const perSubj = summary.subjects.map(s => {
        const v = Number(st?.subject_percentages?.[String(s.id)])
        return Number.isFinite(v) ? String(Math.round(v)) : ''
      })
      return [ st.position, st.name, ...perSubj, String(Math.round(sum)), toGrade(avg) ]
    })
    const thead = `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`
    const tbody = rows.map(r=> `<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')
    const title = `${summary?.exam?.name||'Exam'} - ${classNameById(summary?.exam?.klass) || ''}`
    printHTML(title, `<h1>${title}</h1><table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`)
  }
  const handleClassCSV = () => {
    if (!summary) return
    const header = [ 'POS','Student', ...summary.subjects.map(s=> s.code || s.name), 'Total','Grade' ]
    const data = summary.students.map(st=> {
      const { sum, avg } = pctTotalAndAvg(st)
      const perSubj = summary.subjects.map(s => {
        const v = Number(st?.subject_percentages?.[String(s.id)])
        return Number.isFinite(v) ? String(Math.round(v)) : ''
      })
      return [ st.position, st.name, ...perSubj, String(Math.round(sum)), toGrade(avg) ]
    })
    downloadCSV(`${(summary?.exam?.name||'exam').replaceAll(' ','_')}_class_results.csv`, [header, ...data])
  }
  const handleGradePrint = () => {
    const title = `Grade Overview`
    const classRows = gradeSummaries.map(g=> [g.className, g.mean??'', g.size??''])
    const classTable = `<h2>Classes</h2><table><thead><tr><th>Class</th><th>Mean</th><th>Students</th></tr></thead><tbody>${classRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    const studRows = gradeStudents.map(s=> [s.position, s.name, s.className, s.total??'', s.average??''])
    const studTable = `<h2>Combined Student List</h2><table><thead><tr><th>POS</th><th>Student</th><th>Class</th><th>Total</th><th>Average</th></tr></thead><tbody>${studRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    printHTML(title, `${classTable}${studTable}`)
  }
  const handleGradeCSV = () => {
    const classHeader = ['Class','Mean','Students']
    const classData = gradeSummaries.map(g=> [g.className, g.mean??'', g.size??''])
    downloadCSV('grade_classes_summary.csv', [classHeader, ...classData])
    const studHeader = ['POS','Student','Class','Total','Average']
    const studData = gradeStudents.map(s=> [s.position, s.name, s.className, s.total??'', s.average??''])
    downloadCSV('grade_combined_students.csv', [studHeader, ...studData])
  }

  return (
    <div className="teacher-results-page px-0 md:px-6 py-4 md:py-6 space-y-4 max-w-7xl mx-auto min-h-[80vh]">
      {/* Header */}
      <div className="teacher-results-header relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-10 h-24 w-24 rounded-full bg-indigo-200/40 blur-2" />
        <div className="p-4 md:p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base md:text-xl font-semibold tracking-tight text-gray-900">Results</h1>
            <div className="text-[11px] md:text-xs text-gray-600">View published exams and grade overviews for Grade: <b>{currentGrade || '-'}</b></div>
          </div>
          <div className="w-full sm:w-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-end gap-2">
              <div className="inline-flex items-center rounded-full bg-white/70 border border-gray-200 p-0.5 shadow-sm">
                <button
                  className={`teacher-results-toggle px-3 py-1.5 text-[11px] rounded-full transition ${viewMode==='class' ? 'teacher-results-toggle--active' : ''}`}
                  onClick={()=>setViewMode('class')}
                >
                  Class
                </button>
                <button
                  className={`teacher-results-toggle px-3 py-1.5 text-[11px] rounded-full transition ${viewMode==='grade' ? 'teacher-results-toggle--active' : ''}`}
                  onClick={()=>setViewMode('grade')}
                >
                  Grade
                </button>
              </div>
            </div>
            {viewMode==='class' ? (
              <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2">
                <span className="shrink-0">Class</span>
                <select
                  className="w-full sm:w-48 border border-gray-200 rounded-xl px-3 py-2 text-xs md:text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  value={selectedClass}
                  onChange={e=>setSelectedClass(e.target.value)}
                  disabled={loading || !classes.length}
                >
                  {(!classes.length && loading) && (
                    <option value="">Loading classes…</option>
                  )}
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2">
                <span className="shrink-0">Grade</span>
                <select
                  className="w-full sm:w-48 border border-gray-200 rounded-xl px-3 py-2 text-xs md:text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  value={selectedGrade}
                  onChange={e=>setSelectedGrade(e.target.value)}
                  disabled={loading || !uniqueGrades.length}
                >
                  {(!uniqueGrades.length && loading) && (
                    <option value="">Loading grades…</option>
                  )}
                  {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
            )}
            {viewMode==='class' ? (
              <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2">
                <span className="shrink-0">Exam</span>
                <select
                  className="w-full sm:w-72 border border-gray-200 rounded-xl px-3 py-2 text-xs md:text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  value={selectedExam}
                  onChange={e=>setSelectedExam(e.target.value)}
                  disabled={loading || !publishedExams.length}
                >
                  <option value="">{loading && !publishedExams.length ? 'Loading exams…' : 'Most recent published…'}</option>
                  {publishedExams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name} • {ex.year} • T{ex.term} • {classNameById(ex.klass)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2">
                <span className="shrink-0">Block</span>
                <select
                  className="w-full sm:w-72 border border-gray-200 rounded-xl px-3 py-2 text-xs md:text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  value={selectedBlock}
                  onChange={e=>setSelectedBlock(e.target.value)}
                  disabled={loading || !examBlocks.length}
                >
                  <option value="">{loading && !examBlocks.length ? 'Loading exam blocks…' : 'Select exam block…'}</option>
                  {examBlocks.map(b => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-xs md:text-sm px-3 py-2 rounded-2xl border border-red-200 shadow-sm">{error}</div>}

      {viewMode==='class' && !selectedExam ? (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm px-4 py-3 text-xs md:text-sm text-gray-600">No published exams found for this grade.</div>
      ) : viewMode==='class' && loading ? (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm px-4 py-3 text-sm text-gray-700">Loading…</div>
      ) : viewMode==='class' && !summary ? (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm px-4 py-3 text-xs md:text-sm text-gray-600">No results to display. Try selecting a different exam.</div>
      ) : viewMode==='class' ? (
        <div className="bg-white/95 backdrop-blur rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm md:text-base text-gray-800 font-medium">{summary?.exam?.name || 'Exam'} • Year {summary?.exam?.year || ''} • T{summary?.exam?.term || ''}</div>
            <div className="flex items-center gap-2">
              {summary?.class_mean != null && (
                <div className="text-xs md:text-sm mr-2 text-gray-600">Class Mean: <b className="text-gray-900">{summary.class_mean}</b></div>
              )}
              <button onClick={handleClassCSV} className="teacher-results-action px-3 py-1.5 text-[11px] rounded-full border border-gray-200 bg-white hover:bg-gray-50">Download CSV</button>
              <button onClick={handleClassPrint} className="teacher-results-action px-3 py-1.5 text-[11px] rounded-full border border-gray-200 bg-white hover:bg-gray-50">Print</button>
            </div>
          </div>
          <div className="overflow-auto -mx-2 md:mx-0">
            <div className="inline-block min-w-[900px] align-middle">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border border-gray-200 px-2 py-2 text-left w-20">POS</th>
                    <th className="border border-gray-200 px-2 py-2 text-left w-56">Student</th>
                    {summary.subjects.map(s => (
                      <th key={s.id} className="border border-gray-200 px-2 py-2 text-left">{s.code || s.name}</th>
                    ))}
                    <th className="border border-gray-200 px-2 py-2 text-left">Total</th>
                    <th className="border border-gray-200 px-2 py-2 text-left">Grade</th>
                    <th className="border border-gray-200 px-2 py-2 text-left w-28">Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students.map((st,idx) => (
                    <tr key={st.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="border border-gray-200 px-2 py-2">{st.position}</td>
                      <td className="border border-gray-200 px-2 py-2">{st.name}</td>
                      {summary.subjects.map(s => {
                        const v = Number(st?.subject_percentages?.[String(s.id)])
                        const val = Number.isFinite(v) ? Math.round(v) : '-'
                        return (
                          <td key={s.id} className="border border-gray-200 px-2 py-2">{val}</td>
                        )
                      })}
                      {(() => {
                        const { sum, avg } = pctTotalAndAvg(st)
                        return (
                          <>
                            <td className="border border-gray-200 px-2 py-2 font-medium">{Math.round(sum)}</td>
                            <td className="border border-gray-200 px-2 py-2">{toGrade(avg)}</td>
                          </>
                        )
                      })()}
                      <td className="border border-gray-200 px-2 py-2">
                        <button
                          onClick={()=> navigate(`/teacher/students/${st.id}/report-card?exam=${encodeURIComponent(String(selectedExam||''))}`)}
                          className="px-2 py-1 rounded border text-[11px] bg-white hover:bg-gray-50"
                        >View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-2 py-2 font-medium" colSpan={2}>Mean</td>
                    {summary.subjects.map(s => {
                      let sum = 0, cnt = 0
                      for (const st of summary.students){
                        const pct = Number(st?.subject_percentages?.[String(s.id)])
                        if (Number.isFinite(pct)) { sum += pct; cnt += 1 }
                      }
                      const mean = cnt ? (sum / cnt) : 0
                      return (
                        <td key={`mean-${s.id}`} className="border border-gray-200 px-2 py-2">{formatMean(mean)}</td>
                      )
                    })}
                    {(() => {
                      // mean of student totals and overall grade from average percentage
                      let totalSum = 0, totalCnt = 0, avgSum = 0, avgCnt = 0
                      for (const st of summary.students){
                        const { sum, avg } = pctTotalAndAvg(st)
                        if (Number.isFinite(sum)) { totalSum += sum; totalCnt += 1 }
                        if (Number.isFinite(avg)) { avgSum += avg; avgCnt += 1 }
                      }
                      const meanTotal = totalCnt ? (totalSum / totalCnt) : 0
                      const meanAvg = avgCnt ? (avgSum / avgCnt) : 0
                      return (
                        <>
                          <td className="border border-gray-200 px-2 py-2 font-medium">{formatMean(meanTotal)}</td>
                          <td className="border border-gray-200 px-2 py-2">{toGrade(meanAvg)}</td>
                          <td className="border border-gray-200 px-2 py-2"></td>
                        </>
                      )
                    })()}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/95 backdrop-blur rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm md:text-base text-gray-800 font-medium">Grade Overview {selectedBlock && `• ${examBlocks.find(b=>b.key===selectedBlock)?.label}`}</div>
            <div className="flex items-center gap-2">
              {gradeSummaries.length>0 && (
                <div className="text-xs md:text-sm text-gray-600 mr-2">Classes: <b className="text-gray-900">{gradeSummaries.length}</b></div>
              )}
              <button onClick={handleGradeCSV} className="teacher-results-action px-3 py-1.5 text-[11px] rounded-full border border-gray-200 bg-white hover:bg-gray-50">Download CSV</button>
              <button onClick={handleGradePrint} className="teacher-results-action px-3 py-1.5 text-[11px] rounded-full border border-gray-200 bg-white hover:bg-gray-50">Print</button>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-2 py-2 text-left w-56">Class</th>
                  <th className="border border-gray-200 px-2 py-2 text-left">Mean</th>
                  <th className="border border-gray-200 px-2 py-2 text-left">Students</th>
                </tr>
              </thead>
              <tbody>
                {gradeSummaries.map((g,idx)=>(
                  <tr key={g.classId} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="border border-gray-200 px-2 py-2">{g.className}</td>
                    <td className="border border-gray-200 px-2 py-2 font-medium">{g.mean ?? '-'}</td>
                    <td className="border border-gray-200 px-2 py-2">{g.size ?? '-'}</td>
                  </tr>
                ))}
                {gradeSummaries.length===0 && (
                  <tr>
                    <td colSpan="3" className="border border-gray-200 px-2 py-4 text-center text-gray-500">{loading ? 'Loading…' : 'No data to show'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 pt-2 text-sm font-medium text-gray-800">Combined Student List</div>
          <div className="overflow-auto -mx-2 md:mx-0">
            <div className="inline-block min-w-[900px] align-middle">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border border-gray-200 px-2 py-2 text-left w-24">Position</th>
                    <th className="border border-gray-200 px-2 py-2 text-left w-56">Student</th>
                    <th className="border border-gray-200 px-2 py-2 text-left w-48">Class</th>
                    {gradeSubjects.map(sub => (
                      <th key={sub.id} className="border border-gray-200 px-2 py-2 text-left">{sub.code || sub.name}</th>
                    ))}
                    <th className="border border-gray-200 px-2 py-2 text-left">Total</th>
                    <th className="border border-gray-200 px-2 py-2 text-left">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeStudents.map((s,idx)=>(
                    <tr key={`${s.classId}-${s.id}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="border border-gray-200 px-2 py-2">{s.position}</td>
                      <td className="border border-gray-200 px-2 py-2">{s.name}</td>
                      <td className="border border-gray-200 px-2 py-2">{s.className}</td>
                      {gradeSubjects.map(sub => (
                        <td key={sub.id} className="border border-gray-200 px-2 py-2">{s.marks?.[String(sub.id)] ?? '-'}</td>
                      ))}
                      <td className="border border-gray-200 px-2 py-2 font-medium">{s.total ?? '-'}</td>
                      <td className="border border-gray-200 px-2 py-2">{toGrade(s.average)}</td>
                    </tr>
                  ))}
                  {gradeStudents.length===0 && (
                    <tr><td colSpan={5 + gradeSubjects.length} className="border border-gray-200 px-2 py-4 text-center text-gray-500">{loading ? 'Loading…' : 'No students to show'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
