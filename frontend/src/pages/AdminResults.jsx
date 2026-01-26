import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'

export default function AdminResults(){
  const [params, setParams] = useSearchParams()
  const initialGrade = params.get('grade') || ''
  const initialExam = params.get('exam') || ''

  const [grade, setGrade] = useState(initialGrade)
  const [classes, setClasses] = useState([])
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState(initialExam)
  const [summary, setSummary] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  const [compareSummaries, setCompareSummaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [fullListSearch, setFullListSearch] = useState('')
  const [tab, setTab] = useState('class') // class | compare | block | full
  const classResultsTableRef = useRef(null)
  const fullListTableRef = useRef(null)
  const [bandsBySubject, setBandsBySubject] = useState(new Map()) // subjectId -> bands[]
  const [globalBands, setGlobalBands] = useState(null) // bands[] to compute overall Grade
  const [school, setSchool] = useState(null)

  const openPrintWindow = ({ title, metaLeftHtml = '' , contentHtml }) => {
    try{
      const schoolName = String(school?.name || '').trim()
      const schoolMotto = String(school?.motto || '').trim()
      const rawLogo = String(school?.logo_url || school?.logo || '').trim()
      const logoSrc = rawLogo ? toAbsoluteUrl(rawLogo) : ''

      const now = new Date()
      const metaRight = `Printed: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

      const win = window.open('', '_blank', 'width=1200,height=800')
      if (!win) return

      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          :root{
            --print-scale: 1.5;
            --text:#111827;
            --muted:#6b7280;
            --border:#e5e7eb;
            --head:#f8fafc;
            --stripe:#fafafa;
          }
          html, body { height: 100%; }
          body{
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
            color: var(--text);
            margin: 0;
          }
          .print-wrap{ padding: 0; }
          .print-header{
            text-align: center;
            padding: 6px 0 8px;
            border-bottom: 1px solid var(--border);
          }
          .print-header__logo{
            width: 44px;
            height: 44px;
            object-fit: contain;
            display: block;
            margin: 0 auto 4px;
          }
          .print-header__name{
            font-size: calc(15px * var(--print-scale));
            font-weight: 800;
            letter-spacing: 0.4px;
            margin: 0;
          }
          .print-header__motto{
            font-size: calc(10px * var(--print-scale));
            color: var(--muted);
            margin-top: 4px;
          }
          .print-title{
            text-align:center;
            font-size: calc(11px * var(--print-scale));
            margin: 6px 0 8px;
            color: var(--text);
            font-weight: 600;
          }
          .meta{
            display:flex;
            justify-content: space-between;
            gap: 12px;
            font-size: calc(10px * var(--print-scale));
            color: var(--muted);
            margin: 0 0 6px;
          }

          table.print-table{
            width: 100%;
            border-collapse: collapse;
            border-spacing: 0;
            font-size: calc(9px * var(--print-scale));
            table-layout: fixed;
            border: 1px solid var(--border);
          }
          table.print-table thead th{
            background: var(--head);
            color: #111827;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.35px;
            font-size: calc(8.5px * var(--print-scale));
          }
          table.print-table th,
          table.print-table td{
            padding: 1px 3px;
            line-height: 1.05;
            border: 1px solid var(--border);
            vertical-align: top;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          table.print-table tbody tr:nth-child(even) td{ background: var(--stripe); }
          table.print-table td{ color: #111827; }

          table.print-table--class tbody td:nth-child(2),
          table.print-table--full tbody td:nth-child(2){
            font-weight: 800;
          }

          /* Full list column sizing: # | Student | Class | [subjects...] | Total | Grade */
          table.print-table--full thead th:nth-child(1),
          table.print-table--full tbody td:nth-child(1){ width: 28px; text-align: right; }
          table.print-table--full thead th:nth-child(2),
          table.print-table--full tbody td:nth-child(2){ width: 170px; }
          table.print-table--full thead th:nth-child(3),
          table.print-table--full tbody td:nth-child(3){ width: 90px; }
          table.print-table--full thead th:nth-last-child(2),
          table.print-table--full tbody td:nth-last-child(2){ width: 52px; text-align: right; }
          table.print-table--full thead th:nth-last-child(1),
          table.print-table--full tbody td:nth-last-child(1){ width: 46px; text-align: center; }
          table.print-table--full thead th:nth-child(n+4):not(:nth-last-child(-n+2)),
          table.print-table--full tbody td:nth-child(n+4):not(:nth-last-child(-n+2)){
            width: 34px;
            text-align: center;
          }

          /* Class results column sizing: Pos | Student | [subjects...] | Total | Grade */
          table.print-table--class thead th:nth-child(1),
          table.print-table--class tbody td:nth-child(1){ width: 34px; text-align: right; }
          table.print-table--class thead th:nth-child(2),
          table.print-table--class tbody td:nth-child(2){ width: 200px; }
          table.print-table--class thead th:nth-last-child(2),
          table.print-table--class tbody td:nth-last-child(2){ width: 56px; text-align: right; }
          table.print-table--class thead th:nth-last-child(1),
          table.print-table--class tbody td:nth-last-child(1){ width: 46px; text-align: center; }
          table.print-table--class thead th:nth-child(n+3):not(:nth-last-child(-n+2)),
          table.print-table--class tbody td:nth-child(n+3):not(:nth-last-child(-n+2)){
            width: 34px;
            text-align: center;
          }

          @media print {
            .no-print{ display: none !important; }
            thead { display: table-header-group; }
            tfoot { display: table-row-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
          }
        </style>
      </head><body>
        <div class="print-wrap">
          <div class="print-header">
            ${logoSrc ? `<img class="print-header__logo" src="${logoSrc}" alt="School Logo" />` : ''}
            ${schoolName ? `<h1 class="print-header__name">${schoolName}</h1>` : ''}
            ${schoolMotto ? `<div class="print-header__motto">${schoolMotto}</div>` : ''}
          </div>
          <div class="print-title">${title}</div>
          <div class="meta">
            <div>${metaLeftHtml || ''}</div>
            <div>${metaRight}</div>
          </div>
          ${contentHtml}
        </div>
        <script>
          (function(){
            function waitForImages(){
              var imgs = Array.prototype.slice.call(document.images || []);
              if (!imgs.length) return Promise.resolve();
              return Promise.all(imgs.map(function(img){
                if (img.complete) return Promise.resolve();
                return new Promise(function(res){
                  img.onload = img.onerror = function(){ res(); };
                });
              }));
            }
            window.onload = function(){
              waitForImages().then(function(){
                window.focus();
                window.print();
                setTimeout(function(){ try{ window.close(); }catch(e){} }, 300);
              });
            };
          })();
        <\/script>
      </body></html>`)
      win.document.close()
    }catch{}
  }

  const printFullList = () => {
    try{
      const table = fullListTableRef.current
      if (!table) return
      const clone = table.cloneNode(true)
      try{ clone.className = `${clone.className || ''} print-table print-table--full`.trim() }catch{}
      const html = clone.outerHTML
      const title = `Full Grade List${grade ? ` — ${grade}` : ''}`
      openPrintWindow({ title, metaLeftHtml: grade ? `Grade: <b>${grade}</b>` : '', contentHtml: html })
    }catch{}
  }

  const printClassResults = () => {
    try{
      const table = classResultsTableRef.current
      if (!table) return
      const clone = table.cloneNode(true)
      try{ clone.className = `${clone.className || ''} print-table print-table--class`.trim() }catch{}
      const html = clone.outerHTML
      const ex = (Array.isArray(exams) ? exams : []).find(e => String(e.id) === String(selectedExam))
      const examLabel = ex ? `${ex.name || 'Exam'} • ${ex.year || ''} • T${ex.term || ''} • ${classNameById(ex.klass)}` : 'Class Results'
      const title = `Class Results${examLabel ? ` — ${examLabel}` : ''}`
      const metaLeft = grade ? `Grade: <b>${grade}</b>` : ''
      openPrintWindow({ title, metaLeftHtml: metaLeft, contentHtml: html })
    }catch{}
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try{
        const sch = await api.get('/auth/school/info/')
        if (active) setSchool(sch?.data || null)
        return
      }catch{}
      try{
        const sch = await api.get('/auth/school/me/')
        if (active) setSchool(sch?.data || null)
      }catch{}
    })()
    return () => { active = false }
  }, [])

  // Load all classes for dropdowns
  useEffect(() => {
    (async () => {
      // Support both array and paginated responses
      const fetchAll = async (url) => {
        let out = []
        let next = url
        let guard = 0
        while (next && guard < 50){
          const res = await api.get(next)
          const d = res?.data
          if (Array.isArray(d)) { out = d; break }
          if (d && Array.isArray(d.results)) { out = out.concat(d.results); next = d.next; guard++; continue }
          break
        }
        return out
      }
      let list = []
      try {
        list = await fetchAll('/academics/classes/')
      } catch {
        try {
          list = await fetchAll('/academics/classes/mine/')
        } catch {
          list = []
        }
      }
      setClasses(Array.isArray(list) ? list : [])
    })()
  }, [])

  // When grade changes, load exams for that grade
  useEffect(() => {
    (async () => {
      if (!grade) { setExams([]); return }
      // Fetch all pages in case the API is paginated
      const fetchAll = async (url) => {
        let out = []
        let next = url
        let guard = 0
        while (next && guard < 50){
          const res = await api.get(next)
          const d = res?.data
          if (Array.isArray(d)) { out = d; break }
          if (d && Array.isArray(d.results)) { out = out.concat(d.results); next = d.next; guard++; continue }
          break
        }
        return out
      }
      let all = []
      try {
        // Prefer server-side grade filtering (authoritative and avoids relying on classes list)
        const g = encodeURIComponent(String(grade || '').trim())
        all = await fetchAll(`/academics/exams/?include_history=true&grade=${g}`)
      } catch {
        try {
          const g = encodeURIComponent(String(grade || '').trim())
          all = await fetchAll(`/academics/exams/?grade=${g}`)
        } catch {
          try {
            all = await fetchAll('/academics/exams/?include_history=true')
          } catch {
            try {
              all = await fetchAll('/academics/exams/')
            } catch {
              all = []
            }
          }
        }
      }

      // Fallback client-side filtering if the backend didn't filter (or returned mixed results)
      const normalizeGrade = (g)=>{
        const s = String(g||'').trim()
        const m = s.match(/\d+/)
        if (m) return m[0]
        return s.toLowerCase()
      }
      const classById = new Map((classes || []).map(c => [String(c.id), c]))
      const allArr = Array.isArray(all) ? all : []
      const hasOnlyGrade = allArr.length > 0 && allArr.every(e => {
        const tag = String(e?.grade_level_tag || '').trim()
        return !tag || normalizeGrade(tag) === normalizeGrade(grade)
      })
      const inGrade = hasOnlyGrade ? allArr : allArr.filter(e => {
        const tag = String(e?.grade_level_tag || '').trim()
        if (tag) return normalizeGrade(tag) === normalizeGrade(grade)
        const cid = String(e?.klass ?? e?.class ?? e?.klass_id ?? e?.class_id ?? '')
        const cls = classById.get(cid)
        return cls && normalizeGrade(cls.grade_level) === normalizeGrade(grade)
      })

      // Only allow selection of exams that are published (done & visible)
      const isPublished = (e) => !!(e?.published || e?.is_published || String(e?.status||'').toLowerCase()==='published')
      const published = inGrade.filter(isPublished)
      const list = (published.length > 0) ? published : inGrade
      setExams(list)
      // if selected exam not in published exams for grade, reset
      if (list.findIndex(e => String(e.id) === String(selectedExam)) === -1) {
        setSelectedExam('')
        setSummary(null)
      }
    })()
  }, [grade, classes])

  // Reflect into URL params
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (grade) next.set('grade', grade); else next.delete('grade')
    if (selectedExam) next.set('exam', String(selectedExam)); else next.delete('exam')
    setParams(next, { replace: true })
  }, [grade, selectedExam])

  const gradeOptions = useMemo(() => Array.from({length:9}, (_,i)=>`Grade ${i+1}`), [])

  // If a summary has no students, fetch the class roster and create zero-score rows so users can still see students
  const hydrateWithRoster = async (examId, summary) => {
    try{
      if (!summary || (Array.isArray(summary.students) && summary.students.length>0)) return summary
      const ex = (Array.isArray(exams)?exams:[]).find(e=>String(e.id)===String(examId))
      const klassId = ex?.klass
      if (!klassId) return summary
      const rosterRes = await api.get(`/academics/students/?klass=${klassId}`)
      const roster = Array.isArray(rosterRes?.data) ? rosterRes.data : (Array.isArray(rosterRes?.data?.results) ? rosterRes.data.results : [])
      const subs = Array.isArray(summary.subjects) ? summary.subjects : []
      const students = roster.map((s, idx) => ({ id: s.id, name: s.name, marks: {}, total: 0, average: 0, position: idx+1 }))
      return { ...summary, students, subjects: subs }
    }catch{
      return summary
    }
  }

  const loadSummary = async (examId) => {
    setLoading(true); setErr('')
    try {
      const { data } = await api.get(`/academics/exams/${examId}/summary/`)
      const hydrated = await hydrateWithRoster(examId, data)
      setSummary(hydrated)
    } catch (e) {
      setErr(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    } finally { setLoading(false) }
  }

  const download = async (examId, fmt) => {
    setErr('')
    console.log('Downloading:', { examId, fmt })
    
    // Validate exam ID
    if (!examId || isNaN(examId)) {
      const errMsg = `Invalid exam ID: ${examId}. Please select a valid exam from the dropdown.`
      setErr(errMsg)
      console.error(errMsg)
      return
    }
    
    try {
      const url = fmt === 'csv' ? `/academics/exams/${examId}/summary-csv/` : `/academics/exams/${examId}/summary-pdf/`
      console.log('Requesting:', url)
      
      const response = await api.get(url, { responseType: 'blob' })
      console.log('Response received:', response.status, response.headers)
      
      const blob = new Blob([response.data], { type: fmt === 'csv' ? 'text/csv' : 'application/pdf' })
      console.log('Blob created:', blob.size, 'bytes')
      
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `exam_${examId}_summary.${fmt}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
      console.log('Download initiated successfully')
    } catch (e) {
      console.error('Download error:', e)
      let errMsg = 'Download failed: '
      
      if (e.response) {
        // Server responded with error
        if (e.response.status === 404) {
          errMsg += 'Exam not found. Please select a valid exam.'
        } else if (e.response.status === 403) {
          errMsg += 'Permission denied. You may not have access to this exam.'
        } else if (e.response.status === 500) {
          errMsg += 'Server error. Please try again or contact support.'
        } else {
          errMsg += `Server error (${e.response.status})`
        }
        
        // Try to parse error message from blob
        try {
          const text = await e.response.data.text()
          const parsed = JSON.parse(text)
          if (parsed.detail) errMsg += `: ${parsed.detail}`
        } catch {}
      } else if (e.request) {
        // Request made but no response
        errMsg += 'No response from server. Please check your connection.'
      } else {
        // Error setting up request
        errMsg += e.message || 'Unknown error'
      }
      
      setErr(errMsg)
    }
  }

  const loadCompare = async (ids) => {
    const out = []
    for (const id of ids) {
      try {
        const { data } = await api.get(`/academics/exams/${id}/summary/`)
        const hydrated = await hydrateWithRoster(id, data)
        out.push({ id, data: hydrated })
      } catch (_) {}
    }
    setCompareSummaries(out)
  }

  useEffect(() => {
    if (selectedExam) loadSummary(selectedExam)
  }, [selectedExam])

  // When an exam is selected, auto-select all exams in the same grade that share the same (name, year, term)
  // so the Compare panel immediately shows class means across streams for that grade.
  useEffect(() => {
    try{
      if (!selectedExam) { return }
      const base = exams.find(e => String(e.id) === String(selectedExam))
      if (!base) { return }
      const sameBlock = exams.filter(e => String(e.name||'') === String(base.name||'') && String(e.year||'') === String(base.year||'') && String(e.term||'') === String(base.term||''))
      const ids = sameBlock.map(e => String(e.id))
      setCompareIds(ids)
    }catch{}
  }, [selectedExam, exams])

  useEffect(() => { loadCompare(compareIds) }, [compareIds])

  const classNameById = (id) => {
    const key = (typeof id === 'object' && id !== null) ? (id.id ?? id.pk ?? '') : id
    const sid = String(key)
    return classes.find(c=>String(c.id)===sid)?.name || key
  }

  // Build combined grade cohort results for the active exam block
  const blockResults = useMemo(() => {
    try{
      if (!selectedExam || compareSummaries.length === 0) return null
      // Map exam id -> class id for labeling
      const exById = new Map(exams.map(e => [String(e.id), e]))
      const rows = []
      const subjectMap = new Map() // subjectId -> { id, code, name }
      for (const cs of compareSummaries){
        const ex = exById.get(String(cs.id))
        const klassId = ex?.klass
        const klassName = classNameById(klassId)
        const summary = cs.data
        // collect subjects
        for (const s of (summary?.subjects || [])){
          const sid = String(s.id)
          if (!subjectMap.has(sid)) subjectMap.set(sid, { id: s.id, code: s.code, name: s.name })
        }
        // Each summary has students with percentages; compute total and average from percentages for consistency
        for (const st of (summary?.students || [])){
          let sumPct = 0
          let cntPct = 0
          for (const s of (summary?.subjects || [])){
            const pct = Number(st?.subject_percentages?.[String(s.id)])
            if (Number.isFinite(pct)) { sumPct += pct; cntPct += 1 }
          }
          const avgPct = cntPct ? (sumPct / cntPct) : 0
          rows.push({
            student_id: st.id,
            name: st.name,
            klass: klassName,
            total: Math.round(sumPct),
            average: avgPct,
            marks: st.marks || {},
            subject_percentages: st.subject_percentages || {},
          })
        }
      }
      // Rank across grade by total, ties share position
      rows.sort((a,b)=> b.total - a.total)
      let position = 0, last = null, seen = 0
      for (const r of rows){
        seen++
        if (last === null || r.total < last){ position = seen; last = r.total }
        r.position = position
      }
      const subjects = Array.from(subjectMap.values())
      return { students: rows, subjects }
    }catch{
      return null
    }
  }, [compareSummaries, exams, classes, selectedExam])

  // Convert numeric score to letter grade using admin-defined bands (fallback to defaults)
  const letterFromBands = (score, bands) => {
    const n = Number(score)
    if (!Number.isFinite(n)) return '-'
    const arr = Array.isArray(bands) ? [...bands] : []
    arr.sort((a,b)=> (a.order??0) - (b.order??0))
    for (const b of arr){
      const min = Number(b.min), max = Number(b.max)
      if (Number.isFinite(min) && Number.isFinite(max)){
        if (n >= min && n <= max) return String(b.grade || '-')
      }
    }
    if (n >= 80) return 'A'
    if (n >= 70) return 'B'
    if (n >= 60) return 'C'
    if (n >= 50) return 'D'
    return 'E'
  }

  const toGrade = (avg) => letterFromBands(avg, globalBands)

  const formatMean = (value) => {
    const v = Number(value)
    if (!Number.isFinite(v)) return '-'
    const r = Math.round(v * 100) / 100
    return Number.isInteger(r) ? String(r) : r.toFixed(2)
  }

  const blockSubjectMeanPct = useMemo(() => {
    try{
      const subjects = Array.isArray(blockResults?.subjects) ? blockResults.subjects : []
      const students = Array.isArray(blockResults?.students) ? blockResults.students : []
      if (!subjects.length || !students.length) return new Map()
      const out = new Map()
      for (const s of subjects){
        let sum = 0
        let cnt = 0
        for (const st of students){
          const pct = Number(st?.subject_percentages?.[String(s.id)])
          if (Number.isFinite(pct)) { sum += pct; cnt += 1 }
        }
        out.set(String(s.id), cnt ? (sum / cnt) : null)
      }
      return out
    }catch{
      return new Map()
    }
  }, [blockResults])

  const blockMean = useMemo(() => {
    try{
      const students = Array.isArray(blockResults?.students) ? blockResults.students : []
      if (!students.length) return { meanTotal: null, meanAvg: null }
      let sumTotal = 0
      let cntTotal = 0
      let sumAvg = 0
      let cntAvg = 0
      for (const s of students){
        const t = Number(s?.total)
        const a = Number(s?.average)
        if (Number.isFinite(t)) { sumTotal += t; cntTotal += 1 }
        if (Number.isFinite(a)) { sumAvg += a; cntAvg += 1 }
      }
      return {
        meanTotal: cntTotal ? (sumTotal / cntTotal) : null,
        meanAvg: cntAvg ? (sumAvg / cntAvg) : null,
      }
    }catch{
      return { meanTotal: null, meanAvg: null }
    }
  }, [blockResults])

  const classSubjectMeanPct = useMemo(() => {
    try{
      const arr = Array.isArray(summary?.subject_mean_percentages) ? summary.subject_mean_percentages : []
      const out = new Map()
      for (const row of arr){
        if (row && row.subject != null){
          out.set(String(row.subject), row.mean_percentage)
        }
      }
      return out
    }catch{
      return new Map()
    }
  }, [summary?.subject_mean_percentages])

  const classMean = useMemo(() => {
    try{
      const students = Array.isArray(summary?.students) ? summary.students : []
      if (!students.length) return { meanTotal: null, meanAvg: null }
      let sumTotal = 0
      let cntTotal = 0
      let sumAvg = 0
      let cntAvg = 0
      for (const s of students){
        const t = Number(s?.total)
        const a = Number(s?.average)
        if (Number.isFinite(t)) { sumTotal += t; cntTotal += 1 }
        if (Number.isFinite(a)) { sumAvg += a; cntAvg += 1 }
      }
      return {
        meanTotal: cntTotal ? (sumTotal / cntTotal) : null,
        meanAvg: cntAvg ? (sumAvg / cntAvg) : null,
      }
    }catch{
      return { meanTotal: null, meanAvg: null }
    }
  }, [summary?.students])

  // Fetch grading bands for subjects of the selected exam summary, choose first non-empty as global bands
  useEffect(() => {
    let active = true
    ;(async () => {
      try{
        const ids = Array.isArray(summary?.subjects) ? summary.subjects.map(s=>s.id).filter(Boolean) : []
        if (ids.length === 0) return
        const fetched = await Promise.allSettled(ids.map(async sid => {
          const res = await api.get(`/academics/subject_grading/?subject=${sid}`)
          return { sid, bands: Array.isArray(res?.data) ? res.data : [] }
        }))
        if (!active) return
        const map = new Map(bandsBySubject)
        let first = null
        for (const r of fetched){
          if (r.status === 'fulfilled'){
            map.set(r.value.sid, r.value.bands)
            if (!first && Array.isArray(r.value.bands) && r.value.bands.length>0) first = r.value.bands
          }
        }
        setBandsBySubject(map)
        if (first) setGlobalBands(first)
      }catch{}
    })()
    return () => { active = false }
  }, [summary?.subjects])

  return (
    <React.Fragment>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Results</h1>
        <div className="bg-white rounded shadow p-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="text-sm">Select Grade
              <select className="border p-2 rounded w-full mt-1" value={grade} onChange={e=>setGrade(e.target.value)}>
                <option value="">-- Choose Grade --</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Select Exam (in Grade)
              <select className="border p-2 rounded w-full mt-1" value={selectedExam} onChange={e=>setSelectedExam(e.target.value)}>
                <option value="">-- Choose Exam --</option>
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name} • {ex.year} • T{ex.term} • {classNameById(ex.klass)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="md:col-span-1">
            <label className="text-sm">Compare Classes (pick exams)
              <select multiple className="border p-2 rounded w-full mt-1 h-28" value={compareIds} onChange={e=>{
                const opts = Array.from(e.target.selectedOptions).map(o=>o.value)
                setCompareIds(opts)
              }}>
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{classNameById(ex.klass)} • {ex.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded shadow p-2">
          <div className="flex gap-2">
            <button onClick={()=>setTab('class')} className={`px-3 py-2 rounded ${tab==='class'?'bg-blue-600 text-white':'border'}`}>Class Results</button>
            <button onClick={()=>setTab('compare')} className={`px-3 py-2 rounded ${tab==='compare'?'bg-blue-600 text-white':'border'}`}>Compare Classes</button>
            <button onClick={()=>setTab('block')} className={`px-3 py-2 rounded ${tab==='block'?'bg-blue-600 text-white':'border'}`}>Block Results</button>
            <button onClick={()=>setTab('full')} className={`px-3 py-2 rounded ${tab==='full'?'bg-blue-600 text-white':'border'}`}>Full List</button>
          </div>
        </div>

        {tab==='class' && (
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Class Results</h2>
            <div className="flex items-center gap-3">
              {summary && <div className="text-sm text-gray-600">Class Mean: <span className="font-semibold">{Number.isFinite(Number(summary.class_mean)) ? Math.round(Number(summary.class_mean)) : '-'}</span></div>}
              {selectedExam && (
                <>
                  <button onClick={()=>download(selectedExam,'csv')} className="px-3 py-1.5 rounded border text-sm">Download CSV</button>
                  <button onClick={()=>download(selectedExam,'pdf')} className="px-3 py-1.5 rounded border text-sm">Download PDF</button>
                  <button onClick={printClassResults} className="px-3 py-1.5 rounded border text-sm">Print</button>
                </>
              )}
            </div>
          </div>
          {err && <div className="bg-red-50 text-red-700 text-sm p-2 rounded mb-2">{err}</div>}
          {!selectedExam ? (
            <div className="text-sm text-gray-600">Pick a grade and an exam to view class results.</div>
          ) : loading ? (
            <div>Loading...</div>
          ) : summary ? (
            <div className="overflow-auto rounded-xl border border-gray-200">
              <table ref={classResultsTableRef} className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border px-2 py-1 text-left">Position</th>
                    <th className="border px-2 py-1 text-left">Student</th>
                    {summary.subjects.map(s => (
                      <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
                    ))}
                    <th className="border px-2 py-1 text-left">Total</th>
                    <th className="border px-2 py-1 text-left">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.students.map((st, idx) => (
                    <tr key={st.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="border px-2 py-1">{st.position}</td>
                      <td className="border px-2 py-1">{st.name}</td>
                      {summary.subjects.map(s => {
                        const rawPct = st?.subject_percentages?.[String(s.id)]
                        const val = Number.isFinite(Number(rawPct)) ? Math.round(Number(rawPct)) : '-'
                        return (
                          <td key={s.id} className="border px-2 py-1">{val}</td>
                        )
                      })}
                      {(() => {
                        let sum = 0
                        let cnt = 0
                        for (const s of summary.subjects){
                          const pct = Number(st?.subject_percentages?.[String(s.id)])
                          if (Number.isFinite(pct)) { sum += pct; cnt += 1 }
                        }
                        const avg = cnt ? (sum / cnt) : 0
                        return (
                          <>
                            <td className="border px-2 py-1 font-medium">{Math.round(sum)}</td>
                            <td className="border px-2 py-1">{toGrade(avg)}</td>
                          </>
                        )
                      })()}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {(() => {
                    const totals = summary.subjects.map(s => {
                      let sum = 0
                      for (const st of summary.students){
                        const v = Number(st?.subject_percentages?.[String(s.id)])
                        if (Number.isFinite(v)) sum += v
                      }
                      return Math.round(sum)
                    })
                    const overall = totals.reduce((a,b)=>a+b,0)
                    return (
                      <tr className="bg-gray-50">
                        <td className="border px-2 py-1 font-medium" colSpan={2}>Grand Total</td>
                        {totals.map((t, idx) => (
                          <td key={`gt-${summary.subjects[idx].id}`} className="border px-2 py-1 font-medium">{t}</td>
                        ))}
                        <td className="border px-2 py-1 font-medium">{overall}</td>
                        <td className="border px-2 py-1"></td>
                      </tr>
                    )
                  })()}
                  <tr className="bg-gray-50">
                    <td className="border px-2 py-1 font-medium" colSpan={2}>Mean Score</td>
                    {summary.subjects.map(s => (
                      <td key={`mean-${s.id}`} className="border px-2 py-1 font-medium">{formatMean(classSubjectMeanPct.get(String(s.id)))}</td>
                    ))}
                    <td className="border px-2 py-1 font-medium">{formatMean(classMean.meanTotal)}</td>
                    <td className="border px-2 py-1">{toGrade(classMean.meanAvg)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-600">No data.</div>
          )}
          {summary && (
            <div className="mt-3 text-sm text-gray-700">
              <div className="font-medium mb-1">Subject Means</div>
              <div className="flex gap-3 flex-wrap">
                {summary.subject_mean_percentages.map(sm => (
                  <span key={sm.subject} className="px-2 py-1 rounded bg-gray-100">{summary.subjects.find(s=>s.id===sm.subject)?.code}: <b>{Number.isFinite(Number(sm.mean_percentage)) ? Math.round(Number(sm.mean_percentage)) : '-'}</b></span>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {tab==='full' && (
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Full Grade List</h2>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">Total students: <b>{blockResults?.students?.length || 0}</b></div>
              <input value={fullListSearch} onChange={e=>setFullListSearch(e.target.value)} placeholder="Search name or class" className="border p-2 rounded w-64 bg-white" />
              <button onClick={printFullList} className="px-3 py-1.5 rounded border text-sm">Print</button>
            </div>
          </div>
          {!selectedExam ? (
            <div className="text-sm text-gray-600">Pick a grade and an exam to view the full grade list.</div>
          ) : (!blockResults || !blockResults.students || blockResults.students.length===0) ? (
            <div className="text-sm text-gray-600">No data.</div>
          ) : (
            <div className="overflow-auto rounded-xl border border-gray-200">
              <table ref={fullListTableRef} className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border px-2 py-1 text-left">#</th>
                    <th className="border px-2 py-1 text-left">Student</th>
                    <th className="border px-2 py-1 text-left">Class</th>
                    {Array.isArray(blockResults.subjects) && blockResults.subjects.map(s => (
                      <th key={s.id} className="border px-2 py-1 text-left">{s.code}</th>
                    ))}
                    <th className="border px-2 py-1 text-left">Total</th>
                    <th className="border px-2 py-1 text-left">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {blockResults.students
                    .filter(r => {
                      const q = fullListSearch.trim().toLowerCase()
                      if (!q) return true
                      return String(r.name||'').toLowerCase().includes(q) || String(r.klass||'').toLowerCase().includes(q)
                    })
                    .map((r, idx) => (
                      <tr key={`${r.student_id}-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="border px-2 py-1">{idx+1}</td>
                        <td className="border px-2 py-1">{r.name}</td>
                        <td className="border px-2 py-1">{r.klass}</td>
                        {Array.isArray(blockResults.subjects) && blockResults.subjects.map(s => {
                          const rawPct = r?.subject_percentages?.[String(s.id)]
                          const val = Number.isFinite(Number(rawPct)) ? Math.round(Number(rawPct)) : '-'
                          return <td key={s.id} className="border px-2 py-1">{val}</td>
                        })}
                        <td className="border px-2 py-1">{r.total}</td>
                        <td className="border px-2 py-1">{toGrade(r.average)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="border px-2 py-1 font-medium" colSpan={3}>Mean Score</td>
                    {Array.isArray(blockResults.subjects) && blockResults.subjects.map(s => {
                      const m = blockSubjectMeanPct.get(String(s.id))
                      return (
                        <td key={`mean-${s.id}`} className="border px-2 py-1 font-medium">{formatMean(m)}</td>
                      )
                    })}
                    <td className="border px-2 py-1 font-medium">{formatMean(blockMean.meanTotal)}</td>
                    <td className="border px-2 py-1">{toGrade(blockMean.meanAvg)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        )}

        {tab==='compare' && (
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-medium mb-2">Compare Classes (by Class Mean)</h2>
          {compareSummaries.length === 0 ? (
            <div className="text-sm text-gray-600">Select one or more exams in the Compare multi-select to see class means.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead><tr><th>Class</th><th>Exam</th><th>Class Mean</th></tr></thead>
              <tbody>
                {compareSummaries.map(cs => {
                  const ex = exams.find(e=>String(e.id)===String(cs.id))
                  return (
                    <tr key={cs.id} className="border-t">
                      <td>{classNameById(ex?.klass)}</td>
                      <td>{ex?.name} • {ex?.year} • T{ex?.term}</td>
                      <td>{cs.data.class_mean}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        )}

        {tab==='block' && (
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Block Results (Grade Cohort)</h2>
            <div className="flex items-center gap-2">{selectedExam && <div className="text-sm text-gray-600">Classes compared: <b>{compareSummaries.length}</b></div>}</div>
          </div>
          {!selectedExam ? (
            <div className="text-sm text-gray-600">Pick a grade and an exam to view block results across all classes in that grade.</div>
          ) : (!blockResults || blockResults.students.length === 0) ? (
            <div className="text-sm text-gray-600">No student results found for this exam block.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Position</th>
                    <th className="border px-2 py-1 text-left">Student</th>
                    <th className="border px-2 py-1 text-left">Class</th>
                    <th className="border px-2 py-1 text-left">Total</th>
                    <th className="border px-2 py-1 text-left">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {blockResults.students.map((r, idx) => (
                    <tr key={`${r.student_id}-${idx}`}>
                      <td className="border px-2 py-1">{r.position}</td>
                      <td className="border px-2 py-1">{r.name}</td>
                      <td className="border px-2 py-1">{r.klass}</td>
                      <td className="border px-2 py-1 font-medium">{r.total}</td>
                      <td className="border px-2 py-1">{toGrade(r.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>
    </React.Fragment>
  )
}
