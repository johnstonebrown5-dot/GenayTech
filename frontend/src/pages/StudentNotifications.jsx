import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../auth'
import StudentMobileHeader from '../components/studentMobile/StudentMobileHeader'
import StudentMobileTabs from '../components/studentMobile/StudentMobileTabs'

function groupByDate(messages) {
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now - 86400000).toDateString()
  const weekAgo = now - 7 * 86400000

  const groups = { Today: [], Yesterday: [], 'This Week': [], Earlier: [] }
  for (const m of messages) {
    const d = new Date(m.created_at)
    const ds = d.toDateString()
    if (ds === today) groups.Today.push(m)
    else if (ds === yesterday) groups.Yesterday.push(m)
    else if (d.getTime() >= weekAgo) groups['This Week'].push(m)
    else groups.Earlier.push(m)
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

function iconForTag(tag) {
  const t = String(tag || '').toLowerCase()
  if (t.includes('fee') || t.includes('finance')) return { bg: 'bg-emerald-100', color: 'text-emerald-600', icon: '💳' }
  if (t.includes('exam') || t.includes('academic')) return { bg: 'bg-blue-100', color: 'text-blue-600', icon: '📚' }
  if (t.includes('event')) return { bg: 'bg-amber-100', color: 'text-amber-600', icon: '📅' }
  return { bg: 'bg-red-100', color: 'text-red-600', icon: '🔔' }
}

export default function StudentNotifications() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await api.get('/communications/messages/system/')
        if (!mounted) return
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || [])
        setMessages(data)
      } catch {
        if (mounted) setMessages([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const unreadCount = useMemo(() => {
    const myId = user?.id
    if (!myId) return 0
    return messages.reduce((acc, m) => {
      const rec = Array.isArray(m.recipients) ? m.recipients.find(r => r.user === myId) : null
      return acc + (rec && !rec.read ? 1 : 0)
    }, 0)
  }, [messages, user])

  const filtered = useMemo(() => {
    const myId = user?.id
    let list = [...messages]
    if (filter === 'unread') {
      list = list.filter(m => {
        const rec = Array.isArray(m.recipients) ? m.recipients.find(r => r.user === myId) : null
        return rec && !rec.read
      })
    } else if (filter === 'academic') {
      list = list.filter(m => {
        const tag = String(m.system_tag || m.body || '').toLowerCase()
        return tag.includes('exam') || tag.includes('academic') || tag.includes('result')
      })
    } else if (filter === 'finance') {
      list = list.filter(m => {
        const tag = String(m.system_tag || m.body || '').toLowerCase()
        return tag.includes('fee') || tag.includes('finance') || tag.includes('payment')
      })
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [messages, filter, user])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread', badge: unreadCount },
    { id: 'academic', label: 'Academic' },
    { id: 'finance', label: 'Finance' },
  ]

  const formatTime = (iso) => {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="sm:hidden bg-slate-50 min-h-full">
      <div className="bg-gradient-to-br from-purple-600 via-purple-600 to-blue-600 rounded-b-3xl shadow-md pb-1">
        <StudentMobileHeader
          theme="purple"
          embedded
          title="Notifications"
          showBack
          onBack={() => navigate('/student')}
        />
        <StudentMobileTabs tabs={tabs} active={filter} onChange={setFilter} badgeKey="badge" />
      </div>

      <div className="px-4 py-4 space-y-5">
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-500">Loading notifications…</div>
        ) : grouped.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-purple-50 flex items-center justify-center text-2xl">🔔</div>
            <p className="text-sm text-slate-500">No notifications</p>
          </div>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label}>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{label}</h3>
              <div className="space-y-2">
                {items.map(m => {
                  const myId = user?.id
                  const rec = Array.isArray(m.recipients) ? m.recipients.find(r => r.user === myId) : null
                  const isUnread = rec && !rec.read
                  const tag = m.system_tag || 'Notification'
                  const style = iconForTag(tag)
                  return (
                    <div
                      key={m.id}
                      className={`bg-white rounded-2xl p-3 shadow-sm border ${isUnread ? 'border-blue-200' : 'border-slate-100'} flex items-start gap-3`}
                    >
                      <div className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center shrink-0 text-lg`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-bold text-slate-900 truncate">{tag}</div>
                          {isUnread && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{m.body}</p>
                        <div className="text-[10px] text-slate-400 mt-1">{formatTime(m.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
