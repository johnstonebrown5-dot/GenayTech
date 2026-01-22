import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'

export default function TeacherGrades(){
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [components, setComponents] = useState([]) // subject components (papers)
  const [students, setStudents] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedComponentId, setSelectedComponentId] = useState('')
  const [entryMode, setEntryMode] = useState('single') // 'single' | 'all'
  const [examMeta, setExamMeta] = useState({ name: 'CAT', year: new Date().getFullYear(), term: 1, date: new Date().toISOString().slice(0,10), total_marks: 100 })
  const [exams, setExams] = useState([]) // available unpublished exams for the class
  const [selectedExamId, setSelectedExamId] = useState('')
  const [marks, setMarks] = useState({}) // { student_id: number }
  const [outOf, setOutOf] = useState('') // teacher-entered denominator for this entry session
  // For 'all' mode
  const [marksAll, setMarksAll] = useState({}) // { compId: { studentId: value } }
  const [invalidAll, setInvalidAll] = useState({}) // { compId: { studentId: bool } }
  const [outOfPerComp, setOutOfPerComp] = useState({}) // { compId: number }
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [controlsOpen, setControlsOpen] = useState(true)
  const [me, setMe] = useState(null)
  const { showSuccess, showError } = useNotification()
  const [invalid, setInvalid] = useState({}) // { student_id: true }
  const saveTimersRef = useRef({}) // { student_id: timeoutId }
  const examsCacheRef = useRef({})
  const [examsLoading, setExamsLoading] = useState(false)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [examsReloadKey, setExamsReloadKey] = useState(0)
  const [marksReloadKey, setMarksReloadKey] = useState(0)

  // NEW: Allow teachers to input as raw marks or percentages
  const [inputAs, setInputAs] = useState('marks') // 'marks' | 'percent'
  const [unitModal, setUnitModal] = useState(false)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const refreshExams = () => {
    try { delete examsCacheRef.current[String(selectedClass)] } catch {}
    setExamsReloadKey(v=>v+1)
  }
  const reloadSavedMarks = () => setMarksReloadKey(v=>v+1)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewSummary, setPreviewSummary] = useState(null)

  // Display labels for header
  const subjectDisplay = useMemo(()=>{
    const s = subjects.find(x=> String(x.id)===String(selectedSubject))
    if (!s) return 'Subject'
    return s.code ? `${s.code} - ${s.name}` : String(s.name || 'Subject')
  }, [subjects, selectedSubject])
  const examDisplay = useMemo(()=>{
    const e = exams.find(x=> String(x.id)===String(selectedExamId))
    return e ? String(e.name || 'Exam') : 'Exam'
  }, [exams, selectedExamId])

  // Student search
  const [searchQuery, setSearchQuery] = useState('')
  const visibleStudents = useMemo(()=>{
    const list = Array.isArray(students) ? students : []
    const q = String(searchQuery||'').trim().toLowerCase()
    if (!q) return list
    return list.filter(s => (
      String(s.name||'').toLowerCase().includes(q) ||
      String(s.admission_no||'').toLowerCase().includes(q)
    ))
  }, [students, searchQuery])

  // Persist teacher Out Of preferences per class/subject/exam
  const outOfStoreKey = () => [
    'outofprefs',
    `c:${selectedClass||''}`,
    `s:${selectedSubject||''}`,
    `e:${selectedExamId||''}`,
  ].join('|')
  const loadOutOfPrefs = () => {
    try{ const raw = localStorage.getItem(outOfStoreKey()); return raw ? JSON.parse(raw) : {} }catch{ return {} }
  }
  const saveOutOfPrefs = (map) => {
    try{ localStorage.setItem(outOfStoreKey(), JSON.stringify(map||{})) }catch{}
  }

  // Helper: compute percentage for a raw value given an Out Of
  const toPercent = (raw, out) => {
    const v = Number(raw)
    const o = Number(out || examMeta.total_marks || 100)
    if (Number.isNaN(v) || Number.isNaN(o) || o <= 0) return ''
    return `${Math.round((v / o) * 1000) / 10}%`
  }

  // (Removed) Local saved snapshot fallback to honor strict matching requirement

  // ---------- Robust save helper ----------
  const saveResults = async (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { ok: true, failed: 0, errors: [] }
    // Try bulk first
    try {
      const res = await api.post('/academics/exam_results/bulk/', { results: rows })
      const failed = Number(res?.data?.failed || 0)
      const bulkErrors = Array.isArray(res?.data?.errors) ? res.data.errors : []
      if (failed === 0) return { ok: true, failed: 0, errors: [] }
      // If some failed, retry only failed rows individually
      if (failed < rows.length){
        const errors = bulkErrors
        const failedIdx = new Set(
          errors
            .map(e => e?.index)
            .filter(i => typeof i === 'number' && i >= 0)
        )
        const toRetry = failedIdx.size ? rows.filter((_, i) => failedIdx.has(i)) : rows
        let retryFailed = 0
        const retryErrors = []
        for (const r of toRetry){
          const primary = {
            exam: r.exam,
            subject: r.subject,
            student: r.student,
            marks: r.marks,
            ...(r.component ? { component: r.component } : {}),
            ...(r.out_of ? { out_of: r.out_of } : {}),
          }
          const alternate = {
            exam_id: r.exam,
            subject_id: r.subject,
            student_id: r.student,
            score: r.marks,
            ...(r.component ? { component_id: r.component } : {}),
            ...(r.out_of ? { out_of: r.out_of } : {}),
          }
          let ok = false
          try { await api.post('/academics/exam_results/', primary); ok = true } catch {}
          if (!ok){
            try { await api.post('/academics/exam_results/', alternate); ok = true } catch {}
          }
          if (!ok){
            retryFailed++
            retryErrors.push({ error: 'Failed to save one row after retry.' })
          }
        }
        const finalFailed = retryFailed
        return { ok: finalFailed === 0, failed: finalFailed, errors: finalFailed ? errors.slice(0, 10) : [] }
      }
    } catch (e) {
      // ignore and try fallback
    }
    // Fallback: send individually to a non-bulk endpoint with alternate field names
    let failed = 0
    const errors = []
    for (const r of rows){
      const primary = {
        exam: r.exam,
        subject: r.subject,
        student: r.student,
        marks: r.marks,
        ...(r.component ? { component: r.component } : {}),
        ...(r.out_of ? { out_of: r.out_of } : {}),
      }
      const alternate = {
        exam_id: r.exam,
        subject_id: r.subject,
        student_id: r.student,
        score: r.marks,
        ...(r.component ? { component_id: r.component } : {}),
        ...(r.out_of ? { out_of: r.out_of } : {}),
      }
      let ok = false
      try { await api.post('/academics/exam_results/', primary); ok = true } catch {}
      if (!ok){
        try { await api.post('/academics/exam_results/', alternate); ok = true } catch {}
      }
      if (!ok){
        failed++
        errors.push({ error: 'Failed to save one row.' })
      }
    }
    return { ok: failed === 0, failed, errors }
  }

  const percentToMarks = (pct, out) => {
    const p = Number(String(pct).toString().replace(/%/g,'').trim())
    const o = Number(out || examMeta.total_marks || 100)
    if (Number.isNaN(p) || Number.isNaN(o) || o <= 0) return ''
    return String(Math.round((p/100) * o))
  }

  // Convert stored marks back to percentage string for display when inputAs === 'percent'
  const marksToPercent = (marksValue, out) => {
    const v = Number(marksValue)
    const o = Number(out || examMeta.total_marks || 100)
    if (Number.isNaN(v) || Number.isNaN(o) || o <= 0) return ''
    // Return numeric percentage without % sign, rounded to nearest integer for input friendliness
    return String(Math.round((v / o) * 100))
  }

  // Normalize values fetched from server that were incorrectly saved as percentages (out of 100)
  // If a value is far larger than the expected Out Of but <= 100, treat it as a percent and convert back to marks.
  const normalizeStoredMark = (val, out) => {
    const raw = Number(val)
    const o = Number(out || examMeta.total_marks || 100)
    if (Number.isNaN(raw) || Number.isNaN(o) || o <= 0) return ''
    // Heuristic: if raw > 1.25 * out but <= 100, interpret as percentage
    if (raw > (o * 1.25) && raw <= 100){
      return Math.round((raw / 100) * o)
    }
    return Math.round(raw)
  }

  // Helper: combined percentage across all selected components for a student
  const toCombinedPercent = (studentId) => {
    if (!Array.isArray(components) || components.length === 0) return ''
    let sumMarks = 0
    let sumOut = 0
    for (const c of components){
      const v = Number((marksAll?.[c.id]?.[studentId]) ?? '')
      const out = Number(outOfPerComp?.[c.id] ?? examMeta.total_marks ?? 100)
      if (!Number.isNaN(v) && !Number.isNaN(out) && out > 0){
        sumMarks += v
        sumOut += out
      }
    }
    if (sumOut <= 0) return ''
    return `${Math.round((sumMarks / sumOut) * 1000) / 10}%`
  }

  // Upload UI state
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [commitUploading, setCommitUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Open the exam details form as a modal automatically on mobile
  useEffect(()=>{
    try{
      const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 767px)') : null
      const openIfMobile = () => setFormModalOpen(Boolean(mq && mq.matches))
      openIfMobile()
      if (mq && mq.addEventListener){ mq.addEventListener('change', openIfMobile) }
      else if (mq && mq.addListener){ mq.addListener(openIfMobile) }
      return () => {
        if (mq && mq.removeEventListener){ mq.removeEventListener('change', openIfMobile) }
        else if (mq && mq.removeListener){ mq.removeListener(openIfMobile) }
      }
    }catch{}
  }, [])

  const getMySubjectsFromClass = (klassObj, meObj) => {
    if (!klassObj) return []
    const all = Array.isArray(klassObj.subjects) ? klassObj.subjects : []
    if (!meObj) return all
    const myId = String(meObj.id)
    // If mapping present, intersect with it
    if (Array.isArray(klassObj.subject_teachers) && klassObj.subject_teachers.length){
      const allowedIds = new Set(
        klassObj.subject_teachers
          .filter(st => String(st?.teacher || st?.teacher_detail?.id || '') === myId)
          .map(st => String(st?.subject || st?.subject_id || st?.subject_detail?.id || ''))
          .filter(Boolean)
      )
      if (allowedIds.size){
        return all.filter(s => allowedIds.has(String(s.id)))
      }
    }
    // Fallback: if teacher is class teacher and no mapping, allow all
    if (String(klassObj.teacher) === myId) return all
    // Otherwise none
    return []
  }

  // Download upload template CSV for the selected exam/subject/component
  const downloadTemplate = async () => {
    try{
      setUploadError('')
      const examId = Number(selectedExamId)
      const subjectId = Number(selectedSubject)
      if (!examId || !subjectId) throw new Error('Select Exam and Subject first')
      const componentId = selectedComponentId ? Number(selectedComponentId) : undefined
      const params = new URLSearchParams({ exam: String(examId), subject: String(subjectId) })
      if (componentId) params.append('component', String(componentId))
      const res = await api.get(`/academics/exam_results/upload-template/?${params.toString()}`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `upload_template_exam${examId}_subject${subjectId}${componentId?`_comp${componentId}`:''}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      showSuccess('Template downloaded', 'Roster CSV generated.', 2500)
    }catch(e){
      const msg = e?.response?.data?.detail || e?.message || 'Failed to download template'
      setUploadError(msg)
      showError('Download failed', msg, 4000)
    }
  }

  // Preview upload
  const previewUpload = async () => {
    try{
      setUploading(true)
      setUploadError('')
      const examId = Number(selectedExamId)
      const subjectId = Number(selectedSubject)
      if (!examId || !subjectId) throw new Error('Select Exam and Subject first')
      if (!uploadFile) throw new Error('Choose a file or photo to upload')
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('exam', String(examId))
      form.append('subject', String(subjectId))
      if (selectedComponentId) form.append('component', String(selectedComponentId))
      // If teacher set Out Of, pass to scale
      const out = entryMode === 'single' ? outOf : ''
      if (out) form.append('out_of', String(out))
      form.append('commit', 'false')
      // Temporary: request backend to include OCR debug info for images
      form.append('debug', 'true')
      const res = await api.post('/academics/exam_results/upload/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const data = res?.data || {}
      const rows = Array.isArray(data.rows) ? data.rows : []
      if (data.ocr_lines) {
        try { console.debug('OCR lines sample:', data.ocr_lines.slice(0, 12)) } catch {}
      }
      // Populate existing inputs with the preview's scaled marks
      if (entryMode === 'single'){
        const next = { ...marks }
        rows.forEach(r => {
          const sid = Number(r.student)
          const val = r.scaled_marks
          const intVal = (val == null || val === '') ? '' : Math.round(Number(val))
          if (!isNaN(sid) && val != null) next[sid] = String(intVal)
        })
        setMarks(next)
      } else {
        // All mode: if a specific component is selected, fill only that component's column
        if (selectedComponentId){
          const compId = Number(selectedComponentId)
          const nextAll = { ...(marksAll||{}) }
          const col = { ...(nextAll[compId]||{}) }
          rows.forEach(r => {
            const sid = Number(r.student)
            const val = r.scaled_marks
            const intVal = (val == null || val === '') ? '' : Math.round(Number(val))
            if (!isNaN(sid) && val != null) col[sid] = String(intVal)
          })
          nextAll[compId] = col
          setMarksAll(nextAll)
        }
      }
      const matched = rows.filter(r => r.student && !r.error).length
      const total = rows.length
      const failed = total - matched
      showSuccess('Preview applied', `Filled ${matched}/${total} rows into the table${failed?` (${failed} unmatched/invalid)`:''}.`, 3500)
      if (total === 0 && (data.ocr_lines || data.ocr_text)){
        showError('OCR found no rows', 'Open DevTools > Console to see OCR lines. Adjust screenshot (crop, higher contrast, show Name and Marks per row).', 6000)
      }
    }catch(e){
      let msg = e?.response?.data?.detail
      if (!msg && e?.response?.data){
        try{ msg = JSON.stringify(e.response.data) }catch{}
      }
      if (!msg) msg = e?.message || 'Upload failed'
      setUploadError(msg)
      showError('Upload failed', msg, 5000)
    } finally {
      setUploading(false)
    }
  }

  // Commit upload
  const commitUpload = async () => {
    try{
      setCommitUploading(true)
      setUploadError('')
      const examId = Number(selectedExamId)
      const subjectId = Number(selectedSubject)
      if (!examId || !subjectId) throw new Error('Select Exam and Subject first')
      if (!uploadFile) throw new Error('Choose a file or photo to upload')
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('exam', String(examId))
      form.append('subject', String(subjectId))
      if (selectedComponentId) form.append('component', String(selectedComponentId))
      const out = entryMode === 'single' ? outOf : ''
      if (out) form.append('out_of', String(out))
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
      // Refresh table values after commit
      try{ await submit() } catch {}
      setUploadFile(null)
    }catch(e){
      const msg = e?.response?.data?.detail || e?.message || 'Commit failed'
      setUploadError(msg)
      showError('Commit failed', msg, 5000)
    } finally {
      setCommitUploading(false)
    }
  }

  // All-mode change handler
  const handleMarkChangeAll = (compId, studentId, raw) => {
    const total = Number(outOfPerComp[compId]) || Number(examMeta.total_marks) || 100
    // Convert if entering percentage
    const toStore = (inputAs === 'percent') ? percentToMarks(raw, total) : String(raw)
    setMarksAll(prev => ({
      ...prev,
      [compId]: { ...(prev[compId]||{}), [studentId]: toStore }
    }))
    const numCheck = (inputAs === 'percent') ? Number(String(raw).toString().replace(/%/g,'')) : Number(raw)
    const limit = (inputAs === 'percent') ? 100 : total
    const bad = raw !== '' && (Number.isNaN(numCheck) || numCheck < 0 || numCheck > limit)
    setInvalidAll(prev => ({
      ...prev,
      [compId]: { ...(prev[compId]||{}), [studentId]: bad }
    }))
    if (bad) {
      const unit = inputAs==='percent' ? '%' : total
      showError('Invalid input', `Value must be between 0 and ${unit}.`, 3000)
    }
  }

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        const [cls, meRes] = await Promise.all([
          api.get('/academics/classes/mine/'),
          api.get('/auth/me/'),
        ])
        if (!mounted) return
        setClasses(cls.data || [])
        if (meRes?.data) setMe(meRes.data)
        // derive subjects from first class
        const firstClass = (cls.data||[])[0]
        if (firstClass){
          setSelectedClass(String(firstClass.id))
          const classSubjects = getMySubjectsFromClass(firstClass, meRes?.data)
          setSubjects(classSubjects)
          if (classSubjects.length>0) setSelectedSubject(String(classSubjects[0].id))
        }
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
    })()
    return ()=>{ mounted = false }
  },[])

  useEffect(()=>{
    if (!selectedClass) return
    let mounted = true
    ;(async ()=>{
      try{
        setStudentsLoading(true)
        const studentsPromise = api.get(`/academics/students/?klass=${selectedClass}`)
        const loadExams = async () => {
          if (examsCacheRef.current[String(selectedClass)]){
            return examsCacheRef.current[String(selectedClass)]
          }
          setExamsLoading(true)
          const withTimeout = (p, ms) => Promise.race([
            p,
            new Promise((_, rej)=> setTimeout(()=>rej(new Error('timeout')), ms))
          ])
          const fetchAll = async (url) => {
            let out = []
            let next = url
            let guard = 0
            while (next && guard < 20){
              const r = await withTimeout(api.get(next), 7000)
              const d = r?.data
              if (Array.isArray(d)) { out = d; break }
              if (d && Array.isArray(d.results)) { out = out.concat(d.results); next = d.next; guard++; continue }
              break
            }
            return out
          }
          const attempts = [
            `/academics/exams/?published=false&klass=${encodeURIComponent(selectedClass)}&page_size=1000`,
            `/academics/exams/?klass=${encodeURIComponent(selectedClass)}&page_size=1000`,
            `/academics/exams/?published=false&page_size=1000`,
            `/academics/exams/?include_history=true&page_size=1000`,
            `/academics/exams/?page_size=1000`,
            `/academics/exams/`,
          ]
          let list = []
          for (const url of attempts){
            try{
              const arr = await fetchAll(url)
              if (arr && arr.length){ list = list.concat(arr) }
            }catch{}
          }
          const getKlassId = (e)=>{
            const k = e?.klass ?? e?.class ?? e?.klass_id ?? e?.class_id
            if (typeof k === 'object' && k) return String(k.id ?? k.klass ?? k.pk ?? k.ID ?? '')
            return String(k ?? '')
          }
          const isUnpublished = (e)=>{
            // Consider multiple backend conventions
            if (typeof e?.published === 'boolean') return e.published === false
            if (typeof e?.is_published === 'boolean') return e.is_published === false
            const statusStr = String(e?.status || e?.state || '').toLowerCase()
            if (statusStr) return statusStr !== 'published' && statusStr !== 'complete' && statusStr !== 'final'
            // If no explicit field, treat as unpublished unless there's a published_at timestamp
            if (e?.published_at) return false
            return true
          }
          const byId = new Map()
          ;(list||[]).forEach(e=>{ if (e && e.id != null) byId.set(e.id, e) })
          const all = Array.from(byId.values())
          const unpublished = all.filter(isUnpublished)
          // Prioritize current class but include all unpublished so user can still pick
          const prioritized = unpublished.sort((a,b)=>{
            const ak = getKlassId(a) === String(selectedClass) ? 0 : 1
            const bk = getKlassId(b) === String(selectedClass) ? 0 : 1
            if (ak !== bk) return ak - bk
            const ad = String(a.date||'')
            const bd = String(b.date||'')
            return bd.localeCompare(ad)
          })
          examsCacheRef.current[String(selectedClass)] = prioritized
          setExamsLoading(false)
          return prioritized
        }
        const [studentsRes, examsList] = await Promise.allSettled([studentsPromise, loadExams()])
        if (!mounted) return
        if (studentsRes.status === 'fulfilled'){
          const res = studentsRes.value
          const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
          setStudents(arr)
          const init = {}
          arr.forEach(s => { init[s.id] = '' })
          setMarks(init)
          const current = classes.find(c => String(c.id)===String(selectedClass))
          if (current) {
            const mine = getMySubjectsFromClass(current, me)
            setSubjects(mine)
            if (mine.length && !mine.find(s=> String(s.id)===String(selectedSubject))){
              setSelectedSubject(String(mine[0].id))
            }
          }
        }
        if (examsList.status === 'fulfilled'){
          const filtered = examsList.value || []
          setExams(filtered)
          const first = filtered[0]
          setSelectedExamId(first?.id ? String(first.id) : '')
          if (first?.total_marks) setExamMeta(m=>({...m, total_marks: Number(first.total_marks)}))
        }
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
      finally { if (mounted) setStudentsLoading(false) }
    })()
    return ()=>{ mounted = false }
  }, [selectedClass, examsReloadKey])

  // Load existing results for selected exam and subject; prefill marks (overlay, non-destructive)
  useEffect(()=>{
    const examId = Number(selectedExamId)
    const subjectId = Number(selectedSubject)
    const compId = Number(selectedComponentId)
    if (!examId || !subjectId || students.length === 0) return
    let alive = true
    ;(async ()=>{
      try{
        // handle possible pagination or array response
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
        if (entryMode === 'single'){
          const urls = []
          const base1 = `/academics/exam_results/?exam=${examId}&subject=${subjectId}`
          urls.push(base1)
          if (compId) urls.push(`${base1}&component=${compId}`)
          // include class filters
          urls.push(`/academics/exam_results/?exam=${examId}&subject=${subjectId}&klass=${selectedClass}`)
          urls.push(`/academics/exam_results/?exam=${examId}&subject=${subjectId}&class=${selectedClass}`)
          urls.push(`/academics/exam_results/?exam=${examId}&subject=${subjectId}&klass_id=${selectedClass}`)
          urls.push(`/academics/exam_results/?exam=${examId}&subject=${subjectId}&class_id=${selectedClass}`)
          if (compId){
            urls.push(`/academics/exam_results/?exam=${examId}&subject=${subjectId}&component=${compId}&klass=${selectedClass}`)
            urls.push(`/academics/exam_results/?exam=${examId}&subject=${subjectId}&component=${compId}&class=${selectedClass}`)
          }
          // alternative param names
          const base2 = `/academics/exam_results/?exam_id=${examId}&subject_id=${subjectId}`
          urls.push(base2)
          if (compId) urls.push(`${base2}&component_id=${compId}`)
          // also exam only as a last resort
          urls.push(`/academics/exam_results/?exam=${examId}`)
          let list = []
          for (const u of urls){
            try{
              const part = await fetchAll(u)
              if (Array.isArray(part) && part.length) { list = part; break }
            }catch{}
          }
          // final fallback: exam-only then filter to current class students
          if (!list.length){
            try{
              const part = await fetchAll(`/academics/exam_results/?exam=${examId}`)
              const allowed = new Set(students.map(s=>s.id))
              list = part.filter(r=> allowed.has((r?.student ?? r?.student_id ?? r?.student_detail?.id)))
            }catch{}
          }
          // If we got rows, filter locally by selected subject/component if fields differ
          if (list.length){
            const subjObj = subjects.find(s=> String(s.id)===String(subjectId)) || {}
            const subjCode = (subjObj.code||'').toLowerCase()
            const subjName = (subjObj.name||'').toLowerCase()
            const compIdStr = compId ? String(compId) : ''
            list = list.filter(r => {
              const sid = r?.subject ?? r?.subject_id ?? r?.subject_detail?.id
              const scode = (r?.subject_code || r?.subject_detail?.code || '').toLowerCase()
              const sname = (r?.subject_name || r?.subject_detail?.name || '').toLowerCase()
              const comp = r?.component ?? r?.component_id ?? r?.component_detail?.id
              const subjectOk = sid ? String(sid)===String(subjectId) : (scode? scode===subjCode : (sname? sname===subjName : true))
              const compOk = compId ? (comp ? String(comp)===compIdStr : true) : true
              return subjectOk && compOk
            })
          }
          // If no matches, clear to blanks. Else overlay values.
          if (alive){
            if (!list.length){
              const empty = {}
              students.forEach(s=>{ empty[s.id] = '' })
              setMarks(empty)
            } else {
              setMarks(prev => {
                const next = { ...prev }
                // Start from blanks to avoid stale values
                students.forEach(s=>{ next[s.id] = '' })
                list.forEach(r=>{
                  if (!r) return
                  const sid = r.student ?? r.student_id ?? (r.student_detail?.id)
                  if (sid != null){
                    const val = r.marks ?? r.score ?? r.value
                    if (val != null) next[sid] = normalizeStoredMark(val, outOf)
                  }
                })
                return next
              })
              try { showSuccess('Loaded saved marks', `Prefilled ${list.length} entries from server.`, 2500) } catch {}
            }
          }
        } else {
          // all mode: fetch per component
          const comps = components
          const nextMarksAll = { ...(marksAll||{}) }
          for (const c of comps){
            const urls = [
              `/academics/exam_results/?exam=${examId}&subject=${subjectId}&component=${c.id}`,
              `/academics/exam_results/?exam=${examId}&subject=${subjectId}&component=${c.id}&klass=${selectedClass}`,
              `/academics/exam_results/?exam=${examId}&subject=${subjectId}&component=${c.id}&class=${selectedClass}`,
              `/academics/exam_results/?exam_id=${examId}&subject_id=${subjectId}&component_id=${c.id}`,
              `/academics/exam_results/?exam=${examId}&component=${c.id}`,
            ]
            let list = []
            for (const u of urls){
              try{ const part = await fetchAll(u); if (Array.isArray(part) && part.length) { list = part; break } }catch{}
            }
            if (!list.length){
              try{
                const part = await fetchAll(`/academics/exam_results/?exam=${examId}&component=${c.id}`)
                const allowed = new Set(students.map(s=>s.id))
                list = part.filter(r=> allowed.has((r?.student ?? r?.student_id ?? r?.student_detail?.id)))
              }catch{}
            }
            // Filter locally by subject/component
            if (list.length){
              const subjObj = subjects.find(s=> String(s.id)===String(subjectId)) || {}
              const subjCode = (subjObj.code||'').toLowerCase()
              const subjName = (subjObj.name||'').toLowerCase()
              list = list.filter(r => {
                const sid = r?.subject ?? r?.subject_id ?? r?.subject_detail?.id
                const scode = (r?.subject_code || r?.subject_detail?.code || '').toLowerCase()
                const sname = (r?.subject_name || r?.subject_detail?.name || '').toLowerCase()
                const subjectOk = sid ? String(sid)===String(subjectId) : (scode? scode===subjCode : (sname? sname===subjName : true))
                const comp = r?.component ?? r?.component_id ?? r?.component_detail?.id
                const compOk = comp ? String(comp)===String(c.id) : true
                return subjectOk && compOk
              })
            }
            // Build map: if no matches for this component, set all blanks for that component
            if (!list.length){
              const blankCol = {}
              students.forEach(s=>{ blankCol[s.id] = '' })
              nextMarksAll[c.id] = blankCol
            } else {
              const map = {}
              students.forEach(s=>{ map[s.id] = '' })
              list.forEach(r=>{
                if (!r) return
                const sid = r.student ?? r.student_id ?? (r.student_detail?.id)
                if (sid != null){
                  const val = r.marks ?? r.score ?? r.value
                  if (val != null) map[sid] = normalizeStoredMark(val, outOfPerComp[c.id])
                }
              })
              nextMarksAll[c.id] = map
            }
          }
          if (alive) setMarksAll(nextMarksAll)
        }
        try { console.debug('TeacherGrades prefill', { examId, subjectId, compId, countSingle: entryMode==='single' ? undefined : null }) } catch {}
      }catch(e){ /* silent prefill failure */ }
    })()
    return ()=>{ alive = false }
  }, [selectedExamId, selectedSubject, selectedComponentId, students, entryMode, components, marksReloadKey])

  // Load subject components (papers) when subject changes
  useEffect(()=>{
    const subjectId = Number(selectedSubject)
    if (!subjectId) { setComponents([]); setSelectedComponentId(''); return }
    let alive = true
    ;(async ()=>{
      try{
        const res = await api.get(`/academics/subject_components/?subject=${subjectId}`)
        const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
        if (!alive) return
        setComponents(arr)
        // default select first component if exists; else clear component selection
        const first = arr[0]
        setSelectedComponentId(first?.id ? String(first.id) : '')
        // Build defaults then overlay saved preferences
        const defaults = {}
        for (const c of arr){
          defaults[c.id] = (c.max_marks != null) ? Number(c.max_marks) : (Number(examMeta.total_marks)||100)
        }
        const saved = loadOutOfPrefs()
        const merged = { ...defaults, ...(saved||{}) }
        setOutOfPerComp(merged)
        const firstOut = first ? (merged[first.id] ?? defaults[first.id]) : (Number(examMeta.total_marks)||100)
        setOutOf(String(firstOut))
        const emptyMarksAll = {}
        const emptyInvalidAll = {}
        for (const c of arr){
          const m = {}; const iv = {}
          students.forEach(s=>{ m[s.id]=''; iv[s.id]=false })
          emptyMarksAll[c.id] = m
          emptyInvalidAll[c.id] = iv
        }
        setMarksAll(emptyMarksAll)
        setInvalidAll(emptyInvalidAll)
      }catch{
        setComponents([])
        setSelectedComponentId('')
        setOutOf(String(Number(examMeta.total_marks)||100))
        setOutOfPerComp({})
        setMarksAll({})
        setInvalidAll({})
      }
    })()
    return ()=>{ alive = false }
  }, [selectedSubject])

  // Update default outOf when component or exam total changes
  useEffect(()=>{
    const comp = components.find(c => String(c.id)===String(selectedComponentId))
    if (!comp){
      const fallback = Number(examMeta.total_marks)||100
      setOutOf(String(fallback))
      return
    }
    const saved = loadOutOfPrefs()
    const val = (saved && saved[comp.id] != null) ? Number(saved[comp.id]) : (comp.max_marks != null ? Number(comp.max_marks) : (Number(examMeta.total_marks)||100))
    setOutOf(String(val))
  }, [selectedComponentId, examMeta.total_marks])

  // Persist per-component Out Of whenever user edits values in All mode
  useEffect(()=>{
    if (!Array.isArray(components) || components.length === 0) return
    const current = loadOutOfPrefs()
    let changed = false
    for (const c of components){
      const v = outOfPerComp[c.id]
      if (v != null && v !== '' && String(current[c.id]||'') !== String(v)){
        current[c.id] = v
        changed = true
      }
    }
    if (changed) saveOutOfPrefs(current)
  }, [outOfPerComp, components, selectedClass, selectedSubject, selectedExamId])

  // When editing Out Of in single mode, keep preference in sync
  useEffect(()=>{
    const compId = Number(selectedComponentId)
    if (!compId) return
    if (outOf == null || outOf === '') return
    const current = loadOutOfPrefs()
    const nv = Number(outOf)
    if (!Number.isNaN(nv) && String(current[compId]||'') !== String(nv)){
      current[compId] = nv
      saveOutOfPrefs(current)
    }
  }, [outOf, selectedComponentId, selectedClass, selectedSubject, selectedExamId])

  // Re-validate all marks when outOf changes and notify immediately if any exceed
  useEffect(()=>{
    const total = Number(outOf) || Number(examMeta.total_marks) || 100
    const nextInvalid = {}
    let anyNewInvalid = false
    for (const s of students){
      const v = marks[s.id]
      if (v !== '' && v != null){
        const num = Number(v)
        const bad = Number.isNaN(num) || num < 0 || num > total
        nextInvalid[s.id] = bad
        if (bad && !invalid[s.id]) anyNewInvalid = true
      } else {
        nextInvalid[s.id] = false
      }
    }
    setInvalid(nextInvalid)
    if (anyNewInvalid){
      showError('Marks exceed limit', `One or more entries exceed the "Marks Out Of" value (${total}).`, 4000)
    }
  }, [outOf])

  // Re-validate all-mode when outOfPerComp changes
  useEffect(()=>{
    if (entryMode !== 'all') return
    let alerted = false
    const nextInvalidAll = {}
    for (const c of components){
      const total = Number(outOfPerComp[c.id]) || Number(examMeta.total_marks) || 100
      const iv = {}
      const m = marksAll[c.id] || {}
      for (const s of students){
        const v = m[s.id]
        if (v !== '' && v != null){
          const num = Number(v)
          const bad = Number.isNaN(num) || num < 0 || num > total
          iv[s.id] = bad
          if (bad && !alerted){
            alerted = true
            showError('Marks exceed limit', `Some entries exceed the "Out Of" for ${c.name} (${total}).`, 4000)
          }
        } else {
          iv[s.id] = false
        }
      }
      nextInvalidAll[c.id] = iv
    }
    setInvalidAll(nextInvalidAll)
  }, [outOfPerComp, entryMode, components, marksAll, students])

  // Handle change with immediate validation and feedback
  const handleMarkChange = (studentId, raw) => {
    const total = Number(outOf) || Number(examMeta.total_marks) || 100
    const toStore = (inputAs === 'percent') ? percentToMarks(raw, total) : String(raw)
    setMarks(m => ({ ...m, [studentId]: toStore }))
    let isInvalid = false
    if (raw !== '' && raw !== null && typeof raw !== 'undefined'){
      const numCheck = (inputAs === 'percent') ? Number(String(raw).toString().replace(/%/g,'')) : Number(raw)
      const limit = (inputAs === 'percent') ? 100 : total
      if (Number.isNaN(numCheck) || numCheck < 0 || numCheck > limit){
        isInvalid = true
      }
    }
    setInvalid(prev => {
      const next = { ...prev, [studentId]: isInvalid }
      return next
    })
    // Notify immediately when value first becomes invalid
    if (isInvalid && !invalid[studentId]){
      const unit = inputAs==='percent' ? '%' : total
      showError('Invalid input', `Value must be between 0 and ${unit}.`, 3000)
    }

    // Debounced auto-save for valid inputs
    if (!isInvalid){
      const t = saveTimersRef.current[studentId]
      if (t) clearTimeout(t)
      saveTimersRef.current[studentId] = setTimeout(async () => {
        try{
          const examId = Number(selectedExamId)
          const subjectId = Number(selectedSubject)
          const componentId = selectedComponentId ? Number(selectedComponentId) : undefined
          const out = outOf ? Number(outOf) : undefined
          const base = (inputAs === 'percent') ? percentToMarks(raw, out || examMeta.total_marks || 100) : String(raw)
          const num = Math.round(Number(base))
          if (!examId || !subjectId || Number.isNaN(num)) return
          const item = { exam: examId, subject: subjectId, student: studentId, marks: num }
          if (componentId) item.component = componentId
          if (out) item.out_of = out
          await saveResults([item])
        }catch(e){
          let msg = e?.response?.data?.detail
          if (!msg && e?.response?.data){
            try{ msg = JSON.stringify(e.response.data) }catch{}
          }
          showError('Auto-save failed', msg || 'Could not save mark', 4000)
        }
      }, 600)
    }
  }

  const nudge = (studentId, delta) => {
    const total = Number(outOf) || Number(examMeta.total_marks) || 100
    const curr = Number(marks[studentId] || 0)
    const base = Number.isNaN(curr) ? 0 : curr
    let next = base + delta
    if (next < 0) next = 0
    if (next > total) next = total
    handleMarkChange(studentId, String(next))
  }

  // Keep controls panel visible until the user explicitly hides it
  useEffect(()=>{
    // No auto-collapse behavior
  }, [selectedClass, selectedSubject, selectedExamId])

  // ---------- Draft persistence (localStorage) ----------
  const draftKey = () => {
    const parts = [
      'teachergrades',
      `c:${selectedClass||''}`,
      `s:${selectedSubject||''}`,
      `e:${selectedExamId||''}`,
      `m:${entryMode}`,
      entryMode==='single' ? `p:${selectedComponentId||''}` : 'all'
    ]
    return parts.join('|')
  }

  // Save drafts whenever marks change
  useEffect(()=>{
    try{
      if (!selectedClass || !selectedSubject || !selectedExamId) return
      const key = draftKey()
      const payload = {
        when: Date.now(),
        entryMode,
        inputAs,
        outOf,
        outOfPerComp,
        marks,
        marksAll,
      }
      localStorage.setItem(key, JSON.stringify(payload))
    }catch{}
  }, [marks, marksAll, outOf, outOfPerComp, inputAs, entryMode, selectedClass, selectedSubject, selectedExamId])

  // Restore drafts after server prefill
  useEffect(()=>{
    try{
      if (!students.length || !selectedClass || !selectedSubject || !selectedExamId) return
      const raw = localStorage.getItem(draftKey())
      if (!raw) return
      const data = JSON.parse(raw)
      if (!data || typeof data !== 'object') return
      // Only overlay same entry mode
      if (data.entryMode === 'single'){
        if (data.marks && typeof data.marks === 'object'){
          setMarks(prev => ({ ...prev, ...data.marks }))
        }
        if (data.outOf) setOutOf(String(data.outOf))
        if (data.inputAs) setInputAs(data.inputAs)
      } else {
        if (data.marksAll && typeof data.marksAll === 'object'){
          setMarksAll(prev => ({ ...prev, ...data.marksAll }))
        }
        if (data.outOfPerComp && typeof data.outOfPerComp === 'object'){
          setOutOfPerComp(prev => ({ ...prev, ...data.outOfPerComp }))
        }
        if (data.inputAs) setInputAs(data.inputAs)
      }
    }catch{}
  }, [students, selectedClass, selectedSubject, selectedExamId])

  const submit = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try{
      // Block submit if any invalid values exist
      if (entryMode === 'single'){
        const anyBad = Object.values(invalid || {}).some(Boolean)
        if (anyBad) throw new Error('Fix invalid marks (out of range) before saving.')
      } else {
        const anyBad = Object.values(invalidAll || {}).some(map => Object.values(map || {}).some(Boolean))
        if (anyBad) throw new Error('Fix invalid marks (out of range) before saving.')
      }
      // require an existing, unpublished exam selected
      const examId = Number(selectedExamId)
      if (!examId) throw new Error('Select an exam to save results to')
      // post results for each student having a numeric mark
      const subjectId = Number(selectedSubject)
      let payload = []
      if (entryMode === 'single'){
        const componentId = selectedComponentId ? Number(selectedComponentId) : undefined
        const out = outOf ? Number(outOf) : undefined
        payload = students
          .map(s => ({ student: s.id, value: parseFloat(marks[s.id]) }))
          .filter(x => !isNaN(x.value))
          .map(x => {
            const item = { exam: examId, subject: subjectId, student: x.student, marks: Math.round(x.value) }
            if (componentId) item.component = componentId
            if (out) item.out_of = out
            return item
          })
      } else {
        // all mode: flatten over components
        for (const c of components){
          const compId = Number(c.id)
          const out = Number(outOfPerComp[compId] || examMeta.total_marks || 100)
          const compMarks = marksAll[compId] || {}
          for (const s of students){
            const v = parseFloat(compMarks[s.id])
            if (!isNaN(v)){
              payload.push({ exam: examId, subject: subjectId, component: compId, student: s.id, marks: Math.round(v), out_of: out })
            }
          }
        }
      }
      if (payload.length === 0) throw new Error('Enter at least one mark to save')
      const { failed, errors } = await saveResults(payload)
      if (failed === 0){
        setMessage('Grades saved.')
        showSuccess('Grades saved', 'All valid marks were saved.', 4000)
      } else {
        const errs = Array.isArray(errors) ? errors : []
        const detail = errs.length ? errs.slice(0,3).map(e => typeof e?.error==='string' ? e.error : JSON.stringify(e?.error||'Failed')).join(' | ') : 'Some rows failed to save.'
        setMessage('Some grades could not be saved.')
        showError('Partial save', `${failed} failed. ${detail}${errs.length>3?' ...':''}`, 6000)
      }
      // Refresh marks from server to reflect canonical values
      try{
        if (entryMode === 'single'){
          const componentId = selectedComponentId ? Number(selectedComponentId) : undefined
          const base = `/academics/exam_results/?exam=${examId}&subject=${subjectId}`
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
          const list = await fetchAll(componentId ? `${base}&component=${componentId}` : base)
          // Start from existing values; only overlay those returned by server
          const next = { ...marks }
          list.forEach(r=>{
            if (!r) return
            const sid = r.student ?? r.student_id ?? (r.student_detail?.id)
            if (sid != null){
              const val = r.marks ?? r.score ?? r.value
              if (val != null) next[sid] = Math.round(Number(val))
            }
          })
          setMarks(next)
        } else {
          // refresh per component
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
          const nextMarksAll = {}
          for (const c of components){
            const url = `/academics/exam_results/?exam=${examId}&subject=${subjectId}&component=${c.id}`
            const list = await fetchAll(url)
            const map = {}
            students.forEach(s=>{ map[s.id] = '' })
            list.forEach(r=>{
              if (r && r.student != null){
                const raw = r.marks
                map[r.student] = normalizeStoredMark(raw, outOfPerComp[c.id])
              }
            })
            nextMarksAll[c.id] = map
          }
          setMarksAll(nextMarksAll)
        }
      }catch{}
      // Clear draft after successful save
      try { localStorage.removeItem(draftKey()) } catch {}
    }catch(e){
      // Prefer detailed backend validation errors
      let msg = e?.response?.data?.detail
      if (!msg && e?.response?.data && typeof e.response.data === 'object'){
        try{
          const parts = []
          for (const [k,v] of Object.entries(e.response.data)){
            if (typeof v === 'string') parts.push(`${k}: ${v}`)
            else if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`)
            else parts.push(`${k}: ${JSON.stringify(v)}`)
          }
          if (parts.length) msg = parts.join(' | ')
        }catch{}
      }
      if (!msg) msg = e?.message || 'Failed to save grades'
      setError(msg)
      showError('Save failed', msg, 5000)
    }
    finally{ setSaving(false) }
  }

  const canSubmit = useMemo(()=> {
    const classOk = Boolean(selectedClass)
    const subjectOk = Boolean(selectedSubject)
    const examOk = Boolean(selectedExamId)
    const list = Array.isArray(students) ? students : []
    if (!classOk || !subjectOk || !examOk || list.length === 0) return false
    if (entryMode === 'single'){
      const anyValue = list.some(s => !isNaN(parseFloat(marks[s.id])))
      const hasInvalid = Object.values(invalid).some(Boolean)
      return anyValue && !hasInvalid
    }
    // entryMode === 'all': check across all components
    const comps = Array.isArray(components) ? components : []
    if (comps.length === 0) return false
    let anyValue = false
    for (const c of comps){
      const col = marksAll?.[c.id] || {}
      if (list.some(s => !isNaN(parseFloat(col[s.id])))) { anyValue = true; break }
    }
    if (!anyValue) return false
    // any invalid cell?
    for (const c of comps){
      const iv = invalidAll?.[c.id] || {}
      if (Object.values(iv).some(Boolean)) return false
    }
    return true
  }, [selectedClass, selectedSubject, selectedExamId, students, entryMode, marks, invalid, components, marksAll, invalidAll])

  const openPreview = async () => {
    if (!selectedExamId) return
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewError('')
    setPreviewSummary(null)
    try{
      const { data } = await api.get(`/academics/exams/${selectedExamId}/summary/`)
      setPreviewSummary(data || null)
    }catch(e){
      setPreviewError(e?.response?.data?.detail || e?.message || 'Failed to load preview')
    }finally{
      setPreviewLoading(false)
    }
  }

  return (
    <div className="teacher-grades-page px-2 md:px-4 lg:px-6 py-3 md:py-4 space-y-3 md:space-y-4 max-w-6xl mx-auto pb-24 md:pb-0 min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-indigo-500 via-indigo-600 to-sky-500 shadow-md">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/15 blur-2" />
        <div className="p-3 md:p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg md:text-xl font-semibold tracking-tight text-white">Input Grades</div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={reloadSavedMarks}
              type="button"
              className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-white/90 text-indigo-700 border border-white/70 hover:bg-white shadow-sm"
            >
              Load Sheet
            </button>
            <span className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-white/90 text-indigo-700 border border-white/70 shadow-sm whitespace-nowrap max-w-[50vw] overflow-hidden text-ellipsis">
              {subjectDisplay} • {examDisplay}
            </span>
          </div>
          <div className="md:hidden flex items-center gap-1.5">
            <button
              onClick={reloadSavedMarks}
              className="text-[11px] px-2.5 py-1.5 rounded-full bg-white text-indigo-700 border border-indigo-200 shadow-sm"
            >
              Load Sheet
            </button>
            <span className="text-[11px] px-2.5 py-1.5 rounded-full bg-white text-indigo-700 border border-indigo-200 shadow-sm whitespace-nowrap max-w-[45vw] overflow-hidden text-ellipsis">
              {subjectDisplay} • {examDisplay}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200">{error}</div>}
      {message && <div className="bg-green-50 text-green-700 p-3 rounded border border-green-200">{message}</div>}

      {/* Mobile-only: full controls in modal */}
      <Modal open={formModalOpen} onClose={()=>setFormModalOpen(false)} title="Exam Details" size="sm">
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={()=>setFormModalOpen(false)}
              className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-indigo-900/80 text-white border border-indigo-900/50 hover:bg-indigo-900 shadow-sm"
            >
              Hide Details
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-gray-600">Class</label>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                value={selectedClass}
                onChange={e=>{ setSelectedClass(e.target.value); setControlsOpen(true) }}
              >
                {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-gray-600">Subject</label>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                value={selectedSubject}
                onChange={e=>setSelectedSubject(e.target.value)}
              >
                {subjects.map(s=> <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </div>
            {entryMode === 'single' && (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-gray-600">Paper (Component)</label>
                <select
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                  value={selectedComponentId}
                  onChange={e=>setSelectedComponentId(e.target.value)}
                >
                  {components.length === 0 && <option value="">(No papers) Whole Subject</option>}
                  {components.map(c=> <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-gray-600">Entry Mode</label>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                value={entryMode}
                onChange={e=>setEntryMode(e.target.value)}
              >
                <option value="single">Single Paper</option>
                <option value="all">All Papers</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-gray-600">Input Unit</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={()=>setInputAs(prev => prev === 'percent' ? 'marks' : 'percent')}
                  className={`input-unit-toggle inline-flex items-center rounded-full border px-3 py-1 text-[11px] bg-white hover:bg-gray-50 ${inputAs==='percent' ? 'input-unit-toggle--percent border-gray-200' : 'border-gray-200'}`}
                >
                  {inputAs==='percent' ? 'Percentage (%)' : 'Marks'}
                </button>
                <span className="text-[11px] text-gray-500">Change how you type values</span>
              </div>
            </div>
            {/* Out Of fields removed from modal per request */}
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Exam</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={reloadSavedMarks} className="text-[11px] text-indigo-700 hover:underline">Load Saved</button>
                  <button type="button" onClick={refreshExams} className="text-[11px] text-indigo-700 hover:underline disabled:opacity-60" disabled={examsLoading}>Refresh</button>
                </div>
              </div>
              <select
                className="border p-2 rounded"
                value={selectedExamId}
                disabled={examsLoading}
                onChange={e=>{
                  const val = e.target.value
                  setSelectedExamId(val)
                  const ex = exams.find(x=>String(x.id)===val)
                  if (ex){
                    setExamMeta({
                      name: ex.name,
                      year: ex.year,
                      term: ex.term,
                      date: ex.date,
                      total_marks: Number(ex.total_marks)||100,
                    })
                  }
                }}
              >
                <option value="">{examsLoading ? 'Loading exams…' : 'Select Exam'}</option>
                {exams.map(e=> (
                  <option key={e.id} value={e.id}>{e.name} — T{e.term} — {e.year} — {e.date}</option>
                ))}
              </select>
              {exams.length === 0 && (
                <span className="text-[11px] text-gray-500">No unpublished exams for this class. Ask admin to create one.</span>
              )}
            </div>
          </div>

          {/* Read-only exam details */}
          {selectedExamId && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
              <div className="px-2 py-1 rounded border bg-gray-50">Name: <span className="font-medium text-gray-800 ml-1">{examMeta.name}</span></div>
              <div className="px-2 py-1 rounded border bg-gray-50">Year: <span className="font-medium text-gray-800 ml-1">{examMeta.year}</span></div>
              <div className="px-2 py-1 rounded border bg-gray-50">Term: <span className="font-medium text-gray-800 ml-1">T{examMeta.term}</span></div>
              <div className="px-2 py-1 rounded border bg-gray-50">Date: <span className="font-medium text-gray-800 ml-1">{examMeta.date}</span></div>
            </div>
          )}
        </div>
      </Modal>

      {/* Selection summary when collapsed */}
      {!controlsOpen && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 flex items-center justify-between text-sm sticky top-2 z-20 md:static">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Class: <strong className="ml-1">{(classes.find(c=>String(c.id)===String(selectedClass))||{}).name || selectedClass}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Subject: <strong className="ml-1">{(subjects.find(s=>String(s.id)===String(selectedSubject))||{}).name || selectedSubject}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Exam: <strong className="ml-1">{(exams.find(e=>String(e.id)===String(selectedExamId))||{}).name || selectedExamId}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={reloadSavedMarks} className="text-indigo-700 hover:underline">Load Saved</button>
            <button onClick={()=>setControlsOpen(true)} className="text-indigo-600 text-sm">Change</button>
          </div>
        </div>
      )}

      {/* Controls (shown inline only on md+; on mobile they're inside the modal) */}
      {controlsOpen && (
      <div className="hidden md:block">
      <div className="rounded-2xl border border-gray-100 bg-white/90 backdrop-blur shadow-md p-3 md:p-4 space-y-3 md:space-y-4">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={()=>setControlsOpen(false)}
            className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-indigo-900/80 text-white border border-indigo-900/50 hover:bg-indigo-900 shadow-sm"
          >
            Hide Details
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-gray-600">Class</label>
            <select
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
              value={selectedClass}
              onChange={e=>{ setSelectedClass(e.target.value); setControlsOpen(true) }}
            >
              {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-gray-600">Subject</label>
            <select
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
              value={selectedSubject}
              onChange={e=>setSelectedSubject(e.target.value)}
            >
              {subjects.map(s=> <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          {/* Component (Paper) selector if subject has components */}
          {entryMode === 'single' && (
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-gray-600">Paper (Component)</label>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                value={selectedComponentId}
                onChange={e=>setSelectedComponentId(e.target.value)}
              >
                {components.length === 0 && <option value="">(No papers) Whole Subject</option>}
                {components.map(c=> <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
          )}
          {/* Entry mode */}
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-gray-600">Entry Mode</label>
            <select
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
              value={entryMode}
              onChange={e=>setEntryMode(e.target.value)}
            >
              <option value="single">Single Paper</option>
              <option value="all">All Papers</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-gray-600">Input Unit</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={()=>setInputAs(prev => prev === 'percent' ? 'marks' : 'percent')}
                className={`input-unit-toggle inline-flex items-center rounded-full border px-3 py-1 text-[11px] bg-white hover:bg-gray-50 ${inputAs==='percent' ? 'input-unit-toggle--percent border-gray-200' : 'border-gray-200'}`}
              >
                {inputAs==='percent' ? 'Percentage (%)' : 'Marks'}
              </button>
              <span className="text-[11px] text-gray-500">Change how you type values</span>
            </div>
          </div>
          {/* Out Of input(s) */}
          {entryMode === 'single' ? (
            <div className="grid gap-1">
              <label className="text-xs text-gray-600">Marks Out Of</label>
              <input
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                type="number"
                inputMode="decimal"
                min={1}
                step="1"
                value={outOf}
                onChange={e=>setOutOf(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-1">
              <label className="text-xs text-gray-600">Marks Out Of (per Paper)</label>
              <div className="flex flex-wrap gap-2">
                {components.map(c=> (
                  <div key={c.id} className="flex items-center gap-1 border rounded px-2 py-1">
                    <span className="text-xs text-gray-600">{c.code}</span>
                    <input
                      className="border p-1 rounded w-20 text-right focus:ring-2 focus:ring-indigo-200"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step="1"
                      value={outOfPerComp[c.id] ?? ''}
                      onChange={e=> setOutOfPerComp(prev=>({ ...prev, [c.id]: e.target.value })) }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600">Exam</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={reloadSavedMarks} className="text-[11px] text-indigo-700 hover:underline">Load Saved</button>
                <button type="button" onClick={refreshExams} className="text-[11px] text-indigo-700 hover:underline disabled:opacity-60" disabled={examsLoading}>Refresh</button>
              </div>
            </div>
            <select
              className="border p-2 rounded"
              value={selectedExamId}
              disabled={examsLoading}
              onChange={e=>{
                const val = e.target.value
                setSelectedExamId(val)
                const ex = exams.find(x=>String(x.id)===val)
                if (ex){
                  setExamMeta({
                    name: ex.name,
                    year: ex.year,
                    term: ex.term,
                    date: ex.date,
                    total_marks: Number(ex.total_marks)||100,
                  })
                }
              }}
            >
              <option value="">{examsLoading ? 'Loading exams…' : 'Select Exam'}</option>
              {exams.map(e=> (
                <option key={e.id} value={e.id}>{e.name} — T{e.term} — {e.year} — {e.date}</option>
              ))}
            </select>
            {exams.length === 0 && (
              <span className="text-[11px] text-gray-500">No unpublished exams for this class. Ask admin to create one.</span>
            )}
          </div>
        </div>

        {/* Read-only exam details */}
        {selectedExamId && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
            <div className="px-2 py-1 rounded border bg-gray-50">Name: <span className="font-medium text-gray-800 ml-1">{examMeta.name}</span></div>
            <div className="px-2 py-1 rounded border bg-gray-50">Year: <span className="font-medium text-gray-800 ml-1">{examMeta.year}</span></div>
            <div className="px-2 py-1 rounded border bg-gray-50">Term: <span className="font-medium text-gray-800 ml-1">T{examMeta.term}</span></div>
            <div className="px-2 py-1 rounded border bg-gray-50">Date: <span className="font-medium text-gray-800 ml-1">{examMeta.date}</span></div>
          </div>
        )}

        {/* Upload section */}
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Upload File/Photo for Grade Entry</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={downloadTemplate} className="text-xs px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white">Download Template</button>
            </div>
          </div>
          {uploadError && <div className="bg-red-50 text-red-700 p-2 rounded border border-red-200 text-sm mb-2">{uploadError}</div>}
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <input type="file" accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg,.bmp,.webp,.tif,.tiff" onChange={e=>setUploadFile(e.target.files?.[0]||null)} />
            <div className="flex gap-2">
              <button type="button" onClick={previewUpload} disabled={uploading || !uploadFile || !selectedExamId || !selectedSubject} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white disabled:opacity-60">{uploading ? 'Uploading…' : 'Preview'}</button>
              <button type="button" onClick={commitUpload} disabled={commitUploading || !uploadFile || !selectedExamId || !selectedSubject} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white disabled:opacity-60">{commitUploading ? 'Saving…' : 'Commit'}</button>
            </div>
          </div>
        </div>
      </div>
      </div>
      )}

        {studentsLoading && (
          <div className="mb-3 p-2 rounded-lg border bg-white shadow-sm text-sm text-gray-600 animate-pulse">Loading students…</div>
        )}

        {/* Search Bar */}
        <div className="mb-2 md:mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              placeholder="Search student by name or admission"
              className="w-full md:w-80 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
            />
            <button
              type="button"
              onClick={()=>setSearchQuery(searchQuery)}
              className="px-3 py-2 rounded-xl text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
            >
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={()=>setSearchQuery('')}
                className="px-3 py-2 rounded-xl text-sm bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-xs text-gray-600">
            <span>Total Students: {students.length}</span>
          </div>
        </div>

        {/* Students - mobile list */}
        <div className="md:hidden -mx-1">
          <div className="mb-2 px-1 flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-gray-800">Students</div>
            {entryMode === 'all' && components.length > 0 ? (
              <div className="flex items-center gap-2">
                {components.slice(0,2).map(c => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <label className="text-[11px] text-gray-600" htmlFor={`outof-comp-${c.id}`}>{c.code}</label>
                    <input
                      id={`outof-comp-${c.id}`}
                      className="w-16 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-200"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step="1"
                      value={outOfPerComp[c.id] ?? ''}
                      onChange={e=> setOutOfPerComp(prev=>({ ...prev, [c.id]: e.target.value })) }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-gray-600" htmlFor="outof-inline">Out Of</label>
                <input
                  id="outof-inline"
                  className="w-20 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-200"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="1"
                  value={outOf}
                  onChange={e=>setOutOf(e.target.value)}
                />
              </div>
            )}
          </div>
          {entryMode === 'all' ? (
            <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left w-40">Student</th>
                    {components.map(c => (
                      <th key={c.id} className="px-2 py-2 text-right">{c.code}</th>
                    ))}
                    <th className="px-2 py-2 text-right w-16">%</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st, idx) => (
                    <tr key={st.id} className={idx%2? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium truncate max-w-[160px]">{st.name}</div>
                            <div className="text-[10px] text-gray-500">{st.admission_no}</div>
                          </div>
                        </div>
                      </td>
                      {components.map(c => (
                        <td key={c.id} className="px-2 py-1 text-right">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={inputAs==='percent' ? 100 : (Number(outOfPerComp[c.id])||Number(examMeta.total_marks)||100)}
                            step="1"
                            className={`border px-2 py-1 rounded w-20 text-right focus:ring-2 focus:ring-indigo-200 ${(invalidAll[c.id]?.[st.id]) ? 'border-red-500 bg-red-50' : ''}`}
                            value={inputAs==='percent' ? marksToPercent((marksAll[c.id]?.[st.id]), outOfPerComp[c.id]) : ((marksAll[c.id]?.[st.id]) || '')}
                            onChange={e=>handleMarkChangeAll(c.id, st.id, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right text-[11px] text-gray-700">{toCombinedPercent(st.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map(st => (
                <div key={st.id} className="flex items-center justify-between gap-3 px-3 py-2 border rounded-xl bg-white shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium whitespace-normal break-words">{st.name}</div>
                      <div className="text-[11px] text-gray-500">{st.admission_no}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={inputAs==='percent' ? 100 : (Number(outOf)||Number(examMeta.total_marks)||100)}
                      step="1"
                      className={`border px-2 py-1.5 rounded-lg w-24 text-right focus:ring-2 focus:ring-indigo-200 ${invalid[st.id] ? 'border-red-500 bg-red-50' : ''}`}
                      value={inputAs==='percent' ? marksToPercent(marks[st.id], outOf) : (marks[st.id] || '')}
                      onChange={e=>handleMarkChange(st.id, e.target.value)}
                    />
                    <span className="text-xs text-gray-500 w-14 text-right">{inputAs==='percent' ? '%' : toPercent(marks[st.id], outOf)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="teacher-grades-table-head bg-gradient-to-r from-indigo-50 to-fuchsia-50">
              <tr className="text-gray-700">
                <th className="py-2">Student</th>
                <th className="py-2">Admission</th>
                {entryMode === 'single' ? (
                  <th className="py-2 text-right">Marks</th>
                ) : (
                  components.map(c => (
                    <th key={c.id} className="py-2 text-right">{c.code}</th>
                  ))
                )}
                {entryMode !== 'single' && components.length > 0 && (
                  <th className="py-2 text-right">Percent</th>
                )}
              </tr>
            </thead>
            <tbody>
              {students.map((st, idx) => (
                <tr key={st.id} className={`border-t ${idx%2===0? 'bg-white':'bg-gray-50'}`}>
                  <td className="py-2">{st.name}</td>
                  <td className="py-2">{st.admission_no}</td>
                  {entryMode === 'single' ? (
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={inputAs==='percent' ? 100 : (Number(outOf)||Number(examMeta.total_marks)||100)}
                          step="0.01"
                          className={`border p-2 rounded w-28 text-right focus:ring-2 focus:ring-indigo-200 ${invalid[st.id] ? 'border-red-500 bg-red-50' : ''}`}
                          value={inputAs==='percent' ? marksToPercent(marks[st.id], outOf) : (marks[st.id] || '')}
                          onChange={e=>handleMarkChange(st.id, e.target.value)}
                        />
                        <span className="text-xs text-gray-500 w-16 text-right">{inputAs==='percent' ? '%' : toPercent(marks[st.id], outOf)}</span>
                      </div>
                    </td>
                  ) : (
                    components.map(c => (
                      <td key={c.id} className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={inputAs==='percent' ? 100 : (Number(outOfPerComp[c.id])||Number(examMeta.total_marks)||100)}
                            step="0.01"
                            className={`border p-2 rounded w-24 text-right focus:ring-2 focus:ring-indigo-200 ${(invalidAll[c.id]?.[st.id]) ? 'border-red-500 bg-red-50' : ''}`}
                            value={inputAs==='percent' ? marksToPercent((marksAll[c.id]?.[st.id]), outOfPerComp[c.id]) : ((marksAll[c.id]?.[st.id]) || '')}
                            onChange={e=>handleMarkChangeAll(c.id, st.id, e.target.value)}
                          />
                          <span className="text-xs text-gray-500 w-16 text-right">{inputAs==='percent' ? '%' : toPercent((marksAll[c.id]?.[st.id]) || '', outOfPerComp[c.id])}</span>
                        </div>
                      </td>
                    ))
                  )}
                  {entryMode !== 'single' && components.length > 0 && (
                    <td className="py-2 text-right">
                      <span className="text-xs text-gray-700 font-medium">{toCombinedPercent(st.id)}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Desktop save button */}
        <div className="hidden md:flex justify-end">
          <div className="flex gap-2">
            <button onClick={()=>navigate(`/teacher/admin/enter/${selectedExamId}?readonly=1&klass=${encodeURIComponent(selectedClass||'')}`)} disabled={!selectedExamId} className="px-4 py-2 rounded-lg text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 disabled:opacity-60 shadow-soft">Preview Results</button>
            <button onClick={submit} disabled={saving || !canSubmit} className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 shadow-soft">{saving ? 'Saving...' : 'Save Grades'}</button>
          </div>
        </div>
      

      {/* Sticky mobile save bar */}
      <div className="md:hidden fixed inset-x-0 bottom-14 z-40">
        <div className="mx-auto max-w-4xl px-4 pb-2">
          <div className="rounded-2xl bg-white shadow-xl border border-gray-200 p-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">Total Students: <span className="font-medium text-gray-800">{students.length}</span></div>
            <div className="flex gap-2">
              <button onClick={()=>navigate(`/teacher/admin/enter/${selectedExamId}?readonly=1&klass=${encodeURIComponent(selectedClass||'')}`)} disabled={!selectedExamId} className="px-4 py-2 rounded-lg text-indigo-700 bg-white border border-indigo-200 disabled:opacity-60 shadow-soft">Preview</button>
              <button onClick={submit} disabled={saving || !canSubmit} className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 shadow-soft">{saving ? 'Saving...' : 'Save Grades'}</button>
            </div>
          </div>
        </div>
      </div>
      {/* Spacer so the fixed bar doesn't cover content */}
      <div className="h-28 md:hidden" aria-hidden="true" />

      {/* Input Unit Modal */}
      <Modal open={unitModal} onClose={()=>setUnitModal(false)} title="Choose Input Unit" size="sm">
        <div className="grid gap-3">
          <div className="text-sm text-gray-600">You can type values as raw marks or as percentages. We always save marks on the server.</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="unit" checked={inputAs==='marks'} onChange={()=>setInputAs('marks')} />
            <span>Marks (0 to Out Of)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="unit" checked={inputAs==='percent'} onChange={()=>setInputAs('percent')} />
            <span>Percentage (0% to 100%)</span>
          </label>
          <div className="flex justify-end gap-2 mt-1">
            <button type="button" className="px-3 py-1.5 rounded border" onClick={()=>setUnitModal(false)}>Close</button>
          </div>
        </div>
      </Modal>

      <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)} title="Preview Results" size="lg">
        <div className="grid gap-3">
          {!selectedExamId && (
            <div className="text-sm text-gray-600">Select an exam to preview.</div>
          )}
          {previewError && (
            <div className="bg-red-50 text-red-700 p-2 rounded border border-red-200 text-sm">{previewError}</div>
          )}
          {previewLoading && (
            <div className="text-sm text-gray-600">Loading…</div>
          )}
          {(!previewLoading && previewSummary) && (
            <div className="overflow-auto -mx-1">
              <div className="min-w-[800px] px-1">
                <div className="text-sm font-medium text-gray-800 mb-2">{previewSummary?.exam?.name || 'Exam'} • Year {previewSummary?.exam?.year || ''} • T{previewSummary?.exam?.term || ''}</div>
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-2 py-1 text-left w-20">Position</th>
                      <th className="border px-2 py-1 text-left w-56">Student</th>
                      {(previewSummary.subjects||[]).map(s => (
                        <th key={s.id} className="border px-2 py-1 text-left">{s.code || s.name}</th>
                      ))}
                      <th className="border px-2 py-1 text-left">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewSummary.students||[]).map((st,idx)=> (
                      <tr key={st.id} className={idx%2? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="border px-2 py-1">{st.position}</td>
                        <td className="border px-2 py-1">{st.name}</td>
                        {(previewSummary.subjects||[]).map(s => {
                          const pct = st?.subject_percentages?.[String(s.id)]
                          const value = (pct != null && pct !== '') ? `${pct}%` : (st.marks?.[String(s.id)] ?? '-')
                          return (
                            <td key={s.id} className="border px-2 py-1">{value}</td>
                          )
                        })}
                        <td className="border px-2 py-1 font-medium">{st.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-1.5 rounded border" onClick={()=>setPreviewOpen(false)}>Close</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
