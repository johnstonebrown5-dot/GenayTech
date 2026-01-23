import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import StudentReportCardViewer from './StudentReportCardViewer'

export default function StudentAllReportCards(){
  const { id } = useParams()
  const studentId = Number(id)
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const cardRefs = useRef({})

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
        if (!studentId) return
        const res = await api.get(`/academics/exam_results/?student=${studentId}`)
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
        if (active) setExamResults(rows)
      }catch(e){ if (active) setError(e?.response?.data?.detail || e?.message || 'Failed to load exams') }
      finally{ if (active) setLoading(false) }
    })()
    return ()=>{ active=false }
  }, [studentId])

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

  if (loading) return <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">Loading…</div>
  if (error) return <div className="p-6 max-w-3xl mx-auto bg-red-50 text-red-700 rounded border border-red-100">{error}</div>

  if (!allExams.length) return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">No report cards yet.</div>
  )

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {allExams.map(ex => (
          <div key={ex.id} className="border rounded-xl overflow-hidden bg-white shadow">
            <div className="flex items-center justify-end gap-2 p-3 border-b bg-slate-50">
              <button
                type="button"
                className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
                onClick={() => printElement(cardRefs.current[String(ex.id)], `ReportCard_${ex.year||''}_T${ex.term||''}_${ex.id}`)}
              >Print</button>
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                onClick={() => printElement(cardRefs.current[String(ex.id)], `ReportCard_${ex.year||''}_T${ex.term||''}_${ex.id}`)}
              >Download</button>
            </div>
            <div ref={(node)=>{ if (node) cardRefs.current[String(ex.id)] = node }}>
            <StudentReportCardViewer
              embedded={true}
              hideControls={true}
              hideHistory={true}
              showTermSelector={false}
              showExamSelector={false}
              showBackPrint={true}
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
