import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../auth'
import { toAbsoluteUrl } from '../api'

export default function StudentReportCard(){
  const { user } = useAuth()
  const [student, setStudent] = useState(null)
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
  const [school, setSchool] = useState(null)
  const [ranks, setRanks] = useState({}) // { [examId]: rankData }
  const [dlStatus, setDlStatus] = useState('idle') // idle | preparing | downloading | failed | done
  const [teacherName, setTeacherName] = useState('')
  const [selectedTermYear, setSelectedTermYear] = useState(null) // e.g., '2025-T2'
  const [prevRank, setPrevRank] = useState(null)
  const [bandsBySubject, setBandsBySubject] = useState(new Map())
  const [globalBands, setGlobalBands] = useState(null)
  const [stageBands, setStageBands] = useState(null)

  // Build unique Term-Year options for published exams only, e.g., '2025-T2'
  const termYearOptions = useMemo(()=>{
    const set = new Set()
    for (const r of examResults){
      const ed = r.exam_detail || {}
      if (!ed?.published) continue
      const key = `${ed.year || ''}-T${ed.term || ''}`
      if (ed.year && ed.term) set.add(key)
    }
    return Array.from(set)
  }, [examResults])

  // Default selected term-year to the latest published exam's term-year
  useEffect(()=>{
    if (!selectedTermYear && examResults.length){
      for (let i = examResults.length - 1; i >= 0; i--) {
        const ed = examResults[i]?.exam_detail
        if (ed?.published && ed?.year && ed?.term){
          setSelectedTermYear(`${ed.year}-T${ed.term}`)
          break
        }
      }
    }
  }, [examResults, selectedTermYear])

  const parsedTermYear = useMemo(()=>{
    if (!selectedTermYear) return null
    const [y, t] = String(selectedTermYear).split('-T')
    const year = Number(y)
    const term = Number(t)
    if (!Number.isFinite(year) || !Number.isFinite(term)) return null
    return { year, term }
  }, [selectedTermYear])

  // All published exams in the selected term-year, preserve original order
  const termExams = useMemo(()=>{
    if (!parsedTermYear) return []
    const seen = new Set()
    const list = []
    for (const r of examResults){
      const ed = r.exam_detail || {}
      const id = ed.id || r.exam
      if (!id || seen.has(String(id))) continue
      if (!ed?.published) continue
      if (ed.year === parsedTermYear.year && ed.term === parsedTermYear.term){
        seen.add(String(id))
        list.push({ id, name: ed.name || String(r.exam || ''), total_marks: ed.total_marks, term: ed.term, year: ed.year, grade: ed.grade_level_tag })
      }
    }
    return list
  }, [examResults, parsedTermYear])

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      setLoading(true)
      setError('')
      try{
        // Fetch school separately to get authoritative logo_url (with request context)
        try{
          const sch = await api.get('/auth/school/info/')
          if (mounted) setSchool(sch.data)
        }catch{ /* ignore; fallback to user.school */ }
        const stRes = await api.get('/academics/students/my/')
        if (!mounted) return
        setStudent(stRes.data)
        // Load stage-wide grading bands for the student's class
        try{
          const stg = stRes?.data?.klass_detail?.stage
          if (stg){
            const sb = await api.get('/academics/stage_grading/', { params: { stage: stg, _: Date.now() } })
            const list = Array.isArray(sb.data) ? sb.data : (Array.isArray(sb.data?.results) ? sb.data.results : [])
            if (mounted){ setStageBands(list); setGlobalBands(list) }
          } else { if (mounted) setStageBands(null) }
        }catch{ if (mounted) setStageBands(null) }
        // Try to resolve class teacher name for the on-page card
        try{
          const kd = stRes.data?.klass_detail
          const tdet = kd?.teacher_detail
          if (tdet){
            const nm = `${tdet.first_name||''} ${tdet.last_name||''}`.trim() || (tdet.username||'')
            if (mounted) setTeacherName(nm)
          } else if (stRes.data?.klass){
            const klass = await api.get(`/academics/classes/${stRes.data.klass}/`)
            const t = klass?.data?.teacher_detail || null
            if (t){
              const nm = `${t.first_name||''} ${t.last_name||''}`.trim() || (t.username||'')
              if (mounted) setTeacherName(nm)
            }
          }
        }catch{}
        const exm = await api.get(`/academics/exam_results/?student=${stRes.data.id}`)
        if (!mounted) return
        setExamResults(Array.isArray(exm.data) ? exm.data : [])
      }catch(err){
        if (!mounted) return
        setError(err?.response?.data?.detail || err?.message || 'Failed to load report card')
      }finally{
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  }, [])

  // Fetch rank for each exam in selected term
  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!student?.id || termExams.length === 0) return
      const next = {}
      for (const ex of termExams){
        try{
          const { data } = await api.get(`/academics/exams/${ex.id}/ranks/`)
          if (!active) return
          const sid = String(student.id)
          const cls = (data?.class && typeof data.class === 'object') ? data.class[sid] : null
          const grd = (data?.grade && typeof data.grade === 'object') ? data.grade[sid] : null
          next[ex.id] = {
            class: cls ? { position: cls.position, size: cls.size } : undefined,
            grade: grd ? { position: grd.position, size: grd.size } : undefined,
          }
        }catch(_){ /* ignore */ }
      }
      if (active) setRanks(next)
    })()
    return ()=>{ active = false }
  }, [student?.id, termExams])

  const letterFromBands = (score, bands) => {
    const raw = Number(score)
    if (!Number.isFinite(raw)) return '-'
    const n = Math.max(0, Math.min(100, Math.round(raw)))
    const arr = Array.isArray(bands) ? [...bands] : []
    arr.sort((a,b)=> Number(b.min ?? -Infinity) - Number(a.min ?? -Infinity))
    let lowest = null
    let highest = null
    for (const b of arr){
      const min = Number.isFinite(Number(b.min)) ? Number(b.min) : -Infinity
      const max = Number.isFinite(Number(b.max)) ? Number(b.max) : Infinity
      if (!lowest || min < lowest.min) lowest = { min, grade: String(b.grade||'-') }
      if (!highest || min > highest.min) highest = { min, grade: String(b.grade||'-') }
      if (n >= min && n <= max) return String(b.grade||'-')
    }
    if (highest && n >= highest.min) return highest.grade
    if (lowest) return lowest.grade
    if (n >= 80) return 'A'
    if (n >= 70) return 'B'
    if (n >= 60) return 'C'
    if (n >= 50) return 'D'
    return 'E'
  }
  const toGrade = (score, subjectId) => {
    const subjBands = bandsBySubject.get?.(String(subjectId))
    return letterFromBands(score, (Array.isArray(subjBands) && subjBands.length) ? subjBands : stageBands || globalBands)
  }

  // Subjects present in the selected term across exams
  const subjects = useMemo(()=>{
    if (termExams.length === 0) return []
    const map = new Map()
    for (const r of examResults){
      const ed = r.exam_detail || {}
      if (!ed?.published) continue
      if (!parsedTermYear || ed.year !== parsedTermYear.year || ed.term !== parsedTermYear.term) continue
      const sid = r.subject_detail?.id || r.subject
      if (!sid) continue
      if (!map.has(String(sid))){
        const label = r.subject_detail ? `${r.subject_detail.code ? r.subject_detail.code + ' — ' : ''}${r.subject_detail.name || ''}` : String(r.subject || '')
        map.set(String(sid), { id: sid, label })
      }
    }
    return Array.from(map.values())
  }, [examResults, termExams, parsedTermYear])

  useEffect(()=>{
    let active = true
    ;(async ()=>{
      try{
        const ids = (subjects||[]).map(s=>s.id).filter(Boolean)
        if (ids.length===0) return
        const fetched = await Promise.allSettled(ids.map(async sid => {
          const res = await api.get(`/academics/subject_grading/?subject=${sid}&_=${Date.now()}`)
          const bands = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
          return { sid, bands }
        }))
        if (!active) return
        const map = new Map(bandsBySubject)
        let first = null
        for (const r of fetched){
          if (r.status==='fulfilled'){
            map.set(String(r.value.sid), r.value.bands)
            if (!first && Array.isArray(r.value.bands) && r.value.bands.length>0) first = r.value.bands
          }
        }
        setBandsBySubject(map)
        if (!stageBands && first) setGlobalBands(first)
      }catch{}
    })()
    return ()=>{ active = false }
  }, [subjects, stageBands])

  // Build marks per subject per exam for rendering
  const marksByExamAndSubject = useMemo(()=>{
    const out = {}
    for (const r of examResults){
      const ed = r.exam_detail || {}
      if (!ed?.published) continue
      if (!parsedTermYear || ed.year !== parsedTermYear.year || ed.term !== parsedTermYear.term) continue
      const exId = ed.id || r.exam
      const sid = r.subject_detail?.id || r.subject
      if (!exId || !sid) continue
      out[String(exId)] = out[String(exId)] || {}
      // Prefer component "Total" if present, else fall back to common mark fields
      const candidates = [
        r.total,
        r.component_total,
        r.components_total,
        r.subject_total,
        r.total_marks,
        r.total_mark,
        r.marks,
        r.score,
        r.mark,
        r.value,
      ]
      let val = 0
      for (const c of candidates){ const n = Number(c); if (Number.isFinite(n)) { val = n; break } }
      out[String(exId)][String(sid)] = val
    }
    return out
  }, [examResults, parsedTermYear])

  // Percentages per subject per exam (aggregates multi-component subjects)
  const percentagesByExamAndSubject = useMemo(()=>{
    const byKey = {} // { [exId]: { [sid]: { marksSum, denomSum, pctSum, pctCount } } }
    for (const r of examResults){
      const ed = r.exam_detail || {}
      if (!ed?.published) continue
      if (!parsedTermYear || ed.year !== parsedTermYear.year || ed.term !== parsedTermYear.term) continue
      const exId = ed.id || r.exam
      const sid = r.subject_detail?.id || r.subject
      if (!exId || !sid) continue
      byKey[String(exId)] = byKey[String(exId)] || {}
      const bucket = byKey[String(exId)][String(sid)] || { marksSum: 0, denomSum: 0, pctSum: 0, pctCount: 0 }

      const marks = Number(r.marks)
      const denom = (() => {
        const outOf = Number(r.out_of)
        if (Number.isFinite(outOf) && outOf > 0) return outOf
        const compMax = Number(r.component_detail?.max_marks)
        if (Number.isFinite(compMax) && compMax > 0) return compMax
        const examMax = Number(ed.total_marks)
        if (Number.isFinite(examMax) && examMax > 0) return examMax
        return NaN
      })()
      if (Number.isFinite(marks) && Number.isFinite(denom) && denom > 0){
        bucket.marksSum += marks
        bucket.denomSum += denom
      } else {
        const pct = Number(r.percentage)
        if (Number.isFinite(pct)) { bucket.pctSum += pct; bucket.pctCount += 1 }
      }

      byKey[String(exId)][String(sid)] = bucket
    }

    const out = {}
    for (const exId of Object.keys(byKey)){
      out[String(exId)] = {}
      for (const sid of Object.keys(byKey[String(exId)])){
        const b = byKey[String(exId)][String(sid)]
        let pct = NaN
        if (Number.isFinite(b.denomSum) && b.denomSum > 0){
          pct = (b.marksSum / b.denomSum) * 100
        } else if (b.pctCount > 0){
          pct = b.pctSum / b.pctCount
        }
        out[String(exId)][String(sid)] = Number.isFinite(pct) ? (Math.round(pct * 100) / 100) : NaN
      }
    }
    return out
  }, [examResults, parsedTermYear])

  // Overall totals across the term (sum over all exam-subject percentages)
  const totals = useMemo(()=>{
    if (subjects.length === 0 || termExams.length === 0) return { total: 0, count: 0, average: 0 }
    let total = 0
    let count = 0
    for (const ex of termExams){
      const m = percentagesByExamAndSubject[String(ex.id)] || {}
      for (const subj of subjects){
        const v = m[String(subj.id)]
        if (Number.isFinite(v)) { total += v; count += 1 }
      }
    }
    const average = count ? (total / count) : 0
    return { total, count, average }
  }, [subjects, termExams, percentagesByExamAndSubject])

  // Build exam history (unchanged, for context)
  const examHistory = useMemo(()=>{
    const map = new Map()
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      if (!id) continue
      if (!map.has(String(id))){
        const ed = r.exam_detail || {}
        map.set(String(id), {
          id,
          name: ed.name || String(r.exam || ''),
          year: ed.year || null,
          term: ed.term || null,
          grade: ed.grade_level_tag || null,
          published: !!ed.published
        })
      }
    }
    // Preserve original appearance order
    const seen = new Set()
    const list = []
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      if (id && !seen.has(String(id))){ seen.add(String(id)); const item = map.get(String(id)); if (item) list.push(item) }
    }
    return list
  }, [examResults])
 
  return (
    <div className="-mx-3 sm:mx-0 px-4 sm:px-6 pt-4 pb-6">
      {/* Print styles for a clean sheet */}
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .screen-only { display: none !important; }
          .print-container { box-shadow: none !important; border: none !important; }
          .print-header { position: fixed; top: 0; left: 0; right: 0; padding: 8px 0; }
          .print-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 6px 0; font-size: 10px; color: #6b7280; }
          .print-body { margin-top: 72px; margin-bottom: 36px; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Screen header (hidden on print) */}
        <div className="no-print rounded-3xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.08)] p-4 sm:p-5">
          <div className="flex items-center gap-3">
            {(() => {
              const rawUrl = (school?.logo_url || user?.school?.logo_url || school?.logo || user?.school?.logo || '')
              const src = rawUrl ? toAbsoluteUrl(String(rawUrl)) + (rawUrl.includes('?') ? '' : `?v=${(school?.id||'')}-${(student?.id||'')}`) : ''
              return (src && !logoFailed) ? (
              <img
                src={src}
                alt="School Logo"
                className="w-11 h-11 rounded-2xl object-contain bg-white border border-slate-200"
                loading="eager"
                onError={(e)=>{ try{ e.currentTarget.src=''; }catch(_){} setLogoFailed(true) }}
                referrerPolicy="no-referrer"
              />
              ) : (
              <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-lg" aria-label="School Logo Placeholder">🏫</div>
              )
            })()}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 leading-tight truncate">{school?.name || user?.school?.name || 'School'}</div>
              {(school?.motto || user?.school?.motto) ? (
                <div className="text-xs text-slate-500 leading-tight truncate">{school?.motto || user?.school?.motto}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Report</div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 truncate">
                Report Card {parsedTermYear? `— Term ${parsedTermYear.term}, ${parsedTermYear.year}`:''}
              </h1>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {termYearOptions.length>0 && (
                <select
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm shadow-sm"
                  value={selectedTermYear || ''}
                  onChange={(e)=> setSelectedTermYear(e.target.value || null)}
                  title="Select term"
                >
                  {termYearOptions.map(key=> (
                    <option key={key} value={key}>{key.replace('-', ' ')}</option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Link to="/student/academics" className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-center text-sm">Back</Link>
                <button
                  className="px-3 py-2 rounded-xl text-white bg-slate-400 cursor-not-allowed text-sm"
                  title="PDF export supports single exam only. Use Print to save a term report as PDF."
                  disabled
                >
                  PDF
                </button>
                <button className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm" onClick={()=>{ try { window.print() } catch(_) {} }}>Print</button>
              </div>
            </div>
          </div>
        </div>
        {termExams.length>0 && (
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {termExams.map(ex => {
              const rk = ranks[ex.id]
              return (
                <div key={ex.id} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded border border-indigo-100">
                  <span className="font-medium truncate">{ex.name} — Class Pos</span>
                  <span className="ml-auto">{rk?.class?.position || '-'} / {rk?.class?.size || '-'}</span>
                </div>
              )
            })}
            {termExams.map(ex => {
              const rk = ranks[ex.id]
              return (
                <div key={`${ex.id}-g`} className="flex items-center gap-2 bg-sky-50 text-sky-700 px-3 py-2 rounded border border-sky-100">
                  <span className="font-medium truncate">{ex.name} — Grade Pos</span>
                  <span className="ml-auto">{rk?.grade?.position || '-'} / {rk?.grade?.size || '-'}</span>
                </div>
              )
            })}
          </div>
        )}

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-2xl border border-red-100">{error}</div>}
        {loading && <div className="bg-white p-4 rounded-2xl shadow border border-slate-200">Loading...</div>}

        {!loading && !error && (
          <div className="bg-white rounded-3xl print-container shadow border border-slate-200 overflow-hidden">
            {/* Print header */}
            <div className="print-header hidden print:block">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  {(() => {
                    const rawUrl = (school?.logo_url || user?.school?.logo_url || school?.logo || user?.school?.logo || '')
                    const src = rawUrl ? toAbsoluteUrl(String(rawUrl)) : ''
                    return src && !logoFailed ? (
                      <img src={src} alt="School Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                    ) : <span style={{fontSize:18}}>🏫</span>
                  })()}
                  <div>
                    <div className="text-sm font-semibold">{school?.name || user?.school?.name || 'School'}</div>
                    {(school?.motto || user?.school?.motto) && (
                      <div className="text-xs text-gray-500">{school?.motto || user?.school?.motto}</div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
              </div>
              <div className="text-center text-sm font-medium mt-1">Report Card {parsedTermYear? `— Term ${parsedTermYear.term}, ${parsedTermYear.year}`:''}</div>
            </div>

            <div className="print-body">
            {/* Meta strip */
            }
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Student</div>
                  <div className="mt-0.5 font-medium">{student?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Admission No</div>
                  <div className="mt-0.5 font-medium">{student?.admission_no || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Class</div>
                  <div className="mt-0.5 font-medium">{student?.klass_detail?.name || student?.klass || '-'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-3">
                <div>
                  <div className="text-gray-500">Grade</div>
                  <div className="mt-0.5 font-medium">{student?.klass_detail?.grade_level || student?.klass_detail?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Term</div>
                  <div className="mt-0.5 font-medium">{parsedTermYear ? `Term ${parsedTermYear.term}` : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Year</div>
                  <div className="mt-0.5 font-medium">{parsedTermYear?.year || '-'}</div>
                </div>
              </div>
            </div>

            <div className="p-5">
              {subjects.length === 0 || termExams.length === 0 ? (
                <div className="text-sm text-gray-600">No results available yet.</div>
              ) : (
                <div className="space-y-4">
                  {/* Teacher + Remarks block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border rounded p-3 bg-white">
                      <div className="text-xs text-gray-500">Class Teacher</div>
                      <div className="font-medium">{teacherName || '-'}</div>
                    </div>
                    <div className="border rounded p-3 bg-white">
                      <div className="text-xs text-gray-500">Remarks</div>
                      <div className="font-medium">
                        {(() => {
                          const avg = Number(totals.average || 0)
                          if (avg >= 80) return 'Excellent performance — keep it up.'
                          if (avg >= 70) return 'Very good work.'
                          if (avg >= 60) return 'Good, aim higher.'
                          if (avg >= 50) return 'Fair — effort needed.'
                          return 'Needs improvement — consult your teacher.'
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-500">Subjects</div>
                  <div className="overflow-auto rounded border border-gray-100">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="bg-gray-50 text-gray-700">
                          <th className="text-left px-3 py-2 font-medium align-bottom" rowSpan={2}>Subject</th>
                          {termExams.map(ex => (
                            <th key={ex.id} className="text-center px-3 py-2 font-medium" colSpan={2}>{ex.name}</th>
                          ))}
                        </tr>
                        <tr className="bg-gray-50 text-gray-500">
                          {termExams.map(ex => (
                            <>
                              <th key={`${ex.id}-m`} className="text-right px-3 py-1 font-medium">Percentage</th>
                              <th key={`${ex.id}-g`} className="text-center px-3 py-1 font-medium">Grade</th>
                            </>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {subjects.map((subj)=> (
                          <tr key={String(subj.id)} className="hover:bg-gray-50/60">
                            <td className="px-3 py-2">{subj.label}</td>
                            {termExams.map(ex => {
                              const v = marksByExamAndSubject[String(ex.id)]?.[String(subj.id)]
                              const pct = percentagesByExamAndSubject[String(ex.id)]?.[String(subj.id)]
                              return (
                                <>
                                  <td key={`${ex.id}-${subj.id}-m`} className="px-3 py-2 text-right">{Number.isFinite(pct) ? `${pct}%` : '-'}</td>
                                  <td key={`${ex.id}-${subj.id}-g`} className="px-3 py-2 text-center">{Number.isFinite(pct) ? toGrade(pct, subj.id) : '-'}</td>
                                </>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr className="border-t">
                          <td className="px-3 py-2 font-medium">Total</td>
                          {termExams.map(ex => {
                            let sum = 0
                            let cnt = 0
                            const m = percentagesByExamAndSubject[String(ex.id)] || {}
                            for (const subj of subjects){
                              const v = m[String(subj.id)]
                              if (Number.isFinite(v)) { sum += v; cnt += 1 }
                            }
                            const avg = cnt ? (sum / cnt) : 0
                            return (
                              <>
                                <td key={`${ex.id}-t`} className="px-3 py-2 text-right font-medium">{`${sum.toFixed(2)}%`}</td>
                                <td key={`${ex.id}-a`} className="px-3 py-2 text-center font-medium">{`${avg.toFixed(2)}%`}</td>
                              </>
                            )
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Grading scale */}
                  <div className="text-xs text-gray-600">{'Grading Scale: A ≥ 80, B 70–79, C 60–69, D 50–59, E < 50'}</div>
                </div>
              )}
            </div>
            </div>

            {/* Print footer */}
            <div className="print-footer hidden print:flex items-center justify-between px-1">
              <div>{window.location.host}</div>
              <div>Genay Technologies — Modern School Management</div>
            </div>
          </div>
        )}

        {/* All Exams History (student-facing) */}
        {!loading && !error && (
          <div className="bg-white rounded-3xl shadow border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">All Exams History</h2>
              <div className="text-xs text-gray-500">Published exams only</div>
            </div>
            {examHistory.length === 0 ? (
              <div className="text-sm text-gray-600">No exam history yet.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {examHistory.map(ex => (
                  <li key={ex.id} className="py-2 flex items-center gap-3">
                    <div className={`text-[10px] px-2 py-0.5 rounded-full border ${ex.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{ex.published ? 'Published' : 'Draft'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{ex.name || `Exam ${ex.id}`}</div>
                      <div className="text-xs text-gray-500">Year {ex.year || '-'} • Term {ex.term || '-'}{ex.grade ? ` • ${ex.grade}` : ''}</div>
                    </div>
                    {ex.grade && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700" title="Grade at time of exam">{ex.grade}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
