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
  { to: '/admin/classes', label: 'Classes', icon: '🏫' },
  { to: '/admin/subjects', label: 'Subjects', icon: '📚' },
  { to: '/admin/fees', label: 'Fees', icon: '💳' },
  { to: '/admin/exams', label: 'Exams', icon: '📝' },
  { to: '/admin/reports', label: 'Reports', icon: '📈' },
  { to: '/admin/events', label: 'Events', icon: '📅' },
  { to: '/admin/timetable', label: 'Timetable', icon: '📆' },
  { to: '/admin/messages', label: 'Messages', icon: '✉️' },
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

  // Ensure we have an up-to-date active status for the current user
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/me/')
        if (mounted) setSelfActive(typeof data?.is_active === 'boolean' ? data.is_active : undefined)
      } catch {
        if (mounted) setSelfActive(undefined)
      }
    })()
    return () => { mounted = false }
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
        if (mounted) setUnreadCount(total)
      } catch {
        if (mounted) setUnreadCount(0)
      }
    }
    // initial
    load()
    const id = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [user])

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
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-gray-200/80 px-3 sm:px-4 md:px-6 h-16 pt-[env(safe-area-inset-top)] shadow-soft">
        <div className="max-w-screen-2xl mx-auto h-full flex items-center gap-2">
          {/* Left: menu + brand */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="p-2.5 rounded-lg hover:bg-gray-100/80 transition-all duration-200 md:hidden"
              aria-label="Toggle sidebar"
              onClick={()=>setIsMobileOpen(v=>!v)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <button
              className="p-2.5 rounded-lg hover:bg-gray-100/80 transition-all duration-200 hidden md:inline-flex"
              aria-label="Collapse sidebar"
              onClick={()=>setIsOpen(v=>!v)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700">
                <path fillRule="evenodd" d="M19.5 3.75a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75h15zm-9.53 3.22a.75.75 0 10-1.06 1.06l2.72 2.72-2.72 2.72a.75.75 0 101.06 1.06l3.25-3.25a.75.75 0 000-1.06l-3.25-3.25z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <img src="/logo.jpg" alt="EDU-TRACK Logo" className="w-8 h-8 rounded-lg object-contain" />
              <div className="font-extrabold tracking-tight text-gray-900 text-lg sm:text-xl">EDU-TRACK</div>
            </div>
          </div>

          {/* Center: school chip (scrollable on small) */}
          <div className="flex-1 flex items-center justify-center overflow-x-auto sm:overflow-visible px-1 sm:px-3">
            <div className="flex items-center gap-2">
              {schoolLogo ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50/90 border border-gray-200 rounded-full shadow-sm">
                  <img src={schoolLogo} alt="School logo" className="h-5 w-5 object-contain rounded" />
                  <span className="text-gray-800 text-sm font-medium truncate max-w-[9rem] sm:max-w-[14rem]">{schoolName || ''}</span>
                </div>
              ) : (
                <span className="text-gray-700 truncate max-w-[10rem]">{schoolName || ''}</span>
              )}
              {currentTerm && currentYear && (
                <div className="px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-[11px] sm:text-xs font-medium border border-brand-200 whitespace-nowrap">
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
                className="p-2.5 rounded-lg border border-gray-200 text-gray-600 hover:text-brand-700 hover:border-brand-200 hover:bg-brand-50/60 transition-all"
                aria-label="Go back"
                title="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.53 4.47a.75.75 0 010 1.06L5.56 9.5h13.69a.75.75 0 010 1.5H5.56l3.97 3.97a.75.75 0 11-1.06 1.06l-5.25-5.25a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => navigate(1)}
                className="p-2.5 rounded-lg border border-gray-200 text-gray-600 hover:text-brand-700 hover:border-brand-200 hover:bg-brand-50/60 transition-all"
                aria-label="Go forward"
                title="Forward"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M14.47 4.47a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L18.44 11H4.75a.75.75 0 010-1.5h13.69l-3.97-3.97a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{(user.first_name || user.username || 'U')[0].toUpperCase()}</span>
                </div>
                <span className="text-sm text-gray-700 font-medium max-w-[10rem] truncate">{user.first_name || user.username}</span>
                {typeof (selfActive ?? user.is_active) === 'boolean' && (
                  <span className={`ml-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${(selfActive ?? user.is_active) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <span className={`inline-block w-2 h-2 rounded-full ${(selfActive ?? user.is_active) ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {(selfActive ?? user.is_active) ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>
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
        const size = 44
        const iconSize = 18
        const btn = (
          <button
            onClick={logout}
            aria-label="Logout"
            title="Logout"
            style={{
              order: 1,
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: '9999px',
              border: 'none',
              background: '#dc2626',
              color: 'white',
              boxShadow: '0 6px 14px rgba(220,38,38,0.35)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              pointerEvents: 'auto',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={iconSize} height={iconSize}>
              <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v7.5a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zm-4.657 2.843a.75.75 0 011.06 1.06 7.5 7.5 0 101.06-1.06 9 9 0 11-12.727 0z" clipRule="evenodd" />
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
        <aside className={`fixed z-40 top-[calc(4rem+env(safe-area-inset-top))] left-0 bottom-0 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 border-r border-blue-500/30 transition-all duration-200 ${sidebarBase} hidden md:flex flex-col shadow-2xl`}>
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
                  <span className="text-lg w-5 text-center">{i.icon}</span>
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
            {isOpen && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>© {new Date().getFullYear()} EDU-TRACK</span>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        <aside className={`fixed z-40 top-[calc(4rem+env(safe-area-inset-top))] left-0 bottom-0 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 border-r border-blue-500/30 w-64 p-2 md:hidden transition-transform duration-200 shadow-2xl ${isMobileOpen? 'translate-x-0':'-translate-x-full'}`}>
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
          <div className="mt-auto p-3 text-xs text-blue-200/80">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>© {new Date().getFullYear()} EDU-TRACK</span>
            </div>
          </div>
        </aside>

        {/* Content area */}
        <main className={`transition-all duration-200 px-4 md:px-6 py-4 md:py-6 ${isOpen? 'md:ml-64':'md:ml-16'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
