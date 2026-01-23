import React, { useEffect, useRef } from 'react'

export default function Modal({ open, onClose, title, children, size = 'md' }){
  const dialogRef = useRef(null)
  const sentinelStart = useRef(null)
  const sentinelEnd = useRef(null)
  const closeRef = useRef(onClose)

  // keep latest onClose without re-running main effect
  useEffect(()=>{ closeRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      // Only act on events originating within the dialog
      const withinDialog = dialogRef.current && dialogRef.current.contains(document.activeElement)
      if (e.key === 'Escape') { closeRef.current?.(); return }
      if (e.key !== 'Tab' || !withinDialog) return
      // Simple focus trap
      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault(); last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // initial focus (prefer input/select/textarea then primary button)
    setTimeout(() => {
      if (!dialogRef.current) return
      // If focus is already inside the dialog (e.g., user clicked a field), don't override it
      if (dialogRef.current.contains(document.activeElement)) return
      const preferred = dialogRef.current.querySelector('input, select, textarea')
      const fallback = dialogRef.current.querySelector('button:not([data-modal-close])')
      const target = preferred || fallback || dialogRef.current
      target.focus()
    }, 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  const isFull = size === 'full'
  const sizeClass = isFull
    ? 'w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-xl rounded-none md:rounded'
    : (size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : size === 'sm' ? 'max-w-md' : 'max-w-xl')

  return (
    <div className={`fixed inset-0 z-50 flex ${isFull ? 'items-stretch justify-stretch' : 'items-center justify-center'}`}>
      <div className="absolute inset-0 bg-black/40 opacity-0 animate-fadeIn" onClick={onClose} />
      <span ref={sentinelStart} tabIndex={0} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`relative bg-white ${isFull ? 'shadow-none' : 'shadow-lg'} w-full ${sizeClass} transform scale-95 opacity-0 animate-zoomIn ${isFull ? 'flex flex-col' : 'rounded p-4 max-h-[90vh]'}`}
      >
        <div className={`flex items-center justify-between ${isFull ? 'px-4 py-3 border-b sticky top-0 bg-white z-10' : 'mb-3'}`}>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded" aria-label="Close" data-modal-close>✖</button>
        </div>
        <div className={`${isFull ? 'flex-1 overflow-auto px-4 pb-4' : 'overflow-auto max-h-[75vh] pr-1'}`}>
          {children}
        </div>
      </div>
      <span ref={sentinelEnd} tabIndex={0} />
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
        .animate-fadeIn { animation: fadeIn 120ms ease-out forwards }
        .animate-zoomIn { animation: zoomIn 150ms ease-out forwards }
      `}</style>
    </div>
  )
}
