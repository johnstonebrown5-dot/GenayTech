import React, { createContext, useContext, useEffect, useState } from 'react'
import api from './api'
import { playSound } from './utils/sounds'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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
    try { playSound('login') } catch {}
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
    try { playSound('logout') } catch {}
    localStorage.removeItem('access'); localStorage.removeItem('refresh'); setUser(null)
  }

  useEffect(() => {
    // Cross-tab auth synchronization only; inactivity locking is handled by LockProvider.
    function onStorage(e) {
      if (e.key === 'auth_event' && e.newValue) {
        const val = String(e.newValue)
        if (val.startsWith('logout:')) {
          setUser(null)
        } else if (val.startsWith('login:')) {
          setUser(null)
          if (typeof window !== 'undefined') {
            window.location.replace('/app')
          }
        }
      }
      if ((e.key === 'access' || e.key === 'refresh') && e.newValue == null) {
        setUser(null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
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
