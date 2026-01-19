import React from 'react'

export default function FeatureUnavailable({ message, helpPath, inline = false }){
  if (inline) {
    return (
      <div className="min-h-[60vh] w-full flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 max-w-md w-full p-6 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-2xl">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900">Feature currently unavailable</h2>
          <p className="mt-2 text-sm text-gray-600">
            {message || 'This feature is currently unavailable. Please check back later.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            {helpPath && (
              <a href={helpPath} className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">Open Help Center</a>
            )}
            <button
              type="button"
              onClick={() => { try { window.history.back() } catch {} }}
              className="inline-flex items-center px-4 py-2 rounded-lg border text-sm font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 max-w-md w-full p-6 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-2xl">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-900">Feature Unavailable</h2>
        <p className="mt-2 text-sm text-gray-600">
          {message || 'This feature is currently unavailable. Please check back later.'}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          {helpPath && (
            <a href={helpPath} className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">Open Help Center</a>
          )}
          <button
            type="button"
            onClick={() => { try { window.history.back() } catch {} }}
            className="inline-flex items-center px-4 py-2 rounded-lg border text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
