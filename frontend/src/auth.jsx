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

    // Load from cache first for instant UI
    const cachedUser = localStorage.getItem('user_data')
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser)
        setUser(parsed)
        setLoading(false)  // Set loading false immediately
      } catch (e) {
        // Ignore invalid cache
      }
    }

    // Fetch fresh data in background
    api.get('/auth/me/').then(res => {
      const me = res.data
      try { localStorage.setItem('auth_user_id', String(me?.id ?? '')) } catch {}
      // Update state if different
      setUser(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(me)) {
          try { localStorage.setItem('user_data', JSON.stringify(me)) } catch {}
          return me
        }
        return prev
      })
    }).catch((err) => {
      const status = err?.response?.status
      // If token is invalid/expired, force logout so routes redirect to login.
      if (status === 401 || status === 403) {
        try { localStorage.removeItem('access') } catch {}
        try { localStorage.removeItem('refresh') } catch {}
        try { localStorage.removeItem('user_data') } catch {}
        setUser(null)
        setLoading(false)
        return
      }
      // If fetch fails and no cache, clear and set loading false
      if (!cachedUser) {
        setUser(null)
        setLoading(false)
      }
    })
  }, [])

  const login = async (username, password) => {
    const { data } = await api.post('/auth/token/?include_me=1', { username, password })
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    let meData = data?.user
    if (!meData) {
      const me = await api.get('/auth/me/')
      meData = me.data
    }
    setUser(meData)
    try {
      localStorage.setItem('auth_user_id', String(meData?.id ?? ''))
      localStorage.setItem('user_data', JSON.stringify(meData))  // Cache user data
      // Broadcast login to other tabs
      localStorage.setItem('auth_event', `login:${Date.now()}`)
    } catch {}
    try { playSound('login') } catch {}
    return meData
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
