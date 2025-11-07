import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

export default function FinanceFeeRegister(){
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('all') // all|paid|unpaid|overdue

  useEffect(()=>{ load() }, [dateFrom, dateTo, status])

  function parseDate(val){
    try{
      if (!val) return null
      const d = new Date(val)
      return isNaN(d.getTime()) ? null : d
    }catch{ return null }
  }

  function formatDate(val){
    const d = parseDate(val)
    return d ? d.toISOString().slice(0,10) : ''
  }

  async function load(){
    setLoading(true)
    try{
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (status !== 'all') params.status = status
      const res = await api.get('/finance/invoices/', { params })
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setInvoices(list)
    }catch{
      setInvoices([])
    }finally{ setLoading(false) }
  }

  const totals = useMemo(()=>{
    let amt=0, paid=0
    for (const i of invoices){ amt += Number(i.amount||0); paid += Number(i.paid_amount||0) }
    return { amt, paid, bal: amt-paid }
  }, [invoices])

  function exportCsv(){
    const rows = [['Student','Adm No','Category','Year','Term','Invoice','Amount','Paid','Balance','Due Date','Status']]
    for (const i of invoices){
      rows.push([
        i.student_name || i.student?.name || '',
        i.student_admission || i.student?.admission_no || '',
        i.category_name || i.category_detail?.name || i.category || '',
        String(i.year||''),
        String(i.term||''),
        String(i.id||''),
        String(i.amount||0),
        String(i.paid_amount||0),
        String((Number(i.amount||0)-Number(i.paid_amount||0))||0),
        (i.due_date||'').toString().slice(0,10),
        i.status || '',
      ])
    }
    const csv = rows.map(r=>r.map(v=>{ const s=String(v??''); const e=s.replaceAll('"','""'); return /[",\n]/.test(s)? `"${e}"`: s }).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='fee_register.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Fee Register</h1>
          <p className="text-sm text-gray-500">Invoices by student with paid and balance amounts.</p>
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
          <div className="flex-1 min-w-[140px] sm:flex-none">
            <label className="block text-xs text-gray-600">Status</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2 border rounded text-sm w-full">
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <button onClick={exportCsv} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm shadow-sm hover:bg-gray-800">Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Total Invoiced</div>
          <div className="text-2xl font-semibold tabular-nums">{totals.amt.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Total Paid</div>
          <div className="text-2xl font-semibold tabular-nums text-emerald-700">{totals.paid.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-xs text-gray-500">Balance</div>
          <div className="text-2xl font-bold tabular-nums text-rose-600">{totals.bal.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2">Adm No</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Term</th>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(i=>{
              const paid = Number(i.paid_amount||0)
              const amt = Number(i.amount||0)
              const bal = amt - paid
              const dueObj = parseDate(i.due_date)
              const today = new Date(); today.setHours(0,0,0,0)
              const isOverdue = bal > 0 && dueObj && dueObj < today
              const displayStatus = i.status || (bal<=0? 'paid' : (isOverdue? 'overdue' : 'unpaid'))
              return (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{i.student_name || i.student?.name || '-'}</td>
                  <td className="px-3 py-2 text-xs">{i.student_admission || i.student?.admission_no || ''}</td>
                  <td className="px-3 py-2">{i.category_name || i.category_detail?.name || i.category || ''}</td>
                  <td className="px-3 py-2 text-center">{i.year || ''}</td>
                  <td className="px-3 py-2 text-center">{i.term || ''}</td>
                  <td className="px-3 py-2 text-center">{i.id}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{amt.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{paid.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${bal>0? 'text-rose-600':''}`}>{bal.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center">{formatDate(i.due_date)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${displayStatus==='paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (displayStatus==='overdue' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
                      {displayStatus}
                    </span>
                  </td>
                </tr>
              )
            })}
            {invoices.length===0 && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-gray-500">{loading? 'Loading...' : 'No invoices found'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
