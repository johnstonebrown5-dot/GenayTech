import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLock } from './LockProvider'
import api from '../api'
import { canRunAuthenticatedPoll, handlePollAuthError } from '../utils/authPoll'

const baseNavItems = [
  { to: '/student', label: 'Dashboard', icon: '📊' },
  { to: '/student/academics', label: 'Academics', icon: '🎓' },
  { to: '/student/finance', label: 'Finance', icon: '💳' },
]

const mobileNavItems = [
  {
    to: '/student',
    label: 'Home',
    match: (p) => p === '/student',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
      </svg>
    ),
  },
  {
    to: '/student/academics',
    label: 'Academics',
    match: (p) => p.startsWith('/student/academics'),
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    to: '/student/finance',
    label: 'Finance',
    match: (p) => p.startsWith('/student/finance') && !p.includes('/pay') && !p.includes('/verify') && !p.includes('/confirm'),
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
      </svg>
    ),
  },
  {
    to: '/student/messages',
    label: 'Messages',
    match: (p) => p.startsWith('/student/messages'),
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    badgeKey: 'messages',
  },
  {
    to: '/student/more',
    label: 'More',
    match: (p) => p.startsWith('/student/more') || p.startsWith('/student/profile') || p.startsWith('/student/notifications') || p.startsWith('/student/report-card'),
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
]

export default function StudentLayout({ children }){
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { lock } = useLock()
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [messagesUnread, setMessagesUnread] = useState(0)
  const [broadcastUnread, setBroadcastUnread] = useState(0)
  const [broadcastBanner, setBroadcastBanner] = useState(null)
  const [bannerExpanded, setBannerExpanded] = useState(false)
  const [showFabMenu, setShowFabMenu] = useState(false)
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

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = schoolName ? schoolName : 'Genay Technologies'
    }
  }, [schoolName])

  useEffect(() => {
    if (!canRunAuthenticatedPoll(user, false)) return
    let mounted = true
    let intervalId = null
    const stop = () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
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
      if (!mounted || !canRunAuthenticatedPoll(user, false)) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const [inb, sys] = await Promise.allSettled([
          api.get('/communications/messages/', { _skipGlobalLoading: true }),
          api.get('/communications/messages/system/', { _skipGlobalLoading: true }),
        ])
        if (inb.status === 'rejected' && handlePollAuthError(inb.reason, stop)) return
        if (sys.status === 'rejected' && handlePollAuthError(sys.reason, stop)) return
        const inboxList = inb.status === 'fulfilled' ? (Array.isArray(inb.value.data) ? inb.value.data : (inb.value.data?.results || [])) : []
        const sysList = sys.status === 'fulfilled' ? (Array.isArray(sys.value.data) ? sys.value.data : (sys.value.data?.results || [])) : []
        const inboxUnread = computeUnread(inboxList)
        const sysUnread = computeUnread(sysList)
        const total = inboxUnread + sysUnread
        if (mounted) {
          setUnreadCount(total)
          setMessagesUnread(inboxUnread)
          const bOnly = Array.isArray(sysList) ? sysList.filter(m => m.is_broadcast) : []
          const bCount = computeUnread(bOnly)
          setBroadcastUnread(bCount)
          const latest = Array.isArray(bOnly) && bOnly.length > 0 ? bOnly[0] : null
          const latestBody = String(latest?.body || '').trim()
          const candidate = latest && latestBody && !dismissedIds.includes(latest.id) ? latest : null
          setBroadcastBanner(candidate)
        }
      } catch (err) {
        if (handlePollAuthError(err, stop)) return
        if (mounted) { setUnreadCount(0); setMessagesUnread(0); setBroadcastUnread(0); setBroadcastBanner(null) }
      }
    }
    const onSessionExpired = () => stop()
    try { window.addEventListener('auth:session-expired', onSessionExpired) } catch {}
    load()
    intervalId = setInterval(load, 20000)
    return () => {
      stop()
      try { window.removeEventListener('auth:session-expired', onSessionExpired) } catch {}
    }
  }, [user, dismissedIds])

  const displayName = (() => {
    const first = String(user?.first_name || '').trim()
    const last = String(user?.last_name || '').trim()
    const full = `${first} ${last}`.trim()
    return full || first || String(user?.username || '').trim() || ''
  })()

  const fabActions = [
    { label: 'Pay Fees', to: '/student/finance/pay', icon: '💳' },
    { label: 'Verify Payment', to: '/student/finance/verify', icon: '✅' },
    { label: 'New Message', to: '/student/messages', icon: '💬' },
    { label: 'Notifications', to: '/student/notifications', icon: '🔔' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {broadcastBanner && (
        <div className="sticky top-0 z-40 w-full bg-red-600 text-white">
          <div className="px-3 md:px-6 py-2 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.48 14.7A1 1 0 002.62 20h18.76a1 1 0 00.86-1.5l-8.48-14.64a1 1 0 00-1.73 0z" /></svg>
            <a href="/student/notifications" className="flex-1 min-w-0">
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

      {/* Desktop header only */}
      <header className="hidden sm:block sticky top-0 z-40 bg-blue-700 text-white border-b border-blue-800 shadow-md">
        <div className="px-3 md:px-6 h-14 md:h-16 flex items-center gap-2 relative">
          <Link to="/student" className="flex items-center gap-2 shrink-0 text-white">
            {schoolLogo ? (
              <img src={schoolLogo} alt="School Logo" className="w-7 h-7 rounded object-contain bg-white/10" />
            ) : null}
            <div className="flex flex-col">
              <div className="hidden sm:block text-sm font-semibold leading-tight">{schoolName || 'Genay Technologies'}</div>
              <div className="text-xs sm:text-[13px] font-medium text-blue-100 whitespace-normal break-words leading-tight max-w-[55vw] sm:max-w-[220px]">
                {displayName}
              </div>
            </div>
          </Link>
          <div className="hidden md:flex flex-1 justify-center" />
          <div className="flex-1" />
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="hidden md:flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-2.5 rounded-xl border border-blue-600 text-blue-100 hover:text-white hover:border-blue-500 hover:bg-white/10 transition" aria-label="Go back" title="Back">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.53 4.47a.75.75 0 010 1.06L5.56 9.5h13.69a.75.75 0 010 1.5H5.56l3.97 3.97a.75.75 0 11-1.06 1.06l-5.25-5.25a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button onClick={() => navigate(1)} className="p-2.5 rounded-xl border border-blue-600 text-blue-100 hover:text-white hover:border-blue-500 hover:bg-white/10 transition" aria-label="Go forward" title="Forward">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M14.47 4.47a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L18.44 11H4.75a.75.75 0 010-1.5h13.69l-3.97-3.97a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <Link to="/student/notifications" className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl border border-blue-600 hover:bg-white/10 transition" aria-label="Notifications" title="Notifications">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-100">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9a6 6 0 10-12 0v.75a8.967 8.967 0 01-2.311 6.022c1.733.64 3.56 1.085 5.455 1.31m5.713 0a24.255 24.255 0 01-5.713 0m5.713 0a3 3 0 11-5.713 0" />
              </svg>
              {broadcastUnread > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white border border-blue-700">
                  {broadcastUnread > 99 ? '99+' : broadcastUnread}
                </span>
              )}
            </Link>
            {user && (
              <div className="hidden md:block text-sm text-blue-50 max-w-[160px] truncate" title={displayName}>
                {displayName}
              </div>
            )}
            <button onClick={lock} className="hidden md:inline-flex items-center px-3 py-2 rounded-xl border border-blue-600 text-sm text-blue-50 hover:bg-white/10">Lock</button>
            <button onClick={() => navigate('/sessions')} className="hidden md:inline-flex items-center px-3 py-2 rounded-xl border border-white text-sm bg-white text-blue-700 hover:bg-blue-50">Logout</button>
          </div>
        </div>
      </header>

      <main className="pt-0 pb-24 sm:pb-16 md:pt-0 md:pb-0 flex-1 flex">
        <div className="w-full flex">
          <div className="w-full bg-white md:bg-white/90 md:backdrop-blur-xl shadow-none md:shadow-[0_30px_80px_rgba(15,23,42,0.18)] border border-blue-100/80 overflow-hidden flex flex-col md:flex-row md:items-stretch h-full md:min-h-[calc(100vh-4rem)]">
            <aside className="hidden md:flex w-60 lg:w-64 bg-gradient-to-b from-blue-700 via-blue-700 to-indigo-800 text-blue-50 flex-col py-6 px-4 relative md:sticky md:top-0 md:self-start h-full">
              <div className="mb-6 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">🎓</div>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-[0.2em] text-blue-200/90">Student</span>
                    <span className="text-sm font-semibold leading-tight">Portal</span>
                  </div>
                </div>
              </div>
              <nav className="space-y-1 flex-1 overflow-y-auto">
                {baseNavItems.map(item => {
                  const active = pathname === item.to
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`${active ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-white/10 text-blue-100'} flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200`}
                    >
                      <span className="text-lg" aria-hidden>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
              <div className="mt-6 pt-4 border-t border-blue-500/40 text-[11px] text-blue-100 flex items-center justify-between px-2">
                <span>© {new Date().getFullYear()} Genay Technologies</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="opacity-80">Online</span>
                </span>
              </div>
            </aside>

            <div className="flex-1 bg-slate-50/60 md:bg-transparent overflow-x-hidden">
              <div className="p-0">{children}</div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white shadow-lg">
        <div className="max-w-xl mx-auto flex items-stretch justify-around pt-2 pb-2 px-1">
          {mobileNavItems.map(item => {
            const active = item.match(pathname)
            const badge = item.badgeKey === 'messages' ? messagesUnread : 0
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] py-1 ${active ? 'text-blue-600 font-bold' : 'text-slate-500'}`}
              >
                <span className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`}>
                  {item.icon(active)}
                </span>
                <span className="leading-tight">{item.label}</span>
                {badge > 0 && (
                  <span className="absolute top-0 right-1/4 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile FAB */}
      <div className="sm:hidden fixed bottom-14 left-1/2 -translate-x-1/2 z-40">
        <button
          type="button"
          onClick={() => setShowFabMenu(v => !v)}
          className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-300/50 flex items-center justify-center border-4 border-white hover:bg-blue-700 transition-colors"
          aria-label="Quick actions"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`w-7 h-7 transition-transform ${showFabMenu ? 'rotate-45' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {showFabMenu && (
        <div className="sm:hidden fixed inset-0 z-50" onClick={() => setShowFabMenu(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-28 left-4 right-4 bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-900 text-sm">Quick Actions</div>
            {fabActions.map(action => (
              <button
                key={action.to}
                type="button"
                onClick={() => { setShowFabMenu(false); navigate(action.to) }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 text-left"
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm font-semibold text-slate-800">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
