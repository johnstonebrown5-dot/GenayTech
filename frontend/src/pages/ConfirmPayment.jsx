import React, { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, ShieldCheck, Smartphone, ReceiptText } from 'lucide-react'
import api from '../api'

export default function ConfirmPayment() {
  const location = useLocation()
  const navigate = useNavigate()
  const { amount, phone, autoInitiate } = location.state || {}
  
  const [status, setStatus] = useState('initiating') // initiating | polling | success | failed
  const [checkoutId, setCheckoutId] = useState(null)
  const [beforeBalance, setBeforeBalance] = useState(null)
  const [error, setError] = useState('')
  const [dots, setDots] = useState('')
  const pollingRef = useRef(true)

  useEffect(() => {
    if (!amount || !phone) {
      navigate('/student/finance/pay')
      return
    }

    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'))
    }, 500)

    const startPaymentFlow = async () => {
      try {
        // 1. Get initial balance for fallback polling
        const beforeSumRes = await api.get('/finance/invoices/my-summary/', { timeout: 15000 })
        const bal = Number(beforeSumRes?.data?.balance || 0)
        setBeforeBalance(bal)

        // 2. Initiate STK Push
        const { data } = await api.post('/finance/invoices/pay-balance-stk/', 
          { phone, amount, simulate: false }, 
          { timeout: 60000 }
        )
        const cid = data?.daraja?.CheckoutRequestID || data?.daraja?.checkoutRequestID || ''
        
        if (cid) {
          setCheckoutId(cid)
          setStatus('polling')
          pollStatus(cid, bal)
        } else {
          // Fallback if no checkoutId but request was "accepted"
          setStatus('polling')
          pollStatus(null, bal)
        }
      } catch (err) {
        setStatus('failed')
        setError(err?.response?.data?.detail || err?.message || 'Failed to initiate STK push')
      }
    }

    if (autoInitiate) {
      startPaymentFlow()
    }

    return () => {
      pollingRef.current = false
      clearInterval(interval)
    }
  }, [amount, phone, autoInitiate, navigate])

  const pollStatus = async (cid, bBal) => {
    const started = Date.now()
    const timeout = 60000 // 60 seconds

    while (pollingRef.current && Date.now() - started < timeout) {
      try {
        // 1. Check IncomingPayment by CheckoutRequestID
        if (cid) {
          const ipRes = await api.get('/finance/incoming-payments/', { 
            params: { source: 'mpesa', external_id: cid }, 
            _skipGlobalLoading: true 
          })
          const ipList = Array.isArray(ipRes.data) ? ipRes.data : (ipRes.data?.results || [])
          const ip = ipList?.[0]
          const st = String(ip?.status || '').toLowerCase()
          
          if (st === 'matched' || st === 'reconciled' || (ip?.reference && String(ip.reference).trim())) {
            handleSuccess()
            break
          }
        }

        // 2. Fallback: Check balance change
        const pollSum = await api.get('/finance/invoices/my-summary/', { _skipGlobalLoading: true })
        const nowBal = Number(pollSum?.data?.balance)
        if (Number.isFinite(nowBal) && Number.isFinite(bBal) && nowBal !== bBal) {
          handleSuccess()
          break
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
      await new Promise(r => setTimeout(r, 3000))
    }

    if (pollingRef.current && status === 'polling') {
      setStatus('failed')
      setError('Confirmation timeout. Please check your Finance tab in a few minutes or verify manually.')
    }
  }

  const handleSuccess = () => {
    setStatus('success')
    setTimeout(() => {
      navigate('/student/finance', { replace: true, state: { refreshFinance: true } })
    }, 2000)
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        
        {status === 'initiating' && (
          <div className="space-y-8 w-full flex flex-col items-center animate-in fade-in duration-500">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-indigo-50 flex items-center justify-center border-2 border-indigo-100/50">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              </div>
            </div>
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Initializing</h2>
              <p className="text-slate-500 text-sm px-4">
                Setting up secure payment for <span className="font-bold text-slate-900">KES {amount}</span>
              </p>
            </div>
          </div>
        )}

        {status === 'polling' && (
          <div className="space-y-8 w-full flex flex-col items-center animate-in slide-in-from-bottom-4 duration-500">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-sky-50 flex items-center justify-center border-4 border-sky-100/50 animate-pulse">
                <Smartphone className="h-10 w-10 text-sky-600" />
              </div>
              <div className="absolute -top-1 -right-1">
                <div className="h-8 w-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100">
                  <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />
                </div>
              </div>
            </div>

            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Confirming Payment</h2>
              <p className="text-slate-500 text-sm px-6 leading-relaxed">
                Please check your phone and enter your M-Pesa PIN for 
                <span className="block font-bold text-slate-900 text-xl mt-2">KES {amount}</span>
              </p>
            </div>

            <div className="w-full space-y-4">
              <div className="bg-slate-50 rounded-2xl p-5 w-full flex flex-col gap-3 border border-slate-100">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Transaction Status</span>
                  <span className="text-sky-600 font-bold flex items-center gap-1.5 bg-sky-100/50 px-2 py-0.5 rounded-full">
                    Waiting for PIN{dots}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }}></div>
                </div>
              </div>

              <button 
                onClick={() => navigate('/student/finance')}
                className="w-full text-slate-400 text-xs hover:text-slate-600 transition underline underline-offset-4 font-medium py-2"
              >
                Continue to dashboard while we process
              </button>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-8 w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="h-24 w-24 rounded-full bg-emerald-50 flex items-center justify-center border-4 border-emerald-100/50">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Received!</h2>
              <p className="text-slate-500 text-sm px-8 leading-relaxed">
                Your payment of <span className="font-bold text-emerald-700">KES {amount}</span> has been confirmed.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 text-emerald-600 font-bold text-sm bg-emerald-50 py-2.5 px-6 rounded-2xl">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting...
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="space-y-8 w-full flex flex-col items-center animate-in fade-in duration-300">
            <div className="h-24 w-24 rounded-full bg-rose-50 flex items-center justify-center border-4 border-rose-100/50">
              <Smartphone className="h-10 w-10 text-rose-600" />
            </div>
            
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Request Failed</h2>
              <p className="text-rose-600 text-sm px-6 font-medium leading-relaxed">
                {error}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full pt-4">
              <button 
                onClick={() => navigate('/student/finance/pay')}
                className="px-4 py-3.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition active:scale-[0.98]"
              >
                Try Again
              </button>
              <button 
                onClick={() => navigate('/student/finance/verify')}
                className="px-4 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-200 active:scale-[0.98]"
              >
                Verify Manually
              </button>
            </div>
          </div>
        )}

        <div className="mt-12 flex items-center justify-center gap-6 text-[10px] text-slate-300 uppercase font-black tracking-[0.3em]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            SECURE
          </div>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-3.5 w-3.5" />
            RECEIPT
          </div>
        </div>
      </div>
    </div>
  )
}
