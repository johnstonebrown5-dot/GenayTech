import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

export default function AdminEnterResults({ readOnly }){
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const examId = Number(id)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('idle')
  const [exam, setExam] = useState(null)
  const [klass, setKlass] = useState(null)
  const [allClasses, setAllClasses] = useState([])
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState('') // '' means All subjects
  const [results, setResults] = useState([]) // rows: {student, subject, component|null, marks}
  const [invalid, setInvalid] = useState({}) // { 'studentId-subjectId': true }
  const [componentsMap, setComponentsMap] = useState({}) // { subjectId: [components] }
  const [uploadOpen, setUploadOpen] = useState(true)
  const [studentSearch, setStudentSearch] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')
  const [subjectOrder, setSubjectOrder] = useState([])
  const [reorderOpen, setReorderOpen] = useState(false)
  const { showError, showSuccess } = useNotification?.() || { showError: ()=>{}, showSuccess: ()=>{} }
  const isReadOnly = Boolean(readOnly) || (new URLSearchParams(location.search).get('readonly') === '1')
  const klassOverride = new URLSearchParams(location.search).get('klass')
  const [reloadKey, setReloadKey] = useState(0)

  const dirtyMarksRef = useRef(new Set())
  const dirtyOutOfRef = useRef(new Set())
  const [dirtyVersion, setDirtyVersion] = useState(0)
  const autoSaveTimerRef = useRef(null)
  const autoSaveInFlightRef = useRef(false)
  const autoSavePendingRef = useRef(false)

  useEffect(()=>{
    const t = setTimeout(()=>{
      setAppliedStudentSearch(String(studentSearch || '').trim())
    }, 250)
    return ()=>clearTimeout(t)
  }, [studentSearch])

  const createUploadRow = (subjectId = '') => ({
    uid: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    subjectId: subjectId ? String(subjectId) : '',
    componentId: '',
    outOf: '',
    file: null,
    error: '',
    uploading: false,
    committing: false,
  })

  const [uploadRows, setUploadRows] = useState([createUploadRow('')])

  useEffect(()=>{
    let alive = true
    ;(async ()=>{
      try{
        setLoading(true)
        setError('')
        // exam
        let e = null
        try {
          e = await api.get(`/academics/exams/${examId}/`)
        } catch {
          try {
            e = await api.get(`/academics/exams/${examId}`)
          } catch {}
        }
        // If exam detail is not accessible (teacher perms), fall back to summary (read-only view)
        if (!e?.data){
          try{
            const s = await api.get(`/academics/exams/${examId}/summary/`)
            const sx = s?.data || {}
            const meta = sx?.exam ? {
              id: sx.exam.id ?? examId,
              name: sx.exam.name,
              year: sx.exam.year,
              term: sx.exam.term,
              klass: sx.exam.klass,
              total_marks: sx.exam.total_marks,
            } : { id: examId }
            if (alive) setExam(meta)
          }catch{
            // proceed with minimal meta so page can still render percentages from any accessible data
            if (alive) setExam({ id: examId })
          }
        } else {
          if (!alive) return
          setExam(e.data)
        }
        // Normalize klass id from exam payload
        const rawKlass = e?.data?.klass ?? e?.data?.class ?? e?.data?.klass_id ?? e?.data?.class_id
        const fromExam = (typeof rawKlass === 'object' && rawKlass)
          ? (rawKlass.id ?? rawKlass.klass ?? rawKlass.pk ?? rawKlass.ID)
          : rawKlass
        const overrideNum = Number(klassOverride)
        const klassId = (Number.isFinite(overrideNum) && overrideNum > 0) ? overrideNum : fromExam
        // Do not throw if klassId is missing – in read-only teacher mode we can still show data via summary
        // We'll try to fill subjects/students using alternative endpoints below.
        // class details (need subjects) + students
        let klassObj = null
        try {
          const klassRes = await api.get(`/academics/classes/${encodeURIComponent(klassId)}/`)
          klassObj = klassRes?.data || null
        } catch {
          try {
            const klassRes = await api.get(`/academics/classes/${encodeURIComponent(klassId)}`)
            klassObj = klassRes?.data || null
          } catch {}
        }
        // Fallback: search class in list endpoints when direct detail is restricted
        if (!klassObj && klassId){
          try{
            const list = await api.get('/academics/classes/')
            const arr = Array.isArray(list?.data) ? list.data : (Array.isArray(list?.data?.results) ? list.data.results : [])
            const found = arr.find(c => String(c.id) === String(klassId))
            if (found) klassObj = found
          }catch{}
        }
        if (!alive) return
        if (!klassObj) {
          // Fallback: try locate from my classes
          try {
            const mine = await api.get('/academics/classes/mine/')
            const list = Array.isArray(mine?.data) ? mine.data : (Array.isArray(mine?.data?.results) ? mine.data.results : [])
            klassObj = list.find(c => String(c?.id) === String(klassId)) || null
          } catch {}
        }
        setKlass(klassObj || { id: klassId })
        let subjRaw = Array.isArray(klassObj?.subjects) ? klassObj.subjects : []
        if ((!subjRaw || !subjRaw.length) && klassId){
          try{
            const klassRes = await api.get(`/academics/classes/${encodeURIComponent(klassId)}/`)
            const d = klassRes?.data
            subjRaw = Array.isArray(d?.subjects) ? d.subjects : subjRaw
          }catch{}
        }
        // Filter out non-examinable subjects from entry grid and dropdown
        let subj = subjRaw.filter(s => s?.is_examinable !== false)

        // Fallback: if class endpoints didn't include subjects (common under teacher perms), use exam summary subjects
        if ((!subj || !subj.length) && examId){
          try{
            const res = await api.get(`/academics/exams/${examId}/summary/`)
            const summarySubjects = Array.isArray(res?.data?.subjects) ? res.data.subjects : []
            subj = summarySubjects.filter(s => s?.is_examinable !== false)
          }catch{}
        }

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
        // Load students with robust fallbacks (iterate pagination to get ALL)
        const fetchAllPaged = async (url) => {
          let out = []
          let next = url
          let guard = 0
          while (next && guard < 100){
            const r = await api.get(next)
            const d = r?.data
            if (Array.isArray(d)) { out = d; break }
            if (d && Array.isArray(d.results)) { out = out.concat(d.results); next = d.next; guard++; continue }
            if (d && Array.isArray(d.items)) { out = out.concat(d.items); next = d.next; guard++; continue }
            break
          }
          return out
        }

        let studentsList = []
        try {
          studentsList = await fetchAllPaged(`/academics/students/?klass=${encodeURIComponent(klassId)}&page_size=200`)
        } catch {}
        if (!studentsList.length) {
          try {
            studentsList = await fetchAllPaged(`/academics/students/?class=${encodeURIComponent(klassId)}&page_size=200`)
          } catch {}
        }
        if (!studentsList.length && klassId) {
          try {
            const res = await api.get(`/academics/classes/${encodeURIComponent(klassId)}/students/`)
            studentsList = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.results) ? res.data.results : [])
          } catch {}
        }
        // Final fallback: use exam summary students (only present when there are saved results)
        if (!studentsList.length && examId){
          try{
            const res = await api.get(`/academics/exams/${examId}/summary/`)
            const ss = Array.isArray(res?.data?.students) ? res.data.students : []
            studentsList = ss
              .filter(x => x && x.id != null)
              .map(x => ({ id: x.id, name: x.name || String(x.id), admission_no: x.admission_no || '' }))
          }catch{}
        }
        if (!alive) return
        setStudents(studentsList)
        // existing results (raw per-component marks) - fetch ALL pages
        let existing = []
        try{
          existing = await fetchAllPaged(`/academics/exam_results/?exam=${examId}&page_size=200`)
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
  }, [examId, reloadKey])

  // Load class options for read-only teacher view switching
  useEffect(()=>{
    let active = true
    ;(async()=>{
      try{
        const res = await api.get('/academics/classes/')
        const arr = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
        if (active) setAllClasses(arr)
      }catch{
        if (active) setAllClasses([])
      }
    })()
    return ()=>{ active = false }
  }, [])

  const classNameById = (id) => {
    const c = allClasses.find(x => String(x.id)===String(id))
    return c?.name || klass?.name || id
  }

  const save = async (e) => {
    e?.preventDefault?.()
    if (isReadOnly) return
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
      const res = await api.post('/academics/exam_results/bulk/', { results: payload }, { timeout: 30000 })
      const failed = Number(res?.data?.failed || 0)
      if (failed){
        setStatus('idle')
        setError(`Partial save. ${failed} failed. ${res?.data?.errors ? JSON.stringify(res.data.errors.slice(0,3)) : ''}`)
      } else {
        setStatus('saved')
        setTimeout(()=>setStatus('idle'), 1500)
        dirtyMarksRef.current = new Set()
        dirtyOutOfRef.current = new Set()
        setDirtyVersion(v=>v+1)
      }
    }catch(err){
      setError(err?.response?.data?.detail || err?.message || 'Failed to save results')
      setStatus('idle')
    }finally{
      setSaving(false)
    }
  }

  const queueDirtyMark = (key) => {
    if (!key) return
    dirtyMarksRef.current.add(String(key))
    setDirtyVersion(v=>v+1)
  }

  const queueDirtyOutOf = (subjectId, componentId) => {
    const sid = Number(subjectId)
    if (!Number.isFinite(sid)) return
    const cid = componentId == null ? '' : String(componentId)
    dirtyOutOfRef.current.add(`${sid}:${cid}`)
    setDirtyVersion(v=>v+1)
  }

  const buildAutoSavePayload = (marksKeys, outOfKeys) => {
    const byKey = new Map()

    const pushRow = (row) => {
      if (!row) return
      const mk = row?.marks
      if (mk === '' || mk === null || typeof mk === 'undefined') return
      const n = Math.round(parseFloat(mk))
      if (Number.isNaN(n)) return
      const key = `${row.student}-${row.subject}-${row.component ?? ''}`
      byKey.set(key, { exam: examId, student: row.student, subject: row.subject, component: row.component, marks: n, out_of: row.outOf })
    }

    for (const k of marksKeys){
      const key = String(k)
      const parts = key.split('-')
      const studentId = Number(parts[0])
      const subjectId = Number(parts[1])
      const compId = parts.length > 2 ? Number(parts[2]) : NaN
      const match = results.find(r => r.student===studentId && r.subject===subjectId && ((Number.isFinite(compId) ? compId : null) === (r.component ?? null)))
      pushRow(match)
    }

    for (const k of outOfKeys){
      const [sidRaw, cidRaw] = String(k).split(':')
      const sid = Number(sidRaw)
      const cid = cidRaw === '' ? null : Number(cidRaw)
      if (!Number.isFinite(sid)) continue
      const rows = results.filter(r => r.subject===sid && ((cid ?? null) === (r.component ?? null)))
      rows.forEach(pushRow)
    }

    return Array.from(byKey.values())
  }

  const flushAutoSave = async () => {
    if (isReadOnly) return
    if (loading) return
    const hasInvalid = Object.values(invalid).some(Boolean)
    if (hasInvalid) return

    const marksKeys = Array.from(dirtyMarksRef.current)
    const outOfKeys = Array.from(dirtyOutOfRef.current)
    if (!marksKeys.length && !outOfKeys.length) return

    const payload = buildAutoSavePayload(marksKeys, outOfKeys)
    if (!payload.length){
      dirtyMarksRef.current = new Set()
      dirtyOutOfRef.current = new Set()
      setDirtyVersion(v=>v+1)
      return
    }

    if (autoSaveInFlightRef.current){
      autoSavePendingRef.current = true
      return
    }
    autoSaveInFlightRef.current = true

    try{
      await api.post('/academics/exam_results/bulk/', { results: payload }, { timeout: 30000 })
      marksKeys.forEach(k => dirtyMarksRef.current.delete(k))
      outOfKeys.forEach(k => dirtyOutOfRef.current.delete(k))
      setStatus('saved')
      setTimeout(()=>setStatus('idle'), 1200)
    }catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Auto-save failed'
      showError('Auto-save failed', msg, 4000)
      setStatus('idle')
    }finally{
      autoSaveInFlightRef.current = false
      if (autoSavePendingRef.current){
        autoSavePendingRef.current = false
        setTimeout(()=>flushAutoSave(), 150)
      }
    }
  }

  useEffect(()=>{
    if (isReadOnly) return
    if (!dirtyVersion) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(()=>{
      flushAutoSave()
    }, 900)
    return ()=>{
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [dirtyVersion, isReadOnly, loading])

  const title = useMemo(()=>{
    if (!exam) return 'Enter Results'
    const klabel = classNameById(klass?.id)
    return `${exam.name ?? '—'} — Year ${exam.year ?? '—'} — Term ${exam.term ?? '—'} — ${klabel ?? '—'}`
  }, [exam, klass, allClasses])

  useEffect(()=>{
    if (!selectedSubject) return
    setUploadRows(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return [createUploadRow(String(selectedSubject))]
      const first = prev[0]
      if (first && !first.subjectId) return [{ ...first, subjectId: String(selectedSubject) }, ...prev.slice(1)]
      return prev
    })
  }, [selectedSubject])

  const updateUploadRow = (uid, patch) => {
    setUploadRows(prev => prev.map(r => (r.uid === uid ? { ...r, ...patch } : r)))
  }

  const addUploadRow = () => {
    setUploadRows(prev => [...(Array.isArray(prev) ? prev : []), createUploadRow(selectedSubject || '')])
  }

  const removeUploadRow = (uid) => {
    setUploadRows(prev => {
      const next = (Array.isArray(prev) ? prev : []).filter(r => r.uid !== uid)
      return next.length ? next : [createUploadRow(selectedSubject || '')]
    })
  }

  const downloadTemplate = async (row) => {
    try{
      const subjId = Number(row?.subjectId)
      if (!examId || !subjId) throw new Error('Select Subject first')
      const compId = row?.componentId ? Number(row.componentId) : undefined
      const params = new URLSearchParams({ exam: String(examId), subject: String(subjId) })
      if (compId) params.append('component', String(compId))
      const res = await api.get(`/academics/exam_results/upload-template/?${params.toString()}`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `upload_template_exam${examId}_subject${subjId}${compId?`_comp${compId}`:''}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      showSuccess('Template downloaded', 'Roster CSV generated.', 2500)
    }catch(e){
      const msg = e?.response?.data?.detail || e?.message || 'Failed to download template'
      showError('Download failed', msg, 4000)
    }
  }

  const applyPreviewRows = (rows, subjId, compId) => {
    if (!Array.isArray(rows) || rows.length===0) return
    const byId = new Set(students.map(s=>s.id))
    const next = [...results]
    rows.forEach(r => {
      const sid = Number(r.student)
      const val = r.scaled_marks
      const intVal = (val == null || val === '') ? '' : Math.round(Number(val))
      if (!Number.isNaN(sid) && byId.has(sid)){
        const idx = next.findIndex(x => x.student===sid && x.subject===subjId && ((compId ?? null)===(x.component ?? null)))
        if (idx>-1){ next[idx] = { ...next[idx], marks: String(intVal) }
        } else {
          next.push({ student: sid, subject: subjId, component: compId ?? null, marks: String(intVal) })
        }
      }
    })
    setResults(next)
  }

  const previewUpload = async (row) => {
    const uid = row?.uid
    try{
      updateUploadRow(uid, { uploading: true, error: '' })
      const subjId = Number(row?.subjectId)
      if (!examId || !subjId) throw new Error('Select Subject first')
      const form = new FormData()
      if (!row?.file) throw new Error('Choose a file to upload')
      form.append('file', row.file)
      form.append('exam', String(examId))
      form.append('subject', String(subjId))
      if (row?.componentId) form.append('component', String(row.componentId))
      if (row?.outOf) form.append('out_of', String(row.outOf))
      form.append('commit', 'false')
      form.append('debug', 'true')
      const res = await api.post('/academics/exam_results/upload/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const data = res?.data || {}
      const rows = Array.isArray(data.rows) ? data.rows : []
      applyPreviewRows(rows, subjId, row?.componentId ? Number(row.componentId) : null)
      const matched = rows.filter(r => r.student && !r.error).length
      const total = rows.length
      const failed = total - matched
      showSuccess('Preview applied', `Filled ${matched}/${total} rows${failed?` (${failed} unmatched/invalid)`:''}.`, 3500)
    }catch(e){
      const msg = e?.response?.data?.detail || e?.message || 'Upload failed'
      updateUploadRow(uid, { error: msg })
      showError('Upload failed', msg, 5000)
    } finally {
      updateUploadRow(uid, { uploading: false })
    }
  }

  const commitUpload = async (row) => {
    const uid = row?.uid
    try{
      updateUploadRow(uid, { committing: true, error: '' })
      const subjId = Number(row?.subjectId)
      if (!examId || !subjId) throw new Error('Select Subject first')
      if (!row?.file) throw new Error('Choose a file to upload')
      const form = new FormData()
      form.append('file', row.file)
      form.append('exam', String(examId))
      form.append('subject', String(subjId))
      if (row?.componentId) form.append('component', String(row.componentId))
      if (row?.outOf) form.append('out_of', String(row.outOf))
      form.append('commit', 'true')
      const res = await api.post('/academics/exam_results/upload/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const failed = Number(res?.data?.failed || 0)
      if (failed === 0){
        showSuccess('Upload saved', 'All parsed marks were saved.', 3000)
      } else {
        const errs = Array.isArray(res?.data?.errors) ? res.data.errors : []
        const detail = errs.slice(0,3).map(e=> typeof e?.error==='string' ? e.error : JSON.stringify(e?.error||'Failed')).join(' | ')
        showError('Partial save', `${failed} failed. ${detail}${errs.length>3?' ...':''}`, 6000)
      }
      setReloadKey(v=>v+1)
      updateUploadRow(uid, { file: null })
    }catch(e){
      const msg = e?.response?.data?.detail || e?.message || 'Commit failed'
      updateUploadRow(uid, { error: msg })
      showError('Commit failed', msg, 5000)
    } finally {
      updateUploadRow(uid, { committing: false })
    }
  }

  const previewAllUploads = async () => {
    const rows = Array.isArray(uploadRows) ? uploadRows : []
    await rows.reduce(
      (p, r) => p.then(() => (r?.subjectId && r?.file ? previewUpload(r) : null)),
      Promise.resolve()
    )
  }

  const commitAllUploads = async () => {
    const rows = Array.isArray(uploadRows) ? uploadRows : []
    await rows.reduce(
      (p, r) => p.then(() => (r?.subjectId && r?.file ? commitUpload(r) : null)),
      Promise.resolve()
    )
  }

  useEffect(()=>{
    setSubjectOrder(prev => {
      const nextIds = (Array.isArray(subjects) ? subjects : []).map(s => Number(s?.id)).filter(id => Number.isFinite(id))
      if (!nextIds.length) return []
      const prevIds = (Array.isArray(prev) ? prev : []).map(Number).filter(id => Number.isFinite(id))
      const keep = prevIds.filter(id => nextIds.includes(id))
      const add = nextIds.filter(id => !keep.includes(id))
      return [...keep, ...add]
    })
  }, [subjects])

  const orderedSubjects = useMemo(()=>{
    const arr = Array.isArray(subjects) ? subjects : []
    const order = Array.isArray(subjectOrder) ? subjectOrder : []
    if (!order.length) return arr
    const byId = new Map(arr.map(s => [String(s?.id), s]))
    return order.map(id => byId.get(String(id))).filter(Boolean)
  }, [subjects, subjectOrder])

  // Subjects currently visible based on filter
  const visibleSubjects = useMemo(()=>{
    return selectedSubject ? orderedSubjects.filter(s=> String(s.id)===String(selectedSubject)) : orderedSubjects
  }, [orderedSubjects, selectedSubject])

  const displayStudents = useMemo(()=>{
    const q = String(appliedStudentSearch || '').trim().toLowerCase()
    if (!q) return students
    return (Array.isArray(students) ? students : []).filter(stu => {
      const name = String(stu?.name || '').toLowerCase()
      const adm = String(stu?.admission_no || '').toLowerCase()
      return name.includes(q) || adm.includes(q)
    })
  }, [students, appliedStudentSearch])

  const moveSubject = (subjectId, delta) => {
    setSubjectOrder(prev => {
      const ids = (Array.isArray(prev) && prev.length) ? [...prev] : (Array.isArray(subjects) ? subjects.map(s => s?.id) : [])
      const i = ids.findIndex(x => String(x) === String(subjectId))
      const j = i + delta
      if (i < 0 || j < 0 || j >= ids.length) return ids
      const tmp = ids[i]
      ids[i] = ids[j]
      ids[j] = tmp
      return ids
    })
  }

  const resetSubjectOrder = () => {
    setSubjectOrder((Array.isArray(subjects) ? subjects : []).map(s => s?.id))
  }

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
    queueDirtyOutOf(subjectId, componentId)
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
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}
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
                {orderedSubjects.map(s=> (<option key={s.id} value={s.id}>{s.code} — {s.name}</option>))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6"/></svg>
            </div>
            <span className="hidden sm:inline text-xs text-gray-500">Total {Number(exam?.total_marks||100)}</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                className="border px-2 py-2 rounded-lg text-sm w-full sm:w-56"
                value={studentSearch}
                onChange={(e)=>setStudentSearch(e.target.value)}
                onKeyDown={(e)=>{
                  if (e.key === 'Enter') setAppliedStudentSearch(String(studentSearch || '').trim())
                }}
                placeholder="Search student…"
                aria-label="Search student"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-lg border text-sm bg-white"
                onClick={()=>setAppliedStudentSearch(String(studentSearch || '').trim())}
              >Search</button>
            </div>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border text-sm bg-white"
              onClick={()=>setReorderOpen(v=>!v)}
            >Reorder</button>
            {isReadOnly && (
              <label className="text-xs text-gray-600 flex items-center gap-2">
                <span>Class</span>
                <select
                  className="border pl-2 pr-2 py-2 rounded-lg text-sm bg-white"
                  value={klass?.id || ''}
                  onChange={(e)=>{
                    const params = new URLSearchParams(location.search)
                    if (e.target.value) params.set('klass', String(e.target.value)); else params.delete('klass')
                    if (!params.get('readonly')) params.set('readonly','1')
                    navigate({ pathname: location.pathname, search: params.toString() })
                  }}
                >
                  <option value="">Select class…</option>
                  {allClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="px-3 py-1.5 rounded-lg border text-sm" onClick={()=>navigate(-1)}>Back</button>
            <button disabled={saving || isReadOnly} onClick={save} className={`px-3.5 py-1.5 rounded-lg text-sm text-white ${status==='saved' ? 'bg-green-600' : 'bg-blue-600'} disabled:opacity-60`}>
              {isReadOnly ? 'Read-only' : (saving? 'Saving...' : status==='saved' ? 'Saved' : 'Save Results')}
            </button>
          </div>
        </div>
        {reorderOpen && (
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-medium text-gray-800">Reorder Subject Columns</div>
              <div className="flex items-center gap-2">
                <button type="button" className="px-3 py-1.5 rounded-lg border text-sm bg-white" onClick={resetSubjectOrder}>Reset</button>
                <button type="button" className="px-3 py-1.5 rounded-lg border text-sm bg-white" onClick={()=>setReorderOpen(false)}>Close</button>
              </div>
            </div>
            <div className="mt-2 grid gap-1">
              {orderedSubjects.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between gap-2 border rounded-lg px-2 py-1 bg-gray-50">
                  <div className="text-sm text-gray-800 truncate">{s.code} — {s.name}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="px-2 py-1 rounded border text-xs bg-white disabled:opacity-50"
                      disabled={idx === 0}
                      onClick={()=>moveSubject(s.id, -1)}
                    >Up</button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border text-xs bg-white disabled:opacity-50"
                      disabled={idx === orderedSubjects.length - 1}
                      onClick={()=>moveSubject(s.id, 1)}
                    >Down</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!isReadOnly && (
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3"
              onClick={()=>setUploadOpen(v=>!v)}
              aria-expanded={uploadOpen}
            >
              <div className="text-sm font-medium text-gray-800">Upload grades (multiple subjects)</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{uploadOpen ? 'Collapse' : 'Expand'}</span>
                <svg className={`w-4 h-4 text-gray-600 transition-transform ${uploadOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6"/></svg>
              </div>
            </button>
            {uploadOpen && (
              <React.Fragment>
                <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
                  <button type="button" className="px-3 py-2 rounded border bg-white" onClick={addUploadRow}>Add another subject</button>
                  <button type="button" className="px-3 py-2 rounded text-white bg-indigo-600 disabled:opacity-60" onClick={previewAllUploads}>Preview All</button>
                  <button type="button" className="px-3 py-2 rounded text-white bg-emerald-600 disabled:opacity-60" onClick={commitAllUploads}>Commit All</button>
                </div>
                <div className="mt-3 grid gap-3">
                  {(Array.isArray(uploadRows) ? uploadRows : []).map((row, idx) => {
                    const subjectNum = Number(row?.subjectId || '')
                    const comps = componentsMap[subjectNum] || []
                    return (
                      <div key={row.uid} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-gray-600">Upload #{idx+1}</div>
                          <button type="button" className="text-xs text-red-700" onClick={()=>removeUploadRow(row.uid)} disabled={(uploadRows||[]).length<=1}>Remove</button>
                        </div>
                        <div className="mt-2 flex flex-col md:flex-row md:items-end gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                            <label className="text-xs text-gray-700 flex flex-col">
                              <span className="mb-1">Subject</span>
                              <select
                                className="border rounded px-2 py-2"
                                value={row.subjectId}
                                onChange={e=> updateUploadRow(row.uid, { subjectId: e.target.value, componentId: '', error: '' })}
                              >
                                <option value="">Select subject…</option>
                                {subjects.map(s=> (<option key={s.id} value={s.id}>{s.code} — {s.name}</option>))}
                              </select>
                            </label>
                            <label className="text-xs text-gray-700 flex flex-col">
                              <span className="mb-1">Paper/Component (optional)</span>
                              <select
                                className="border rounded px-2 py-2"
                                value={row.componentId}
                                onChange={e=> updateUploadRow(row.uid, { componentId: e.target.value, error: '' })}
                              >
                                <option value="">—</option>
                                {(Array.isArray(comps) ? comps : []).map(c => (
                                  <option key={c.id} value={c.id}>{c.code || c.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs text-gray-700 flex flex-col">
                              <span className="mb-1">Out Of (optional)</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={1}
                                step="1"
                                className="border rounded px-2 py-2"
                                value={row.outOf}
                                onChange={e=> updateUploadRow(row.uid, { outOf: e.target.value, error: '' })}
                                placeholder={String(Number(exam?.total_marks||100))}
                              />
                            </label>
                            <label className="text-xs text-gray-700 flex flex-col">
                              <span className="mb-1">CSV/XLSX or Image</span>
                              <input
                                type="file"
                                accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg"
                                onChange={e=> updateUploadRow(row.uid, { file: e.target.files?.[0]||null, error: '' })}
                                className="border rounded px-2 py-2 bg-white"
                              />
                            </label>
                          </div>
                          <div className="flex gap-2 md:self-start">
                            <button
                              type="button"
                              className="px-3 py-2 rounded border bg-white"
                              disabled={!row.subjectId}
                              onClick={()=>downloadTemplate(row)}
                            >Download Template</button>
                            <button
                              type="button"
                              className="px-3 py-2 rounded text-white bg-indigo-600 disabled:opacity-60"
                              disabled={row.uploading}
                              onClick={()=>previewUpload(row)}
                            >{row.uploading ? 'Previewing…' : 'Preview Fill'}</button>
                            <button
                              type="button"
                              className="px-3 py-2 rounded text-white bg-emerald-600 disabled:opacity-60"
                              disabled={row.committing}
                              onClick={()=>commitUpload(row)}
                            >{row.committing ? 'Saving…' : 'Commit Save'}</button>
                          </div>
                        </div>
                        {row.error && (
                          <div className="mt-2 bg-red-50 text-red-700 p-2 rounded border border-red-200 text-sm">{row.error}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </React.Fragment>
            )}
          </div>
        )}
        {loading && <div>Loading...</div>}
        {!loading && (
          <div className="bg-white rounded-xl shadow-card border border-gray-200 p-3 overflow-auto max-h-[70vh] md:max-h-[75vh]">
            <div className="text-xs text-gray-500 mb-2">Legend: <span className="px-1 rounded bg-rose-50 border border-rose-200">Missing/0</span> • <span className="px-1 rounded border border-red-300">Out of range</span></div>
            {appliedStudentSearch && displayStudents.length === 0 && (
              <div className="mb-2 text-sm text-gray-700">No students match "{appliedStudentSearch}".</div>
            )}
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
                                  disabled={isReadOnly}
                                  onChange={e=>{ if (!isReadOnly) setOutOfFor(s.id, c.id, e.target.value) }}
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
                            disabled={isReadOnly}
                            onChange={e=>{ if (!isReadOnly) setOutOfFor(s.id, null, e.target.value) }}
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
                {displayStudents.map((stu, idx) => (
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
                                    disabled={isReadOnly}
                                    onChange={e=>{
                                      if (isReadOnly) return
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
                                      queueDirtyMark(cellKey)
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
                              disabled={isReadOnly}
                              onChange={e=>{
                                if (isReadOnly) return
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
                                queueDirtyMark(cellKey)
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
