import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import api from '../api'

const navItems = [
  { to: '/superadmin', label: 'Dashboard', icon: '🛡️' },
  { to: '/superadmin/demo-requests', label: 'Demo Requests', icon: '🧾' },
  { to: '/superadmin/schools', label: 'Schools', icon: '🏫' },
  { to: '/superadmin/analysis', label: 'System Analysis', icon: '📊' },
  { to: '/superadmin/maintenance', label: 'Maintenance', icon: '🛠️' },
  { to: '/superadmin/system-config', label: 'System Domain', icon: '🌐' },
  { to: '/superadmin/profile', label: 'My Profile', icon: '👤' },
]

export default function SuperAdminLayout({ children }){
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [displayUser, setDisplayUser] = useState(user)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => { setIsMobileOpen(false) }, [pathname])

  useEffect(() => { setDisplayUser(user) }, [user])

  useEffect(() => {
    const u = displayUser || user || {}
    const a = u.avatar_url || u.profile_picture_url || ''
    if (a) setAvatarUrl(a)
  }, [displayUser, user])

  useEffect(() => {
    const onUpdated = (e) => {
      const email = e?.detail?.email
      const username = e?.detail?.username
      const url = e?.detail?.avatar_url
      if (url) setAvatarUrl(url)
      if (email || username) {
        setDisplayUser(prev => ({ ...(prev || {}), ...(email ? { email } : {}), ...(username ? { username } : {}) }))
        if (url) return
      }
      api.get('/auth/me/', { _skipGlobalLoading: true })
        .then(res => {
          setDisplayUser(res?.data || user)
          const a = res?.data?.avatar_url || res?.data?.profile_picture_url || ''
          if (a) setAvatarUrl(a)
        })
        .catch(() => {})
    }
    try { window.addEventListener('profile:updated', onUpdated) } catch {}
    return () => { try { window.removeEventListener('profile:updated', onUpdated) } catch {} }
  }, [user])

  const Item = ({ to, label, icon, forceLabel = false }) => {
    const normalizePath = (p) => String(p || '').replace(/\/+$/, '') || '/'
    const currentPath = normalizePath(pathname)
    const targetPath = normalizePath(to)
    const active = targetPath === '/superadmin'
      ? currentPath === targetPath
      : currentPath === targetPath || currentPath.startsWith(targetPath + '/')
    const showLabel = isOpen || forceLabel
    return (
      <Link
        to={to}
        title={!showLabel ? label : undefined}
        className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.99] ${active ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400/30' : 'text-slate-700 hover:bg-slate-100 hover:ring-1 hover:ring-slate-200/70'}`}
      >
        <span
          aria-hidden
          className={`absolute left-1 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-white transition-opacity ${active ? 'opacity-90' : 'opacity-0'}`}
        />
        <span className={`grid place-items-center h-9 w-9 rounded-xl text-base transition-all ${active ? 'bg-white/15 ring-1 ring-white/20' : 'bg-slate-100 group-hover:bg-white group-hover:ring-1 group-hover:ring-slate-200/70'}`}>{icon}</span>
        <span className={`${showLabel ? 'block' : 'hidden'} whitespace-nowrap`}>{label}</span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur border-b border-slate-200">
        <button onClick={() => setIsMobileOpen(v => !v)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Menu</button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600" />
          <div className="font-extrabold tracking-tight text-slate-900">Super Admin</div>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Logout</button>
      </div>

      <div className="flex">
        <aside className={`bg-white/90 backdrop-blur border-r border-slate-200 h-[100dvh] sticky top-0 hidden md:flex flex-col ${isOpen ? 'w-72' : 'w-24'} transition-all duration-200`}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
            <div className={`flex items-center gap-3 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity`}
            >
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600" />
              <div>
                <div className="font-extrabold tracking-tight text-slate-900 leading-tight">Super Admin</div>
                <div className="text-[11px] text-slate-500">System console</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(v => !v)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-700" aria-label="Toggle sidebar">☰</button>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map(i => (
              <Item key={i.to} {...i} />
            ))}
          </nav>

          <div className="mt-auto p-3 border-t border-slate-200">
            <div className={`items-center gap-3 ${isOpen ? 'flex' : 'hidden'}`}>
              <div className="h-9 w-9 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-slate-700 text-xs font-semibold">{String((displayUser?.first_name || displayUser?.username || 'U')[0] || 'U').toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-700 truncate">{displayUser?.email || displayUser?.username || ''}</div>
                <div className="text-[11px] text-slate-500 truncate">Signed in</div>
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className={`mt-3 w-full px-3 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 ${isOpen ? 'block' : 'hidden'}`}
            >
              Logout
            </button>
          </div>
        </aside>

        {isMobileOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-80 bg-white border-r border-slate-200 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600" />
                  <div className="font-extrabold tracking-tight text-slate-900">Super Admin</div>
                </div>
                <button onClick={() => setIsMobileOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-700">✖</button>
              </div>
              <div className="space-y-1">
                {navItems.map(i => (
                  <Item key={i.to} {...i} forceLabel />
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
