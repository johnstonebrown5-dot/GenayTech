import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLock } from './LockProvider'
import api from '../api'
import { teacherQueries } from '../utils/teacherQueries'

const baseNavItems = [
  { to: '/teacher', label: 'Dashboard', icon: '📊' },
  // Attendance will be conditionally added based on class-teacher access
  { to: '/teacher/lessons', label: 'Lessons', icon: '🧭' },
  { to: '/teacher/grades', label: 'Grades', icon: '📝' },
  { to: '/teacher/results', label: 'Results', icon: '📈' },
  { to: '/teacher/analytics', label: 'Analytics', icon: '📊' },
  { to: '/teacher/timetable', label: 'Timetable', icon: '📆' },
  { to: '/teacher/classes', label: 'Classes', icon: '📚' },
  { to: '/teacher/messages', label: 'Messages', icon: '✉️' },
  { to: '/teacher/profile', label: 'Profile', icon: '👤' },
]

export default function TeacherLayout({ children }){
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { lock } = useLock()
  const [isOpen, setIsOpen] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches } catch { return false }
  })
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
  const [currentTerm, setCurrentTerm] = useState(null)
  const [currentYear, setCurrentYear] = useState(null)
  const [hasAttendanceAccess, setHasAttendanceAccess] = useState(false)
  const [classTeacherClassId, setClassTeacherClassId] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [broadcastUnread, setBroadcastUnread] = useState(0)
  const [broadcastBanner, setBroadcastBanner] = useState(null)
  const [bannerExpanded, setBannerExpanded] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_broadcast_ids') || '[]') } catch { return [] }
  })

  // Keep the app awake on supported browsers (Screen Wake Lock API)
  const wakeLockRef = useRef(null)
  useEffect(() => {
    let cancelled = false
    const canWake = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator
    const acquire = async () => {
      if (!canWake()) return
      try {
        if (document.visibilityState !== 'visible') return
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) { try{ lock.release?.() }catch{}; return }
        wakeLockRef.current = lock
        lock.addEventListener?.('release', () => { /* auto released */ })
      } catch {
        // Will try again on next user interaction/visibility
      }
    }
    const release = async () => {
      try { await wakeLockRef.current?.release?.() } catch {}
      wakeLockRef.current = null
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire(); else release() }
    const onResume = () => acquire()
    // Initial attempt
    acquire()
    // Re-acquire on visibility changes
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onResume)
    // Help some browsers requiring a gesture: retry on first pointer/keydown
    const gesture = () => { acquire(); window.removeEventListener('pointerdown', gesture); window.removeEventListener('keydown', gesture) }
    window.addEventListener('pointerdown', gesture)
    window.addEventListener('keydown', gesture)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pointerdown', gesture)
      window.removeEventListener('keydown', gesture)
      release()
    }
  }, [])
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const stored = window.localStorage.getItem('teacher_dark_mode')
      if (stored === '1') return true
      if (stored === '0') return false
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      return false
    }
  })

  const dismissBanner = (id) => {
    if (!id) return
    const next = Array.from(new Set([...(Array.isArray(dismissedIds)? dismissedIds:[]), id]))
    setDismissedIds(next)
    try { localStorage.setItem('dismissed_broadcast_ids', JSON.stringify(next)) } catch {}
    if (broadcastBanner?.id === id) setBroadcastBanner(null)
  }

  useEffect(() => { setIsMobileOpen(false) }, [pathname])

  useEffect(() => {
    try { window.localStorage.setItem('teacher_dark_mode', darkMode ? '1' : '0') } catch {}
  }, [darkMode])

  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return
      const m = window.matchMedia('(max-width: 767px)')
      const onChange = () => setIsMobileViewport(Boolean(m.matches))
      onChange()
      if (typeof m.addEventListener === 'function') m.addEventListener('change', onChange)
      else if (typeof m.addListener === 'function') m.addListener(onChange)
      return () => {
        try {
          if (typeof m.removeEventListener === 'function') m.removeEventListener('change', onChange)
          else if (typeof m.removeListener === 'function') m.removeListener(onChange)
        } catch {}
      }
    } catch {}
  }, [])

  // Load school info for header
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await teacherQueries.getSchoolInfo()
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

  // Prefetch important teacher data so tab navigation doesn't keep reloading
  useEffect(() => {
    let alive = true
    ;(async () => {
      try{
        await teacherQueries.prefetchTeacherBootstrap(user?.id)
      }catch{}
      if (!alive) return
    })()
    return () => { alive = false }
  }, [user?.id])

  // Keep browser tab title in sync with active school
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = schoolName ? schoolName : 'Genay Technologies'
    }
  }, [schoolName])

  // Poll unread messages (inbox + system)
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const cacheKey = user?.id != null ? `unread_info:${String(user.id)}` : ''
        const cachedInfo = cacheKey ? teacherQueries.cache.get(cacheKey) : null
        const info = cachedInfo || await teacherQueries.getUnreadMessageInfo(user?.id)
        const total = Number(info?.totalUnread || 0)
        if (mounted) {
          setUnreadCount(total)
          setBroadcastUnread(Number(info?.broadcastUnread || 0))
          const latest = info?.latestBroadcast || null
          const latestBody = String(latest?.body || '').trim()
          const candidate = latest && latestBody && !dismissedIds.includes(latest.id) ? latest : null
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

  // Decide if user is a class teacher to show Attendance
  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try{
        const [meRes, classes] = await Promise.all([
          teacherQueries.getMe().catch(()=>({ data:null })),
          teacherQueries.getMyClasses(),
        ])
        if (!mounted) return
        const meId = String(meRes?.data?.id || '')
        const mine = classes.find(c => {
          const tid = c?.teacher
          const tdet = c?.teacher_detail
          const candIds = [
            tid,
            tdet?.id,
            tdet?.user?.id,
          ].map(v=> (v==null? '' : String(v)))
          return candIds.includes(meId)
        })
        setHasAttendanceAccess(!!mine)
        setClassTeacherClassId(mine ? String(mine.id) : '')
      }catch{ if(mounted){ setHasAttendanceAccess(false); setClassTeacherClassId('') } }
    })()
    return ()=>{ mounted=false }
  }, [])

  // Load current term/year with graceful fallbacks
  useEffect(() => {
    let mounted = true
    const safeSet = (setter, val) => { if (mounted) setter(val) }
    ;(async () => {
      try {
        const [year, term] = await Promise.all([
          teacherQueries.getCurrentAcademicYear(),
          teacherQueries.getCurrentTerm(),
        ])
        safeSet(setCurrentYear, year || null)
        safeSet(setCurrentTerm, term || null)
      } catch (e) {
        safeSet(setCurrentYear, null)
        safeSet(setCurrentTerm, null)
      }
    })()
    return () => { mounted = false }
  }, [])

  const sidebarBase = isOpen ? 'w-64' : 'w-16'

  const displayName = user?.first_name || user?.username || 'Profile'
  const initials = (() => {
    const first = (user?.first_name || user?.username || '').trim().charAt(0)
    const last = (user?.last_name || '').trim().charAt(0)
    const value = (first + last).toUpperCase()
    return value || 'U'
  })()

  // Build navigation items, placing Attendance just after Messages when available
  const navItems = (() => {
    const items = [...baseNavItems]
    if (!hasAttendanceAccess) return items
    const attendanceItem = {
      to: classTeacherClassId
        ? `/teacher/attendance?class=${classTeacherClassId}`
        : '/teacher/attendance',
      label: 'Attendance',
      icon: '🗓️',
    }
    const manageClassItem = { to: '/teacher/manage-class', label: 'Manage My Class', icon: '🛠️' }
    const msgIndex = items.findIndex(i => i.label === 'Messages')
    if (msgIndex === -1) {
      items.unshift(attendanceItem)
    } else {
      items.splice(msgIndex + 1, 0, attendanceItem)
    }
    const classesIndex = items.findIndex(i => i.label === 'Classes')
    if (classesIndex !== -1) {
      items.splice(classesIndex + 1, 0, manageClassItem)
    } else {
      items.push(manageClassItem)
    }
    return items
  })()

  const activePageLabel = (() => {
    const p = String(pathname || '')
    const exact = navItems.find(i => String(i?.to || '') === p)
    if (exact?.label) return exact.label
    const prefix = navItems
      .filter(i => i?.to && i.to !== '/teacher')
      .find(i => p.startsWith(String(i.to) + '/'))
    if (prefix?.label) return prefix.label
    if (p.startsWith('/teacher')) return 'Teacher'
    return 'App'
  })()

  const effectiveDarkMode = false

  return (
    <div className={`min-h-screen bg-gray-50 teacher-theme ${effectiveDarkMode ? 'teacher-theme-dark' : ''}`}>
      {broadcastBanner && (
        <div className="sticky top-0 z-40 w-full bg-red-600 text-white">
          <div className="px-3 md:px-4 py-2 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.48 14.7A1 1 0 002.62 20h18.76a1 1 0 00.86-1.5l-8.48-14.64a1 1 0 00-1.73 0z" />
            </svg>
            <a href="/teacher/messages?tab=system" className="flex-1 min-w-0">
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
      {/* Top bar - refreshed style */}
      <header
        className="sticky top-0 z-30 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 text-gray-900 px-3 md:px-4 h-14 flex items-center gap-2 md:gap-3 shadow-md border-b border-gray-100"
        onClick={(e) => {
          try {
            if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(max-width: 767px)').matches) return
            const t = e.target
            if (t && typeof t.closest === 'function') {
              if (t.closest('button, a, input, select, textarea, [role="button"], [data-no-header-menu]')) return
            }
          } catch {}
          setIsMobileOpen(true)
        }}
      >
        <button
          className="p-2 rounded hover:bg-gray-100 hidden md:inline-flex"
          aria-label="Collapse sidebar"
          onClick={()=>setIsOpen(v=>!v)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M19.5 3.75a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75h15zm-9.53 3.22a.75.75 0 10-1.06 1.06l2.72 2.72-2.72 2.72a.75.75 0 101.06 1.06l3.25-3.25a.75.75 0 000-1.06l-3.25-3.25z" clipRule="evenodd" />
          </svg>
        </button>
        {/* Navigation buttons */}
        <div className="hidden md:flex items-center gap-1">
          <button
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            title="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <button
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Go forward"
            onClick={() => navigate(1)}
            title="Go forward">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-1 md:px-2">
          <div className="md:hidden text-sm font-semibold text-gray-800 truncate max-w-[70vw] text-center">
            {activePageLabel}
          </div>
          <div className="hidden md:inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-gray-200 bg-white/80 shadow-sm text-xs md:text-sm text-gray-700 truncate">
            {schoolLogo ? (
              <img src={schoolLogo} alt="School logo" className="h-5 w-5 md:h-5 object-contain rounded" />
            ) : null}
            <span className="truncate max-w-[42vw] md:max-w-[50vw] font-medium">{schoolName || ''}</span>
            {currentTerm && currentYear && (
              <span className="text-[10px] md:text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold whitespace-nowrap">
                Term {currentTerm.number} {currentYear.label?.split('/')?.[1] || currentYear.label}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="md:hidden p-2 rounded-full border border-gray-200 bg-white/90 hover:bg-white shadow-sm flex items-center justify-center"
            aria-label="Open menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <Link
            to="/teacher/profile"
            className="hidden md:inline-flex items-center gap-2 px-2 py-1 rounded-full border border-gray-200 bg-white/90 hover:bg-white shadow-sm transition-colors"
            aria-label="Open profile"
          >
            <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <span className="hidden sm:inline text-xs font-medium text-gray-800 max-w-[140px] truncate">{displayName}</span>
          </Link>
          <button
            type="button"
            onClick={() => setDarkMode(v => !v)}
            className="hidden md:inline-flex px-2.5 py-1.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs items-center gap-1"
            aria-label="Toggle dark mode"
          >
            <span>{darkMode ? '☀️' : '🌙'}</span>
            <span className="hidden lg:inline">{darkMode ? 'Light' : 'Dark'}</span>
          </button>
          {/* Hide header logout on mobile; show only on md+ */}
          <button onClick={lock} className="hidden md:inline-flex px-3 py-1.5 rounded text-sm bg-gray-800 text-white hover:bg-gray-900 transition-colors shadow-soft">Lock</button>
          <button onClick={logout} className="hidden md:inline-flex px-3 py-1.5 rounded text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-soft">Logout</button>
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="relative">
        {/* Overlay for mobile */}
        {isMobileOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={()=>setIsMobileOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed z-40 left-0 bottom-0 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 border-r border-blue-500/30 transition-all duration-200 ${sidebarBase} hidden md:flex flex-col shadow-2xl`}
          style={{ top: broadcastBanner ? 'calc(3.5rem + 40px)' : '3.5rem' }}
        > 
          <nav className="p-2 space-y-1 overflow-y-auto">
            {navItems.map(i => {
              const active = pathname === i.to
              return (
                <Link key={i.to} to={i.to}
                  className={`${active
                    ? 'bg-white/20 text-white shadow-lg border border-white/30'
                    : 'hover:bg-white/10 text-blue-100 hover:text-white'
                  } flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group`}
                  title={i.label}
                >
                  <span className="text-lg w-5 text-center" aria-hidden>{i.icon}</span>
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
          <div className="mt-auto p-3 text-xs text-blue-200/80">
            {isOpen && schoolName && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>© {new Date().getFullYear()} {schoolName}</span>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        <aside
          className={`fixed inset-y-0 z-40 left-0 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 border-r border-blue-500/30 w-full max-w-sm pt-2 pb-3 px-2 md:hidden transition-transform duration-200 shadow-2xl ${isMobileOpen? 'translate-x-0':'-translate-x-full'}`}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-semibold text-white/90">Menu</span>
            <button
              type="button"
              onClick={()=> setIsMobileOpen(false)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-900 shadow-sm hover:bg-gray-100"
              aria-label="Close menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="space-y-1 overflow-y-auto">
            {navItems.map(i => {
              const active = pathname === i.to
              return (
                <Link key={i.to} to={i.to}
                  className={`${active
                    ? 'bg-white/20 text-white shadow-lg border border-white/30'
                    : 'hover:bg-white/10 text-blue-100 hover:text-white'
                  } flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300`}
                >
                  <span className="text-lg" aria-hidden>{i.icon}</span>
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
          <div className="mt-3 pt-2 border-t border-blue-500/30 flex items-center gap-2">
            <button
              type="button"
              onClick={lock}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
            >
              Lock
            </button>
            <button
              type="button"
              disabled
              onClick={() => {}}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-white/5 text-white border border-white/30 hover:bg-white/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {darkMode ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              type="button"
              onClick={()=> setShowLogoutConfirm(true)}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
          <div className="mt-2 p-2 text-[11px] text-blue-200/80 space-y-1">
            {schoolName && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>© {new Date().getFullYear()} {schoolName}</span>
              </div>
            )}
            <div className="text-[10px] text-blue-100/90">Powered by Genay Technologies</div>
          </div>
        </aside>

        {/* Content area */}
        <main className={`transition-all duration-200 px-0 md:px-6 pt-1 pb-6 md:pt-6 md:pb-6 ${isOpen? 'md:ml-64':'md:ml-16'}`}>
          {children}
        </main>
      </div>
      {/* Floating Logout button for mobile only */}
      {(() => {
        const root = typeof document !== 'undefined' ? document.getElementById('floating-actions-root') : null
        const isSmall = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches
        if (!isSmall) return null
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
                <button onClick={() => { setShowLogoutConfirm(false); logout() }} className="px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700">Logout</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
