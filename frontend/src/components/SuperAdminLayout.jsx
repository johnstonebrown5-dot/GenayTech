import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import api from '../api'

import {
  LayoutDashboard,
  School,
  Users,
  BarChart3,
  ScrollText,
  CreditCard,
  FileText,
  MessagesSquare,
  GraduationCap,
  Briefcase,
  Globe,
  Wrench,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'

const navItems = [
  { to: '/superadmin', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/superadmin/schools', label: 'Schools', Icon: School },
  { to: '/superadmin/students', label: 'Students', Icon: Users },
  { to: '/superadmin/analysis', label: 'System Analysis', Icon: BarChart3 },
  { to: '/superadmin/logs', label: 'Logs', Icon: ScrollText },
  { to: '/superadmin/payment-methods', label: 'Payment Methods', Icon: CreditCard },
  { to: '/superadmin/reports', label: 'Reports', Icon: FileText },
  { to: '/superadmin/communication', label: 'Communication', Icon: MessagesSquare },
  { to: '/superadmin/examinations', label: 'Examinations', Icon: GraduationCap },
  { to: '/superadmin/human-resource', label: 'Human Resource', Icon: Briefcase },
  { to: '/superadmin/system-config', label: 'System Domain', Icon: Globe },
  { to: '/superadmin/maintenance', label: 'Maintenance', Icon: Wrench },
  { to: '/superadmin/profile', label: 'Settings', Icon: Settings },
]

export default function SuperAdminLayout({ children }){
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [displayUser, setDisplayUser] = useState(user)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const brandName = 'SevenForks'

  useEffect(() => { setIsMobileOpen(false) }, [pathname])

  useEffect(() => {
    try {
      if (typeof document === 'undefined') return
      if (isMobileOpen) document.body.style.overflow = 'hidden'
      else document.body.style.overflow = ''
      return () => { try { document.body.style.overflow = '' } catch {} }
    } catch {
    }
  }, [isMobileOpen])

  useEffect(() => { setDisplayUser(user) }, [user])

  useEffect(() => {
    const u = displayUser || user || {}
    const a = u.avatar_url || u.profile_picture_url || ''
    if (a) setAvatarUrl(a)
  }, [displayUser, user])

  const userInitial = useMemo(() => {
    const u = displayUser || user || {}
    const v = (u?.first_name || u?.username || u?.email || 'U')
    return String(v)[0]?.toUpperCase() || 'U'
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

  const Item = ({ to, label, Icon, disabled = false, forceLabel = false }) => {
    const normalizePath = (p) => String(p || '').replace(/\/+$/, '') || '/'
    const currentPath = normalizePath(pathname)
    const targetPath = normalizePath(to)
    const active = targetPath === '/superadmin'
      ? currentPath === targetPath
      : currentPath === targetPath || currentPath.startsWith(targetPath + '/')
    const showLabel = isOpen || forceLabel
    const base =
      `group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.99] ` +
      (disabled
        ? 'opacity-55 cursor-not-allowed text-white/70'
        : active
          ? 'bg-gradient-to-r from-[#6d5dfc] to-[#4d32d9] text-white shadow-md shadow-indigo-500/20'
          : 'text-white/80 hover:bg-white/10 hover:text-white')

    const inner = (
      <>
        <span aria-hidden className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-white transition-opacity ${active ? 'opacity-90' : 'opacity-0'}`} />
        <span className={`grid place-items-center h-9 w-9 rounded-xl transition-all ${active ? 'bg-white/15 ring-1 ring-white/20' : 'bg-white/10 group-hover:bg-white/15 ring-1 ring-white/10'}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className={`${showLabel ? 'block' : 'hidden'} whitespace-nowrap`}>{label}</span>
      </>
    )

    if (disabled || !to) {
      return (
        <button type="button" disabled className={base} title={!showLabel ? label : undefined}>
          {inner}
        </button>
      )
    }

    return (
      <Link to={to} title={!showLabel ? label : undefined} className={base}>
        {inner}
      </Link>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#f5f6ff]">
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-slate-200 pt-[env(safe-area-inset-top)]">
        <button onClick={() => setIsMobileOpen(v => !v)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Menu</button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600" />
          <div className="font-extrabold tracking-tight text-slate-900 truncate">{brandName}</div>
        </div>
        <button onClick={() => navigate('/superadmin/sessions')} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Logout</button>
      </div>

      <div className="flex w-full min-w-0">
        <aside
          className={`h-[100dvh] sticky top-0 hidden md:flex flex-col ${isOpen ? 'w-[280px]' : 'w-24'} transition-all duration-200 text-white bg-gradient-to-b from-[#0b1027] via-[#0f1637] to-[#4b1bd9]`}
        >
          <div className="px-4 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity`}>
                <div className="h-8 w-8 rounded-full bg-white/10 ring-1 ring-white/15 grid place-items-center">
                  <span className="font-black tracking-tight">SF</span>
                </div>
                <div className="font-extrabold tracking-tight">{brandName}</div>
              </div>
              <button
                onClick={() => setIsOpen(v => !v)}
                className="h-8 w-8 rounded-lg hover:bg-white/10 text-white/90 grid place-items-center"
                aria-label="Toggle sidebar"
              >
                {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/10 ring-1 ring-white/15 grid place-items-center">
                <span className="h-2 w-2 rounded-full bg-white/90" />
              </div>
              <div className={`text-xs font-semibold text-white/80 ${isOpen ? 'block' : 'hidden'}`}>Super Admin</div>
            </div>
          </div>

          <nav className="px-3 pb-3 space-y-1">
            {navItems.map(i => (
              <Item key={i.to || i.label} {...i} />
            ))}
          </nav>

          <div className="mt-auto px-4 pb-4">
            <div className={`rounded-2xl bg-white/10 ring-1 ring-white/15 p-3 ${isOpen ? 'block' : 'hidden'}`}>
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-white/15 ring-1 ring-white/15 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-white text-sm font-extrabold">{userInitial}</span>
                  )}
                  <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#0f1637]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-white truncate">Super Admin</div>
                  <div className="text-[11px] text-white/70 truncate">{displayUser?.email || displayUser?.username || ''}</div>
                </div>
              </div>
              <button onClick={logout} className="mt-3 w-full px-3 py-2 rounded-xl text-sm font-extrabold bg-white text-slate-900 hover:bg-white/90 inline-flex items-center justify-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {isMobileOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[85vw] max-w-[20rem] text-white bg-gradient-to-b from-[#0b1027] via-[#0f1637] to-[#4b1bd9] border-r border-black/20 p-3 pt-[env(safe-area-inset-top)]">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-white/10 ring-1 ring-white/15 grid place-items-center font-black">SF</div>
                  <div className="font-extrabold tracking-tight text-white">{brandName}</div>
                </div>
                <button onClick={() => setIsMobileOpen(false)} className="p-2 rounded-xl hover:bg-white/10 text-white">✖</button>
              </div>
              <div className="space-y-1">
                {navItems.map(i => (
                  <Item key={i.to || i.label} {...i} forceLabel />
                ))}
              </div>
              <button onClick={logout} className="mt-4 w-full px-3 py-2 rounded-xl text-sm font-extrabold bg-white text-slate-900 hover:bg-white/90 inline-flex items-center justify-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 w-full min-w-0 p-4 sm:p-5 md:p-6">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
