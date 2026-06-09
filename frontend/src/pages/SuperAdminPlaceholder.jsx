import React from 'react'

export default function SuperAdminPlaceholder({ title = 'Coming Soon', subtitle }){
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="text-sm font-extrabold text-indigo-700">{subtitle || 'Super Admin'}</div>
      <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{title}</h1>
      <p className="mt-3 text-sm text-slate-600 font-semibold max-w-2xl">
        This section is not available yet. If you tell me what you want it to do, I can build it to match the new dashboard style.
      </p>
    </div>
  )
}

