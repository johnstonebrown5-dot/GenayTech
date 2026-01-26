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
  const [recentExam, setRecentExam] = useState(null)
  const [summary, setSummary] = useState({ subjects: [], students: [] })
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [examsForClass, setExamsForClass] = useState([])
  const [school, setSchool] = useState(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const [layout, setLayout] = useState('cards') // cards | summary
  const [admissions, setAdmissions] = useState(new Map()) // Map(studentId -> admission_no)
  const [classRankMapApi, setClassRankMapApi] = useState(new Map()) // Map(studentId -> { position, size })
  const [gradeRankMapApi, setGradeRankMapApi] = useState(new Map()) // Map(studentId -> { position, size })
  const [bandsBySubject, setBandsBySubject] = useState(new Map()) // Map(subjectId -> bands[])
  const [globalBands, setGlobalBands] = useState(null) // bands[] to use for overall grade mapping

  useEffect(()=>{
    let active = true
    ;(async ()=>{
      setLoading(true)
      setError('')
      try{
        const { data } = await api.get(`/academics/classes/${id}/`)
        if (!active) return
        setKlass(data)
        // fetch school for header/logo
        try{
          const sch = await api.get('/auth/school/info/')
          if (active) setSchool(sch.data)
        }catch{}
        // fetch exams for class, pick latest
        const ex = await api.get('/academics/exams/', { params: { include_history: true } })
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
          // If URL has exam param, prefer it
          const qExam = Number(searchParams.get('exam'))
          const chosen = forClass.find(e=>Number(e.id)===qExam) || forClass[0]
          setRecentExam(chosen)
        } else {
          setRecentExam(null)
        }
        // fetch students to map admission numbers
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
  }, [id])

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

  // When we have an exam and students, fetch rank data from backend per student
  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!recentExam?.id || !Array.isArray(summary.students) || summary.students.length===0) return
      const entries = await Promise.allSettled(summary.students.map(async (st)=>{
        const { data } = await api.get(`/academics/exams/${recentExam.id}/rank`, { params: { student: st.id } })
        return { id: st.id, data }
      }))
      if (!active) return
      const classMap = new Map()
      const gradeMap = new Map()
      for (const r of entries){
        if (r.status === 'fulfilled' && r.value?.id){
          const d = r.value.data || {}
          if (d.class){ classMap.set(r.value.id, { position: d.class.position, size: d.class.size }) }
          if (d.grade){ gradeMap.set(r.value.id, { position: d.grade.position, size: d.grade.size }) }
        }
      }
      setClassRankMapApi(classMap)
      setGradeRankMapApi(gradeMap)
    })()
    return ()=>{ active = false }
  }, [recentExam?.id, summary.students])

  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!recentExam?.id) { setSummary({ subjects: [], students: [] }); return }
      setLoadingSummary(true)
      try{
        const { data } = await api.get(`/academics/exams/${recentExam.id}/summary/`)
        if (!active) return
        setSummary(data)
        // Fetch grading bands per subject for dynamic grade mapping
        try{
          const subjIds = (Array.isArray(data?.subjects)?data.subjects:[]).map(s=>s.id).filter(Boolean)
          const entries = await Promise.allSettled(subjIds.map(async sid => {
            const res = await api.get(`/academics/subject_grading/?subject=${sid}&_=${Date.now()}`)
            const bands = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
            return { sid, bands }
          }))
          if (!active) return
          const map = new Map()
          let picked = null
          for (const r of entries){
            if (r.status==='fulfilled'){
              map.set(r.value.sid, r.value.bands)
              if (!picked && Array.isArray(r.value.bands) && r.value.bands.length>0) picked = r.value.bands
            }
          }
          setBandsBySubject(map)
          setGlobalBands(picked)
        }catch{}
      }catch(_){
        if (!active) return
        setSummary({ subjects: [], students: [] })
      }finally{
        if (active) setLoadingSummary(false)
      }
    })()
    return ()=>{ active = false }
  }, [recentExam])

  const handlePrint = () => {
    try { window.print() } catch(_) {}
  }

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

  const subjectRemark = (score, subjectLabel) => {
    const n = Number(score)
    const name = String(subjectLabel || '').toLowerCase()
    const isKiswahili = name.includes('kis') || name.includes('swahili')
    if (!Number.isFinite(n)) return isKiswahili ? 'Hakuna alama' : 'No marks'
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

  const letterFromBands = (score, bands) => {
    const n = Number(score)
    if (!Number.isFinite(n)) return '-'
    const arr = Array.isArray(bands) ? [...bands] : []
    arr.sort((a,b)=> Number(b.min ?? -Infinity) - Number(a.min ?? -Infinity))
    for (const b of arr){
      const min = Number.isFinite(Number(b.min)) ? Number(b.min) : -Infinity
      const max = Number.isFinite(Number(b.max)) ? Number(b.max) : Infinity
      if (n >= min && n <= max) return String(b.grade || '-')
    }
    // fallback default scale
    if (n >= 80) return 'A'
    if (n >= 70) return 'B'
    if (n >= 60) return 'C'
    if (n >= 50) return 'D'
    return 'E'
  }

  const gradeForSubject = (sid, score) => {
    const bands = bandsBySubject.get?.(sid)
    return letterFromBands(score, bands)
  }

  const gradeForAverage = (avg) => letterFromBands(avg, globalBands)

  return (
    <React.Fragment>
    <div className="p-4">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
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
      <div className="print-root max-w-6xl mx-auto space-y-3">
        <div className="flex items-center justify-between no-print">
          <h1 className="text-lg sm:text-xl font-semibold">{title}</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600" htmlFor="examSelect">Exam</label>
              <select id="examSelect" className="px-2 py-1.5 border rounded bg-white text-sm" value={recentExam?.id || ''} onChange={(e)=>{
                const ex = examsForClass.find(x=>String(x.id)===String(e.target.value))
                setRecentExam(ex || null)
              }}>
                {examsForClass.length===0 ? (<option value="">No exams</option>) : examsForClass.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name} — {ex.year} • T{ex.term}</option>
                ))}
              </select>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <label className="text-sm text-gray-600">Layout</label>
              <div className="flex rounded overflow-hidden border">
                <button type="button" onClick={()=>setLayout('cards')} className={`px-2 py-1 text-sm ${layout==='cards'?'bg-gray-800 text-white':'bg-white'}`}>Report Cards</button>
                <button type="button" onClick={()=>setLayout('summary')} className={`px-2 py-1 text-sm ${layout==='summary'?'bg-gray-800 text-white':'bg-white'}`}>Summary</button>
              </div>
            </div>
            {!embedded && (<Link to={backTo} className="px-3 py-1.5 rounded border hover:bg-gray-50">Back</Link>)}
            <button onClick={handlePrint} className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700">Print</button>
          </div>
        </div>

        {error && <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700">{error}</div>}
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
                        {summary.students.length === 0 ? (
                          <tr><td className="px-2 py-3 text-sm text-gray-500" colSpan={(summary.subjects?.length||0)+3}>No results captured for this exam yet.</td></tr>
                        ) : (
                          summary.students.map(st => (
                            <tr key={st.id} className="hover:bg-gray-50">
                              <td className="border px-2 py-1 sticky left-0 bg-white">{st.name}</td>
                              {summary.subjects.map(s => (
                                <td key={s.id} className="border px-2 py-1 text-center">{st.marks?.[String(s.id)] ?? '-'}</td>
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
                {summary.students.length === 0 ? (
                  <div className="bg-white rounded border p-4 text-sm text-gray-600">No results captured for this exam yet.</div>
                ) : (
                  summary.students.map((st, idx) => (
                    <div key={st.id || idx} className="report-card relative overflow-hidden rounded-xl border border-gray-300 bg-white shadow-lg">
                      {/* Watermark background: school logo */}
                      {(() => {
                        const raw = (school?.logo_url || school?.logo || '')
                        const has = !!raw
                        const bgStyle = has ? {
                          backgroundImage: `url(${raw})`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          backgroundSize: '65%',
                          opacity: 0.07,
                          filter: 'grayscale(100%)',
                        } : { background: 'linear-gradient(180deg,#f8fafc,rgba(248,250,252,0.7))' }
                        return <div className="absolute inset-0 pointer-events-none" style={bgStyle}></div>
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

                        <div className="px-6 grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div><span className="text-gray-600">Students name</span><div className="font-medium">{st.name}</div></div>
                            <div><span className="text-gray-600">Class</span><div className="font-medium">{klass?.name || '-'}</div></div>
                            <div><span className="text-gray-600">Grade</span><div className="font-medium">{klass?.grade_level || '-'}</div></div>
                            <div><span className="text-gray-600">Admission number</span><div className="font-medium">{admissions.get(st.id) || '-'}</div></div>
                          </div>
                          <div className="space-y-1 text-right">
                            <div><span className="text-gray-600">TERM</span><div className="font-medium">T{recentExam?.term || '-'}</div></div>
                            <div><span className="text-gray-600">ACADEMIC YEAR</span><div className="font-medium">{recentExam?.year || '-'}</div></div>
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
                                const v = st.marks?.[String(s.id)]
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
                            <div className="text-center font-semibold">{classRankMapApi.get(st.id)?.position || rankMap.get(st.id) || '-'}</div>
                          </div>
                          <div className="border rounded p-2 bg-gray-50">
                            <div className="text-center">Grade Position</div>
                            <div className="text-center font-semibold">{gradeRankMapApi.get(st.id)?.position || '-'}</div>
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
