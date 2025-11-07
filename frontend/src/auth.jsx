import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import api from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const idleTimer = useRef(null)
  const lastActivity = useRef(Date.now())
  const IDLE_LIMIT_MS = 5 * 60 * 1000

  useEffect(() => {
    const token = localStorage.getItem('access')
    if (!token) { setLoading(false); return }
    api.get('/auth/me/').then(res => {
      const me = res.data
      try { localStorage.setItem('auth_user_id', String(me?.id ?? '')) } catch {}
      setUser(me)
    }).finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const { data } = await api.post('/auth/token/', { username, password })
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    const me = await api.get('/auth/me/')
    setUser(me.data)
    try {
      localStorage.setItem('auth_user_id', String(me?.data?.id ?? ''))
      // Broadcast login to other tabs
      localStorage.setItem('auth_event', `login:${Date.now()}`)
    } catch {}
    return me.data
  }

  const logout = () => {
    try {
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        api.post('/auth/logout/', { refresh }).catch(()=>{})
      }
    } catch {}
    try { localStorage.setItem('auth_event', `logout:${Date.now()}`) } catch {}
    localStorage.removeItem('access'); localStorage.removeItem('refresh'); setUser(null)
  }

  useEffect(() => {
    // Cross-tab auth synchronization
    function onStorage(e) {
      if (e.key === 'auth_event' && e.newValue) {
        const val = String(e.newValue)
        if (val.startsWith('logout:')) {
          setUser(null)
        } else if (val.startsWith('login:')) {
          // Another tab logged in (possibly a different user). Reset local state.
          setUser(null)
          // Optionally refresh to reflect new session
          if (typeof window !== 'undefined') {
            window.location.replace('/app')
          }
        }
      }
      if ((e.key === 'access' || e.key === 'refresh') && e.newValue == null) {
        // Tokens removed in another tab
        setUser(null)
      }
    }
    window.addEventListener('storage', onStorage)

    function resetTimer() {
      lastActivity.current = Date.now()
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (user) {
        idleTimer.current = setTimeout(() => {
          if (!user) return
          const idleFor = Date.now() - lastActivity.current
          if (idleFor >= IDLE_LIMIT_MS) {
            logout()
          } else {
            resetTimer()
          }
        }, IDLE_LIMIT_MS)
      }
    }

    function onActivity() { resetTimer() }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        resetTimer()
      }
    }

    resetTimer()
    const events = ['mousemove','keydown','click','touchstart']
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      events.forEach(ev => window.removeEventListener(ev, onActivity))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
