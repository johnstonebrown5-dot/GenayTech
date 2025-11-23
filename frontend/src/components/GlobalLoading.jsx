import React from 'react'
import LoadingOverlay from './LoadingOverlay'

export default function GlobalLoading(){
  const [pending, setPending] = React.useState(0)
  const [show, setShow] = React.useState(false)
  const [msgIndex, setMsgIndex] = React.useState(0)
  const [hint, setHint] = React.useState('')
  const [percentOverride, setPercentOverride] = React.useState(null)
  const [routeActive, setRouteActive] = React.useState(false)
  const delayRef = React.useRef(null)
  const cycleRef = React.useRef(null)
  const totalRef = React.useRef(0)
  const doneRef = React.useRef(0)
  const routeIdleRef = React.useRef(null)
  const hardTimeoutRef = React.useRef(null)
  const messages = React.useMemo(()=>[
    'Setting up data…',
    'Collecting layout…',
    'Setting up workspace…',
    'Fetching updates…',
    'Almost there…'
  ],[])

  React.useEffect(()=>{
    function onStart(){ setPending(p=>p+1); totalRef.current += 1 }
    function onEnd(){ setPending(p=> Math.max(0, p-1)); doneRef.current = Math.min(totalRef.current, doneRef.current + 1) }
    function onHint(e){ const m = e?.detail?.message; const pct = e?.detail?.percent; if (typeof m === 'string' && m.trim()) setHint(m.trim()); if (typeof pct === 'number') setPercentOverride(pct) }
    function onProg(e){ const pct = e?.detail?.percent; if (typeof pct === 'number') setPercentOverride(pct) }
    function onClear(){ setHint(''); setPercentOverride(null) }
    function onRouteStart(){
      setRouteActive(true)
      totalRef.current = 0
      doneRef.current = 0
      setPercentOverride(null)
      setHint('')
    }
    function onRouteEnd(){
      setRouteActive(false)
      totalRef.current = 0
      doneRef.current = 0
      setPercentOverride(null)
      setHint('')
    }
    window.addEventListener('api:request:start', onStart)
    window.addEventListener('api:request:end', onEnd)
    window.addEventListener('api:request:error', onEnd)
    window.addEventListener('loading:hint', onHint)
    window.addEventListener('loading:progress', onProg)
    window.addEventListener('loading:clear', onClear)
    window.addEventListener('route:transition:start', onRouteStart)
    window.addEventListener('route:transition:end', onRouteEnd)
    return ()=>{
      window.removeEventListener('api:request:start', onStart)
      window.removeEventListener('api:request:end', onEnd)
      window.removeEventListener('api:request:error', onEnd)
      window.removeEventListener('loading:hint', onHint)
      window.removeEventListener('loading:progress', onProg)
      window.removeEventListener('loading:clear', onClear)
      window.removeEventListener('route:transition:start', onRouteStart)
      window.removeEventListener('route:transition:end', onRouteEnd)
    }
  }, [])

  React.useEffect(()=>{
    const active = routeActive && pending > 0
    if (active){
      if (!delayRef.current){ delayRef.current = setTimeout(()=>{ setShow(true) }, 200) }
    } else {
      if (delayRef.current){ clearTimeout(delayRef.current); delayRef.current = null }
      setShow(false)
    }
    if (!active && routeActive && !show){
      if (routeIdleRef.current){ clearTimeout(routeIdleRef.current); routeIdleRef.current = null }
      routeIdleRef.current = setTimeout(()=>{ setRouteActive(false); totalRef.current=0; doneRef.current=0; setPercentOverride(null); setHint('') }, 600)
    }
  }, [routeActive, pending, show])

  React.useEffect(()=>{
    if (show){
      if (!hardTimeoutRef.current){
        hardTimeoutRef.current = setTimeout(()=>{
          setShow(false)
          setRouteActive(false)
          totalRef.current = 0
          doneRef.current = 0
          setPercentOverride(null)
          setHint('')
        }, 5000)
      }
    } else {
      if (hardTimeoutRef.current){ clearTimeout(hardTimeoutRef.current); hardTimeoutRef.current = null }
    }
    return ()=>{ if (hardTimeoutRef.current){ clearTimeout(hardTimeoutRef.current); hardTimeoutRef.current = null } }
  }, [show])

  React.useEffect(()=>{
    if (show){
      setMsgIndex(0)
      if (!cycleRef.current){
        cycleRef.current = setInterval(()=>{
          setMsgIndex(i => {
            const n = i + 1
            if (n >= messages.length - 1){ clearInterval(cycleRef.current); cycleRef.current = null; return messages.length - 1 }
            return n
          })
        }, 1200)
      }
    } else {
      if (cycleRef.current){ clearInterval(cycleRef.current); cycleRef.current = null }
    }
    return ()=>{ if (cycleRef.current){ clearInterval(cycleRef.current); cycleRef.current = null } }
  }, [show, messages])

  if (!show) return null
  const autoMsg = messages[msgIndex] || 'Loading. Please Wait…'
  const message = hint || autoMsg
  const computed = totalRef.current > 0 ? Math.min(99, Math.round((doneRef.current / totalRef.current) * 100)) : null
  const percent = typeof percentOverride === 'number' ? percentOverride : computed
  return <LoadingOverlay message={message} transparent percent={percent} />
}
