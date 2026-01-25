import React from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAssistant } from './AssistantContext'

export default function FloatingButton(){
  const { togglePanel } = useAssistant()
  const { pathname } = useLocation()
  const isSmall = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 480px)').matches
  const size = isSmall ? 40 : 44
  const iconSize = isSmall ? 16 : 18
  const [root, setRoot] = React.useState(null)

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const existing = document.getElementById('floating-actions-root')
    if (existing) { setRoot(existing); return }
    const obs = new MutationObserver(() => {
      const el = document.getElementById('floating-actions-root')
      if (el) {
        setRoot(el)
        try { obs.disconnect() } catch {}
      }
    })
    try { obs.observe(document.body, { childList: true, subtree: true }) } catch {}
    return () => { try { obs.disconnect() } catch {} }
  }, [])

  const button = (
    <button
      onClick={togglePanel}
      aria-label="Open assistant"
      style={{
        order: 2,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '9999px',
        border: 'none',
        background: '#2563eb',
        color: 'white',
        boxShadow: '0 6px 12px rgba(0,0,0,0.18)',
        cursor: 'pointer',
        fontSize: `${iconSize}px`,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transform: 'translateZ(0)',
        pointerEvents: 'auto',
      }}
      title={pathname?.includes('/messages') ? 'Assistant (messages)' : 'Assistant'}
    >
      ✨
    </button>
  )

  if (root) return createPortal(button, root)

  // Fallback to fixed if root missing
  return (
    <div style={{position:'fixed', right:16, bottom:24, zIndex:2100}}>
      {button}
    </div>
  )
}
