import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

function moneyPlain(n) {
  try {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0))
  } catch {
    return String(n ?? '0.00')
  }
}

export default function StudentMobileHome({
  student,
  authUser,
  summary,
  calendarUpcoming = [],
  calendarTerm = null,
  messagesUnread = 0,
  notificationsUnread = 0,
  isLoading = false,
}) {
  const navigate = useNavigate()

  const displayName = (() => {
    const first = String(student?.name || authUser?.first_name || '').trim()
    const last = String(authUser?.last_name || '').trim()
    const full = student?.name || `${first} ${last}`.trim()
    return full || authUser?.username || 'Student'
  })()

  const schoolName = student?.school?.name || authUser?.school?.name || 'Riverside Academy'
  const studentId = student?.admission_no || student?.id || 'SCH001-0001'
  const currentTerm = calendarTerm?.name || (calendarTerm?.number ? `Term ${calendarTerm.number}` : null) || student?.term || student?.current_term || 'Unknown Term'
  const studentClass = student?.klass_detail?.name || student?.klass || student?.class || 'Grade 1A'
  const studentGrade = student?.klass_detail?.grade_level || student?.grade_level || student?.grade || 'Grade 1'
  const profileImage = student?.photo_url || authUser?.avatar_url || authUser?.photo_url || ''

  const cards = [
    {
      to: '/student/academics',
      label: 'Academics',
      sub: 'Courses & Results',
      icon: (
        <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-violet-50 text-violet-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </div>
      ),
    },
    {
      to: '/student/finance',
      label: 'Finance',
      sub: 'Fee & Payments',
      icon: (
        <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M4 5h16v14H4z" /><path d="M4 10h16" />
          </svg>
        </div>
      ),
    },
    {
      to: '/student/messages',
      label: 'Messages',
      sub: 'Chat with support',
      badge: messagesUnread,
      icon: (
        <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-sky-50 text-sky-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
      ),
    },
    {
      to: '/student/notifications',
      label: 'Notifications',
      sub: 'Stay updated',
      badge: notificationsUnread,
      icon: (
        <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-purple-50 text-purple-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
      ),
    },
  ]

  return (
    <div className="sm:hidden bg-slate-50 min-h-screen pb-28 px-0">
      <div className="relative overflow-hidden bg-gradient-to-br from-sky-400 to-sky-500 px-5 pb-10 pt-8 shadow-[0_30px_90px_-35px_rgba(15,23,42,0.9)]">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_60%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_60%)]" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-20 w-20 flex-shrink-0 rounded-full bg-slate-200 ring-2 ring-white/30 overflow-hidden shadow-sm">
              {profileImage ? (
                <img src={profileImage} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-300 text-xl font-semibold text-slate-700">
                  {displayName?.charAt(0)?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-700">{schoolName}</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900 truncate">{displayName}</div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-300/50 bg-white/60 px-3 py-1.5 text-[10px] text-slate-700 whitespace-nowrap">
                <span className="font-semibold">ID: {studentId}</span>
                <button
                  type="button"
                  onClick={() => {
                    try { navigator.clipboard.writeText(studentId) } catch {}
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-300/40 px-1.5 py-0.5 text-slate-800"
                >
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-white/40 text-slate-700 shadow-[0_10px_20px_-12px_rgba(15,23,42,0.2)]"
              aria-label="Notifications"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notificationsUnread > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{notificationsUnread > 99 ? '99+' : notificationsUnread}</span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-[24px] border border-white/30 bg-white/50 p-3 text-center text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <div className="text-[10px] uppercase tracking-[0.28em] text-slate-600">Term</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{currentTerm}</div>
          </div>
          <div className="rounded-[24px] border border-white/30 bg-white/50 p-3 text-center text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <div className="text-[10px] uppercase tracking-[0.28em] text-slate-600">Class</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{studentClass}</div>
          </div>
          <div className="rounded-[24px] border border-white/30 bg-white/50 p-3 text-center text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <div className="text-[10px] uppercase tracking-[0.28em] text-slate-600">Grade</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{studentGrade}</div>
          </div>
        </div>
      </div>

      <div className="-mt-12 pb-6 space-y-4 relative z-10">
        <div className="mx-0 rounded-[32px] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Quick Overview</h2>
          </div>
          <div className="grid gap-3">
            {cards.map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="relative flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 shadow-sm transition hover:border-blue-200 hover:bg-white"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {card.icon}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{card.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{card.sub}</div>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                {card.badge > 0 && (
                  <span className="absolute right-4 top-4 inline-flex h-5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-2 text-[10px] font-semibold text-white">{card.badge > 99 ? '99+' : card.badge}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-0 rounded-[32px] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Finance Summary</h2>
              <p className="text-[11px] text-slate-500">Fee status at a glance</p>
            </div>
            <Link to="/student/finance" className="text-xs font-semibold text-blue-600">View all</Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.28em] text-amber-500">Total billed</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{isLoading ? '...' : `Ksh ${moneyPlain(summary?.total_billed)}`}</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.28em] text-emerald-500">Total paid</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{isLoading ? '...' : `Ksh ${moneyPlain(summary?.total_paid)}`}</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3 text-center">
              <div className="text-[10px] uppercase tracking-[0.28em] text-purple-500">Balance</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{isLoading ? '...' : `Ksh ${moneyPlain(summary?.balance)}`}</div>
            </div>
          </div>
        </div>

        <div className="mx-0 rounded-[32px] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Upcoming</h2>
              <p className="text-[11px] text-slate-500">You&apos;re all caught up!</p>
            </div>
            <button type="button" className="text-xs font-semibold text-blue-600">View calendar</button>
          </div>
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white text-blue-600 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">No upcoming events</div>
                <div className="text-[11px] text-slate-500">You&apos;re all caught up!</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
