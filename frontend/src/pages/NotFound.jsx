import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const homeTo = user ? '/app' : '/login'
  const homeLabel = user ? 'Go to Dashboard' : 'Login'
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-md shadow-xl p-10 text-center">
        <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
          <span className="text-xl font-semibold">404</span>
        </div>
        <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-3xl font-bold text-transparent">Page not found</h1>
        <p className="mt-3 text-slate-600">The page you’re looking for doesn’t exist or has been moved.</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
          >
            Go Back
          </button>
          <Link
            to={homeTo}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {homeLabel}
          </Link>
          {!user && (
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
            >
              Go Home
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
