import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { ArrowLeft, Phone, Coins, ShieldCheck, Sparkles, Loader2 } from 'lucide-react'

export default function StudentPayFees(){
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [stkStatus, setStkStatus] = useState('idle') // idle | initiating | sent | polling | success | failed
  const amountRef = useRef(null)
  const phoneRef = useRef(null)

  const statusMeta = useMemo(() => {
    const s = String(stkStatus || 'idle')
    if (s === 'initiating') return { label: 'Starting STK…', cls: 'bg-slate-900 text-white', icon: Loader2, spin: true }
    if (s === 'sent') return { label: 'STK sent', cls: 'bg-slate-900 text-white', icon: ShieldCheck }
    if (s === 'polling') return { label: 'Awaiting confirmation…', cls: 'bg-indigo-600 text-white', icon: Loader2, spin: true }
    if (s === 'success') return { label: 'Payment confirmed', cls: 'bg-emerald-600 text-white', icon: ShieldCheck }
    if (s === 'failed') return { label: 'Not confirmed', cls: 'bg-rose-600 text-white', icon: ShieldCheck }
    return { label: 'Ready', cls: 'bg-slate-100 text-slate-700', icon: Sparkles }
  }, [stkStatus])

  const onBack = () => navigate('/student/finance')

  const submit = async (e) => {
    e?.preventDefault?.()
    setError('')
    const amt = parseFloat(String(amount || '0'))
    if (!(amt > 0)) { setError('Enter a valid amount greater than 0'); return }
    if (!String(phone || '').trim()) { setError('Phone number required for STK'); return }

    let norm = String(phone).trim()
    if (norm.startsWith('+')) norm = norm.slice(1)
    if (norm.startsWith('0') && norm.length === 10) norm = '254' + norm.slice(1)

    try {
      setSubmitting(true)
      // Redirect immediately to confirm page, let it handle the STK initiation
      navigate('/student/finance/confirm', { 
        state: { 
          amount: amt, 
          phone: norm,
          autoInitiate: true
        } 
      })
    } catch (err) {
      setError(err?.message || 'Failed to proceed to confirmation')
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
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-500 text-white grid place-items-center shadow-sm">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Finance</div>
                    <div className="text-xl sm:text-2xl font-semibold text-slate-900 truncate">Pay Fees</div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600 max-w-2xl">Pay school fees directly using M-Pesa STK. Confirm the prompt on your phone to complete the transaction securely.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Secure via M-Pesa
                  </span>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${statusMeta.cls}`}>
                    {(() => {
                      const Icon = statusMeta.icon
                      return <Icon className={`h-3.5 w-3.5 ${statusMeta.spin ? 'animate-spin' : ''}`} />
                    })()}
                    {statusMeta.label}
                  </span>
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
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800">Amount</label>
                  <div className="mt-2 relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Coins className="h-4 w-4" />
                    </div>
                    <input
                      ref={amountRef}
                      type="text"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="e.g. 1500"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Enter the amount you want to pay now.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">Phone (M-Pesa)</label>
                  <div className="mt-2 relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Phone className="h-4 w-4" />
                    </div>
                    <input
                      ref={phoneRef}
                      type="tel"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="07XXXXXXXX or 2547XXXXXXXX"
                      inputMode="numeric"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">We’ll send an STK prompt to this number.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
                <div className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Tip: Confirm the prompt on your phone to finish.
                </div>
                {stkStatus !== 'idle' && <div className="font-medium text-slate-700">{String(stkStatus).toUpperCase()}</div>}
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
                  className="rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:from-emerald-700 hover:to-sky-500 transition disabled:opacity-60 disabled:shadow-none"
                  disabled={submitting || !(Number(amount) > 0 && String(phone || '').trim())}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? 'Processing…' : 'Pay Now'}
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
