import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2, Search, User, ShieldAlert, Check, CheckCheck } from 'lucide-react'
import api from '../api'
import { useNotification } from '../components/NotificationContext'
import { useAuth } from '../auth'

// Global cache for users to persist across navigations
let __usersCache = null;
let __messagesCache = null;

export default function Messages(){
  const { user } = useAuth()
  const { showSuccess, showError } = useNotification()
  const location = useLocation()
  const [inbox, setInbox] = useState([])
  const [outbox, setOutbox] = useState([])
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingSystem, setLoadingSystem] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [query, setQuery] = useState('')
  const [activeUser, setActiveUser] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [fileToSend, setFileToSend] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [viewTab, setViewTab] = useState('chats') // chats | system | role | broadcast (admin only)
  const [roleTarget, setRoleTarget] = useState('teacher')
  const [roleMessage, setRoleMessage] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAdmin && (viewTab === 'role' || viewTab === 'broadcast')) {
      setViewTab('chats')
    }
  }, [isAdmin, viewTab])

  // Load from cache immediately
  useEffect(() => {
    if (__usersCache) setAllUsers(__usersCache);
    if (__messagesCache) {
      setInbox(__messagesCache.inbox || []);
      setOutbox(__messagesCache.outbox || []);
      setSystemMessages(__messagesCache.system || []);
      setLoading(false);
    }
  }, []);

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'finance', label: 'Finance' },
    { value: 'student', label: 'Student' },
  ]

  // Load inbox + outbox
  const [isSyncing, setIsSyncing] = useState(false)
  const loadMessages = async (silent = true) => {
    if (silent) setIsSyncing(true)
    else setLoading(true)
    setLoadingMessages(true)
    try {
      const [inb, out] = await Promise.all([
        api.get('/communications/messages/', { timeout: 10000, _skipGlobalLoading: true }),
        api.get('/communications/messages/outbox/', { timeout: 10000, _skipGlobalLoading: true }),
      ])
      const iData = Array.isArray(inb.data) ? inb.data : (inb.data?.results||[])
      const oData = Array.isArray(out.data) ? out.data : (out.data?.results||[])
      setInbox(iData)
      setOutbox(oData)
      __messagesCache = { ...(__messagesCache || {}), inbox: iData, outbox: oData }
    } finally {
      if (silent) setIsSyncing(false)
      else setLoading(false)
      setLoadingMessages(false)
    }
  }

  // System messages
  const [systemMessages, setSystemMessages] = useState([])
  const loadSystem = async () => {
    setLoadingSystem(true)
    try {
      const res = await api.get('/communications/messages/system/', { timeout: 10000, _skipGlobalLoading: true })
      const sData = Array.isArray(res.data) ? res.data : (res.data?.results||[])
      setSystemMessages(sData)
      __messagesCache = { ...(__messagesCache || {}), system: sData }
    } catch {
      setSystemMessages([])
    } finally {
      setLoadingSystem(false)
    }
  }

  // Load users list by query (scoped to current school by backend)
  const loadUsers = async (q='') => {
    if (loadingUsers) return;
    setLoadingUsers(true)
    try {
      // Use directory search for speed if there is a query, otherwise fetch full list with large page size
      const { data } = await api.get('/auth/users/', { 
        params: { q, page_size: q ? 50 : 500, include_orphans: 1 },
        timeout: 10000,
        _skipGlobalLoading: true
      })
      
      const batch = Array.isArray(data) ? data : (data?.results || data?.users || [])
      const filtered = batch.filter(u => u.id !== user?.id)
      
      if (!q) {
        setAllUsers(filtered)
        __usersCache = filtered
      } else {
        // When searching, merge with existing cache to keep current chat users visible
        setAllUsers(prev => {
          const merged = [...prev];
          filtered.forEach(u => {
            if (!merged.find(m => m.id === u.id)) merged.push(u);
          });
          return merged;
        });
      }
    } catch {
      if (!__usersCache) setAllUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => { loadMessages(false); loadUsers(''); loadSystem() }, [])
  // Merge message participants (from inbox/outbox) into allUsers so deep-links can resolve
  useEffect(() => {
    if ((!Array.isArray(inbox) || inbox.length === 0) && (!Array.isArray(outbox) || outbox.length === 0)) return
    const byId = new Map((allUsers||[]).map(u => [u.id, u]))
    // from inbound messages: sender_detail
    for (const m of inbox || []){
      const d = m?.sender_detail
      if (d && d.id && !byId.has(d.id)) byId.set(d.id, d)
    }
    // from outbound messages: recipients[].user_detail
    for (const m of outbox || []){
      const recs = Array.isArray(m?.recipients) ? m.recipients : []
      for (const r of recs){
        const d = r?.user_detail
        const id = r?.user || d?.id
        if (id && !byId.has(id)) byId.set(id, d || { id })
      }
    }
    const merged = Array.from(byId.values()).filter(Boolean)
    // Only update if there is any new id
    if (merged.length !== (allUsers||[]).length){
      setAllUsers(merged)
    }
  }, [inbox, outbox])
  // Deep-linking: open user or switch tab via query params
  const desiredUserIdRef = useRef(null)
  useEffect(() => {
    try{
      const sp = new URLSearchParams(location.search)
      const tab = sp.get('tab')
      const openUserId = sp.get('openUserId')
      if (tab === 'system') setViewTab('system')
      if (openUserId) {
        const idNum = Number(openUserId)
        if(!Number.isNaN(idNum)){
          desiredUserIdRef.current = idNum
        }
      }
    }catch{}
  }, [location.search])
  // When users list loads/changes, apply desired open user if any
  useEffect(() => {
    if(!desiredUserIdRef.current) return
    const target = allUsers.find(u => u.id === desiredUserIdRef.current)
    if (target){
      setActiveUser(target)
      setViewTab('chats')
      desiredUserIdRef.current = null
      return
    }
    // Fallback: try derive from inbox/outbox details without waiting for directory
    const fromInbox = (inbox||[]).find(m => m.sender === desiredUserIdRef.current)?.sender_detail
    if (fromInbox && fromInbox.id){
      setActiveUser(fromInbox)
      setViewTab('chats')
      desiredUserIdRef.current = null
      return
    }
    // Fallback 2: from outbox recipients
    for (const m of outbox || []){
      const hit = (m.recipients||[]).find(r => r.user === desiredUserIdRef.current)
      if (hit){
        const u = hit.user_detail || { id: hit.user }
        setActiveUser(u)
        setViewTab('chats')
        desiredUserIdRef.current = null
        return
      }
    }
  }, [allUsers])
  // Background refresh of user directory every 60s
  useEffect(() => {
    const id = setInterval(() => loadUsers(''), 60000)
    return () => clearInterval(id)
  }, [])

  // Build conversation with a selected user by combining inbox/outbox
  const conversation = useMemo(() => {
    if (!activeUser) return []
    const mineId = user?.id
    const partnerId = activeUser.id
    const inbound = inbox.filter(m => m.sender === partnerId)
    const outbound = outbox.filter(m => Array.isArray(m.recipients) && m.recipients.some(r => r.user === partnerId))
    const all = [...inbound, ...outbound]
    all.sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    return all
  }, [activeUser, inbox, outbox, user])

  // Compute per-user last message and unread counts
  const userMeta = useMemo(() => {
    const meta = new Map()
    const add = (uId, msg, mine) => {
      const cur = meta.get(uId) || { last: null, unread: 0 }
      if (!cur.last || new Date(msg.created_at) > new Date(cur.last.created_at)) cur.last = msg
      // unread only counts inbound messages where I'm a recipient and not read
      if (!mine && Array.isArray(msg.recipients)){
        const r = msg.recipients.find(x => x.user === user?.id)
        if (r && !r.read) cur.unread += 1
      }
      meta.set(uId, cur)
    }
    // Inbound: sender is other user
    inbox.forEach(m => add(m.sender, m, false))
    // Outbound: recipients include other user
    outbox.forEach(m => (m.recipients||[]).forEach(r => add(r.user, m, true)))
    return meta
  }, [inbox, outbox, user])

  // Presence (client-only heuristic): online if last activity within 10 minutes
  const presenceMap = useMemo(() => {
    const m = new Map()
    const now = Date.now()
    const base = allUsers
    base.forEach(u => {
      const um = userMeta.get(u.id)
      const lastTs = um?.last ? new Date(um.last.created_at).getTime() : 0
      m.set(u.id, (now - lastTs) < 10*60*1000)
    })
    return m
  }, [allUsers, userMeta])

  // Helpers for display names and role tags
  const roleLabelMap = { admin: 'Admin', teacher: 'Teacher', finance: 'Finance', student: 'Student', non_teaching: 'Staff' }
  const roleBadgeClass = (role)=>{
    switch(role){
      case 'admin': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'teacher': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'finance': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'student': return 'bg-amber-50 text-amber-700 border-amber-200'
      default: return 'bg-gray-50 text-gray-600 border-gray-200'
    }
  }
  const displayFullName = (u)=>{
    const first = u?.first_name || ''
    const last = u?.last_name || ''
    const full = `${first} ${last}`.trim()
    const alt = u?.student_name || ''
    return full || alt || u?.username || u?.email || `User #${u?.id}`
  }
  const avatarUrl = (u)=> u?.avatar_url || u?.profile_image_url || u?.profile_photo_url || u?.photo_url || u?.image_url || u?.avatar || ''
  const initials = (u)=>{
    const f = (u?.first_name||u?.username||'').trim()
    const l = (u?.last_name||'').trim()
    return `${f.charAt(0)||''}${l.charAt(0)||''}`.toUpperCase() || 'U'
  }
  const formatMsgTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    return sameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  const outgoingStatus = (m) => {
    const recs = Array.isArray(m?.recipients) ? m.recipients : []
    if (recs.length === 0) return 'sent'
    const anyRead = recs.some(r => r && r.read)
    if (anyRead) return 'read'
    return 'delivered'
  }
  // Attachment helpers
  const getAttachmentUrl = (m)=> m?.attachment_url || m?.file_url || m?.media_url || m?.attachment || m?.file || ''
  const isImageUrl = (url)=> typeof url === 'string' && /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.bmp)$/i.test(url)

  // Cloudinary config and helper (inside component so it can access state setters)
  const CLOUDINARY_CLOUD = 'dfjntwelp'
  const CLOUDINARY_UPLOAD_PRESET = 'edutrack_unsigned'
  const uploadImageToCloudinary = async (file) => {
    if (!file || !file.type?.startsWith('image/')) throw new Error('Only image uploads are allowed')
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    fd.append('folder', 'edutrack/messages')
    setUploading(true); setUploadProgress(0)
    const res = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded/e.total)*100)) }
      xhr.onload = () => {
        try { resolve({ status: xhr.status, data: JSON.parse(xhr.responseText) }) } catch (e) { reject(e) }
      }
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.send(fd)
    })
    setUploading(false)
    if (res.status>=200 && res.status<300 && res.data?.secure_url){
      return res.data.secure_url
    }
    throw new Error('Cloudinary upload error')
  }

  // Aggregate unread counts for tabs
  const chatsUnread = useMemo(() => {
    const myId = user?.id
    if (!Array.isArray(inbox) || !myId) return 0
    return inbox.reduce((acc, m) => {
      // Only non-system messages counted in Chats
      if (m && !m.system_tag && Array.isArray(m.recipients)){
        const rec = m.recipients.find(r => r.user === myId)
        if (rec && !rec.read) return acc + 1
      }
      return acc
    }, 0)
  }, [inbox, user])

  const systemUnread = useMemo(() => {
    const myId = user?.id
    if (!Array.isArray(systemMessages) || !myId) return 0
    return systemMessages.reduce((acc, m) => {
      if (Array.isArray(m.recipients)){
        const rec = m.recipients.find(r => r.user === myId)
        if (rec && !rec.read) return acc + 1
      }
      return acc
    }, 0)
  }, [systemMessages, user])

  // Filter and sort users. WhatsApp-like: by default show only recent chats ordered by latest message.
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allUsers
    return allUsers.filter(u => {
      const first = (u.first_name || '').toLowerCase()
      const last = (u.last_name || '').toLowerCase()
      const username = (u.username || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      const roleLbl = (roleLabelMap[u.role] || u.role || '').toLowerCase()
      const admission = ((u.admission_no || u.student_admission_no || '') + '').toLowerCase()
      return (
        first.includes(q) ||
        last.includes(q) ||
        username.includes(q) ||
        email.includes(q) ||
        roleLbl.includes(q) ||
        admission.includes(q)
      )
    })
  }, [allUsers, query])

  const sortedUsers = useMemo(() => {
    const q = query.trim()
    // Helper to get timestamp and unread
    const metaTs = (id)=> userMeta.get(id)?.last?.created_at ? new Date(userMeta.get(id).last.created_at).getTime() : 0
    const metaUnread = (id)=> userMeta.get(id)?.unread || 0

    if (!q){
      // No search: show ALL users. Put recent conversations first, followed by the rest alphabetically.
      const recentIds = new Set(Array.from(userMeta.keys()))
      const recentUsers = Array.from(recentIds)
        .map(id => filteredUsers.find(u => u.id === id) || allUsers.find(u => u.id === id))
        .filter(Boolean)
      recentUsers.sort((a,b)=> metaTs(b.id) - metaTs(a.id))
      // Remaining directory excluding recent
      const rest = filteredUsers
        .filter(u => !recentIds.has(u.id))
        .sort((a,b)=>{
          const na = (a.first_name || a.username || '').toLowerCase()
          const nb = (b.first_name || b.username || '').toLowerCase()
          return na.localeCompare(nb)
        })
      return [...recentUsers, ...rest]
    }
    // With search: show directory matches, but sort by latest desc, then unread, then name
    const arr = [...filteredUsers]
    arr.sort((a,b)=>{
      const lb = metaTs(b.id)
      const la = metaTs(a.id)
      if (lb !== la) return lb - la
      const ub = metaUnread(b.id)
      const ua = metaUnread(a.id)
      if (ub !== ua) return ub - ua
      const na = (a.first_name || a.username || '').toLowerCase()
      const nb = (b.first_name || b.username || '').toLowerCase()
      return na.localeCompare(nb)
    })
    return arr
  }, [allUsers, filteredUsers, query, userMeta])

  // Typing simulation (client-only): show typing for partner occasionally while chat is open
  const [typingMap, setTypingMap] = useState(new Map())
  const [showUsersMobile, setShowUsersMobile] = useState(false)
  // Forwarding state (admin only)
  const [forwardSource, setForwardSource] = useState(null) // message object
  const [forwardRecipients, setForwardRecipients] = useState([]) // ids
  const [showForwardModal, setShowForwardModal] = useState(false)
  useEffect(() => {
    if (!activeUser) return
    const id = setInterval(() => {
      setTypingMap(prev => {
        const nm = new Map(prev)
        // 1 in 6 chance to toggle typing for 2s
        if (Math.random() < 0.16){
          nm.set(activeUser.id, true)
          setTimeout(() => {
            setTypingMap(pp => { const mm = new Map(pp); mm.set(activeUser.id, false); return mm })
          }, 2000)
        }
        return nm
      })
    }, 5000)
    return () => clearInterval(id)
  }, [activeUser])

  // On mobile, default to users list (inline) when no active chat selected
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640 && !activeUser && viewTab !== 'system') {
      setShowUsersMobile(false)
    }
  }, [activeUser, viewTab])

  // Mark as read for any messages in this conversation where I'm a recipient and not read
  useEffect(() => {
    if (!activeUser || !conversation.length) return
    const toMark = conversation.filter(m => Array.isArray(m.recipients) && m.recipients.some(r => r.user === user?.id && !r.read))
    if (toMark.length === 0) return
    ;(async () => {
      for (const m of toMark) {
        try { await api.post(`/communications/messages/${m.id}/mark-read/`) } catch {}
      }
      // Refresh inbox to reflect read changes
      await loadMessages()
    })()
  }, [activeUser, conversation, user])

  // Mark system messages as read when viewing the System tab
  useEffect(() => {
    if (viewTab !== 'system' || systemMessages.length === 0) return
    ;(async () => {
      const unread = systemMessages.filter(m => Array.isArray(m.recipients) && m.recipients.some(r => r.user === user?.id && !r.read))
      for (const m of unread) {
        try { await api.post(`/communications/messages/${m.id}/mark-read/`) } catch {}
      }
      await loadSystem()
      await loadMessages(true)
    })()
  }, [viewTab, systemMessages, user])

  // Light polling to keep conversation fresh while open
  useEffect(() => {
    if (viewTab === 'system'){
      const id = setInterval(() => loadSystem(), 10000)
      return () => clearInterval(id)
    }
    if (!activeUser) return
    const id = setInterval(() => loadMessages(true), 10000)
    return () => clearInterval(id)
  }, [activeUser, viewTab])

  const sendToActive = async (e) => {
    e.preventDefault()
    const targetIds = (forwardRecipients && forwardRecipients.length>0) ? forwardRecipients : (activeUser? [activeUser.id] : [])
    if (targetIds.length===0 || (!message.trim() && !fileToSend)) return
    setSending(true)
    try {
      const multiChannel = {
        // Ensure messages authored here are forwarded via SMS + Email (backend will apply role-based rules too)
        send_sms: true,
        send_email: true,
      }
      // If image is selected, ensure it is uploaded to Cloudinary first, then send URL to backend
      if (fileToSend){
        if (!fileToSend.type?.startsWith('image/')) {
          throw new Error('Only image files are allowed')
        }
        let url = uploadedUrl
        if (!url) { url = await uploadImageToCloudinary(fileToSend); setUploadedUrl(url) }
        let sent = false; let lastErr = null
        const base = { body: message || '', audience: 'users', recipient_ids: targetIds, ...multiChannel }
        const urlFields = ['attachment_url','file_url','media_url','image_url','attachment','file','media','image']
        for (const f of urlFields){
          try {
            const payload = { ...base, [f]: url }
            await api.post('/communications/messages/', payload)
            sent = true; break
          } catch (err) { lastErr = err; try{ console.error('Send with URL failed', { field:f, status: err?.response?.status, data: err?.response?.data }) }catch{} }
        }
        if (!sent) throw lastErr || new Error('Send failed')
      } else {
        await api.post('/communications/messages/', {
          body: message,
          audience: 'users',
          recipient_ids: targetIds,
          ...multiChannel,
        })
      }
      setMessage('')
      setFileToSend(null)
      setUploadedUrl('')
      if (filePreview){ URL.revokeObjectURL(filePreview); setFilePreview(null) }
      setForwardSource(null)
      setForwardRecipients([])
      await loadMessages(true)
      showSuccess('Message sent', `Your message to ${activeUser.first_name || activeUser.username} was sent.`)
    } catch (e) {
      const serverMsg = e?.response?.data?.detail || e?.response?.data?.error || e?.response?.data?.message
      const msg = serverMsg || e?.message || 'Failed to send'
      showError('Send failed', msg)
    } finally { setSending(false) }
  }

  const sendRole = async (e) => {
    e.preventDefault()
    if (!roleMessage.trim()) return
    try {
      await api.post('/communications/messages/', { body: roleMessage, audience: 'role', recipient_role: roleTarget })
      setRoleMessage('')
      await loadMessages(true)
      setViewTab('chats')
      showSuccess('Role message sent', `Delivered to ${roleTarget} role recipients.`)
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to send role message'
      showError('Send failed', msg)
    }
  }

  const sendBroadcast = async (e) => {
    e.preventDefault()
    if (!broadcastMessage.trim()) return
    try {
      await api.post('/communications/messages/', { body: broadcastMessage, audience: 'all' })
      setBroadcastMessage('')
      await loadMessages(true)
      setViewTab('chats')
      showSuccess('Broadcast sent', 'Your announcement was queued for delivery to all users in the school.')
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to broadcast'
      showError('Broadcast failed', msg)
    }
  }

  // Chat scroll management
  const chatRef = useRef(null)
  const atBottomRef = useRef(true)
  const messageInputRef = useRef(null)
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const onScroll = () => {
      const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 40
      atBottomRef.current = nearBottom
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-grow textarea for composer
  useEffect(() => {
    const t = messageInputRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 136) + 'px' // up to ~6 lines
  }, [message])

  // When conversation updates: auto-scroll only if user is already near bottom or last message is mine
  const lastMsg = conversation.length ? conversation[conversation.length - 1] : null
  useEffect(() => {
    const el = chatRef.current
    if (!el || !lastMsg) return
    const mine = lastMsg.sender === user?.id
    if (mine || atBottomRef.current) {
      // scroll smoothly to bottom
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [conversation.length])

  return (
    <div className="messages-page mx-auto max-w-6xl w-full h-[calc(100vh-5rem)] bg-white md:bg-white md:border md:rounded-2xl overflow-hidden flex md:shadow-card">
      {/* Left: Users list */}
      <aside className={`w-full sm:w-80 border-r flex-col md:bg-white overflow-hidden ${activeUser || viewTab === 'system' ? 'hidden sm:flex' : 'flex'}`}>
        <div className="flex flex-col p-4 border-b bg-white sticky top-0 z-20">
          <h1 className="text-xl font-bold text-slate-900 mb-4">Messages</h1>
          <div className="flex p-1 bg-slate-100 rounded-xl flex-wrap gap-1">
            <button
              onClick={() => setViewTab('chats')}
              className={`flex-1 min-w-[120px] px-3 py-2 text-sm font-medium rounded-lg transition-all ${viewTab === 'chats' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>Personal</span>
                {chatsUnread > 0 && (
                  <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {chatsUnread > 99 ? '99+' : chatsUnread}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setViewTab('system')}
              className={`flex-1 min-w-[120px] px-3 py-2 text-sm font-medium rounded-lg transition-all ${viewTab === 'system' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>System</span>
                {systemUnread > 0 && (
                  <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {systemUnread > 99 ? '99+' : systemUnread}
                  </span>
                )}
              </div>
            </button>

            {isAdmin && (
              <button
                onClick={() => { setActiveUser(null); setViewTab('role') }}
                className={`flex-1 min-w-[120px] px-3 py-2 text-sm font-medium rounded-lg transition-all ${viewTab === 'role' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>User Roles</span>
                </div>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => { setActiveUser(null); setViewTab('broadcast') }}
                className={`flex-1 min-w-[120px] px-3 py-2 text-sm font-medium rounded-lg transition-all ${viewTab === 'broadcast' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Broadcast</span>
                </div>
              </button>
            )}
          </div>
        </div>
        
        <div className="p-3 border-b bg-white">
          <div className="relative">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search conversations..."
              autoComplete="off"
              className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          {isAdmin && (viewTab === 'role' || viewTab === 'broadcast') && (
            <div className="p-2 border-b bg-slate-50">
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button onClick={() => setViewTab('role')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium border ${viewTab === 'role' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>Role Msg</button>
                <button onClick={() => setViewTab('broadcast')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium border ${viewTab === 'broadcast' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>Broadcast</button>
              </div>
            </div>
          )}
          {viewTab === 'chats' && (
            <div className="flex-1 overflow-y-auto md:pt-1">
              {loadingUsers && (
                <div className="p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Fetching users…</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="mx-2 rounded-xl border border-slate-100 p-3 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100" />
                          <div className="flex-1">
                            <div className="h-3 w-32 bg-slate-100 rounded" />
                            <div className="mt-2 h-2 w-44 bg-slate-100 rounded" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!loadingUsers && sortedUsers.map(u => {
                const isActive = activeUser?.id === u.id
                const meta = userMeta.get(u.id)
                const lastText = meta?.last?.body ? String(meta.last.body).slice(0, 50) : ''
                const unread = meta?.unread || 0
                const online = presenceMap.get(u.id)
                const typing = typingMap.get(u.id)
                const lastTime = meta?.last?.created_at ? new Date(meta.last.created_at) : null
                const fmtTime = (d) => {
                  if (!d) return ''
                  const now = new Date()
                  const sameDay = d.toDateString() === now.toDateString()
                  return sameDay ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString()
                }
                return (
                  <button
                    key={u.id}
                    onClick={()=>{ setActiveUser(u); setViewTab('chats') }}
                    className={`messages-user-row w-full text-left px-3 py-2 border-b hover:bg-gray-50 md:rounded-xl md:mx-2 md:my-1 md:border md:border-gray-100 md:hover:border-gray-200 md:hover:bg-gray-50/80 ${isActive? 'messages-user-row--active bg-blue-50 md:border-blue-200':''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-xs text-gray-600">
                          {avatarUrl(u) ? (
                            <img src={avatarUrl(u)} alt={displayFullName(u)} className="w-full h-full object-cover" />
                          ) : (
                            <span>{initials(u)}</span>
                          )}
                        </div>
                        <span className={`w-2 h-2 rounded-full ${online? 'bg-emerald-500':'bg-gray-300'}`}></span>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">{displayFullName(u)}</div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${roleBadgeClass(u.role)}`}>{roleLabelMap[u.role] || u.role}</span>
                        </div>
                      </div>
                      {unread>0 && (
                        <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{unread}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500 truncate">
                        {typing ? <span className="text-emerald-600">typing…</span> : (lastText || <span className="italic text-gray-400">No messages</span>)}
                      </div>
                      {lastTime && (
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtTime(lastTime)}</span>
                      )}
                    </div>
                  </button>
                )
              })}
              {!loadingUsers && sortedUsers.length===0 && (
                <div className="p-3 text-sm text-gray-500">No messages yet. Add users to start messaging.</div>
              )}
            </div>
          )}
        </div>

        {isAdmin && viewTab === 'role' && (
          <form onSubmit={sendRole} className="p-3 space-y-2">
            <label className="text-xs text-gray-600">Send to role</label>
            <select className="w-full border rounded px-2 py-1" value={roleTarget} onChange={e=>setRoleTarget(e.target.value)}>
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <textarea className="w-full border rounded px-3 py-2 min-h-[120px]" value={roleMessage} onChange={e=>setRoleMessage(e.target.value)} placeholder="Type your message..."/>
            <button className="w-full px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!roleMessage.trim()}>Send</button>
          </form>
        )}

        {isAdmin && viewTab === 'broadcast' && (
          <form onSubmit={sendBroadcast} className="p-3 space-y-3 md:bg-gray-50 md:m-3 md:rounded-xl md:border md:border-gray-200">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Broadcast Announcement</label>
              <p className="text-[11px] text-gray-500 leading-tight">
                This message will be sent instantly to <strong>everyone</strong> in the school via:
                <span className="flex items-center gap-2 mt-1 font-medium text-blue-600">
                  <span>&bull; In-app Message</span>
                  <span>&bull; SMS</span>
                  <span>&bull; Email</span>
                </span>
              </p>
            </div>
            <textarea 
              className="w-full border rounded-xl px-3 py-2 min-h-[140px] focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all" 
              value={broadcastMessage} 
              onChange={e=>setBroadcastMessage(e.target.value)} 
              placeholder="Type your announcement here..."
            />
            <button 
              className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm shadow-blue-200 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2" 
              disabled={!broadcastMessage.trim() || sending}
            >
              {sending ? (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              ) : '🚀 Send Broadcast'}
            </button>
          </form>
        )}
      </aside>

      {/* Right: Chat thread or System feed */}
      <section className={`relative flex-1 flex flex-col overflow-hidden h-full ${!activeUser && viewTab !== 'system' ? 'hidden sm:flex' : 'flex'}`}>
        {/* Chat header */}
        <div className="h-14 px-3 sm:px-4 flex items-center justify-between sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm backdrop-blur-md bg-white/90">
          <div className="flex items-center gap-3">
            {(activeUser || viewTab === 'system') && (
              <button 
                className="sm:hidden p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors" 
                onClick={() => { setActiveUser(null); if(viewTab === 'system') setViewTab('chats') }} 
                aria-label="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {viewTab === 'system' ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">System Notifications</div>
                  <div className="text-[10px] text-emerald-600 font-medium">Live Feed</div>
                </div>
              </div>
            ) : activeUser ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 ring-2 ring-white shadow-sm flex items-center justify-center text-xs text-slate-600">
                  {avatarUrl(activeUser) ? (
                    <img src={avatarUrl(activeUser)} alt={displayFullName(activeUser)} className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials(activeUser)}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{displayFullName(activeUser)}</div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${presenceMap.get(activeUser.id) ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                    <span className="text-[10px] text-slate-500 font-medium">{presenceMap.get(activeUser.id) ? 'Online' : 'Offline'}</span>
                    <span className="text-slate-200">|</span>
                    <span className={`text-[10px] font-bold px-1.5 rounded-full border ${roleBadgeClass(activeUser.role)}`}>{roleLabelMap[activeUser.role] || activeUser.role}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm font-medium text-slate-400">Select a conversation</div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {isSyncing && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing
              </span>
            )}
            {activeUser && (
              <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Chat body */}
        <div ref={chatRef} className="flex-1 px-3 sm:px-4 py-4 space-y-3 bg-slate-50 overflow-y-auto scroll-smooth pb-32 sm:pb-6">
          {((loading && viewTab !== 'system') || (loadingMessages && viewTab !== 'system')) && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Loader2 className="h-8 w-8 text-blue-200 animate-spin" />
              <div className="mt-2 text-sm text-slate-500">Fetching messages…</div>
            </div>
          )}
          
          {viewTab === 'system' ? (
            <div className="space-y-4 max-w-2xl mx-auto pb-10">
              {loadingSystem && (
                <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Fetching system messages…
                </div>
              )}
              {systemMessages.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V5a2 2 0 00-2-2H6a2 2 0 00-2 2v11m16 0h-4m-8 0H4" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-400 font-medium">No system notifications yet.</p>
                </div>
              )}
              {systemMessages.map(m => (
                <div key={m.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{m.system_tag || 'System'}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-sm text-slate-700 leading-relaxed font-medium">{m.body}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {!loading && activeUser && conversation.length === 0 && (
                <div className="text-sm text-slate-300">No messages yet. Say hi!</div>
              )}
              {!loading && conversation.map(m => {
                const mine = m.sender === user?.id
                const status = mine ? outgoingStatus(m) : null
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${mine? 'justify-end':'justify-start'}`}>
                    {!mine && activeUser && (
                      <div className="hidden md:flex w-8 h-8 rounded-full overflow-hidden bg-white border border-gray-200 shadow-sm items-center justify-center text-xs text-gray-600 shrink-0">
                        {avatarUrl(activeUser) ? (
                          <img src={avatarUrl(activeUser)} alt={displayFullName(activeUser)} className="w-full h-full object-cover" />
                        ) : (
                          <span>{initials(activeUser)}</span>
                        )}
                      </div>
                    )}
                    <div className={`group relative max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-2xl shadow-sm text-sm whitespace-pre-wrap transition-shadow md:hover:shadow-md ${mine
                      ? 'bg-[#005c4b] text-white rounded-br-sm md:bg-gradient-to-br md:from-blue-600 md:to-sky-500 md:shadow-blue-100/40'
                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200 md:border-gray-100 md:shadow-sm'}
                    `}>
                      {(() => {
                        const url = getAttachmentUrl(m)
                        if (url) {
                          return (
                            <div className={`mb-1 ${mine? 'text-white':''}`}>
                              {isImageUrl(url) ? (
                                <img src={url} alt="attachment" className="max-h-56 rounded border border-gray-200/70" />
                              ) : (
                                <a href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 px-2 py-1 rounded border ${mine? 'border-white/40 bg-white/10':'border-gray-200 bg-gray-50'} hover:underline`}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M16.5 6.75v7.5a4.5 4.5 0 11-9 0V5.25a3 3 0 116 0v8.25a1.5 1.5 0 11-3 0V6.75" /></svg>
                                  <span className="text-xs">Open attachment</span>
                                </a>
                              )}
                            </div>
                          )
                        }
                        return null
                      })()}
                      {m.body}
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine? 'text-white/80':'text-gray-500'}`}>
                        <span>{formatMsgTime(m.created_at)}</span>
                        {mine && (
                          <span className={`inline-flex items-center ${status==='read' ? 'text-white' : 'text-white/80'}`} title={status}>
                            {status === 'sent' && (
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                            {status === 'delivered' && (
                              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                                <path d="M22 8L11 19l-2-2" />
                              </svg>
                            )}
                            {status === 'read' && (
                              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                                <path d="M22 8L11 19l-2-2" />
                              </svg>
                            )}
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          title="Forward"
                          className={`absolute -right-8 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center justify-center w-7 h-7 rounded-full border bg-white text-gray-600 shadow-sm group-hover:flex ${mine? '':'border-gray-200'}`}
                          onClick={()=>{ setForwardSource(m); setMessage(m.body || ''); setShowForwardModal(true) }}
                        >
                          ↪
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
        <div className="border-t border-black/20 px-2 py-1 text-xs text-slate-400 flex items-center justify-between bg-[#202c33] sm:bg-transparent md:bg-white md:border-t md:border-gray-200 md:text-gray-500">
          <button type="button" disabled className="px-2 py-1 rounded border opacity-60 cursor-not-allowed" title="Pagination not enabled yet">Load older</button>
          <span />
        </div>
        {viewTab!=='system' && (
        <>
        {/* WhatsApp-style composer bar */}
        <form onSubmit={sendToActive} className="min-h-16 p-2 flex items-center gap-2 fixed inset-x-0 bottom-16 z-20 bg-white border-t border-slate-100 sm:sticky sm:bottom-0 sm:rounded-b-xl md:border-gray-200">
          {/* Forward banner */}
          {isAdmin && forwardSource && (
            <div className="absolute -top-8 left-0 right-0 px-2">
              <div className="mx-2 mb-1 flex items-center justify-between text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <div className="truncate">Forwarding: <span className="font-medium">{(forwardSource.body||'').slice(0,60)}</span> {forwardRecipients.length>0 && <span>• to {forwardRecipients.length} recipient(s)</span>}</div>
                <div className="flex items-center gap-2">
                  <button type="button" className="underline" onClick={()=>setShowForwardModal(true)}>Change</button>
                  <button type="button" className="text-rose-700" onClick={()=>{ setForwardSource(null); setForwardRecipients([]) }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {/* WhatsApp-like half-screen preview */}
          {fileToSend && (
            <div className="fixed inset-x-0 bottom-[4.5rem] z-40 sm:absolute sm:inset-x-2 sm:bottom-[4.5rem] sm:z-20">
              <div className="mx-auto max-w-4xl px-2 sm:max-w-none sm:mx-0 sm:px-0">
                <div className="h-[50vh] sm:h-[55vh] rounded-xl border shadow-md bg-white overflow-hidden flex">
                  {filePreview ? (
                    <div className="flex-1 bg-black/5 flex items-center justify-center">
                      <img src={filePreview} alt="preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-24 h-24 rounded-xl border bg-gray-50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-gray-500"><path d="M9 12h6M9 16h6M9 8h6"/></svg>
                      </div>
                    </div>
                  )}
                  <div className="w-48 hidden sm:flex flex-col border-l bg-gray-50">
                    <div className="p-3 border-b">
                      <div className="text-sm font-medium break-all line-clamp-2">{fileToSend.name}</div>
                      <div className="text-xs text-gray-500">{(fileToSend.type||'').toString()} • {Math.ceil(fileToSend.size/1024)} KB</div>
                    </div>
                    <div className="p-3 mt-auto">
                      <button type="button" className="w-full px-3 py-2 rounded border" onClick={()=>{ setFileToSend(null); if(filePreview){ URL.revokeObjectURL(filePreview); setFilePreview(null) } }}>Remove</button>
                    </div>
                  </div>
                  <button type="button" aria-label="Close preview" className="absolute top-2 right-3 px-2 py-1 rounded bg-white/90 border shadow" onClick={()=>{ setFileToSend(null); if(filePreview){ URL.revokeObjectURL(filePreview); setFilePreview(null) } }}>✕</button>
                </div>
              </div>
            </div>
          )}
          <textarea
            ref={messageInputRef}
            rows={1}
            value={message}
            onChange={e=>setMessage(e.target.value)}
            onInput={(e)=>{
              const t = e.currentTarget; t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,136)+'px'
            }}
            placeholder={activeUser? 'Type a message':'Select a user to start chatting'}
            className={`flex-1 resize-none rounded-2xl px-4 py-2.5 bg-[#2a3942] border border-transparent ${activeUser? 'focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/60':'opacity-60'} shadow-inner text-[15px] text-slate-50 placeholder:text-slate-400 md:bg-white md:text-gray-900 md:placeholder:text-gray-400 md:border-gray-200 md:shadow-sm md:focus:border-blue-400 md:focus:ring-blue-200`}
            style={{ overflowY: message.length > 120 ? 'auto' : 'hidden' }}
            disabled={!activeUser}
          />
          {/* Attach icon */}
          <label className={`flex items-center justify-center rounded-full w-11 h-11 shrink-0 cursor-pointer border border-transparent bg-[#202c33] text-slate-200 hover:text-white hover:bg-[#26323a] md:bg-gray-50 md:text-gray-700 md:border md:border-gray-200 md:hover:bg-gray-100 ${!activeUser? 'opacity-40 cursor-not-allowed':''}`} title="Attach image">
            <input
              type="file"
              className="hidden"
              disabled={!activeUser}
              accept="image/*"
              onChange={(e)=>{
                const f = e.target.files && e.target.files[0]
                if (f){
                  if (!f.type?.startsWith('image/')){ showError('Invalid file','Only image files are allowed'); try{ e.target.value=''}catch{}; return }
                  setFileToSend(f)
                  try{ setFilePreview(URL.createObjectURL(f)) }catch{ setFilePreview(null) }
                  // Start upload immediately so send is instant
                  uploadImageToCloudinary(f).then(url=>{ setUploadedUrl(url) }).catch(err=>{ showError('Upload failed', err?.message||'Could not upload image'); setFileToSend(null); setUploadedUrl(''); if(filePreview){ try{ URL.revokeObjectURL(filePreview) }catch{}; setFilePreview(null) } })
                }
                // allow selecting the same file again next time
                try{ e.target.value = '' }catch{}
              }}
            />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M16.5 6.75v7.5a4.5 4.5 0 11-9 0V5.25a3 3 0 116 0v8.25a1.5 1.5 0 11-3 0V6.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          </label>
          {/* Preview chip */}
          {fileToSend && (
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-full border bg-gray-50 text-xs text-gray-700">
              {filePreview ? (
                <img src={filePreview} alt="preview" className="w-6 h-6 rounded object-cover" onError={()=>setFilePreview(null)} />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-gray-500"><path d="M9 12h6M9 16h6M9 8h6"/></svg>
              )}
              <span className="max-w-[140px] truncate">{fileToSend.name}</span>
              <button type="button" className="px-1 text-gray-500 hover:text-red-600" onClick={()=>{ setFileToSend(null); if(filePreview){ URL.revokeObjectURL(filePreview); setFilePreview(null) } }} aria-label="Remove attachment">×</button>
            </div>
          )}
          <button
            disabled={(forwardRecipients.length===0 && !activeUser) || sending || (!message.trim() && !fileToSend)}
            aria-label="Send message"
            className={`flex items-center justify-center rounded-full w-11 h-11 shrink-0 transition ${((forwardRecipients.length===0 && !activeUser) || (!message.trim() && !fileToSend))
              ? 'bg-gray-500 text-white/80 cursor-not-allowed'
              : 'bg-[#00a884] hover:bg-[#029a74] text-white'} ${sending? 'opacity-70':''}`}
          >
            {sending ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </form>
        </>
        )}
      </section>

      {/* Forward recipients modal */}
      {isAdmin && showForwardModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowForwardModal(false)} />
          <div className="absolute inset-x-0 top-10 mx-auto w-[92%] max-w-md bg-white rounded-xl border shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-medium">Forward to users</div>
              <button className="px-2 py-1 rounded border" onClick={()=>setShowForwardModal(false)}>Close</button>
            </div>
            <div className="p-3 border-b">
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users..." autoComplete="off" className="w-full border rounded px-3 py-2" />
            </div>
            <div className="max-h-80 overflow-auto p-2 space-y-1">
              {sortedUsers.filter(u=>u.id!==user?.id).map(u=>{
                const checked = forwardRecipients.includes(u.id)
                return (
                  <label key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={(e)=>{
                      setForwardRecipients(prev=> e.target.checked ? [...new Set([...prev, u.id])] : prev.filter(id=>id!==u.id))
                    }} />
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-600">{(u.first_name||u.username||'U')[0].toUpperCase()}</span>
                      <span className="text-sm">{displayFullName(u)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${roleBadgeClass(u.role)}`}>{roleLabelMap[u.role] || u.role}</span>
                    </span>
                  </label>
                )
              })}
              {sortedUsers.length===0 && <div className="text-sm text-gray-500 p-2">No users</div>}
            </div>
            <div className="p-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-1.5 rounded border" onClick={()=>{ setShowForwardModal(false) }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile slide-over for Users */}
      {showUsersMobile && (
        <div className="sm:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowUsersMobile(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-xs bg-white border-r shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-3 h-12 border-b">
              <div className="font-medium">Users</div>
              <button className="px-2 py-1 rounded border" onClick={()=>setShowUsersMobile(false)}>Close</button>
            </div>
            {/* Reuse the same sidebar content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b">
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users..." className="w-full border rounded px-3 py-2" />
              </div>
              {sortedUsers.map(u => {
                const isActive = activeUser?.id === u.id
                const meta = userMeta.get(u.id)
                const lastText = meta?.last?.body ? String(meta.last.body).slice(0, 40) : ''
                const unread = meta?.unread || 0
                const online = presenceMap.get(u.id)
                return (
                  <button key={u.id} onClick={()=>{ setActiveUser(u); setViewTab('chats'); setShowUsersMobile(false) }} className={`w-full text-left px-3 py-2 border-b hover:bg-gray-50 ${isActive? 'bg-blue-50':''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${online? 'bg-emerald-500':'bg-gray-300'}`}></span>
                        <div className="font-medium text-sm">{u.first_name || u.username}</div>
                      </div>
                      {unread>0 && (<span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{unread}</span>)}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{lastText || <span className="italic text-gray-400">No messages</span>}</div>
                  </button>
                )
              })}
              {sortedUsers.length===0 && (<div className="p-3 text-sm text-gray-500">No users</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
