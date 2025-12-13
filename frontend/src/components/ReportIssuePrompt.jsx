import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function ReportIssuePrompt(){
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [timerId, setTimerId] = useState(null)

  // Do not show on login or the report page itself
  const block = (
    pathname.startsWith('/login') ||
    pathname.startsWith('/trial') ||
    pathname.startsWith('/admin/report-issue') ||
    pathname.startsWith('/report-issue')
  )

  useEffect(() => {
    // Reset on route change
    if (timerId) { clearTimeout(timerId) }
    setVisible(false)

    // If dismissed for this session, don't show again
    const dismissed = sessionStorage.getItem('report_issue_prompt_dismissed') === '1'
    if (block || dismissed) return

    const id = setTimeout(() => setVisible(true), 5 * 60 * 1000)
    setTimerId(id)
    return () => clearTimeout(id)
  }, [pathname])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Report an issue"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3000,
        padding: '0 12px 12px',
        pointerEvents: 'none',
      }}
    >
      <div
        className="mx-auto max-w-screen-md"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="shadow-2xl rounded-xl border border-gray-200 bg-white overflow-hidden transform transition-all"
             style={{
               animation: 'slideUpFade 300ms ease',
             }}
        >
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="mt-0.5 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">Having trouble or found a bug?</div>
              <div className="text-sm text-gray-600">Tell us what happened so we can fix it quickly.</div>
            </div>
            <button
              onClick={() => { sessionStorage.setItem('report_issue_prompt_dismissed', '1'); setVisible(false) }}
              className="p-2 text-gray-500 hover:text-gray-700"
              aria-label="Dismiss"
              title="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="px-4 pb-3 flex items-center justify-end gap-2">
            <button
              onClick={() => { sessionStorage.setItem('report_issue_prompt_dismissed', '1'); setVisible(false) }}
              className="px-3 py-1.5 rounded-lg text-sm border bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => { sessionStorage.setItem('report_issue_prompt_dismissed', '1'); navigate('/report-issue') }}
              className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              Report an Issue
            </button>
          </div>
        </div>
      </div>
      <style>
        {`@keyframes slideUpFade { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}
      </style>
    </div>
  )
}
