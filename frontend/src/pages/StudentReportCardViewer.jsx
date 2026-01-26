import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'
import { useAuth } from '../auth'

export default function StudentReportCardViewer({ embedded=false, hideControls=false, hideHistory=false, showTermSelector=true, showExamSelector=true, showBackPrint=true, selectedTermYear: controlledTermYear=null, onSelectedTermYearChange, selectedExamId: controlledExamId=null, onSelectedExamIdChange }){
  const { id } = useParams()
  const studentId = Number(id)
  const { user } = useAuth()
  const { search } = useLocation()
  const queryExamId = useMemo(()=>{
    try{ const p = new URLSearchParams(search); return p.get('exam') }catch{ return null }
  }, [search])

  const toId = (v) => {
    if (v == null) return null
    if (typeof v === 'object') {
      return v.id ?? v.pk ?? v.value ?? null
    }
    return v
  }
  const [student, setStudent] = useState(null)
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
  const [school, setSchool] = useState(null)
  const [ranks, setRanks] = useState({})
  const [bandsBySubject, setBandsBySubject] = useState(new Map())
  const [globalBands, setGlobalBands] = useState(null)
  const [stageBands, setStageBands] = useState(null)
  const [selectedExamClass, setSelectedExamClass] = useState(null)
  // Summary data from Results page for the currently selected exam
  const [summarySubjects, setSummarySubjects] = useState(null)
  const [summaryStudent, setSummaryStudent] = useState(null)
  const [summaryExam, setSummaryExam] = useState(null)
  const [examMeta, setExamMeta] = useState(null)

  const inferStageFromClass = (klass) => {
    try{
      const stg = klass?.stage
      if (stg) return stg
      const gl = String(klass?.grade_level || '')
      const m = gl.match(/(\d{1,2})/)
      const num = m ? Number(m[1]) : NaN
      if (Number.isFinite(num)){
        if (num >= 1 && num <= 6) return 'primary'
        if (num >= 7 && num <= 9) return 'junior'
      }
      return null
    }catch{ return null }
  }
  const isPrivileged = useMemo(() => {
    const role = typeof user?.role === 'string' ? user.role.toLowerCase() : ''
    return role === 'admin' || role === 'teacher' || !!user?.is_staff || !!user?.is_superuser
  }, [user?.role, user?.is_staff, user?.is_superuser])

  const termYearOptions = useMemo(()=>{
    const set = new Set()
    const requirePublished = !isPrivileged
    for (const r of examResults){
      const ed = r.exam_detail || {}
      if (requirePublished && !ed?.published) continue
      // Fallbacks: use inferred term or exam date when year/term are not explicitly set
      const inferredTerm = ed.term || ed?.inferred_term?.number || null
      let inferredYear = ed.year || null
      if (!inferredYear) {
        const d = ed?.date ? new Date(ed.date) : null
        if (d && !isNaN(d)) inferredYear = d.getFullYear()
      }
      if (inferredYear && inferredTerm) {
        const key = `${inferredYear}-T${inferredTerm}`
        set.add(key)
      }
    }
    return Array.from(set)
  }, [examResults, isPrivileged])

  const [selectedTermYear, setSelectedTermYear] = useState(null)

  useEffect(()=>{
    const current = controlledTermYear || selectedTermYear
    if (!current && examResults.length){
      for (let i = examResults.length - 1; i >= 0; i--) {
        const ed = examResults[i]?.exam_detail
        const requirePublished = !isPrivileged
        const hasYear = ed?.year || (ed?.date ? !isNaN(new Date(ed.date)) : false)
        const term = ed?.term || ed?.inferred_term?.number
        if ((!requirePublished || ed?.published) && hasYear && term){
          const year = ed?.year || new Date(ed.date).getFullYear()
          const key = `${year}-T${term}`
          if (onSelectedTermYearChange){ onSelectedTermYearChange(key) } else { setSelectedTermYear(key) }
          break
        }
      }
    }
  }, [examResults, controlledTermYear, selectedTermYear, onSelectedTermYearChange, isPrivileged])

  const effectiveTermYear = controlledTermYear || selectedTermYear

  const parsedTermYear = useMemo(()=>{
    if (!effectiveTermYear) return null
    const [y, t] = String(effectiveTermYear).split('-T')
    const year = Number(y)
    const term = Number(t)
    if (!Number.isFinite(year) || !Number.isFinite(term)) return null
    return { year, term }
  }, [effectiveTermYear])

  const termExams = useMemo(()=>{
    const seen = new Set()
    const list = []
    const requirePublished = !isPrivileged
    for (const r of examResults){
      const ed = r.exam_detail || {}
      const id = toId(ed.id) || toId(r.exam) || toId(r.exam_id)
      if (!id || seen.has(String(id))) continue
      if (requirePublished && !ed?.published) continue
      const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
      const term = ed.term || ed?.inferred_term?.number || null
      if (parsedTermYear){
        if (year !== parsedTermYear.year || term !== parsedTermYear.term) continue
      }
      seen.add(String(id))
      const baseName = ed.name || (typeof r.exam === 'object' ? (r.exam?.name || r.exam?.title || '') : '') || String(r.exam || '')
      const label = `${baseName}${year ? ` • ${year}` : ''}${term ? ` • T${term}` : ''}`
      list.push({ id, name: label, total_marks: ed.total_marks, term, year, grade: ed.grade_level_tag, klass: ed.klass })
    }
    // Sort newest first when not filtered by term
    list.sort((a,b)=>{
      const ya = Number(a.year||0), yb = Number(b.year||0)
      if (yb !== ya) return yb - ya
      const ta = Number(a.term||0), tb = Number(b.term||0)
      if (tb !== ta) return tb - ta
      return Number(b.id||0) - Number(a.id||0)
    })
    return list
  }, [examResults, parsedTermYear, isPrivileged])

  // All exams for this student (respecting published visibility for non-privileged)
  const allExams = useMemo(()=>{
    const seen = new Set()
    const list = []
    const requirePublished = !isPrivileged
    for (const r of examResults){
      const ed = r.exam_detail || {}
      const id = toId(ed.id) || toId(r.exam) || toId(r.exam_id)
      if (!id || seen.has(String(id))) continue
      if (requirePublished && !ed?.published) continue
      const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
      const term = ed.term || ed?.inferred_term?.number || null
      const baseName = ed.name || (typeof r.exam === 'object' ? (r.exam?.name || r.exam?.title || '') : '') || String(r.exam || '')
      const label = `${baseName}${year ? ` • ${year}` : ''}${term ? ` • T${term}` : ''}`
      list.push({ id, name: label, total_marks: ed.total_marks, term, year, grade: ed.grade_level_tag, klass: ed.klass })
      seen.add(String(id))
    }
    list.sort((a,b)=>{
      const ya = Number(a.year||0), yb = Number(b.year||0)
      if (yb !== ya) return yb - ya
      const ta = Number(a.term||0), tb = Number(b.term||0)
      if (tb !== ta) return tb - ta
      return Number(b.id||0) - Number(a.id||0)
    })
    return list
  }, [examResults, isPrivileged])

  const [selectedExamId, setSelectedExamId] = useState(null)

  const effectiveExamId = controlledExamId || selectedExamId

  const selectedExamFromResults = useMemo(()=>{
    if (!effectiveExamId) return null
    const want = String(toId(effectiveExamId))
    for (const r of examResults){
      const ed = r.exam_detail || {}
      const id = String(toId(ed.id) || toId(r.exam) || toId(r.exam_id) || '')
      if (!id || id !== want) continue
      const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
      const term = ed.term || ed?.inferred_term?.number || null
      const name = ed.name || (typeof r.exam === 'object' ? (r.exam?.name || r.exam?.title || '') : '') || String(r.exam || '')
      return { id: toId(effectiveExamId), name, year, term, grade: ed.grade_level_tag, klass: ed.klass, total_marks: ed.total_marks }
    }
    return null
  }, [effectiveExamId, examResults])

  const selectedExam = useMemo(()=>{
    if (!effectiveExamId) return null
    return termExams.find(e => String(e.id) === String(effectiveExamId)) || selectedExamFromResults || null
  }, [termExams, effectiveExamId, selectedExamFromResults])

  // Load Results-page summary for the selected exam and capture subjects + this student's row
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        setSummarySubjects(null); setSummaryStudent(null)
        const exId = effectiveExamId || queryExamId
        if (!exId || !studentId) return
        const { data } = await api.get(`/academics/exams/${exId}/summary/`)
        if (!alive) return
        const subs = Array.isArray(data?.subjects) ? data.subjects : []
        const st = (Array.isArray(data?.students)? data.students: []).find(s=> String(s.id)===String(studentId)) || null
        setSummarySubjects(subs)
        setSummaryStudent(st)
        setSummaryExam(data?.exam || null)
        // If term-year is missing, sync it from summary exam meta
        try{
          const yr = data?.exam?.year || (data?.exam?.date ? new Date(data.exam.date).getFullYear() : null)
          const tr = data?.exam?.term || data?.exam?.inferred_term?.number || null
          if (yr && tr){
            const key = `${yr}-T${tr}`
            const current = controlledTermYear || selectedTermYear
            if (current !== key){ onSelectedTermYearChange ? onSelectedTermYearChange(key) : setSelectedTermYear(key) }
          }
        }catch{}
      }catch{
        if (alive){ setSummarySubjects(null); setSummaryStudent(null); setSummaryExam(null) }
      }
    })()
    return ()=>{ alive=false }
  }, [effectiveExamId, queryExamId, studentId])

  // Always fetch the exam detail so we have the authoritative name for the header
  useEffect(()=>{
    let active = true
    ;(async()=>{
      try{
        const exId = effectiveExamId || queryExamId
        if (!exId) { if (active) setExamMeta(null); return }
        const res = await api.get(`/academics/exams/${exId}/`)
        if (!active) return
        setExamMeta(res?.data || null)
      }catch{
        if (active) setExamMeta(null)
      }
    })()
    return ()=>{ active = false }
  }, [effectiveExamId, queryExamId])

  // If an exam id is present in the query, force it as the selected exam immediately
  useEffect(()=>{
    if (!queryExamId) return
    const want = String(queryExamId)
    if (effectiveExamId && String(effectiveExamId) === want) return
    setSelectedExamId(want)
  }, [queryExamId])

  useEffect(()=>{
    let active = true
    ;(async()=>{
      const exId = queryExamId
      if (!exId || !studentId) return
      try{
        const examRes = await api.get(`/academics/exams/${exId}/`).catch(()=>null)
        if (active && examRes?.data){
          const yr = examRes.data.year || (examRes.data.date ? new Date(examRes.data.date).getFullYear() : null)
          const tr = examRes.data.term || examRes.data?.inferred_term?.number || null
          if (yr && tr){
            const key = `${yr}-T${tr}`
            if (onSelectedTermYearChange){ onSelectedTermYearChange(key) } else { setSelectedTermYear(key) }
          }
        }
        const rowsRes = await api.get(`/academics/exam_results/?student=${studentId}&exam=${exId}`)
        const rows = Array.isArray(rowsRes?.data) ? rowsRes.data : (Array.isArray(rowsRes?.data?.results) ? rowsRes.data.results : [])
        if (!active || rows.length===0) return
        const ed = examRes?.data ? { id: examRes.data.id, name: examRes.data.name, year: examRes.data.year, term: examRes.data.term, date: examRes.data.date, published: examRes.data.published, klass: examRes.data.klass } : null
        const augmented = rows.map(r => ({ ...r, exam_detail: ed || r.exam_detail || {} }))
        setExamResults(prev => {
          const prevArr = Array.isArray(prev) ? prev : []
          return [...prevArr, ...augmented]
        })
        setSelectedExamId(String(exId))
      }catch{}
    })()
    return ()=>{ active = false }
  }, [queryExamId, studentId])

  // Load all exam results for this student to populate selectors when no specific exam is forced
  useEffect(()=>{
    let active = true
    ;(async()=>{
      try{
        if (!studentId) return
        const res = await api.get(`/academics/exam_results/?student=${studentId}`)
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
        if (!active || !rows.length) return
        setExamResults(prev => {
          const prevArr = Array.isArray(prev) ? prev : []
          // Merge unique by [exam,subject,component] to avoid duplicates if a specific-exam fetch also runs
          const seen = new Set(prevArr.map(r=>`${r.exam||r.exam_id}|${r.subject||r.subject_id}|${r.component||r.component_id||''}`))
          const merged = [...prevArr]
          for (const r of rows){
            const key = `${r.exam||r.exam_id}|${r.subject||r.subject_id}|${r.component||r.component_id||''}`
            if (!seen.has(key)) { merged.push(r); seen.add(key) }
          }
          return merged
        })
      }catch{}
    })()
    return ()=>{ active = false }
  }, [studentId])

  const headerExamName = useMemo(()=>{
    // Strict: only use real names fetched for the selected exam; do not synthesize labels
    if (examMeta?.name) return examMeta.name
    if (summaryExam?.name) return summaryExam.name
    if (selectedExamFromResults?.name) return selectedExamFromResults.name
    if (selectedExam?.name) return selectedExam.name
    return '-'
  }, [examMeta?.name, summaryExam?.name, selectedExamFromResults?.name, selectedExam?.name])

  useEffect(()=>{
    const exists = effectiveExamId ? termExams.some(e => String(e.id) === String(effectiveExamId)) : false
    if (!exists && termExams.length > 0){
      const fallback = termExams[0]?.id || null
      if (onSelectedExamIdChange){ onSelectedExamIdChange(fallback) } else { setSelectedExamId(fallback) }
    }
  }, [termExams, effectiveExamId, onSelectedExamIdChange])

  // Ensure the term-year matches the selected exam so filtering returns marks
  useEffect(()=>{
    if (!selectedExam) return
    const year = selectedExam.year || null
    const term = selectedExam.term || null
    if (!year || !term) return
    const key = `${year}-T${term}`
    const current = (controlledTermYear || selectedTermYear) || null
    if (current !== key){
      if (onSelectedTermYearChange){ onSelectedTermYearChange(key) } else { setSelectedTermYear(key) }
    }
  }, [selectedExam, controlledTermYear, selectedTermYear, onSelectedTermYearChange])

  // Load the class associated with the selected exam so we can show
  // the historical class name/grade at the time of the exam.
  useEffect(()=>{
    let active = true
    ;(async ()=>{
      try{
        setSelectedExamClass(null)
        const klassId = selectedExam?.klass
        if (!klassId) return
        const res = await api.get(`/academics/classes/${klassId}/`)
        if (!active) return
        setSelectedExamClass(res.data)
        // Load stage-wide grading bands for this class
        try{
          const stg = res?.data?.stage || inferStageFromClass(res?.data)
          if (stg){
            const sb = await api.get('/academics/stage_grading/', { params: { stage: stg, _: Date.now() } })
            const list = Array.isArray(sb.data) ? sb.data : (Array.isArray(sb.data?.results) ? sb.data.results : [])
            if (active){ setStageBands(list); setGlobalBands(list) }
          } else { if (active) setStageBands(null) }
        }catch{ if (active) setStageBands(null) }
      }catch{
        if (!active) return
        setSelectedExamClass(null)
      }
    })()
    return ()=>{ active = false }
  }, [selectedExam?.klass])

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      if (!studentId) { setError('Invalid student id'); setLoading(false); return }
      setLoading(true)
      setError('')
      try{
        try{
          const sch = await api.get('/auth/school/info/')
          if (mounted) setSchool(sch.data)
        }catch{}
        const stRes = await api.get(`/academics/students/${studentId}/`)
        if (!mounted) return
        setStudent(stRes.data)
        const exm = await api.get(`/academics/exam_results/?student=${studentId}`)
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
  }, [studentId])

  useEffect(()=>{
    let active = true
    ;(async ()=>{
      if (!studentId || termExams.length === 0) return
      const next = {}
      for (const ex of termExams){
        try{
          const { data } = await api.get(`/academics/exams/${ex.id}/rank`, { params: { student: studentId } })
          if (!active) return
          next[ex.id] = data
        }catch(_){ /* ignore */ }
      }
      if (active) setRanks(next)
    })()
    return ()=>{ active = false }
  }, [studentId, termExams])

  // Ensure rank is also fetched for the explicitly selected exam id (even if not in termExams list yet)
  useEffect(()=>{
    let abort = false
    ;(async()=>{
      try{
        const exId = effectiveExamId || queryExamId
        if (!exId || !studentId) return
        const { data } = await api.get(`/academics/exams/${exId}/rank`, { params: { student: studentId } })
        if (!abort){
          setRanks(prev => ({ ...prev, [String(exId)]: data }))
        }
      }catch{}
    })()
    return ()=>{ abort = true }
  }, [effectiveExamId, queryExamId, studentId])

  const letterFromBands = (score, bands) => {
    const n = Number(score)
    if (!Number.isFinite(n)) return '-'
    const arr = Array.isArray(bands) ? [...bands] : []
    arr.sort((a,b)=> Number(b.min ?? -Infinity) - Number(a.min ?? -Infinity))
    for (const b of arr){
      const min = Number.isFinite(Number(b.min)) ? Number(b.min) : -Infinity
      const max = Number.isFinite(Number(b.max)) ? Number(b.max) : Infinity
      if (n >= min && n <= max) return String(b.grade||'-')
    }
    if (n >= 80) return 'A'
    if (n >= 70) return 'B'
    if (n >= 60) return 'C'
    if (n >= 50) return 'D'
    return 'E'
  }

  const toGrade = (score, _subjectId) => {
    // Apply one common grading for the stage across all subjects
    return letterFromBands(score, stageBands || globalBands)
  }

  const gradeBadgeClass = (g) => {
    const x = String(g||'').toUpperCase()
    if (x === 'A') return 'bg-emerald-100 text-emerald-700'
    if (x === 'B') return 'bg-blue-100 text-blue-700'
    if (x === 'C') return 'bg-amber-100 text-amber-800'
    if (x === 'D') return 'bg-orange-100 text-orange-700'
    if (x === 'E') return 'bg-rose-100 text-rose-700'
    return 'bg-gray-100 text-gray-700'
  }

  const subjectRemark = (score, subject) => {
    const n = Number(score)
    const name = String(subject || '').toLowerCase()
    const isKiswahili = name.includes('kis') || name.includes('swahili')
    if (!Number.isFinite(n)) return isKiswahili ? 'Hakuna alama' : 'No marks'
    const g = String(toGrade(n, null) || 'E').toUpperCase()
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

  useEffect(()=>{
    let active = true
    ;(async ()=>{
      try{
        // derive subject ids from marks of selected exam if present, else all in term
        const idsSet = new Set()
        if (selectedExam){
          // We will gather from marksByExamAndSubject after it is built
        }
        // Build from examResults directly for robustness
        for (const r of examResults){
          const ed = r.exam_detail || {}
          const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
          const term = ed.term || ed?.inferred_term?.number || null
          if (!parsedTermYear || year !== parsedTermYear.year || term !== parsedTermYear.term) continue
          const sid = r.subject_detail?.id || r.subject
          if (sid) idsSet.add(String(sid))
        }
        const ids = Array.from(idsSet)
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
  }, [examResults, parsedTermYear, selectedExam, stageBands])

  // Build marks map first so it can be used by subject derivation below
  const marksByExamAndSubject = useMemo(()=>{
    const out = {}
    const requirePublished = !isPrivileged
    for (const r of examResults){
      const ed = r.exam_detail || {}
      if (requirePublished && !ed?.published) continue
      const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
      const term = ed.term || ed?.inferred_term?.number || null
      const exId = toId(ed.id) || toId(r.exam) || toId(r.exam_id)
      // If a specific exam is selected, only include rows for that exam id.
      if (effectiveExamId){
        if (String(exId) !== String(toId(effectiveExamId))) continue
      } else if (parsedTermYear){
        if (year !== parsedTermYear.year || term !== parsedTermYear.term) continue
      }
      const sid = toId(r.subject_detail?.id) || toId(r.subject) || toId(r.subject_id)
      if (!exId || !sid) continue
      out[String(exId)] = out[String(exId)] || {}
      // Prefer component "Total" if present, then fall back to common mark fields
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
  }, [examResults, parsedTermYear, effectiveExamId, isPrivileged])

  const subjects = useMemo(()=>{
    // Prefer subjects from Results-page summary when available
    if (Array.isArray(summarySubjects) && summaryStudent){
      return summarySubjects.map(s=> ({ id: s.id, label: s.code ? `${s.code} — ${s.name}` : (s.name || String(s.id)) }))
    }
    // Prefer subjects that have marks for the selected exam
    const map = new Map()
    const byExam = marksByExamAndSubject
    const exId = selectedExam ? String(selectedExam.id) : null
    if (exId && byExam[exId]){
      for (const r of examResults){
        const ed = r.exam_detail || {}
        if (!ed?.published && !isPrivileged) continue
        const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
        const term = ed.term || ed?.inferred_term?.number || null
        if (parsedTermYear){
          if (year !== parsedTermYear.year || term !== parsedTermYear.term) continue
        }
        const sid = toId(r.subject_detail?.id) || toId(r.subject) || toId(r.subject_id)
        if (!sid) continue
        if (byExam[exId][String(sid)] === undefined) continue
        if (!map.has(String(sid))){
          const label = r.subject_detail ? `${r.subject_detail.code ? r.subject_detail.code + ' — ' : ''}${r.subject_detail.name || ''}` : String(r.subject || '')
          map.set(String(sid), { id: sid, label })
        }
      }
    }
    // Fallback: show all subjects in the term
    if (map.size === 0){
      for (const r of examResults){
        const ed = r.exam_detail || {}
        const requirePublished = !isPrivileged
        if (requirePublished && !ed?.published) continue
        const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
        const term = ed.term || ed?.inferred_term?.number || null
        if (parsedTermYear){
          if (year !== parsedTermYear.year || term !== parsedTermYear.term) continue
        }
        const sid = toId(r.subject_detail?.id) || toId(r.subject) || toId(r.subject_id)
        if (!sid) continue
        if (!map.has(String(sid))){
          const label = r.subject_detail ? `${r.subject_detail.code ? r.subject_detail.code + ' — ' : ''}${r.subject_detail.name || ''}` : String(r.subject || '')
          map.set(String(sid), { id: sid, label })
        }
      }
    }
    return Array.from(map.values())
  }, [examResults, parsedTermYear, selectedExam, marksByExamAndSubject, isPrivileged])

  


  const selectedExamMarks = useMemo(()=>{
    if (summaryStudent && Array.isArray(summarySubjects)){
      const out = {}
      for (const s of summarySubjects){
        const v = summaryStudent?.subject_percentages?.[String(s.id)]
        if (v != null) out[String(s.id)] = Math.round(Number(v))
      }
      return out
    }
    if (!selectedExam) return {}
    return marksByExamAndSubject[String(selectedExam.id)] || {}
  }, [marksByExamAndSubject, selectedExam, summaryStudent, summarySubjects])

  const selectedTotals = useMemo(()=>{
    // Prefer totals from summary percentages when available
    if (summaryStudent && Array.isArray(summarySubjects)){
      let sum = 0, count = 0
      for (const s of summarySubjects){
        const v = Number(summaryStudent?.subject_percentages?.[String(s.id)])
        if (Number.isFinite(v)) { sum += v; count += 1 }
      }
      const avg = count ? (sum / count) : 0
      return { sum, count, avg }
    }
    if (!selectedExam) return { sum: 0, count: 0, avg: 0 }
    let sum = 0
    let count = 0
    for (const subj of subjects){
      const v = selectedExamMarks[String(subj.id)]
      if (Number.isFinite(v)) { sum += v; count += 1 }
    }
    const avg = count ? (sum / count) : 0
    return { sum, count, avg }
  }, [subjects, selectedExam, selectedExamMarks, summaryStudent, summarySubjects])

  const totals = useMemo(()=>{
    if (subjects.length === 0 || termExams.length === 0) return { total: 0, count: 0, average: 0 }
    let total = 0
    let count = 0
    for (const ex of termExams){
      const m = marksByExamAndSubject[String(ex.id)] || {}
      for (const subj of subjects){
        const v = m[String(subj.id)]
        if (Number.isFinite(v)) { total += v; count += 1 }
      }
    }
    const average = count ? (total / count) : 0
    return { total, count, average }
  }, [subjects, termExams, marksByExamAndSubject])

  const examHistory = useMemo(()=>{
    const map = new Map()
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      if (!id) continue
      if (!map.has(String(id))){
        const ed = r.exam_detail || {}
        const year = ed.year || (ed?.date ? (isNaN(new Date(ed.date)) ? null : new Date(ed.date).getFullYear()) : null)
        const term = ed.term || ed?.inferred_term?.number || null
        map.set(String(id), { id, name: ed.name || String(r.exam || ''), year: year || null, term: term || null, grade: ed.grade_level_tag || null, published: !!ed.published })
      }
    }
    const seen = new Set()
    const list = []
    for (const r of examResults){
      const id = r.exam_detail?.id || r.exam
      if (id && !seen.has(String(id))){ seen.add(String(id)); const item = map.get(String(id)); if (item) list.push(item) }
    }
    return list
  }, [examResults])

  // Resolve rank object for the currently selected exam id (works with query param too)
  const currentRank = useMemo(()=>{
    const key = String(effectiveExamId || queryExamId || (selectedExam && selectedExam.id) || '')
    if (!key) return null
    return ranks[key] || null
  }, [ranks, effectiveExamId, queryExamId, selectedExam?.id])

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className={`flex items-center justify-between mb-4 no-print:mb-4 ${hideControls ? 'hidden print:hidden' : ''}`}>
          <div className="hidden" />
          <div className="flex items-center gap-2">
            {showTermSelector && termYearOptions.length>0 && (
              <select className="px-2 py-1.5 border rounded bg-white text-sm" value={effectiveTermYear || ''} onChange={(e)=> { const v = e.target.value || null; onSelectedTermYearChange ? onSelectedTermYearChange(v) : setSelectedTermYear(v) }} title="Select term">
                {termYearOptions.map(key=> (
                  <option key={key} value={key}>{key.replace('-', ' ')}</option>
                ))}
              </select>
            )}
            {showExamSelector && (termExams.length>0 || allExams.length>0) && (
              <select className="px-2 py-1.5 border rounded bg-white text-sm" value={effectiveExamId || ''} onChange={(e)=> { const v = e.target.value || null; onSelectedExamIdChange ? onSelectedExamIdChange(v) : setSelectedExamId(v) }} title="Select exam">
                {(termExams.length>0 ? termExams : allExams).map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            )}
            {showBackPrint && (
              <>
                <Link to={-1} className="px-3 py-1.5 rounded border hover:bg-gray-50">Back</Link>
                <button className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={()=>{ try { window.print() } catch(_) {} }}>Print</button>
              </>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded border border-red-100">{error}</div>}
        {loading && <div className="bg-white p-4 rounded card shadow border border-gray-100">Loading...</div>}

        {!loading && !error && (
          <div className="relative overflow-hidden rounded-xl border border-gray-300 bg-white shadow-lg print:shadow-none report-card-print-area">
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
              <div className="p-6 md:p-8">
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {(() => {
                      const rawUrl = (school?.logo_url || user?.school?.logo_url || school?.logo || user?.school?.logo || '')
                      const src = rawUrl ? toAbsoluteUrl(String(rawUrl)) + (rawUrl.includes('?') ? '' : `?v=${(school?.id||'')}-${(student?.id||'')}`) : ''
                      return (src && !logoFailed) ? (
                        <img src={src} alt="School Logo" className="w-10 h-10 object-contain" loading="eager" onError={(e)=>{ try{ e.currentTarget.src=''; }catch(_){} setLogoFailed(true) }} />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400">🏫</div>
                      )
                    })()}
                    <div className="text-2xl font-extrabold tracking-wide">{school?.name || user?.school?.name || 'SCHOOL NAME'}</div>
                  </div>
                  {(school?.motto || user?.school?.motto) && (
                    <div className="text-base font-semibold text-gray-600 mt-1">{school?.motto || user?.school?.motto}</div>
                  )}
                </div>

              <div className="flex items-start justify-between text-sm mb-6">
                <div className="space-y-1">
                  <div className="flex gap-3"><span className="font-semibold">Students name</span><span className="font-medium">{student?.name || '-'}</span></div>
                  <div className="flex gap-3">
                    <span className="font-semibold">Class</span>
                    <span className="font-medium">
                      {selectedExamClass?.name || student?.klass_detail?.name || student?.klass || '-'}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-semibold">Grade</span>
                    <span className="font-medium">
                      {selectedExam?.grade || selectedExamClass?.grade_level || student?.klass_detail?.grade_level || '-'}
                    </span>
                  </div>
                  <div className="flex gap-3"><span className="font-semibold">Admission number</span><span className="font-medium">{student?.admission_no || '-'}</span></div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-semibold">TERM</div>
                  <div className="font-medium">{parsedTermYear ? parsedTermYear.term : '-'}</div>
                  <div className="font-semibold mt-2">ACADEMIC YEAR</div>
                  <div className="font-medium">{parsedTermYear ? parsedTermYear.year : '-'}</div>
                </div>
              </div>

              <div className="border-t border-gray-300 my-4" />

              <div className="text-center text-sm font-semibold tracking-wide mb-3">{headerExamName}</div>

              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-2 bg-gray-100">Subject</th>
                      <th className="text-center px-3 py-2 bg-gray-100">Marks</th>
                      <th className="text-center px-3 py-2 bg-gray-100">Grade</th>
                      <th className="text-left px-3 py-2 bg-gray-100">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                          No marks found for the selected exam/term.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {subjects.map((subj)=>{
                          const v = selectedExamMarks[String(subj.id)]
                          return (
                            <tr key={String(subj.id)}>
                              <td className="px-3 py-2 border-t border-gray-200">{subj.label}</td>
                              <td className="px-3 py-2 text-center border-t border-gray-200">{Number.isFinite(v) ? v : '-'}</td>
                              <td className="px-3 py-2 text-center border-t border-gray-200">{Number.isFinite(v) ? (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gradeBadgeClass(toGrade(v, subj.id))}`}>{toGrade(v, subj.id)}</span>
                              ) : '-'}</td>
                              <td className="px-3 py-2 border-t border-gray-200">{subjectRemark(v, subj.label)}</td>
                            </tr>
                          )
                        })}
                        <tr>
                          <td className="px-3 py-2 border-t border-gray-300 font-semibold">Total</td>
                          <td className="px-3 py-2 text-center border-t border-gray-300 font-semibold">{selectedTotals.sum.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center border-t border-gray-300 font-semibold">
                            {(() => { const g = letterFromBands(selectedTotals.avg, globalBands); return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gradeBadgeClass(g)}`}>{g}</span> })()}
                          </td>
                          <td className="px-3 py-2 border-t border-gray-300 font-semibold"></td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-300 my-6" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="border border-gray-300 rounded">
                  <div className="px-3 py-2 font-semibold border-b border-gray-300">Class Position</div>
                  <div className="px-3 py-6">
                    {currentRank ? (
                      <>
                        <span className="text-lg md:text-xl font-semibold">{currentRank.class?.position || '-'}</span>
                        <span className="mx-1 text-xs md:text-sm text-gray-600 align-baseline">out of</span>
                        <span className="text-lg md:text-xl font-extrabold">{currentRank.class?.size || '-'}</span>
                      </>
                    ) : '-' }
                  </div>
                </div>
                <div className="border border-gray-300 rounded">
                  <div className="px-3 py-2 font-semibold border-b border-gray-300">Grade Position</div>
                  <div className="px-3 py-6">
                    {currentRank ? (
                      <>
                        <span className="text-lg md:text-xl font-semibold">{currentRank.grade?.position || '-'}</span>
                        <span className="mx-1 text-xs md:text-sm text-gray-600 align-baseline">out of</span>
                        <span className="text-lg md:text-xl font-extrabold">{currentRank.grade?.size || '-'}</span>
                      </>
                    ) : '-' }
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-300 my-6" />

              <div className="grid grid-cols-5 gap-4 text-sm items-start">
                <div className="col-span-2">
                  <div className="font-semibold">Class Teacher Name</div>
                  <div className="mt-2">{(() => {
                    const t = student?.klass_detail?.teacher_detail
                    if (!t) return '-'
                    const first = t.first_name || ''
                    const last = t.last_name || ''
                    const full = `${first} ${last}`.trim()
                    return full || t.username || '-'
                  })()}</div>
                </div>
                <div className="col-span-3">
                  <div className="font-semibold">Remarks</div>
                  <div className="mt-2 w-full border rounded p-2 min-h-[72px] bg-white">
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
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !hideHistory && (
          <div className="max-w-3xl mx-auto mt-4">
            <div className="bg-white rounded card shadow border border-gray-100 p-5">
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
          </div>
        )}
      </div>
    </div>
  )
}
