import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import NumericKeypad from '../components/NumericKeypad'
import { ArrowLeft, Phone, Coins, ShieldCheck, Sparkles, Loader2 } from 'lucide-react'

export default function StudentPayFees(){
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [stkStatus, setStkStatus] = useState('idle') // idle | initiating | sent | polling | success | failed
  const [keypadOpen, setKeypadOpen] = useState(false)
  const [keypadField, setKeypadField] = useState(null) // 'amount' | 'phone'
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

  useEffect(() => {
    if (!keypadOpen) return
    const t = setTimeout(() => {
      try {
        if (keypadField === 'amount') amountRef.current?.blur?.()
        if (keypadField === 'phone') phoneRef.current?.blur?.()
      } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [keypadOpen, keypadField])

  const onBack = () => navigate('/student/finance')

  const openKeypad = (field) => {
    setKeypadField(field)
    setKeypadOpen(true)
  }

  const closeKeypad = () => {
    setKeypadOpen(false)
    setKeypadField(null)
  }

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
      setStkStatus('initiating')

      const beforeSumRes = await api.get('/finance/invoices/my-summary/', { timeout: 15000 })
      const beforeBalance = Number(beforeSumRes?.data?.balance || 0)

      const { data } = await api.post('/finance/invoices/pay-balance-stk/', { phone: norm, amount: amt, simulate: false }, { timeout: 60000 })
      const checkoutId = data?.daraja?.CheckoutRequestID || data?.daraja?.checkoutRequestID || ''

      setStkStatus('sent')
      setStkStatus('polling')

      const started = Date.now()
      let updated = false
      while (Date.now() - started < 60000) {
        await new Promise(r => setTimeout(r, 3000))

        if (checkoutId) {
          try {
            const ipRes = await api.get('/finance/incoming-payments/', { params: { source: 'mpesa', external_id: checkoutId }, timeout: 15000, _skipGlobalLoading: true })
            const ipList = Array.isArray(ipRes.data) ? ipRes.data : (ipRes.data?.results || [])
            const ip = ipList?.[0]
            const st = String(ip?.status || '').toLowerCase()
            if (st === 'matched' || st === 'reconciled' || (ip?.reference && String(ip.reference).trim())) {
              updated = true
              break
            }
          } catch {
          }
        }

        try {
          const pollSum = await api.get('/finance/invoices/my-summary/', { timeout: 15000, _skipGlobalLoading: true })
          const nowBal = Number(pollSum?.data?.balance)
          if (Number.isFinite(nowBal) && nowBal !== beforeBalance) { updated = true; break }
        } catch {
        }
      }

      if (!updated) {
        setStkStatus('failed')
        setError('STK sent, but no confirmation was received in time. It may complete later or has failed.')
        return
      }

      setStkStatus('success')
      navigate('/student/finance', { replace: true, state: { refreshFinance: true } })
    } catch (err) {
      setStkStatus('failed')
      setError(err?.response?.data?.detail || err?.message || 'Failed to initiate STK push')
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
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-500 text-white grid place-items-center shadow-sm">
                <Coins className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Finance</div>
                <div className="text-base sm:text-lg font-semibold text-slate-900 truncate">Pay Fees</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure via M-Pesa STK
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/20 ${statusMeta.cls}`}>
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
              <label className="block text-sm font-semibold text-slate-800">Amount</label>
              <div className="mt-1.5 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Coins className="h-4 w-4" />
                </div>
                <input
                  ref={amountRef}
                  type="text"
                  inputMode="decimal"
                  className="w-full border border-slate-200 rounded-2xl pl-10 pr-3 py-3 text-sm bg-white focus-soft"
                  value={amount}
                  onChange={e=>setAmount(e.target.value)}
                  onFocus={() => openKeypad('amount')}
                  placeholder="e.g. 1500"
                />
              </div>
              <div className="mt-1 text-xs text-slate-500">Enter the amount you want to pay now.</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">Phone (M-Pesa)</label>
              <div className="mt-1.5 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  ref={phoneRef}
                  type="tel"
                  className="w-full border border-slate-200 rounded-2xl pl-10 pr-3 py-3 text-sm bg-white focus-soft"
                  value={phone}
                  onChange={e=>setPhone(e.target.value)}
                  onFocus={() => openKeypad('phone')}
                  placeholder="07XXXXXXXX or 2547XXXXXXXX"
                  inputMode="numeric"
                />
              </div>
              <div className="mt-1 text-xs text-slate-500">We’ll send an STK prompt to this number.</div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Tip: Confirm the prompt on your phone to finish.
              </span>
              {stkStatus !== 'idle' && <span className="font-medium text-slate-600">{String(stkStatus).toUpperCase()}</span>}
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
                className="px-4 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-sky-600 shadow-soft hover:from-emerald-600 hover:to-sky-500 active:scale-[0.99] transition disabled:opacity-60 disabled:shadow-none"
                disabled={submitting || !(Number(amount) > 0 && String(phone||'').trim())}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Processing…' : 'Pay Now'}
                </span>
              </button>
            </div>
          </div>
        </form>

        <div className="mt-4 pb-[76px] sm:pb-0">
          {keypadOpen ? (
            <NumericKeypad
              variant="embedded"
              open={keypadOpen}
              value={keypadField === 'amount' ? amount : (keypadField === 'phone' ? phone : '')}
              allowDecimal={keypadField === 'amount'}
              allowPlus={keypadField === 'phone'}
              preserveLeadingZeros={keypadField === 'phone'}
              maxLength={keypadField === 'phone' ? 12 : undefined}
              onChange={(v) => {
                if (keypadField === 'amount') setAmount(v)
                if (keypadField === 'phone') setPhone(v)
              }}
              onDone={closeKeypad}
            />
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>
      </div>
    </div>
  )
}
