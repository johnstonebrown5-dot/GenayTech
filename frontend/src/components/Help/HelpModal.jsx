import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

export default function HelpModal({ open, onClose }){
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const root = typeof document !== 'undefined' ? document.body : null
  const modal = (
    <div className="fixed inset-0 z-[2200]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-12 -translate-x-1/2 w-[92vw] max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-slate-900">Quick Help</div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-700" aria-label="Close">✕</button>
        </div>
        <div className="p-4">
          <p className="text-slate-700 mb-3">Find common tasks quickly. For full guides, open the Help Center.</p>
          <ul className="space-y-2 text-slate-800">
            <li>
              <a href="/teacher/attendance" className="text-blue-600 hover:underline">Take class attendance</a>
            </li>
            <li>
              <a href="/finance/payments" className="text-blue-600 hover:underline">Record student payment</a>
            </li>
            <li>
              <a href="/admin/fees" className="text-blue-600 hover:underline">Set up class fees</a>
            </li>
            <li>
              <a href="/student/report-card" className="text-blue-600 hover:underline">View report card</a>
            </li>
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <button onClick={()=> navigate('/help')} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Open Help Center</button>
            <button onClick={onClose} className="px-3 py-2 rounded-lg border text-sm">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
  if (!root) return modal
  return createPortal(modal, root)
}
