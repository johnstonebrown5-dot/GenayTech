import React from 'react'

export default function MaintenancePage({ message, endsAt = null, helpPath = '/help' }){
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const countdownText = React.useMemo(() => {
    if (!endsAt) return ''
    const t = new Date(endsAt).getTime()
    if (!Number.isFinite(t)) return ''
    const diff = Math.max(0, t - now)
    const totalSeconds = Math.floor(diff / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const parts = []
    if (hours > 0) parts.push(String(hours).padStart(2, '0'))
    parts.push(String(minutes).padStart(2, '0'))
    parts.push(String(seconds).padStart(2, '0'))
    return parts.join(':')
  }, [endsAt, now])

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-3xl">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900">Maintenance in progress</h1>
        <p className="mt-2 text-sm text-gray-600">{message || 'This feature is currently unavailable. Please check back later.'}</p>
        {countdownText && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-500">Estimated time remaining</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">{countdownText}</div>
          </div>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <a href={helpPath} className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
            Open Help Center
          </a>
        </div>
      </div>
    </div>
  )
}
