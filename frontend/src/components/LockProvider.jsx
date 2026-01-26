import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../auth'
import { playSound } from '../utils/sounds'

const LockContext = createContext({ locked: false, lock: () => {}, unlock: async () => {} })

const STORAGE_KEY = 'app_locked_at'

function setLockedStorage(locked) {
  try {
    if (locked) localStorage.setItem(STORAGE_KEY, String(Date.now()))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function readLockedStorage() {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch { return false }
}

export default function LockProvider({ children }) {
  const { user, logout, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [locked, setLocked] = useState(readLockedStorage())
  const [lastActiveAt, setLastActiveAt] = useState(new Date())
  const redirectRef = useRef(null)

  // Sync lock state across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const isLocked = !!e.newValue
        setLocked(isLocked)
        if (!isLocked) {
          setLastActiveAt(new Date())
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Sync lock state with auth session. On logout clear lock; on login respect persisted lock and only schedule timer if not locked.
  useEffect(() => {
    if (loading) return
    if (!user) {
      setLocked(false)
      setLockedStorage(false)
    } else {
      const persistedLocked = readLockedStorage()
      if (persistedLocked) {
        setLocked(true)
      } else {
        setLocked(false)
        setLockedStorage(false)
        setLastActiveAt(new Date())
      }
    }
  }, [user, loading])

  const lock = useCallback(() => { setLocked(true); setLockedStorage(true); try { playSound('lock') } catch {} }, [])

  const unlock = useCallback(async (password) => {
    if (!user) return { ok: false, error: 'Not authenticated' }
    try {
      const username = user?.username || user?.email
      if (!username) return { ok: false, error: 'No username on session' }
      const { data } = await api.post('/auth/token/', { username, password })
      if (data?.access) localStorage.setItem('access', data.access)
      if (data?.refresh) localStorage.setItem('refresh', data.refresh)
      setLocked(false)
      setLockedStorage(false)
      setLastActiveAt(new Date())
      // Navigate back to intended route
      try {
        const target = redirectRef.current || sessionStorage.getItem('lock_redirect') || null
        if (target) {
          sessionStorage.removeItem('lock_redirect')
          redirectRef.current = null
          navigate(target, { replace: true })
        }
      } catch {}
      return { ok: true }
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Invalid password'
      return { ok: false, error: msg }
    }
  }, [user, navigate])

  const value = useMemo(() => ({ locked, lock, unlock }), [locked, lock, unlock])

  // When locked, route to /lock and store redirect path
  useEffect(() => {
    if (!user) return
    if (locked) {
      try {
        const current = location.pathname + (location.search || '')
        if (location.pathname !== '/lock') {
          redirectRef.current = current
          sessionStorage.setItem('lock_redirect', current)
          navigate('/lock', { replace: true })
        }
      } catch {}
    }
  }, [locked, user, location.pathname, location.search, navigate])

  return (
    <LockContext.Provider value={value}>
      {children}
      {/* Fallback overlay so lock is always visible even if routing doesn't switch to /lock */}
      {user && locked && location.pathname !== '/lock' && createPortal(
        <LockScreen onUnlock={unlock} onLogout={logout} user={user} lastActiveAt={lastActiveAt} />,
        typeof document !== 'undefined' ? document.body : undefined
      )}
    </LockContext.Provider>
  )
}

export const useLock = () => useContext(LockContext)

// Kept for reuse by LockPage via import if desired
export function LockScreen({ onUnlock, onLogout, user, lastActiveAt, embedded = false }){
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)

  const submit = async (e) => {
    e?.preventDefault?.()
    setLoading(true); setError('')
    const res = await onUnlock(password)
    setLoading(false)
    if (!res.ok) setError(res.error || 'Invalid password')
    else setPassword('')
  }

  const Card = (
    <div className="w-full max-w-sm bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/60 p-6">
      <div className="flex items-center gap-3 mb-4">
        {(user?.avatar_url || user?.photo_url || user?.profile_picture_url) ? (
          <img src={user?.avatar_url || user?.photo_url || user?.profile_picture_url} alt="Avatar" className="w-11 h-11 rounded-full object-cover ring-2 ring-indigo-200" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 text-sm flex items-center justify-center font-semibold ring-2 ring-indigo-200">
            {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-gray-900 font-semibold">Session Locked</div>
          <div className="text-gray-500 text-sm">Enter your password to continue</div>
          {lastActiveAt && <div className="text-gray-400 text-xs mt-0.5">Last active: {new Date(lastActiveAt).toLocaleString()}</div>}
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="relative group">
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyUp={(e)=> setCaps(e.getModifierState && e.getModifierState('CapsLock'))}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-16 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
            placeholder="••••••••"
            autoFocus
          />
          <button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-2 top-9 -mt-1 text-xs text-indigo-700 font-semibold">{show ? 'Hide' : 'Show'}</button>
          {caps && <div className="mt-1 text-[11px] text-amber-700">Caps Lock is ON</div>}
        </div>
        {error && <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={onLogout} className="px-3 py-2 rounded-lg text-sm border bg-white text-gray-700 hover:bg-gray-50">Logout</button>
          <button type="submit" disabled={loading || !password} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50">
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  )

  if (embedded) return Card

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6">
      {Card}
    </div>
  )
}
