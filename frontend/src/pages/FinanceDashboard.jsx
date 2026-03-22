import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { 
    LayoutDashboard, 
    Search, 
    Calendar as CalendarIcon, 
    CreditCard, 
    Plus, 
    TrendingUp, 
    ArrowUpRight, 
    ArrowDownRight, 
    Wallet, 
    Receipt, 
    FileText, 
    PieChart, 
    ChevronLeft, 
    ChevronRight,
    Printer,
    Download,
    Target,
    AlertCircle,
    Clock,
    DollarSign,
    MoreHorizontal
} from 'lucide-react';
import Modal from '../components/Modal';
import api from '../api';
import { toast } from 'react-hot-toast';

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

    const collectionRate = Math.max(0, Math.min(100, Number(stats?.collectionRate || 0)));
    const netPosition = Number(stats?.totalRevenue || 0) - Number(stats?.totalExpenses || 0);

    const revenueData = useMemo(() => ({
        labels: stats?.revenueTrend?.map(d => d.month) || [],
        datasets: [
            {
                label: 'Revenue',
                data: stats?.revenueTrend?.map(d => d.amount) || [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#10b981',
                pointHoverRadius: 6,
            },
        ],
    }), [stats]);

    const expensesData = useMemo(() => ({
        labels: stats?.expenseBreakdown?.map(d => d.category) || [],
        datasets: [
            {
                label: 'Expenses',
                data: stats?.expenseBreakdown?.map(d => d.amount) || [],
                backgroundColor: [
                    'rgba(244, 63, 94, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                ],
                borderRadius: 8,
                barThickness: 20,
            },
        ],
    }), [stats]);

    const collectionData = useMemo(() => ({
        labels: ['Collected', 'Outstanding'],
        datasets: [{
            data: [collectionRate, 100 - collectionRate],
            backgroundColor: ['#10B981', '#f1f5f9'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    }), [collectionRate]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1e293b',
                titleFont: { size: 12, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 12,
                borderRadius: 12,
                displayColors: false
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' }, color: '#64748b' } },
            y: { border: { display: false }, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10, weight: '600' }, color: '#64748b' } }
        }
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
        <div className="min-h-screen bg-gray-50/50 pb-20">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-6 py-6">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-600 mb-1">
                                <LayoutDashboard size={20} />
                                <span className="text-sm font-bold uppercase tracking-wider">Financial Insights</span>
                            </div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                                Finance <span className="text-emerald-600">Dashboard</span>
                            </h1>
                            <p className="text-gray-500 mt-1 font-medium">Track collections, expenses and school cashflow</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                            {/* Search */}
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                <input 
                                    placeholder="Search transactions..."
                                    className="h-12 w-full sm:w-64 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold focus:border-emerald-500 transition-all outline-none"
                                />
                            </div>

                            {/* Date Presets */}
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl border border-gray-200">
                                {[
                                    { k: '', label: 'All Time' },
                                    { k: '7d', label: '7D' },
                                    { k: '30d', label: '30D' },
                                    { k: 'ytd', label: 'YTD' },
                                ].map(b => (
                                    <button
                                        key={b.k}
                                        onClick={() => applyPreset(b.k)}
                                        className={`px-4 py-2 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${preset === b.k ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        {b.label}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Range */}
                            <div className="flex items-center gap-2 bg-white border-2 border-gray-100 p-1 rounded-2xl shadow-sm">
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 px-2 cursor-pointer"
                                />
                                <span className="text-gray-300 text-xs font-black">TO</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 px-2 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 py-8">
                {/* Top Statistics Row */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-8">
                    {/* Main Balance Card */}
                    <div className="xl:col-span-5 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 text-white shadow-2xl shadow-emerald-200 p-8 flex flex-col justify-between group">
                        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/10 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
                        <div className="absolute -left-20 -bottom-20 w-64 h-64 rounded-full bg-black/10 blur-3xl group-hover:bg-black/20 transition-all duration-700" />
                        
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner">
                                    <Wallet size={28} />
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/80 mb-1">Status</div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                        In Account
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="text-sm font-black text-emerald-100 uppercase tracking-widest opacity-80">Total Collections</div>
                                <div className="text-5xl font-black tracking-tighter flex items-baseline gap-2">
                                    <span className="text-2xl opacity-60">KES</span>
                                    {Number(stats?.totalRevenue || 0).toLocaleString()}
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-2 gap-4">
                                <div className="bg-white/10 border border-white/20 rounded-3xl p-4 backdrop-blur-sm">
                                    <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1 opacity-70">Outstanding</div>
                                    <div className="text-lg font-bold">KES {Number(stats?.outstandingFees || 0).toLocaleString()}</div>
                                </div>
                                <div className="bg-emerald-900/20 border border-white/10 rounded-3xl p-4 backdrop-blur-sm">
                                    <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1 opacity-70">Rate</div>
                                    <div className="text-lg font-bold">{Math.round(collectionRate)}% Verified</div>
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex items-center gap-3">
                            <button className="flex-1 h-12 rounded-2xl bg-white text-emerald-600 font-black text-xs uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                <Plus size={18} /> Record Fee
                            </button>
                            <Link to="/finance/expenses" className="flex-1 h-12 rounded-2xl bg-emerald-900/20 text-white border border-white/20 font-black text-xs uppercase tracking-widest hover:bg-emerald-900/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                                <DollarSign size={18} /> New Expense
                            </Link>
                        </div>
                    </div>

                    {/* Revenue Trend Chart */}
                    <div className="xl:col-span-7 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 tracking-tight">Revenue Trend</h2>
                                <p className="text-xs font-medium text-gray-500 italic">Monthly collection performance</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                                    <TrendingUp size={14} />
                                    +{Math.round(stats?.trends?.totalRevenue || 0)}%
                                </div>
                                <button className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center hover:text-gray-900 transition-colors">
                                    <MoreHorizontal size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[240px]">
                            <Line data={revenueData} options={chartOptions} />
                        </div>
                    </div>
                </div>

                {/* Secondary Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                    {/* Net Position Card */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-xl hover:shadow-gray-200/50 transition-all group">
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${netPosition >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                <TrendingUp size={24} />
                            </div>
                            <div className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${netPosition >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                {netPosition >= 0 ? 'Profitable' : 'Deficit'}
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Net Position</div>
                        <div className="text-xl font-black text-gray-900 tracking-tight">KES {Number(netPosition).toLocaleString()}</div>
                        <div className="mt-4 h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${netPosition >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: '70%' }} />
                        </div>
                    </div>

                    {/* Expenses Card */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-xl hover:shadow-gray-200/50 transition-all group">
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                                <DollarSign size={24} />
                            </div>
                            <Link to="/finance/expenses" className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 transition-colors">
                                <ChevronRight size={16} />
                            </Link>
                        </div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Expenses</div>
                        <div className="text-xl font-black text-gray-900 tracking-tight">KES {Number(stats?.totalExpenses || 0).toLocaleString()}</div>
                        <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                            <ArrowUpRight size={14} />
                            <span>{Math.round(stats?.trends?.totalExpenses || 0)}% vs last month</span>
                        </div>
                    </div>

                    {/* Collection Progress Card */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-xl hover:shadow-gray-200/50 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Collection Rate</div>
                                <div className="text-xl font-black text-gray-900 tracking-tight">{Math.round(collectionRate)}%</div>
                            </div>
                            <div className="w-14 h-14">
                                <Doughnut data={collectionData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                                <span className="text-emerald-600 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Paid
                                </span>
                                <span className="text-gray-400 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200" /> Pending
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Link Card */}
                    <div className="bg-emerald-50 rounded-[2rem] border border-emerald-100 shadow-sm p-6 flex flex-col justify-between group cursor-pointer hover:bg-emerald-100 transition-all border-dashed">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-white text-emerald-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                <FileText size={24} />
                            </div>
                            <ArrowUpRight size={20} className="text-emerald-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-emerald-900 tracking-tight">View Reports</h3>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Full analytics directory</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Left Column: Spending Breakdown */}
                    <div className="xl:col-span-4 space-y-8">
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Expense Mix</h2>
                                    <p className="text-xs font-medium text-gray-500 italic">Spending by category</p>
                                </div>
                                <PieChart size={20} className="text-gray-400" />
                            </div>
                            <div className="flex-1 min-h-[300px]">
                                <Bar data={expensesData} options={{ ...chartOptions, indexAxis: 'y' }} />
                            </div>
                            <div className="mt-8 space-y-4">
                                <div>
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                        <span className="text-gray-500">Fees Target</span>
                                        <span className="text-emerald-600">{Math.round(collectionRate)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-0.5">
                                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-sm" style={{ width: `${collectionRate}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                        <span className="text-gray-500">Budget Usage</span>
                                        <span className="text-amber-600">45% Used</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-0.5">
                                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 shadow-sm" style={{ width: '45%' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle Column: Latest Transactions */}
                    <div className="xl:col-span-5">
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
                            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
                                        <Receipt size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-gray-900 tracking-tight">Recent Activity</h2>
                                        <p className="text-xs font-medium text-gray-500 italic">Latest financial movements</p>
                                    </div>
                                </div>
                                <Link to="/finance/payments" className="h-10 px-4 rounded-xl bg-gray-50 border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-white hover:text-emerald-600 transition-all flex items-center justify-center gap-2">
                                    View All
                                    <ArrowUpRight size={14} />
                                </Link>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <div className="divide-y divide-gray-50">
                                    {(stats?.recentTransactions || []).map((t, i) => (
                                        <button 
                                            key={t.id || i}
                                            onClick={() => openReceipt(t.id)}
                                            className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-all group text-left"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${t.type === 'payment' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                                                    {t.type === 'payment' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-black text-gray-900 tracking-tight leading-none mb-1">ID #{t.id}</div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-gray-900 tracking-tight leading-none mb-1">KES {Number(t.amount || 0).toLocaleString()}</div>
                                                <div className={`text-[9px] font-black uppercase tracking-widest ${t.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    {t.status}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
                                        <div className="p-12 text-center">
                                            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                                                <Receipt size={32} className="text-gray-200" />
                                            </div>
                                            <h3 className="text-gray-400 font-black uppercase tracking-widest text-sm mb-1">No activity</h3>
                                            <p className="text-gray-400 text-xs font-medium">Transactions will appear here</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Mini Calendar */}
                    <div className="xl:col-span-3">
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 flex flex-col h-full overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Calendar</h2>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setViewMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d })} className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"><ChevronLeft size={16} /></button>
                                    <button onClick={() => setViewMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d })} className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"><ChevronRight size={16} /></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 text-center mb-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="text-[10px] font-black text-gray-300 uppercase">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {monthDays.map((d, i) => {
                                    const key = localKey(d);
                                    const inMonth = d.getMonth() === viewMonth.getMonth();
                                    const isToday = key === localKey(new Date());
                                    const dayEvents = eventsByDay[key] || [];
                                    const hasEvents = dayEvents.length > 0;

                                    return (
                                        <div 
                                            key={i} 
                                            className={`aspect-square rounded-xl flex items-center justify-center text-[10px] font-bold transition-all relative cursor-pointer
                                                ${inMonth ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-200'}
                                                ${isToday ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700' : ''}
                                                ${hasEvents && !isToday ? 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100' : ''}
                                            `}
                                        >
                                            {d.getDate()}
                                            {hasEvents && !isToday && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-8 space-y-3 flex-1 overflow-auto">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upcoming Events</h3>
                                {events.slice(0, 3).map(ev => {
                                    const c = colorForEvent(ev);
                                    return (
                                        <div key={ev.id} className="flex items-start gap-3 group">
                                            <div className={`w-1 h-10 rounded-full shrink-0 ${c.dot}`} />
                                            <div className="min-w-0">
                                                <div className="text-xs font-black text-gray-900 truncate group-hover:text-emerald-600 transition-colors">{ev.title}</div>
                                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{new Date(ev.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {events.length === 0 && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center py-4 italic">No scheduled events</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Receipt Modal and Styles */}
            {showReceipt && (
                <style>{`
                    @page { margin: ${paperSize === '80mm' ? '4mm' : (paperSize === 'A5' ? '8mm 8mm 12mm 8mm' : '0mm 12mm 10mm 12mm')}; ${paperSize === 'A5' ? 'size: A5 portrait;' : paperSize === '80mm' ? 'size: 80mm auto;' : 'size: A4 portrait;'} }
                    @media print {
                        html, body { margin: 0 !important; padding: 0 !important; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
                        * { visibility: hidden !important; }
                        #printable-receipt, #printable-receipt * { visibility: visible !important; }
                        #printable-receipt { position: fixed; left: 0; top: 0; margin: 0 !important; padding-top: 0 !important; width: ${contentWidthMm}mm; max-width: ${contentWidthMm}mm; max-height: calc(100vh - 8mm); overflow: hidden; page-break-after: avoid; page-break-before: avoid; break-inside: avoid; font-size: ${paperSize === 'A5' ? '13px' : '11px'}; line-height: ${paperSize === 'A5' ? '1.45' : '1.2'}; }
                        #printable-receipt .wm { display: none !important; }
                    }
                    #printable-receipt { background: #ffffff; color: #111827; }
                `}</style>
            )}

            <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title="Payment Receipt" size="md">
                {receiptLoading ? (
                    <div className="p-12 text-center">
                        <Clock size={40} className="text-emerald-200 animate-spin mx-auto mb-4" />
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Gathering Receipt Details...</p>
                    </div>
                ) : receipt?.error ? (
                    <div className="p-8 text-center bg-rose-50 rounded-3xl border border-rose-100">
                        <AlertCircle size={40} className="text-rose-400 mx-auto mb-4" />
                        <p className="text-sm font-black text-rose-700">{receipt.error}</p>
                    </div>
                ) : receipt && (
                    <div className="space-y-8">
                        <div id="printable-receipt" ref={printableRef} className={`relative p-2 rounded-2xl border border-gray-100 shadow-inner ${compactMode ? 'compact' : ''}`}>
                            {/* Header */}
                            <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                                <div className="flex items-center gap-4">
                                    {receipt.school?.logo_url && <img src={receipt.school.logo_url} alt="Logo" className="w-16 h-16 object-contain" />}
                                    <div>
                                        <div className="text-2xl font-black text-gray-900 tracking-tight leading-none mb-1">{receipt.school?.name || 'Payment Receipt'}</div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{receipt.school?.address || 'School Financial Document'}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Receipt No</div>
                                    <div className="text-lg font-black text-gray-900 tracking-tighter">#{receipt.receipt_no || (receipt.fallback ? `PMT-${receipt.id}` : receipt.id)}</div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{String(receipt.date).slice(0, 10)}</div>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-8 py-6">
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Payer Details</div>
                                    <div className="font-black text-gray-900 leading-none mb-1">{receipt.student?.name || '-'}</div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Adm: {receipt.student?.admission_no || '-'}</div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Class: {receipt.student?.class || '-'}</div>
                                </div>
                                <div className="space-y-3 text-right">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Payment Info</div>
                                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Method: <span className="text-emerald-600">{String(receipt.method || '').toUpperCase()}</span></div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ref: {receipt.reference || '-'}</div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice: #{receipt.invoice || '-'}</div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm mb-6">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
                                        <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3 text-right">Amount (KES)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {Array.isArray(receipt.fee_assignments) && receipt.fee_assignments.map((f, i) => (
                                            <tr key={`fa-${i}`}>
                                                <td className="px-6 py-4 font-bold text-gray-700">{f.category || 'Fee'} {f.year ? `(${f.year} T${f.term || ''})` : ''}</td>
                                                <td className="px-6 py-4 text-right font-black text-gray-900">{Number(f.amount || 0).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-emerald-50/30">
                                            <td className="px-6 py-4 font-black text-emerald-900 uppercase tracking-widest">Amount Paid</td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-600 text-base">{Number(receipt.amount || 0).toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot className="bg-gray-50/50">
                                        <tr>
                                            <td className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Closing Balance</td>
                                            <td className="px-6 py-3 text-right font-black text-gray-900">{Number(receipt.student_balance || 0).toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="text-[10px] font-bold text-gray-500 italic mb-8 border-l-2 border-emerald-500 pl-3 py-1 bg-emerald-50/30 rounded-r-lg">
                                Word: {amountToWordsKES(receipt.amount)}
                            </div>

                            {/* Signatures */}
                            <div className="flex items-end justify-between gap-8 pt-4 border-t border-dashed border-gray-200">
                                <div className="flex-1 space-y-6">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Authorization</div>
                                    <div className="text-sm font-black text-gray-900 leading-none pb-2 border-b border-gray-300 min-w-[200px]">{receipt.recorded_by_name || '-'}</div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Authorized Signature</div>
                                </div>
                                <div className="text-center">
                                    {(() => {
                                        const url = `${window.location.origin}/receipt/${encodeURIComponent(receipt.receipt_no || receipt.id)}`
                                        const src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}`
                                        return (
                                            <>
                                                <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm mb-2">
                                                    <img src={src} alt="Verification QR" className="w-20 h-20" />
                                                </div>
                                                <div className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Scan to Verify</div>
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Paper:</div>
                                {['A4', 'A5', '80mm'].map(ps => (
                                    <button 
                                        key={ps} 
                                        onClick={() => setPaperSize(ps)} 
                                        className={`h-10 px-4 rounded-xl text-xs font-black transition-all border-2 ${paperSize === ps ? 'bg-gray-900 border-gray-900 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'}`}
                                    >
                                        {ps}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setCompactMode(!compactMode)}
                                    className={`h-10 px-4 rounded-xl text-xs font-black transition-all border-2 ${compactMode ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'}`}
                                >
                                    {compactMode ? 'Compact' : 'Normal'}
                                </button>
                                <button 
                                    onClick={printReceipt}
                                    className="h-12 px-8 rounded-2xl bg-emerald-600 text-white font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} /> Print Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
