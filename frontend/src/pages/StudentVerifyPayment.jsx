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
    <div className="-mx-3 sm:mx-0 rounded-none sm:rounded-3xl overflow-hidden border border-slate-200/70 shadow-[0_18px_45px_rgba(15,23,42,0.08)] bg-gradient-to-br from-white via-white to-slate-50">
      <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white grid place-items-center shadow-sm">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Finance</div>
                <div className="text-base sm:text-lg font-semibold text-slate-900 truncate">Verify Payment</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verify an M-Pesa receipt
              </span>
            </div>
          </div>

          <button
            onClick={onBack}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 active:scale-[0.99] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-4 pb-6">
        {error && <div className="mb-3 bg-rose-50 border border-rose-200 rounded-2xl p-3 text-sm text-rose-800">{error}</div>}

        <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200 shadow-card p-4 sm:p-5">
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800">M-Pesa Transaction ID</label>
              <div className="mt-1.5 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-2xl pl-10 pr-3 py-3 text-sm bg-white focus-soft"
                  value={receipt}
                  onChange={e=>setReceipt(e.target.value)}
                  placeholder="e.g. QWERTY123"
                  autoFocus
                />
              </div>
              <div className="mt-1 text-xs text-slate-500">Find this on your M-Pesa message (Transaction ID / Receipt).</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 active:scale-[0.99] transition disabled:opacity-60"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 shadow-soft hover:from-sky-600 hover:to-indigo-500 active:scale-[0.99] transition disabled:opacity-60 disabled:shadow-none"
                disabled={submitting || !String(receipt||'').trim()}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Verifying…' : 'Verify'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
