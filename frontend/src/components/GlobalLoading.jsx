import React from 'react'
import LoadingOverlay from './LoadingOverlay'

export default function GlobalLoading(){
  const [pending, setPending] = React.useState(0)
  const [show, setShow] = React.useState(false)
  const [msgIndex, setMsgIndex] = React.useState(0)
  const delayRef = React.useRef(null)
  const cycleRef = React.useRef(null)
  const messages = React.useMemo(()=>[
    'Setting up data…',
    'Collecting layout…',
    'Setting up workspace…',
    'Fetching updates…',
    'Almost there…'
  ],[])

  React.useEffect(()=>{
    function onStart(){
      setPending(p=>p+1)
    }
    function onEnd(){
      setPending(p=> Math.max(0, p-1))
    }
    window.addEventListener('api:request:start', onStart)
    window.addEventListener('api:request:end', onEnd)
    window.addEventListener('api:request:error', onEnd)
    return ()=>{
      window.removeEventListener('api:request:start', onStart)
      window.removeEventListener('api:request:end', onEnd)
      window.removeEventListener('api:request:error', onEnd)
    }
  }, [])

  React.useEffect(()=>{
    if (pending > 0){
      if (!delayRef.current){
        delayRef.current = setTimeout(()=>{ setShow(true) }, 200)
      }
    } else {
      if (delayRef.current){ clearTimeout(delayRef.current); delayRef.current = null }
      setShow(false)
    }
  }, [pending])

  React.useEffect(()=>{
    if (show){
      setMsgIndex(0)
      if (!cycleRef.current){
        cycleRef.current = setInterval(()=>{
          setMsgIndex(i => (i + 1) % messages.length)
        }, 1200)
      }
    } else {
      if (cycleRef.current){ clearInterval(cycleRef.current); cycleRef.current = null }
    }
    return ()=>{ if (cycleRef.current){ clearInterval(cycleRef.current); cycleRef.current = null } }
  }, [show, messages])

  if (!show) return null
  return <LoadingOverlay message={messages[msgIndex] || 'Loading…'} transparent />
}
