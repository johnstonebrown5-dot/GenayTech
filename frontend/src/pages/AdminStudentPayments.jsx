import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import api, { backendBase } from '../api'

export default function AdminStudentPayments(){
  const { id } = useParams()
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPay, setShowPay] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [paying, setPaying] = useState(false)
  const [stkStatus, setStkStatus] = useState('idle') // idle | initiating | sent | polling | fetching | success | failed
  const [payForm, setPayForm] = useState({ invoice: '', amount: '', method: 'mpesa', reference: '', phone: '', attachment: null })
  // Always use real STK (Co-op)
  const [payError, setPayError] = useState('')
  const [enabledMethods, setEnabledMethods] = useState(['cash','mpesa','bank','cheque'])

  useEffect(()=>{
    let alive = true
    async function load(){
      try{
        setLoading(true)
        setError('')
        const [payRes, invRes, methodsRes] = await Promise.all([
          api.get(`/finance/payments/?invoice__student=${id}`),
          api.get(`/finance/invoices/?student=${id}`),
          api.get('/finance/payment-methods/')
        ])
        if (!alive) return
        setPayments(payRes.data)
        setInvoices(invRes.data)
        const mlist = Array.isArray(methodsRes.data)? methodsRes.data : (methodsRes.data?.results||[])
        const enabled = mlist.filter(m=>m.enabled).map(m=>String(m.key).toLowerCase())
        if (enabled.length>0) setEnabledMethods(enabled)
      }catch(e){
        if (!alive) return
        setError(e?.response?.data?.detail || e?.message || 'Failed to load payments')
      }finally{
        alive && setLoading(false)
      }

  async function openReceipt(paymentId){
    setReceipt(null)
    setReceiptLoading(true)
    setShowReceipt(true)
    try{
      const { data } = await api.get(`/finance/payments/${paymentId}/receipt/`)
      setReceipt(data)
    }catch(e){
      setReceipt({ error: e?.response?.data?.detail || e?.message || 'Failed to load receipt' })
    }finally{
      setReceiptLoading(false)
    }
  }

  function onPrintReceipt(){
    try{
      window.print()
    }catch{}
  }
    }
    load()
    return ()=>{ alive = false }
  }, [id])

  function money(n){
    try { return new Intl.NumberFormat('en-KE', { style:'currency', currency:'KES' }).format(Number(n||0)) } catch { return `Ksh. ${n}` }
  }

  async function submitPayment(e){
    e.preventDefault()
    setPayError('')
    if (!payForm.invoice) { setPayError('Please select an invoice'); return }
    const amountNum = parseFloat(payForm.amount)
    if (!(amountNum > 0)) { setPayError('Enter a valid amount greater than 0'); return }
    try{
      setPaying(true)
      // If Bank and has attachment, send multipart
      if (payForm.method === 'bank' && payForm.attachment) {
        const fd = new FormData()
        fd.append('amount', String(amountNum))
        fd.append('method', 'bank')
        fd.append('reference', payForm.reference || '')
        fd.append('attachment', payForm.attachment)
        await api.post(`/finance/invoices/${payForm.invoice}/pay/`, fd, { headers: { 'Content-Type': 'multipart/form-data' }})
      } else {
        await api.post(`/finance/invoices/${payForm.invoice}/pay/`, {
          amount: amountNum,
          method: payForm.method,
          reference: payForm.reference || ''
        })
      }
      setShowPay(false)
      setPayForm({ invoice: '', amount: '', method: 'mpesa', reference: '', phone: '', attachment: null })
      // Refresh lists
      const [payRes, invRes] = await Promise.all([
        api.get(`/finance/payments/?invoice__student=${id}`),
        api.get(`/finance/invoices/?student=${id}`)
      ])
      setPayments(payRes.data)
      setInvoices(invRes.data)
    } catch(e){
      setPayError(e?.response?.data?.detail || e?.message || 'Failed to record payment')
    } finally {
      setPaying(false)
    }
  }

  async function submitStkPush(){
    setPayError('')
    if (!payForm.invoice) { setPayError('Please select an invoice'); return }
    const amountNum = parseFloat(payForm.amount)
    if (!(amountNum > 0)) { setPayError('Enter a valid amount greater than 0'); return }
    if (!payForm.phone) { setPayError('Phone number required for STK'); return }
    try{
      setPaying(true)
      setStkStatus('initiating')
      // baseline count before push
      const before = await api.get(`/finance/payments/?invoice=${payForm.invoice}`)
      const baselineCount = Array.isArray(before.data) ? before.data.length : 0

      const { data } = await api.post(`/finance/invoices/${payForm.invoice}/coop_stk/`, {
        phone: payForm.phone,
        amount: amountNum,
        simulate: false
      })
      // Mark as sent
      setStkStatus('sent')
      // Begin polling for payment creation
      setStkStatus('polling')
      const started = Date.now()
      let found = false
      while (Date.now() - started < 60000) { // up to 60s
        await new Promise(r => setTimeout(r, 3000))
        const poll = await api.get(`/finance/payments/?invoice=${payForm.invoice}`)
        const countNow = Array.isArray(poll.data) ? poll.data.length : 0
        if (countNow > baselineCount) {
          found = true
          break
        }
      }
      if (found) {
        setStkStatus('fetching')
        // Close modal and refresh lists
        setShowPay(false)
        setPayForm({ invoice: '', amount: '', method: 'mpesa', reference: '', phone: '', attachment: null })
        const [payRes, invRes] = await Promise.all([
          api.get(`/finance/payments/?invoice__student=${id}`),
          api.get(`/finance/invoices/?student=${id}`)
        ])
        setPayments(payRes.data)
        setInvoices(invRes.data)
        setStkStatus('success')
      } else {
        setPayError('STK sent, but no confirmation was received in time. It may complete later or has failed.')
        setStkStatus('failed')
      }
    } catch(e){
      setPayError(e?.response?.data?.detail || e?.message || 'Failed to initiate STK push')
      setStkStatus('failed')
    } finally {
      setPaying(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="text-sm text-gray-500"><Link to="/admin" className="hover:underline">Admin</Link> / <Link to="/admin/students" className="hover:underline">Students</Link> / <Link to={`/admin/students/${id}`} className="hover:underline">Dashboard</Link> / <span className="text-gray-700">Payments</span></div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Student Payments</h1>
          <div className="flex items-center gap-3">
            <button onClick={()=>setShowPay(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700">
              <span>➕</span>
              <span>Make Payment</span>
            </button>
            <Link to={`/admin/students/${id}`} className="text-sm text-blue-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>
        {loading && (<div className="bg-white rounded shadow p-4">Loading...</div>)}
        {error && (<div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>)}
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">Payment History</div>
            <a href={`${backendBase.replace(/\/$/, '')}/api/finance/payments/export?invoice__student=${id}`} className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm" target="_blank" rel="noreferrer">
              Download CSV
            </a>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-t">
                  <td>{p.id}</td>
                  <td>{money(p.amount)}</td>
                  <td className="capitalize">{p.method}</td>
                  <td>{p.reference || '-'}</td>
                  <td>{p.created_at?.slice(0,10)}</td>
                  <td>
                    <button onClick={()=>openReceipt(p.id)} className="text-blue-600 hover:underline">View Receipt</button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && !loading && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-6">No payments found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Make Payment Modal */}
        <Modal open={showPay} onClose={()=>setShowPay(false)} title="Make Payment" size="md">
          <form onSubmit={submitPayment} className="grid gap-3">
            {payError && (<div className="bg-red-50 text-red-700 text-sm p-2 rounded">{payError}</div>)}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Invoice</label>
              <select className="border p-2 rounded w-full" value={payForm.invoice} onChange={e=>setPayForm({ ...payForm, invoice: e.target.value })} required>
                <option value="">Select invoice</option>
                {invoices
                  .filter(inv => inv.status !== 'paid')
                  .map(inv => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.id} • {money(inv.amount)} • {inv.status}
                    </option>
                  ))}
              </select>
            </div>
            {/* Payment mode selection removed: default to M-Pesa STK via Co-op */}
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Amount</label>
                <input type="number" min="0" step="0.01" className="border p-2 rounded w-full" value={payForm.amount} onChange={e=>setPayForm({ ...payForm, amount: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Reference</label>
                <input className="border p-2 rounded w-full" placeholder={payForm.method==='mpesa' ? 'M-Pesa Code' : 'Bank Slip/Ref'} value={payForm.reference} onChange={e=>setPayForm({ ...payForm, reference: e.target.value })} />
              </div>
            </div>
            {/* Always require phone for STK */}
            {
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone Number (Mpesa)</label>
                <input className="border p-2 rounded w-full" placeholder="07XXXXXXXX" value={payForm.phone} onChange={e=>setPayForm({ ...payForm, phone: e.target.value })} />
              </div>
            }
            
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={()=>setShowPay(false)} className="px-4 py-2 rounded border">Cancel</button>
              {
                <>
                  <button type="button" onClick={submitStkPush} className={`px-4 py-2 rounded text-white disabled:opacity-60 ${stkStatus==='failed' ? 'bg-red-600' : 'bg-sky-600'}`} disabled={paying}>
                    {stkStatus==='initiating' && 'Sending STK...'}
                    {stkStatus==='sent' && 'STK Sent'}
                    {stkStatus==='polling' && 'Waiting for payment...'}
                    {stkStatus==='fetching' && 'Fetching transaction code...'}
                    {stkStatus==='success' && 'Payment received!'}
                    {stkStatus==='failed' && !paying && 'STK Failed — Retry'}
                    {stkStatus==='idle' && !paying && 'Initiate STK'}
                    {paying && (stkStatus==='idle' || stkStatus==='failed') && 'Processing...'}
                  </button>
                </>
              }
            </div>
            {stkStatus==='failed' && (
              <div className="text-xs text-red-600 mt-1">STK failed or timed out. Please verify the phone number and try again.</div>
            )}
          </form>
        </Modal>
      </div>
      {/* Receipt Modal */}
      <Modal open={showReceipt} onClose={()=>setShowReceipt(false)} title="Payment Receipt" size="md">
        {receiptLoading && (<div className="p-2 text-sm text-gray-600">Loading receipt...</div>)}
        {!receiptLoading && receipt?.error && (<div className="bg-red-50 text-red-700 text-sm p-2 rounded">{receipt.error}</div>)}
        {!receiptLoading && receipt && !receipt.error && (
          <div className="text-sm" id="printable-receipt">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{receipt.school?.name || 'School'}</div>
              <div>Receipt No: {receipt.receipt_no}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <div>Date: {String(receipt.date).slice(0,10)}</div>
                <div>Method: {String(receipt.method).toUpperCase()}</div>
                <div>Reference: {receipt.reference || '-'}</div>
              </div>
              <div>
                <div>Student: {receipt.student?.name} (#{receipt.student?.id})</div>
                <div>Class: {receipt.student?.class || '-'}</div>
                <div>Admission No: {receipt.student?.admission_no || '-'}</div>
              </div>
            </div>
            <div className="border-t py-2">
              <div>Invoice ID: {receipt.invoice} • Invoice Amount: {money(receipt.invoice_amount)}</div>
              <div className="text-lg font-semibold">Amount Paid: {money(receipt.amount)}</div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={onPrintReceipt} className="px-3 py-2 rounded border">Print</button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
