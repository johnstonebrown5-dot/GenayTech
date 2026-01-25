import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import HelpModal from './HelpModal'

export default function FloatingHelpAction(){
  const [open, setOpen] = useState(false)
  const [root, setRoot] = useState(null)

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

  const node = (
    <div>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open help"
        style={{
          pointerEvents: 'auto',
          background: 'white',
          color: '#0f172a',
          border: '1px solid rgba(15,23,42,0.08)',
          boxShadow: '0 6px 14px rgba(0,0,0,0.08)',
          borderRadius: 12,
          height: 40,
          padding: '0 12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <span style={{
          width: 24,
          height: 24,
          borderRadius: 9999,
          background: '#2563eb',
          color: 'white',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)'
        }}>?</span>
        <span style={{fontWeight: 600}}>Help</span>
      </button>
      <HelpModal open={open} onClose={() => setOpen(false)} />
    </div>
  )

  if (root) return createPortal(node, root)
  return node
}
