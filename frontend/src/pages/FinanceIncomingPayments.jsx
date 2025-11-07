import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'

const STATUS_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'matched', label: 'Matched' },
  { key: 'reconciled', label: 'Reconciled' },
  { key: 'ignored', label: 'Ignored' },
]

export default function FinanceIncomingPayments(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('pending')
  const [q, setQ] = useState('')

  const [uploading, setUploading] = useState(false)
  const [autoMatchOnImport, setAutoMatchOnImport] = useState(true)
  const [autoMatching, setAutoMatching] = useState(false)

  const [reconcilingId, setReconcilingId] = useState(null)
  const [reconcileAdmission, setReconcileAdmission] = useState('')
  const [reconcileInvoice, setReconcileInvoice] = useState('')
  const [reconcileMethod, setReconcileMethod] = useState('bank')
  const [reconcileError, setReconcileError] = useState('')
  const [reconcileSubmitting, setReconcileSubmitting] = useState(false)

  const printRef = useRef(null)

  useEffect(()=>{ load() }, [tab])

  async function load(){
    setLoading(true)
    try{
      const { data } = await api.get('/finance/incoming-payments/', { params: { status: tab } })
      const list = Array.isArray(data) ? data : (data?.results || [])
      setItems(list)
    }catch{
      setItems([])
    }finally{ setLoading(false) }
  }

  const filtered = useMemo(()=>{
    const s = (q||'').toLowerCase()
    if (!s) return items
    return items.filter(x => (
      String(x.reference||'').toLowerCase().includes(s) ||
      String(x.narration||'').toLowerCase().includes(s) ||
      String(x.account_ref||'').toLowerCase().includes(s) ||
      String(x.matched_student?.name||'').toLowerCase().includes(s) ||
      String(x.matched_student_admission||x.matched_student?.admission_no||'').toLowerCase().includes(s)
    ))
  }, [items, q])

  function printList(){
    const html = printRef.current?.innerHTML || ''
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Bank</title><style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827}
      table{width:100%;border-collapse:collapse}
      th,td{padding:8px 10px;border-top:1px solid #e5e7eb;font-size:12px}
      thead th{background:#f3f4f6;text-align:left}
    </style></head><body>${html}</body></html>`)
    w.document.close(); w.focus(); w.print();
  }

  async function importCsv(e){
    const file = e?.target?.files?.[0]
    if (!file) return
    setUploading(true)
    try{
      const fd = new FormData()
      fd.append('file', file)
      fd.append('auto_match', String(!!autoMatchOnImport))
      await api.post('/finance/incoming-payments/import-csv/', fd, { headers: { 'Content-Type': 'multipart/form-data' }})
      await load()
    }catch(err){
      alert(err?.response?.data?.detail || err?.message || 'Import failed')
    }finally{
      setUploading(false)
      try{ e.target.value = '' }catch{}
    }
  }

  async function runAutoMatch(){
    setAutoMatching(true)
    try{
      await api.post('/finance/incoming-payments/auto_match/', { limit: 500, status: 'pending' })
      await load()
    }catch(err){
      alert(err?.response?.data?.detail || err?.message || 'Auto-match failed')
    }finally{ setAutoMatching(false) }
  }

  function openReconcile(item){
    setReconcilingId(item?.id)
    setReconcileAdmission('')
    setReconcileInvoice('')
    setReconcileMethod('bank')
    setReconcileError('')
  }

  async function submitReconcile(e){
    e?.preventDefault?.()
    if (!reconcilingId) return
    setReconcileError('')
    setReconcileSubmitting(true)
    try{
      const body = { method: reconcileMethod }
      const adm = String(reconcileAdmission||'').trim()
      const inv = String(reconcileInvoice||'').trim()
      if (adm) body.admission_no = adm
      if (inv) body.invoice = inv
      const { data } = await api.post(`/finance/incoming-payments/${reconcilingId}/reconcile/`, body)
      // Close modal and refresh
      setReconcilingId(null)
      await load()
      // Optional: show quick summary
      const alloc = Number(data?.amount_allocated||0).toLocaleString()
      const left = Number(data?.amount_unallocated||0).toLocaleString()
      alert(`Reconciled. Allocated: ${alloc}. Unallocated: ${left}.`)
    }catch(err){
      setReconcileError(err?.response?.data?.detail || err?.message || 'Reconcile failed')
    }finally{ setReconcileSubmitting(false) }
  }

  const statusBadge = (s)=>{
    const up = String(s||'').toUpperCase()
    const base = 'px-2 py-0.5 rounded text-xs font-semibold border'
    if (up==='PENDING') return `${base} bg-yellow-50 text-yellow-700 border-yellow-200`
    if (up==='MATCHED') return `${base} bg-blue-50 text-blue-700 border-blue-200`
    if (up==='RECONCILED') return `${base} bg-green-50 text-green-700 border-green-200`
    return `${base} bg-gray-50 text-gray-700 border-gray-200`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bank</h1>
          <p className="text-sm text-gray-500">Bank/M-Pesa receipts not initiated on the website. Auto-match by admission number, then reconcile to invoices.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search ref, narration, account ref, student" className="px-3 py-2 border rounded-lg w-full sm:w-80 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"/>
          <button onClick={printList} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm shadow-sm hover:bg-gray-800">Print</button>
          <label className={`px-3 py-2 rounded-lg text-sm border bg-white cursor-pointer ${uploading? 'opacity-60 pointer-events-none' : ''}`}>
            {uploading? 'Importing...' : 'Import CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={importCsv} />
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-1">
            <input type="checkbox" checked={autoMatchOnImport} onChange={e=>setAutoMatchOnImport(e.target.checked)} /> Auto-match
          </label>
          <button onClick={runAutoMatch} disabled={autoMatching} className={`px-3 py-2 rounded-lg text-sm ${autoMatching? 'bg-blue-400 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} shadow-sm`}>{autoMatching? 'Matching...' : 'Auto-Match'}</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(t=> (
          <button key={t.key} onClick={()=>setTab(t.key)} className={`px-3 py-1.5 rounded-full text-sm border transition ${tab===t.key? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}>{t.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="px-3 py-2 rounded-lg border bg-white shadow-sm">Rows: <span className="font-semibold">{filtered.length}</span></div>
      </div>

      <div className="bg-white rounded-xl border shadow-md overflow-hidden" ref={printRef}>
        <div className="overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="text-left bg-gray-50/95 backdrop-blur text-gray-700 text-sm">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Currency</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Account Ref</th>
                <th className="px-4 py-2">Narration</th>
                <th className="px-4 py-2">Matched Student</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading && (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={10}>Loading...</td></tr>
              )}
              {!loading && filtered.length===0 && (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={10}>No records</td></tr>
              )}
              {filtered.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{(item.value_date || item.created_at || '').toString().slice(0,19).replace('T',' ')}</td>
                  <td className="px-4 py-2">{(item.source||'').toString().toUpperCase()}</td>
                  <td className="px-4 py-2 tabular-nums">{Number(item.amount||0).toLocaleString()}</td>
                  <td className="px-4 py-2">{item.currency || 'KES'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{item.reference || '-'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{item.account_ref || '-'}</td>
                  <td className="px-4 py-2">{item.narration || '-'}</td>
                  <td className="px-4 py-2">{item.matched_student || item.matched_student_name || item?.matched_student?.name || '-'}</td>
                  <td className="px-4 py-2"><span className={statusBadge(item.status)}>{(item.status||'').toString().toUpperCase()}</span></td>
                  <td className="px-4 py-2 text-right">
                    {(item.status==='pending' || item.status==='matched') && (
                      <button onClick={()=>openReconcile(item)} className="px-2 py-1 rounded border bg-white text-gray-800 hover:bg-gray-50">Reconcile</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {reconcilingId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border shadow-xl w-full max-w-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-800">Reconcile Bank Entry</div>
              <button onClick={()=>setReconcilingId(null)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            {reconcileError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2 mb-3">{reconcileError}</div>}
            <form onSubmit={submitReconcile} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div className="md:col-span-2 text-xs text-gray-500">Provide an admission number to allocate FIFO across the student's unpaid invoices, or specify an invoice ID to target a single invoice.</div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Admission No</label>
                <input value={reconcileAdmission} onChange={e=>setReconcileAdmission(e.target.value)} placeholder="e.g. ADM1234" className="w-full px-3 py-2 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Invoice (optional)</label>
                <input value={reconcileInvoice} onChange={e=>setReconcileInvoice(e.target.value)} placeholder="Invoice ID" className="w-full px-3 py-2 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Method</label>
                <select value={reconcileMethod} onChange={e=>setReconcileMethod(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
                  <option value="bank">Bank</option>
                  <option value="mpesa">Mpesa</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" disabled={reconcileSubmitting} className={`px-3 py-2 rounded-lg text-sm text-white ${reconcileSubmitting? 'bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{reconcileSubmitting? 'Reconciling...' : 'Reconcile'}</button>
                <button type="button" onClick={()=>setReconcilingId(null)} className="px-3 py-2 rounded-lg text-sm border bg-white">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
