import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLock } from '../components/LockProvider'
import StudentMobileHeader from '../components/studentMobile/StudentMobileHeader'

const menuItems = [
  { to: '/student/profile', label: 'Profile', icon: '👤', desc: 'Edit account details' },
  { to: '/student/report-card', label: 'Report Cards', icon: '📋', desc: 'View all report cards' },
  { to: '/student/finance/pay', label: 'Pay Fees', icon: '💳', desc: 'M-Pesa fee payment' },
  { to: '/student/finance/verify', label: 'Verify Payment', icon: '✅', desc: 'Confirm M-Pesa receipt' },
  { to: '/help', label: 'Help Center', icon: '❓', desc: 'Get support and guides' },
  { to: '/sessions', label: 'Account Sessions', icon: '🔐', desc: 'Manage your sessions' },
]

export default function StudentMore() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lock } = useLock()

  const displayName = (() => {
    const first = String(user?.first_name || '').trim()
    const last = String(user?.last_name || '').trim()
    return `${first} ${last}`.trim() || user?.username || 'Student'
  })()

  return (
    <div className="sm:hidden bg-slate-50 min-h-full">
      <StudentMobileHeader
        theme="blue"
        title="More"
        showBack
        onBack={() => navigate('/student')}
      />

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{displayName}</div>
            <div className="text-xs text-slate-500">{user?.email || ''}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {menuItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
            >
              <span className="text-xl w-8 text-center">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                <div className="text-[11px] text-slate-500">{item.desc}</div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={lock}
            className="py-3 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
          >
            Lock Screen
          </button>
          <button
            type="button"
            onClick={() => navigate('/sessions')}
            className="py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold"
          >
            Logout
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-400 pt-2">
          © {new Date().getFullYear()} Genay Technologies
        </p>
      </div>
    </div>
  )
}
