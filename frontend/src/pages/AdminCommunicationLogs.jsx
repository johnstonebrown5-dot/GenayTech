import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Clock,
  Download,
  Filter,
  Mail,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Check,
  X,
} from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

const centerTextPlugin = {
  id: 'centerText',
  afterDraw: (chart, _args, pluginOptions) => {
    try {
      const opts = pluginOptions || {}
      const meta = chart.getDatasetMeta(0)
      const first = meta?.data?.[0]
      if (!first) return

      const text = opts.text ?? ''
      const subtext = opts.subtext ?? ''
      if (!text && !subtext) return

      const { ctx } = chart
      const x = first.x
      const y = first.y

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const mainSize = Number(opts.fontSize || 22)
      const subSize = Number(opts.subFontSize || 11)

      ctx.fillStyle = opts.color || '#111827'
      ctx.font = `900 ${mainSize}px Inter, ui-sans-serif, system-ui`
      ctx.fillText(String(text), x, subtext ? y - 6 : y)

      if (subtext) {
        ctx.fillStyle = opts.subColor || '#6b7280'
        ctx.font = `800 ${subSize}px Inter, ui-sans-serif, system-ui`
        ctx.fillText(String(subtext), x, y + 16)
      }

      ctx.restore()
    } catch {
      // no-op
    }
  },
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, centerTextPlugin)

function Card({ title, right, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-card ${className}`}>
      {(title || right) && (
        <div className="px-5 pt-5 pb-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-black text-gray-900">{title}</h3>}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

function MetricCard({ icon, title, value, subtitle, accent = 'bg-indigo-50 text-indigo-700' }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">{title}</div>
        <div className="text-xl font-black text-gray-900 leading-tight">{value}</div>
        {subtitle && <div className="text-xs font-semibold text-gray-500">{subtitle}</div>}
      </div>
    </div>
  )
}

function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.map(esc).join(',')]
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','))
  return lines.join('\n')
}

export default function AdminCommunicationLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState({ channel: '', status: '', search: '' })
  const [pendingCounts, setPendingCounts] = useState({ total: 0, sms: 0, email: 0 })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [polling, setPolling] = useState(false)
  const [page, setPage] = useState(1)

  const { addNotification } = useNotification()

  const PAGE_SIZE = 10

  const fetchLogs = async ({ background = false } = {}) => {
    if (background) setRefreshing(true)
    else setLoading(true)
    try {
      const params = {
        page_size: 10000,
        channel: filter.channel,
        status: filter.status,
        search: filter.search,
      }
      const res = await api.get('/communications/delivery-logs/', { params })
      const list = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : [])
      setLogs(list)

      const countsRes = await api.get('/communications/delivery-logs/pending_count/')
      setPendingCounts(countsRes.data || { total: 0, sms: 0, email: 0 })

      return list
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      addNotification('Failed to load communication logs', 'error')
      return []
    } finally {
      if (background) setRefreshing(false)
      else setLoading(false)
    }
  }

  const pollUntilSettled = async ({ attempts = 10, delayMs = 1500 } = {}) => {
    if (polling) return
    setPolling(true)
    try {
      for (let i = 0; i < attempts; i++) {
        const latest = await fetchLogs({ background: true })
        const stillSending = (latest || []).some((l) => l && (l.status === 'queued' || l.status === 'pending'))
        if (!stillSending) break
        await new Promise((r) => setTimeout(r, delayMs))
      }
    } finally {
      setPolling(false)
    }
  }

  const handleRetry = async (id) => {
    setLogs((prev) => (prev || []).map((l) => (l.id === id ? { ...l, status: 'queued', error: '' } : l)))
    try {
      await api.post('/communications/delivery-logs/retry/', { id })
      addNotification('Retry started', 'success')
      pollUntilSettled()
    } catch {
      addNotification('Retry failed to start', 'error')
      fetchLogs({ background: true })
    }
  }

  const handleSelectAll = (checked) => {
    if (checked) setSelectedIds(new Set((logs || []).map((l) => l.id)))
    else setSelectedIds(new Set())
  }

  const handleSelect = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const exportLogs = () => {
    try {
      const rows = (logs || []).map((l) => ({
        id: l?.id,
        channel: l?.channel,
        recipient: l?.recipient,
        status: l?.status,
        created_at: l?.created_at,
        message_snippet: l?.message_snippet,
        error: l?.error,
      }))
      const csv = toCsv(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `communication_logs_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      addNotification('Export failed', 'error')
    }
  }

  useEffect(() => {
    setPage(1)
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.channel, filter.status, filter.search])

  const counts = useMemo(() => {
    const list = Array.isArray(logs) ? logs : []
    const total = list.length
    const sent = list.filter((l) => l?.status === 'sent').length
    const failed = list.filter((l) => l?.status === 'failed').length
    const pending = list.filter((l) => l?.status === 'queued' || l?.status === 'pending').length
    return { total, sent, failed, pending }
  }, [logs])

  const channelCounts = useMemo(() => {
    const list = Array.isArray(logs) ? logs : []
    const sms = list.filter((l) => String(l?.channel || '').toLowerCase() === 'sms').length
    const email = list.filter((l) => String(l?.channel || '').toLowerCase() === 'email').length
    return { sms, email }
  }, [logs])

  const topFailedReasons = useMemo(() => {
    const list = (Array.isArray(logs) ? logs : []).filter((l) => l?.status === 'failed')
    const countsMap = new Map()
    for (const l of list) {
      const raw = String(l?.error || '').trim()
      const key = raw ? raw.slice(0, 48) : 'Unknown error'
      countsMap.set(key, (countsMap.get(key) || 0) + 1)
    }
    return Array.from(countsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value]) => ({ label, value }))
  }, [logs])

  const messagesOverTime = useMemo(() => {
    const list = Array.isArray(logs) ? logs : []
    const dayKey = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const today = new Date()
    const days = Array.from({ length: 7 }).map((_, i) => {
      const dt = new Date(today)
      dt.setDate(today.getDate() - (6 - i))
      dt.setHours(0, 0, 0, 0)
      return dt
    })
    const keys = days.map((d) => dayKey(d))
    const data = keys.map(() => ({ sent: 0, failed: 0, pending: 0 }))

    for (const l of list) {
      const created = l?.created_at
      if (!created) continue
      const key = dayKey(created)
      const idx = keys.indexOf(key)
      if (idx < 0) continue
      const st = String(l?.status || '')
      if (st === 'sent') data[idx].sent += 1
      else if (st === 'failed') data[idx].failed += 1
      else if (st === 'queued' || st === 'pending') data[idx].pending += 1
    }

    return {
      labels: keys,
      datasets: [
        { label: 'Sent', data: data.map((d) => d.sent), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.14)', tension: 0.35, fill: false, pointRadius: 2 },
        { label: 'Failed', data: data.map((d) => d.failed), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.14)', tension: 0.35, fill: false, pointRadius: 2 },
        { label: 'Pending', data: data.map((d) => d.pending), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.14)', tension: 0.35, fill: false, pointRadius: 2 },
      ],
    }
  }, [logs])

  const donutData = useMemo(() => ({
    labels: ['Sent', 'Failed', 'Pending'],
    datasets: [
      {
        data: [counts.sent, counts.failed, counts.pending],
        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  }), [counts.sent, counts.failed, counts.pending])

  const byChannelBar = useMemo(() => ({
    labels: ['Email', 'SMS'],
    datasets: [
      {
        label: 'Messages',
        data: [channelCounts.email, channelCounts.sms],
        backgroundColor: ['#4f46e5', '#3b82f6'],
        borderRadius: 999,
        barThickness: 12,
      },
    ],
  }), [channelCounts.email, channelCounts.sms])

  const totalPages = Math.max(1, Math.ceil((logs?.length || 0) / PAGE_SIZE))
  const pageLogs = (logs || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <Check className="w-4 h-4 text-emerald-600" />
      case 'failed':
        return <X className="w-4 h-4 text-red-600" />
      case 'queued':
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />
    }
  }

  const getStatusLabel = (status) => {
    if (status === 'queued' || status === 'pending') return 'sending'
    return status || ''
  }

  const getChannelIcon = (channel) => (
    String(channel || '').toLowerCase() === 'sms'
      ? <MessageSquare className="w-4 h-4 text-blue-500" />
      : <Mail className="w-4 h-4 text-purple-500" />
  )

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Communication Logs</h1>
          <p className="text-slate-500 text-sm font-semibold">Monitor SMS and Email delivery status</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportLogs}
            className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:border-gray-900 transition-all inline-flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Logs
          </button>
          <button
            type="button"
            onClick={() => fetchLogs({ background: true })}
            className="h-10 w-10 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm inline-flex items-center justify-center"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${(loading || refreshing || polling) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="xl:col-span-2 space-y-6">
          {/* Stat cards (match screenshot layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<Mail className="w-5 h-5" />}
              title="Total Messages"
              value={counts.total.toLocaleString()}
              subtitle="All time"
              accent="bg-indigo-50 text-indigo-700 border-indigo-100"
            />
            <MetricCard
              icon={<Check className="w-5 h-5" />}
              title="Sent"
              value={counts.sent.toLocaleString()}
              subtitle={counts.total ? `${Math.round((counts.sent / counts.total) * 100)}%` : '0%'}
              accent="bg-emerald-50 text-emerald-700 border-emerald-100"
            />
            <MetricCard
              icon={<X className="w-5 h-5" />}
              title="Failed"
              value={counts.failed.toLocaleString()}
              subtitle={counts.total ? `${Math.round((counts.failed / counts.total) * 100)}%` : '0%'}
              accent="bg-rose-50 text-rose-700 border-rose-100"
            />
            <MetricCard
              icon={<Clock className="w-5 h-5" />}
              title="Pending"
              value={(pendingCounts?.total ?? counts.pending).toLocaleString()}
              subtitle={counts.total ? `${Math.round(((pendingCounts?.total ?? counts.pending) / counts.total) * 100)}%` : '0%'}
              accent="bg-amber-50 text-amber-800 border-amber-100"
            />
          </div>

          {/* Filters row */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-black text-gray-700">
              <Filter className="w-4 h-4 text-gray-400" />
              Filters:
            </div>

            <select
              value={filter.channel}
              onChange={(e) => setFilter((f) => ({ ...f, channel: e.target.value }))}
              className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
            >
              <option value="">All Channels</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>

            <select
              value={filter.status}
              onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
              className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
              <option value="pending">Pending</option>
            </select>

            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={filter.search}
                onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search recipients or messages..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em]">
                    <th className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === (logs?.length || 0) && (logs?.length || 0) > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="px-5 py-4">Channel</th>
                    <th className="px-5 py-4">Recipient</th>
                    <th className="px-5 py-4">Message Snippet</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Date &amp; Time</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(loading && (logs?.length || 0) === 0) ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="px-5 py-5">
                          <div className="h-10 bg-gray-50 rounded-xl" />
                        </td>
                      </tr>
                    ))
                  ) : (logs?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-gray-500 font-semibold">
                        No communication logs found.
                      </td>
                    </tr>
                  ) : (
                    pageLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(log.id)}
                            onChange={(e) => handleSelect(log.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {getChannelIcon(log.channel)}
                            <span className="uppercase font-black text-[10px] tracking-widest text-gray-500">{log.channel}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-black text-gray-900">
                          {log.recipient}
                        </td>
                        <td className="px-5 py-4 text-gray-600 max-w-[360px] truncate">
                          {log.message_snippet}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <span className={`capitalize text-[11px] font-black ${
                              log.status === 'sent' ? 'text-emerald-700'
                                : log.status === 'failed' ? 'text-rose-700'
                                  : 'text-amber-700'
                            }`}>
                              {getStatusLabel(log.status)}
                            </span>
                          </div>
                          {log.error && (
                            <div className="mt-1 text-[10px] font-semibold text-rose-600 max-w-[200px] truncate" title={log.error}>
                              {log.error}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap font-semibold">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {log.status === 'failed' ? (
                            <button
                              type="button"
                              onClick={() => handleRetry(log.id)}
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-gray-200 text-indigo-600 hover:border-indigo-600 font-black text-[10px] uppercase tracking-widest"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Retry
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination (screenshot-style simple pager) */}
            <div className="px-5 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
              <div className="text-xs font-semibold text-gray-500">
                Showing {(logs?.length || 0) ? ((page - 1) * PAGE_SIZE + 1) : 0} to {Math.min(page * PAGE_SIZE, logs?.length || 0)} of {(logs?.length || 0).toLocaleString()} logs
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-40"
                >
                  ‹
                </button>
                <div className="h-9 min-w-[36px] px-3 rounded-xl bg-indigo-600 text-white font-black text-sm inline-flex items-center justify-center">
                  {page}
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card
            title="Delivery Overview"
            right={(
              <div className="inline-flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Month</span>
              </div>
            )}
          >
            <div className="h-[220px]">
              <Doughnut
                data={donutData}
                options={{
                  maintainAspectRatio: false,
                  cutout: '72%',
                  plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11, weight: '700' } } },
                    tooltip: { enabled: true },
                    centerText: { text: counts.total.toLocaleString(), subtext: 'Total', fontSize: 22, subFontSize: 11 },
                  },
                }}
              />
            </div>
          </Card>

          <Card
            title="Messages Over Time"
            right={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Month</span>}
          >
            <div className="h-[200px]">
              <Line
                data={messagesOverTime}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11, weight: '700' } } } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: '700' }, color: '#6b7280' } },
                    y: { grid: { color: 'rgba(148,163,184,0.20)' }, ticks: { font: { size: 10, weight: '700' }, color: '#6b7280' }, beginAtZero: true },
                  },
                }}
              />
            </div>
          </Card>

          <Card title="By Channel" right={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Month</span>}>
            <div className="h-[120px]">
              <Bar
                data={byChannelBar}
                options={{
                  indexAxis: 'y',
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { color: 'rgba(148,163,184,0.20)' }, ticks: { font: { size: 10, weight: '700' }, color: '#6b7280' }, beginAtZero: true },
                    y: { grid: { display: false }, ticks: { font: { size: 11, weight: '900' }, color: '#111827' } },
                  },
                }}
              />
            </div>
          </Card>

          <Card title="Top Failed Reasons" right={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Month</span>}>
            <div className="space-y-3">
              {(topFailedReasons.length === 0) ? (
                <div className="text-sm text-gray-500 font-semibold">No failures found.</div>
              ) : (
                topFailedReasons.map((r) => {
                  const pct = counts.failed ? Math.round((r.value / counts.failed) * 100) : 0
                  return (
                    <div key={r.label} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-black text-gray-700 truncate" title={r.label}>{r.label}</div>
                        <div className="text-xs font-black text-gray-500">{r.value} ({pct}%)</div>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
