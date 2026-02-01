import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../api'

export default function VerifyEmail(){
  const location = useLocation()
  const [status, setStatus] = useState('loading') // loading | ok | error
  const [message, setMessage] = useState('')

  const token = (() => {
    try { return new URLSearchParams(location.search).get('token') || '' } catch { return '' }
  })()

  useEffect(() => {
    let mounted = true
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token.')
      return
    }
    ;(async () => {
      try {
        await api.get(`/auth/verify-email/?token=${encodeURIComponent(token)}`, { _skipGlobalLoading: true })
        if (!mounted) return
        setStatus('ok')
        setMessage('Your email has been verified. You can now log in.')
      } catch (e) {
        if (!mounted) return
        setStatus('error')
        setMessage(e?.response?.data?.detail || 'Verification failed. The link may be invalid or expired.')
      }
    })()
    return () => { mounted = false }
  }, [token])

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="text-xl font-semibold text-gray-900">Verify email</div>
          <div className="mt-2 text-sm text-gray-600">
            {status === 'loading' ? 'Verifying…' : message}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Go to login</Link>
            <Link to="/" className="px-4 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50">Back to site</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
