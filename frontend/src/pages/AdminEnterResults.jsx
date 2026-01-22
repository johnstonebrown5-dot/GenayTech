import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

export default function AdminEnterResults(){
  const { id } = useParams()
  const navigate = useNavigate()
  const examId = Number(id)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('idle')
  const [exam, setExam] = useState(null)
  const [klass, setKlass] = useState(null)
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState('') // '' means All subjects
  const [results, setResults] = useState([]) // rows: {student, subject, component|null, marks}
  const [invalid, setInvalid] = useState({}) // { 'studentId-subjectId': true }
  const [componentsMap, setComponentsMap] = useState({}) // { subjectId: [components] }
  const { showError } = useNotification?.() || { showError: ()=>{} }

  useEffect(()=>{
    let alive = true
    ;(async ()=>{
      try{
        setLoading(true)
        setError('')
        // exam
        const e = await api.get(`/academics/exams/${examId}/`)
        if (!alive) return
        setExam(e.data)
        // class details (need subjects) + students
        const klassRes = await api.get(`/academics/classes/${e.data.klass}/`)
        if (!alive) return
        setKlass(klassRes.data)
        const subjRaw = Array.isArray(klassRes.data?.subjects) ? klassRes.data.subjects : []
        // Filter out non-examinable subjects from entry grid and dropdown
        const subj = subjRaw.filter(s => s?.is_examinable !== false)
        setSubjects(subj)
        // Load components for each subject (to auto-include when only one exists)
        let componentsLoadedMap = {}
        try {
          const entries = await Promise.all(subj.map(async (s)=>{
            try{
              const r = await api.get(`/academics/subject_components/?subject=${s.id}`)
              const arr = Array.isArray(r.data) ? r.data : (Array.isArray(r?.data?.results) ? r.data.results : [])
              return [s.id, arr]
            } catch {
              return [s.id, []]
            }
          }))
          if (!alive) return
          const map = {}
          for (const [sid, arr] of entries){ map[sid] = arr }
          componentsLoadedMap = map
          setComponentsMap(map)
        } catch {
          setComponentsMap({})
        }
        const stuRes = await api.get(`/academics/students/?klass=${e.data.klass}`)
        if (!alive) return
        const studentsList = Array.isArray(stuRes.data) ? stuRes.data : (Array.isArray(stuRes.data?.results) ? stuRes.data.results : [])
        setStudents(studentsList)
        // existing results (raw per-component marks)
        let existing = []
        try{
          const { data } = await api.get(`/academics/exam_results/?exam=${examId}`)
          existing = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
        }catch{}
        // Build per-component rows (carry forward teacher-saved out_of for validation/placeholders)
        const rows = []
        const compsBySubject = componentsLoadedMap && Object.keys(componentsLoadedMap).length ? componentsLoadedMap : (componentsMap || {})
        const indexKey = (r)=>`${r?.student ?? r?.student_id}-${r?.subject ?? r?.subject_id}-${r?.component ?? r?.component_id ?? ''}`
        const existingMap = new Map()
        for (const r of existing){ existingMap.set(indexKey(r), r) }

        // Preferred out_of per subject/component based on any existing result (teacher-saved)
        const preferredOut = new Map() // key: `${subjectId}-${componentId||''}` => number
        for (const r of existing){
          const sid = r?.subject ?? r?.subject_id
          const cid = r?.component ?? r?.component_id ?? ''
          const oo = Number(r?.out_of)
          const key = `${sid}-${cid}`
          if (sid && Number.isFinite(oo) && oo > 0 && !preferredOut.has(key)){
            preferredOut.set(key, oo)
          }
        }

        for (const s of studentsList){
          for (const sub of subj){
            const comps = compsBySubject[sub.id] || []
            if (Array.isArray(comps) && comps.length>0){
              for (const c of comps){
                const key = `${s.id}-${sub.id}-${c.id}`
                const found = existingMap.get(key)
                const mk = Number(found?.marks)
                const outOf = (found && Number(found?.out_of))
                let marksVal = Number.isFinite(mk) ? mk : NaN
                // Normalize percent-looking values saved earlier.
                // Prefer explicit outOf, otherwise fall back to component max_marks when available.
                {
                  const denom = Number.isFinite(outOf) && outOf > 0
                    ? outOf
                    : Number(c?.max_marks)
                
                  if (Number.isFinite(marksVal) && Number.isFinite(denom) && denom > 0 && marksVal <= 100 && marksVal > denom){
                    marksVal = Math.round((marksVal / 100) * denom)
                  }
                }
                const pref = preferredOut.get(`${sub.id}-${c.id}`)
                rows.push({ student: s.id, subject: sub.id, component: c.id, marks: Number.isFinite(marksVal) ? marksVal : '', outOf: Number.isFinite(outOf) ? outOf : (Number.isFinite(pref) ? pref : undefined) })
              }
            } else {
              const key = `${s.id}-${sub.id}-`
              const found = existingMap.get(key)
              const mk = Number(found?.marks)
              const outOf = (found && Number(found?.out_of))
              let marksVal = Number.isFinite(mk) ? mk : NaN
              // Normalize using explicit outOf or fallback to exam total when only a single component exists
              {
                const denom = Number.isFinite(outOf) && outOf > 0
                  ? outOf
                  : Number(exam?.total_marks ?? 100)
                if (Number.isFinite(marksVal) && Number.isFinite(denom) && denom > 0 && marksVal <= 100 && marksVal > denom){
                  marksVal = Math.round((marksVal / 100) * denom)
                }
              }
              const pref = preferredOut.get(`${sub.id}-`)
              rows.push({ student: s.id, subject: sub.id, component: null, marks: Number.isFinite(marksVal) ? marksVal : '', outOf: Number.isFinite(outOf) ? outOf : (Number.isFinite(pref) ? pref : undefined) })
            }
          }
        }
        if (!alive) return
        setResults(rows)
      }catch(err){
        setError(err?.response?.data?.detail || err?.message || 'Failed to load exam')
      }finally{
        if (alive) setLoading(false)
      }
    })()
    return ()=>{ alive = false }
  }, [examId])

  const save = async (e) => {
    e?.preventDefault?.()
    setSaving(true)
    setStatus('saving')
    setError('')
    try{
      // block save if any invalid cells
      const hasInvalid = Object.values(invalid).some(Boolean)
      if (hasInvalid){
        throw new Error('Some entries are invalid. Fix highlighted cells (0..total).')
      }
      const visibleSubjectIds = selectedSubject ? [Number(selectedSubject)] : subjects.map(s=>s.id)
      const payload = results
        .filter(r => visibleSubjectIds.includes(r.subject))
        .map(r => ({ ...r, marks: Math.round(parseFloat(r.marks)) }))
        .filter(r => !isNaN(r.marks))
        .map(r => ({ exam: examId, student: r.student, subject: r.subject, component: r.component, marks: r.marks, out_of: r.outOf }))
      if (!payload.length) throw new Error('Enter at least one mark to save')
      const res = await api.post('/academics/exam_results/bulk/', { results: payload })
      const failed = Number(res?.data?.failed || 0)
      if (failed){
        setStatus('idle')
        setError(`Partial save. ${failed} failed. ${res?.data?.errors ? JSON.stringify(res.data.errors.slice(0,3)) : ''}`)
      } else {
        setStatus('saved')
        setTimeout(()=>setStatus('idle'), 1500)
      }
    }catch(err){
      setError(err?.response?.data?.detail || err?.message || 'Failed to save results')
      setStatus('idle')
    }finally{
      setSaving(false)
    }
  }

  const title = useMemo(()=>{
    if (!exam || !klass) return 'Enter Results'
    return `${exam.name} — Year ${exam.year} — Term ${exam.term} — ${klass.name}`
  }, [exam, klass])

  // Subjects currently visible based on filter
  const visibleSubjects = useMemo(()=>{
    return selectedSubject ? subjects.filter(s=> String(s.id)===String(selectedSubject)) : subjects
  }, [subjects, selectedSubject])

  // Helper: whether a student's row has any missing marks among visible subjects (per component)
  const isRowMissingMarks = (studentId) => {
    for (const s of visibleSubjects){
      const comps = componentsMap[s.id] || []
      if (Array.isArray(comps) && comps.length>0){
        for (const c of comps){
          const i = results.findIndex(r => r.student===studentId && r.subject===s.id && r.component===c.id)
          const val = i>-1 ? results[i].marks : ''
          if (val === '' || val === null || typeof val === 'undefined') return true
        }
      } else {
        const i = results.findIndex(r => r.student===studentId && r.subject===s.id)
        const val = i>-1 ? results[i].marks : ''
        if (val === '' || val === null || typeof val === 'undefined') return true
      }
    }
    return false
  }

  const subjectTotal = (studentId, subjectId) => {
    const comps = componentsMap[subjectId] || []
    if (Array.isArray(comps) && comps.length>0){
      const sum = comps.reduce((sum, c) => {
        const i = results.findIndex(r => r.student===studentId && r.subject===subjectId && r.component===c.id)
        const v = i>-1 ? Number(results[i].marks) : NaN
        return sum + (Number.isFinite(v) ? v : 0)
      }, 0)
      return Math.round(sum)
    }
    const i = results.findIndex(r => r.student===studentId && r.subject===subjectId)
    const v = i>-1 ? Number(results[i].marks) : NaN
    return Math.round(Number.isFinite(v) ? v : 0)
  }

  const subjectPercent = (studentId, subjectId) => {
    const comps = componentsMap[subjectId] || []
    if (Array.isArray(comps) && comps.length>0){
      let sumMarks = 0
      let sumOut = 0
      for (const c of comps){
        const i = results.findIndex(r => r.student===studentId && r.subject===subjectId && r.component===c.id)
        const m = i>-1 ? Number(results[i].marks) : NaN
        const o = i>-1 ? Number(results[i]?.outOf) : NaN
        if (Number.isFinite(m)) sumMarks += m
        if (Number.isFinite(o) && o > 0) sumOut += o
      }
      if (sumOut > 0) return Math.round((sumMarks / sumOut) * 100)
      return 0
    }
    const i = results.findIndex(r => r.student===studentId && r.subject===subjectId)
    const m = i>-1 ? Number(results[i].marks) : NaN
    const o = i>-1 ? Number(results[i]?.outOf) : NaN
    const denom = (Number.isFinite(o) && o > 0) ? o : Number(exam?.total_marks ?? 100)
    if (!Number.isFinite(m) || !denom) return 0
    return Math.round((m / denom) * 100)
  }

  // Grand total across all subjects for a student
  const grandTotal = (studentId) => {
    try {
      return subjects.reduce((sum, s) => {
        const comps = componentsMap[s.id] || []
        // Use percentage for both component and single-part subjects
        if (Array.isArray(comps) && comps.length>0){
          return sum + subjectPercent(studentId, s.id)
        }
        return sum + subjectPercent(studentId, s.id)
      }, 0)
    } catch {
      return 0
    }
  }

  const setOutOfFor = (subjectId, componentId, nextOut) => {
    const outNum = nextOut === '' || nextOut === null || typeof nextOut === 'undefined' ? undefined : Number(nextOut)
    setResults(prev => prev.map(r => {
      if (r.subject !== subjectId) return r
      if ((componentId ?? null) !== (r.component ?? null)) return r
      return { ...r, outOf: Number.isFinite(outNum) && outNum > 0 ? outNum : undefined }
    }))
    setInvalid(prev => {
      const copy = { ...prev }
      for (const stu of students){
        const key = componentId ? `${stu.id}-${subjectId}-${componentId}` : `${stu.id}-${subjectId}`
        const row = results.find(r => r.student===stu.id && r.subject===subjectId && ((componentId ?? null) === (r.component ?? null)))
        const val = row ? row.marks : ''
        const total = Number.isFinite(outNum) && outNum > 0 ? outNum : (componentId ? Number((componentsMap[subjectId]||[]).find(c=>c.id===componentId)?.max_marks ?? exam?.total_marks ?? 100) : Number(exam?.total_marks ?? 100))
        const num = Number(val)
        const bad = val!=='' && !Number.isNaN(num) && (num < 0 || num > total)
        copy[key] = bad
      }
      return copy
    })
  }

  return (
    <React.Fragment>
      <div className="space-y-4">
        {/* Header + Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
        </div>
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 rounded-lg border border-gray-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
            <label className="text-xs text-gray-600">Subject</label>
            <div className="relative flex-1 sm:flex-none">
              <select
                className="border pl-2 pr-8 py-2 rounded-lg text-base sm:text-sm appearance-none w-full sm:w-auto sm:min-w-[240px]"
                value={selectedSubject}
                onChange={e=>setSelectedSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map(s=> (<option key={s.id} value={s.id}>{s.code} — {s.name}</option>))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6"/></svg>
            </div>
            <span className="hidden sm:inline text-xs text-gray-500">Total {Number(exam?.total_marks||100)}</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button className="px-3 py-1.5 rounded-lg border text-sm" onClick={()=>navigate(-1)}>Back</button>
            <button disabled={saving} onClick={save} className={`px-3.5 py-1.5 rounded-lg text-sm text-white ${status==='saved' ? 'bg-green-600' : 'bg-blue-600'} disabled:opacity-60`}>
              {saving? 'Saving...' : status==='saved' ? 'Saved' : 'Save Results'}
            </button>
          </div>
        </div>
        {loading && <div>Loading...</div>}
        {!loading && (
          <div className="bg-white rounded-xl shadow-card border border-gray-200 p-3 overflow-auto max-h-[70vh] md:max-h-[75vh]">
            <div className="text-xs text-gray-500 mb-2">Legend: <span className="px-1 rounded bg-rose-50 border border-rose-200">Missing/0</span> • <span className="px-1 rounded border border-red-300">Out of range</span></div>
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50" rowSpan={2}>Student</th>
                  {visibleSubjects.map(s => {
                    const comps = componentsMap[s.id] || []
                    const count = (Array.isArray(comps) && comps.length>0) ? comps.length + 1 : 2
                    return (
                      <th key={`grp-${s.id}`} className="border px-2 py-1 text-center" colSpan={count}>{s.code}</th>
                    )
                  })}
                  <th className="border px-2 py-1 text-center" rowSpan={2}>All Subjects</th>
                </tr>
                <tr>
                  {visibleSubjects.map(s => {
                    const comps = componentsMap[s.id] || []
                    if (Array.isArray(comps) && comps.length>0){
                      return (
                        <React.Fragment key={`sub-${s.id}`}>
                          {comps.map(c => {
                            // derive a representative outOf for this component from any existing row
                            let repOut = undefined
                            try{
                              const row = results.find(r => r.subject===s.id && r.component===c.id && Number(r.outOf))
                              if (row && Number(row.outOf)) repOut = Number(row.outOf)
                            }catch{}
                            const label = c.code || c.name || 'Paper'
                            return (
                              <th key={`c-${s.id}-${c.id}`} className="border px-2 py-1 text-center whitespace-nowrap">
                                {label}{repOut? ` (out of ${repOut})` : ''}
                              </th>
                            )
                          })}
                          <th key={`tot-${s.id}`} className="border px-2 py-1 text-center">Total</th>
                        </React.Fragment>
                      )
                    }
                    return (
                      <React.Fragment key={`single-${s.id}`}>
                        <th className="border px-2 py-1 text-center">Marks</th>
                        <th className="border px-2 py-1 text-center">Percent</th>
                      </React.Fragment>
                    )
                  })}
                </tr>
                <tr>
                  <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50">Out Of</th>
                  {visibleSubjects.map(s => {
                    const comps = componentsMap[s.id] || []
                    if (Array.isArray(comps) && comps.length>0){
                      return (
                        <React.Fragment key={`out-${s.id}`}>
                          {comps.map(c => {
                            let repOut = ''
                            try{
                              const row = results.find(r => r.subject===s.id && r.component===c.id && Number(r.outOf))
                              if (row && Number(row.outOf)) repOut = String(Number(row.outOf))
                            }catch{}
                            const placeholder = String(Number(c?.max_marks ?? exam?.total_marks ?? 100))
                            return (
                              <th key={`out-${s.id}-${c.id}`} className="border px-2 py-1 text-center">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={1}
                                  step="1"
                                  placeholder={placeholder}
                                  className="border px-2 py-1 rounded w-16 text-center border-gray-300 bg-white"
                                  value={repOut}
                                  onChange={e=>setOutOfFor(s.id, c.id, e.target.value)}
                                />
                              </th>
                            )
                          })}
                          <th key={`out-tot-${s.id}`} className="border px-2 py-1 text-center text-gray-400">—</th>
                        </React.Fragment>
                      )
                    }
                    let repOut = ''
                    try{
                      const row = results.find(r => r.subject===s.id && (r.component==null) && Number(r.outOf))
                      if (row && Number(row.outOf)) repOut = String(Number(row.outOf))
                    }catch{}
                    const placeholder = String(Number(exam?.total_marks ?? 100))
                    return (
                      <React.Fragment key={`out-single-${s.id}`}>
                        <th className="border px-2 py-1 text-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={1}
                            step="1"
                            placeholder={placeholder}
                            className="border px-2 py-1 rounded w-16 text-center border-gray-300 bg-white"
                            value={repOut}
                            onChange={e=>setOutOfFor(s.id, null, e.target.value)}
                          />
                        </th>
                        <th className="border px-2 py-1 text-center text-gray-400">—</th>
                      </React.Fragment>
                    )
                  })}
                  <th className="border px-2 py-1 text-center text-gray-400">—</th>
                </tr>
              </thead>
              <tbody>
                {students.map((stu, idx) => (
                  <tr key={stu.id} className={`${isRowMissingMarks(stu.id) ? 'bg-amber-50/60' : ''} ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="border px-2 py-1 sticky left-0 bg-white">{stu.name}</td>
                    {visibleSubjects.map(s => {
                      const comps = componentsMap[s.id] || []
                      if (Array.isArray(comps) && comps.length>0){
                        return (
                          <React.Fragment key={`row-${stu.id}-${s.id}`}>
                            {comps.map(c => {
                              const cellKey = `${stu.id}-${s.id}-${c.id}`
                              const idx = results.findIndex(r => r.student===stu.id && r.subject===s.id && r.component===c.id)
                              const val = idx>-1 ? results[idx].marks : ''
                              const rowOut = idx>-1 ? Number(results[idx]?.outOf) : NaN
                              const total = Number.isFinite(rowOut) && rowOut > 0 ? rowOut : Number(c?.max_marks ?? exam?.total_marks ?? 100)
                              const isMissingCell = (val === '' || val === null || typeof val === 'undefined' || Number(val) === 0)
                              const num = Number(val)
                              const overTotal = val!=='' && !Number.isNaN(num) && (num < 0 || num > total)
                              const isInvalid = overTotal || !!invalid[cellKey]
                              return (
                                <td key={`c-${s.id}-${c.id}`} className={`border px-1.5 py-1 text-center ${isMissingCell ? 'bg-rose-50' : ''} ${isInvalid ? 'outline outline-1 outline-red-400' : ''}`}>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    max={total}
                                    step="1"
                                    placeholder={`${total}`}
                                    className={`border px-2 py-1 rounded w-16 text-center ${isInvalid ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    value={val}
                                    onChange={e=>{
                                      const v = e.target.value
                                      // validate
                                      let bad = false
                                      if (v !== '' && v !== null && typeof v !== 'undefined'){
                                        const n = Number(v)
                                        if (Number.isNaN(n) || n < 0 || n > total){
                                          bad = true
                                          if (!invalid[cellKey]){
                                            showError('Invalid marks', `Value must be between 0 and ${total}.`, 3000)
                                          }
                                        }
                                      }
                                      setInvalid(prev => ({ ...prev, [cellKey]: bad }))
                                      setResults(prev => {
                                        const copy = [...prev]
                                        const i = copy.findIndex(r => r.student===stu.id && r.subject===s.id && r.component===c.id)
                                        if (i>-1) copy[i] = { ...copy[i], marks: v }
                                        return copy
                                      })
                                    }}
                                  />
                                </td>
                              )
                            })}
                            <td key={`tot-${stu.id}-${s.id}`} className="border px-1.5 py-1 text-center font-medium">{subjectPercent(stu.id, s.id)}%</td>
                          </React.Fragment>
                        )
                      }

                      const idx = results.findIndex(r => r.student===stu.id && r.subject===s.id)
                      const val = idx>-1 ? results[idx].marks : ''
                      const isMissingCell = (val === '' || val === null || typeof val === 'undefined' || Number(val) === 0)
                      const total = Number(exam?.total_marks) || 100
                      const num = Number(val)
                      const overTotal = val!=='' && !Number.isNaN(num) && (num < 0 || num > total)
                      const cellKey = `${stu.id}-${s.id}`
                      const isInvalid = overTotal || !!invalid[cellKey]
                      return (
                        <React.Fragment key={`single-row-${stu.id}-${s.id}`}>
                          <td className={`border px-1.5 py-1 text-center ${isMissingCell ? 'bg-rose-50' : ''} ${isInvalid ? 'outline outline-1 outline-red-400' : ''}`}>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={total}
                              step="1"
                              placeholder={`${total}`}
                              className={`border px-2 py-1 rounded w-16 text-center ${isInvalid ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                              value={val}
                              onChange={e=>{
                                const v = e.target.value
                                // validate
                                let bad = false
                                if (v !== '' && v !== null && typeof v !== 'undefined'){
                                  const n = Number(v)
                                  if (Number.isNaN(n) || n < 0 || n > total){
                                    bad = true
                                    if (!invalid[cellKey]){
                                      showError('Invalid marks', `Value must be between 0 and ${total}.`, 3000)
                                    }
                                  }
                                }
                                setInvalid(prev => ({ ...prev, [cellKey]: bad }))
                                setResults(prev => {
                                  const copy = [...prev]
                                  const i = copy.findIndex(r => r.student===stu.id && r.subject===s.id)
                                  if (i>-1) copy[i] = { ...copy[i], marks: v }
                                  return copy
                                })
                              }}
                            />
                          </td>
                          <td className="border px-1.5 py-1 text-center font-medium">{subjectPercent(stu.id, s.id)}%</td>
                        </React.Fragment>
                      )
                    })}
                    <td className="border px-1.5 py-1 text-center font-semibold">{grandTotal(stu.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </React.Fragment>
  )
}
