import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLock } from '../components/LockProvider'

export default function ReAuth() {
  const { unlock } = useLock()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.redirectTo || '/app'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await unlock(password)
    setLoading(false)
    if (!res.ok) {
      setError(res.error || 'Invalid password')
      return
    }
    nav(redirectTo, { replace: true, state: { reauth_ok: true } })
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-md shadow-xl p-8">
        <h1 className="text-xl font-semibold text-slate-800">Confirm your password</h1>
        <p className="mt-1 text-sm text-slate-600">For security, please verify before accessing this section.</p>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex items-center justify-end pt-2">
            <button type="submit" disabled={loading || !password} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
