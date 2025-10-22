import React, { createContext, useContext, useEffect, useState } from 'react'
import api from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access')
    if (!token) { setLoading(false); return }
    api.get('/auth/me/').then(res => setUser(res.data)).finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const { data } = await api.post('/auth/token/', { username, password })
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    const me = await api.get('/auth/me/')
    setUser(me.data)
    return me.data
  }

  const logout = () => {
    try {
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        api.post('/auth/logout/', { refresh }).catch(()=>{})
      }
    } catch {}
    localStorage.removeItem('access'); localStorage.removeItem('refresh'); setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
