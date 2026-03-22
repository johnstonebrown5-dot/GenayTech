import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import {
  Search,
  Printer,
  PlusCircle,
  X,
  CheckCircle2,
  AlertCircle,
  Filter,
  CreditCard,
  Wallet,
  Building2,
  Upload,
  Sparkles,
  RotateCw,
} from 'lucide-react'
ChartJS.register(ArcElement, Tooltip, Legend)

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'CASH', label: 'Cash' },
  { key: 'MPESA', label: 'Mpesa' },
  { key: 'BANK', label: 'Bank' },
]

export default function FinancePayments({ initialTab = 'all', hideRecordForm = false }){
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(initialTab)
  const [q, setQ] = useState('')
  const printRef = useRef(null)
  const [showForm, setShowForm] = useState(!hideRecordForm)
  const [studentId, setStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [useStk, setUseStk] = useState(true)
  const [phone, setPhone] = useState('')
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitOk, setSubmitOk] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState([])
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [enabledMethods, setEnabledMethods] = useState(['cash','mpesa','bank','cheque'])
  const [reconFile, setReconFile] = useState(null)
  const [reconSource, setReconSource] = useState('coop')
  const [reconBusy, setReconBusy] = useState(false)
  const [reconMessage, setReconMessage] = useState('')
  const [reconError, setReconError] = useState('')
  const [toast, setToast] = useState(null) // { type: 'success'|'error', message: string }

  useEffect(()=>{
    if (!toast) return
    const t = setTimeout(()=> setToast(null), 5000)
    return ()=> clearTimeout(t)
  }, [toast])

  useEffect(()=>{ setTab(initialTab) }, [initialTab])
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
    setPhone(String(s?.phone || '').trim())
    // Collapse suggestions
    setStudentResults([])
  }

  async function submitPayment(e){
    e?.preventDefault?.()
    setSubmitError('')
    setSubmitOk('')
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

      // Mpesa STK push: initiate prompt on phone instead of instantly recording payment
      if (String(chosen).toLowerCase() === 'mpesa' && useStk) {
        const rawPhone = String(phone || '').trim()
        if (!rawPhone) throw new Error('Phone number is required for STK push')
        const payload = { student_id: sid, amount: amt, phone: rawPhone }
        const { data } = await api.post('/finance/invoices/pay-balance-stk/', payload)
        const msg = data?.message || data?.status || 'STK initiated'
        setSubmitOk(String(msg))
        setToast({ type: 'success', message: String(msg) })
        setShowForm(false)
        return
      }

      await api.post('/finance/invoices/pay_student/', { student: sid, amount: amt, method: chosen, reference })
      // Reset minimal fields and refresh list
      setAmount('')
      setReference('')
      setShowForm(false)
      await load()
      setToast({ type: 'success', message: 'Payment recorded successfully' })
    }catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Failed to record payment'
      setSubmitError(msg)
      setToast({ type: 'error', message: String(msg) })
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

  function openReceipt(p){
    const id = p?.id
    if (!id) return
    window.open(`/receipt/${encodeURIComponent(id)}`, '_blank')
  }

  const doughnutData = useMemo(()=>{
    const vals = [totalsByMethod.CASH, totalsByMethod.MPESA, totalsByMethod.BANK]
    return {
      labels: ['Cash','Mpesa','Bank'],
      datasets: [{ data: vals, backgroundColor: ['#fde68a','#86efac','#93c5fd'], borderColor: ['#f59e0b','#10b981','#3b82f6'], borderWidth: 1 }]
    }
  }, [totalsByMethod])

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Payments</h1>
              <p className="text-white/70 text-sm mt-1">View, search, print and record student payments.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:min-w-[320px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  value={q}
                  onChange={e=>setQ(e.target.value)}
                  placeholder="Search name, admno, ref, invoice"
                  className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/30 focus:outline-none"
                />
              </div>
              <button
                onClick={printList}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-white text-gray-900 hover:bg-gray-50 transition-all"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              {!hideRecordForm && (
                <button
                  onClick={()=>setShowForm(s=>!s)}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${showForm ? 'bg-white/10 text-white border border-white/10 hover:bg-white/15' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200'}`}
                >
                  {showForm ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                  {showForm? 'Close' : 'Record Payment'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showForm && !hideRecordForm && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <div className="text-base font-extrabold text-gray-900">Record Payment</div>
                <div className="text-xs text-gray-500 font-medium">Allocates to oldest unpaid invoices first</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 font-semibold">{submitting ? 'Saving…' : 'Ready'}</div>
          </div>

          <form onSubmit={submitPayment} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Student</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={studentSearch}
                  onChange={e=>setStudentSearch(e.target.value)}
                  placeholder="Search name or admission no"
                  className="w-full bg-gray-50 border-0 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900 transition-all"
                  autoFocus
                />
                { (searchingStudents || studentResults.length>0) && (
                  <div className="absolute z-10 mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-72 overflow-auto">
                    {searchingStudents && <div className="px-5 py-4 text-sm text-gray-500">Searching...</div>}
                    {!searchingStudents && studentResults.length===0 && <div className="px-5 py-4 text-sm text-gray-500">No matches</div>}
                    {!searchingStudents && studentResults.map(s=> (
                      <button key={s.id} type="button" onClick={()=>chooseStudent(s)} className="w-full text-left px-5 py-3 text-sm hover:bg-gray-50 transition">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 truncate">{s.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">Adm: {s.admission_no || '-'}{(s.klass_detail?.name || s.klass) ? ` · ${(s.klass_detail?.name || s.klass)}` : ''}</div>
                          </div>
                          <div className="px-2 py-1 rounded-md bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500 shrink-0">
                            ID {s.id}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {studentId && (
                <div className="mt-2 text-xs text-gray-600 font-medium">Selected:
                  <span className="ml-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-white">
                    <span className="font-bold">#{studentId}</span>
                    <button type="button" className="text-gray-500 hover:text-gray-700" onClick={()=>{ setStudentId(''); setStudentSearch(''); }}>×</button>
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Amount</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Method</label>
              <select value={method} onChange={e=>setMethod(e.target.value)} className="mt-2 w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all">
                {enabledMethods.includes('cash') && (<option value="cash">Cash</option>)}
                {enabledMethods.includes('mpesa') && (<option value="mpesa">Mpesa</option>)}
                {enabledMethods.includes('bank') && (<option value="bank">Bank</option>)}
                {enabledMethods.includes('cheque') && (<option value="cheque">Cheque</option>)}
              </select>
            </div>
            {String(method).toLowerCase()==='mpesa' && (
              <>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Phone (STK)</label>
                  <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="2547XXXXXXXX" className="mt-2 w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all" />
                </div>
                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input type="checkbox" checked={useStk} onChange={e=>setUseStk(e.target.checked)} className="rounded" />
                    Use STK Push (prompt on phone)
                  </label>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Reference</label>
              <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Txn/Slip/Ref No" className="mt-2 w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all" />
            </div>
            <div className="md:col-span-2 text-xs text-gray-500 font-medium">Lump sum will be allocated to oldest unpaid invoices first.</div>
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 pt-2">
              <button type="submit" disabled={submitting} className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white transition-all ${submitting? 'bg-gray-400' : 'bg-gray-900 hover:bg-gray-800 shadow-lg shadow-gray-200'}`}>
                {submitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save Payment
                  </>
                )}
              </button>
              <button type="button" onClick={()=>setShowForm(false)} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all">
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
        <div className="flex flex-wrap gap-3">
          <div className="px-4 py-2.5 rounded-2xl border border-gray-100 bg-white shadow-sm text-sm font-semibold text-gray-700">
            Rows
            <span className="ml-2 font-extrabold text-gray-900 tabular-nums">{filtered.length}</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl border border-gray-100 bg-white shadow-sm text-sm font-semibold text-gray-700">
            Total
            <span className="ml-2 font-extrabold text-gray-900 tabular-nums">KES {totalAmt.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden" ref={printRef}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-extrabold text-gray-900">Payment list</div>
            <div className="text-xs text-gray-500 font-medium">Click a row to open receipt</div>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="text-left bg-gray-50/95 backdrop-blur text-gray-600 text-[11px] uppercase tracking-widest">
                  <th className="px-6 py-3 font-black">Date</th>
                  <th className="px-6 py-3 font-black">Student</th>
                  <th className="px-6 py-3 font-black">Adm No</th>
                  <th className="px-6 py-3 font-black">Invoice</th>
                  <th className="px-6 py-3 font-black">Method</th>
                  <th className="px-6 py-3 font-black">Reference</th>
                  <th className="px-6 py-3 font-black text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading && (
                  <tr><td className="px-6 py-10 text-center text-gray-500" colSpan={7}>Loading...</td></tr>
                )}
                {!loading && filtered.length===0 && (
                  <tr><td className="px-6 py-10 text-center text-gray-500" colSpan={7}>No payments</td></tr>
                )}
                {filtered.map(p=> (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors" onClick={()=>openReceipt(p)}>
                    <td className="px-6 py-3 whitespace-nowrap text-gray-700 font-medium">{(p.created_at||p.date||'').toString().slice(0,10)}</td>
                    <td className="px-6 py-3 font-bold text-gray-900">{p.student?.name || '-'}</td>
                    <td className="px-6 py-3 text-gray-700">{p.student?.admission_no || '-'}</td>
                    <td className="px-6 py-3 text-gray-700">{p.invoice || '-'}</td>
                    <td className="px-6 py-3"><span className={methodBadge(p.method)}>{(p.method||'').toString().toUpperCase()||'-'}</span></td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-600">{p.reference || '-'}</td>
                    <td className="px-6 py-3 text-right font-extrabold tabular-nums text-gray-900">KES {Number(p.amount||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-indigo-700" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-gray-900">Method contribution</div>
                  <div className="text-xs text-gray-500 font-medium">Based on current filter</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="w-32 h-32 sm:w-40 sm:h-40"><Doughnut data={doughnutData} options={{ plugins:{ legend:{ display:false }}}} /></div>
              <div className="text-sm space-y-2 w-full">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-yellow-50 border border-yellow-100"><Wallet className="w-4 h-4 text-yellow-600" /></span>
                    <span className="font-bold text-gray-800">Cash</span>
                  </span>
                  <span className="font-extrabold tabular-nums text-gray-900">KES {totalsByMethod.CASH.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-50 border border-emerald-100"><CreditCard className="w-4 h-4 text-emerald-600" /></span>
                    <span className="font-bold text-gray-800">Mpesa</span>
                  </span>
                  <span className="font-extrabold tabular-nums text-gray-900">KES {totalsByMethod.MPESA.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-sky-50 border border-sky-100"><Building2 className="w-4 h-4 text-sky-600" /></span>
                    <span className="font-bold text-gray-800">Bank</span>
                  </span>
                  <span className="font-extrabold tabular-nums text-gray-900">KES {totalsByMethod.BANK.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-sky-50 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-sky-700" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-gray-900">Reconciliation</div>
                  <div className="text-xs text-gray-500 font-medium">Bank / Co-op (beta)</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-100 uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                Beta
              </span>
            </div>
            {reconError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 font-semibold">{reconError}</div>
            )}
            {reconMessage && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 font-semibold">{reconMessage}</div>
            )}
            <form onSubmit={uploadStatement} className="space-y-3 text-sm">
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Statement file (CSV)</label>
                <input type="file" accept=".csv" onChange={e=>setReconFile(e.target.files?.[0] || null)} className="block w-full text-xs text-gray-700 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-gray-900 file:text-white hover:file:bg-gray-800" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Source</span>
                <select value={reconSource} onChange={e=>setReconSource(e.target.value)} className="bg-gray-50 border-0 rounded-2xl py-2 px-3 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all">
                  <option value="coop">Co-op</option>
                  <option value="bank">Other bank</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
                <button type="submit" disabled={reconBusy} className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold text-white transition-all ${reconBusy ? 'bg-gray-400' : 'bg-gray-900 hover:bg-gray-800'}`}>
                  <Upload className="w-4 h-4" />
                  {reconBusy ? 'Uploading...' : 'Upload statement'}
                </button>
                <button type="button" disabled={reconBusy} onClick={runAutoMatch} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50">
                  <Filter className="w-4 h-4" />
                  Auto-match
                </button>
                <button type="button" disabled={reconBusy} onClick={runAutoReconcile} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400">
                  <RotateCw className={`w-4 h-4 ${reconBusy ? 'animate-spin' : ''}`} />
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
