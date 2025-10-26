import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'
import { useAuth } from '../auth'

const LockContext = createContext({ locked: false, lock: () => {}, unlock: async () => {} })

const TEN_MINUTES = 10 * 60 * 1000
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

export default function LockProvider({ children, timeoutMs = TEN_MINUTES }) {
  const { user, logout, loading } = useAuth()
  const [locked, setLocked] = useState(readLockedStorage())
  const timerRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const [lastActiveAt, setLastActiveAt] = useState(new Date(lastActivityRef.current))

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }

  const schedule = useCallback(() => {
    clearTimer()
    const now = Date.now()
    const elapsed = now - lastActivityRef.current
    const remaining = Math.max(0, timeoutMs - elapsed)
    timerRef.current = setTimeout(() => {
      setLocked(true)
      setLockedStorage(true)
    }, remaining)
  }, [timeoutMs])

  const markActivity = useCallback(() => {
    if (!user || locked) return
    lastActivityRef.current = Date.now()
    setLastActiveAt(new Date(lastActivityRef.current))
    schedule()
  }, [locked, schedule, user])

  // Global activity listeners
  useEffect(() => {
    if (!user) { clearTimer(); setLocked(false); setLockedStorage(false); return }

    const handler = () => markActivity()
    const visHandler = () => { if (document.visibilityState === 'visible') handler() }

    const events = ['mousemove','mousedown','keydown','scroll','touchstart','click']
    events.forEach(e => window.addEventListener(e, handler, { passive: true }))
    document.addEventListener('visibilitychange', visHandler)

    // Initial schedule
    schedule()

    return () => {
      clearTimer()
      events.forEach(e => window.removeEventListener(e, handler))
      document.removeEventListener('visibilitychange', visHandler)
    }
  }, [user, schedule, markActivity])

  // Sync lock state across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const isLocked = !!e.newValue
        setLocked(isLocked)
        if (!isLocked) {
          // resume timer on unlock from another tab
          lastActivityRef.current = Date.now()
          setLastActiveAt(new Date(lastActivityRef.current))
          schedule()
        } else {
          clearTimer()
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [schedule])

  // If user logs out, clear lock. Avoid clearing while auth is still loading (e.g., on refresh)
  useEffect(() => {
    if (loading) return
    if (!user) { setLocked(false); setLockedStorage(false); clearTimer() }
  }, [user, loading])

  const lock = useCallback(() => { setLocked(true); setLockedStorage(true); clearTimer() }, [])

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
      lastActivityRef.current = Date.now()
      setLastActiveAt(new Date(lastActivityRef.current))
      schedule()
      return { ok: true }
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Invalid password'
      return { ok: false, error: msg }
    }
  }, [user, schedule])

  const value = useMemo(() => ({ locked, lock, unlock }), [locked, lock, unlock])

  return (
    <LockContext.Provider value={value}>
      {children}
      {locked && <LockScreen onUnlock={unlock} onLogout={logout} user={user} lastActiveAt={lastActiveAt} />}
    </LockContext.Provider>
  )
}

export const useLock = () => useContext(LockContext)

function LockScreen({ onUnlock, onLogout, user, lastActiveAt }){
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e?.preventDefault?.()
    setLoading(true); setError('')
    const res = await onUnlock(password)
    setLoading(false)
    if (!res.ok) setError(res.error || 'Invalid password')
    else setPassword('')
  }

  return (
    <div className="fixed inset-0 z-[3000] bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          { (user?.avatar_url || user?.photo_url || user?.profile_picture_url) ? (
            <img src={user?.avatar_url || user?.photo_url || user?.profile_picture_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 text-sm flex items-center justify-center font-semibold">
              {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
            </div>
          ) }
          <div>
            <div className="text-gray-900 font-semibold">Session Locked</div>
            <div className="text-gray-500 text-sm">Enter your password to continue</div>
            {lastActiveAt && (
              <div className="text-gray-400 text-xs mt-0.5">Last active: {new Date(lastActiveAt).toLocaleString()}</div>
            )}
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={onLogout} className="text-gray-600 hover:text-gray-900 text-sm">Logout</button>
            <button type="submit" disabled={loading || !password} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
