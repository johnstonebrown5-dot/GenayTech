import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'

const items = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/teachers', label: 'Teachers' },
  { to: '/admin/classes', label: 'Classes' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/school', label: 'School' },
  { to: '/admin/users', label: 'User Management' },
]

export default function AdminNav(){
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  return (
    <nav className="bg-white border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex gap-3 flex-wrap items-center">
        {items.map(i => (
          <Link key={i.to} to={i.to}
            className={(pathname===i.to? 'bg-blue-600 text-white':'bg-gray-100 text-gray-800') + ' px-3 py-1.5 rounded text-sm font-medium'}>
            {i.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {user && (
            <span className="text-sm text-gray-600 hidden sm:inline">
              {user.first_name || user.username}
            </span>
          )}
          <button onClick={logout} className="px-3 py-1.5 rounded text-sm bg-gray-200 hover:bg-gray-300">Logout</button>
        </div>
      </div>
    </nav>
  )
}
