import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

export default function TeacherResults(){
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Grading bands (admin-defined). We'll pick the first subject with configured bands as the global for overall Grade.
  const [globalBands, setGlobalBands] = useState(null)

  // Load teacher's classes
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try{
        setLoading(true); setError('')
        const { data } = await api.get('/academics/classes/mine/')
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
        const all = await fetchAll('/academics/exams/')
        // helper to resolve class id/name on exam object
        const getKlassId = (e) => String(e?.klass ?? e?.class ?? e?.klass_id ?? e?.class_id ?? '')
        const isPublished = (e) => !!(e?.published || e?.is_published || String(e?.status||'').toLowerCase()==='published')
        // keep only exams for classes matching this grade
        const examsForGrade = all.filter(e => {
          const cid = getKlassId(e)
          const cls = classes.find(c => String(c.id)===String(cid))
          return cls && String(cls.grade_level)===String(currentGrade) && isPublished(e)
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
        if (mounted) setSummary(data)
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load summary') }
      finally{ if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [selectedExam, viewMode])

  // Load grade-level summaries for selected block (grade view)
  useEffect(()=>{
    if (viewMode !== 'grade'){ setGradeSummaries([]); return }
    if (!selectedBlock || !currentGrade){ setGradeSummaries([]); return }
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
        for (const e of wanted){
          try{
            const id = e.id
            const { data } = await api.get(`/academics/exams/${id}/summary/`)
            const classId = String(e.klass || e.class || e.klass_id || e.class_id)
            const className = classes.find(c=> String(c.id)===classId)?.name || classId
            summaries.push({ classId, className, mean: data?.class_mean ?? null, size: Array.isArray(data?.students)? data.students.length : null })
            // collect student rows
            const studs = Array.isArray(data?.students) ? data.students : []
            for (const s of studs){
              combined.push({
                id: s.id,
                name: s.name,
                classId,
                className,
                total: s.total ?? null,
                average: s.average ?? null,
              })
            }
          }catch{}
        }
        // sort by class name
        summaries.sort((a,b)=> String(a.className||'').localeCompare(String(b.className||'')))
        // compute positions by total desc
        combined.sort((a,b)=> (Number(b.total)||0) - (Number(a.total)||0))
        let lastTotal = null, lastPos = 0
        for (let i=0;i<combined.length;i++){
          const t = Number(combined[i].total)||0
          if (t!==lastTotal){ lastPos = i+1; lastTotal = t }
          combined[i].position = lastPos
        }
        if (mounted) { setGradeSummaries(summaries); setGradeStudents(combined) }
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
    const w = window.open('', '_blank'); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial, sans-serif; padding:16px;} table{border-collapse:collapse; width:100%;} th,td{border:1px solid #ddd; padding:6px; text-align:left;} th{background:#f8f8f8;}</style></head><body>${html}</body></html>`); w.document.close(); w.focus(); w.print()
  }
  const handleClassPrint = () => {
    if (!summary) return
    const cols = [ 'Position','Student', ...summary.subjects.map(s=> s.name || s.code), 'Total','Grade' ]
    const rows = summary.students.map(st=> [ st.position, st.name, ...summary.subjects.map(s=> st.marks?.[String(s.id)] ?? ''), st.total, toGrade(st.average) ])
    const thead = `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`
    const tbody = rows.map(r=> `<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')
    const title = `${summary?.exam?.name||'Exam'} - ${classNameById(summary?.exam?.klass) || ''}`
    printHTML(title, `<h1>${title}</h1><table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`)
  }
  const handleClassCSV = () => {
    if (!summary) return
    const header = [ 'Position','Student', ...summary.subjects.map(s=> s.name || s.code), 'Total','Grade' ]
    const data = summary.students.map(st=> [ st.position, st.name, ...summary.subjects.map(s=> s.marks?.[String(s.id)] ?? ''), st.total, toGrade(st.average) ])
    downloadCSV(`${(summary?.exam?.name||'exam').replaceAll(' ','_')}_class_results.csv`, [header, ...data])
  }
  const handleGradePrint = () => {
    const title = `Grade Overview`
    const classRows = gradeSummaries.map(g=> [g.className, g.mean??'', g.size??''])
    const classTable = `<h2>Classes</h2><table><thead><tr><th>Class</th><th>Mean</th><th>Students</th></tr></thead><tbody>${classRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    const studRows = gradeStudents.map(s=> [s.position, s.name, s.className, s.total??'', s.average??''])
    const studTable = `<h2>Combined Student List</h2><table><thead><tr><th>Position</th><th>Student</th><th>Class</th><th>Total</th><th>Average</th></tr></thead><tbody>${studRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    printHTML(title, `${classTable}${studTable}`)
  }
  const handleGradeCSV = () => {
    const classHeader = ['Class','Mean','Students']
    const classData = gradeSummaries.map(g=> [g.className, g.mean??'', g.size??''])
    downloadCSV('grade_classes_summary.csv', [classHeader, ...classData])
    const studHeader = ['Position','Student','Class','Total','Average']
    const studData = gradeStudents.map(s=> [s.position, s.name, s.className, s.total??'', s.average??''])
    downloadCSV('grade_combined_students.csv', [studHeader, ...studData])
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4 md:p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight">Results</h1>
            <div className="text-xs md:text-sm text-gray-600">Published exams for Grade: <b>{currentGrade || '-'}</b></div>
          </div>
          <div className="w-full sm:w-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-end gap-2">
              <button className={`px-2 py-1.5 text-xs rounded-full border ${viewMode==='class'? 'bg-gray-900 text-white border-gray-900':'border-gray-200'}`} onClick={()=>setViewMode('class')}>Class</button>
              <button className={`px-2 py-1.5 text-xs rounded-full border ${viewMode==='grade'? 'bg-gray-900 text-white border-gray-900':'border-gray-200'}`} onClick={()=>setViewMode('grade')}>Grade</button>
            </div>
            {viewMode==='class' ? (
              <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2">
                <span className="shrink-0">Class</span>
                <select className="w-full sm:w-48 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2">
                <span className="shrink-0">Grade</span>
                <select className="w-full sm:w-48 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" value={selectedGrade} onChange={e=>setSelectedGrade(e.target.value)}>
                  {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
            )}
            {viewMode==='class' ? (
              <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2">
                <span className="shrink-0">Exam</span>
                <select className="w-full sm:w-72 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" value={selectedExam} onChange={e=>setSelectedExam(e.target.value)}>
                  <option value="">Most recent published…</option>
                  {publishedExams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name} • {ex.year} • T{ex.term} • {classNameById(ex.klass)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2">
                <span className="shrink-0">Block</span>
                <select className="w-full sm:w-72 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" value={selectedBlock} onChange={e=>setSelectedBlock(e.target.value)}>
                  <option value="">Select exam block…</option>
                  {examBlocks.map(b => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-2 rounded border border-red-200">{error}</div>}

      {viewMode==='class' && !selectedExam ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-sm text-gray-600">No published exams found for this grade.</div>
      ) : viewMode==='class' && !summary ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">Loading…</div>
      ) : viewMode==='class' ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm md:text-base text-gray-700">{summary?.exam?.name || 'Exam'} • Year {summary?.exam?.year || ''} • T{summary?.exam?.term || ''}</div>
            <div className="flex items-center gap-2">
              {summary?.class_mean != null && (
                <div className="text-sm mr-2">Class Mean: <b>{summary.class_mean}</b></div>
              )}
              <button onClick={handleClassCSV} className="px-2 py-1 text-xs rounded border border-gray-200">Download CSV</button>
              <button onClick={handleClassPrint} className="px-2 py-1 text-xs rounded border border-gray-200">Print</button>
            </div>
          </div>
          <div className="overflow-auto -mx-2 md:mx-0">
            <div className="inline-block min-w-[900px] align-middle">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border border-gray-200 px-2 py-2 text-left w-20">Position</th>
                    <th className="border border-gray-200 px-2 py-2 text-left w-56">Student</th>
                    {summary.subjects.map(s => (
                      <th key={s.id} className="border border-gray-200 px-2 py-2 text-left">{s.name || s.code}</th>
                    ))}
                    <th className="border border-gray-200 px-2 py-2 text-left">Total</th>
                    <th className="border border-gray-200 px-2 py-2 text-left">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students.map((st,idx) => (
                    <tr key={st.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="border border-gray-200 px-2 py-2">{st.position}</td>
                      <td className="border border-gray-200 px-2 py-2">{st.name}</td>
                      {summary.subjects.map(s => (
                        <td key={s.id} className="border border-gray-200 px-2 py-2">{st.marks?.[String(s.id)] ?? '-'}</td>
                      ))}
                      <td className="border border-gray-200 px-2 py-2 font-medium">{st.total}</td>
                      <td className="border border-gray-200 px-2 py-2">{toGrade(st.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm md:text-base text-gray-700">Grade Overview {selectedBlock && `• ${examBlocks.find(b=>b.key===selectedBlock)?.label}`}</div>
            <div className="flex items-center gap-2">
              {gradeSummaries.length>0 && (
                <div className="text-sm text-gray-600 mr-2">Classes: <b>{gradeSummaries.length}</b></div>
              )}
              <button onClick={handleGradeCSV} className="px-2 py-1 text-xs rounded border border-gray-200">Download CSV</button>
              <button onClick={handleGradePrint} className="px-2 py-1 text-xs rounded border border-gray-200">Print</button>
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
                    <td colSpan="3" className="border border-gray-200 px-2 py-4 text-center text-gray-500">No data to show</td>
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
                      <td className="border border-gray-200 px-2 py-2 font-medium">{s.total ?? '-'}</td>
                      <td className="border border-gray-200 px-2 py-2">{toGrade(s.average)}</td>
                    </tr>
                  ))}
                  {gradeStudents.length===0 && (
                    <tr><td colSpan="5" className="border border-gray-200 px-2 py-4 text-center text-gray-500">No students to show</td></tr>
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
