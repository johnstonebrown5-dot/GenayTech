import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { teacherQueries } from '../utils/teacherQueries'

export default function TeacherPreviewResults(){
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [unpublishedExams, setUnpublishedExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentMap, setStudentMap] = useState({}) // { id: { name, admission_no } }
  const [school, setSchool] = useState({ name: '', logo: '', motto: '' })
  // grid helpers
  const [subjects, setSubjects] = useState([]) // normalized subjects
  const [componentsMap, setComponentsMap] = useState({}) // { subjectId: [components] }
  // helper: compute representative out_of for a component like admin grid does
  const componentOutOf = (subjectId, componentId) => {
    try{
      // Prefer precomputed column metadata from summary when available
      const cols = Array.isArray(summary?.columns) ? summary.columns : []
      const found = cols.find(c => c?.type==='component' && String(c.subjectId)===String(subjectId) && String(c.componentId)===String(componentId) && (c.outOf!=null))
      const fromCols = Number(found?.outOf)
      if (Number.isFinite(fromCols) && fromCols > 0) return fromCols
      // Fallback to subject_components API data (max_marks)
      const arr = componentsMap?.[subjectId] || []
      const comp = arr.find(x => String(x?.id)===String(componentId))
      const mm = Number(comp?.max_marks)
      if (Number.isFinite(mm) && mm > 0) return mm
      // Fallback to exam total
      const examTotal = Number(summary?.exam?.total_marks)
      if (Number.isFinite(examTotal) && examTotal > 0) return examTotal
    }catch{}
    return 100
  }

  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try{
        setLoading(true); setError('')
        const [cls, all] = await Promise.all([
          teacherQueries.getMyClasses(),
          teacherQueries.fetchAllPages('/academics/exams/?include_history=true&page_size=1000')
        ])
        if (!mounted) return
        setClasses(cls || [])
        const isUnpub = (e)=>{
          if (typeof e?.published === 'boolean') return e.published === false
          if (typeof e?.is_published === 'boolean') return e.is_published === false
          const s = String(e?.status||'').toLowerCase(); if (s) return s !== 'published' && s !== 'final' && s !== 'complete'
          if (e?.published_at) return false
          return true
        }
        const mapName = (id)=> (cls || []).find(c=> String(c.id)===String(id))?.name || id
        const uniq = new Map()
        for (const e of all){ if (e && isUnpub(e)) uniq.set(e.id, e) }
        const list = Array.from(uniq.values()).sort((a,b)=>{
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          if (db !== da) return db - da
          return (b.id||0) - (a.id||0)
        }).map(e=> ({...e, _class_name: mapName(e.klass ?? e.class ?? e.klass_id ?? e.class_id)}))
        setUnpublishedExams(list)
        setSelectedExam(list[0]?.id ? String(list[0].id) : '')
      }catch(e){ if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load exams') }
      finally{ if (mounted) setLoading(false) }
    })()
    return ()=>{ mounted=false }
  }, [])

  // Load school info (name, logo, motto) for printing header
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const r = await teacherQueries.getSchoolInfo()
        const data = r?.data
        if (!alive) return
        setSchool({ name: data?.name || '', logo: data?.logo_url || data?.logo || '', motto: data?.motto || data?.tagline || '' })
      }catch{ if(alive) setSchool({ name: '', logo: '', motto: '' }) }
    })()
    return ()=>{ alive=false }
  }, [])

  useEffect(()=>{
    if (!selectedExam){ setSummary(null); return }
    let active = true
    ;(async()=>{
      try{
        setLoading(true); setError('')
        let data = null
        try{
          const res = await teacherQueries.getExamSummary(selectedExam)
          data = res?.data || null
          // Normalize: ensure per-student subject_percentages exist
          if (data && Array.isArray(data.students) && Array.isArray(data.subjects)){
            try{
              const subjectOutOf = new Map()
              for (const s of data.subjects){
                const sid = s?.id
                const out = (
                  s?.outOf ?? s?.out_of ?? s?.max ?? s?.maximum ?? s?.out_of_marks ?? s?.total_out_of
                )
                const n = Number(out)
                if (sid!=null && Number.isFinite(n) && n>0) subjectOutOf.set(String(sid), n)
              }
              for (const st of data.students){
                if (st && !st.subject_percentages){
                  const pctMap = {}
                  // Prefer explicit list if provided
                  if (Array.isArray(st.subjects)){
                    for (const it of st.subjects){
                      const sid = it?.subject ?? it?.subject_id ?? it?.id
                      const pct = it?.percentage ?? it?.percent ?? it?.pct
                      if (sid!=null && pct!=null && pct!=='') pctMap[String(sid)] = Number(pct)
                      else if (sid!=null){
                        const mark = it?.total ?? it?.marks ?? it?.score ?? it?.value
                        const denom = Number(subjectOutOf.get(String(sid))) || Number(it?.out_of || it?.outOf || it?.maximum || 100)
                        const m = Number(mark)
                        if (Number.isFinite(m) && denom>0) pctMap[String(sid)] = Math.round((m/denom)*100)
                      }
                    }
                  }
                  // Fall back to marks map if present
                  if (Object.keys(pctMap).length===0 && st.marks){
                    for (const s of data.subjects){
                      const sid = s?.id
                      if (sid==null) continue
                      const m = Number(st.marks[String(sid)])
                      const denom = Number(subjectOutOf.get(String(sid))) || 100
                      if (Number.isFinite(m) && denom>0) pctMap[String(sid)] = Math.round((m/denom)*100)
                    }
                  }
                  st.subject_percentages = pctMap
                }
              }
            }catch{ /* ignore normalization errors */ }
          }
        }catch(err){
          // fallback: compute summary from exam_results when summary endpoint rejects
          const fetchAll = async (url) => {
            let out = []
            let next = url
            let guard = 0
            while (next && guard < 50){
              const r = await api.get(next)
              const d = r?.data
              if (Array.isArray(d)) { out = d; break }
              if (d && Array.isArray(d.results)) { out = out.concat(d.results); next = d.next; guard++; continue }
              break
            }
            return out
          }
          const rows = await fetchAll(`/academics/exam_results/?exam=${selectedExam}`)
          // Build subjects and students
          const subjectsMap = new Map()
          const studentsMap = new Map()
          const subjectOutOf = new Map() // sid -> outOf
          const componentsBySubject = new Map() // sid -> Map(cid -> { id, name, outOf })
          for (const r of rows){
            const sid = r?.subject ?? r?.subject_id ?? r?.subject_detail?.id
            const sname = r?.subject_detail?.name || r?.subject_name || ''
            const scode = r?.subject_detail?.code || r?.subject_code || sname
            if (sid!=null && !subjectsMap.has(String(sid))) subjectsMap.set(String(sid), { id: sid, name: sname, code: scode })
            const stId = r?.student ?? r?.student_id ?? r?.student_detail?.id
            const stName = r?.student_detail?.name || r?.student_name || String(stId)
            if (stId!=null && !studentsMap.has(String(stId))) studentsMap.set(String(stId), { id: stId, name: stName, marks: {}, total: 0, average: 0 })
            // capture an outOf value per subject when available (support many variants)
            const out = (
              r?.outOf ?? r?.out_of ?? r?.outOfMarks ?? r?.out_of_marks ??
              r?.total_out_of ?? r?.out_of_total ?? r?.components_out_of ?? r?.component_out_of ?? r?.components_total_out_of ??
              r?.max ?? r?.maximum ?? r?.max_mark ?? r?.max_marks ?? r?.subject_max ?? r?.subject_out_of ??
              r?.subject_detail?.outOf ?? r?.subject_detail?.out_of ?? r?.subject_detail?.max ?? r?.subject_detail?.maximum
            )
            const on = Number(out)
            if (sid!=null && Number.isFinite(on) && on > 0 && !subjectOutOf.has(String(sid))) subjectOutOf.set(String(sid), on)
            // capture component meta
            const compId = r?.component ?? r?.component_id ?? r?.component_detail?.id
            if (sid!=null && compId!=null){
              const cname = r?.component_detail?.name || r?.component_name || r?.component_label || `comp ${compId}`
              const cout = r?.component_detail?.max_marks ?? r?.component_detail?.out_of ?? r?.component_out_of ?? r?.out_of ?? null
              let cmap = componentsBySubject.get(String(sid))
              if (!cmap){ cmap = new Map(); componentsBySubject.set(String(sid), cmap) }
              if (!cmap.has(String(compId))){ cmap.set(String(compId), { id: compId, name: cname, outOf: cout }) }
            }
          }
          // fill marks
          for (const r of rows){
            const stId = r?.student ?? r?.student_id ?? r?.student_detail?.id
            const sid = r?.subject ?? r?.subject_id ?? r?.subject_detail?.id
            const val = r?.total ?? r?.component_total ?? r?.components_total ?? r?.subject_total ?? r?.total_marks ?? r?.total_mark ?? r?.marks ?? r?.score ?? r?.mark ?? r?.value
            const compId = r?.component ?? r?.component_id ?? r?.component_detail?.id
            if (stId==null || sid==null) continue
            const st = studentsMap.get(String(stId))
            if (!st) continue
            const num = Number(val)
            st.marks[String(sid)] = Number.isFinite(num) ? num : ''
            // capture per-component marks
            if (compId!=null){
              if (!st.component_marks) st.component_marks = {}
              const bySubj = st.component_marks[String(sid)] || {}
              bySubj[String(compId)] = Number.isFinite(num) ? num : ''
              st.component_marks[String(sid)] = bySubj
            }
          }
          // compute totals/positions
          const subs = Array.from(subjectsMap.values())
          const studs = Array.from(studentsMap.values())
          for (const st of studs){
            let t = 0
            let cnt = 0
            for (const s of subs){
              const v = Number(st.marks[String(s.id)])
              if (Number.isFinite(v)) { t += v; cnt++ }
            }
            st.total = t
            st.average = cnt ? Math.round((t / cnt) * 10) / 10 : 0
            // per-subject percentages used by preview UI
            const pctMap = {}
            for (const s of subs){
              const m = Number(st.marks[String(s.id)])
              if (!Number.isFinite(m)) continue
              const denom = Number(subjectOutOf.get(String(s.id))) || 100
              if (denom > 0) pctMap[String(s.id)] = Math.round((m / denom) * 100)
            }
            st.subject_percentages = pctMap
          }
          studs.sort((a,b)=> (Number(b.total)||0) - (Number(a.total)||0))
          let last = null, pos=0
          for (let i=0;i<studs.length;i++){
            const t = Number(studs[i].total)||0
            if (t !== last){ pos = i+1; last = t }
            studs[i].position = pos
          }
          // enrich missing names/admissions by fetching student detail
          const needDetail = studs.filter(s => !s.name || /^\d+$/.test(String(s.name||'')))
          for (const s of needDetail){
            try{
              const rd = await api.get(`/academics/students/${s.id}/`)
              if (rd?.data){
                s.name = rd.data.name || s.name
                s.admission_no = rd.data.admission_no || s.admission_no
              }
            }catch{}
          }
          // exam meta (best effort)
          let examMeta = null
          try{ const er = await api.get(`/academics/exams/${selectedExam}/`); examMeta = er?.data || null }catch{}
          // Build columns: components first (if any), then subject percent column
          const columns = []
          for (const s of subs){
            const cmap = componentsBySubject.get(String(s.id))
            if (cmap && cmap.size){
              for (const comp of Array.from(cmap.values())){
                const base = s.code || s.name
                const label = base
                const title = `${base} ${comp.name}` + (comp?.outOf ? ` (out of ${comp.outOf})` : '')
                columns.push({ type: 'component', subjectId: s.id, componentId: comp.id, header: label, title, outOf: comp?.outOf ?? '' })
              }
            }
            // Always include a subject percent column
            columns.push({ type: 'percent', subjectId: s.id, header: s.code || s.name, outOf: '' })
          }
          data = { exam: examMeta, subjects: subs, students: studs, columns }
        }
        if (active) setSummary(data)
      }catch(e){ if (active) setError(e?.response?.data?.detail || e?.message || 'Failed to load summary') }
      finally{ if (active) setLoading(false) }
    })()
    return ()=>{ active=false }
  }, [selectedExam])

  // Normalize subjects list and lazily fetch components per subject to mirror admin grid
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const subs = Array.isArray(summary?.subjects) ? summary.subjects : []
        setSubjects(subs)
        const anyComponentMarks = Array.isArray(summary?.students)
          ? summary.students.some(st => st?.component_marks && Object.keys(st.component_marks || {}).length)
          : false
        const anyComponentColumns = Array.isArray(summary?.columns)
          ? summary.columns.some(c => c?.type === 'component')
          : false
        if (!subs.length || (!anyComponentMarks && !anyComponentColumns)) { setComponentsMap({}); return }
        const entries = await Promise.all(subs.map(async (s)=>{
          try{
            const r = await api.get(`/academics/subject_components/?subject=${s.id}`)
            const arr = Array.isArray(r.data) ? r.data : (Array.isArray(r?.data?.results) ? r.data.results : [])
            return [s.id, arr]
          }catch{ return [s.id, []] }
        }))
        if (!alive) return
        const map = {}
        for (const [sid, arr] of entries){ map[sid] = arr }
        setComponentsMap(map)
      }catch{
        if (alive) setComponentsMap({})
      }
    })()
    return ()=>{ alive=false }
  }, [summary])

  // Load students (by class if available, else per-student fallback) to resolve names and admission numbers
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        // If summary already includes usable student identity, don't do extra calls.
        const hasIdentity = Array.isArray(summary?.students) && summary.students.every(s => {
          const n = String(s?.name || '').trim()
          return n && !/^\d+$/.test(n)
        })
        const hasAdmission = Array.isArray(summary?.students) && summary.students.some(s => String(s?.admission_no || '').trim())
        if (hasIdentity && hasAdmission){
          const m = {}
          for (const s of summary.students){
            if (s && s.id!=null) m[String(s.id)] = { name: s.name, admission_no: s.admission_no }
          }
          if (alive) setStudentMap(m)
          return
        }
        const cid = summary?.exam?.klass ?? summary?.exam?.class ?? summary?.exam?.klass_id ?? summary?.exam?.class_id
        let arr = []
        if (cid){
          arr = await teacherQueries.getClassStudents(cid)
        }
        // fallback to per-student lookup if no class roster
        if (!arr.length){
          const wanted = Array.isArray(summary?.students) ? Array.from(new Set(summary.students.map(s=> s.id).filter(Boolean))).slice(0, 200) : []
          const per = []
          for (const id of wanted){
            try{ const r = await api.get(`/academics/students/${id}/`); if (r?.data) per.push(r.data) }catch{}
          }
          arr = per
        }
        if (!alive) return
        const m = {}
        for (const s of arr){ if (s && s.id!=null) m[String(s.id)] = { name: s.name, admission_no: s.admission_no } }
        setStudentMap(m)
      }catch{ if (alive) setStudentMap({}) }
    })()
    return ()=>{ alive=false }
  }, [summary])

  const classNameById = (id) => classes.find(c=>String(c.id)===String(id))?.name || id

  const printHTML = (title, html) => {
    const w = window.open('', '_blank')
    w.document.write(`<!doctype html><html><head><meta charset=\"utf-8\"><title>${title}</title><style>
      :root{ --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#ffffff; --chip:#eef2ff; --chipText:#3730a3; }
      @page{ margin:16mm; }
      body{ font-family:Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:var(--ink); background:var(--bg); }
      .sheet{ max-width:1000px; margin:0 auto; }
      .letterhead{ display:flex; flex-direction:column; align-items:center; text-align:center; margin-bottom:12px; position:relative; }
      .logo{ height:64px; width:64px; object-fit:contain; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); background:white; }
      .school{ margin-top:8px; font-weight:700; letter-spacing:.2px; }
      .motto{ margin-top:2px; color:var(--muted); font-size:12px; }
      .meta{ display:flex; gap:8px; justify-content:center; margin-top:8px; }
      .chip{ background:var(--chip); color:var(--chipText); border:1px solid #e0e7ff; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
      .title{ margin:14px 0 12px; text-align:center; font-size:18px; font-weight:800; }
      .card{ border:1px solid var(--line); border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(15,23,42,.05); }
      table{ border-collapse:separate; border-spacing:0; width:100%; font-size:12px; }
      thead th{ background:#f8fafc; font-weight:700; }
      th,td{ border-top:1px solid var(--line); border-right:1px solid var(--line); padding:8px 10px; text-align:left; }
      tr:first-child th{ border-top:none; }
      th:first-child, td:first-child{ border-left:none; }
      tr:nth-child(even) td{ background:#fbfdff; }
      tbody tr:last-child td{ border-bottom:none; }
      .footer{ margin-top:8px; display:flex; justify-content:space-between; color:var(--muted); font-size:11px; }
      .watermark{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; opacity:.06; font-size:110px; font-weight:900; letter-spacing:6px; transform:rotate(-20deg); }
    </style></head><body>${html}</body></html>`)
    w.document.close(); w.focus(); w.print()
  }
  const handlePrint = () => {
    if (!summary) return
    const cols = ['Position','Student','Admission', ...summary.subjects.map(s=> s.code || s.name), 'Total']
    const subjectCell = (st, subjectId) => {
      const pct = st?.subject_percentages?.[String(subjectId)]
      if (pct != null && pct !== '') return `${pct}%`
      return st?.marks?.[String(subjectId)] ?? ''
    }
    const rows = summary.students.map(st=> [
      st.position,
      (studentMap[String(st.id)]?.name || st.name || st.id),
      (studentMap[String(st.id)]?.admission_no || st.admission_no || ''),
      ...summary.subjects.map(s=> subjectCell(st, s.id)),
      st.total
    ])
    const thead = `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`
    const tbody = rows.map(r=> `<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')
    const ex = summary?.exam || {}
    const exTitle = `${ex?.name || 'Exam'} (DRAFT) • ${ex?.year || ''} • T${ex?.term || ''} • ${classNameById(ex?.klass) || ''}`
    const title = `${ex?.name || 'Exam'} - ${classNameById(ex?.klass) || ''}`
    const logo = school.logo ? `<img class=\"logo\" src=\"${school.logo}\" alt=\"logo\"/>` : ''
    const chips = [ex?.year && `Year ${ex.year}`, (ex?.term!=null) && `T${ex.term}`, classNameById(ex?.klass)].filter(Boolean).map(x=>`<span class=\"chip\">${x}</span>`).join('')
    const head = `
      <div class=\"letterhead\">
        ${logo}
        <div class=\"school\">${school.name || ''}</div>
        ${school.motto ? `<div class=\"motto\">${school.motto}</div>` : ''}
        <div class=\"meta\">${chips}</div>
      </div>
      <div class=\"title\">${ex?.name || 'Exam'} <span style=\"color:#94a3b8; font-weight:700\">(DRAFT)</span></div>
    `
    const now = new Date(); const when = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
    const page = `
      <div class=\"sheet\">
        ${head}
        <div class=\"card\">
          <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
        </div>
        <div class=\"footer\"><div>Generated: ${when}</div><div>${school.name || ''}</div></div>
        <div class=\"watermark\">DRAFT</div>
      </div>
    `
    printHTML(title, page)
  }

  return (
    <div className="teacher-preview-results-page px-2 md:px-6 py-4 md:py-6 space-y-4 max-w-7xl mx-auto min-h-[80vh]">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 shadow-sm">
        <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-base md:text-xl font-semibold tracking-tight text-gray-900">Unpublished Results</h1>
            <div className="text-[11px] md:text-xs text-gray-600">Preview any exam that is not yet published. Read only.</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end sm:ml-auto w-full sm:w-auto">
          <label className="text-xs md:text-sm text-gray-700 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full sm:w-auto">
            <span className="shrink-0">Exam</span>
            <select
              className="w-full sm:w-80 border border-gray-200 rounded-xl px-3 py-2 text-xs md:text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              value={selectedExam}
              onChange={e=>setSelectedExam(e.target.value)}
              disabled={loading || !unpublishedExams.length}
            >
              <option value="">{loading && !unpublishedExams.length ? 'Loading…' : 'Select exam…'}</option>
              {unpublishedExams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name} • {ex.year} • T{ex.term} • {ex._class_name}</option>
              ))}
            </select>
          </label>
          <button onClick={handlePrint} disabled={!summary} className="text-xs md:text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-60 w-full sm:w-auto">Print</button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-xs md:text-sm px-3 py-2 rounded-2xl border border-red-200 shadow-sm">{error}</div>}

      {!unpublishedExams.length && !loading && (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm px-4 py-3 text-xs md:text-sm text-gray-700">No unpublished exams available.</div>
      )}

      {selectedExam && !summary ? (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm px-4 py-3 text-sm text-gray-700">Loading…</div>
      ) : selectedExam && summary ? (
        <div className="bg-white/95 backdrop-blur rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm md:text-base text-gray-800 font-medium">{summary?.exam?.name || 'Exam'} • Year {summary?.exam?.year || ''} • T{summary?.exam?.term || ''} • {classNameById(summary?.exam?.klass)}</div>
            <div className="text-[11px] text-gray-500">Students: {Array.isArray(summary?.students) ? summary.students.length : 0}</div>
          </div>

          <div className="md:hidden px-3 pb-4 grid gap-3">
            {summary.students.map((st) => {
              const grand = subjects.reduce((sum, s)=>{
                const pct = Number(st?.subject_percentages?.[String(s.id)])
                return sum + (Number.isFinite(pct) ? pct : 0)
              }, 0)
              const name = studentMap[String(st.id)]?.name || st.name || st.id
              const adm = studentMap[String(st.id)]?.admission_no || st.admission_no || '-'
              return (
                <div key={st.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-gradient-to-r from-indigo-50 via-white to-sky-50 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                      <div className="text-[11px] text-gray-600">Adm: {adm}{st?.position ? ` • Pos: ${st.position}` : ''}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-[10px] text-gray-500">Total</div>
                      <div className="text-sm font-bold text-indigo-700 leading-tight">{Number(st?.total) || grand}</div>
                    </div>
                  </div>

                  <div className="px-3 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {subjects.map(s => {
                        const pct = Number(st?.subject_percentages?.[String(s.id)])
                        const showPct = Number.isFinite(pct) ? `${pct}%` : '0%'
                        const comps = componentsMap[s.id] || []
                        const hasComps = Array.isArray(comps) && comps.length>0
                        return (
                          <div key={s.id} className="rounded-xl border border-gray-200 bg-gray-50/60 px-2 py-1.5">
                            <div className="text-[10px] font-semibold text-gray-700 truncate" title={s.name || s.code}>{s.code || s.name}</div>
                            <div className="text-xs font-bold text-gray-900">{showPct}</div>
                            {hasComps && (
                              <div className="mt-0.5 text-[10px] text-gray-500 line-clamp-2">
                                {comps.slice(0,3).map(c => {
                                  const val = st?.component_marks?.[String(s.id)]?.[String(c.id)]
                                  const label = c.code || c.name || 'Paper'
                                  return `${label}:${(val!=='' && val!=null) ? val : '-'}`
                                }).join(' • ')}
                                {comps.length > 3 ? ` • +${comps.length-3} more` : ''}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={()=> navigate(`/teacher/students/${st.id}/report-card?exam=${encodeURIComponent(String(selectedExam||''))}`)}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        View slip
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden md:block overflow-auto -mx-2 md:mx-0">
            <div className="inline-block min-w-[900px] align-middle">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50" rowSpan={2}>Student</th>
                    <th className="border px-2 py-1 text-left" rowSpan={2}>Admission</th>
                    {subjects.map(s => {
                      const comps = componentsMap[s.id] || []
                      const count = (Array.isArray(comps) && comps.length>0) ? comps.length + 1 : 2
                      return (
                        <th key={`grp-${s.id}`} className="border px-2 py-1 text-center" colSpan={count}>{s.code || s.name}</th>
                      )
                    })}
                    <th className="border px-2 py-1 text-center" rowSpan={2}>All Subjects</th>
                    <th className="border px-2 py-1 text-center" rowSpan={2}>Slip</th>
                  </tr>
                  <tr>
                    {subjects.map(s => {
                      const comps = componentsMap[s.id] || []
                      if (Array.isArray(comps) && comps.length>0){
                        return (
                          <React.Fragment key={`sub-${s.id}`}>
                            {comps.map(c => {
                              const repOut = Number(componentOutOf(s.id, c.id))
                              const label = c.code || c.name || 'Paper'
                              return (
                                <th key={`c-${s.id}-${c.id}`} className="border px-2 py-1 text-center whitespace-nowrap">
                                  {label}{Number.isFinite(repOut)? ` (out of ${repOut})` : ''}
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
                    <th className="border px-2 py-1 text-center text-gray-400">—</th>
                    {subjects.map(s => {
                      const comps = componentsMap[s.id] || []
                      if (Array.isArray(comps) && comps.length>0){
                        return (
                          <React.Fragment key={`out-${s.id}`}>
                            {comps.map(c => (
                              <th key={`out-${s.id}-${c.id}`} className="border px-2 py-1 text-center">{componentOutOf(s.id, c.id)}</th>
                            ))}
                            <th key={`out-tot-${s.id}`} className="border px-2 py-1 text-center text-gray-400">—</th>
                          </React.Fragment>
                        )
                      }
                      const placeholder = String(Number(summary?.exam?.total_marks ?? 100))
                      return (
                        <React.Fragment key={`out-single-${s.id}`}>
                          <th className="border px-2 py-1 text-center">{placeholder}</th>
                          <th className="border px-2 py-1 text-center text-gray-400">—</th>
                        </React.Fragment>
                      )
                    })}
                    <th className="border px-2 py-1 text-center text-gray-400">—</th>
                    <th className="border px-2 py-1 text-center text-gray-400">—</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students.map((st, idx) => {
                    const grand = subjects.reduce((sum, s)=>{
                      const pct = Number(st?.subject_percentages?.[String(s.id)])
                      return sum + (Number.isFinite(pct) ? pct : 0)
                    }, 0)
                    return (
                      <tr key={st.id} className={`${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                        <td className="border px-2 py-1 sticky left-0 bg-white">{studentMap[String(st.id)]?.name || st.name || st.id}</td>
                        <td className="border px-2 py-1">{studentMap[String(st.id)]?.admission_no || st.admission_no || '-'}</td>
                        {subjects.map(s => {
                          const comps = componentsMap[s.id] || []
                          if (Array.isArray(comps) && comps.length>0){
                            return (
                              <React.Fragment key={`row-${st.id}-${s.id}`}>
                                {comps.map(c => {
                                  const val = st?.component_marks?.[String(s.id)]?.[String(c.id)]
                                  return (
                                    <td key={`c-${s.id}-${c.id}`} className="border px-1.5 py-1 text-center">{(val!=='' && val!=null) ? val : '-'}</td>
                                  )
                                })}
                                <td className="border px-1.5 py-1 text-center font-medium">{Number(st?.subject_percentages?.[String(s.id)]) || 0}%</td>
                              </React.Fragment>
                            )
                          }
                          const marks = st?.marks?.[String(s.id)]
                          const pct = Number(st?.subject_percentages?.[String(s.id)])
                          return (
                            <React.Fragment key={`single-row-${st.id}-${s.id}`}>
                              <td className="border px-1.5 py-1 text-center">{(marks!=='' && marks!=null) ? marks : '-'}</td>
                              <td className="border px-1.5 py-1 text-center font-medium">{Number.isFinite(pct) ? pct : 0}%</td>
                            </React.Fragment>
                          )
                        })}
                        <td className="border px-1.5 py-1 text-center font-semibold">{grand}</td>
                        <td className="border px-1.5 py-1 text-center">
                          <button
                            onClick={()=> navigate(`/teacher/students/${st.id}/report-card?exam=${encodeURIComponent(String(selectedExam||''))}`)}
                            className="px-2 py-1 rounded border text-[11px] bg-white hover:bg-gray-50"
                          >View</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
