import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../auth'

export default function FloatingDeliveryLog(){
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all') // all | sms | email
  const [error, setError] = useState('')
  const intervalRef = useRef(null)
  const lastTopIdRef = useRef(null)
  const initialLoadRef = useRef(true)
  const [hasNew, setHasNew] = useState(false)
  const [paused, setPaused] = useState(false)
  const navigate = useNavigate()
  const [fullOpen, setFullOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [progress, setProgress] = useState({ percent: 0, expected_total: 0, processed_total: 0, sms: { sent: 0, failed: 0 }, email: { sent: 0, failed: 0 } })
  const [lastCampaignId, setLastCampaignId] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [showList, setShowList] = useState(false)
  // Anchor panel to the actual button rendered inside FloatingActions holder
  const btnRef = useRef(null)
  const [panelPos, setPanelPos] = useState({ left: 0, top: 0 })
  const [retryBusy, setRetryBusy] = useState(false)
  const [retryingMap, setRetryingMap] = useState({})
  // Retry mode: reset failed to 0 for selected items, count new failures for those only
  const [retryStart, setRetryStart] = useState(null) // ISO string
  const [retryIds, setRetryIds] = useState([]) // original DeliveryLog ids retried
  const [resetBusy, setResetBusy] = useState(false)
  // Detect and cache the floating actions holder so the FAB mounts there immediately once available
  const [holderEl, setHolderEl] = useState(null)

  const stopOrResume = async () => {
    if (actionBusy) return
    try {
      setActionBusy(true)
      if (!paused) {
        if (lastCampaignId != null) {
          await api.post(`/communications/arrears-campaigns/${lastCampaignId}/cancel/`)
        }
        setPaused(true)
      } else {
        if (lastCampaignId != null) {
          await api.post(`/communications/arrears-campaigns/${lastCampaignId}/resume/`)
        }
        setPaused(false)
      }
    } catch (e) {
      try { console.warn('Stop/Resume failed', e) } catch {}
    } finally {
      setActionBusy(false)
    }
  }

  const role = typeof user?.role === 'string' ? user.role.toLowerCase() : ''
  const canSee = (role === 'admin' || role === 'finance' || !!user?.is_staff)

  const load = async (signal) => {
    if (!canSee) return
    if (paused) return
    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('channel', filter)
      params.set('limit', '50')
      const { data } = await api.get(`/communications/delivery-logs/recent/?${params.toString()}`, { signal })
      const arr = Array.isArray(data) ? data : []
      setItems(arr)
      // Auto-open if new entries appear (scoped by school on backend)
      const topId = arr.length ? arr[0].id : null
      if (topId != null) {
        if (lastTopIdRef.current == null) {
          lastTopIdRef.current = topId
        } else if (topId > lastTopIdRef.current) {
          lastTopIdRef.current = topId
          setHasNew(true)
          if (!open) setOpen(true)
        }
      }
      // also fetch latest campaign progress (ignore if none)
      try {
        const pr = await api.get('/communications/arrears-campaigns/latest-progress/', { signal })
        const p = pr?.data || {}
        const pct = typeof p.percent === 'number' ? Math.max(0, Math.min(100, Math.round(p.percent))) : 0
        setProgress({
          percent: pct,
          expected_total: p.expected_total || 0,
          processed_total: p.processed_total || 0,
          sms: p.sms || { sent: 0, failed: 0 },
          email: p.email || { sent: 0, failed: 0 },
        })
        if (p.campaign != null) setLastCampaignId(p.campaign)
      } catch (e) {
        // 404 -> no active campaign
        setProgress(prev => ({ ...prev, percent: 0 }))
      }
    } catch (e) {
      if (!(e?.name === 'CanceledError' || e?.message?.includes('canceled'))){
        setError('Failed to load logs')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => load(ctrl.signal), 10000)
    return () => { clearInterval(intervalRef.current); ctrl.abort() }
  }, [filter, canSee, paused])

  // Observe DOM to find the floating actions holder as soon as it exists
  useEffect(() => {
    if (typeof document === 'undefined') return
    // If already present, cache and stop
    const existing = document.getElementById('floating-actions-root')
    if (existing && holderEl !== existing) {
      setHolderEl(existing)
      return
    }
    // Otherwise, watch for it to appear
    const obs = new MutationObserver(() => {
      const el = document.getElementById('floating-actions-root')
      if (el) {
        setHolderEl(el)
        try { obs.disconnect() } catch {}
      }
    })
    try { obs.observe(document.body, { childList: true, subtree: true }) } catch {}
    return () => { try { obs.disconnect() } catch {} }
  }, [holderEl])

  const counts = useMemo(() => {
    let smsSent = 0, smsFail = 0, emailSent = 0, emailFail = 0
    for (const it of items) {
      if (it.channel === 'sms') {
        if (it.ok) smsSent++; else smsFail++
      } else if (it.channel === 'email') {
        if (it.ok) emailSent++; else emailFail++
      }
    }
    return { smsSent, smsFail, emailSent, emailFail }
  }, [items])

  const summary = useMemo(() => {
    const smsSent = (progress?.sms?.sent ?? 0) || counts.smsSent
    const smsFail = (progress?.sms?.failed ?? 0) || counts.smsFail
    const emailSent = (progress?.email?.sent ?? 0) || counts.emailSent
    const emailFail = (progress?.email?.failed ?? 0) || counts.emailFail
    return { smsSent, smsFail, emailSent, emailFail }
  }, [progress, counts])
  // Display failed counts under retry mode
  const displayFailed = useMemo(() => {
    if (!retryStart || !Array.isArray(retryIds) || retryIds.length === 0) {
      return { smsFail: summary.smsFail, emailFail: summary.emailFail }
    }
    const since = new Date(retryStart)
    let smsNew = 0, emailNew = 0
    try {
      const wanted = new Set(retryIds.map(Number))
      for (const it of (items || [])){
        if (!it || it.ok !== false) continue
        const t = new Date(it.created_at)
        if (isNaN(t)) continue
        if (t < since) continue
        const ctx = String(it.context || '')
        // Match any retry_of:<id> present in context
        let matches = false
        for (const id of wanted){
          if (ctx.includes(`retry_of:${id}`)) { matches = true; break }
        }
        if (!matches) continue
        if (it.channel === 'sms') smsNew++
        else if (it.channel === 'email') emailNew++
      }
    } catch {}
    return { smsFail: smsNew, emailFail: emailNew }
  }, [summary, retryStart, retryIds, items])

  const barStyle = useMemo(() => {
    const pct = Math.max(0, Math.min(100, Number(progress.percent || 0)))
    // Color shift: 0-49 blue, 50-89 amber, 90-100 green
    let from = '#3b82f6', to = '#06b6d4' // blue -> cyan
    if (pct >= 50 && pct < 90) { from = '#f59e0b'; to = '#f97316' } // amber -> orange
    if (pct >= 90) { from = '#22c55e'; to = '#16a34a' } // green shades
    return {
      pct,
      gradient: `linear-gradient(90deg, ${from} 0%, ${to} 100%)`,
    }
  }, [progress.percent])

  // When panel opens, compute its position near the button, and keep synced on resize/scroll
  const updatePanelPos = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const panelWidth = 384 // 24rem
    const panelHeight = 360 // approx for clamping
    const w = window.innerWidth
    const h = window.innerHeight
    const left = Math.max(8, Math.min(r.left - panelWidth - 12, w - panelWidth - 8))
    const top = Math.max(8, Math.min(Math.round(r.top + r.height/2 - panelHeight/2), h - panelHeight - 8))
    setPanelPos({ left, top })
  }
  useEffect(() => {
    if (!open) return
    updatePanelPos()
    const onEvt = () => updatePanelPos()
    window.addEventListener('resize', onEvt)
    window.addEventListener('scroll', onEvt, true)
    return () => { window.removeEventListener('resize', onEvt); window.removeEventListener('scroll', onEvt, true) }
  }, [open])

  if (!canSee) return null

  const button = (
    <div style={{ position:'relative', pointerEvents:'auto' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(v=>!v)}
        aria-label="Message delivery logs"
        title="Message delivery logs"
        style={{
          width: 44,
          height: 44,
          borderRadius: '9999px',
          border: '1px solid rgba(255,255,255,0.4)',
          background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
          color: 'white',
          boxShadow: '0 8px 22px rgba(59,130,246,0.35)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        {/* mail/sms icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
          <path d="M1.5 6.75A2.25 2.25 0 013.75 4.5h16.5A2.25 2.25 0 0122.5 6.75v10.5A2.25 2.25 0 0120.25 19.5H3.75A2.25 2.25 0 011.5 17.25V6.75z" />
          <path fill="#fff" d="M3 7l9 6 9-6" />
        </svg>
        {hasNew && !open && (
          <span style={{ position:'absolute', top:-2, right:-2 }} className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-pink-500 ring-2 ring-white animate-ping"></span>
        )}
      </button>
      {open && (
        <button
          aria-label="Close delivery logs"
          onClick={(e)=>{ e.stopPropagation(); setOpen(false) }}
          style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:9999, background:'#ef4444', color:'#fff', border:'2px solid #fff', display:'inline-flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}
        >
          ×
        </button>
      )}
    </div>
  )

  const panel = open ? (
    <div style={{ position:'fixed', left: panelPos.left, top: panelPos.top, zIndex:4000 }}>
      <div className="bg-white/80 supports-[backdrop-filter]:bg-white/60 backdrop-blur-xl shadow-2xl ring-1 ring-gray-200/70 rounded-2xl w-[24rem] max-h-[60vh] overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-gray-200/70 flex items-center gap-2 bg-gradient-to-r from-white to-sky-50/60">
          <span className="inline-flex items-center gap-2 font-semibold text-gray-900 text-sm flex-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-700">✉️</span>
            Delivery logs
          </span>
          <select value={filter} onChange={e=>setFilter(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
            <option value="all">All</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
          <button onClick={()=>{ setRetryStart(null); setRetryIds([]); load() }} className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 shadow-sm">Refresh</button>
          <button onClick={()=>{ setOpen(false); setRetryStart(null); setRetryIds([]) }} className="ml-1 text-xs px-2 py-1 rounded-lg bg-white border border-gray-300 hover:bg-gray-50">Close</button>
        </div>
        {/* Progress bar */}
        <div className="px-3 pt-1 pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
            <span>Progress</span>
            <span>{barStyle.pct}%</span>
          </div>
          <div className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden ring-1 ring-gray-200/60">
            <div className="h-full" style={{ width: `${barStyle.pct}%`, background: barStyle.gradient }} />
          </div>
        </div>
        {/* Summary row */}
        <div className="px-3.5 py-2 border-b border-gray-100/80 text-[12px] grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> SMS Sent <span className="ml-1 font-semibold">{summary.smsSent}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Failed <span className="ml-1 font-semibold">{displayFailed.smsFail}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Email Sent <span className="ml-1 font-semibold">{summary.emailSent}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Failed <span className="ml-1 font-semibold">{displayFailed.emailFail}</span>
            </span>
          </div>
        </div>
        {/* Actions */}
        <div className="px-3.5 py-2 border-b border-gray-100/80 flex items-center gap-2">
          <button disabled={actionBusy} onClick={stopOrResume} className={`text-xs px-2.5 py-1 rounded-lg border ${paused ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} ${actionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}>{paused ? 'Resume sending' : 'Stop sending'}</button>
          {/* Bulk retry failed */}
          {(() => {
            const failedIds = (Array.isArray(items) ? items : []).filter(it => it && it.ok === false).map(it => it.id)
            return (
              <button
                disabled={retryBusy || !failedIds.length}
                onClick={async () => {
                  if (!failedIds.length) return
                  setRetryBusy(true)
                  // Enter retry mode: reset failed display to 0 for the selected logs
                  setRetryStart(new Date().toISOString())
                  setRetryIds(failedIds)
                  try { await api.post('/communications/delivery-logs/retry/', { ids: failedIds }); await load() } catch (e) { setError('Retry failed') } finally { setRetryBusy(false) }
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border ${failedIds.length? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100':'bg-white text-gray-400 border-gray-200 cursor-not-allowed'} ${retryBusy ? 'opacity-60 cursor-wait' : ''}`}
                title={failedIds.length? 'Retry failed sends' : 'No failed entries to retry'}
              >{retryBusy? 'Retrying…' : `Retry failed${failedIds.length? ` (${failedIds.length})`: ''}`}</button>
            )
          })()}
          <button
            disabled={resetBusy}
            onClick={async () => {
              try {
                setResetBusy(true)
                await api.post('/communications/delivery-logs/reset/')
                setItems([])
                setProgress({ percent: 0, expected_total: 0, processed_total: 0, sms: { sent: 0, failed: 0 }, email: { sent: 0, failed: 0 } })
                setRetryStart(null); setRetryIds([]); setHasNew(false)
                await load()
              } catch (e) {
                setError('Reset failed')
              } finally {
                setResetBusy(false)
              }
            }}
            className={`text-xs px-2.5 py-1 rounded-lg border ${resetBusy? 'opacity-60 cursor-wait':''} bg-white text-red-600 border-red-200 hover:bg-red-50`}
            title="Reset message logs to zero"
          >{resetBusy? 'Resetting…' : 'Reset'}</button>
          <button onClick={() => setShowList(v=>!v)} className="ml-auto text-xs px-2.5 py-1 rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50">{showList ? 'Hide' : 'View more'}</button>
          <button onClick={() => { setFullOpen(true); setCollapsed(true); setOpen(false); setHasNew(false) }} className="text-xs px-2.5 py-1 rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50">View detailed logs</button>
        </div>
        {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
        {showList && (
        <div className="overflow-y-auto max-h-[50vh] divide-y divide-gray-100">
          {loading && items.length === 0 && (
            <div className="p-3 text-sm text-gray-500">Loading...</div>
          )}
          {(!loading && items.length === 0) && (
            <div className="p-3 text-sm text-gray-500">No recent logs</div>
          )}
          {items.map((it) => (
            <div key={`${it.id}`} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${it.channel === 'sms' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>{it.channel.toUpperCase()}</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${it.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{it.ok ? 'OK' : 'FAIL'}</span>
                <span className="text-xs text-gray-500 ml-auto">{new Date(it.created_at).toLocaleTimeString()}</span>
              </div>
              <div className="mt-1 text-gray-800 truncate">{it.recipient}</div>
              {it.message_snippet && (
                <div className="mt-0.5 text-xs text-gray-600 line-clamp-2">{it.message_snippet}</div>
              )}
              <div className="mt-1 flex items-center gap-2">
                {it.context && (
                  <span className="text-[11px] text-gray-400 truncate">{it.context}</span>
                )}
                {retryStart && (retryIds||[]).includes(it.id) && (
                  <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Queued</span>
                )}
                {!it.ok && (
                  <button
                    onClick={async () => {
                      setRetryingMap(prev => ({ ...prev, [it.id]: true }))
                      // Per-item retry mode
                      setRetryStart(new Date().toISOString())
                      setRetryIds(prev => Array.from(new Set([...(prev||[]), it.id])))
                      try { await api.post('/communications/delivery-logs/retry/', { id: it.id }); await load() } catch (e) { setError('Retry failed') } finally { setRetryingMap(prev => ({ ...prev, [it.id]: false })) }
                    }}
                    disabled={!!retryingMap[it.id]}
                    className={`ml-auto text-xs px-2 py-0.5 rounded border ${retryingMap[it.id] ? 'opacity-60 cursor-wait' : 'bg-white hover:bg-gray-50'} border-gray-300 text-gray-700`}
                  >{retryingMap[it.id] ? 'Retrying…' : 'Retry'}</button>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      {holderEl
        ? createPortal(button, holderEl)
        : createPortal(
            <div style={{ position:'fixed', right:16, bottom:24, zIndex:4000 }}>{button}</div>,
            document.body
          )}
      {panel && createPortal(panel, document.body)}
      {fullOpen && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:5000 }}>
          <div onClick={()=>setFullOpen(false)} className="fixed inset-0 bg-black/40" />
          {/* Collapsed tag at bottom-right */}
          {collapsed ? (
            <div className="fixed right-4 bottom-4">
              <div className="bg-white shadow-2xl ring-1 ring-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">SMS Sent: <span className="ml-1 font-semibold">{summary.smsSent}</span></span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Failed: <span className="ml-1 font-semibold">{summary.smsFail}</span></span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Email Sent: <span className="ml-1 font-semibold">{summary.emailSent}</span></span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Failed: <span className="ml-1 font-semibold">{summary.emailFail}</span></span>
                <span className="ml-2 text-[11px] text-gray-600">{progress.percent}%</span>
                <button onClick={(e)=>{ e.stopPropagation(); setCollapsed(false) }} className="ml-2 text-xs px-2 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50">Expand</button>
                <button onClick={(e)=>{ e.stopPropagation(); setFullOpen(false) }} className="text-xs px-2 py-1 rounded border bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200">Close</button>
              </div>
            </div>
          ) : (
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="bg-white shadow-2xl ring-1 ring-gray-200 rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Delivery logs</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">SMS Sent: <span className="ml-1 font-semibold">{summary.smsSent}</span></span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Failed: <span className="ml-1 font-semibold">{summary.smsFail}</span></span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Email Sent: <span className="ml-1 font-semibold">{summary.emailSent}</span></span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Failed: <span className="ml-1 font-semibold">{summary.emailFail}</span></span>
                    <button onClick={()=>setCollapsed(true)} className="text-xs px-2.5 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50">Collapse</button>
                    <button onClick={()=>setFullOpen(false)} className="text-xs px-2.5 py-1 rounded border bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200">Close</button>
                  </div>
                </div>
                <div className="px-4 pt-2 pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between text-[12px] text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{barStyle.pct}% ({progress.processed_total}/{progress.expected_total})</span>
                  </div>
                  <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden ring-1 ring-gray-200/60">
                    <div className="h-full" style={{ width: `${barStyle.pct}%`, background: barStyle.gradient }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/90 mix-blend-difference">
                      {barStyle.pct}%
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <button disabled={actionBusy} onClick={stopOrResume} className={`text-xs px-2.5 py-1 rounded border ${paused ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} ${actionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}>{paused ? 'Resume sending' : 'Stop sending'}</button>
                  <select value={filter} onChange={e=>setFilter(e.target.value)} className="ml-auto text-sm border border-gray-300 rounded px-2 py-1">
                    <option value="all">All</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                  <button onClick={()=>load()} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Refresh</button>
                </div>
                <div className="overflow-y-auto max-h-[60vh] divide-y divide-gray-100">
                  {loading && items.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">Loading...</div>
                  )}
                  {(!loading && items.length === 0) && (
                    <div className="p-4 text-sm text-gray-500">No recent logs</div>
                  )}
                  {items.map(it => (
                    <div key={it.id} className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${it.channel === 'sms' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>{it.channel.toUpperCase()}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${it.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{it.ok ? 'OK' : 'FAIL'}</span>
                        <span className="text-xs text-gray-500 ml-auto">{new Date(it.created_at).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-gray-800 truncate">{it.recipient}</div>
                      {it.message_snippet && (
                        <div className="mt-0.5 text-xs text-gray-600 line-clamp-2">{it.message_snippet}</div>
                      )}
                      {it.context && (
                        <div className="mt-0.5 text-[11px] text-gray-400">{it.context}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

