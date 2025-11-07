import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function FloatingActions(){
  const [expanded, setExpanded] = useState(false)
  const timerRef = useRef(null)
  const rootRef = useRef(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const offsetRef = useRef({ x: 0, y: 0 })
  // Responsive FAB size (mobile: 48, tablet: 52, desktop: 60)
  const getFabSize = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return 48
    if (window.matchMedia('(min-width: 1024px)').matches) return 60
    if (window.matchMedia('(min-width: 768px)').matches) return 52
    return 48
  }
  const [fabSize, setFabSize] = useState(() => getFabSize())
  const [pos, setPos] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 }
    try {
      const saved = JSON.parse(localStorage.getItem('fab_pos') || 'null')
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved
    } catch {}
    const size = getFabSize()
    const x = Math.max(8, (window.innerWidth || 0) - 16 - size)
    const y = Math.max(8, (window.innerHeight || 0) - 24 - size)
    return { x, y }
  })
  const { pathname } = useLocation()
  const isMessages = typeof pathname === 'string' && pathname.includes('/messages')

  const resetTimer = () => {
    if (!expanded) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setExpanded(false), 6000)
  }

  useEffect(() => {
    const onActivity = () => { if (expanded) resetTimer() }
    const events = ['mousemove','mousedown','keydown','touchstart','scroll']
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))
    return () => { events.forEach(ev => window.removeEventListener(ev, onActivity)) }
  }, [expanded])

  useEffect(() => {
    if (expanded) resetTimer()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [expanded])

  const toggle = () => {
    if (expanded) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setExpanded(false)
    } else {
      setExpanded(true)
      resetTimer()
    }
  }

  // Staggered reveal for actions inside the root container on expand (vertical stack)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.children || [])
    items.forEach((el, i) => {
      try {
        el.style.transition = 'opacity 220ms ease, transform 220ms ease'
        el.style.willChange = 'opacity, transform'
        // make children full-width clickable blocks by default
        el.style.display = 'inline-flex'
        el.style.alignItems = 'center'
        if (!expanded) {
          el.style.opacity = '0'
          el.style.transform = 'translateY(6px) scale(0.98)'
          el.style.transitionDelay = `${Math.max(0, (items.length-1-i)*30)}ms`
        } else {
          el.style.opacity = '0'
          el.style.transform = 'translateY(6px) scale(0.98)'
          el.style.transitionDelay = `${i*40}ms`
          requestAnimationFrame(() => {
            el.style.opacity = '1'
            el.style.transform = 'translateY(0) scale(1)'
          })
        }
      } catch {}
    })
  }, [expanded])

  // Clamp helper
  const clampToViewport = (x, y) => {
    const size = fabSize
    const margin = 8
    const maxX = Math.max(margin, (window.innerWidth || 0) - size - margin)
    const maxY = Math.max(margin, (window.innerHeight || 0) - size - margin)
    return { x: Math.min(Math.max(x, margin), maxX), y: Math.min(Math.max(y, margin), maxY) }
  }

  // Keep inside viewport on resize
  useEffect(() => {
    const onResize = () => {
      setFabSize(getFabSize())
      setPos(prev => {
        const clamped = clampToViewport(prev.x, prev.y)
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          try { localStorage.setItem('fab_pos', JSON.stringify(clamped)) } catch {}
        }
        return clamped
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDown = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    draggingRef.current = true
    movedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY }
    offsetRef.current = { x: pos.x, y: pos.y }
  }
  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.abs(dx) + Math.abs(dy) > 6) movedRef.current = true
    const next = clampToViewport(offsetRef.current.x + dx, offsetRef.current.y + dy)
    setPos(next)
  }
  const onPointerUp = (e) => {
    if (!draggingRef.current) return
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    draggingRef.current = false
    try { localStorage.setItem('fab_pos', JSON.stringify(pos)) } catch {}
    // If we dragged, prevent toggle; click handler will check movedRef
    setTimeout(() => { movedRef.current = false }, 0)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 2100,
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'flex-end',
        gap: expanded ? 12 : 8,
        pointerEvents: 'none',
        transition: 'gap 200ms ease',
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => resetTimer()}
    >
      {/* Actions stack above the main FAB */}
      <div
        style={{
          padding: expanded ? 2 : 0,
          borderRadius: 16,
          background: expanded
            ? 'rgba(255,255,255,0.9)'
            : 'transparent',
          backdropFilter: expanded ? 'saturate(160%) blur(8px)' : 'none',
          WebkitBackdropFilter: expanded ? 'saturate(160%) blur(8px)' : 'none',
          boxShadow: expanded ? '0 14px 40px rgba(0,0,0,0.18)' : 'none',
          transform: expanded ? 'translateY(0)' : 'translateY(2px)',
          transition: 'all 250ms ease',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: expanded ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 10,
            background: 'transparent',
            borderRadius: 12,
            padding: '6px 6px',
            maxWidth: 420,
            opacity: 1,
            transition: 'all 280ms ease',
            overflow: 'visible',
            pointerEvents: 'auto',
          }}
        >
          <div
            id="floating-actions-root"
            ref={rootRef}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}
          />
        </div>
      </div>

      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => { if (!movedRef.current) toggle(); e.stopPropagation(); }}
        aria-label={expanded ? 'Collapse actions' : 'More actions'}
        style={{
          width: fabSize,
          height: fabSize,
          borderRadius: 9999,
          border: 'none',
          background: expanded
            ? 'linear-gradient(135deg, #111827, #1f2937)'
            : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: 'white',
          boxShadow: expanded
            ? '0 8px 18px rgba(17,24,39,0.28)'
            : '0 8px 22px rgba(37,99,235,0.35)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          pointerEvents: 'auto',
          transform: expanded ? 'translateY(0)' : 'translateY(0)',
          transition: 'background-color 200ms ease, box-shadow 200ms ease, transform 150ms ease, filter 150ms ease',
          filter: expanded ? 'none' : 'drop-shadow(0 2px 8px rgba(37,99,235,0.35))',
        }}
        onMouseDown={(e)=>{ e.currentTarget.style.transform = 'scale(0.98)'}}
        onMouseUp={(e)=>{ e.currentTarget.style.transform = 'scale(1)'}}
      >
        {expanded ? (
          // Close (X)
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={Math.round(fabSize*0.42)} height={Math.round(fabSize*0.42)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          // Plus (+)
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={Math.round(fabSize*0.46)} height={Math.round(fabSize*0.46)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>
    </div>
  )
}
