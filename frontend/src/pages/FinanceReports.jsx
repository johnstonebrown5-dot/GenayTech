import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, TimeScale } from 'chart.js'
import {
  Search,
  Printer,
  Download,
  Calendar,
  BarChart3,
  PieChart,
  BookOpen,
  Receipt,
  Users,
  GraduationCap,
  TrendingUp,
} from 'lucide-react'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend)

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'CASH', label: 'Cash' },
  { key: 'MPESA', label: 'Mpesa' },
  { key: 'BANK', label: 'Bank' },
]

export default function FinanceReports(){
  const [payments, setPayments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [prevPayments, setPrevPayments] = useState([])
  const [prevExpenses, setPrevExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const printRef = useRef(null)
  const [selectedDay, setSelectedDay] = useState('')
  const [preset, setPreset] = useState('')
  const [q, setQ] = useState('')

  useEffect(()=>{ load() }, [tab, dateFrom, dateTo])

  function applyPreset(p){
    setPreset(p)
    const today = new Date()
    const toISO = (d)=> d.toISOString().slice(0,10)
    if (p === '7d'){
      const start = new Date(); start.setDate(today.getDate()-7)
      setDateFrom(toISO(start)); setDateTo(toISO(today));
    } else if (p === '30d'){
      const start = new Date(); start.setDate(today.getDate()-30)
      setDateFrom(toISO(start)); setDateTo(toISO(today));
    } else if (p === 'ytd'){
      const start = new Date(today.getFullYear(), 0, 1)
      setDateFrom(toISO(start)); setDateTo(toISO(today));
    } else {
      setDateFrom(''); setDateTo('');
    }
  }

  async function load(){
    setLoading(true)
    try{
      const params = {}
      if (tab !== 'all') params.method = tab
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      // compute previous period range
      let from = dateFrom, to = dateTo
      if (!from || !to) {
        // default: infer from last 30 days
        const today = new Date(); const start = new Date(); start.setDate(today.getDate()-29)
        from = from || start.toISOString().slice(0,10)
        to = to || today.toISOString().slice(0,10)
      }
      const spanDays = Math.max(1, Math.ceil((Date.parse(to) - Date.parse(from)) / (1000*60*60*24)) + 1)
      const prevTo = new Date(Date.parse(from) - 24*60*60*1000)
      const prevFrom = new Date(prevTo); prevFrom.setDate(prevTo.getDate() - (spanDays-1))
      const prevParams = { ...(tab!=='all'? {method:tab}:{}), date_from: prevFrom.toISOString().slice(0,10), date_to: prevTo.toISOString().slice(0,10) }

      const [p, e, pp, pe] = await Promise.all([
        api.get('/finance/payments/', { params }),
        api.get('/finance/expenses/', { params: { date_from: dateFrom||from, date_to: dateTo||to } }),
        api.get('/finance/payments/', { params: prevParams }),
        api.get('/finance/expenses/', { params: { date_from: prevParams.date_from, date_to: prevParams.date_to } })
      ])
      const plist = Array.isArray(p.data) ? p.data : (p.data?.results || [])
      const elist = Array.isArray(e.data) ? e.data : (e.data?.results || [])
      const pprev = Array.isArray(pp.data) ? pp.data : (pp.data?.results || [])
      const eprev = Array.isArray(pe.data) ? pe.data : (pe.data?.results || [])
      setPayments(plist)
      setExpenses(elist)
      setPrevPayments(pprev)
      setPrevExpenses(eprev)
    }catch{ setPayments([]); setExpenses([]) }
    finally{ setLoading(false) }
  }

  const filtered = useMemo(()=> payments, [payments])
  const searched = useMemo(()=>{
    const s = String(q||'').trim().toLowerCase()
    if (!s) return filtered
    return filtered.filter(p => (
      String(p.student?.name||'').toLowerCase().includes(s) ||
      String(p.student?.admission_no||'').toLowerCase().includes(s) ||
      String(p.reference||'').toLowerCase().includes(s) ||
      String(p.invoice||'').toLowerCase().includes(s)
    ))
  }, [filtered, q])
  const totalAmt = useMemo(()=> searched.reduce((s,p)=> s + Number(p.amount||0), 0), [searched])
  const totalsByMethod = useMemo(()=>{
    const acc = { CASH:0, MPESA:0, BANK:0 }
    for (const p of searched){ const k=String(p.method||'').toUpperCase(); if (acc[k]!==undefined) acc[k]+=Number(p.amount||0) }
    return acc
  }, [searched])
  const totalExpenses = useMemo(()=> expenses.reduce((s,x)=> s+Number(x.amount||0),0), [expenses])
  const prevTotalPayments = useMemo(()=> prevPayments.reduce((s,p)=> s+Number(p.amount||0),0), [prevPayments])
  const prevTotalExpenses = useMemo(()=> prevExpenses.reduce((s,x)=> s+Number(x.amount||0),0), [prevExpenses])

  const toDay = d => (d||'').toString().slice(0,10)
  const daily = useMemo(()=>{
    const map = new Map()
    for (const p of searched){ const k=toDay(p.created_at||p.date); map.set(k,(map.get(k)||0)+Number(p.amount||0)) }
    return Array.from(map.entries()).sort((a,b)=> a[0].localeCompare(b[0]))
  }, [searched])
  const dailyExp = useMemo(()=>{
    const map = new Map()
    for (const x of expenses){ const k=toDay(x.created_at||x.date); map.set(k,(map.get(k)||0)+Number(x.amount||0)) }
    return Array.from(map.entries()).sort((a,b)=> a[0].localeCompare(b[0]))
  }, [expenses])

  const revenueTrend = useMemo(()=>({
    labels: daily.map(d=>d[0]),
    datasets: [
      { label:'Payments', data: daily.map(d=>d[1]), borderColor:'#10b981', backgroundColor:'rgba(16,185,129,.16)', tension:.35, pointRadius: 0, borderWidth: 2 },
      { label:'Expenses', data: dailyExp.map(d=>d[1]), borderColor:'#f43f5e', backgroundColor:'rgba(244,63,94,.12)', tension:.35, pointRadius: 0, borderWidth: 2 }
    ]
  }), [daily, dailyExp])

  const methodData = useMemo(()=>({
    labels:['Cash','Mpesa','Bank'],
    datasets:[{ data:[totalsByMethod.CASH, totalsByMethod.MPESA, totalsByMethod.BANK], backgroundColor:['#fde68a','#86efac','#93c5fd'], borderColor:['#f59e0b','#10b981','#3b82f6'] }]
  }), [totalsByMethod])

  const topPayers = useMemo(()=>{
    const map = new Map()
    for (const p of searched){ const key=(p.student?.name||'-')+'|'+(p.student?.admission_no||''); map.set(key,(map.get(key)||0)+Number(p.amount||0)) }
    return Array.from(map.entries()).map(([k,v])=>({ name:k.split('|')[0], adm:k.split('|')[1], total:v })).sort((a,b)=>b.total-a.total).slice(0,10)
  }, [searched])

  // Per-class revenue (by student.class label if present)
  const revenueByClass = useMemo(()=>{
    const map = new Map()
    for (const p of searched){ const k = p.student?.class || 'Unassigned'; map.set(k, (map.get(k)||0) + Number(p.amount||0)) }
    const arr = Array.from(map.entries()).sort((a,b)=> b[1]-a[1]).slice(0,12)
    return {
      labels: arr.map(x=>x[0]),
      datasets: [{ label:'Payments', data: arr.map(x=>x[1]), backgroundColor:'rgba(99,102,241,.35)', borderColor:'#6366f1', borderWidth: 1, borderRadius: 10 }]
    }
  }, [searched])

  function printPage(){
    const html = printRef.current?.innerHTML || ''
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Finance Reports</title><style>body{font-family:system-ui;-webkit-print-color-adjust:exact} h2{margin:4px 0} table{width:100%;border-collapse:collapse} th,td{padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px}</style></head><body>${html}</body></html>`)
    w.document.close(); w.focus(); w.print();
  }

  function exportCsvPayments(){
    const rows = [['Date','Student','Adm No','Invoice','Method','Reference','Amount']]
    for (const p of searched){
      rows.push([
        (p.created_at||p.date||'').toString().slice(0,10),
        p.student?.name||'',
        p.student?.admission_no||'',
        p.invoice||'',
        (p.method||'').toString().toUpperCase(),
        p.reference||'',
        String(p.amount||0),
      ])
    }
    const csv = rows.map(r=>r.map(v=>{ const s=String(v??''); const e=s.replaceAll('"','""'); return /[",\n]/.test(s)? `"${e}"`: s }).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='payments.csv'; a.click(); URL.revokeObjectURL(url)
  }

  function exportCsvExpenses(){
    const rows = [['Date','Category','Amount','Description']]
    for (const x of expenses){
      rows.push([
        (x.created_at||x.date||'').toString().slice(0,10),
        x.category_detail?.name || x.category || '',
        String(x.amount||0),
        (x.description||'').replaceAll('\n',' ')
      ])
    }
    const csv = rows.map(r=>r.map(v=>{ const s=String(v??''); const e=s.replaceAll('"','""'); return /[",\n]/.test(s)? `"${e}"`: s }).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='expenses.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const chartOptionsLine = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { usePointStyle: true, boxWidth: 6, boxHeight: 6 } },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,.95)',
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,.08)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(15,23,42,.06)' },
        ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(15,23,42,.06)' },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: (v) => `KES ${Number(v||0).toLocaleString()}`,
        },
      },
    },
  }

  const chartOptionsDoughnut = {
    plugins: { legend: { display: false } },
    cutout: '68%',
  }

  const chartOptionsBar = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: {
        grid: { color: 'rgba(15,23,42,.06)' },
        ticks: { color: '#64748b', font: { size: 11 }, callback: (v) => `KES ${Number(v||0).toLocaleString()}` },
      },
    },
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Reports</h1>
              <p className="text-white/70 text-sm mt-1">Finance analytics with filters, charts and exports.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:min-w-[320px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  value={q}
                  onChange={(e)=> setQ(e.target.value)}
                  placeholder="Search student, adm no, invoice, reference"
                  className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/30 focus:outline-none"
                />
              </div>
              <button
                onClick={printPage}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-white text-gray-900 hover:bg-gray-50 transition-all"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={exportCsvPayments}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              >
                <Download className="w-4 h-4" />
                Export payments
              </button>
              <button
                onClick={exportCsvExpenses}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
              >
                <Download className="w-4 h-4" />
                Export expenses
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-full p-1">
                {[
                  {k:'', label:'All'},
                  {k:'7d', label:'7D'},
                  {k:'30d', label:'30D'},
                  {k:'ytd', label:'YTD'},
                ].map(b => (
                  <button
                    key={b.k}
                    onClick={() => applyPreset(b.k)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-black transition ${preset===b.k ? 'bg-white text-gray-900' : 'text-white/80 hover:bg-white/10'}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-white/60 font-medium">Filter by date range</div>
            </div>

            <div className="flex flex-wrap items-end gap-2 w-full lg:w-auto">
              <div className="flex-1 min-w-[140px] sm:flex-none">
                <label className="block text-xs text-white/70 font-bold">From</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-2xl py-2.5 pl-10 pr-3 text-sm text-white focus:ring-2 focus:ring-white/30 focus:outline-none"/>
                </div>
              </div>
              <div className="flex-1 min-w-[140px] sm:flex-none">
                <label className="block text-xs text-white/70 font-bold">To</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-2xl py-2.5 pl-10 pr-3 text-sm text-white focus:ring-2 focus:ring-white/30 focus:outline-none"/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/finance/cashbook" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold border border-gray-200 bg-white hover:bg-gray-50 shadow-sm">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          Cashbook
        </Link>
        <Link to="/finance/fee-register" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold border border-gray-200 bg-white hover:bg-gray-50 shadow-sm">
          <Receipt className="w-4 h-4 text-emerald-600" />
          Fee Register
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="inline-flex items-center gap-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
          {TABS.map(t=> (
            <button
              key={t.key}
              onClick={()=>setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab===t.key? 'bg-gray-900 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="text-sm text-gray-500 font-medium">
          {loading ? 'Loading…' : `Showing ${searched.length} transaction(s)`}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">Total payments</div>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">KES {totalAmt.toLocaleString()}</div>
          <div className={`text-xs mt-1 font-bold ${(totalAmt-prevTotalPayments)>=0 ? 'text-emerald-600' : 'text-rose-600'}`}>Δ vs prev: KES {(totalAmt-prevTotalPayments).toLocaleString()}</div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-rose-500/10 blur-2xl" />
          <div className="flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">Total expenses</div>
            <BarChart3 className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-rose-600">KES {totalExpenses.toLocaleString()}</div>
          <div className={`text-xs mt-1 font-bold ${(totalExpenses-prevTotalExpenses)>=0 ? 'text-rose-600' : 'text-emerald-600'}`}>Δ vs prev: KES {(totalExpenses-prevTotalExpenses).toLocaleString()}</div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">Net</div>
            <PieChart className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">KES {(totalAmt-totalExpenses).toLocaleString()}</div>
          <div className="text-xs mt-1 font-bold text-gray-500">Δ vs prev: KES {((totalAmt-totalExpenses)-(prevTotalPayments-prevTotalExpenses)).toLocaleString()}</div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-sky-500/10 blur-2xl" />
          <div className="flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">Transactions</div>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{searched.length}</div>
          <div className="text-xs mt-1 font-bold text-gray-500">Payments filtered by method/date/search</div>
        </div>
      </div>

      <div ref={printRef} className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-indigo-700" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-gray-900">Daily totals</div>
                <div className="text-xs text-gray-500 font-medium">Payments vs expenses</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 font-medium">Click chart/day to drill down</div>
          </div>
          <div className="h-72">
            <Line data={revenueTrend} options={{
              ...chartOptionsLine,
              onClick: (evt, elements) => {
                if (elements && elements.length>0){
                  const idx = elements[0].index
                  if (idx!=null) setSelectedDay(revenueTrend.labels[idx])
                }
              }
            }} />
          </div>
          {/* Drilldown table */}
          <div className="mt-4 overflow-auto rounded-2xl border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600"><tr><th className="px-3 py-2 text-left font-black uppercase tracking-widest text-[10px]">Day</th><th className="px-3 py-2 text-right font-black uppercase tracking-widest text-[10px]">Payments</th><th className="px-3 py-2 text-right font-black uppercase tracking-widest text-[10px]">Expenses</th></tr></thead>
              <tbody>
                {revenueTrend.labels.map((d,i)=> (
                  <tr key={d} className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedDay===d? 'bg-indigo-50' : ''}`} onClick={()=>setSelectedDay(d)}>
                    <td className="px-3 py-2 font-semibold text-gray-700">{d}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-extrabold text-gray-900">{Number(revenueTrend.datasets[0].data[i]||0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-extrabold text-rose-600">{Number(revenueTrend.datasets[1].data[i]||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-gray-900">Method mix</div>
                <div className="text-xs text-gray-500 font-medium">Cash vs Mpesa vs Bank</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-32 h-32 sm:w-40 sm:h-40"><Doughnut data={methodData} options={chartOptionsDoughnut} /></div>
            <div className="text-sm space-y-2 w-full">
              <div className="flex items-center justify-between"><span className="font-semibold text-gray-700">Cash</span><span className="font-extrabold tabular-nums text-gray-900">KES {totalsByMethod.CASH.toLocaleString()}</span></div>
              <div className="flex items-center justify-between"><span className="font-semibold text-gray-700">Mpesa</span><span className="font-extrabold tabular-nums text-gray-900">KES {totalsByMethod.MPESA.toLocaleString()}</span></div>
              <div className="flex items-center justify-between"><span className="font-semibold text-gray-700">Bank</span><span className="font-extrabold tabular-nums text-gray-900">KES {totalsByMethod.BANK.toLocaleString()}</span></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-sky-50 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-sky-700" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-gray-900">Top payers</div>
                <div className="text-xs text-gray-500 font-medium">Top 10 by amount</div>
              </div>
            </div>
          </div>
          <div className="overflow-auto rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Student</th><th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Adm No</th><th className="px-4 py-3 text-right font-black uppercase tracking-widest text-[10px]">Amount</th></tr></thead>
            <tbody>
              {topPayers.map((t,i)=> (
                <tr key={i} className="border-t border-gray-100"><td className="px-4 py-2.5 font-semibold text-gray-900">{t.name}</td><td className="px-4 py-2.5 text-gray-700">{t.adm}</td><td className="px-4 py-2.5 text-right tabular-nums font-extrabold text-gray-900">KES {t.total.toLocaleString()}</td></tr>
              ))}
              {topPayers.length===0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">No data</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-violet-50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-violet-700" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-gray-900">Totals</div>
              <div className="text-xs text-gray-500 font-medium">Summary</div>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-700 font-semibold">Payments</span><span className="tabular-nums font-extrabold">KES {totalAmt.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-700 font-semibold">Expenses</span><span className="tabular-nums font-extrabold text-rose-600">KES {totalExpenses.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2 mt-2"><span className="text-gray-700 font-semibold">Net</span><span className="tabular-nums font-extrabold">KES {(totalAmt-totalExpenses).toLocaleString()}</span></div>
          </div>
        </div>

        {/* Per-class revenue */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-indigo-700" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-gray-900">Per-class revenue</div>
                <div className="text-xs text-gray-500 font-medium">Top 12 classes</div>
              </div>
            </div>
          </div>
          <div className="h-72">
            <Bar data={revenueByClass} options={chartOptionsBar} />
          </div>
        </div>

        {/* Drilldown transactions for selected day */}
        {selectedDay && (
          <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-extrabold text-gray-900">Transactions on {selectedDay}</div>
              <button className="text-xs font-bold text-gray-600 hover:text-gray-900" onClick={()=>setSelectedDay('')}>Clear</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="text-xs text-gray-500 mb-1">Payments</div>
                <div className="overflow-auto rounded-2xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600"><tr><th className="px-3 py-2 text-left font-black uppercase tracking-widest text-[10px]">Student</th><th className="px-3 py-2 text-right font-black uppercase tracking-widest text-[10px]">Amt</th><th className="px-3 py-2 font-black uppercase tracking-widest text-[10px]">Method</th></tr></thead>
                  <tbody>
                    {searched.filter(p=> (p.created_at||p.date||'').toString().slice(0,10)===selectedDay).map((p,i)=> (
                      <tr key={i} className="border-t border-gray-100"><td className="px-3 py-2 font-semibold text-gray-900">{p.student?.name||'-'}</td><td className="px-3 py-2 text-right tabular-nums font-extrabold text-gray-900">{Number(p.amount||0).toLocaleString()}</td><td className="px-3 py-2 font-semibold text-gray-700">{(p.method||'').toString().toUpperCase()}</td></tr>
                    ))}
                    {searched.filter(p=> (p.created_at||p.date||'').toString().slice(0,10)===selectedDay).length===0 && (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">No payments</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Expenses</div>
                <div className="overflow-auto rounded-2xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600"><tr><th className="px-3 py-2 text-left font-black uppercase tracking-widest text-[10px]">Category</th><th className="px-3 py-2 text-right font-black uppercase tracking-widest text-[10px]">Amt</th></tr></thead>
                  <tbody>
                    {expenses.filter(x=> (x.created_at||x.date||'').toString().slice(0,10)===selectedDay).map((x,i)=> (
                      <tr key={i} className="border-t border-gray-100"><td className="px-3 py-2 font-semibold text-gray-900">{x.category_detail?.name || x.category || ''}</td><td className="px-3 py-2 text-right tabular-nums font-extrabold text-rose-600">{Number(x.amount||0).toLocaleString()}</td></tr>
                    ))}
                    {expenses.filter(x=> (x.created_at||x.date||'').toString().slice(0,10)===selectedDay).length===0 && (
                      <tr><td colSpan={2} className="px-3 py-6 text-center text-gray-500">No expenses</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
