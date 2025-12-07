import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import api from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);
function amountToWordsKES(num){
    try{
        const n = Math.floor(Number(num)||0)
        if(n===0) return 'Zero Kenya Shillings Only'
        const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
        const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
        const s=['','Thousand','Million','Billion']
        const chunkToWords=(x)=>{
            let str=''
            const h=Math.floor(x/100), r=x%100
            if(h) str+=a[h]+' Hundred'
            if(r){ str+=(str?' ':'')+(r<20? a[r] : (b[Math.floor(r/10)] + (r%10? ' '+a[r%10] : '')))}
            return str
        }
        const parts=[]
        let i=0, m=n
        while(m>0 && i<s.length){ const chunk=m%1000; if(chunk){ parts.unshift(chunkToWords(chunk) + (s[i]? ' '+s[i] : '')) } m=Math.floor(m/1000); i++ }
        return parts.join(' ') + ' Kenya Shillings Only'
    }catch{ return '' }
}

export default function FinanceDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [preset, setPreset] = useState('');
    const [events, setEvents] = useState([]);
    const [viewMonth, setViewMonth] = useState(new Date());
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptLoading, setReceiptLoading] = useState(false);
    const [receipt, setReceipt] = useState(null);
    const [paperSize, setPaperSize] = useState('A5'); // A4 | A5 | 80mm
    const printableRef = useRef(null);
    const [printScale, setPrintScale] = useState(1);
    const [compactMode, setCompactMode] = useState(true);
    // Derived printable content width (mm)
    const pageWidthMm = paperSize === 'A4' ? 210 : paperSize === 'A5' ? 148 : 80;
    const sideMarginMm = paperSize === '80mm' ? 4 : (paperSize==='A5' ? 8 : 12); // must match @page margins
    const contentWidthMm = Math.max(40, pageWidthMm - (sideMarginMm * 2));

    // open and load receipt for a payment
    async function openReceipt(paymentId){
        setShowReceipt(true);
        setReceipt(null);
        setReceiptLoading(true);
        try{
            const { data } = await api.get(`/finance/payments/${paymentId}/receipt/`);
            setReceipt(data);
        }catch(e){
            try{
                const { data } = await api.get(`/finance/payments/${paymentId}/`);
                setReceipt({
                    fallback: true,
                    id: data.id,
                    date: data.created_at,
                    method: data.method,
                    reference: data.reference,
                    amount: data.amount,
                    invoice: data.invoice,
                });
            }catch(err){
                setReceipt({ error: e?.response?.data?.detail || e?.message || 'Failed to load receipt' });
            }
        } finally {
            setReceiptLoading(false);
        }
    }

    function printReceipt(){
        printInWindow();
    }

    // Auto-open print when receipt finishes loading
    useEffect(()=>{
        // Disabled auto print of the main window; use dedicated print window below
    }, [showReceipt, receipt, receiptLoading, paperSize])

    function groupAssignments(list){
        const arr = Array.isArray(list) ? list : []
        const map = new Map()
        for (const it of arr){
            const k = `${it.category||'Fee'}|${it.year||''}|${it.term||''}`
            const prev = map.get(k) || { ...it, amount: 0 }
            prev.amount = Number(prev.amount||0) + Number(it.amount||0)
            prev.category = it.category
            prev.year = it.year
            prev.term = it.term
            map.set(k, prev)
        }
        return Array.from(map.values())
    }

    function buildReceiptHTML(r){
        const page = paperSize==='A5' ? 'A5' : (paperSize==='80mm' ? '80mm' : 'A4')
        const widthMm = page==='A4'? 210 : page==='A5'? 148 : 80
        const side = page==='80mm'? 4 : (page==='A5'? 6 : 12)
        const top = page==='80mm'? 4 : (page==='A5'? 6 : 6)
        const bottom = page==='80mm'? 6 : (page==='A5'? 6 : 10)
        const contentWidth = Math.max(40, widthMm - side*2)
        const baseFont = page==='A5'? 14 : 12
        const accent = (r.school?.accent_color || r.school?.brand_color || r.school?.primary_color || '#2563eb')
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${window.location.origin}/receipt/${encodeURIComponent(r.receipt_no || r.id)}`)}`
        const dedup = groupAssignments(r.fee_assignments)
        const words = amountToWordsKES(r.amount)
        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${r.receipt_no || r.id}</title>
  <style>
    @page { size: ${page==='80mm' ? '80mm auto' : page+' portrait'}; margin: ${top}mm ${side}mm ${bottom}mm ${side}mm; }
    html, body { margin:0; padding:0; }
    :root { --accent:${accent}; --muted:#6b7280; --line:#e5e7eb; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { width: ${contentWidth}mm; margin: 0 auto; font-size: ${baseFont}px; line-height: 1.45; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
    .hdr { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid var(--line); padding:16px 0 12px; }
    .sch { font-weight:800; font-size: ${page==='A5'? 22 : 18}px; color: var(--accent); letter-spacing:.2px; }
    .addr { font-size:10px; color: var(--muted); }
    .motto { font-size:10px; color:#475569; font-style: italic; }
    .logo { width: 16mm; height: 16mm; object-fit: contain; margin-right: 6px; }
    .meta { text-align:right; font-size:11px; color:#334155; }
    .badge { display:inline-block; padding:2px 6px; border:1px solid var(--accent); color:var(--accent); border-radius:999px; font-size:10px; font-weight:600; letter-spacing:.03em; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: ${page==='A5'? 22 : 16}px; padding: ${page==='A5'? 16 : 12}px 0; }
    .sec-h { font-size: 10px; letter-spacing: .08em; color:var(--muted); text-transform:uppercase; margin-bottom:4px; }
    table { width:100%; border-collapse:collapse; table-layout: fixed; }
    thead th { background: #e9efff; color:#0f172a; font-size: 11px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); letter-spacing:.02em; }
    th, td { padding: ${page==='A5'? 13 : 10}px ${page==='A5'? 16 : 12}px; border-top:1px solid var(--line); word-wrap:break-word; }
    tbody tr:nth-child(even) { background:#fafafa; }
    tbody tr:last-child td { border-top:2px solid #9ca3af; font-weight:700; }
    tfoot td { border-top:1px solid var(--line); }
    .total-amt { color: var(--accent); font-size: 13px; font-weight:800; }
    .row-total td { background: rgba(37,99,235,.06); border-top:2px solid var(--accent); }
    .row-term td { background: #f8fafc; }
    .row-arrears td { background: #fff7ed; }
    .pill { display:inline-block; padding:4px 8px; border:1px solid var(--line); border-radius:999px; font-size:10px; margin-right:6px; }
    .pill-accent { border-color: var(--accent); color: var(--accent); font-weight:700; }
    .pill-warn { border-color: #f59e0b; color:#b45309; background:#fffbeb; }
    .sign { display:grid; grid-template-columns: 1fr auto; align-items: start; gap: ${page==='A5'? 24 : 18}px; padding-top: ${page==='A5'? 18 : 16}px; }
    .line { border-top:1px solid #94a3b8; height:14px; }
    .name-underline { display:inline-block; font-size: 12px; font-weight:700; padding-bottom: 2px; border-bottom: 1px solid #94a3b8; min-width: 60mm; }
    .stamp-space { min-height: 38mm; }
    .foot { display:flex; justify-content:space-between; color:var(--muted); font-size:10px; padding-top:10px; }
    .qr { text-align:right; }
    img { max-width:100%; height:auto; }
    /* Watermark */
    .wm { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; pointer-events:none; opacity:0.05; }
    .wm img { max-width:60%; max-height:60%; }
    /* Compact mode */
    .compact .wrap { font-size: 11px; }
    .compact .hdr { padding:8px 0 6px; }
    .compact .sch { font-size: 16px; }
    .compact th, .compact td { padding:6px 8px; }
    .compact .grid { gap: 10px; padding: 8px 0; }
  </style>
</head>
<body class="${compactMode ? 'compact' : ''}">
  ${r.school?.logo_url ? `<div class="wm"><img src="${r.school.logo_url}" alt=""/></div>` : ''}
  <div class="wrap">
    <div class="hdr">
      <div style="display:flex; align-items:center; gap:8px;">
        ${r.school?.logo_url ? `<img src="${r.school.logo_url}" alt="Logo" class="logo"/>` : ''}
        <div>
          <div class="sch">${(r.school?.name||'Payment Receipt')}</div>
          <div class="addr">${r.school?.address||''}</div>
          ${(r.school?.motto || r.school?.moto) ? `<div class="motto">${r.school.motto || r.school.moto}</div>` : ''}
        </div>
      </div>
      <div class="meta">
        <div>Date: ${String(r.date).slice(0,10)}</div>
        <div><span class="badge">Receipt</span> No: ${r.receipt_no || `PMT-${r.id}`}</div>
      </div>
    </div>
    <div class="grid">
      <div>
        <div class="sec-h">Payer</div>
        <div><strong>${r.student?.name||'-'}</strong></div>
        <div>Admission: ${r.student?.admission_no||'-'}</div>
        <div>Class: ${r.student?.class||'-'}</div>
      </div>
      <div>
        <div class="sec-h">Payment Details</div>
        <div>Method: ${(r.method||'').toString().toUpperCase()}</div>
        <div>Reference: ${r.reference||'-'}</div>
        <div>Invoice: ${r.invoice||'-'}</div>
      </div>
    </div>
    <table>
      <thead><tr><th align="left">Item</th><th align="right">KES</th></tr></thead>
      <tbody>
        ${(dedup.length>0) ? dedup.map(f=>`<tr><td>${f.category || 'Fee'} ${f.year?`(${f.year} Term ${f.term||''})`:''}</td><td align="right">${Number(f.amount||0).toLocaleString()}</td></tr>`).join('') : ''}
        ${(dedup.length===0 && r.invoice) ? `<tr><td>Invoice #${r.invoice} (Total)</td><td align="right">${Number(r.invoice_amount||0).toLocaleString()}</td></tr>`:''}
        <tr><td><strong>Paid now</strong></td><td align="right"><strong>${Number(r.amount||0).toLocaleString()}</strong></td></tr>
      </tbody>
      <tfoot>
        <tr class="row-term"><td align="right">This term balance</td><td align="right">${Number(r.current_term_balance||0).toLocaleString()}</td></tr>
        <tr class="row-arrears"><td align="right">Previous terms (arrears)</td><td align="right">${Number(r.arrears_balance||0).toLocaleString()}</td></tr>
        <tr><td align="right">Total balance</td><td align="right">${Number(r.student_balance||0).toLocaleString()}</td></tr>
      </tfoot>
    </table>
    
    <div class="words"><strong>Amount in words:</strong> ${words}</div>
    <div class="sign">
      <div>
        <div style="font-size:10px;color:#6b7280">Received by</div>
        <div class="name-underline">${r.recorded_by_name || '-'}</div>
        <div class="stamp-space"></div>
        <div class="line" style="margin-top:8px"></div>
        <div style="font-size:10px;color:#6b7280">Signature</div>
      </div>
      <div class="qr" style="text-align:right">
        <img src="${qrUrl}" alt="QR" />
        <div style="font-size:9px;color:#6b7280">Scan to verify</div>
      </div>
    </div>
    <div class="foot">
      <div>Thank you for your payment.</div>
      <div></div>
    </div>
  </div>
</body>
</html>`
    }

    function printInWindow(){
        if (!receipt) return
        const html = buildReceiptHTML(receipt)
        // Use a hidden iframe to ensure same-origin print without popup quirks
        const iframe = document.createElement('iframe')
        iframe.setAttribute('aria-hidden', 'true')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        // Prefer srcdoc for atomic load
        try { iframe.srcdoc = html } catch {}
        document.body.appendChild(iframe)
        let printed = false
        const onLoad = () => {
            try {
                const w = iframe.contentWindow
                // Small delay for images like QR to finish decode
                setTimeout(() => {
                    try { w?.focus(); w?.print(); printed = true } catch {}
                    // Remove after a short delay
                    setTimeout(() => { try { document.body.removeChild(iframe) } catch {} }, 500)
                }, 80)
            } catch {
                try { document.body.removeChild(iframe) } catch {}
            }
        }
        // If srcdoc isn't supported, write manually
        if (!iframe.srcdoc) {
            const doc = iframe.contentDocument || iframe.ownerDocument
            if (doc) { doc.open(); doc.write(html); doc.close(); }
        }
        // Attach load handler (covers both srcdoc and manual write)
        iframe.onload = onLoad
        // Last-resort fallback: if iframe didn't trigger, use native print of current page
        setTimeout(() => { if (!printed) { try { window.focus(); window.print() } catch {} } }, 1200)
    }

    // Do not auto print; user will click Print in the modal which is a reliable user gesture

    useEffect(() => {
        (async () => {
            try {
                const params = new URLSearchParams(dateRange).toString();
                const [summaryRes, eventsRes] = await Promise.allSettled([
                    api.get(`/finance/invoices/summary/?${params}`),
                    api.get('/communications/events/')
                ]);
                if (summaryRes.status === 'fulfilled') setStats(summaryRes.value.data); else setStats({ error: true });
                if (eventsRes.status === 'fulfilled') setEvents(Array.isArray(eventsRes.value.data) ? eventsRes.value.data : (eventsRes.value.data?.results || []));
            } catch (e) {
                console.error("Failed to load finance summary:", e);
                setStats({ error: true });
            } finally {
                setLoading(false);
            }
        })();
    }, [dateRange]);

    // Date range presets
    function applyPreset(p){
        setPreset(p);
        const today = new Date();
        const toISO = (d)=> d.toISOString().slice(0,10);
        if (p === '7d'){
            const start = new Date(); start.setDate(today.getDate()-7);
            setDateRange({ start: toISO(start), end: toISO(today) });
        } else if (p === '30d'){
            const start = new Date(); start.setDate(today.getDate()-30);
            setDateRange({ start: toISO(start), end: toISO(today) });
        } else if (p === 'ytd'){
            const start = new Date(today.getFullYear(), 0, 1);
            setDateRange({ start: toISO(start), end: toISO(today) });
        } else {
            setDateRange({ start: '', end: '' });
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (stats?.error) {
        return (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
                Failed to load dashboard data. Please try refreshing the page.
            </div>
        );
    }

    const revenueData = {
        labels: stats?.revenueTrend?.map(d => d.month) || [],
        datasets: [
            {
                label: 'Revenue',
                data: stats?.revenueTrend?.map(d => d.amount) || [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
            },
        ],
    };

    const expensesData = {
        labels: stats?.expenseBreakdown?.map(d => d.category) || [],
        datasets: [
            {
                label: 'Expenses',
                data: stats?.expenseBreakdown?.map(d => d.amount) || [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                ],
            },
        ],
    };

    const collectionRate = Math.max(0, Math.min(100, Number(stats?.collectionRate || 0)));
    const netPosition = Number(stats?.totalRevenue || 0) - Number(stats?.totalExpenses || 0);
    const collectionData = {
        labels: ['Collected', 'Outstanding'],
        datasets: [{
            data: [collectionRate, 100 - collectionRate],
            backgroundColor: ['#10B981', '#E5E7EB'],
            borderWidth: 0,
        }]
    };

    // Mini calendar helpers (local, same as TeacherDashboard style)
    const startOfMonth = (d) => { const x=new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x }
    const startOfCalendarGrid = (d) => { const first = startOfMonth(d); const day = first.getDay(); const diff = day; const gridStart = new Date(first); gridStart.setDate(first.getDate()-diff); gridStart.setHours(0,0,0,0); return gridStart }
    const buildMonthGrid = (d) => { const start = startOfCalendarGrid(d); const days=[]; for (let i=0;i<42;i++){ const day=new Date(start); day.setDate(start.getDate()+i); day.setHours(0,0,0,0); days.push(day) } return days }
    const localKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}` }
    const monthDays = buildMonthGrid(viewMonth)
    const eventsByDay = (events||[]).reduce((map, ev)=>{ const k = localKey(ev.start); if(!map[k]) map[k]=[]; map[k].push(ev); return map }, {})
    const colorForEvent = (ev) => { const key = (ev?.category || ev?.audience || ev?.visibility || '').toString().toLowerCase(); if (/student/.test(key)) return { chip:'bg-emerald-50 text-emerald-700 border-emerald-200', dot:'bg-emerald-500' }; if (/teach/.test(key)) return { chip:'bg-purple-50 text-purple-700 border-purple-200', dot:'bg-purple-500' }; if (/parent|guard/.test(key)) return { chip:'bg-amber-50 text-amber-700 border-amber-200', dot:'bg-amber-500' }; if (/exam|assessment|test/.test(key)) return { chip:'bg-rose-50 text-rose-700 border-rose-200', dot:'bg-rose-500' }; if (/holiday|break|vacation/.test(key)) return { chip:'bg-sky-50 text-sky-700 border-sky-200', dot:'bg-sky-500' }; return { chip:'bg-blue-50 text-blue-700 border-blue-200', dot:'bg-blue-500' } }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-50 rounded-3xl p-2.5 sm:p-3.5 lg:p-5 xl:p-6">
            <div className="h-full w-full rounded-3xl bg-white/80 shadow-elevated border border-emerald-50/80 backdrop-blur-xl flex flex-col gap-3.5 sm:gap-4.5 lg:gap-5 p-3 sm:p-4 lg:p-5">
                {/* Top bar: title, search, filters */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-0.5">
                        <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight text-slate-900">Finance overview</h1>
                        <p className="text-[10px] sm:text-[11px] text-slate-600">Track collections, expenses and cashflow across the school in one place.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full lg:w-auto">
                        <div className="flex-1 inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/70 px-2.5 py-1 shadow-inner">
                            <span className="text-slate-400 text-[11px]">🔎</span>
                            <input
                                placeholder="Search payments, students or invoices"
                                className="w-full bg-transparent border-none text-[11px] sm:text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                            />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                            <div className="hidden md:flex items-center gap-0.5 bg-slate-50 border border-slate-200 rounded-full p-0.5 shadow-inner">
                                {[
                                  {k:'', label:'All'},
                                  {k:'7d', label:'7D'},
                                  {k:'30d', label:'30D'},
                                  {k:'ytd', label:'YTD'},
                                ].map(b => (
                                  <button
                                      key={b.k}
                                      onClick={() => applyPreset(b.k)}
                                      className={`px-2.5 py-1 text-[10px] rounded-full transition ${preset===b.k ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-white'}`}
                                  >
                                      {b.label}
                                  </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    name="start"
                                    value={dateRange.start}
                                    onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))}
                                    className="w-24 sm:w-28 lg:w-32 border border-slate-200 rounded-xl bg-white/80 shadow-sm py-1 px-1.5 text-[10px] sm:text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                                <span className="text-[10px] text-slate-400">–</span>
                                <input
                                    type="date"
                                    name="end"
                                    value={dateRange.end}
                                    onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))}
                                    className="w-24 sm:w-28 lg:w-32 border border-slate-200 rounded-xl bg-white/80 shadow-sm py-1.5 px-2 text-[11px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary row: left overview card + right profit/revenue chart */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 lg:gap-5">
                    {/* Collections / card-like summary */}
                    <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-soft p-3 sm:p-4 lg:p-5 flex flex-col gap-3.5">
                        <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/20 blur-3 opacity-30" />
                        <div className="flex items-start justify-start gap-3 pr-20 sm:pr-24 lg:pr-32">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.15em] text-emerald-100 font-semibold">My school collections</div>
                                <div className="mt-0.5 text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight">
                                    KES {Number(stats?.totalRevenue || 0).toLocaleString()}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-100/90">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/20 px-2 py-0.5 border border-white/20">
                                        <span className="text-[10px]">▲</span>
                                        <span>{Math.round(stats?.trends?.totalRevenue || 0)}% vs last period</span>
                                    </span>
                                    <span>Collection rate {Math.round(collectionRate)}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="hidden sm:flex absolute right-3 sm:right-5 lg:right-7 top-3 sm:top-4 lg:top-5">
                            <div className="w-32 sm:w-36 lg:w-40 h-24 rounded-3xl bg-white/12 border border-white/25 shadow-inner flex flex-col justify-between p-2.5 text-[10px] backdrop-blur-sm">
                                <div className="flex items-center justify-between text-emerald-50">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                                        <span className="inline-block w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">💳</span>
                                        Fees card
                                    </span>
                                    <span className="text-[10px]">•••</span>
                                </div>
                                <div className="mt-1.5 text-[12px] leading-tight font-semibold tracking-wide">
                                    Outstanding
                                </div>
                                <div className="text-sm font-bold">
                                    KES {Number(stats?.outstandingFees || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div className="mt-auto pt-2 grid grid-cols-2 md:grid-cols-3 gap-1.5">
                            <button className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-900/10 hover:bg-emerald-900/20 border border-white/15 px-2.5 py-1.5 text-[10px] sm:text-xs font-medium transition">
                                <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-sm shrink-0">➕</span>
                                <span className="truncate">Record fee</span>
                            </button>
                            <Link
                                to="/finance/expenses"
                                className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-900/5 hover:bg-emerald-900/15 border border-white/15 px-2.5 py-1.5 text-[10px] sm:text-xs font-medium transition"
                            >
                                <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-sm shrink-0">💸</span>
                                <span className="truncate">New expense</span>
                            </Link>
                            <Link
                                to="/finance/reports"
                                className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-900/5 hover:bg-emerald-900/15 border border-white/15 px-2.5 py-1.5 text-[10px] sm:text-xs font-medium transition"
                            >
                                <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-sm shrink-0">📈</span>
                                <span className="truncate">View reports</span>
                            </Link>
                        </div>
                    </div>

                    {/* Profit / revenue chart */}
                    <div className="rounded-3xl bg-white/90 border border-slate-100 shadow-card px-3.5 py-2.5 sm:px-4.5 sm:py-3.5 flex flex-col">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                            <h2 className="text-xs sm:text-sm font-semibold text-slate-900">Profit & cashflow</h2>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Revenue
                                </span>
                            </div>
                        </div>
                        <div className="h-32 sm:h-40 md:h-44 lg:h-[11rem]">
                            <Line data={revenueData} options={{ responsive: true, maintainAspectRatio: false }} />
                        </div>
                    </div>
                </div>

                {/* Middle row: income / expenses / collection cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 lg:gap-4.5">
                    <StatCard
                        title="Net position"
                        value={netPosition}
                        icon="⚖️"
                        accent={netPosition >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600'}
                        format={v => `KES ${Number(v||0).toLocaleString()}`}
                        trend={stats?.trends?.totalRevenue}
                        animate
                    />
                    <StatCard
                        title="Expenses"
                        value={stats?.totalExpenses}
                        icon="💸"
                        accent="from-amber-500 to-orange-600"
                        format={v => `KES ${v?.toLocaleString()}`}
                        trend={stats?.trends?.totalExpenses}
                        animate
                    />
                    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white/90 shadow-card flex flex-col">
                        <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1">
                            <div>
                                <div className="text-[11px] font-medium text-slate-500">Collection rate</div>
                                <div className="mt-0.5 text-lg font-extrabold tracking-tight text-slate-900">{collectionRate}%</div>
                            </div>
                            <div className="w-18 sm:w-20">
                                <Doughnut data={collectionData} options={{ cutout: '70%', plugins:{legend:{display:false}} }} />
                            </div>
                        </div>
                        <div className="px-3.5 pb-2.5 text-[10px] text-slate-600 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Collected
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-slate-200" /> Outstanding
                            </span>
                        </div>
                    </div>
                </div>

                {/* Charts row: expense breakdown + calendar */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3.5 lg:gap-4.5">
                    <div className="rounded-3xl bg-white/95 backdrop-blur-sm border border-slate-100 shadow-card p-3.5 sm:p-4.5">
                        <div className="flex items-center justify-between mb-2.5">
                            <h2 className="text-xs sm:text-sm font-semibold text-slate-900">Spending by category</h2>
                            <span className="text-[10px] text-slate-500">KES {Number(stats?.totalExpenses || 0).toLocaleString()}</span>
                        </div>
                        <div className="h-40 sm:h-48 lg:h-56">
                            <Bar data={expensesData} options={{ responsive: true, indexAxis: 'y', maintainAspectRatio: false }} />
                        </div>
                    </div>

                    <div className="rounded-3xl bg-white/95 border border-slate-100 shadow-card p-3.5 sm:p-4.5 flex flex-col">
                        <div className="flex items-center justify-between mb-2.5">
                            <h2 className="text-xs sm:text-sm font-semibold text-slate-900">School calendar</h2>
                            <div className="flex items-center gap-1">
                                <button onClick={()=>setViewMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()-1); return d })} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs" aria-label="Previous month">‹</button>
                                <button onClick={()=>setViewMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()+1); return d })} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs" aria-label="Next month">›</button>
                                <button onClick={()=>setViewMonth(new Date())} className="px-2 py-1 text-[11px] rounded-full border border-slate-200 hover:bg-slate-50">Today</button>
                            </div>
                        </div>
                        <div className="text-[11px] text-slate-600 mb-1.5">{viewMonth.toLocaleString(undefined,{ month:'long', year:'numeric' })}</div>
                        <div className="space-y-2.5">
                            <div className="grid grid-cols-7 text-[9px] font-semibold text-slate-500 mb-0.5">
                                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="px-1 py-1 text-center tracking-wide">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-0.5">
                                {monthDays.map((d,i)=>{
                                    const key = localKey(d)
                                    const inMonth = d.getMonth()===viewMonth.getMonth()
                                    const isToday = key === localKey(new Date())
                                    const dayEvents = eventsByDay[key] || []
                                    const color = dayEvents.length>0 ? colorForEvent(dayEvents[0]) : null
                                    const baseBg = inMonth ? 'bg-white' : 'bg-slate-50'
                                    const activeBg = color ? color.chip.split(' ').find(c=>c.startsWith('bg-')) : baseBg
                                    return (
                                        <div key={i} className={`relative rounded-2xl min-h-[52px] p-1.5 text-[9px] border ${inMonth? 'border-slate-200':'border-slate-200/70'} ${dayEvents.length? activeBg : baseBg} hover:border-emerald-300 hover:shadow-soft transition-all`}>
                                            <div className="flex items-center justify-between">
                                                <div className={`${inMonth? 'text-slate-800':'text-slate-400'} text-[9px] font-semibold`}>{d.getDate()}</div>
                                                {isToday && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Today</span>}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap gap-0.5">
                                                {dayEvents.slice(0,2).map(ev => {
                                                    const c = colorForEvent(ev)
                                                    return (
                                                        <span key={ev.id} className={`px-1.5 py-0.5 rounded-full text-[8px] border truncate max-w-full ${c.chip}`} title={ev.title}>
                                                            {ev.title}
                                                        </span>
                                                    )
                                                })}
                                                {dayEvents.length>2 && <span className="text-[8px] text-slate-500">+{dayEvents.length-2} more</span>}
                                            </div>
                                            {dayEvents.length>0 && (
                                                <div className="absolute bottom-1 right-1 inline-flex items-center gap-1 text-[8px] text-slate-500">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${color?.dot || 'bg-blue-500'}`} />
                                                    {dayEvents.length}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom row: planning + latest transactions + side banner */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3.5 lg:gap-4.5">
                    <div className="rounded-3xl bg-white/95 border border-slate-100 shadow-card overflow-hidden flex flex-col">
                        <div className="px-3.5 sm:px-4.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xs sm:text-sm font-semibold text-slate-900">Latest transactions</h2>
                            <Link to="/finance/payments" className="text-[10px] font-medium text-emerald-700 hover:text-emerald-800">View all</Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px] sm:text-xs">
                                <thead className="text-[9px] sm:text-[10px] uppercase text-slate-600 bg-slate-50/80 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-3.5 sm:px-4.5 py-2 font-semibold">Transaction</th>
                                        <th className="px-3.5 sm:px-4.5 py-2 font-semibold">Date</th>
                                        <th className="px-3.5 sm:px-4.5 py-2 font-semibold">Amount</th>
                                        <th className="px-3.5 sm:px-4.5 py-2 font-semibold">Type</th>
                                        <th className="px-3.5 sm:px-4.5 py-2 font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(stats?.recentTransactions || []).map((t, i) => (
                                        <tr
                                            key={t.id || i}
                                            className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-emerald-50/70 cursor-pointer transition-colors`}
                                            onClick={()=>openReceipt(t.id)}
                                        >
                                            <td className="px-3.5 sm:px-4.5 py-2 font-medium text-slate-900 whitespace-nowrap">#{t.id}</td>
                                            <td className="px-3.5 sm:px-4.5 py-2 text-slate-700">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="px-3.5 sm:px-4.5 py-2 font-semibold text-slate-900">KES {Number(t.amount||0).toLocaleString()}</td>
                                            <td className="px-3.5 sm:px-4.5 py-2 capitalize text-slate-700">{t.type}</td>
                                            <td className="px-3.5 sm:px-4.5 py-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full border ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                    {t.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
                                        <tr><td colSpan={5} className="px-3.5 sm:px-4.5 py-5 text-center text-slate-500">No transactions yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-3.5 lg:gap-4.5">
                        <div className="rounded-3xl bg-white/95 border border-slate-100 shadow-card p-3.5 sm:p-4.5 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs sm:text-sm font-semibold text-slate-900">Planning</h2>
                                <button className="text-[10px] text-emerald-700 hover:text-emerald-800 font-medium">Add goal</button>
                            </div>
                            <div className="space-y-2.5 text-[11px] sm:text-xs">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-slate-800">Term fees target</span>
                                        <span className="text-slate-500">KES {Number(stats?.termTarget || 0).toLocaleString() || '—'}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${Math.min(100, collectionRate || 0)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-slate-800">Expense ceiling</span>
                                        <span className="text-slate-500">KES {Number(stats?.expenseLimit || 0).toLocaleString() || '—'}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" style={{ width: `${Math.min(100, (stats && stats.totalExpenses && stats.expenseLimit) ? (100 * Number(stats.totalExpenses)/Number(stats.expenseLimit||1)) : 45)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-card p-3.5 sm:p-4.5 flex flex-col justify-between">
                            <div>
                                <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium mb-1.5 border border-white/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                                    Collections insight
                                </div>
                                <h2 className="text-sm sm:text-base font-semibold tracking-tight">Outstanding fees</h2>
                                <p className="mt-0.5 text-[10px] sm:text-[11px] text-emerald-50/90 max-w-xs">
                                    KES {Number(stats?.outstandingFees || 0).toLocaleString()} still to be collected this term.
                                </p>
                            </div>
                            <div className="mt-2.5 flex items-end justify-between gap-2 text-[10px] sm:text-[11px]">
                                <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-emerald-100/90">Collection rate</span>
                                        <span className="font-semibold text-white">{collectionRate}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-emerald-900/30 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-white"
                                            style={{ width: `${Math.min(100, collectionRate || 0)}%` }}
                                        />
                                    </div>
                                </div>
                                <Link
                                    to="/finance/reports"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white/95 text-emerald-700 text-[10px] sm:text-[11px] font-semibold px-3 py-1.5 shadow-soft hover:bg-white transition whitespace-nowrap"
                                >
                                    View reports
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print styles injected when receipt modal is open */}
                {showReceipt && (
                    <style>{`
                      @page { margin: ${paperSize==='80mm' ? '4mm' : (paperSize==='A5' ? '8mm 8mm 12mm 8mm' : '0mm 12mm 10mm 12mm')}; ${paperSize==='A5' ? 'size: A5 portrait;' : paperSize==='80mm' ? 'size: 80mm auto;' : 'size: A4 portrait;'} }
                      @media print {
                        html, body { margin: 0 !important; padding: 0 !important; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
                        /* Hide everything except the printable node via visibility (prevents layout collapse) */
                        * { visibility: hidden !important; }
                        #printable-receipt, #printable-receipt * { visibility: visible !important; }
                        /* place it at the top-left for printing */
                        #printable-receipt { position: fixed; left: 0; top: 0; margin: 0 !important; padding-top: 0 !important; width: ${contentWidthMm}mm; max-width: ${contentWidthMm}mm; max-height: calc(100vh - 8mm); overflow: hidden; page-break-after: avoid; page-break-before: avoid; break-inside: avoid; font-size: ${paperSize==='A5' ? '13px' : '11px'}; line-height: ${paperSize==='A5' ? '1.45' : '1.2'}; }
                        #printable-receipt > *:first-child, #printable-receipt .header { margin-top: 0 !important; padding-top: 0 !important; }
                        #printable-receipt .wm { display: none !important; }
                      }
                      #printable-receipt table { width: 100% !important; }
                      #printable-receipt img { max-width: 100% !important; height: auto; }
                    }
                    /* On screen */
                    #printable-receipt { background: #ffffff; color: #111827; }
                  `}</style>
                )}

                {/* Receipt Modal */}
                <Modal open={showReceipt} onClose={()=>setShowReceipt(false)} title="Payment Receipt" size="md">
                {receiptLoading && (<div className="p-2 text-sm text-gray-600">Loading receipt...</div>)}
                {!receiptLoading && receipt?.error && (<div className="bg-red-50 text-red-700 text-sm p-2 rounded">{receipt.error}</div>)}
                {!receiptLoading && receipt && !receipt.error && (
                    <div id="printable-receipt" ref={printableRef} style={{ ['--print-scale']: printScale }} className={`relative text-sm ${compactMode ? 'compact' : ''}`}>
                        {/* Watermark */}
                        {receipt.school?.logo_url && (
                          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center no-break wm">
                            <img src={receipt.school.logo_url} alt="" className="opacity-5 w-[50%] max-w-[420px] -z-10" />
                          </div>
                        )}
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b no-break header">
                            <div className="flex items-center gap-3">
                                {receipt.school?.logo_url && (
                                    <img src={receipt.school.logo_url} alt="School Logo" className="w-12 h-12 object-contain" />
                                )}
                                <div>
                                    {(()=>{ const accent = (receipt.school?.accent_color || receipt.school?.brand_color || receipt.school?.primary_color || '#2563eb');
                                      return (
                                        <div className="text-xl font-bold" style={{ color: accent }}>{receipt.school?.name || 'Payment Receipt'}</div>
                                      )
                                    })()}
                                    <div className="text-xs text-gray-600">{receipt.school?.address || ''}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-600">Date</div>
                                <div className="font-medium">{String(receipt.date).slice(0,10)}</div>
                                <div className="text-xs text-gray-600 mt-1">Receipt No</div>
                                <div className="font-medium">{receipt.receipt_no || (receipt.fallback ? `PMT-${receipt.id}` : '-')}</div>
                            </div>
                        </div>

                        {/* Parties and meta */}
                        <div className="grid md:grid-cols-2 gap-6 py-3 no-break">
                            <div>
                                <div className="text-[11px] uppercase text-gray-600 mb-1">Payer</div>
                                <div className="font-medium">{receipt.student?.name || '-'}</div>
                                <div className="text-gray-700">Admission: {receipt.student?.admission_no || '-'}</div>
                                <div className="text-gray-700">Class: {receipt.student?.class || '-'}</div>
                            </div>
                            <div>
                                <div className="text-[11px] uppercase text-gray-600 mb-1">Payment Details</div>
                                <div className="text-gray-700">Method: {String(receipt.method || '').toUpperCase() || '-'}</div>
                                <div className="text-gray-700">Reference: {receipt.reference || '-'}</div>
                                <div className="text-gray-700">Invoice: {receipt.invoice || '-'}</div>
                            </div>
                        </div>

                        {/* Amounts table */}
                        <div className="rounded-xl border border-gray-200 overflow-hidden no-break mt-3">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-gray-600">
                                        <th className="px-4 py-2">Item</th>
                                        <th className="px-4 py-2 w-40 text-right">KES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.isArray(receipt.fee_assignments) && receipt.fee_assignments.map((f,i)=> (
                                      <tr key={`fa-${i}`} className="border-t">
                                        <td className="px-4 py-2">{f.category || 'Fee'} {f.year ? `(${f.year} Term ${f.term||''})` : ''}</td>
                                        <td className="px-4 py-2 text-right">{Number(f.amount||0).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                    {!receipt.fallback && (
                                        <tr className="border-t">
                                            <td className="px-4 py-2">Invoice #{receipt.invoice} (Total)</td>
                                            <td className="px-4 py-2 text-right">{Number(receipt.invoice_amount||0).toLocaleString()}</td>
                                        </tr>
                                    )}
                                    <tr className="border-t">
                                        <td className="px-4 py-2 font-medium">Paid now</td>
                                        <td className="px-4 py-2 text-right font-semibold">{Number(receipt.amount||0).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className="border-t">
                                        <td className="px-4 py-2 text-right font-semibold">Total paid today</td>
                                        {(()=>{ const accent = (receipt.school?.accent_color || receipt.school?.brand_color || receipt.school?.primary_color || '#2563eb');
                                            return <td className="px-4 py-2 text-right font-extrabold" style={{ color: accent }}>{Number(receipt.amount||0).toLocaleString()}</td>
                                        })()}
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2 text-right">This term balance</td>
                                        <td className="px-4 py-2 text-right">{Number(receipt.current_term_balance||0).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2 text-right">Previous terms (arrears)</td>
                                        <td className="px-4 py-2 text-right">{Number(receipt.arrears_balance||0).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2 text-right">Total balance</td>
                                        <td className="px-4 py-2 text-right">{Number(receipt.student_balance||0).toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Amount in words */}
                        <div className="mt-2 text-xs text-gray-700 no-break"><span className="font-medium">Amount in words:</span> {amountToWordsKES(receipt.amount)}</div>

                        {/* QR + Signature */}
                        <div className="grid grid-cols-[1fr_auto] gap-6 items-start pt-4 no-break mt-4">
                            <div>
                                <div className="text-xs text-gray-600">Received by</div>
                                <div className="inline-block border-b border-gray-400 font-semibold text-sm min-w-[240px]">{receipt.recorded_by_name || '-'}</div>
                                <div className="mt-6 min-h-[150px]" />
                                <div className="border-t border-gray-400 mt-2" />
                                <div className="text-xs text-gray-600 mt-1">Signature</div>
                            </div>
                            <div className="justify-self-end text-center">
                                {(()=>{
                                  const url = `${window.location.origin}/receipt/${encodeURIComponent(receipt.receipt_no || receipt.id)}`
                                  const src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}`
                                  return (
                                    <>
                                      <img src={src} alt="Receipt QR" className="w-28 h-28 ml-auto" />
                                      <div className="text-[10px] text-gray-600 mt-1">Scan to verify</div>
                                    </>
                                  )
                                })()}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-3 text-xs text-gray-600 flex items-center justify-between print:mt-4 no-break">
                            <div>Thank you for your payment.</div>
                            <div>Printed by EDU-TRACK Finance</div>
                        </div>

                        {/* On-screen controls only */}
                        <div className="mt-3 flex items-center justify-between gap-2 print-hidden">
                            <div className="flex items-center gap-1 text-xs">
                                <span className="text-gray-600">Paper:</span>
                                {['A4','A5','80mm'].map(ps => (
                                  <button key={ps} onClick={()=>setPaperSize(ps)} className={`px-2 py-1 rounded border ${paperSize===ps? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}`}>{ps}</button>
                                ))}
                                <span className="ml-2 text-gray-600">Layout:</span>
                                <button onClick={()=>setCompactMode(v=>!v)} className={`px-2 py-1 rounded border ${compactMode? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}`}>{compactMode? 'Compact' : 'Normal'}</button>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={printReceipt} className="px-3 py-2 rounded border">Print</button>
                            </div>
                        </div>
                    </div>
                )}
                </Modal>
            </div>
        </div>
    );
}
