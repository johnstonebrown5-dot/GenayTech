import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

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

  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try{
        setLoading(true); setError('')
        const [clsRes, exRes] = await Promise.all([
          api.get('/academics/classes/mine/'),
          api.get('/academics/exams/', { params: { include_history: true, page_size: 1000 } })
        ])
        if (!mounted) return
        const cls = Array.isArray(clsRes?.data) ? clsRes.data : (Array.isArray(clsRes?.data?.results) ? clsRes.data.results : [])
        const all = Array.isArray(exRes?.data) ? exRes.data : (Array.isArray(exRes?.data?.results) ? exRes.data.results : [])
        setClasses(cls)
        const isUnpub = (e)=>{
          if (typeof e?.published === 'boolean') return e.published === false
          if (typeof e?.is_published === 'boolean') return e.is_published === false
          const s = String(e?.status||'').toLowerCase(); if (s) return s !== 'published' && s !== 'final' && s !== 'complete'
          if (e?.published_at) return false
          return true
        }
        const mapName = (id)=> cls.find(c=> String(c.id)===String(id))?.name || id
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
        const { data } = await api.get('/auth/school/info/')
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
          const res = await api.get(`/academics/exams/${selectedExam}/summary/`)
          data = res?.data || null
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
          for (const r of rows){
            const sid = r?.subject ?? r?.subject_id ?? r?.subject_detail?.id
            const sname = r?.subject_detail?.name || r?.subject_name || ''
            const scode = r?.subject_detail?.code || r?.subject_code || sname
            if (sid!=null && !subjectsMap.has(String(sid))) subjectsMap.set(String(sid), { id: sid, name: sname, code: scode })
            const stId = r?.student ?? r?.student_id ?? r?.student_detail?.id
            const stName = r?.student_detail?.name || r?.student_name || String(stId)
            if (stId!=null && !studentsMap.has(String(stId))) studentsMap.set(String(stId), { id: stId, name: stName, marks: {}, total: 0, average: 0 })
          }
          // fill marks
          for (const r of rows){
            const stId = r?.student ?? r?.student_id ?? r?.student_detail?.id
            const sid = r?.subject ?? r?.subject_id ?? r?.subject_detail?.id
            const val = r?.marks ?? r?.score ?? r?.value
            if (stId==null || sid==null) continue
            const st = studentsMap.get(String(stId))
            if (!st) continue
            const num = Number(val)
            st.marks[String(sid)] = Number.isFinite(num) ? num : ''
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
          data = { exam: examMeta, subjects: subs, students: studs }
        }
        if (active) setSummary(data)
      }catch(e){ if (active) setError(e?.response?.data?.detail || e?.message || 'Failed to load summary') }
      finally{ if (active) setLoading(false) }
    })()
    return ()=>{ active=false }
  }, [selectedExam])

  // Load students (by class if available, else per-student fallback) to resolve names and admission numbers
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const cid = summary?.exam?.klass ?? summary?.exam?.class ?? summary?.exam?.klass_id ?? summary?.exam?.class_id
        let arr = []
        if (cid){
          const tryFetch = async () => {
            const urls = [
              `/academics/students/?klass=${cid}`,
              `/academics/students/?class=${cid}`,
              `/academics/students/?klass_id=${cid}`,
              `/academics/students/?class_id=${cid}`,
            ]
            for (const u of urls){
              try{
                const r = await api.get(u)
                const a = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.results) ? r.data.results : [])
                if (a && a.length) return a
              }catch{}
            }
            return []
          }
          arr = await tryFetch()
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
    const rows = summary.students.map(st=> [
      st.position,
      (studentMap[String(st.id)]?.name || st.name || st.id),
      (studentMap[String(st.id)]?.admission_no || st.admission_no || ''),
      ...summary.subjects.map(s=> st.marks?.[String(s.id)] ?? ''),
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
    <div className="teacher-preview-results-page px-0 md:px-6 py-4 md:py-6 space-y-4 max-w-7xl mx-auto min-h-[80vh]">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 shadow-sm">
        <div className="p-4 md:p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base md:text-xl font-semibold tracking-tight text-gray-900">Unpublished Results</h1>
            <div className="text-[11px] md:text-xs text-gray-600">Preview any exam that is not yet published. Read only.</div>
          </div>
          <label className="text-xs md:text-sm text-gray-700 flex items-center gap-2 w-full sm:w-auto">
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
          <button onClick={handlePrint} disabled={!summary} className="text-xs md:text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-60">Print</button>
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
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm md:text-base text-gray-800 font-medium">{summary?.exam?.name || 'Exam'} • Year {summary?.exam?.year || ''} • T{summary?.exam?.term || ''} • {classNameById(summary?.exam?.klass)}</div>
          </div>
          <div className="overflow-auto -mx-2 md:mx-0">
            <div className="inline-block min-w-[900px] align-middle">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border border-gray-200 px-2 py-2 text-left w-20">Position</th>
                    <th className="border border-gray-200 px-2 py-2 text-left w-64">Student</th>
                    <th className="border border-gray-200 px-2 py-2 text-left w-40">Admission</th>
                    {summary.subjects.map(s => (
                      <th key={s.id} className="border border-gray-200 px-2 py-2 text-left">{s.code || s.name}</th>
                    ))}
                    <th className="border border-gray-200 px-2 py-2 text-left">Total</th>
                    <th className="border border-gray-200 px-2 py-2 text-left w-28">Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students.map((st,idx) => (
                    <tr key={st.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="border border-gray-200 px-2 py-2">{st.position}</td>
                      <td className="border border-gray-200 px-2 py-2">{studentMap[String(st.id)]?.name || st.name || st.id}</td>
                      <td className="border border-gray-200 px-2 py-2">{studentMap[String(st.id)]?.admission_no || '-'}</td>
                      {summary.subjects.map(s => (
                        <td key={s.id} className="border border-gray-200 px-2 py-2">{st.marks?.[String(s.id)] ?? '-'}</td>
                      ))}
                      <td className="border border-gray-200 px-2 py-2 font-medium">{st.total}</td>
                      <td className="border border-gray-200 px-2 py-2">
                        <button
                          onClick={()=> navigate(`/teacher/students/${st.id}/report-card?exam=${encodeURIComponent(String(selectedExam||''))}`)}
                          className="px-2 py-1 rounded border text-[11px] bg-white hover:bg-gray-50"
                        >View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
