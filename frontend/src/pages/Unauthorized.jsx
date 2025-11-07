import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

export default function Unauthorized() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-orange-50 via-white to-amber-50 flex items-center justify-center p-6">
      <div className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-orange-500/10 to-rose-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-gradient-to-br from-yellow-500/10 to-orange-500/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-xl rounded-2xl border border-amber-200 bg-white/70 backdrop-blur-md shadow-xl p-10 text-center">
        <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-orange-600 to-rose-600 text-white shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm.75 6a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 1.5 0V8.25ZM12 16.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" clipRule="evenodd"/></svg>
        </div>
        <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-2xl font-bold text-transparent">Unauthorized access</h1>
        <p className="mt-3 text-slate-600">You don’t have permission to view this page. Please use the correct role or contact an administrator.</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {from && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
            >
              Go Back
            </button>
          )}
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-600 to-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            Go to dashboard
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
          >
            Switch account
          </Link>
        </div>
      </div>
    </div>
  )
}
