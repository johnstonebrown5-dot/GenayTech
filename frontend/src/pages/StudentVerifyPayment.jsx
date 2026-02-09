import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function StudentVerifyPayment(){
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onBack = () => navigate('/student/finance')

  const submit = async (e) => {
    e?.preventDefault?.()
    setError('')
    const r = String(receipt || '').trim()
    if (!r) { setError('Enter the M-Pesa Transaction ID to verify'); return }
    try {
      setSubmitting(true)
      await api.post('/finance/incoming-payments/verify_mpesa/', { receipt: r })
      navigate('/student/finance', { replace: true, state: { refreshFinance: true } })
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to verify payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="-mx-3 sm:mx-0 bg-white/95 backdrop-blur-xl border border-slate-200/70 shadow-[0_18px_45px_rgba(15,23,42,0.08)] rounded-none sm:rounded-3xl pt-4 pb-6 px-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Finance</div>
          <div className="text-base sm:text-lg font-semibold text-slate-900">Verify Payment</div>
        </div>
        <button onClick={onBack} className="px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50">Back</button>
      </div>

      {error && <div className="mb-3 bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">M-Pesa Transaction ID</label>
          <input
            type="text"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            value={receipt}
            onChange={e=>setReceipt(e.target.value)}
            placeholder="e.g. QWERTY123"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="flex-1 px-4 py-2 rounded-lg border text-sm" disabled={submitting}>Cancel</button>
          <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm disabled:opacity-60" disabled={submitting || !String(receipt||'').trim()}>
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      </form>
    </div>
  )
}
