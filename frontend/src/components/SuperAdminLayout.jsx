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
  ClipboardList,
  CalendarCheck,
  Globe,
  Megaphone,
  Settings,
  LogOut,
} from 'lucide-react'

const navGroups = [
  {
    title: '',
    items: [
      { to: '/superadmin', label: 'Dashboard', Icon: LayoutDashboard },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/superadmin/schools', label: 'Schools', Icon: School },
      { to: '/superadmin/students', label: 'Students', Icon: Users },
      { to: '/superadmin/teachers', label: 'Teachers', Icon: GraduationCap },
      { to: '/superadmin/classes', label: 'Classes', Icon: ClipboardList },
      { to: '/superadmin/examinations', label: 'Examinations', Icon: FileText },
      { to: '/superadmin/attendance', label: 'Attendance', Icon: CalendarCheck },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { to: '/superadmin/analysis', label: 'System Analysis', Icon: BarChart3 },
      { to: '/superadmin/reports', label: 'Reports', Icon: FileText },
    ],
  },
  {
    title: 'Communication',
    items: [
      { to: '/superadmin/communication', label: 'Communication', Icon: MessagesSquare },
      { to: '/superadmin/announcements', label: 'Announcements', Icon: Megaphone },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/superadmin/payment-methods', label: 'Payment Methods', Icon: CreditCard },
      { to: '/superadmin/logs', label: 'Logs', Icon: ScrollText },
      { to: '/superadmin/system-config', label: 'System Domain', Icon: Globe },
      { to: '/superadmin/profile', label: 'Settings', Icon: Settings },
    ],
  },
]

export default function SuperAdminLayout({ children }){
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [displayUser, setDisplayUser] = useState(user)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const brandName = 'GENAY'

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

  const Item = ({ to, label, Icon, disabled = false }) => {
    const normalizePath = (p) => String(p || '').replace(/\/+$/, '') || '/'
    const currentPath = normalizePath(pathname)
    const targetPath = normalizePath(to)
    const active = targetPath === '/superadmin'
      ? currentPath === targetPath
      : currentPath === targetPath || currentPath.startsWith(targetPath + '/')
    const base =
      `group relative flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-bold transition-all active:scale-[0.99] ` +
      (disabled
        ? 'opacity-55 cursor-not-allowed text-white/70'
        : active
          ? 'bg-gradient-to-r from-[#7c3cff] to-[#4b2cff] text-white shadow-[0_0_24px_rgba(124,60,255,0.55)]'
          : 'text-white/86 hover:bg-white/10 hover:text-white')

    const inner = (
      <>
        <span className={`grid place-items-center h-7 w-7 rounded-lg transition-all ${active ? 'bg-white/10 text-white' : 'bg-white/8 text-white/80 group-hover:bg-white/12'}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </>
    )

    if (disabled || !to) {
      return (
        <button type="button" disabled className={base}>
          {inner}
        </button>
      )
    }

    return (
      <Link to={to} className={base}>
        {inner}
      </Link>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#f7f8ff]">
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-slate-200 pt-[env(safe-area-inset-top)]">
        <button onClick={() => setIsMobileOpen(v => !v)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Menu</button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-700" />
          <div className="font-extrabold tracking-tight text-slate-900 truncate">{brandName}</div>
        </div>
        <button onClick={() => navigate('/superadmin/sessions')} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Logout</button>
      </div>

      <div className="flex w-full min-w-0">
        <aside
          className="h-[100dvh] sticky top-0 hidden md:flex w-[292px] shrink-0 flex-col text-white bg-[radial-gradient(circle_at_20%_20%,rgba(81,61,255,0.28),transparent_28%),linear-gradient(180deg,#050b1f_0%,#071036_56%,#12086f_100%)]"
        >
          <div className="px-5 pt-8 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-blue-500 to-indigo-700 text-[30px] font-black shadow-[0_12px_30px_rgba(37,99,235,0.35)]">
                G
              </div>
              <div>
                <div className="text-[20px] font-black leading-5 tracking-wide">{brandName}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/80">Technologies</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 pb-4">
            {navGroups.map((group) => (
              <div key={group.title || 'main'} className={group.title ? 'mt-5' : ''}>
                {group.title && <div className="mb-2 px-3 text-[12px] font-black uppercase tracking-[0.08em] text-white/42">{group.title}</div>}
                <div className="space-y-1.5">
                  {group.items.map(i => <Item key={i.to || i.label} {...i} />)}
                </div>
              </div>
            ))}
          </nav>

          <div className="px-5 pb-6">
            <div className="overflow-hidden rounded-2xl bg-white/9 ring-1 ring-white/10">
              <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-white ring-1 ring-white/15 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-indigo-700 text-sm font-extrabold">{userInitial}</span>
                  )}
                  <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-[#15126a]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-black text-white truncate">Super Admin</div>
                  <div className="text-[12px] text-white/68 truncate">{displayUser?.email || displayUser?.username || 'superadmin@genay.com'}</div>
                </div>
              </div>
              </div>
              <button onClick={logout} className="w-full border-t border-white/8 bg-white/5 px-3 py-3 text-[14px] font-bold text-white hover:bg-white/10 inline-flex items-center justify-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {isMobileOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[85vw] max-w-[20rem] text-white bg-gradient-to-b from-[#050b1f] via-[#071036] to-[#12086f] border-r border-black/20 p-3 pt-[env(safe-area-inset-top)] overflow-y-auto">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-700 grid place-items-center font-black">G</div>
                  <div className="font-extrabold tracking-tight text-white">{brandName}</div>
                </div>
                <button onClick={() => setIsMobileOpen(false)} className="p-2 rounded-xl hover:bg-white/10 text-white">✖</button>
              </div>
              {navGroups.map((group) => (
                <div key={group.title || 'main'} className={group.title ? 'mt-5' : ''}>
                  {group.title && <div className="mb-2 px-3 text-[12px] font-black uppercase tracking-[0.08em] text-white/42">{group.title}</div>}
                  <div className="space-y-1">{group.items.map(i => <Item key={i.to || i.label} {...i} />)}</div>
                </div>
              ))}
              <button onClick={logout} className="mt-4 w-full px-3 py-2 rounded-xl text-sm font-extrabold bg-white text-slate-900 hover:bg-white/90 inline-flex items-center justify-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 w-full min-w-0 p-4 sm:p-5 md:p-7">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
