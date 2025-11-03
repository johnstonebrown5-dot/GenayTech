import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLock } from './LockProvider'
import api from '../api'

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

  useEffect(() => { setIsMobileOpen(false) }, [pathname])

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
          setBroadcastBanner(latest || null)
        }
      } catch {
        if (mounted) { setUnreadCount(0); setBroadcastUnread(0); setBroadcastBanner(null) }
      }
    }
    load()
    const id = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [user])

  // Decide if user is a class teacher to show Attendance
  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try{
        const [meRes, clsRes] = await Promise.all([
          api.get('/auth/me/').catch(()=>({ data:null })),
          api.get('/academics/classes/mine/').catch(()=>({ data:[] })),
        ])
        if (!mounted) return
        const meId = String(meRes?.data?.id || '')
        const classes = Array.isArray(clsRes?.data)? clsRes.data : []
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
        // Try "current" endpoints first
        let year = null
        let term = null
        try {
          const yr = await api.get('/academics/academic_years/current/')
          year = yr.data
        } catch {}
        try {
          const tr = await api.get('/academics/terms/current/')
          term = tr.data
        } catch {}

        // Fallback to mine/first available year
        if (!year) {
          try {
            const mine = await api.get('/academics/academic_years/mine/')
            const list = Array.isArray(mine.data?.results) ? mine.data.results : (Array.isArray(mine.data)? mine.data : [])
            year = list[0] || null
          } catch {}
        }

        // Fallback: get terms of current year from backend helper (teacher-authorized)
        if (!term) {
          try {
            const t = await api.get('/academics/terms/of-current-year/')
            const arr = Array.isArray(t.data?.results) ? t.data.results : (Array.isArray(t.data)? t.data : [])
            term = arr.find(x=>x.is_current) || arr.sort((a,b)=> (a.number||0)-(b.number||0))[0] || null
          } catch {}
        }

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

  return (
    <div className="min-h-screen bg-gray-50">
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
          </div>
        </div>
      )}
      {/* Top bar - refreshed style */}
      <header className="sticky top-0 z-30 bg-white text-gray-900 px-3 md:px-4 h-14 flex items-center gap-2 md:gap-3 shadow-sm border-b border-gray-200">
        <button
          className="p-2 rounded hover:bg-gray-100 md:hidden"
          aria-label="Toggle sidebar"
          onClick={()=>setIsMobileOpen(v=>!v)}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
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
        <div className="flex-1 flex items-center justify-center gap-2 text-xs md:text-sm px-1 md:px-2 text-gray-700 truncate">
          {schoolLogo ? (
            <img src={schoolLogo} alt="School logo" className="h-5 w-5 md:h-6 md:w-6 object-contain rounded" />
          ) : null}
          <span className="truncate opacity-90">{schoolName || ''}</span>
          {currentTerm && currentYear && (
            <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
              Term {currentTerm.number} {currentYear.label?.split('/')?.[1] || currentYear.label}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <Link
            to="/teacher/messages?tab=system"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label="Notifications"
            title="System messages"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9a6 6 0 10-12 0v.75a8.967 8.967 0 01-2.311 6.022c1.733.64 3.56 1.085 5.455 1.31m5.713 0a24.255 24.255 0 01-5.713 0m5.713 0a3 3 0 11-5.713 0" />
            </svg>
            {broadcastUnread > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                {broadcastUnread > 99 ? '99+' : broadcastUnread}
              </span>
            )}
          </Link>
          {user && (
            <span className="text-sm hidden sm:inline text-gray-600">
              {user.first_name || user.username}
            </span>
          )}
          {/* Hide header logout on mobile; show only on md+ */}
          <button onClick={lock} className="hidden md:inline-flex px-3 py-1.5 rounded text-sm bg-gray-800 text-white hover:bg-gray-900 transition-colors shadow-soft">Lock</button>
          <button onClick={logout} className="hidden md:inline-flex px-3 py-1.5 rounded text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-soft">Logout</button>
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="relative">
        {/* Overlay for mobile */}
        {isMobileOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={()=>setIsMobileOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed z-40 left-0 bottom-0 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 border-r border-blue-500/30 transition-all duration-200 ${sidebarBase} hidden md:flex flex-col shadow-2xl`}
          style={{ top: broadcastBanner ? 'calc(3.5rem + 40px)' : '3.5rem' }}
        > 
          <nav className="p-2 space-y-1 overflow-y-auto">
            {([ ...(hasAttendanceAccess? [{ to: '/teacher/attendance', label: 'Attendance', icon: '🗓️' }] : []), ...baseNavItems ]).map(i => {
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
          className={`fixed z-40 left-0 bottom-0 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 border-r border-blue-500/30 w-64 p-2 md:hidden transition-transform duration-200 shadow-2xl ${isMobileOpen? 'translate-x-0':'-translate-x-full'}`}
          style={{ top: broadcastBanner ? 'calc(3.5rem + 40px)' : '3.5rem' }}
        >
          <nav className="space-y-1 overflow-y-auto">
            {([ ...(hasAttendanceAccess? [{ to: '/teacher/attendance', label: 'Attendance', icon: '🗓️' }] : []), ...baseNavItems ]).map(i => {
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
          <div className="mt-auto p-3 text-xs text-blue-200/80">
            {schoolName && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>© {new Date().getFullYear()} {schoolName}</span>
              </div>
            )}
          </div>
        </aside>

        {/* Content area */}
        <main className={`transition-all duration-200 px-3 md:px-6 py-4 md:py-6 ${isOpen? 'md:ml-64':'md:ml-16'}`}>
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
