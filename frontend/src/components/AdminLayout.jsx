import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLock } from './LockProvider'
import api from '../api'
import { canRunAuthenticatedPoll, handlePollAuthError } from '../utils/authPoll'
import FloatingDeliveryLog from './FloatingDeliveryLog'

function NavIcon({ name, className = 'w-5 h-5' }) {
  // Minimal, dependency-free icons (Heroicons-inspired)
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5h8.25V3H3v10.5Zm9.75 7.5H21V3h-8.25v18ZM3 21h8.25v-6H3v6Z" />
        </svg>
      )
    case 'students':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25c2.9 0 5.25-2.35 5.25-5.25S14.9 3.75 12 3.75 6.75 6.1 6.75 9s2.35 5.25 5.25 5.25Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.25a7.5 7.5 0 0 1 15 0" />
        </svg>
      )
    case 'teachers':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75h7.5M8.25 13.5h7.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6h15a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H4.5a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Z" />
        </svg>
      )
    case 'staff':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75a3.75 3.75 0 0 0-3.75 3.75v.75H6.75a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3h-1.5V7.5A3.75 3.75 0 0 0 12 3.75Z" />
        </svg>
      )
    case 'classes':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5M6 3.75h12a2.25 2.25 0 0 1 2.25 2.25v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75Z" />
        </svg>
      )
    case 'subjects':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5V6.75A2.25 2.25 0 0 1 6.75 4.5h12.75" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5A2.25 2.25 0 0 0 6.75 21.75h12.75V6.75A2.25 2.25 0 0 0 17.25 4.5H6.75" />
        </svg>
      )
    case 'fees':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5v9.75H2.25V8.25Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 15.75h.01M6 12h6" />
        </svg>
      )
    case 'exams':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 2.25h6M9 21.75h6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 2.25v4.5l-2.25 2.25v12a.75.75 0 0 0 .75.75h8.25a.75.75 0 0 0 .75-.75v-12L14.25 6.75v-4.5" />
        </svg>
      )
    case 'reports':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5V4.5m0 15h15" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 16.5V12m4.5 4.5V9m4.5 7.5V6" />
        </svg>
      )
    case 'events':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75v3m10.5-3.0v3M4.5 9h15" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h12a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V8.25A2.25 2.25 0 0 1 6 6Z" />
        </svg>
      )
    case 'timetable':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5v14.25H3.75V6Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 10.5h16.5M8.25 10.5v9.75M14.25 10.5v9.75" />
        </svg>
      )
    case 'messages':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5h9M7.5 13.5h6.75" />
        </svg>
      )
    case 'logs':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h10.5v16.5H6.75V3.75Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h7.5M8.25 10.5h7.5M8.25 13.5h6" />
        </svg>
      )
    case 'website':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75c2.25 2.85 3.75 5.85 3.75 9S14.25 18.9 12 21.75c-2.25-2.85-3.75-5.85-3.75-9S9.75 6.6 12 3.75Z" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15" />
        </svg>
      )
  }
}

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/students', label: 'Students', icon: 'students' },
  { to: '/admin/teachers', label: 'Teachers', icon: 'teachers' },
  { to: '/admin/staff', label: 'Support Staff', icon: 'staff' },
  { to: '/admin/classes', label: 'Classes', icon: 'classes' },
  { to: '/admin/subjects', label: 'Subjects', icon: 'subjects' },
  { to: '/admin/fees', label: 'Fees', icon: 'fees' },
  { to: '/admin/exams', label: 'Exams', icon: 'exams' },
  { to: '/admin/reports', label: 'Reports', icon: 'reports' },
  { to: '/admin/events', label: 'Events', icon: 'events' },
  { to: '/admin/timetable', label: 'Timetable', icon: 'timetable' },
  { to: '/admin/messages', label: 'Communication', icon: 'messages' },
  { to: '/admin/communication-logs', label: 'Comm Logs', icon: 'logs' },
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
  const [schoolMotto, setSchoolMotto] = useState('')
  const [currentTerm, setCurrentTerm] = useState(null)
  const [currentYear, setCurrentYear] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selfActive, setSelfActive] = useState(undefined)
  const [broadcastUnread, setBroadcastUnread] = useState(0)
  const [broadcastBanner, setBroadcastBanner] = useState(null)
  const [bannerExpanded, setBannerExpanded] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_broadcast_ids') || '[]') } catch { return [] }
  })
  const broadcastRef = useRef(null)
  const [broadcastHeight, setBroadcastHeight] = useState(0)

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
          setSchoolMotto(data?.motto || data?.tagline || '')
        }
      } catch (e) {
        if (mounted) { setSchoolName(''); setSchoolLogo(''); setSchoolMotto('') }
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

  // Measure broadcast banner height (so sidebar height/top can be exact)
  useEffect(() => {
    const measure = () => {
      try {
        const h = broadcastRef.current ? Math.round(broadcastRef.current.getBoundingClientRect().height || 0) : 0
        setBroadcastHeight(Number.isFinite(h) ? h : 0)
      } catch {
        setBroadcastHeight(0)
      }
    }
    measure()
    try { window.addEventListener('resize', measure) } catch {}
    return () => { try { window.removeEventListener('resize', measure) } catch {} }
  }, [broadcastBanner, bannerExpanded])

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

  // Close small popovers on route change
  useEffect(() => {
    setUserMenuOpen(false)
    setAddMenuOpen(false)
  }, [pathname])

  // Close small popovers on click outside / escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setAddMenuOpen(false)
      }
    }
    const onClick = (e) => {
      const t = e?.target
      if (!t) return
      // Any click on an element marked as "data-popover-ignore" should not auto-close.
      const ignore = t.closest && t.closest('[data-popover-ignore="true"]')
      if (ignore) return
      setUserMenuOpen(false)
      setAddMenuOpen(false)
    }
    try { window.addEventListener('keydown', onKey) } catch {}
    try { window.addEventListener('click', onClick) } catch {}
    return () => {
      try { window.removeEventListener('keydown', onKey) } catch {}
      try { window.removeEventListener('click', onClick) } catch {}
    }
  }, [])

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
      } catch (err) {
        if (handlePollAuthError(err, stop)) return
        if (mounted) { setUnreadCount(0); setBroadcastUnread(0); setBroadcastBanner(null) }
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

  const sidebarBase = isOpen ? 'w-72' : 'w-20'
  // Sidebar is offset from the viewport by ~0.75rem on the left + ~0.75rem gap.
  // So content should shift by (sidebar width + left offset + gap).
  const desktopOffset = isOpen ? 'md:ml-[19.5rem]' : 'md:ml-[6.5rem]'

  const userDisplayName = useMemo(() => {
    const first = String(user?.first_name || '').trim()
    const last = String(user?.last_name || '').trim()
    const full = `${first} ${last}`.trim()
    return full || user?.username || 'Admin'
  }, [user])

  const userRoleLabel = useMemo(() => {
    if (user?.is_superuser) return 'Super Admin'
    if (user?.is_staff || user?.role === 'admin') return 'Administrator'
    return String(user?.role || 'User')
  }, [user])

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      {broadcastBanner && (
        <div ref={broadcastRef} className="sticky top-0 z-40 w-full bg-red-600 text-white">
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
      {/* Top bar (screenshot-style) */}
      <header className={`sticky top-0 z-30 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 border-b border-gray-200 h-16 pt-[env(safe-area-inset-top)] ${desktopOffset} md:mr-3`}>
        <div className="w-full h-full flex items-center gap-3 px-3 sm:px-4 md:px-6">
          {/* Sidebar toggle */}
          <button
            className="hidden md:inline-flex p-2 rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-200 transition"
            aria-label="Toggle sidebar"
            onClick={() => setIsOpen(v => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700">
              <path d="M3.75 6.75h16.5v1.5H3.75v-1.5Zm0 4.5h16.5v1.5H3.75v-1.5Zm0 4.5h16.5v1.5H3.75v-1.5Z" />
            </svg>
          </button>

          {/* Search */}
          <div className="flex-1">
            <div className="relative max-w-2xl">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3m1.8-5.2a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
              </span>
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search students, teachers, classes..."
                className="w-full h-10 rounded-full border border-gray-200 bg-white pl-10 pr-3 text-sm font-semibold text-gray-800 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification bell */}
            <Link
              to="/admin/messages"
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 shadow-sm"
              aria-label="Notifications"
              title="Notifications"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m6-2.25V11a3 3 0 1 0-6 0v3.75c0 .8-.32 1.57-.88 2.13L7.5 17.5h9l-.62-.62A3 3 0 0 1 15 14.75Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 19a2.5 2.5 0 0 0 5 0" />
              </svg>
              {(unreadCount || broadcastUnread) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] font-bold text-center border-2 border-white">
                  {(unreadCount || broadcastUnread) > 99 ? '99+' : (unreadCount || broadcastUnread)}
                </span>
              )}
            </Link>

            {/* Add New */}
            <div className="relative" data-popover-ignore="true">
              <button
                type="button"
                onClick={() => setAddMenuOpen(v => !v)}
                className="inline-flex items-center gap-2 h-10 pl-2 pr-3 rounded-full bg-indigo-600 text-white font-black shadow-soft hover:bg-indigo-700"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className="hidden sm:inline">Add New</span>
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white shadow-elevated overflow-hidden">
                  <button onClick={()=>navigate('/admin/students')} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50">Add Student</button>
                  <button onClick={()=>navigate('/admin/teachers')} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50">Add Teacher</button>
                  <button onClick={()=>navigate('/admin/classes')} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50">Add Class</button>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" data-popover-ignore="true">
              <button
                type="button"
                onClick={() => setUserMenuOpen(v => !v)}
                className="inline-flex items-center gap-2 pl-2 pr-2.5 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 shadow-sm"
                aria-label="User menu"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">{String(userDisplayName || 'A')[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs font-bold text-gray-900">{userDisplayName}</span>
                  <span className="text-[11px] font-semibold text-gray-500">{userRoleLabel}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-500">
                  <path d="M12 15.75 6 9.75h12l-6 6Z" />
                </svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-elevated overflow-hidden">
                  <button onClick={()=>navigate('/admin/profile')} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50">My Profile</button>
                  <button onClick={lock} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50">Lock</button>
                  <div className="h-px bg-gray-100" />
                  <button onClick={()=>setShowLogoutConfirm(true)} className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">Logout</button>
                </div>
              )}
            </div>
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
          className={`fixed z-40 left-3 transition-all duration-200 ${sidebarBase} hidden md:flex flex-col shadow-2xl bg-[#0b1020] rounded-2xl border border-white/10 overflow-hidden`}
          style={{
            // Sidebar starts at the top (next to the header), not under the header.
            // Only broadcast banner (if present) should push it down.
            top: `calc(${broadcastHeight}px + env(safe-area-inset-top) + 0.75rem)`,
            bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
          }}
        >
          {/* Brand */}
          <div className="px-4 pt-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 overflow-hidden flex items-center justify-center shrink-0">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="School logo" className="w-full h-full object-contain bg-white" />
                ) : (
                  <span className="text-white font-black">S</span>
                )}
              </div>
              {isOpen && (
                <div className="min-w-0">
                  <div className="text-white font-black leading-tight truncate">{schoolName || 'School'}</div>
                  <div className="text-[11px] text-white/60 font-semibold truncate">{schoolMotto || 'Excellence in Education'}</div>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 min-h-0 px-3 py-3 space-y-1 overflow-y-auto overscroll-contain">
            {navItems.map(i => {
              const active = pathname === i.to || (i.to !== '/admin' && pathname.startsWith(i.to))
              return (
                <Link key={i.to} to={i.to}
                  className={`${active
                    ? 'bg-indigo-600 text-white shadow-[0_10px_22px_rgba(79,70,229,0.35)]'
                    : 'text-white/70 hover:text-white hover:bg-white/8'
                  } flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group`}
                  title={i.label}
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/6 border border-white/10">
                    <NavIcon name={i.icon} className="w-5 h-5" />
                  </span>
                  {isOpen && (
                    <span className="relative inline-flex items-center gap-2 text-sm font-semibold truncate">
                      {i.label}
                      {i.to === '/admin/messages' && unreadCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white border border-white/40">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Upgrade card */}
          <div className="p-3">
            <div className="rounded-2xl bg-white/6 border border-white/10 p-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-200 border border-indigo-400/20">
                  ★
                </span>
                {isOpen && (
                  <div className="min-w-0">
                    <div className="text-white text-xs font-black">Upgrade to Premium</div>
                    <div className="text-[11px] text-white/60 font-semibold">Unlock more features and analytics.</div>
                  </div>
                )}
              </div>
              {isOpen && (
                <button
                  type="button"
                  onClick={() => navigate('/pricing/per-student-monthly')}
                  className="mt-3 w-full h-10 rounded-xl bg-indigo-600 text-white font-bold shadow-soft hover:bg-indigo-700"
                >
                  Upgrade Now
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        <aside
          className={`fixed z-40 left-0 bottom-0 w-full md:hidden transition-transform duration-200 shadow-2xl ${isMobileOpen? 'translate-x-0':'-translate-x-full'} flex flex-col bg-[#0b1020]`}
          style={{ top: 0 }}
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/10 text-white">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 overflow-hidden flex items-center justify-center">
                {schoolLogo ? <img src={schoolLogo} alt="School logo" className="w-full h-full object-contain bg-white" /> : <span className="font-black">S</span>}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black truncate">{schoolName || 'School'}</div>
                <div className="text-[11px] text-white/60 font-semibold truncate">{schoolMotto || 'Excellence in Education'}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={()=>setIsMobileOpen(false)}
              className="p-2 rounded-full hover:bg-white/10"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-[env(safe-area-inset-bottom)] pt-3">
            {navItems.map(i => {
              const active = pathname === i.to || (i.to !== '/admin' && pathname.startsWith(i.to))
              return (
                <Link key={i.to} to={i.to}
                  className={`${active
                    ? 'bg-indigo-600 text-white shadow-[0_10px_22px_rgba(79,70,229,0.35)]'
                    : 'text-white/70 hover:text-white hover:bg-white/8'
                  } flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200`}
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/6 border border-white/10">
                    <NavIcon name={i.icon} className="w-5 h-5" />
                  </span>
                  <span className="relative inline-flex items-center gap-2 text-sm font-semibold">
                    {i.label}
                    {i.to === '/admin/messages' && unreadCount > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </span>
                </Link>
              )
            })}
          </nav>
          <div className="p-3 mt-2 border-t border-white/10 flex items-center gap-2">
            <button onClick={lock} className="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white border border-white/15 hover:bg-white/15 transition-colors">Lock</button>
            <button onClick={()=>setShowLogoutConfirm(true)} className="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">Logout</button>
          </div>
          <div className="mt-auto p-3 text-xs text-white/50">
            © {new Date().getFullYear()} Genay Technologies
          </div>
        </aside>

        {/* Content area */}
        <main className={`transition-all duration-200 px-4 md:px-6 pt-5 pb-24 md:py-7 ${desktopOffset} md:mr-3`}>
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
