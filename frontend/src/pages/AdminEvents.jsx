import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

function ymdLocal(dateLike){
  const d = new Date(dateLike)
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const da = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${da}`
}

function groupByDateOrdered(events){
  // Preserve incoming order within groups and of groups
  const map = new Map()
  for (const e of events) {
    const key = ymdLocal(e.start)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(e)
  }
  return Array.from(map.entries())
}

// Calendar helpers
function startOfMonth(d){ const x=new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x }
function startOfCalendarGrid(d){
  const first = startOfMonth(d)
  const day = first.getDay() // 0 Sun .. 6 Sat
  const diff = day
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - diff); gridStart.setHours(0,0,0,0)
  return gridStart
}
function buildMonthGrid(d){
  const start = startOfCalendarGrid(d)
  const days = []
  for (let i=0; i<42; i++){
    const day = new Date(start); day.setDate(start.getDate()+i)
    day.setHours(0,0,0,0)
    days.push(day)
  }
  return days
}

export default function AdminEvents(){
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
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

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editForm, setEditForm] = useState({
    title: '', description: '', location: '', start: '', end: '', all_day: false, audience: 'all', visibility: 'internal'
  })

  // Calendar state
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar'
  const [month, setMonth] = useState(()=>{ const d=new Date(); d.setDate(1); return d })

  const { showSuccess, showError } = useNotification()
  const navigate = useNavigate()

  // Hide auto-synced term events like "2025 - Term 1/2/3"
  const isTermEvent = (ev) => {
    const t = (ev?.title || '').toLowerCase()
    const d = (ev?.description || '').toLowerCase()
    if (ev?.source === 'exam') return false
    if (d.includes('auto-synced') && d.includes('term')) return true
    const termRegex = /\bterm\s*(1|2|3)\b/i
    return termRegex.test(ev?.title || '') || termRegex.test(ev?.description || '')
  }
  const filteredEvents = useMemo(() => events.filter(e => !isTermEvent(e)), [events])

  // Determine if an event has already ended (expired)
  const isExpired = (ev) => {
    try{
      const end = ev?.end ? new Date(ev.end) : (ev?.start ? new Date(ev.start) : null)
      if (!end) return false
      return end.getTime() < Date.now()
    }catch{ return false }
  }

  // Countdown helpers for upcoming events
  const [nowTs, setNowTs] = useState(()=> Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60000) // update every minute
    return () => clearInterval(id)
  }, [])

  const countdownLabel = (startIso) => {
    try{
      const start = new Date(startIso).getTime()
      const diff = start - nowTs
      if (diff <= 0) return ''
      const mins = Math.floor(diff / 60000)
      const days = Math.floor(mins / (60*24))
      const hours = Math.floor((mins % (60*24)) / 60)
      const remMins = mins % 60
      if (days > 0) return `in ${days}d ${hours}h`
      if (hours > 0) return `in ${hours}h ${remMins}m`
      return `in ${remMins}m`
    }catch{ return '' }
  }

  // Ongoing detector for styling and ordering
  const isOngoing = (ev) => {
    try{
      const s = new Date(ev.start).getTime()
      const e = new Date(ev.end || ev.start).getTime()
      return s <= nowTs && nowTs <= e
    }catch{ return false }
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [evRes, exRes] = await Promise.all([
        api.get('/communications/events/'),
        api.get('/academics/exams/', { params: { include_history: true } }).catch(()=>({ data: [] })),
      ])
      const baseEvents = Array.isArray(evRes.data) ? evRes.data : (evRes.data?.results || [])
      const exams = Array.isArray(exRes.data) ? exRes.data : (exRes.data?.results || [])
      const examEvents = exams.map(x => {
        const dateStr = x.date || x.exam_date || x.scheduled_date || new Date().toISOString().slice(0,10)
        // Keep as local datetime strings to prevent TZ shifts in the UI
        const startStr = `${dateStr}T00:00:00`
        const endStr = `${dateStr}T23:59:59`
        return {
          id: `exam-${x.id}`,
          title: `Exam: ${x.name}`,
          description: `Exam for class ${x.klass_name || x.class_name || ''}`.trim(),
          location: '',
          start: startStr,
          end: endStr,
          all_day: true,
          audience: 'all',
          visibility: 'internal',
          created_by: null,
          created_at: x.created_at || null,
          updated_at: x.updated_at || null,
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

  useEffect(()=>{ load() }, [])

  const save = async (e) => {
    e.preventDefault(); setError('')
    try {
      const payload = {
        ...form,
        start: form.start ? new Date(form.start).toISOString() : null,
        end: form.end ? new Date(form.end).toISOString() : null,
      }
      await api.post('/communications/events/', payload)
      setIsCreateOpen(false)
      setForm({ title:'', description:'', location:'', start:'', end:'', all_day:false, audience:'all', visibility:'internal' })
      load()
      showSuccess('Event Created', `Event "${form.title}" has been successfully created.`)
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
      showError('Failed to Create Event', 'There was an error creating the event. Please try again.')
    }
  }

   // Edit handlers
  const openEdit = (ev) => {
    setSelectedEvent(ev)
    setEditForm({
      title: ev.title || '',
      description: ev.description || '',
      location: ev.location || '',
      start: ev.start ? new Date(ev.start).toISOString().slice(0,16) : '',
      end: ev.end ? new Date(ev.end).toISOString().slice(0,16) : '',
      all_day: !!ev.all_day,
      audience: ev.audience || 'all',
      visibility: ev.visibility || 'internal',
    })
    setIsEditOpen(true)
  }

  const updateEvent = async (e) => {
    e.preventDefault(); setError('')
    if (!selectedEvent) return
    try {
      const payload = {
        ...editForm,
        start: editForm.start ? new Date(editForm.start).toISOString() : null,
        end: editForm.end ? new Date(editForm.end).toISOString() : null,
      }
      await api.patch(`/communications/events/${selectedEvent.id}/`, payload)
      setIsEditOpen(false); setSelectedEvent(null)
      load()
      showSuccess('Event Updated', `Event "${editForm.title}" has been successfully updated.`)
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
      showError('Failed to Update Event', 'There was an error updating the event. Please try again.')
    }
  }

  // Completion modal state and handlers
  const [isCompleteOpen, setIsCompleteOpen] = useState(false)
  const [completeTarget, setCompleteTarget] = useState(null)
  const [completeForm, setCompleteForm] = useState({ completed: true, comment: '' })

  const openComplete = (ev) => {
    setCompleteTarget(ev)
    setCompleteForm({ completed: ev?.completed ?? true, comment: ev?.completion_comment || '' })
    setIsCompleteOpen(true)
  }

  const submitComplete = async (e) => {
    e.preventDefault()
    if (!completeTarget) return
    try {
      const { data } = await api.post(`/communications/events/${completeTarget.id}/complete/`, {
        completed: completeForm.completed,
        comment: completeForm.comment,
      })
      setEvents(prev => prev.map(x => x.id === data.id ? data : x))
      setIsCompleteOpen(false)
      showSuccess('Event updated', completeForm.completed ? 'Marked as completed.' : 'Marked as not completed.')
    } catch (err) {
      showError('Failed to update event', err?.response?.data?.detail || err?.message || 'Error')
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this event?')) return
    try {
      await api.delete(`/communications/events/${id}/`)
      setEvents(prev => prev.filter(e => e.id !== id))
      showSuccess('Event Deleted', 'Event has been successfully deleted.')
    } catch (e) {
      showError('Failed to Delete Event', 'There was an error deleting the event. Please try again.')
    }
  }

  const handleAcademicCalendar = () => {
    navigate('/admin/calendar')
  }

  const orderedEvents = useMemo(() => {
    const arr = [...filteredEvents]
    const now = nowTs
    const isOngoingLocal = (ev) => {
      try{
        const s = new Date(ev.start).getTime()
        const e = new Date(ev.end || ev.start).getTime()
        return s <= now && now <= e
      }catch{ return false }
    }
    arr.sort((a,b) => {
      const cat = (e) => isOngoingLocal(e) ? 0 : (new Date(e.start).getTime() > now ? 1 : 2)
      const ca = cat(a), cb = cat(b)
      if (ca !== cb) return ca - cb
      if (ca === 0) return new Date(a.end || a.start) - new Date(b.end || b.start) // ongoing: ending sooner first
      if (ca === 1) return new Date(a.start) - new Date(b.start) // upcoming: sooner first
      return new Date(b.end || b.start) - new Date(a.end || a.start) // past: most recent first
    })
    return arr
  }, [filteredEvents, nowTs])

  const grouped = useMemo(()=> groupByDateOrdered(orderedEvents), [orderedEvents])
  const monthDays = useMemo(()=> buildMonthGrid(month), [month])
  const eventsByDay = useMemo(()=>{
    const map = {}
    for (const ev of filteredEvents){
      const key = ymdLocal(ev.start)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [filteredEvents])

  return (
    <React.Fragment>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">School Events</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">Modern View</span>
          </div>
          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto overflow-x-auto -mx-1 px-1">
            <button onClick={handleAcademicCalendar} className="shrink-0 inline-flex items-center gap-0 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition" aria-label="Academic Calendar">
              <span>📆</span><span className="hidden sm:inline">Academic Calendar</span>
            </button>
            <button onClick={()=>setViewMode(v=> v==='list' ? 'calendar' : 'list')} className="shrink-0 px-2.5 sm:px-3.5 py-2 rounded-lg border bg-white hover:bg-gray-50 shadow-sm" aria-label="Toggle View">
              <span className="sm:hidden">{viewMode==='list' ? '📅' : '📋'}</span>
              <span className="hidden sm:inline">{viewMode==='list' ? 'Calendar View' : 'List View'}</span>
            </button>
            {viewMode==='calendar' && (
              <div className="shrink-0 flex items-center gap-2">
                <button className="px-2.5 py-2 rounded-lg border bg-white hover:bg-gray-50 shadow-sm" onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()-1, 1))}>Prev</button>
                <div className="text-sm font-medium w-32 sm:w-36 text-center">{month.toLocaleString(undefined, { month: 'long', year: 'numeric'})}</div>
                <button className="px-2.5 py-2 rounded-lg border bg-white hover:bg-gray-50 shadow-sm" onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()+1, 1))}>Next</button>
              </div>
            )}
            <button onClick={()=>setIsCreateOpen(true)} className="shrink-0 inline-flex items-center gap-0 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg bg-indigo-600 text-white shadow-sm hover:bg-indigo-700" aria-label="Create Event">
              <span>＋</span><span className="hidden sm:inline">Create Event</span>
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}

        {viewMode==='calendar' && (
          <div className="bg-white rounded shadow p-3">
            <div className="grid grid-cols-7 text-xs font-medium text-gray-500 mb-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="px-2 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((d,i)=>{
                const key = ymdLocal(d)
                const inMonth = d.getMonth()===month.getMonth()
                const items = eventsByDay[key] || []
                return (
                  <div key={i} className={`border rounded min-h-[88px] p-1 ${inMonth? 'bg-white':'bg-gray-50'}`}>
                    <div className={`text-xs mb-1 ${inMonth? 'text-gray-700':'text-gray-400'}`}>{d.getDate()}</div>
                    <div className="space-y-1">
                      {items.slice(0,3).map(ev => (
                        <div key={ev.id} className={`text-[11px] truncate px-1.5 py-0.5 rounded cursor-pointer border font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 ${ev.source==='exam' ? 'bg-purple-100 text-purple-800 border-purple-300 focus:ring-purple-200' : (isExpired(ev) ? 'bg-rose-100 text-rose-800 border-rose-300 focus:ring-rose-200' : 'bg-blue-100 text-blue-800 border-blue-300 focus:ring-blue-200')}`} title={ev.title}
                          onClick={()=>openEdit(ev)}>
                          <span>{ev.title}</span>
                          {!isExpired(ev) && countdownLabel(ev.start) && (
                            <span className="ml-1 text-[10px] px-1 py-0 rounded bg-white/60 border border-current/20 rounded">
                              {countdownLabel(ev.start)}
                            </span>
                          )}
                        </div>
                      ))}
                      {items.length>3 && <div className="text-[10px] text-gray-500">+{items.length-3} more</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded shadow divide-y" style={{ display: viewMode==='list' ? 'block' : 'none' }}>
          {loading && <div className="p-4 text-sm text-gray-600">Loading...</div>}
          {!loading && grouped.length === 0 && (
            <div className="p-6 text-center text-gray-500 text-sm">No events yet</div>
          )}
          {!loading && grouped.map(([date, items]) => (
            <div key={date} className="p-4">
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                <span>{date}</span>
              </div>
              <div className="space-y-3">
                {items.map(ev => (
                  <div key={ev.id} className={`border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm hover:shadow-md transition ${isExpired(ev) ? 'bg-rose-50 border-rose-200' : 'bg-white'} ${isOngoing(ev) ? 'border-l-4 border-l-emerald-500' : (!isExpired(ev) ? 'border-l-4 border-l-indigo-500' : 'border-l-4 border-l-rose-500')}`}>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold tracking-tight truncate ${isExpired(ev) ? 'text-rose-700' : 'text-gray-900'}`}>{ev.title}</div>
                      <div className="text-xs text-gray-600 truncate mt-0.5">
                        {ev.all_day ? 'All day' : `${new Date(ev.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${new Date(ev.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                      </div>
                      {ev.location && <div className="text-xs text-gray-600 truncate">📍 {ev.location}</div>}
                      {ev.description && <div className="text-xs text-gray-600 truncate">{ev.description}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap overflow-x-auto sm:overflow-visible -mx-1 px-1">
                      <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">{ev.source==='exam' ? 'exam' : ev.audience}</span>
                      <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">{ev.visibility}</span>
                      {isExpired(ev) && <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">Expired</span>}
                      {ev.completed && <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Done</span>}
                      {!isExpired(ev) && countdownLabel(ev.start) && (
                        <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">{countdownLabel(ev.start)}</span>
                      )}
                      <button onClick={()=>openComplete(ev)} className="shrink-0 text-sm px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 shadow-sm">{ev.completed ? 'Update Status' : 'Mark Done'}</button>
                      <button onClick={()=>openEdit(ev)} className="shrink-0 text-sm px-3 py-1.5 rounded-lg border bg-white hover:bg-blue-50 text-blue-700 border-blue-200">Edit</button>
                      <button onClick={()=>remove(ev.id)} className="shrink-0 text-sm px-3 py-1.5 rounded-lg border bg-white hover:bg-rose-50 text-rose-700 border-rose-200">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={isCreateOpen} onClose={()=>setIsCreateOpen(false)} title="Create Event" size="lg">
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <input className="border p-2 rounded md:col-span-2" placeholder="Title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} required />
          <input className="border p-2 rounded md:col-span-2" placeholder="Location" value={form.location} onChange={e=>setForm({...form, location:e.target.value})} />
          <textarea className="border p-2 rounded md:col-span-2" placeholder="Description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
          <label className="text-sm text-gray-700">Start</label>
          <label className="text-sm text-gray-700">End</label>
          <input type="datetime-local" className="border p-2 rounded" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} required />
          <input type="datetime-local" className="border p-2 rounded" value={form.end} onChange={e=>setForm({...form, end:e.target.value})} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.all_day} onChange={e=>setForm({...form, all_day:e.target.checked})} /> All day
          </label>
          <div></div>
          <select className="border p-2 rounded" value={form.audience} onChange={e=>setForm({...form, audience:e.target.value})}>
            <option value="all">All</option>
            <option value="students">Students</option>
            <option value="teachers">Teachers</option>
            <option value="parents">Parents</option>
            <option value="staff">Staff</option>
          </select>
          <select className="border p-2 rounded" value={form.visibility} onChange={e=>setForm({...form, visibility:e.target.value})}>
            <option value="internal">Internal</option>
            <option value="public">Public</option>
          </select>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setIsCreateOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={isCompleteOpen} onClose={()=>setIsCompleteOpen(false)} title="Event Completion" size="md">
        <form onSubmit={submitComplete} className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!completeForm.completed} onChange={e=>setCompleteForm(f=>({...f, completed: e.target.checked}))} />
            Mark as completed
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-gray-600">Comment (optional)</span>
            <textarea className="border rounded p-2" rows={4} value={completeForm.comment} onChange={e=>setCompleteForm(f=>({...f, comment:e.target.value}))} placeholder="Notes about how the event went..." />
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setIsCompleteOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={isEditOpen} onClose={()=>setIsEditOpen(false)} title="Edit Event" size="lg">
        <form onSubmit={updateEvent} className="grid gap-3 md:grid-cols-2">
          <input className="border p-2 rounded md:col-span-2" placeholder="Title" value={editForm.title} onChange={e=>setEditForm({...editForm, title:e.target.value})} required />
          <input className="border p-2 rounded md:col-span-2" placeholder="Location" value={editForm.location} onChange={e=>setEditForm({...editForm, location:e.target.value})} />
          <textarea className="border p-2 rounded md:col-span-2" placeholder="Description" value={editForm.description} onChange={e=>setEditForm({...editForm, description:e.target.value})} />
          <label className="text-sm text-gray-700">Start</label>
          <label className="text-sm text-gray-700">End</label>
          <input type="datetime-local" className="border p-2 rounded" value={editForm.start} onChange={e=>setEditForm({...editForm, start:e.target.value})} required />
          <input type="datetime-local" className="border p-2 rounded" value={editForm.end} onChange={e=>setEditForm({...editForm, end:e.target.value})} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.all_day} onChange={e=>setEditForm({...editForm, all_day:e.target.checked})} /> All day
          </label>
          <div></div>
          <select className="border p-2 rounded" value={editForm.audience} onChange={e=>setEditForm({...editForm, audience:e.target.value})}>
            <option value="all">All</option>
            <option value="students">Students</option>
            <option value="teachers">Teachers</option>
            <option value="parents">Parents</option>
            <option value="staff">Staff</option>
          </select>
          <select className="border p-2 rounded" value={editForm.visibility} onChange={e=>setEditForm({...editForm, visibility:e.target.value})}>
            <option value="internal">Internal</option>
            <option value="public">Public</option>
          </select>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setIsEditOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Update</button>
          </div>
        </form>
      </Modal>
    </React.Fragment>
  )
}
