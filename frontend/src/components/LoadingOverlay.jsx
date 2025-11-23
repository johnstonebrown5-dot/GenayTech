import React from 'react'

export default function LoadingOverlay({ message = 'Loading…', transparent = false, percent = null }) {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(()=>{
    const check = ()=> setIsMobile((typeof window !== 'undefined') && window.innerWidth <= 480)
    check()
    window.addEventListener('resize', check)
    return ()=> window.removeEventListener('resize', check)
  },[])

  const cardPad = isMobile ? 'p-4' : 'p-6'
  const spinnerSize = isMobile ? 'h-6 w-6' : 'h-8 w-8'
  const overlayBg = transparent ? '' : (isMobile ? 'bg-black/10' : 'bg-white/60')
  const textSize = isMobile ? 'text-xs' : 'text-sm'

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${overlayBg} backdrop-blur-sm`}> 
      <div className={`flex flex-col items-center gap-2 ${cardPad} rounded-xl shadow-lg bg-white border border-gray-200`}>
        <svg className={`animate-spin ${spinnerSize} text-blue-600`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <p className={`${textSize} text-gray-700`}>{message}</p>
        {typeof percent === 'number' && !Number.isNaN(percent) && (
          <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}
