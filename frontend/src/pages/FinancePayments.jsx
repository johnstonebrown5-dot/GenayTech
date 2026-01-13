import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
ChartJS.register(ArcElement, Tooltip, Legend)

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'CASH', label: 'Cash' },
  { key: 'MPESA', label: 'Mpesa' },
  { key: 'BANK', label: 'Bank' },
]

export default function FinancePayments(){
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const printRef = useRef(null)
  const [showForm, setShowForm] = useState(true)
  const [studentId, setStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState([])
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [enabledMethods, setEnabledMethods] = useState(['cash','mpesa','bank','cheque'])
  const [reconFile, setReconFile] = useState(null)
  const [reconSource, setReconSource] = useState('coop')
  const [reconBusy, setReconBusy] = useState(false)
  const [reconMessage, setReconMessage] = useState('')
  const [reconError, setReconError] = useState('')

  useEffect(()=>{ load() }, [tab])

  async function load(){
    setLoading(true)
    try {
      const params = {}
      if (tab !== 'all') params.method = tab
      const [payRes, methodsRes] = await Promise.all([
        api.get('/finance/payments/', { params }),
        api.get('/finance/payment-methods/')
      ])
      const list = Array.isArray(payRes.data) ? payRes.data : (payRes.data?.results || [])
      setPayments(list)
      const mlist = Array.isArray(methodsRes.data) ? methodsRes.data : (methodsRes.data?.results || [])
      const enabled = mlist.filter(m=>m.enabled).map(m=>String(m.key).toLowerCase())
      if (enabled.length>0) setEnabledMethods(enabled)
    } catch {
      setPayments([])
    } finally { setLoading(false) }
  }

  // Autocomplete: search students by name or admission number
  useEffect(()=>{
    let alive = true
    const q = String(studentSearch||'').trim()
    if (q.length < 2){ setStudentResults([]); return }
    setSearchingStudents(true)
    const t = setTimeout(async ()=>{
      try{
        const { data } = await api.get('/academics/students/', { params: { q } })
        if (!alive) return
        const list = Array.isArray(data) ? data : (data?.results || [])
        setStudentResults(list)
      }catch{
        if (!alive) return
        setStudentResults([])
      }finally{
        if (alive) setSearchingStudents(false)
      }
    }, 300)
    return ()=>{ alive = false; clearTimeout(t) }
  }, [studentSearch])

  function chooseStudent(s){
    setStudentId(String(s?.id||''))
    // Also reflect selection text into the search box for clarity
    const cls = s?.klass_detail?.name || s?.klass || ''
    const label = [s?.name, s?.admission_no ? `(${s.admission_no})` : null, cls ? `– ${cls}` : null].filter(Boolean).join(' ')
    setStudentSearch(label)
    // Collapse suggestions
    setStudentResults([])
  }

  async function submitPayment(e){
    e?.preventDefault?.()
    setSubmitError('')
    setSubmitting(true)
    try{
      const sid = String(studentId||'').trim()
      const amt = Number(amount||0)
      if (!sid) throw new Error('Student ID is required')
      if (!(amt>0)) throw new Error('Enter a valid amount')
      // Ensure method is enabled; fallback to first enabled
      let chosen = method || 'cash'
      if (!enabledMethods.includes(String(chosen).toLowerCase())) {
        chosen = enabledMethods[0] || 'cash'
        setMethod(chosen)
      }
      await api.post('/finance/invoices/pay_student/', { student: sid, amount: amt, method: chosen, reference })
      // Reset minimal fields and refresh list
      setAmount('')
      setReference('')
      setShowForm(false)
      await load()
    }catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Failed to record payment'
      setSubmitError(msg)
    }finally{
      setSubmitting(false)
    }
  }

  async function uploadStatement(e){
    e?.preventDefault?.()
    setReconError('')
    setReconMessage('')
    if (!reconFile){
      setReconError('Choose a CSV statement file to upload.')
      return
    }
    setReconBusy(true)
    try {
      const form = new FormData()
      form.append('file', reconFile)
      form.append('source', reconSource)
      const { data } = await api.post('/finance/incoming-payments/import_statement/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setReconMessage(`Imported ${data.imported || 0} record(s), skipped ${data.skipped || 0}.`)
      setReconFile(null)
      if (e?.target?.reset) e.target.reset()
    } catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Failed to upload statement'
      setReconError(msg)
    } finally {
      setReconBusy(false)
    }
  }

  async function runAutoMatch(){
    setReconError('')
    setReconMessage('')
    setReconBusy(true)
    try{
      const { data } = await api.post('/finance/incoming-payments/auto_match/', { status: 'pending' })
      setReconMessage(`Auto-matched ${data.matched || 0} incoming payment(s).`)
    }catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Failed to auto-match payments'
      setReconError(msg)
    }finally{
      setReconBusy(false)
    }
  }

  async function runAutoReconcile(){
    setReconError('')
    setReconMessage('')
    setReconBusy(true)
    try{
      const payload = { limit: 200, min_confidence: 0.95, method: 'bank' }
      if (reconSource) payload.source = reconSource
      const { data } = await api.post('/finance/incoming-payments/auto_reconcile/', payload)
      setReconMessage(`Reconciled ${data.reconciled || 0} incoming payment(s). Allocated total ${Number(data.total_allocated || 0).toLocaleString()}.`)
    }catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Failed to auto-reconcile payments'
      setReconError(msg)
    }finally{
      setReconBusy(false)
    }
  }

  const filtered = useMemo(()=>{
    let list = payments
    if (tab !== 'all') {
      const t = String(tab).toUpperCase()
      list = list.filter(p => String(p.method||'').toUpperCase() === t)
    }
    if (!q) return list
    const s = q.toLowerCase()
    return list.filter(p => (
      String(p.student?.name||'').toLowerCase().includes(s) ||
      String(p.student?.admission_no||'').toLowerCase().includes(s) ||
      String(p.reference||'').toLowerCase().includes(s) ||
      String(p.invoice||'').toLowerCase().includes(s)
    ))
  }, [payments, q, tab])

  function printList(){
    const printContents = printRef.current?.innerHTML || ''
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Payments</title><style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827}
      table{width:100%;border-collapse:collapse}
      th,td{padding:8px 10px;border-top:1px solid #e5e7eb;font-size:12px}
      thead th{background:#f3f4f6;text-align:left}
    </style></head><body>${printContents}</body></html>`)
    w.document.close(); w.focus(); w.print();
  }

  const totalAmt = useMemo(()=> filtered.reduce((s,p)=> s + Number(p.amount||0), 0), [filtered])
  const methodBadge = (m)=>{
    const up = String(m||'').toUpperCase()
    const base = 'px-2 py-0.5 rounded text-xs font-semibold'
    if (up==='MPESA') return `${base} bg-green-50 text-green-700 border border-green-200`
    if (up==='BANK') return `${base} bg-blue-50 text-blue-700 border border-blue-200`
    return `${base} bg-yellow-50 text-yellow-700 border border-yellow-200`
  }

  const totalsByMethod = useMemo(()=>{
    const acc = { CASH:0, MPESA:0, BANK:0 }
    for (const p of filtered){ const key = String(p.method||'').toUpperCase(); if (acc[key]!==undefined) acc[key]+=Number(p.amount||0) }
    return acc
  }, [filtered])

  const doughnutData = useMemo(()=>{
    const vals = [totalsByMethod.CASH, totalsByMethod.MPESA, totalsByMethod.BANK]
    return {
      labels: ['Cash','Mpesa','Bank'],
      datasets: [{ data: vals, backgroundColor: ['#fde68a','#86efac','#93c5fd'], borderColor: ['#f59e0b','#10b981','#3b82f6'], borderWidth: 1 }]
    }
  }, [totalsByMethod])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">View, search and print payments. Tabs filter by method.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, admno, ref, invoice" className="px-3 py-2 border rounded-lg w-full sm:w-72 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"/>
          <button onClick={printList} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm shadow-sm hover:bg-gray-800">Print</button>
          <button onClick={()=>setShowForm(s=>!s)} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm shadow-sm hover:bg-emerald-700">{showForm? 'Close' : 'Record Payment'}</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-800">Record Payment (Student)</div>
            <div className="text-xs text-gray-500">Allocates to oldest unpaid invoices first</div>
          </div>
          {submitError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2 mb-3">{submitError}</div>}
          <form onSubmit={submitPayment} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Student</label>
              <div className="relative">
                <input value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Search name or admission no" className="w-full px-3 py-2 border rounded text-sm" autoFocus />
                { (searchingStudents || studentResults.length>0) && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow-md max-h-60 overflow-auto">
                    {searchingStudents && <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>}
                    {!searchingStudents && studentResults.length===0 && <div className="px-3 py-2 text-sm text-gray-500">No matches</div>}
                    {!searchingStudents && studentResults.map(s=> (
                      <button key={s.id} type="button" onClick={()=>chooseStudent(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-800">{s.name}</div>
                          <div className="text-xs text-gray-500">ID: {s.id}</div>
                        </div>
                        <div className="text-xs text-gray-600">Adm: {s.admission_no || '-'}{(s.klass_detail?.name || s.klass) ? ` · ${(s.klass_detail?.name || s.klass)}` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {studentId && (
                <div className="mt-1 text-xs text-gray-600">Selected ID: <span className="inline-flex items-center gap-1 px-2 py-0.5 border rounded-full bg-gray-50">{studentId}<button type="button" className="ml-1 text-gray-500 hover:text-gray-700" onClick={()=>{ setStudentId(''); setStudentSearch(''); }}>×</button></span></div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Amount</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Method</label>
              <select value={method} onChange={e=>setMethod(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
                {enabledMethods.includes('cash') && (<option value="cash">Cash</option>)}
                {enabledMethods.includes('mpesa') && (<option value="mpesa">Mpesa</option>)}
                {enabledMethods.includes('bank') && (<option value="bank">Bank</option>)}
                {enabledMethods.includes('cheque') && (<option value="cheque">Cheque</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Reference</label>
              <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Txn/Slip/Ref No" className="w-full px-3 py-2 border rounded text-sm" />
            </div>
            <div className="md:col-span-2 text-xs text-gray-500">Lump sum will be allocated to oldest unpaid invoices first.</div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" disabled={submitting} className={`px-3 py-2 rounded-lg text-sm text-white ${submitting? 'bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{submitting? 'Saving...' : 'Save Payment'}</button>
              <button type="button" onClick={()=>setShowForm(false)} className="px-3 py-2 rounded-lg text-sm border bg-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map(t=> (
          <button key={t.key} onClick={()=>setTab(t.key)} className={`px-3 py-1.5 rounded-full text-sm border transition ${tab===t.key? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}>{t.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="px-3 py-2 rounded-lg border bg-white shadow-sm">Rows: <span className="font-semibold">{filtered.length}</span></div>
        <div className="px-3 py-2 rounded-lg border bg-white shadow-sm">Total: <span className="font-semibold tabular-nums">{totalAmt.toLocaleString()}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-md overflow-hidden" ref={printRef}>
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="text-left bg-gray-50/95 backdrop-blur text-gray-700 text-sm">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Student</th>
                  <th className="px-4 py-2">Adm No</th>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2">Reference</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading && (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={7}>Loading...</td></tr>
                )}
                {!loading && filtered.length===0 && (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={7}>No payments</td></tr>
                )}
                {filtered.map(p=> (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{(p.created_at||p.date||'').toString().slice(0,10)}</td>
                    <td className="px-4 py-2">{p.student?.name || '-'}</td>
                    <td className="px-4 py-2">{p.student?.admission_no || '-'}</td>
                    <td className="px-4 py-2">{p.invoice || '-'}</td>
                    <td className="px-4 py-2"><span className={methodBadge(p.method)}>{(p.method||'').toString().toUpperCase()||'-'}</span></td>
                    <td className="px-4 py-2 font-mono text-xs">{p.reference || '-'}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{Number(p.amount||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-md p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Method contribution</div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-32 h-32 sm:w-40 sm:h-40"><Doughnut data={doughnutData} options={{ plugins:{ legend:{ display:false }}}} /></div>
              <div className="text-sm space-y-2 text-center sm:text-left">
                <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded bg-yellow-400" /> Cash <span className="ml-2 font-semibold tabular-nums">{totalsByMethod.CASH.toLocaleString()}</span></div>
                <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded bg-green-400" /> Mpesa <span className="ml-2 font-semibold tabular-nums">{totalsByMethod.MPESA.toLocaleString()}</span></div>
                <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded bg-blue-400" /> Bank <span className="ml-2 font-semibold tabular-nums">{totalsByMethod.BANK.toLocaleString()}</span></div>
                <div className="pt-2 text-xs text-gray-500">Based on current filter</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800">Bank / Co-op Reconciliation</div>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">Beta</span>
            </div>
            {reconError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">{reconError}</div>
            )}
            {reconMessage && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{reconMessage}</div>
            )}
            <form onSubmit={uploadStatement} className="space-y-2 text-xs">
              <div className="flex flex-col gap-2">
                <label className="text-gray-600">Statement file (CSV)</label>
                <input type="file" accept=".csv" onChange={e=>setReconFile(e.target.files?.[0] || null)} className="block w-full text-xs text-gray-700 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-gray-800" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Source</span>
                <select value={reconSource} onChange={e=>setReconSource(e.target.value)} className="px-2 py-1 border rounded text-xs">
                  <option value="coop">Co-op</option>
                  <option value="bank">Other bank</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" disabled={reconBusy} className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white ${reconBusy ? 'bg-gray-400' : 'bg-gray-900 hover:bg-gray-800'}`}>
                  {reconBusy ? 'Uploading...' : 'Upload statement'}
                </button>
                <button type="button" disabled={reconBusy} onClick={runAutoMatch} className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50">
                  Auto-match
                </button>
                <button type="button" disabled={reconBusy} onClick={runAutoReconcile} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400">
                  Auto-reconcile
                </button>
              </div>
              <p className="text-[11px] text-gray-500 leading-snug">
                Deposits using <span className="font-mono">Account#Admission</span> will be matched to students. High-confidence matches are allocated to invoices and SMS is sent automatically.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
