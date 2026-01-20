import React from 'react'

export default function TopProgress(){
  const [visible, setVisible] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const timerRef = React.useRef(null)
  const inflightRef = React.useRef(0)

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const start = () => {
    inflightRef.current += 1
    if (!visible){
      setVisible(true)
      setProgress(15)
      clearTimer()
      timerRef.current = setInterval(()=>{
        setProgress(p => {
          if (p < 85) return p + Math.max(0.5, (85 - p) * 0.03)
          return p
        })
        return
      }, 300)
    }
  }

  const end = () => {
    inflightRef.current = Math.max(0, inflightRef.current - 1)
    if (inflightRef.current === 0){
      clearTimer()
      setProgress(100)
      setTimeout(()=>{ setVisible(false); setProgress(0) }, 300)
    }
  }

  React.useEffect(()=>{
    const onStart = () => start()
    const onEnd = () => end()
    const onError = () => end()
    const onRoute = () => start()
    const onRouteEnd = () => end()
    if (typeof window !== 'undefined'){
      window.addEventListener('api:request:start', onStart)
      window.addEventListener('api:request:end', onEnd)
      window.addEventListener('api:request:error', onError)
      window.addEventListener('route:transition:start', onRoute)
      // Best-effort: end route load after a short delay
      window.addEventListener('popstate', onRouteEnd)
    }
    return ()=>{
      if (typeof window !== 'undefined'){
        window.removeEventListener('api:request:start', onStart)
        window.removeEventListener('api:request:end', onEnd)
        window.removeEventListener('api:request:error', onError)
        window.removeEventListener('route:transition:start', onRoute)
        window.removeEventListener('popstate', onRouteEnd)
      }
      clearTimer()
    }
  }, [])

  if (!visible) return null
  return (
    <div className="fixed inset-x-0 top-0 z-[70] pointer-events-none">
      <div
        className="h-0.5 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-sky-500 shadow-sm transition-all duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
