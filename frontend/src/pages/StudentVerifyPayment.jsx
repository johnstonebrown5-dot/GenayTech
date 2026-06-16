import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { ArrowLeft, BadgeCheck, ReceiptText, Loader2, ShieldCheck } from 'lucide-react'

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
    <div className="px-4 sm:px-6 pb-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-gradient-to-br from-white via-white to-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white grid place-items-center shadow-sm">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Finance</div>
                    <div className="text-xl sm:text-2xl font-semibold text-slate-900 truncate">Verify Payment</div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600 max-w-2xl">Enter the M-Pesa transaction ID to verify your payment and update your fee statement.</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify an M-Pesa receipt
                </div>
              </div>
              <button
                onClick={onBack}
                className="shrink-0 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          </div>

          <div className="px-4 sm:px-6 pb-6 pt-5">
            {error && <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
            <form onSubmit={submit} className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <label className="block text-sm font-semibold text-slate-800">M-Pesa Transaction ID</label>
                <div className="mt-2 relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <ReceiptText className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    value={receipt}
                    onChange={e => setReceipt(e.target.value)}
                    placeholder="e.g. QWERTY123"
                    autoFocus
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Find this on your M-Pesa message (Transaction ID / Receipt).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:from-sky-700 hover:to-indigo-500 transition disabled:opacity-60 disabled:shadow-none"
                  disabled={submitting || !String(receipt || '').trim()}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? 'Verifying…' : 'Verify'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
