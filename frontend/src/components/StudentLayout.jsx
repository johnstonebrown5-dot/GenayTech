import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLock } from './LockProvider'
import api from '../api'

const baseNavItems = [
  { to: '/student', label: 'Dashboard', icon: '📊' },
  { to: '/student/academics', label: 'Academics', icon: '🎓' },
  { to: '/student/finance', label: 'Finance', icon: '💳' },
  { to: '/student/messages', label: 'Messages', icon: '✉️' },
]

export default function StudentLayout({ children }){
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { lock } = useLock()
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [broadcastUnread, setBroadcastUnread] = useState(0)
  const [broadcastBanner, setBroadcastBanner] = useState(null)
  const [bannerExpanded, setBannerExpanded] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_broadcast_ids') || '[]') } catch { return [] }
  })

  const dismissBanner = (id) => {
    if (!id) return
    const next = Array.from(new Set([...(Array.isArray(dismissedIds)? dismissedIds:[]), id]))
    setDismissedIds(next)
    try { localStorage.setItem('dismissed_broadcast_ids', JSON.stringify(next)) } catch {}
    if (broadcastBanner?.id === id) setBroadcastBanner(null)
  }

  // close menu when route changes
  useEffect(() => { setIsMenuOpen(false) }, [pathname])

  // Load school info for header
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/school/info/')
        if (mounted) {
          setSchoolName(data?.name || '')
          setSchoolLogo(data?.logo_url || data?.logo || '')
        }
      } catch (e) {
        if (mounted) { setSchoolName(''); setSchoolLogo('') }
      }
    })()
    return () => { mounted = false }
  }, [])

  // Keep browser tab title in sync with active school
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = schoolName ? schoolName : 'EDU-TRACK'
    }
  }, [schoolName])

  // Poll unread messages (inbox + system)
  useEffect(() => {
    let mounted = true
    const computeUnread = (arr) => {
      const myId = user?.id
      if (!Array.isArray(arr) || !myId) return 0
      return arr.reduce((acc, m) => {
        const rec = Array.isArray(m.recipients) ? m.recipients : []
        const mine = rec.find(r => r.user === myId)
        return acc + (mine && !mine.read ? 1 : 0)
      }, 0)
    }
    const load = async () => {
      try {
        const [inb, sys] = await Promise.allSettled([
          api.get('/communications/messages/'),
          api.get('/communications/messages/system/'),
        ])
        const inboxList = inb.status === 'fulfilled' ? (Array.isArray(inb.value.data) ? inb.value.data : (inb.value.data?.results || [])) : []
        const sysList = sys.status === 'fulfilled' ? (Array.isArray(sys.value.data) ? sys.value.data : (sys.value.data?.results || [])) : []
        const total = computeUnread(inboxList) + computeUnread(sysList)
        if (mounted) {
          setUnreadCount(total)
          const bOnly = Array.isArray(sysList) ? sysList.filter(m => m.is_broadcast) : []
          const bCount = computeUnread(bOnly)
          setBroadcastUnread(bCount)
          const latest = Array.isArray(bOnly) && bOnly.length > 0 ? bOnly[0] : null
          const candidate = latest && !dismissedIds.includes(latest.id) ? latest : null
          setBroadcastBanner(candidate)
        }
      } catch {
        if (mounted) { setUnreadCount(0); setBroadcastUnread(0); setBroadcastBanner(null) }
      }
    }
    load()
    const id = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [user, dismissedIds])

  return (
    <div className="min-h-screen bg-gray-50">
      {broadcastBanner && (
        <div className="sticky top-0 z-40 w-full bg-red-600 text-white">
          <div className="px-3 md:px-6 py-2 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.48 14.7A1 1 0 002.62 20h18.76a1 1 0 00.86-1.5l-8.48-14.64a1 1 0 00-1.73 0z" /></svg>
            <a href="/student/messages?tab=system" className="flex-1 min-w-0">
              <div className="text-sm font-semibold tracking-wide uppercase opacity-90">{broadcastBanner.system_tag || 'Alert'}</div>
              <div className="text-sm leading-snug" style={{ maxHeight: bannerExpanded ? 'none' : 40, overflow: bannerExpanded ? 'visible' : 'hidden' }}>{String(broadcastBanner.body||'')}</div>
            </a>
            <button onClick={()=>setBannerExpanded(v=>!v)} className="sm:hidden text-xs underline decoration-white/70 underline-offset-2 px-2 py-1">
              {bannerExpanded ? 'Show less' : 'Read more'}
            </button>
            <button
              onClick={() => dismissBanner(broadcastBanner?.id)}
              aria-label="Hide alert"
              title="Hide this alert"
              className="ml-1 inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-slate-200 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.15)]">
        <div className="px-3 md:px-6 h-14 md:h-16 flex items-center gap-2 relative">
          {/* Brand */}
          <Link to="/student" className="flex items-center gap-2 shrink-0">
            {schoolLogo ? (
              <img src={schoolLogo} alt="School Logo" className="w-7 h-7 rounded object-contain" />
            ) : null}
            <div className="flex flex-col">
              <div className="hidden sm:block text-sm font-semibold leading-tight">{schoolName || 'EDU-TRACK'}</div>
              <div className="text-xs sm:text-[13px] font-medium text-slate-800 truncate max-w-[120px]">
                {user?.first_name || user?.username || ''}
              </div>
            </div>
          </Link>

          {/* Inline nav (desktop, centered) */}
          <nav className="hidden md:flex items-center gap-2 md:absolute md:left-1/2 md:-translate-x-1/2">
            {baseNavItems.map(i => {
              const active = pathname === i.to
              const isMessages = i.label === 'Messages'
              return (
                <Link
                  key={i.to}
                  to={i.to}
                  className={`${active ? 'bg-slate-900 text-white shadow-sm' : 'bg-white/80 text-slate-800 hover:bg-white border-slate-200'} px-3.5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 border`}
                  title={i.label}
                >
                  <span className="hidden lg:inline" aria-hidden>{i.icon}</span>
                  <span>{i.label}</span>
                  {isMessages && unreadCount>0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11px] bg-red-600 text-white">{unreadCount>99 ? '99+' : unreadCount}</span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Hamburger (mobile only) */}
          <button
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border bg-white hover:bg-gray-50"
            aria-label="Open navigation menu"
            onClick={()=> setIsMenuOpen(v=>!v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          {/* User + Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Back/Forward (md+) */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:text-slate-900 hover:border-slate-300 hover:bg-gray-50 transition"
                aria-label="Go back"
                title="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.53 4.47a.75.75 0 010 1.06L5.56 9.5h13.69a.75.75 0 010 1.5H5.56l3.97 3.97a.75.75 0 11-1.06 1.06l-5.25-5.25a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => navigate(1)}
                className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:text-slate-900 hover:border-slate-300 hover:bg-gray-50 transition"
                aria-label="Go forward"
                title="Forward"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M14.47 4.47a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L18.44 11H4.75a.75.75 0 010-1.5h13.69l-3.97-3.97a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <Link
              to="/student/messages?tab=system"
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
              aria-label="Notifications"
              title="System messages"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-slate-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9a6 6 0 10-12 0v.75a8.967 8.967 0 01-2.311 6.022c1.733.64 3.56 1.085 5.455 1.31m5.713 0a24.255 24.255 0 01-5.713 0m5.713 0a3 3 0 11-5.713 0" />
              </svg>
              {broadcastUnread > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                  {broadcastUnread > 99 ? '99+' : broadcastUnread}
                </span>
              )}
            </Link>
            {user && (
              <div className="hidden md:block text-sm text-slate-700 max-w-[160px] truncate" title={user.first_name || user.username}>
                {user.first_name || user.username}
              </div>
            )}
            <button onClick={lock} className="hidden md:inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">Lock</button>
            <button onClick={logout} className="hidden md:inline-flex items-center px-3 py-2 rounded-xl border border-slate-800 text-sm bg-slate-800 text-white hover:bg-slate-700">Logout</button>
          </div>
        </div>
      </header>

      {/* Overlay for menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/30" onClick={()=> setIsMenuOpen(false)} />
      )}

      {/* Dropdown Menu Panel */}
      <div className={`fixed z-40 top-14 left-0 right-0 px-3 md:px-6 transition-transform duration-200 ${isMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'}`}>
        <div className="bg-white rounded-xl border shadow-card overflow-hidden">
          <nav className="py-1">
            {baseNavItems.map(i => {
              const active = pathname === i.to
              const isMessages = i.label === 'Messages'
              return (
                <Link
                  key={i.to}
                  to={i.to}
                  onClick={()=> setIsMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className="text-lg" aria-hidden>{i.icon}</span>
                  <span className="text-sm font-medium">{i.label}</span>
                  {isMessages && unreadCount>0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11px] bg-red-600 text-white">{unreadCount>99 ? '99+' : unreadCount}</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="px-3 md:px-6 py-4 pb-16 md:py-6 md:pb-6">
        {children}
      </main>

      {/* Bottom Nav (mobile, M-Pesa style) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="max-w-xl mx-auto flex items-stretch justify-around py-1.5">
          {baseNavItems.map(item => {
            const active = pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center flex-1 gap-0.5 text-[11px] ${active ? 'text-emerald-600' : 'text-slate-500'}`}
              >
                <span className={`text-lg ${active ? 'scale-110' : ''}`} aria-hidden>{item.icon}</span>
                <span className="leading-tight">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
