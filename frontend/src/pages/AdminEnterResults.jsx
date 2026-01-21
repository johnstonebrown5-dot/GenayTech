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
  const [results, setResults] = useState([]) // rows: {student, subject, marks}
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
        const subj = Array.isArray(klassRes.data?.subjects) ? klassRes.data.subjects : []
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
        // existing results (aggregate to percentage per subject so admin sees percent out of 100)
        let existing = []
        try{
          const { data } = await api.get(`/academics/exam_results/?exam=${examId}`)
          existing = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
        }catch{}
        // Build map of components per subject id
        const compsBySubject = componentsLoadedMap && Object.keys(componentsLoadedMap).length ? componentsLoadedMap : (componentsMap || {})
        // Aggregate per student-subject: sum marks and sum denominators
        const agg = new Map()
        existing.forEach(r=>{
          const sid = r?.student ?? r?.student_id ?? r?.student_detail?.id
          const subid = r?.subject ?? r?.subject_id ?? r?.subject_detail?.id
          if (!sid || !subid) return
          const key = `${sid}-${subid}`
          const marks = Number(r?.marks ?? r?.score ?? r?.value)
          if (Number.isNaN(marks)) return
          // Determine denominator: prefer explicit out_of, then component.max_marks, else exam total
          let denom = Number(r?.out_of)
          if (Number.isNaN(denom) || !denom){
            const compId = r?.component ?? r?.component_id ?? r?.component_detail?.id
            const comps = compsBySubject[subid] || []
            const compObj = Array.isArray(comps) ? comps.find(c=> String(c.id)===String(compId)) : null
            if (compObj && compObj.max_marks != null) denom = Number(compObj.max_marks)
          }
          if (Number.isNaN(denom) || !denom){ denom = Number(e.data?.total_marks) || 100 }
          const curr = agg.get(key) || { sum:0, out:0 }
          agg.set(key, { sum: curr.sum + marks, out: curr.out + denom })
        })
        const rows = []
        for (const s of studentsList){
          for (const sub of subj){
            const key = `${s.id}-${sub.id}`
            const a = agg.get(key)
            const pct = a && a.out>0 ? Math.round((a.sum / a.out) * 100) : ''
            rows.push({ student: s.id, subject: sub.id, marks: pct })
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
        .map(r => ({ ...r, marks: parseFloat(r.marks) }))
        .filter(r => !isNaN(r.marks))
        .map(r => {
          const comps = componentsMap[r.subject] || []
          const item = { ...r, exam: examId }
          if (Array.isArray(comps) && comps.length === 1){
            item.component = comps[0]?.id
          }
          return item
        })
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

  // Helper: whether a student's row has any missing marks (blank or zero) among visible subjects
  const isRowMissingMarks = (studentId) => {
    for (const s of visibleSubjects){
      const idx = results.findIndex(r => r.student===studentId && r.subject===s.id)
      const val = idx>-1 ? results[idx].marks : ''
      if (val === '' || val === null || typeof val === 'undefined') return true
      const num = Number(val)
      if (!Number.isNaN(num) && num === 0) return true
    }
    return false
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
                  <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50">Student</th>
                  {visibleSubjects.map(s => (
                    <th key={s.id} className="border px-2 py-1 text-center whitespace-nowrap">{s.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((stu, idx) => (
                  <tr key={stu.id} className={`${isRowMissingMarks(stu.id) ? 'bg-amber-50/60' : ''} ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="border px-2 py-1 sticky left-0 bg-white">{stu.name}</td>
                    {visibleSubjects.map(s => {
                      const idx = results.findIndex(r => r.student===stu.id && r.subject===s.id)
                      const val = idx>-1 ? results[idx].marks : ''
                      const isMissingCell = (val === '' || val === null || typeof val === 'undefined' || Number(val) === 0)
                      const total = Number(exam?.total_marks) || 100
                      const num = Number(val)
                      const overTotal = val!=='' && !Number.isNaN(num) && (num < 0 || num > total)
                      const cellKey = `${stu.id}-${s.id}`
                      const isInvalid = overTotal || !!invalid[cellKey]
                      return (
                        <td key={s.id} className={`border px-1.5 py-1 text-center ${isMissingCell ? 'bg-rose-50' : ''} ${isInvalid ? 'outline outline-1 outline-red-400' : ''}`}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={total}
                            step="0.01"
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
                      )
                    })}
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
