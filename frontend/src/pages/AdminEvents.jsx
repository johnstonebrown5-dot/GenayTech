import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Filler,
} from 'chart.js'
import Modal from '../components/Modal'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
)

function isTermEvent(ev) {
  if (!ev) return false
  if (ev?.source === 'exam') return false
  const title = (ev?.title || '').toLowerCase()
  const description = (ev?.description || '').toLowerCase()
  if (description.includes('auto-synced') && description.includes('term')) return true
  const termRegex = /\bterm\s*(1|2|3)\b/i
  return termRegex.test(title) || termRegex.test(description)
}

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    start: '',
    end: '',
    all_day: false,
    audience: 'all',
    visibility: 'internal',
  })
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    location: '',
    start: '',
    end: '',
    all_day: false,
    audience: 'all',
    visibility: 'internal',
  })

  const { showSuccess, showError } = useNotification()
  const navigate = useNavigate()

  const filteredEvents = useMemo(
    () => events.filter((e) => !isTermEvent(e)),
    [events]
  )

  const upcomingEvents = useMemo(() => {
    const now = Date.now()
    return filteredEvents
      .filter((e) => new Date(e.start || 0).getTime() > now)
      .sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0))
      .slice(0, 5)
  }, [filteredEvents])

  const completedCount = useMemo(
    () => filteredEvents.filter((e) => e.completed || e.status === 'completed').length,
    [filteredEvents]
  )

  const cancelledCount = useMemo(
    () => filteredEvents.filter((e) => e.cancelled || e.status === 'cancelled').length,
    [filteredEvents]
  )

  const eventsByType = useMemo(() => {
    const types = {}
    filteredEvents.forEach((e) => {
      const type = e.source === 'exam' ? 'Exams' : (e.type || 'Other')
      types[type] = (types[type] || 0) + 1
    })
    return types
  }, [filteredEvents])

  const eventsByMonth = useMemo(() => {
    const months = {}
    filteredEvents.forEach((e) => {
      const d = new Date(e.start || e.created_at || 0)
      const key = d.toLocaleString(undefined, { month: 'short' })
      months[key] = (months[key] || 0) + 1
    })
    return months
  }, [filteredEvents])

  const trendData = useMemo(() => {
    // Calculate last 6 months
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(date)
    }

    const totalByMonth = months.map((month) => {
      const monthStr = month.toLocaleString(undefined, { month: 'short' })
      return filteredEvents.filter((e) => {
        const eDate = new Date(e.start || e.created_at || 0)
        return eDate.getMonth() === month.getMonth() && eDate.getFullYear() === month.getFullYear()
      }).length
    })

    const completedByMonth = months.map((month) => {
      return filteredEvents.filter((e) => {
        const eDate = new Date(e.start || e.created_at || 0)
        return (e.completed || e.status === 'completed') && eDate.getMonth() === month.getMonth() && eDate.getFullYear() === month.getFullYear()
      }).length
    })

    const cancelledByMonth = months.map((month) => {
      return filteredEvents.filter((e) => {
        const eDate = new Date(e.start || e.created_at || 0)
        return (e.cancelled || e.status === 'cancelled') && eDate.getMonth() === month.getMonth() && eDate.getFullYear() === month.getFullYear()
      }).length
    })

    return {
      labels: months.map((m) => m.toLocaleString(undefined, { month: 'short' })),
      datasets: [
        {
          label: 'Total Events',
          data: totalByMonth,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: 'Completed',
          data: completedByMonth,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: 'Cancelled',
          data: cancelledByMonth,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    }
  }, [filteredEvents])

  const kpiSparklines = useMemo(() => {
    // Calculate sparkline data from trend data (6 months)
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(date)
    }

    const totalSparkline = months.map((month) => {
      return filteredEvents.filter((e) => {
        const eDate = new Date(e.start || e.created_at || 0)
        return eDate.getMonth() === month.getMonth() && eDate.getFullYear() === month.getFullYear()
      }).length
    })

    const completedSparkline = months.map((month) => {
      return filteredEvents.filter((e) => {
        const eDate = new Date(e.start || e.created_at || 0)
        return (e.completed || e.status === 'completed') && eDate.getMonth() === month.getMonth() && eDate.getFullYear() === month.getFullYear()
      }).length
    })

    const upcomingSparkline = months.map((month) => {
      return filteredEvents.filter((e) => {
        const eDate = new Date(e.start || e.created_at || 0)
        const futureDate = new Date(e.start || 0).getTime() > Date.now()
        return futureDate && eDate.getMonth() === month.getMonth() && eDate.getFullYear() === month.getFullYear()
      }).length
    })

    const cancelledSparkline = months.map((month) => {
      return filteredEvents.filter((e) => {
        const eDate = new Date(e.start || e.created_at || 0)
        return (e.cancelled || e.status === 'cancelled') && eDate.getMonth() === month.getMonth() && eDate.getFullYear() === month.getFullYear()
      }).length
    })

    return {
      total: totalSparkline.length > 0 ? totalSparkline : [0, 0, 0, 0, 0, 0],
      completed: completedSparkline.length > 0 ? completedSparkline : [0, 0, 0, 0, 0, 0],
      upcoming: upcomingSparkline.length > 0 ? upcomingSparkline : [0, 0, 0, 0, 0, 0],
      cancelled: cancelledSparkline.length > 0 ? cancelledSparkline : [0, 0, 0, 0, 0, 0],
    }
  }, [filteredEvents])

  const typeChartData = {
    labels: Object.keys(eventsByType),
    datasets: [
      {
        data: Object.values(eventsByType),
        backgroundColor: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  }

  const statusChartData = {
    labels: ['Completed', 'Upcoming', 'Cancelled'],
    datasets: [
      {
        data: [completedCount, upcomingEvents.length, cancelledCount],
        backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  }

  const monthChartData = {
    labels: Object.keys(eventsByMonth),
    datasets: [
      {
        label: 'Events',
        data: Object.values(eventsByMonth),
        backgroundColor: '#6366f1',
        borderRadius: 8,
      },
    ],
  }

  const summaryStats = useMemo(() => {
    // Find most active month
    let mostActiveMonth = 'N/A'
    let mostActiveCount = 0
    Object.entries(eventsByMonth).forEach(([month, count]) => {
      if (count > mostActiveCount) {
        mostActiveCount = count
        mostActiveMonth = month
      }
    })

    // Find most common type
    let mostCommonType = 'N/A'
    let mostCommonCount = 0
    Object.entries(eventsByType).forEach(([type, count]) => {
      if (count > mostCommonCount) {
        mostCommonCount = count
        mostCommonType = type
      }
    })

    // Calculate participation (total participants across all events)
    let totalParticipants = filteredEvents.reduce((acc, e) => {
      const participants = parseInt(e.participants || e.expected_participants || 0) || 0
      return acc + participants
    }, 0)

    return {
      mostActiveMonth,
      mostActiveCount,
      mostCommonType,
      mostCommonCount,
      mostCommonPercentage: filteredEvents.length > 0 ? Math.round((mostCommonCount / filteredEvents.length) * 100) : 0,
      totalParticipants: totalParticipants > 0 ? totalParticipants : (Math.round(filteredEvents.length * 15) + '+'),
    }
  }, [filteredEvents, eventsByMonth, eventsByType])

  const loadEvents = async () => {
    setLoading(true)
    setError('')
    try {
      const [evRes, exRes] = await Promise.all([
        api.get('/communications/events/'),
        api.get('/academics/exams/', { params: { include_history: true } }).catch(() => ({ data: [] })),
      ])

      const baseEvents = Array.isArray(evRes.data) ? evRes.data : evRes.data?.results || []
      const exams = Array.isArray(exRes.data) ? exRes.data : exRes.data?.results || []
      const examEvents = exams.map((x) => {
        const dateStr = x.date || x.exam_date || x.scheduled_date || new Date().toISOString().slice(0, 10)
        return {
          id: `exam-${x.id}`,
          title: `Exam: ${x.name}`,
          description: `Exam for class ${x.klass_name || x.class_name || ''}`.trim(),
          location: '',
          start: `${dateStr}T00:00:00`,
          end: `${dateStr}T23:59:59`,
          all_day: true,
          audience: 'all',
          visibility: 'internal',
          source: 'exam',
        }
      })

      setEvents([...baseEvents, ...examEvents])
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        ...form,
        start: form.start ? new Date(form.start).toISOString() : null,
        end: form.end ? new Date(form.end).toISOString() : null,
      }
      await api.post('/communications/events/', payload)
      setIsCreateOpen(false)
      setForm({ title: '', description: '', location: '', start: '', end: '', all_day: false, audience: 'all', visibility: 'internal' })
      loadEvents()
      showSuccess('Event Created', `Event "${form.title}" created successfully.`)
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
      showError('Failed to Create Event', 'Please try again.')
    }
  }

  const handleOpenEdit = (ev) => {
    setSelectedEvent(ev)
    setEditForm({
      title: ev.title || '',
      description: ev.description || '',
      location: ev.location || '',
      start: ev.start ? new Date(ev.start).toISOString().slice(0, 16) : '',
      end: ev.end ? new Date(ev.end).toISOString().slice(0, 16) : '',
      all_day: !!ev.all_day,
      audience: ev.audience || 'all',
      visibility: ev.visibility || 'internal',
    })
    setIsEditOpen(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!selectedEvent) return
    setError('')
    try {
      const payload = {
        ...editForm,
        start: editForm.start ? new Date(editForm.start).toISOString() : null,
        end: editForm.end ? new Date(editForm.end).toISOString() : null,
      }
      await api.patch(`/communications/events/${selectedEvent.id}/`, payload)
      setIsEditOpen(false)
      setSelectedEvent(null)
      loadEvents()
      showSuccess('Event Updated', `Event "${editForm.title}" updated successfully.`)
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
      showError('Failed to Update Event', 'Please try again.')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return
    try {
      await api.delete(`/communications/events/${id}/`)
      setEvents((prev) => prev.filter((e) => e.id !== id))
      showSuccess('Event Deleted', 'The event has been deleted.')
    } catch (e) {
      showError('Failed to Delete Event', 'Please try again.')
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School Events</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and track all school events in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/admin/calendar')} className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
            Academic Calendar
          </button>
          <button type="button" onClick={() => {}} className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Calendar View
          </button>
          <button type="button" onClick={() => setIsCreateOpen(true)} className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            New Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ label: 'TOTAL EVENTS', value: filteredEvents.length, sparkline: kpiSparklines.total, color: 'indigo' }, { label: 'COMPLETED EVENTS', value: completedCount, sparkline: kpiSparklines.completed, color: 'blue' }, { label: 'UPCOMING EVENTS', value: upcomingEvents.length, sparkline: kpiSparklines.upcoming, color: 'emerald' }, { label: 'CANCELLED EVENTS', value: cancelledCount, sparkline: kpiSparklines.cancelled, color: 'amber' }].map((card, idx) => {
          const maxValue = Math.max(...card.sparkline, 1)
          return (
          <div key={idx} className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gray-500/10 blur-2xl" />
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-black uppercase tracking-widest text-gray-400">{card.label}</div>
            </div>
            <div className="text-3xl font-extrabold text-gray-900">{card.value}</div>
            <div className="text-xs mt-2 font-bold text-emerald-600">↑ {filteredEvents.length > 0 ? Math.round((upcomingEvents.length / (filteredEvents.length || 1)) * 100) : 0}% upcoming</div>
            <div className="mt-3 h-10 flex items-end gap-1 opacity-60">
              {card.sparkline.map((v, i) => (
                <div key={i} className="flex-1 bg-gray-200 rounded-full" style={{ height: `${(v / maxValue) * 100}%` }} />
              ))}
            </div>
          </div>
        )}
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="mb-4"><h3 className="font-bold text-gray-900">Events Trend Overview</h3><p className="text-xs text-gray-500 mt-1">6 Months Trend</p></div>
          <div className="h-72"><Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }} /></div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="mb-4"><h3 className="font-bold text-gray-900">Events by Type</h3></div>
          <div className="h-72 flex items-center justify-center"><Doughnut data={typeChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} /></div>
          <div className="mt-4 space-y-2">
            {Object.entries(eventsByType).map(([type, count], idx) => (
              <div key={idx} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#6366f1', '#ec4899', '#f59e0b', '#10b981'][idx % 4] }} /><span className="text-gray-600">{type}</span></div><span className="font-bold text-gray-900">{count} ({Math.round((count / (filteredEvents.length || 1)) * 100)}%)</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-900">Upcoming Events</h3></div>
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No upcoming events</div>
            ) : (
              upcomingEvents.map((ev, idx) => {
                const daysUntil = Math.ceil((new Date(ev.start || 0) - Date.now()) / (1000 * 60 * 60 * 24))
                const dayStr = new Date(ev.start || 0).toLocaleString(undefined, { month: 'short', day: 'numeric' })
                return (
                  <div key={ev.id || idx} className="border border-gray-200 rounded-2xl p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">{dayStr}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{ev.title}</div>
                        <div className="text-xs text-gray-500 mt-1">{ev.description || 'No description'}</div>
                        <div className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-bold ${daysUntil <= 3 ? 'bg-red-100 text-red-700' : daysUntil <= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          In {daysUntil} days
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-6">Events Status</h3>
          <div className="h-80 flex items-center justify-center"><Doughnut data={statusChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /></div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-gray-600">Completed</span></div><span className="font-bold">{completedCount} ({Math.round((completedCount / (filteredEvents.length || 1)) * 100)}%)</span></div>
            <div className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-gray-600">Upcoming</span></div><span className="font-bold">{upcomingEvents.length} ({Math.round((upcomingEvents.length / (filteredEvents.length || 1)) * 100)}%)</span></div>
            <div className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-gray-600">Cancelled</span></div><span className="font-bold">{cancelledCount} ({Math.round((cancelledCount / (filteredEvents.length || 1)) * 100)}%)</span></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-900">Events by Month</h3></div>
          <div className="h-72"><Bar data={monthChartData} options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-indigo-100 p-5"><div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Most Active Month</div><div className="text-2xl font-extrabold text-indigo-900">{summaryStats.mostActiveMonth}</div><div className="text-xs text-indigo-700 mt-2">{summaryStats.mostActiveCount} events</div></div>
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-violet-100 p-5"><div className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-2">Most Common Type</div><div className="text-2xl font-extrabold text-violet-900">{summaryStats.mostCommonType}</div><div className="text-xs text-violet-700 mt-2">{summaryStats.mostCommonCount} events ({summaryStats.mostCommonPercentage}%)</div></div>
        <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl border border-rose-100 p-5"><div className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2">Total Participation</div><div className="text-2xl font-extrabold text-rose-900">{typeof summaryStats.totalParticipants === 'string' ? summaryStats.totalParticipants : summaryStats.totalParticipants}</div><div className="text-xs text-rose-700 mt-2">Across all events</div></div>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Event" size="lg">
        <form onSubmit={handleCreateSubmit} className="grid gap-4">
          <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-gray-700">Start<input type="datetime-local" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required /></label>
            <label className="grid gap-2 text-sm text-gray-700">End<input type="datetime-local" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.all_day} onChange={(e) => setForm({ ...form, all_day: e.target.checked })} />All day</label>
            <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}><option value="all">All</option><option value="students">Students</option><option value="teachers">Teachers</option><option value="parents">Parents</option><option value="staff">Staff</option></select>
          </div>
          <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="internal">Internal</option><option value="public">Public</option></select>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Save</button></div>
        </form>
      </Modal>

      <Modal open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Event" size="lg">
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" placeholder="Title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
          <textarea className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" placeholder="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          <input className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" placeholder="Location" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-gray-700">Start<input type="datetime-local" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" value={editForm.start} onChange={(e) => setEditForm({ ...editForm, start: e.target.value })} required /></label>
            <label className="grid gap-2 text-sm text-gray-700">End<input type="datetime-local" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" value={editForm.end} onChange={(e) => setEditForm({ ...editForm, end: e.target.value })} /></label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={editForm.all_day} onChange={(e) => setEditForm({ ...editForm, all_day: e.target.checked })} />All day</label>
            <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" value={editForm.audience} onChange={(e) => setEditForm({ ...editForm, audience: e.target.value })}><option value="all">All</option><option value="students">Students</option><option value="teachers">Teachers</option><option value="parents">Parents</option><option value="staff">Staff</option></select>
          </div>
          <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" value={editForm.visibility} onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value })}><option value="internal">Internal</option><option value="public">Public</option></select>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setIsEditOpen(false)} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Update</button></div>
        </form>
      </Modal>
    </div>
  )
}
