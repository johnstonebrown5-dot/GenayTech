import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom'
import api from '../api'

export default function AdminClassPrintReportCards({ classIdProp = null, embedded = false }){
  const params = useParams()
  const { id: routeId } = params || {}
  const id = String(classIdProp ?? routeId ?? '')
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [klass, setKlass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [recentExam, setRecentExam] = useState(null)
  const [summary, setSummary] = useState({ subjects: [], students: [] })
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [examsForClass, setExamsForClass] = useState([])
  const [school, setSchool] = useState(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const [layout, setLayout] = useState('cards') // cards | summary
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [printOnlyStudentId, setPrintOnlyStudentId] = useState(null)
  const [admissions, setAdmissions] = useState(new Map()) // Map(studentId -> admission_no)
  const [classRankMapApi, setClassRankMapApi] = useState(new Map()) // Map(studentId -> { position, size })
  const [gradeRankMapApi, setGradeRankMapApi] = useState(new Map()) // Map(studentId -> { position, size })
  const [bandsBySubject, setBandsBySubject] = useState(new Map()) // Map(subjectId -> bands[])
  const [globalBands, setGlobalBands] = useState(null) // bands[] to use for overall grade mapping (stage defaults)
  const [stageBands, setStageBands] = useState(null) // stage-wide default bands

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const withRetry = async (fn, { attempts = 3, baseDelayMs = 350 } = {}) => {
    let lastErr = null
    for (let i = 0; i < attempts; i++){
      try{
        return await fn(i)
      }catch(e){
        lastErr = e
        const delay = baseDelayMs * Math.pow(2, i)
        await sleep(delay)
      }
    }
    throw lastErr
  }

  useEffect(()=>{
    let active = true
    ;(async ()=>{
      setLoading(true)
      setError('')
      try{
        const klassRes = await withRetry(() => api.get(`/academics/classes/${id}/`), { attempts: 4, baseDelayMs: 300 })
        if (!active) return
        const klassData = klassRes?.data
        setKlass(klassData)

        try{
          let stg = klassData?.stage
          if (!stg){
            const num = (()=>{ try{ const m = String(klassData?.grade_level||'').match(/(\d{1,2})/); return m? Number(m[1]) : NaN }catch{return NaN} })()
            if (Number.isFinite(num)) stg = (num>=1 && num<=6) ? 'primary' : ((num>=7 && num<=9) ? 'junior' : null)
          }
          if (stg){
            const sb = await withRetry(() => api.get('/academics/stage_grading/', { params: { stage: stg, _ : Date.now() } }), { attempts: 3, baseDelayMs: 250 })
            const list = Array.isArray(sb.data) ? sb.data : (Array.isArray(sb.data?.results) ? sb.data.results : [])
            if (active){
              setStageBands(list)
              setGlobalBands(list)
            }
          } else {
            if (active) setStageBands(null)
          }
        }catch{ if (active) setStageBands(null) }

        try{
          const sch = await api.get('/auth/school/info/')
          if (active) setSchool(sch.data)
        }catch{}

        const ex = await withRetry(() => api.get('/academics/exams/', { params: { include_history: true } }), { attempts: 4, baseDelayMs: 300 })
        if (!active) return
        const list = Array.isArray(ex.data) ? ex.data : (Array.isArray(ex.data?.results) ? ex.data.results : [])
        const cid = Number(id)
        const forClass = list.filter(e => Number(e.klass) === cid)
        setExamsForClass(forClass)
        if (forClass.length){
          forClass.sort((a,b)=>{
            const da = a.date ? new Date(a.date).getTime() : 0
            const db = b.date ? new Date(b.date).getTime() : 0
            if (db !== da) return db - da
            return (b.id||0) - (a.id||0)
          })
          const qExam = Number(searchParams.get('exam'))
          const chosen = forClass.find(e=>Number(e.id)===qExam) || forClass[0]
          setRecentExam(chosen)
        } else {
          setRecentExam(null)
        }

        try{
          const st = await api.get('/academics/students/', { params: { klass: id } })
          if (active){
            const arr = Array.isArray(st.data) ? st.data : (Array.isArray(st.data?.results) ? st.data.results : [])
            const m = new Map()
            arr.forEach(s => { m.set(s.id, s.admission_no || s.admission || s.adm_no || '') })
            setAdmissions(m)
          }
        }catch{}
      }catch(err){
        if (!active) return
        setError(err?.response?.data?.detail || 'Failed to load class')
      }finally{
        if (active) setLoading(false)
      }
    })()
    return ()=>{ active = false }
  }, [id, reloadNonce])

  // Keep URL in sync when exam changes
  useEffect(()=>{
    const exId = recentExam?.id
    const curr = searchParams.get('exam')
    if (!embedded && exId && String(curr)!==String(exId)){
      const sp = new URLSearchParams(searchParams)
      sp.set('exam', String(exId))
      setSearchParams(sp, { replace: true })
    }
  }, [recentExam, embedded])

  // Reset student filter when exam changes
  useEffect(()=>{
    setStudentSearch('')
    setSelectedStudentId('')
    setPrintOnlyStudentId(null)
  }, [recentExam?.id])

  // When we have an exam and students, fetch rank data in bulk (avoid N+1 calls)
  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!recentExam?.id || !Array.isArray(summary.students) || summary.students.length===0) return
      try{
        const { data } = await api.get(`/academics/exams/${recentExam.id}/ranks/`)
        if (!active) return
        const classRows = data?.class && typeof data.class === 'object' ? data.class : {}
        const gradeRows = data?.grade && typeof data.grade === 'object' ? data.grade : {}
        const classMap = new Map()
        const gradeMap = new Map()
        for (const st of summary.students){
          const sid = st?.id
          if (sid == null) continue
          const c = classRows[String(sid)]
          const g = gradeRows[String(sid)]
          if (c && typeof c === 'object') classMap.set(sid, { position: c.position, size: c.size })
          if (g && typeof g === 'object') gradeMap.set(sid, { position: g.position, size: g.size })
        }
        setClassRankMapApi(classMap)
        setGradeRankMapApi(gradeMap)
      }catch{
        if (!active) return
        setClassRankMapApi(new Map())
        setGradeRankMapApi(new Map())
      }
    })()
    return ()=>{ active = false }
  }, [recentExam?.id, summary.students])

  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!recentExam?.id) { setSummary({ subjects: [], students: [] }); return }
      setLoadingSummary(true)
      try{
        const { data } = await withRetry(() => api.get(`/academics/exams/${recentExam.id}/summary/`), { attempts: 4, baseDelayMs: 300 })
        if (!active) return
        setSummary(data)
        // Fetch grading bands per subject for dynamic grade mapping (subject overrides). Fallback to stage bands for missing subjects.
        try{
          const subjIds = (Array.isArray(data?.subjects)?data.subjects:[]).map(s=>s.id).filter(Boolean)
          const entries = await Promise.allSettled(subjIds.map(async sid => {
            const res = await api.get(`/academics/subject_grading/?subject=${sid}&_=${Date.now()}`)
            const bands = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
            return { sid, bands }
          }))
          if (!active) return
          const map = new Map()
          for (const r of entries){
            if (r.status==='fulfilled'){
              map.set(r.value.sid, r.value.bands)
            }
          }
          setBandsBySubject(map)
          // If no stageBands yet and at least one subject has bands, use that as global fallback
          if (!stageBands){
            const anyBands = [...map.values()].find(arr => Array.isArray(arr) && arr.length>0) || null
            if (anyBands) setGlobalBands(anyBands)
          }
        }catch{}
      }catch(_){
        if (!active) return
        setSummary({ subjects: [], students: [] })
      }finally{
        if (active) setLoadingSummary(false)
      }
    })()
    return ()=>{ active = false }
  }, [recentExam, reloadNonce])

  const handlePrint = () => {
    try { window.print() } catch(_) {}
  }

  const handlePrintSelected = () => {
    if (!selectedStudentId) return
    setPrintOnlyStudentId(String(selectedStudentId))
    setTimeout(() => {
      try { window.print() } catch(_) {}
      setTimeout(() => { setPrintOnlyStudentId(null) }, 250)
    }, 50)
  }

  const clearStudentFilter = () => {
    setStudentSearch('')
    setSelectedStudentId('')
    setPrintOnlyStudentId(null)
  }

  const filteredStudents = useMemo(() => {
    const arr = Array.isArray(summary?.students) ? summary.students : []
    const q = String(studentSearch || '').trim().toLowerCase()
    let out = !q ? arr : arr.filter(s => String(s?.name || '').toLowerCase().includes(q))
    if (selectedStudentId) out = out.filter(s => String(s?.id) === String(selectedStudentId))
    return out
  }, [summary?.students, studentSearch, selectedStudentId])

  const studentsToRender = useMemo(() => {
    const arr = Array.isArray(summary?.students) ? summary.students : []
    if (printOnlyStudentId) return arr.filter(s => String(s?.id) === String(printOnlyStudentId))
    return filteredStudents
  }, [summary?.students, filteredStudents, printOnlyStudentId])

  const studentSuggestions = useMemo(() => {
    const arr = Array.isArray(summary?.students) ? summary.students : []
    const q = String(studentSearch || '').trim().toLowerCase()
    const filtered = !q ? arr : arr.filter(s => String(s?.name || '').toLowerCase().includes(q))
    return filtered.slice(0, 12)
  }, [summary?.students, studentSearch])

  const title = useMemo(()=>{
    return `${klass?.name || 'Class'} — ${recentExam?.name || 'Exam'} Results`
  }, [klass?.name, recentExam?.name])

  const backTo = useMemo(() => {
    const p = String(location?.pathname || '')
    if (p.startsWith('/teacher/')) return '/teacher/manage-class?tab=info'
    return `/admin/classes/${id}`
  }, [location?.pathname, id])

  const rankMap = useMemo(()=>{
    const arr = Array.isArray(summary.students) ? summary.students.slice() : []
    arr.sort((a,b)=> Number(b.total||0) - Number(a.total||0))
    const map = new Map()
    arr.forEach((s, i) => { map.set(s.id, i+1) })
    return map
  }, [summary.students])

  const gradeBadgeClass = (g) => {
    const x = String(g||'').toUpperCase()
    if (x === 'A') return 'bg-emerald-100 text-emerald-700'
    if (x === 'B') return 'bg-blue-100 text-blue-700'
    if (x === 'C') return 'bg-amber-100 text-amber-800'
    if (x === 'D') return 'bg-orange-100 text-orange-700'
    if (x === 'E') return 'bg-rose-100 text-rose-700'
    return 'bg-gray-100 text-gray-700'
  }

  const letterFromBands = (score, bands) => {
    const raw = Number(score)
    if (!Number.isFinite(raw)) return '-'
    const n = Math.max(0, Math.min(100, Math.round(raw)))
    const arr = Array.isArray(bands) ? [...bands] : []
    // Normalize bands to ensure min/max are numbers (API may return strings)
    const normalizedBands = arr.map(b => ({
      ...b,
      min: Number(b.min),
      max: Number(b.max),
      grade: String(b.grade || '-')
    }))
    // higher min first for overall grade mapping
    normalizedBands.sort((a,b)=> (b.min ?? -Infinity) - (a.min ?? -Infinity))
    let lowest = null
    let highest = null
    for (const b of normalizedBands){
      const min = Number.isFinite(b.min) ? b.min : -Infinity
      const max = Number.isFinite(b.max) ? b.max : Infinity
      if (!lowest || min < lowest.min) lowest = { min, grade: b.grade }
      if (!highest || min > highest.min) highest = { min, grade: b.grade }
      if (n >= min && n <= max) return b.grade
    }
    if (highest && n >= highest.min) return highest.grade
    if (lowest) return lowest.grade
    if (n >= 80) return 'A'
    if (n >= 70) return 'B'
    if (n >= 60) return 'C'
    if (n >= 50) return 'D'
    return 'E'
  }

  // Return the matching band for a score (used for remarks and grade lookup)
  const bandForScore = (score, bands) => {
    const raw = Number(score)
    if (!Number.isFinite(raw)) return null
    const n = Math.max(0, Math.min(100, Math.round(raw)))
    const arr = Array.isArray(bands) ? [...bands] : []
    // Ensure min/max are treated as numbers (API may return strings)
    const normalizedBands = arr.map(b => ({
      ...b,
      min: Number(b.min),
      max: Number(b.max)
    }))
    normalizedBands.sort((a,b)=> (b.min ?? -Infinity) - (a.min ?? -Infinity))
    for (const b of normalizedBands){
      const min = Number.isFinite(b.min) ? b.min : -Infinity
      const max = Number.isFinite(b.max) ? b.max : Infinity
      if (n >= min && n <= max) return b
    }
    return null
  }

  const subjectRemark = (score, subjectLabel) => {
    const n = Number(score)
    if (!Number.isFinite(n)) {
      const name = String(subjectLabel || '').toLowerCase()
      return (name.includes('kis') || name.includes('swahili')) ? 'Hakuna alama' : 'No marks'
    }
    // Use configured band remarks if available
    const bands = stageBands || globalBands
    const band = bandForScore(n, bands)
    const remark = band?.remarks?.trim()
    if (remark) return remark
    // Fallback to default remarks
    const name = String(subjectLabel || '').toLowerCase()
    const isKiswahili = name.includes('kis') || name.includes('swahili')
    let g = 'E'
    if (n >= 80) g = 'A'
    else if (n >= 70) g = 'B'
    else if (n >= 60) g = 'C'
    else if (n >= 50) g = 'D'
    if (isKiswahili){
      if (g === 'A') return 'Bora sana'
      if (g === 'B') return 'Vizuri sana'
      if (g === 'C') return 'Vizuri'
      if (g === 'D') return 'Wastani'
      return 'Inahitaji juhudi'
    }
    if (g === 'A') return 'Excellent'
    if (g === 'B') return 'Very good'
    if (g === 'C') return 'Good'
    if (g === 'D') return 'Fair'
    return 'Needs improvement'
  }

  const gradeForSubject = (_sid, score) => {
    // Apply stage-wide grading across all subjects
    return letterFromBands(score, stageBands || globalBands)
  }

  const gradeForAverage = (avg) => letterFromBands(avg, stageBands || globalBands)

  return (
    <React.Fragment>
    <div className="p-4">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* Hide everything except the report cards area */
          body * { visibility: hidden !important; }
          .print-root, .print-root * { visibility: visible !important; }
          .print-root { position: absolute !important; top: 0; left: 0; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }

          .no-print { display: none !important; }
          thead { position: sticky; top: 0; }
          .report-card { page-break-after: always; box-shadow: none !important; }
          .report-card:last-child { page-break-after: auto; }
        }
      `}</style>
      <div className={`print-root ${embedded ? 'w-full max-w-none mx-0' : 'max-w-6xl mx-auto'} space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print mb-4">
          <h1 className="text-lg sm:text-xl font-semibold">{title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap" htmlFor="examSelect">Exam</label>
              <select id="examSelect" className="px-2 py-1.5 border rounded bg-white text-sm min-w-[140px]" value={recentExam?.id || ''} onChange={(e)=>{
                const ex = examsForClass.find(x=>String(x.id)===String(e.target.value))
                setRecentExam(ex || null)
              }}>
                {examsForClass.length===0 ? (<option value="">No exams</option>) : examsForClass.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name} — {ex.year} • T{ex.term}</option>
                ))}
              </select>
            </div>
            <div className="flex sm:flex items-center gap-2">
              <label className="text-sm text-gray-600">Layout</label>
              <div className="flex rounded overflow-hidden border">
                <button type="button" onClick={()=>setLayout('cards')} className={`px-2 py-1 text-sm ${layout==='cards'?'bg-gray-800 text-white':'bg-white'}`}>Cards</button>
                <button type="button" onClick={()=>setLayout('summary')} className={`px-2 py-1 text-sm ${layout==='summary'?'bg-gray-800 text-white':'bg-white'}`}>List</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <input
                value={studentSearch}
                onChange={(e)=>{ setStudentSearch(e.target.value); if (selectedStudentId) setSelectedStudentId('') }}
                placeholder="Search student"
                className="px-2 py-1.5 border rounded bg-white text-sm w-full sm:w-44"
              />
              <select
                value={selectedStudentId}
                onChange={(e)=> setSelectedStudentId(e.target.value)}
                className="px-2 py-1.5 border rounded bg-white text-sm w-full sm:w-44"
                disabled={!studentSuggestions.length}
                title="Select a student"
              >
                <option value="">Select…</option>
                {studentSuggestions.map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
              <button type="button" onClick={clearStudentFilter} className="px-2 py-1.5 rounded border text-sm bg-white hover:bg-gray-50 w-full sm:w-auto">Clear</button>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!embedded && (<Link to={backTo} className="flex-1 sm:flex-none text-center px-3 py-1.5 rounded border hover:bg-gray-50 text-sm">Back</Link>)}
              <button onClick={handlePrint} className="flex-1 sm:flex-none px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm">Print All</button>
              <button onClick={handlePrintSelected} disabled={!selectedStudentId} className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-sm ${selectedStudentId ? 'bg-gray-900 text-white hover:bg-black' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>Print Selected</button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 flex items-center justify-between gap-3">
            <div className="min-w-0">{error}</div>
            <button type="button" onClick={()=> setReloadNonce(v=>v+1)} className="shrink-0 px-3 py-1.5 rounded border border-red-200 bg-white text-sm hover:bg-red-50">Retry</button>
          </div>
        )}
        {loading && <div className="p-3 rounded border bg-white">Loading...</div>}

        {!loading && !error && (
          <>
            {layout==='summary' ? (
              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 border-b bg-gray-50">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <div><span className="text-gray-500">Class:</span> <span className="font-medium">{klass?.name || '-'}</span></div>
                    <div><span className="text-gray-500">Grade:</span> <span className="font-medium">{klass?.grade_level || '-'}</span></div>
                    <div><span className="text-gray-500">Exam:</span> <span className="font-medium">{recentExam?.name || '-'}</span></div>
                    <div><span className="text-gray-500">Year:</span> <span className="font-medium">{recentExam?.year || '-'}</span></div>
                    <div><span className="text-gray-500">Term:</span> <span className="font-medium">T{recentExam?.term || '-'}</span></div>
                    <div><span className="text-gray-500">Date:</span> <span className="font-medium">{recentExam?.date || '-'}</span></div>
                  </div>
                </div>
                {(!recentExam || loadingSummary) && (
                  <div className="p-3 text-sm text-gray-600">{!recentExam ? 'No exams found for this class.' : 'Loading results...'}</div>
                )}
                {!!recentExam && !loadingSummary && (
                  <div className="overflow-auto">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border px-2 py-1 text-left whitespace-nowrap sticky left-0 bg-gray-50">Student</th>
                          {summary.subjects.map(s => (
                            <th key={s.id} className="border px-2 py-1 text-center whitespace-nowrap">{s.code}</th>
                          ))}
                          <th className="border px-2 py-1 text-right whitespace-nowrap">Total</th>
                          <th className="border px-2 py-1 text-center whitespace-nowrap">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentsToRender.length === 0 ? (
                          <tr><td className="px-2 py-3 text-sm text-gray-500" colSpan={(summary.subjects?.length||0)+3}>No results captured for this exam yet.</td></tr>
                        ) : (
                          studentsToRender.map(st => (
                            <tr key={st.id} className="hover:bg-gray-50">
                              <td className="border px-2 py-1 sticky left-0 bg-white">{st.name}</td>
                              {summary.subjects.map(s => (
                                <td key={s.id} className="border px-2 py-1 text-center">{(()=>{
                                  const v = st.subject_percentages?.[String(s.id)]
                                  return (v !== undefined && v !== null) ? Number(v) : '-'
                                })()}</td>
                              ))}
                              <td className="border px-2 py-1 font-medium text-right">{st.total}</td>
                              <td className="border px-2 py-1 text-center">{gradeForAverage(st.average)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* One report card per student */}
                {studentsToRender.length === 0 ? (
                  <div className="bg-white rounded border p-4 text-sm text-gray-600">No results captured for this exam yet.</div>
                ) : (
                  studentsToRender.map((st, idx) => (
                    <div key={st.id || idx} className="report-card relative overflow-hidden rounded-xl border border-gray-300 bg-white shadow-lg">
                      {/* Watermark background: school logo */}
                      {(() => {
                        const raw = (school?.logo_url || school?.logo || '')
                        const has = !!raw
                        if (has){
                          return (
                            <img
                              src={raw}
                              alt=""
                              className="absolute left-1/2 top-1/2 pointer-events-none"
                              style={{
                                transform: 'translate(-50%, -50%)',
                                width: '72%',
                                height: 'auto',
                                opacity: 0.13,
                                filter: 'grayscale(100%)',
                              }}
                            />
                          )
                        }
                        return <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,#f8fafc,rgba(248,250,252,0.7))' }}></div>
                      })()}
                      <div className="relative m-3 sm:m-4 md:m-6 border-2 border-gray-700 rounded-lg">
                        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-violet-500 rounded-t-md"></div>
                        <div className="px-5 pt-6 pb-3 text-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            {(() => {
                              const rawUrl = (school?.logo_url || school?.logo || '')
                              const src = rawUrl || ''
                              return src && !logoFailed ? (
                                <img src={src} alt="School Logo" className="w-10 h-10 object-contain" onError={()=>setLogoFailed(true)} />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400">🏫</div>
                              )
                            })()}
                            <div className="text-xl font-extrabold tracking-wide">{school?.name || 'SCHOOL NAME'}</div>
                          </div>
                          {school?.motto ? (<div className="uppercase text-xs tracking-wider text-gray-600">{school.motto}</div>) : null}
                        </div>

                        <div className="px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div><span className="text-gray-600 block text-xs uppercase font-medium">Student Name</span><div className="font-semibold text-slate-900">{st.name}</div></div>
                            <div className="flex gap-4 sm:block">
                              <div className="flex-1"><span className="text-gray-600 block text-xs uppercase font-medium">Class</span><div className="font-semibold text-slate-900">{klass?.name || '-'}</div></div>
                              <div className="flex-1"><span className="text-gray-600 block text-xs uppercase font-medium">Grade</span><div className="font-semibold text-slate-900">{klass?.grade_level || '-'}</div></div>
                            </div>
                            <div><span className="text-gray-600 block text-xs uppercase font-medium">Admission Number</span><div className="font-semibold text-slate-900">{admissions.get(st.id) || '-'}</div></div>
                          </div>
                          <div className="space-y-1 text-left sm:text-right">
                            <div className="flex gap-4 sm:block sm:justify-end">
                              <div className="flex-1 sm:flex-none"><span className="text-gray-600 block text-xs uppercase font-medium">Term</span><div className="font-semibold text-slate-900">T{recentExam?.term || '-'}</div></div>
                              <div className="flex-1 sm:flex-none"><span className="text-gray-600 block text-xs uppercase font-medium">Academic Year</span><div className="font-semibold text-slate-900">{recentExam?.year || '-'}</div></div>
                            </div>
                          </div>
                        </div>

                        <div className="px-6 mt-4">
                          <div className="border-t border-gray-400"></div>
                          <div className="text-center text-sm mt-2">{recentExam?.name || 'EXAM NAME'}</div>
                        </div>

                        <div className="px-6 mt-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-700">
                                <th className="text-left py-1">Subject</th>
                                <th className="text-right py-1">Marks</th>
                                <th className="text-center py-1">Grade</th>
                                <th className="text-left py-1">Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summary.subjects.map((s,i)=>{
                                const v = st.subject_percentages?.[String(s.id)]
                                const grade = gradeForSubject(s.id, v)
                                return (
                                  <tr key={s.id}>
                                    <td className="py-1 border-b border-gray-200">{s.code}</td>
                                    <td className="py-1 text-right border-b border-gray-200">{Number.isFinite(Number(v)) ? Number(v) : '-'}</td>
                                    <td className="py-1 text-center border-b border-gray-200">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block ${gradeBadgeClass(grade)}`}>{grade}</span>
                                    </td>
                                    <td className="py-1 border-b border-gray-200">{subjectRemark(v, s.code)}</td>
                                  </tr>
                                )
                              })}
                              <tr>
                                <td className="py-1 border-b border-gray-300 font-semibold">Total</td>
                                <td className="py-1 text-right border-b border-gray-300 font-semibold">{Number(st.total||0).toFixed(2)}</td>
                                <td className="py-1 text-center border-b border-gray-300 font-semibold">{gradeForAverage(st.average)}</td>
                                <td className="py-1 border-b border-gray-300 font-semibold"></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="px-6 mt-4 grid grid-cols-2 gap-4 text-sm">
                          <div className="border rounded p-2 bg-gray-50">
                            <div className="text-center">Class Position</div>
                            <div className="text-center font-semibold">{(() => {
                              const d = classRankMapApi.get(st.id)
                              if (d?.position && d?.size) return `${d.position}/${d.size}`
                              const fallbackPos = rankMap.get(st.id)
                              const fallbackSize = Array.isArray(summary?.students) ? summary.students.length : null
                              if (fallbackPos && fallbackSize) return `${fallbackPos}/${fallbackSize}`
                              return fallbackPos || '-'
                            })()}</div>
                          </div>
                          <div className="border rounded p-2 bg-gray-50">
                            <div className="text-center">Grade Position</div>
                            <div className="text-center font-semibold">{(() => {
                              const d = gradeRankMapApi.get(st.id)
                              if (d?.position && d?.size) return `${d.position}/${d.size}`
                              if (d?.position && d?.out_of) return `${d.position}/${d.out_of}`
                              return d?.position || '-'
                            })()}</div>
                          </div>
                        </div>

                        <div className="px-6 mt-4 grid grid-cols-2 gap-4 text-sm mb-6">
                          <div className="border rounded p-2 bg-white/80">
                            <div>Class Teacher Name</div>
                            <div className="font-medium">{klass?.teacher_detail ? `${klass.teacher_detail.first_name||''} ${klass.teacher_detail.last_name||''}`.trim() || klass.teacher_detail.username : '-'}</div>
                          </div>
                          <div className="border rounded p-2 bg-white/80">
                            <div>Remarks</div>
                            <div className="min-h-[40px]">{(() => {
                              const avg = Number(st.average || 0)
                              if (avg >= 80) return 'Excellent performance — keep it up.'
                              if (avg >= 70) return 'Very good work.'
                              if (avg >= 60) return 'Good, aim higher.'
                              if (avg >= 50) return 'Fair — effort needed.'
                              return 'Needs improvement — consult your teacher.'
                            })()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </React.Fragment>
  )
}
