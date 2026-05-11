import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLock } from './LockProvider'
import api from '../api'
import FloatingDeliveryLog from './FloatingDeliveryLog'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: '📊' },
  { to: '/admin/students', label: 'Students', icon: '🎓' },
  { to: '/admin/teachers', label: 'Teachers', icon: '👩‍🏫' },
  { to: '/admin/staff', label: 'Support Staff', icon: '🧑‍🔧' },
  { to: '/admin/classes', label: 'Classes', icon: '🏫' },
  { to: '/admin/subjects', label: 'Subjects', icon: '📚' },
  { to: '/admin/fees', label: 'Fees', icon: '💳' },
  { to: '/admin/exams', label: 'Exams', icon: '📝' },
  { to: '/admin/reports', label: 'Reports', icon: '📈' },
  { to: '/admin/events', label: 'Events', icon: '📅' },
  { to: '/admin/timetable', label: 'Timetable', icon: '📆' },
  { to: '/admin/messages', label: 'Messages', icon: '✉️' },
  { to: '/admin/communication-logs', label: 'Comm Logs', icon: '📱' },
  { to: '/admin/website', label: 'Website', icon: '🌐' },
]

export default function AdminLayout({ children }){
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { lock } = useLock()
  const [isOpen, setIsOpen] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
  const [currentTerm, setCurrentTerm] = useState(null)
  const [currentYear, setCurrentYear] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selfActive, setSelfActive] = useState(undefined)
  const [broadcastUnread, setBroadcastUnread] = useState(0)
  const [broadcastBanner, setBroadcastBanner] = useState(null)
  const [bannerExpanded, setBannerExpanded] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
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

  // Close mobile drawer on route change
  useEffect(() => { setIsMobileOpen(false) }, [pathname])

  // Load current school for header display (admin/staff users)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/school/me/')
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

  // Background prefetch of heavy admin data (students, teachers, classes, subjects, fees)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await Promise.allSettled([
          // Students list (first page / capped size)
          api.get('/academics/students/?page_size=500', { _skipGlobalLoading: true }),
          // Teachers + supporting data
          api.get('/academics/teachers/', { _skipGlobalLoading: true }),
          api.get('/auth/users/?role=teacher', { _skipGlobalLoading: true }),
          // Classes & subjects (used across multiple admin pages)
          api.get('/academics/classes/?page_size=2000', { _skipGlobalLoading: true }),
          api.get('/academics/subjects/', { _skipGlobalLoading: true }),
          // Core finance/fees endpoints
          api.get('/finance/fee-categories/', { _skipGlobalLoading: true }),
          api.get('/finance/class-fees/', { _skipGlobalLoading: true }),
          api.get('/finance/student-fees/', { _skipGlobalLoading: true }),
        ])
      } catch {
        // Silent: this is best-effort warming only
      } finally {
        if (cancelled) return
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Keep browser tab title in sync with active school
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = schoolName ? schoolName : 'Genay Technologies'
    }
  }, [schoolName])

  // Ensure we have an up-to-date active status for the current user (and avatar)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/me/')
        if (mounted) {
          setSelfActive(typeof data?.is_active === 'boolean' ? data.is_active : undefined)
          const avatar = data?.avatar_url || data?.profile_picture_url || ''
          setAvatarUrl(avatar || '')
        }
      } catch {
        if (mounted) setSelfActive(undefined)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Reflect AuthContext changes immediately (e.g., after login)
  useEffect(() => {
    const u = user || {}
    const a = u.avatar_url || u.profile_picture_url || ''
    if (a) setAvatarUrl(a)
  }, [user])

  // React to profile updates fired by profile pages
  useEffect(() => {
    const onUpdated = (e) => {
      const url = e?.detail?.avatar_url
      if (url) {
        setAvatarUrl(url)
      } else {
        api.get('/auth/me/').then(res => {
          const a = res.data?.avatar_url || res.data?.profile_picture_url || ''
          setAvatarUrl(a || '')
        }).catch(()=>{})
      }
    }
    try { window.addEventListener('profile:updated', onUpdated) } catch {}
    return () => { try { window.removeEventListener('profile:updated', onUpdated) } catch {} }
  }, [])

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
          const latestBody = String(latest?.body || '').trim()
          const candidate = latest && latestBody && !dismissedIds.includes(latest.id) ? latest : null
          setBroadcastBanner(candidate)
        }
      } catch {
        if (mounted) { setUnreadCount(0); setBroadcastUnread(0); setBroadcastBanner(null) }
      }
    }
    // initial
    load()
    const id = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [user, dismissedIds])

  // Load current term and year for header display
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [termRes, yearRes] = await Promise.allSettled([
          api.get('/academics/terms/current/'),
          api.get('/academics/academic_years/current/')
        ])
        if (mounted) {
          if (termRes.status === 'fulfilled') setCurrentTerm(termRes.value.data)
          else setCurrentTerm(null)
          if (yearRes.status === 'fulfilled') setCurrentYear(yearRes.value.data)
          else setCurrentYear(null)
        }
      } catch (e) {
        if (mounted) { setCurrentTerm(null); setCurrentYear(null) }
      }
    })()
    return () => { mounted = false }
  }, [])

  const sidebarBase = isOpen ? 'w-64' : 'w-16'

  return (
    <div className="min-h-screen bg-gray-50">
      {broadcastBanner && (
        <div className="sticky top-0 z-40 w-full bg-red-600 text-white">
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-2 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.48 14.7A1 1 0 002.62 20h18.76a1 1 0 00.86-1.5l-8.48-14.64a1 1 0 00-1.73 0z" />
            </svg>
            <a href="/admin/messages?tab=system" className="flex-1 min-w-0">
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
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/65 border-b border-gray-200 px-3 sm:px-4 md:px-6 h-16 pt-[env(safe-area-inset-top)] shadow-[0_6px_20px_-8px_rgba(0,0,0,0.2)]">
        <div className="max-w-screen-2xl mx-auto h-full flex items-center gap-2">
          {/* Left: brand / sidebar toggle (desktop only) */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 hidden md:inline-flex border border-transparent hover:border-gray-200"
              aria-label="Collapse sidebar"
              onClick={()=>setIsOpen(v=>!v)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700">
                <path fillRule="evenodd" d="M19.5 3.75a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75h15zm-9.53 3.22a.75.75 0 10-1.06 1.06l2.72 2.72-2.72 2.72a.75.75 0 101.06 1.06l3.25-3.25a.75.75 0 000-1.06l-3.25-3.25z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="hidden sm:flex items-center gap-2 min-w-0"></div>
          </div>

          {/* Center: school chip (scrollable on small) */}
          <div className="flex-1 flex items-center justify-center overflow-x-auto sm:overflow-visible px-1 sm:px-3">
            <div className="flex items-center gap-2">
              {schoolLogo ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gray-50/90 to-white/80 border border-gray-200 rounded-full shadow-sm">
                  <img src={schoolLogo} alt="School logo" className="h-5 w-5 object-contain rounded" />
                  <span className="sm:hidden text-gray-800 text-sm font-medium truncate max-w-[10rem]">{schoolName || ''}</span>
                  <span className="hidden sm:inline text-gray-900 text-sm font-semibold tracking-tight">{schoolName || ''}</span>
                </div>
              ) : (
                <>
                  <span className="sm:hidden text-gray-700 truncate max-w-[10rem]">{schoolName || ''}</span>
                  <span className="hidden sm:inline text-gray-900 font-semibold">{schoolName || ''}</span>
                </>
              )}
              {currentTerm && currentYear && (
                <div className="px-2.5 py-1 bg-brand-50/80 text-brand-700 rounded-full text-[11px] sm:text-xs font-medium border border-brand-200 whitespace-nowrap shadow-sm">
                  Term {currentTerm.number} {currentYear.label.split('/')[1] || currentYear.label}
                </div>
              )}
            </div>
          </div>

          {/* Right: user and actions */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Back/Forward on md+ */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:text-brand-700 hover:border-brand-200 hover:bg-brand-50/60 transition-all"
                aria-label="Go back"
                title="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.53 4.47a.75.75 0 010 1.06L5.56 9.5h13.69a.75.75 0 010 1.5H5.56l3.97 3.97a.75.75 0 11-1.06 1.06l-5.25-5.25a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => navigate(1)}
                className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:text-brand-700 hover:border-brand-200 hover:bg-brand-50/60 transition-all"
                aria-label="Go forward"
                title="Forward"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M14.47 4.47a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L18.44 11H4.75a.75.75 0 010-1.5h13.69l-3.97-3.97a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {user && (
              <Link
                to="/admin/profile"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-all shadow-sm"
                aria-label="Open profile"
                title="Open my profile"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-600 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-medium">{(user.first_name || user.username || 'U')[0].toUpperCase()}</span>
                  )}
                </div>
              </Link>
            )}
            <button
              onClick={lock}
              className="hidden sm:flex px-3 py-2 rounded-lg text-sm font-semibold bg-gray-800 text-white hover:bg-gray-900 transition-all duration-200 shadow-soft items-center gap-2"
              aria-label="Lock now"
              title="Lock now"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3" />
                <rect x="5.25" y="10.5" width="13.5" height="9" rx="2" ry="2" />
              </svg>
              <span>Lock</span>
            </button>
            <button
              onClick={logout}
              className="hidden sm:flex px-3.5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-all duration-200 shadow-soft items-center gap-2"
              aria-label="Logout"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5a7.5 7.5 0 1 0 10.5 0" />
              </svg>
              <span className="inline">Power</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating mobile logout button (hidden on Messages page to avoid overlay) */}
      {!(pathname.startsWith('/admin/messages')) && (() => {
        const root = typeof document !== 'undefined' ? document.getElementById('floating-actions-root') : null
        const isSmall = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches
        if (!isSmall) return null
        const showFab = false
        if (!showFab) return null
        const size = 44
        const iconSize = 18
        const btn = (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Logout"
            title="Logout"
            style={{
              order: 4,
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: '9999px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              boxShadow: '0 8px 22px rgba(220,38,38,0.35)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              pointerEvents: 'auto',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={iconSize+2} height={iconSize+2} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="3" x2="12" y2="11" />
              <path d="M19 12.5a7 7 0 1 1-14 0" />
            </svg>
          </button>
        )
        if (root) return createPortal(btn, root)
        return (
          <div style={{ position:'fixed', right:16, bottom:24, zIndex:2100}}>{btn}</div>
        )
      })()}

      {/* Floating Delivery Log button/panel (admin only; component checks role) */}
      <FloatingDeliveryLog />

      {/* Sidebar + Content */}
      <div className="relative">
        {/* Overlay for mobile */}
        {isMobileOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={()=>setIsMobileOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed z-40 left-0 bottom-0 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 border-r border-blue-500/30 transition-all duration-200 ${sidebarBase} hidden md:flex flex-col shadow-2xl`}
          style={{ top: broadcastBanner ? 'calc(4rem + env(safe-area-inset-top) + 40px)' : 'calc(4rem + env(safe-area-inset-top))' }}
        >
          <nav className="flex-1 min-h-0 p-2 space-y-1 [@media(max-height:720px)]:space-y-0.5 overflow-hidden">
            {navItems.map(i => {
              const active = pathname === i.to
              return (
                <Link key={i.to} to={i.to}
                  className={`${active
                    ? 'bg-white/20 text-white shadow-lg border border-white/30'
                    : 'hover:bg-white/10 text-blue-100 hover:text-white'
                  } flex items-center gap-3 px-3 py-2.5 [@media(max-height:720px)]:px-2.5 [@media(max-height:720px)]:py-2 [@media(max-height:640px)]:py-1.5 rounded-lg transition-all duration-300 group`}
                  title={i.label}
                >
                  <span className="text-lg [@media(max-height:720px)]:text-base w-5 text-center">{i.icon}</span>
                  {isOpen && (
                    <span className="relative inline-flex items-center gap-2 text-sm font-medium truncate transition-all duration-300 group-hover:translate-x-1">
                      {i.label}
                      {i.label === 'Messages' && unreadCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto p-3 text-xs text-blue-200/80 [@media(max-height:720px)]:hidden">
            {isOpen && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>© {new Date().getFullYear()} Genay Technologies</span>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        <aside
          className={`fixed z-40 left-0 bottom-0 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 border-r border-blue-500/30 w-full md:hidden transition-transform duration-200 shadow-2xl ${isMobileOpen? 'translate-x-0':'-translate-x-full'} flex flex-col`}
          style={{ top: 0 }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-blue-500/40 text-blue-50">
            <span className="text-sm font-medium">Navigation</span>
            <button
              type="button"
              onClick={()=>setIsMobileOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-[env(safe-area-inset-bottom)] pt-2">
            {navItems.map(i => {
              const active = pathname === i.to
              return (
                <Link key={i.to} to={i.to}
                  className={`${active
                    ? 'bg-white/20 text-white shadow-lg border border-white/30'
                    : 'hover:bg-white/10 text-blue-100 hover:text-white'
                  } flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300`}
                >
                  <span className="text-lg">{i.icon}</span>
                  <span className="relative inline-flex items-center gap-2 text-sm font-medium">
                    {i.label}
                    {i.label === 'Messages' && unreadCount > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </span>
                </Link>
              )
            })}
          </nav>
          <div className="p-2 mt-2 border-t border-blue-500/30 flex items-center gap-2">
            <button onClick={lock} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors">Lock</button>
            <button onClick={()=>setShowLogoutConfirm(true)} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">Logout</button>
          </div>
          <div className="mt-auto p-3 text-xs text-blue-200/80">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>© {new Date().getFullYear()} Genay Technologies</span>
            </div>
          </div>
        </aside>

        {/* Content area */}
        <main className={`transition-all duration-200 px-4 md:px-6 pt-4 pb-24 md:py-6 ${isOpen? 'md:ml-64':'md:ml-16'}`}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden">
        <div className="max-w-screen-2xl mx-auto pb-[env(safe-area-inset-bottom)]">
          <div className="h-14 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 border-t border-gray-200 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] flex items-stretch justify-between px-1.5">
            {/* Home */}
            <Link
              to="/admin"
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl ${pathname === '/admin' ? 'text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
              title="Home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5M5.25 9.75V20.25a.75.75 0 00.75.75H9.75a.75.75 0 00.75-.75v-4.5a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v4.5a.75.75 0 00.75.75h3.75a.75.75 0 00.75-.75V9.75" />
              </svg>
              <span className="text-[11px] leading-none">Home</span>
            </Link>

            {/* Students */}
            <Link
              to="/admin/students"
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl ${pathname.startsWith('/admin/students') ? 'text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
              title="Students"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25c2.899 0 5.25-2.351 5.25-5.25S14.899 3.75 12 3.75 6.75 6.101 6.75 9s2.351 5.25 5.25 5.25zM4.5 20.25a7.5 7.5 0 0115 0" />
              </svg>
              <span className="text-[11px] leading-none">Students</span>
            </Link>

            {/* Teachers */}
            <Link
              to="/admin/teachers"
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl ${pathname.startsWith('/admin/teachers') ? 'text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
              title="Teachers"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75h7.5M8.25 13.5h7.5M4.5 6h15a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75V6.75A.75.75 0 014.5 6z" />
              </svg>
              <span className="text-[11px] leading-none">Teachers</span>
            </Link>

            {/* Messages */}
            <Link
              to="/admin/messages"
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl ${pathname.startsWith('/admin/messages') ? 'text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
              title="Messages"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9M7.5 12h6.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px] leading-none">Messages</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 right-3 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* More (opens drawer) */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-gray-600 hover:bg-gray-50"
              title="More"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              <span className="text-[11px] leading-none">More</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:5000 }}>
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowLogoutConfirm(false)} />
          <div className="fixed inset-0 flex items-end justify-end p-4 sm:items-center sm:justify-center">
            <div className="bg-white shadow-2xl ring-1 ring-gray-200 rounded-xl w-full max-w-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">Confirm logout</div>
              <div className="px-4 py-3 text-sm text-gray-700">Are you sure you want to logout?</div>
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button onClick={() => setShowLogoutConfirm(false)} className="px-3 py-1.5 rounded-lg text-sm border bg-white text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => { setShowLogoutConfirm(false); navigate('/sessions') }} className="px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700">Logout</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
