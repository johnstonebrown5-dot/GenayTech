import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, TimeScale } from 'chart.js'
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

  useEffect(()=>{ load() }, [tab, dateFrom, dateTo])

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
  const totalAmt = useMemo(()=> filtered.reduce((s,p)=> s + Number(p.amount||0), 0), [filtered])
  const totalsByMethod = useMemo(()=>{
    const acc = { CASH:0, MPESA:0, BANK:0 }
    for (const p of filtered){ const k=String(p.method||'').toUpperCase(); if (acc[k]!==undefined) acc[k]+=Number(p.amount||0) }
    return acc
  }, [filtered])
  const totalExpenses = useMemo(()=> expenses.reduce((s,x)=> s+Number(x.amount||0),0), [expenses])
  const prevTotalPayments = useMemo(()=> prevPayments.reduce((s,p)=> s+Number(p.amount||0),0), [prevPayments])
  const prevTotalExpenses = useMemo(()=> prevExpenses.reduce((s,x)=> s+Number(x.amount||0),0), [prevExpenses])

  const toDay = d => (d||'').toString().slice(0,10)
  const daily = useMemo(()=>{
    const map = new Map()
    for (const p of filtered){ const k=toDay(p.created_at||p.date); map.set(k,(map.get(k)||0)+Number(p.amount||0)) }
    return Array.from(map.entries()).sort((a,b)=> a[0].localeCompare(b[0]))
  }, [filtered])
  const dailyExp = useMemo(()=>{
    const map = new Map()
    for (const x of expenses){ const k=toDay(x.created_at||x.date); map.set(k,(map.get(k)||0)+Number(x.amount||0)) }
    return Array.from(map.entries()).sort((a,b)=> a[0].localeCompare(b[0]))
  }, [expenses])

  const revenueTrend = useMemo(()=>({
    labels: daily.map(d=>d[0]),
    datasets: [
      { label:'Payments', data: daily.map(d=>d[1]), borderColor:'#16a34a', backgroundColor:'rgba(34,197,94,.2)', tension:.25 },
      { label:'Expenses', data: dailyExp.map(d=>d[1]), borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,.2)', tension:.25 }
    ]
  }), [daily, dailyExp])

  const methodData = useMemo(()=>({
    labels:['Cash','Mpesa','Bank'],
    datasets:[{ data:[totalsByMethod.CASH, totalsByMethod.MPESA, totalsByMethod.BANK], backgroundColor:['#fde68a','#86efac','#93c5fd'], borderColor:['#f59e0b','#10b981','#3b82f6'] }]
  }), [totalsByMethod])

  const topPayers = useMemo(()=>{
    const map = new Map()
    for (const p of filtered){ const key=(p.student?.name||'-')+'|'+(p.student?.admission_no||''); map.set(key,(map.get(key)||0)+Number(p.amount||0)) }
    return Array.from(map.entries()).map(([k,v])=>({ name:k.split('|')[0], adm:k.split('|')[1], total:v })).sort((a,b)=>b.total-a.total).slice(0,10)
  }, [filtered])

  // Per-class revenue (by student.class label if present)
  const revenueByClass = useMemo(()=>{
    const map = new Map()
    for (const p of filtered){ const k = p.student?.class || 'Unassigned'; map.set(k, (map.get(k)||0) + Number(p.amount||0)) }
    const arr = Array.from(map.entries()).sort((a,b)=> b[1]-a[1]).slice(0,12)
    return {
      labels: arr.map(x=>x[0]),
      datasets: [{ label:'Payments', data: arr.map(x=>x[1]), backgroundColor:'#93c5fd', borderColor:'#3b82f6' }]
    }
  }, [filtered])

  function printPage(){
    const html = printRef.current?.innerHTML || ''
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Finance Reports</title><style>body{font-family:system-ui;-webkit-print-color-adjust:exact} h2{margin:4px 0} table{width:100%;border-collapse:collapse} th,td{padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px}</style></head><body>${html}</body></html>`)
    w.document.close(); w.focus(); w.print();
  }

  function exportCsvPayments(){
    const rows = [['Date','Student','Adm No','Invoice','Method','Reference','Amount']]
    for (const p of filtered){
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Reports</h1>
          <p className="text-sm text-gray-500">Finance analytics with filters, charts and exports.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
          <div className="flex-1 min-w-[140px] sm:flex-none">
            <label className="block text-xs text-gray-600">From</label>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border rounded text-sm w-full"/>
          </div>
          <div className="flex-1 min-w-[140px] sm:flex-none">
            <label className="block text-xs text-gray-600">To</label>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border rounded text-sm w-full"/>
          </div>
          <button onClick={printPage} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm shadow-sm hover:bg-gray-800">Print</button>
          <button onClick={exportCsvPayments} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm shadow-sm hover:bg-emerald-700">Export Payments CSV</button>
          <button onClick={exportCsvExpenses} className="px-3 py-2 bg-rose-600 text-white rounded-lg text-sm shadow-sm hover:bg-rose-700">Export Expenses CSV</button>
        </div>
      </div>

      {/* Quick links to detailed reports */}
      <div className="flex flex-wrap gap-2">
        <Link to="/finance/cashbook" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border bg-white hover:bg-gray-50 shadow-sm">
          <span>📘</span>
          <span>Cashbook</span>
        </Link>
        <Link to="/finance/fee-register" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border bg-white hover:bg-gray-50 shadow-sm">
          <span>🧾</span>
          <span>Fee Register</span>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(t=> (
          <button key={t.key} onClick={()=>setTab(t.key)} className={`px-3 py-1.5 rounded-full text-sm border transition shadow-sm ${tab===t.key? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}>{t.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Total Payments</div>
          <div className="text-2xl font-semibold tabular-nums">{totalAmt.toLocaleString()}</div>
          <div className={`text-xs mt-1 ${ (totalAmt-prevTotalPayments)>=0 ? 'text-emerald-600' : 'text-rose-600' }`}>Δ vs prev: {(totalAmt-prevTotalPayments).toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Total Expenses</div>
          <div className="text-2xl font-semibold tabular-nums text-rose-600">{totalExpenses.toLocaleString()}</div>
          <div className={`text-xs mt-1 ${ (totalExpenses-prevTotalExpenses)>=0 ? 'text-rose-600' : 'text-emerald-600' }`}>Δ vs prev: {(totalExpenses-prevTotalExpenses).toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Net</div>
          <div className="text-2xl font-semibold tabular-nums">{(totalAmt-totalExpenses).toLocaleString()}</div>
          <div className="text-xs mt-1">Δ vs prev: {((totalAmt-totalExpenses)-(prevTotalPayments-prevTotalExpenses)).toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Transactions</div>
          <div className="text-2xl font-semibold tabular-nums">{filtered.length}</div>
        </div>
      </div>

      <div ref={printRef} className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="mb-2 text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs">📈</span>
            Daily totals
          </div>
          <div className="h-72">
            <Line data={revenueTrend} options={{
              responsive:true,
              maintainAspectRatio:false,
              plugins:{ legend:{ display:true }},
              scales:{
                x:{ grid:{ color:'#eef2ff' } },
                y:{ grid:{ color:'#eef2ff' } }
              },
              onClick: (evt, elements) => {
                if (elements && elements.length>0){
                  const idx = elements[0].index
                  if (idx!=null) setSelectedDay(revenueTrend.labels[idx])
                }
              }
            }} />
          </div>
          {/* Drilldown table */}
          <div className="mt-3 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600"><tr><th className="px-2 py-1 text-left">Day</th><th className="px-2 py-1 text-right">Payments</th><th className="px-2 py-1 text-right">Expenses</th></tr></thead>
              <tbody>
                {revenueTrend.labels.map((d,i)=> (
                  <tr key={d} className={`border-t hover:bg-gray-50 cursor-pointer ${selectedDay===d? 'bg-indigo-50' : ''}`} onClick={()=>setSelectedDay(d)}>
                    <td className="px-2 py-1">{d}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{Number(revenueTrend.datasets[0].data[i]||0).toLocaleString()}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{Number(revenueTrend.datasets[1].data[i]||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="mb-2 text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs">💳</span>
            Method mix
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-32 h-32 sm:w-40 sm:h-40"><Doughnut data={methodData} options={{ plugins:{ legend:{ display:false }}}} /></div>
            <div className="text-sm space-y-2 text-center sm:text-left">
              <div>Cash: <span className="font-semibold tabular-nums">{totalsByMethod.CASH.toLocaleString()}</span></div>
              <div>Mpesa: <span className="font-semibold tabular-nums">{totalsByMethod.MPESA.toLocaleString()}</span></div>
              <div>Bank: <span className="font-semibold tabular-nums">{totalsByMethod.BANK.toLocaleString()}</span></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="mb-2 text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-xs">👤</span>
            Top payers
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Adm No</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {topPayers.map((t,i)=> (
                <tr key={i} className="border-t"><td className="px-3 py-1.5">{t.name}</td><td className="px-3 py-1.5">{t.adm}</td><td className="px-3 py-1.5 text-right tabular-nums font-medium">{t.total.toLocaleString()}</td></tr>
              ))}
              {topPayers.length===0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">No data</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="mb-2 text-sm font-semibold text-gray-800">Totals</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Payments</span><span className="tabular-nums font-medium">{totalAmt.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Expenses</span><span className="tabular-nums font-medium text-rose-600">{totalExpenses.toLocaleString()}</span></div>
            <div className="flex justify-between border-t pt-1"><span>Net</span><span className="tabular-nums font-bold">{(totalAmt-totalExpenses).toLocaleString()}</span></div>
          </div>
        </div>

        {/* Per-class revenue */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="mb-2 text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs">🏫</span>
            Per-class revenue (top 12)
          </div>
          <div className="h-72">
            <Bar data={revenueByClass} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }} />
          </div>
        </div>

        {/* Drilldown transactions for selected day */}
        {selectedDay && (
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="mb-2 text-sm font-medium text-gray-700">Transactions on {selectedDay}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Payments</div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600"><tr><th className="px-2 py-1 text-left">Student</th><th className="px-2 py-1 text-right">Amt</th><th className="px-2 py-1">Method</th></tr></thead>
                  <tbody>
                    {payments.filter(p=> (p.created_at||p.date||'').toString().slice(0,10)===selectedDay).map((p,i)=> (
                      <tr key={i} className="border-t"><td className="px-2 py-1">{p.student?.name||'-'}</td><td className="px-2 py-1 text-right tabular-nums">{Number(p.amount||0).toLocaleString()}</td><td className="px-2 py-1">{(p.method||'').toString().toUpperCase()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Expenses</div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600"><tr><th className="px-2 py-1 text-left">Category</th><th className="px-2 py-1 text-right">Amt</th></tr></thead>
                  <tbody>
                    {expenses.filter(x=> (x.created_at||x.date||'').toString().slice(0,10)===selectedDay).map((x,i)=> (
                      <tr key={i} className="border-t"><td className="px-2 py-1">{x.category_detail?.name || x.category || ''}</td><td className="px-2 py-1 text-right tabular-nums">{Number(x.amount||0).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
