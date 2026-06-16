import React from 'react'
import { useNavigate } from 'react-router-dom'

const THEMES = {
  blue: 'bg-blue-600',
  green: 'bg-emerald-500',
  purple: 'bg-gradient-to-br from-purple-600 via-purple-600 to-blue-600',
}

export default function StudentMobileHeader({
  title,
  theme = 'blue',
  showBack = false,
  onBack,
  rightIcon,
  onRightClick,
  children,
  embedded = false,
}) {
  const navigate = useNavigate()
  const bg = THEMES[theme] || THEMES.blue

  const handleBack = () => {
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <div className={`${embedded ? '' : bg} text-white ${embedded ? '' : 'rounded-b-3xl shadow-md'} px-4 pt-3 pb-3`}>
      {children ? children : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {showBack && (
              <button
                type="button"
                onClick={handleBack}
                className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0"
                aria-label="Go back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-bold truncate">{title}</h1>
          </div>
          {rightIcon && (
            <button
              type="button"
              onClick={onRightClick}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0"
              aria-label="Action"
            >
              {rightIcon}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
