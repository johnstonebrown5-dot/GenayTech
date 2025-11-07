import React, { useEffect, useRef } from 'react'
import api from '../api'
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

  // keys per-user to persist last seen across reloads
  const chatKey = user?.id ? `notify:lastChatTs:${user.id}` : null
  const sysKey = user?.id ? `notify:lastSystemTs:${user.id}` : null

  useEffect(()=>{
    if(!user || locked) return
    // initialize last seen from storage
    try{
      if(chatKey){ lastChatTsRef.current = localStorage.getItem(chatKey) || null }
      if(sysKey){ lastSystemTsRef.current = localStorage.getItem(sysKey) || null }
    }catch{}

    const tick = async()=>{
      try{
        // Inbox (direct messages to me)
        const inb = await api.get('/communications/messages/')
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
      }catch{}

      try{
        // System messages (role/broadcast)
        const sys = await api.get('/communications/messages/system/')
        const systemMessages = Array.isArray(sys.data) ? sys.data : (sys.data?.results||[])
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
      }catch{}
    }

    // immediate tick, then interval
    tick()
    timerRef.current = setInterval(tick, 10000)
    return ()=> { if(timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, locked])

  return null
}
