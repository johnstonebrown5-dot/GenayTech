import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api'
import { useNotification } from '../components/NotificationContext'
import { useAuth } from '../auth'

export default function Messages(){
  const { user } = useAuth()
  const { showSuccess, showError } = useNotification()
  const location = useLocation()
  const [inbox, setInbox] = useState([])
  const [outbox, setOutbox] = useState([])
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
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
  const isFinance = user?.role === 'finance'
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
    try {
      const [inb, out] = await Promise.all([
        api.get('/communications/messages/'),
        api.get('/communications/messages/outbox/'),
      ])
      setInbox(Array.isArray(inb.data) ? inb.data : (inb.data?.results||[]))
      setOutbox(Array.isArray(out.data) ? out.data : (out.data?.results||[]))
    } finally {
      if (silent) setIsSyncing(false)
      else setLoading(false)
    }
  }

  // System messages
  const [systemMessages, setSystemMessages] = useState([])
  const loadSystem = async () => {
    try {
      const res = await api.get('/communications/messages/system/')
      setSystemMessages(Array.isArray(res.data) ? res.data : (res.data?.results||[]))
    } catch {
      setSystemMessages([])
    }
  }

  // Load users list by query (scoped to current school by backend)
  const loadUsers = async (q='') => {
    setLoadingUsers(true)
    try {
      // Request a large page size so we get the full directory (backend caps at 2000)
      let url = `/auth/users/?q=${encodeURIComponent(q)}&page_size=2000&include_orphans=1`
      const acc = []
      const seen = new Set()
      let pages = 0
      while (url && pages < 200) { // generous safety cap; follow `next` until null
        const { data } = await api.get(url)
        if (Array.isArray(data)) {
          for (const u of data) { if (u && !seen.has(u.id)) { seen.add(u.id); acc.push(u) } }
          break
        }
        const batch = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.users) ? data.users : [])
        for (const u of (batch||[])) { if (u && !seen.has(u.id)) { seen.add(u.id); acc.push(u) } }
        // DRF may return absolute next URLs. Convert to API-relative if needed.
        const nextUrl = data?.next || null
        if (!nextUrl) { url = null }
        else if (typeof nextUrl === 'string' && /^https?:\/\//i.test(nextUrl)) {
          try {
            const u = new URL(nextUrl)
            const path = (u.pathname || '') + (u.search || '')
            url = path.startsWith('/api/') ? path.replace('/api/', '/') : path
          } catch {
            url = null
          }
        } else {
          url = nextUrl
        }
        pages += 1
      }
      // Show all users in the same school (backend already applies school scoping), except the current user
      setAllUsers(acc.filter(u => u.id !== user?.id))
    } catch {
      setAllUsers([])
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
      // If image is selected, ensure it is uploaded to Cloudinary first, then send URL to backend
      if (fileToSend){
        if (!fileToSend.type?.startsWith('image/')) {
          throw new Error('Only image files are allowed')
        }
        let url = uploadedUrl
        if (!url) { url = await uploadImageToCloudinary(fileToSend); setUploadedUrl(url) }
        let sent = false; let lastErr = null
        const base = { body: message || '', audience: 'users', recipient_ids: targetIds }
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
    <div className="mx-auto max-w-6xl w-full min-h-[calc(100vh-5rem)] md:h-[calc(100vh-5rem)] bg-white border rounded-xl overflow-hidden flex shadow-card">
      {/* Left: Users list */}
      <aside className="hidden sm:flex w-80 border-r flex-col">
        <div className="flex border-b">
          <button onClick={()=>setViewTab('chats')} className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-2 ${viewTab==='chats'?'border-b-2 border-blue-600 font-medium':''}`}>
            <span>Chats</span>
            {chatsUnread>0 && (
              <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{chatsUnread>99?'99+':chatsUnread}</span>
            )}
          </button>
          <button onClick={()=>setViewTab('system')} className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-2 ${viewTab==='system'?'border-b-2 border-blue-600 font-medium':''}`}>
            <span>System</span>
            {systemUnread>0 && (
              <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{systemUnread>99?'99+':systemUnread}</span>
            )}
          </button>
          {(isAdmin || isFinance) && (
            <>
              <button onClick={()=>setViewTab('role')} className={`flex-1 px-3 py-2 text-sm ${viewTab==='role'?'border-b-2 border-blue-600 font-medium':''}`}>Role</button>
              {isAdmin && (
                <button onClick={()=>setViewTab('broadcast')} className={`flex-1 px-3 py-2 text-sm ${viewTab==='broadcast'?'border-b-2 border-blue-600 font-medium':''}`}>Broadcast</button>
              )}
            </>
          )}
        </div>
        <div className="p-3 border-b">
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Search users..."
            autoComplete="off"
            className="w-full border rounded px-3 py-2"
          />
        </div>
        {viewTab === 'chats' && (
          <div className="flex-1 overflow-y-auto">
            {loadingUsers && (
              <div className="p-3 text-sm text-gray-500">Loading users and conversationseee</div>
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
                  className={`w-full text-left px-3 py-2 border-b hover:bg-gray-50 ${isActive? 'bg-blue-50':''}`}
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

        {(isAdmin || isFinance) && viewTab === 'role' && (
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
          <form onSubmit={sendBroadcast} className="p-3 space-y-2">
            <label className="text-xs text-gray-600">Broadcast to entire school</label>
            <textarea className="w-full border rounded px-3 py-2 min-h-[140px]" value={broadcastMessage} onChange={e=>setBroadcastMessage(e.target.value)} placeholder="Type your announcement..."/>
            <button className="w-full px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!broadcastMessage.trim()}>Broadcast</button>
          </form>
        )}
      </aside>

      {/* Right: Chat thread or System feed */}
      {/* Mobile users list as main view when no chat is selected */}
      {!activeUser && viewTab!== 'system' && (
        <div className="sm:hidden flex-1 flex flex-col">
          <div className="h-12 border-b px-3 flex items-center justify-between sticky top-0 bg-white z-10">
            <div className="font-medium">Users</div>
          </div>
          <div className="p-3 border-b">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users..." autoComplete="off" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedUsers.map(u => {
              const meta = userMeta.get(u.id)
              const lastText = meta?.last?.body ? String(meta.last.body).slice(0, 50) : ''
              const unread = meta?.unread || 0
              const online = presenceMap.get(u.id)
              return (
                <button key={u.id} onClick={()=>{ setActiveUser(u) }} className="w-full text-left px-3 py-2 border-b hover:bg-gray-50">
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
                    {unread>0 && (<span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5">{unread}</span>)}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{lastText || <span className="italic text-gray-400">No messages</span>}</div>
                </button>
              )
            })}
            {!loadingUsers && sortedUsers.length===0 && (
              <div className="p-3 text-sm text-gray-500">No messages yet. Add users to start messaging.</div>
            )}
          </div>
        </div>
      )}

      {/* Chat section */}
      <section className={`relative flex-1 flex flex-col overflow-y-auto ${!activeUser && viewTab!=='system' ? 'hidden sm:flex' : ''}`}>
        <div className="h-14 border-b px-2 sm:px-4 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="font-medium">
            <div className="flex items-center gap-2">
              {activeUser && (
                <button className="sm:hidden px-2 py-1 rounded border" onClick={()=>setActiveUser(null)} aria-label="Back">
                  ←
                </button>
              )}
              {viewTab==='system' ? (
                <span>System</span>
              ) : activeUser ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-xs text-gray-600">
                    {avatarUrl(activeUser) ? (
                      <img src={avatarUrl(activeUser)} alt={displayFullName(activeUser)} className="w-full h-full object-cover" />
                    ) : (
                      <span>{initials(activeUser)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{displayFullName(activeUser)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${roleBadgeClass(activeUser.role)}`}>{roleLabelMap[activeUser.role] || activeUser.role}</span>
                  </div>
                </div>
              ) : (
                <span>Select a user</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {isSyncing && (
              <span className="inline-flex items-center gap-1">
                <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Syncing
              </span>
            )}
          </div>
        </div>
        <div ref={chatRef} className="flex-1 px-2 sm:px-4 py-3 space-y-2 bg-gray-50 pb-28 sm:pb-4">
          {loading && viewTab!=='system' && <div className="text-sm text-gray-500">Loading...</div>}
          {viewTab==='system' ? (
            <div className="space-y-2">
              {systemMessages.length === 0 && (
                <div className="text-sm text-gray-500">No system messages.</div>
              )}
              {systemMessages.map(m => (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[80%] px-3 py-2 rounded-lg shadow-sm text-sm whitespace-pre-wrap bg-white border">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{m.system_tag || 'system'}</div>
                    {m.body}
                    <div className="mt-1 text-[10px] text-gray-500">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {!loading && activeUser && conversation.length === 0 && (
                <div className="text-sm text-gray-500">No messages yet. Say hi!</div>
              )}
              {!loading && conversation.map(m => {
                const mine = m.sender === user?.id
                return (
                  <div key={m.id} className={`flex ${mine? 'justify-end':'justify-start'}`}>
                    <div className={`group relative max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-lg shadow-sm text-sm whitespace-pre-wrap ${mine? 'bg-blue-600 text-white':'bg-white border'}`}>
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
                      <div className={`mt-1 text-[10px] ${mine? 'text-white/80':'text-gray-500'}`}>{new Date(m.created_at).toLocaleString()}</div>
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
        <div className="border-t px-2 py-1 text-xs text-gray-500 flex items-center justify-between">
          <button type="button" disabled className="px-2 py-1 rounded border opacity-60 cursor-not-allowed" title="Pagination not enabled yet">Load older</button>
          <span />
        </div>
        {viewTab!=='system' && (
        <form onSubmit={sendToActive} className="min-h-16 p-2 flex items-center gap-2 fixed inset-x-0 bottom-[4.5rem] z-20 bg-white border-t sm:sticky sm:bottom-0">
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
            className={`flex-1 resize-none rounded-2xl px-4 py-2.5 bg-gray-50 border ${activeUser? 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500':'border-gray-200'} shadow-inner text-[15px] placeholder:text-gray-400`}
            style={{ overflowY: message.length > 120 ? 'auto' : 'hidden' }}
            disabled={!activeUser}
          />
          {/* Attach */}
          <label className={`flex items-center justify-center rounded-full w-11 h-11 shrink-0 cursor-pointer border ${!activeUser? 'opacity-50 cursor-not-allowed':''}`} title="Attach image">
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-600">
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
            className={`flex items-center justify-center rounded-full w-11 h-11 shrink-0 transition ${((forwardRecipients.length===0 && !activeUser) || (!message.trim() && !fileToSend))? 'bg-gray-300 text-white cursor-not-allowed':'bg-blue-600 hover:bg-blue-700 text-white'} ${sending? 'opacity-70':''}`}
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
