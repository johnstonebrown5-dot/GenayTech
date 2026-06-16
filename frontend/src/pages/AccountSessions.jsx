import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { toast } from '../utils/toast'
import { useAuth } from '../auth'

function fmtDate(v){
  try{
    if (!v) return ''
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString()
  }catch{
    return String(v || '')
  }
}

export default function AccountSessions(){
  const { logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [busyJti, setBusyJti] = useState('')
  const [busyAll, setBusyAll] = useState(false)

  const refreshToken = useMemo(() => {
    try { return localStorage.getItem('refresh') || '' } catch { return '' }
  }, [])

  // Extract JTI from the refresh token for identifying current session
  const currentJti = useMemo(() => {
    if (!refreshToken) return ''
    try {
      // JWT format: header.payload.signature
      const parts = refreshToken.split('.')
      if (parts.length !== 3) return ''
      const payload = JSON.parse(atob(parts[1]))
      return payload.jti || ''
    } catch {
      return ''
    }
  }, [refreshToken])

  const load = async (jti) => {
    setLoading(true)
    setError('')
    try{
      const url = jti ? `/auth/sessions/?current_jti=${encodeURIComponent(jti)}` : '/auth/sessions/'
      const res = await api.get(url)
      const list = res?.data?.results || []
      setItems(Array.isArray(list) ? list : [])
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to load sessions')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{
    if (currentJti || !refreshToken) {
      load(currentJti)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJti, refreshToken])

  const revokeOne = async (jti) => {
    if (!jti || busyJti) return
    setBusyJti(jti)
    try{
      await api.post('/auth/sessions/revoke/', { jti })
      toast('Session revoked.', 'success')
      await load(currentJti)
    }catch(e){
      toast(e?.response?.data?.detail || e?.message || 'Failed to revoke session', 'error')
    }finally{
      setBusyJti('')
    }
  }

  const revokeAll = async (keepCurrent) => {
    if (busyAll) return
    setBusyAll(true)
    try{
      const url = keepCurrent ? '/auth/sessions/revoke-all/?keep_current=1' : '/auth/sessions/revoke-all/'
      const body = keepCurrent ? { refresh: refreshToken } : {}
      await api.post(url, body)
      toast(keepCurrent ? 'Logged out on other devices.' : 'Logged out on all devices.', 'success')
      if (!keepCurrent) {
        // Immediate local logout if everything was revoked
        logout()
      } else {
        await load(currentJti)
      }
    }catch(e){
      toast(e?.response?.data?.detail || e?.message || 'Failed to revoke sessions', 'error')
    }finally{
      setBusyAll(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 px-4 py-4 sm:px-0">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
          aria-label="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Active Sessions</h1>
          <p className="text-sm text-gray-600 mt-1">View where your account is logged in and sign out sessions you don’t recognize.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-gray-700">
          Use these actions to end sessions.
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => revokeAll(true)}
            disabled={busyAll}
            className="px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
          >
            {busyAll ? 'Working…' : 'Log out other devices'}
          </button>
          <button
            type="button"
            onClick={() => revokeAll(false)}
            disabled={busyAll}
            className="px-4 py-2 rounded-full text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busyAll ? 'Working…' : 'Log out all sessions'}
          </button>
        </div>
      </div>

      {loading && <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm text-sm text-gray-600">Loading sessions...</div>}
      {error && <div className="bg-red-50 text-red-700 p-5 rounded-3xl border border-red-100 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-slate-900">Sessions ({items.length})</div>
            {items.length === 0 ? (
              <div className="p-5 text-sm text-slate-600">No active sessions found.</div>
            ) : (
              <div className="divide-y">
                {items.map((s) => (
                  <div key={s?.jti || s?.id} className={`p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between ${s?.is_current ? 'bg-sky-50' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-base font-semibold text-slate-900 truncate">{s?.device_name || 'Unknown Device'}</div>
                        {s?.is_current && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-[10px] font-bold text-white uppercase tracking-[0.18em]">Current</span>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-slate-500 flex flex-wrap gap-3">
                        <span className="truncate">Session: {String(s?.jti || '').slice(0, 12)}…</span>
                        <span className="truncate">Logged in: {fmtDate(s?.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => revokeOne(s?.jti)}
                        disabled={busyJti === s?.jti}
                        className={`inline-flex items-center justify-center rounded-3xl px-4 py-3 text-sm font-semibold shadow-sm transition ${
                          s?.is_current ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-900 text-white hover:bg-slate-800'
                        } disabled:opacity-60`}
                      >
                        {busyJti === s?.jti ? 'Revoking…' : s?.is_current ? 'Logout Now' : 'Revoke'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
