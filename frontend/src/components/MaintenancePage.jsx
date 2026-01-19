import React from 'react'

export default function MaintenancePage({ message, helpPath = '/help' }){
  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-3xl">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900">Feature currently unavailable</h1>
        <p className="mt-2 text-sm text-gray-600">{message || 'This feature is currently unavailable. Please check back later.'}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a href={helpPath} className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
            Open Help Center
          </a>
        </div>
      </div>
    </div>
  )
}
