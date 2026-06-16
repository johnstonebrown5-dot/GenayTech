import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api'
import StudentReportCardViewer from './StudentReportCardViewer'

export default function StudentAllReportCards({ studentIdProp=null }){
  const { id } = useParams()
  const [resolvedStudentId, setResolvedStudentId] = useState(null)
  const studentId = useMemo(() => {
    const candidate = studentIdProp ?? id
    const n = Number(candidate)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [studentIdProp, id])
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const cardRefs = useRef({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (studentId) { if (alive) setResolvedStudentId(studentId); return }
      try {
        const st = await api.get('/academics/students/my/', { timeout: 20000 })
        const sid = Number(st?.data?.id)
        if (alive) setResolvedStudentId(Number.isFinite(sid) && sid > 0 ? sid : null)
      } catch {
        if (alive) setResolvedStudentId(null)
      }
    })()
    return () => { alive = false }
  }, [studentId])

  const printElement = (el, title='Report Card') => {
    if (!el) return
    const html = el.outerHTML
    const win = window.open('', '_blank')
    if (!win) return
    // Pull through existing styles so Tailwind/utility classes render correctly
    const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n')
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      ${headStyles}
      <style>
        /* Minimize margins to fit in one page. Some browsers still add small headers/footers. */
        @page{ size: A4; margin: 4mm; }
        html,body{ background:#fff; margin:0; padding:0; }
        body{ font-family:Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        /* Center card and reduce padding */
        .print-container{ max-width: 800px; margin: 0 auto; padding: 6px; }
        /* Avoid page breaks inside the card */
        .avoid-break{ page-break-inside: avoid; break-inside: avoid; }
        /* Compact typography for print */
        .print-container{ font-size: 12px; line-height: 1.2; }
        h1,h2,h3{ margin: 6px 0; }
        .p-6{ padding: 16px !important; }
        .p-8{ padding: 18px !important; }
        .p-3{ padding: 8px !important; }
        .px-3{ padding-left:8px !important; padding-right:8px !important; }
        .py-2{ padding-top:6px !important; padding-bottom:6px !important; }
        table{ font-size: 12px !important; }
        th,td{ padding: 6px 8px !important; }
        /* Initial scale; will be adjusted via script to ensure single page */
        .fit-scale{ transform: scale(1); transform-origin: top center; }
        /* Hide any elements marked as no-print within the cloned content */
        .no-print{ display:none !important; }
      </style>
    </head><body>
      <div class="print-container avoid-break fit-scale">${html}</div>
      <script>
        (function(){
          var didPrint = false;
          function fitOnce(){
            try{
              var el = document.querySelector('.print-container');
              if(!el){ window.print(); return }
              // Fit to actual A4 printable area (not the browser viewport), otherwise the preview shrinks too much.
              var marginMm = 4;
              var pxPerMm = 96 / 25.4;
              var availW = (210 - (marginMm * 2)) * pxPerMm;
              var availH = (297 - (marginMm * 2)) * pxPerMm;
              var rect = el.getBoundingClientRect();
              var w = rect.width || el.scrollWidth;
              var h = rect.height || el.scrollHeight;
              if (w > 0 && h > 0 && availW > 0 && availH > 0){
                // Fit width to A4; do NOT force-fit height to a single page (that makes preview tiny).
                var scale = Math.min(1, availW / w);
                el.style.transform = 'scale(' + scale + ')';
              }
            }catch(e){}
          }
          // Wait a tick for styles to apply, then print
          setTimeout(function(){
            if (didPrint) return;
            fitOnce();
            setTimeout(function(){ if (didPrint) return; didPrint = true; window.print(); }, 60);
          }, 60);
        })();
      </script>
    </body></html>`
    win.document.open()
    win.document.write(doc)
    try{ win.document.close(); win.focus(); }catch{}
  }

  useEffect(()=>{
    let active = true
    ;(async()=>{
      try{
        setLoading(true); setError('')
        const sid = resolvedStudentId
        if (!sid) return
        const res = await api.get(`/academics/exam_results/?student=${sid}`)
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
        if (active) setExamResults(rows)
      }catch(e){ if (active) setError(e?.response?.data?.detail || e?.message || 'Failed to load exams') }
      finally{ if (active) setLoading(false) }
    })()
    return ()=>{ active=false }
  }, [resolvedStudentId])

  const allExams = useMemo(()=>{
    const seen = new Set()
    const list = []
    for (const r of examResults){
      const ed = r.exam_detail || {}
      const id = ed.id || r.exam
      if (!id || seen.has(String(id))) continue
      seen.add(String(id))
      let year = ed.year || null
      if (!year && ed.date){ const d = new Date(ed.date); if (!isNaN(d)) year = d.getFullYear() }
      const term = ed.term || (ed.inferred_term && ed.inferred_term.number) || null
      list.push({ id, year, term })
    }
    list.sort((a,b)=>{
      const ya = Number(a.year||0), yb = Number(b.year||0)
      if (yb !== ya) return yb - ya
      const ta = Number(a.term||0), tb = Number(b.term||0)
      if (tb !== ta) return tb - ta
      return Number(b.id||0) - Number(a.id||0)
    })
    return list
  }, [examResults])

  const effectiveStudentId = resolvedStudentId
  const formatReportLabel = (exam) => {
    if (!exam) return 'Report Card'
    const termLabel = exam.term != null ? `Term ${exam.term}` : null
    const yearLabel = exam.year ? `${exam.year}` : null
    return [termLabel, yearLabel].filter(Boolean).join(' · ') || 'Report Card'
  }

  if (loading) return <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">Loading…</div>
  if (error) return <div className="p-6 max-w-3xl mx-auto bg-red-50 text-red-700 rounded border border-red-100">{error}</div>

  if (!allExams.length) return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">No report cards yet.</div>
  )

  return (
    <div className="px-4 sm:px-6 pb-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Academics</div>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Your Report Cards</h1>
              <p className="mt-3 text-sm text-slate-600">View, print, or download the term report cards available for this student.</p>
            </div>
            <Link
              to="/student/academics"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Back to Academics
            </Link>
          </div>
        </div>

        {allExams.map(ex => (
          <div key={ex.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm">
            <div className="flex flex-col gap-3 px-5 py-4 border-b bg-white/90 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{formatReportLabel(ex)}</div>
                <div className="mt-1 text-sm text-slate-500">Print or save a clean copy of this report card.</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => printElement(cardRefs.current[String(ex.id)], `ReportCard_${ex.year||''}_T${ex.term||''}_${ex.id}`)}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  onClick={() => printElement(cardRefs.current[String(ex.id)], `ReportCard_${ex.year||''}_T${ex.term||''}_${ex.id}`)}
                >
                  Download
                </button>
              </div>
            </div>
            <div ref={(node) => { if (node) cardRefs.current[String(ex.id)] = node }} className="bg-white">
              <StudentReportCardViewer
                embedded={true}
                hideControls={true}
                hideHistory={true}
                showTermSelector={false}
                showExamSelector={false}
                showBackPrint={true}
                studentIdProp={effectiveStudentId}
                autoFlow={true}
                autoFlowWidth={820}
                selectedTermYear={`${ex.year||''}${ex.term!=null?`-T${ex.term}`:''}`}
                selectedExamId={ex.id}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
