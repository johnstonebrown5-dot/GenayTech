import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'
import { canRunAuthenticatedPoll, handlePollAuthError } from '../utils/authPoll'
import { useNotification } from './NotificationContext'
import { useAuth } from '../auth'
import { useLock } from './LockProvider'

// Global message notifier: polls inbox and system messages and pops notifications
export default function MessageNotifier(){
  const { user } = useAuth()
  const { locked } = useLock()
  const { showInfo, addNotification } = useNotification()
  const lastChatTsRef = useRef(null)
  const lastSystemTsRef = useRef(null)
  const timerRef = useRef(null)
  const [banner, setBanner] = useState(null)
  const [dismissedBannerId, setDismissedBannerId] = useState(null)
  const [publicBanner, setPublicBanner] = useState(null)
  const [dismissedPublicBannerId, setDismissedPublicBannerId] = useState(null)

  // keys per-user to persist last seen across reloads
  const chatKey = user?.id ? `notify:lastChatTs:${user.id}` : null
  const sysKey = user?.id ? `notify:lastSystemTs:${user.id}` : null
  const bannerDismissKey = user?.id ? `notify:dismissedBannerId:${user.id}` : null
  const publicBannerDismissKey = 'notify:dismissedPublicBannerId'

  const bannerVisible = useMemo(() => {
    if (!banner) return false
    if (!user || locked) return false
    if (dismissedBannerId && String(dismissedBannerId) === String(banner.id)) return false
    if (!String(banner.body || '').trim()) return false
    return true
  }, [banner, dismissedBannerId, locked, user])

  const publicBannerVisible = useMemo(() => {
    if (!publicBanner) return false
    if (locked) return false
    if (dismissedPublicBannerId && String(dismissedPublicBannerId) === String(publicBanner.id)) return false
    return Boolean(String(publicBanner.message || '').trim())
  }, [dismissedPublicBannerId, locked, publicBanner])

  useEffect(() => {
    try {
      setDismissedPublicBannerId(localStorage.getItem(publicBannerDismissKey) || null)
    } catch {}

    let mounted = true
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const res = await api.get('/communications/alerts/banner/', { _skipGlobalLoading: true })
        const data = res?.data || {}
        if (!mounted) return
        const msgText = String(data?.message || '').trim()
        if (data?.id && msgText) {
          setPublicBanner({ id: data.id, message: msgText, created_at: data.created_at || null })
        } else {
          setPublicBanner(null)
        }
      } catch {
        if (!mounted) return
      }
    }

    tick()
    const t = setInterval(tick, 15000)
    const onRefresh = () => { try { tick() } catch {} }
    try { window.addEventListener('alerts:refresh', onRefresh) } catch {}
    return () => {
      mounted = false
      clearInterval(t)
      try { window.removeEventListener('alerts:refresh', onRefresh) } catch {}
    }
  }, [locked])

  useEffect(()=>{
    if(!canRunAuthenticatedPoll(user, locked)) return
    // initialize last seen from storage
    try{
      if(chatKey){ lastChatTsRef.current = localStorage.getItem(chatKey) || null }
      if(sysKey){ lastSystemTsRef.current = localStorage.getItem(sysKey) || null }
      if(bannerDismissKey){ setDismissedBannerId(localStorage.getItem(bannerDismissKey) || null) }
    }catch{}

    let stopped = false
    const stop = () => {
      stopped = true
      if (timerRef.current) clearInterval(timerRef.current)
    }

    const tick = async()=>{
      if (stopped || !canRunAuthenticatedPoll(user, locked)) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try{
        // Inbox (direct messages to me)
        const inb = await api.get('/communications/messages/', { _skipGlobalLoading: true })
        const inbox = Array.isArray(inb.data) ? inb.data : (inb.data?.results||[])
        // Determine newest timestamp
        const latest = inbox.reduce((max, m)=>{
          const ts = new Date(m.created_at).toISOString()
          return ts > max ? ts : max
        }, lastChatTsRef.current || '')

        // Find messages newer than last seen
        const newOnes = inbox.filter(m => {
          const ts = new Date(m.created_at).toISOString()
          // ensure I'm a recipient and it's not read
          const rec = Array.isArray(m.recipients) ? m.recipients.find(r=> r.user === user.id) : null
          return ts && (!lastChatTsRef.current || ts > lastChatTsRef.current) && rec && !rec.read && !m.system_tag
        })
        if(newOnes.length > 0){
          const base = (user?.role === 'admin') ? '/admin/messages'
                     : (user?.role === 'teacher') ? '/teacher/messages'
                     : (user?.role === 'finance') ? '/finance/messages'
                     : (user?.role === 'student') ? '/student/messages'
                     : '/admin/messages'
          if(newOnes.length === 1){
            const m = newOnes[0]
            const fromName = m.sender_detail?.first_name || m.sender_detail?.username || 'New message'
            addNotification({
              type: 'info',
              title: 'New message',
              message: `${fromName}: ${String(m.body||'').slice(0, 120)}`,
              route: `${base}?openUserId=${encodeURIComponent(m.sender)}`,
              duration: 7000,
            })
          } else {
            addNotification({
              type: 'info',
              title: 'New messages',
              message: `You have ${newOnes.length} new messages`,
              route: `${base}`,
              duration: 6000,
            })
          }
        }
        if(latest && latest !== lastChatTsRef.current){
          lastChatTsRef.current = latest
          try{ if(chatKey) localStorage.setItem(chatKey, latest) }catch{}
        }
      }catch(err){
        if (handlePollAuthError(err, stop)) return
      }

      try{
        // System messages (role/broadcast)
        const sys = await api.get('/communications/messages/system/', { _skipGlobalLoading: true })
        const systemMessages = Array.isArray(sys.data) ? sys.data : (sys.data?.results||[])

        // Banner: show latest broadcast Alert message (created via Django admin)
        try{
          const alert = systemMessages
            .filter(m => {
              const tag = String(m?.system_tag || '').trim().toLowerCase()
              return Boolean(tag) && tag === 'alert' && (m?.is_broadcast === true)
            })
            .sort((a,b) => {
              const at = new Date(a?.created_at || 0).getTime()
              const bt = new Date(b?.created_at || 0).getTime()
              return bt - at
            })[0]
          if (alert && alert?.id) {
            setBanner({
              id: alert.id,
              body: String(alert.body || ''),
              created_at: alert.created_at,
            })
          } else {
            setBanner(null)
          }
        } catch {
          setBanner(null)
        }

        const latestSys = systemMessages.reduce((max, m)=>{
          const ts = new Date(m.created_at).toISOString()
          return ts > max ? ts : max
        }, lastSystemTsRef.current || '')
        const newSys = systemMessages.filter(m => {
          const ts = new Date(m.created_at).toISOString()
          const rec = Array.isArray(m.recipients) ? m.recipients.find(r=> r.user === user.id) : null
          return ts && (!lastSystemTsRef.current || ts > lastSystemTsRef.current) && rec && !rec.read
        })
        if(newSys.length > 0){
          const base = (user?.role === 'admin') ? '/admin/messages'
                     : (user?.role === 'teacher') ? '/teacher/messages'
                     : (user?.role === 'finance') ? '/finance/messages'
                     : (user?.role === 'student') ? '/student/messages'
                     : '/admin/messages'
          if(newSys.length === 1){
            const m = newSys[0]
            const tag = m.system_tag || 'System'
            addNotification({
              type: 'info',
              title: `${tag}`,
              message: String(m.body||'').slice(0, 140),
              route: `${base}?tab=system`,
              duration: 7000,
            })
          } else {
            addNotification({
              type: 'info',
              title: 'System updates',
              message: `You have ${newSys.length} new system messages`,
              route: `${base}?tab=system`,
              duration: 6000,
            })
          }
        }
        if(latestSys && latestSys !== lastSystemTsRef.current){
          lastSystemTsRef.current = latestSys
          try{ if(sysKey) localStorage.setItem(sysKey, latestSys) }catch{}
        }
      }catch(err){
        if (handlePollAuthError(err, stop)) return
      }
    }

    const onSessionExpired = () => stop()
    try { window.addEventListener('auth:session-expired', onSessionExpired) } catch {}

    // immediate tick, then interval (15s — was 10s; reduces SIGPIPE noise on server)
    tick()
    timerRef.current = setInterval(tick, 15000)
    return ()=> {
      stopped = true
      if(timerRef.current) clearInterval(timerRef.current)
      try { window.removeEventListener('auth:session-expired', onSessionExpired) } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, locked])

  const dismissBanner = async () => {
    if (!banner || !user?.id) return
    const id = banner.id
    setDismissedBannerId(String(id))
    try{ if (bannerDismissKey) localStorage.setItem(bannerDismissKey, String(id)) }catch{}
    try{
      await api.post(`/communications/messages/${id}/mark-read/`, {}, { _skipGlobalLoading: true })
    }catch{}
  }

  const dismissPublicBanner = () => {
    if (!publicBanner?.id) return
    const id = String(publicBanner.id)
    setDismissedPublicBannerId(id)
    try { localStorage.setItem(publicBannerDismissKey, id) } catch {}
  }

  if (!bannerVisible && !publicBannerVisible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] w-full">
      {publicBannerVisible && (
        <div className="bg-red-600 text-white border-b border-red-700">
          <div className="mx-auto max-w-7xl px-3 py-2 flex items-start gap-3">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-white/15 grid place-items-center text-xs font-black">!</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{String(publicBanner.message || '').trim() || 'System alert'}</div>
            </div>
            <button
              type="button"
              onClick={dismissPublicBanner}
              className="shrink-0 px-2 py-1 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/20"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {bannerVisible && !publicBannerVisible && (
        <div className="bg-red-600 text-white border-b border-red-700">
          <div className="mx-auto max-w-7xl px-3 py-2 flex items-start gap-3">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-white/15 grid place-items-center text-xs font-black">!</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{String(banner.body || '').trim() || 'System alert'}</div>
            </div>
            <button
              type="button"
              onClick={dismissBanner}
              className="shrink-0 px-2 py-1 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/20"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
