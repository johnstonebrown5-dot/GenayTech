import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'CASH', label: 'Cash' },
  { key: 'MPESA', label: 'Mpesa' },
  { key: 'BANK', label: 'Bank' },
]

export default function FinanceCashbook(){
  const [payments, setPayments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(()=>{ load() }, [tab, dateFrom, dateTo])

  async function load(){
    setLoading(true)
    try {
      const params = {}
      if (tab !== 'all') params.method = tab
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const [p, e] = await Promise.all([
        api.get('/finance/payments/', { params }),
        api.get('/finance/expenses/', { params: { date_from: dateFrom||'', date_to: dateTo||'' } }),
      ])
      const plist = Array.isArray(p.data) ? p.data : (p.data?.results || [])
      const elist = Array.isArray(e.data) ? e.data : (e.data?.results || [])
      setPayments(plist)
      setExpenses(elist)
    } catch {
      setPayments([]); setExpenses([])
    } finally { setLoading(false) }
  }

  const entries = useMemo(()=>{
    const pay = (payments||[]).map(p=>({
      id: 'P-'+(p.id||Math.random()),
      date: new Date(p.created_at || p.date || ''),
      desc: (p.student?.name? ('Payment - '+p.student?.name) : 'Payment'),
      ref: p.reference || p.invoice || '',
      method: (p.method||'').toString().toUpperCase(),
      receipt: p.id,
      in: Number(p.amount||0),
      out: 0,
    }))
    const exp = (expenses||[]).map(x=>({
      id: 'E-'+(x.id||Math.random()),
      date: new Date(x.created_at || x.date || ''),
      desc: x.category_detail?.name || x.category || 'Expense',
      ref: (x.description||'').slice(0,60),
      method: 'EXPENSE',
      in: 0,
      out: Number(x.amount||0),
    }))
    const comb = [...pay, ...exp].filter(r=> !isNaN(r.date.getTime()))
    comb.sort((a,b)=> a.date.getTime()-b.date.getTime())
    // running balance
    let bal = 0
    return comb.map(r=>{ bal += (r.in - r.out); return { ...r, balance: bal } })
  }, [payments, expenses])

  const totalIn = useMemo(()=> entries.reduce((s,r)=> s + r.in, 0), [entries])
  const totalOut = useMemo(()=> entries.reduce((s,r)=> s + r.out, 0), [entries])

  function exportCsv(){
    const rows = [['Date','Description','Reference','Method','In','Out','Balance']]
    for (const r of entries){
      rows.push([
        r.date.toISOString().slice(0,10),
        r.desc||'',
        r.ref||'',
        r.method||'',
        String(r.in||0),
        String(r.out||0),
        String(r.balance||0),
      ])
    }
    const csv = rows.map(r=>r.map(v=>{ const s=String(v??''); const e=s.replaceAll('"','""'); return /[",\n]/.test(s)? `"${e}"`: s }).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='cashbook.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Cashbook</h1>
          <p className="text-sm text-gray-500">Combined receipts and expenses with running balance.</p>
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
          <button onClick={exportCsv} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm shadow-sm hover:bg-gray-800">Export CSV</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(t=> (
          <button key={t.key} onClick={()=>setTab(t.key)} className={`px-3 py-1.5 rounded-full text-sm border transition shadow-sm ${tab===t.key? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}>{t.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Total In</div>
          <div className="text-2xl font-semibold tabular-nums text-emerald-700">{totalIn.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Total Out</div>
          <div className="text-2xl font-semibold tabular-nums text-rose-600">{totalOut.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Balance</div>
          <div className="text-2xl font-bold tabular-nums">{(totalIn-totalOut).toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2 text-right">In</th>
              <th className="px-3 py-2 text-right">Out</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(r=> (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{r.date.toISOString().slice(0,10)}</td>
                <td className="px-3 py-2">{r.desc}</td>
                <td className="px-3 py-2 text-xs">{r.ref}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{r.method}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{r.in? Number(r.in).toLocaleString(): ''}</td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-600">{r.out? Number(r.out).toLocaleString(): ''}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{Number(r.balance||0).toLocaleString()}</td>
              </tr>
            ))}
            {entries.length===0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">{loading? 'Loading...' : 'No transactions in range'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
