import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, List, Search } from 'lucide-react'
import api from '../api'

function groupByDate(events){
  const by = {}
  for (const e of events) {
    const key = new Date(e.start).toISOString().slice(0,10)
    if (!by[key]) by[key] = []
    by[key].push(e)
  }
  const keys = Object.keys(by).sort()
  return keys.map(k => [k, by[k].sort((a,b)=> new Date(a.start) - new Date(b.start))])
}

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

export default function TeacherEvents(){
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar'
  const [month, setMonth] = useState(()=>{ const d=new Date(); d.setDate(1); return d })
  const [query, setQuery] = useState('')
  const [audience, setAudience] = useState('all')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get('/communications/events/')
      setEvents(Array.isArray(data)? data : (data?.results || []))
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  const filtered = useMemo(()=>{
    let list = events
    if (audience !== 'all') list = list.filter(e=> String(e.audience||'').toLowerCase() === audience)
    if (query.trim()){
      const q = query.toLowerCase()
      list = list.filter(e=>
        String(e.title||'').toLowerCase().includes(q) ||
        String(e.description||'').toLowerCase().includes(q) ||
        String(e.location||'').toLowerCase().includes(q)
      )
    }
    return list
  }, [events, audience, query])

  const grouped = useMemo(()=> groupByDate(filtered), [filtered])
  const monthDays = useMemo(()=> buildMonthGrid(month), [month])
  const eventsByDay = useMemo(()=>{
    const map = {}
    for (const ev of filtered){
      const key = new Date(ev.start).toISOString().slice(0,10)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [filtered])

  return (
    <div className="teacher-phone-screen">
      <div className="teacher-phone-status" aria-hidden>
        <span>9:41</span>
        <span>▮▮▮  Wi-Fi  ▰</span>
      </div>

      <div className="teacher-screen-title">
        <h1>School Events</h1>
        <div className="teacher-title-actions">
          <button type="button" onClick={()=>setViewMode(v=> v==='list' ? 'calendar' : 'list')} aria-label="Toggle view">
            {viewMode==='list' ? <CalendarDays className="h-5 w-5" /> : <List className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_112px] sm:grid-cols-[minmax(0,1fr)_150px] gap-3 mb-4">
        <label className="teacher-reference-search">
          <Search className="h-4 w-4" />
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search events..." />
        </label>
        <select
          value={audience}
          onChange={e=>setAudience(e.target.value)}
          className="h-12 w-full rounded-2xl border border-gray-200 bg-white shadow-card px-3 text-[13px] font-extrabold text-gray-700 focus-soft"
          aria-label="Audience"
        >
          <option value="all">All</option>
          <option value="students">Students</option>
          <option value="teachers">Teachers</option>
          <option value="parents">Parents</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}

      {viewMode==='calendar' && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-card p-3">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              className="h-10 w-10 rounded-2xl border border-gray-200 bg-white shadow-soft grid place-items-center text-gray-700"
              onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()-1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-sm font-extrabold tracking-tight text-gray-900">
              {month.toLocaleString(undefined, { month: 'long', year: 'numeric'})}
            </div>
            <button
              type="button"
              className="h-10 w-10 rounded-2xl border border-gray-200 bg-white shadow-soft grid place-items-center text-gray-700"
              onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()+1, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-[11px] font-extrabold text-gray-500 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((d,i)=>{
              const key = d.toISOString().slice(0,10)
              const inMonth = d.getMonth()===month.getMonth()
              const items = eventsByDay[key] || []
              return (
                <div key={i} className={`border rounded-2xl min-h-[88px] p-2 ${inMonth? 'bg-white':'bg-gray-50'}`}>
                  <div className={`text-xs mb-1 font-bold ${inMonth? 'text-gray-700':'text-gray-400'}`}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {items.slice(0,3).map(ev => (
                      <div key={ev.id} className="text-[11px] font-bold truncate px-1.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100" title={ev.title}>
                        {ev.title}
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

      <div style={{ display: viewMode==='list' ? 'block' : 'none' }}>
        {loading && <div className="teacher-reference-card">Loading events...</div>}
        {!loading && grouped.length === 0 && <div className="teacher-reference-card">No events yet.</div>}

        {!loading && grouped.map(([date, items]) => (
          <section key={date} className="mb-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-gray-500">{date}</div>
              <div className="h-px flex-1 bg-gray-200/80" />
            </div>
            <div className="space-y-3">
              {items.map(ev => (
                <article key={ev.id} className="rounded-2xl border border-gray-100 bg-white shadow-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-extrabold tracking-tight text-gray-900 truncate">{ev.title}</div>
                      <div className="text-[12px] font-bold text-gray-600 mt-1">
                        {ev.all_day ? 'All day' : `${new Date(ev.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${new Date(ev.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                      </div>
                      {ev.location && <div className="text-[12px] font-bold text-gray-600 truncate mt-1">📍 {ev.location}</div>}
                      {ev.description && <div className="text-[12px] font-semibold text-gray-500 truncate mt-1">{ev.description}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-extrabold text-gray-700">
                        {ev.audience}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-extrabold text-gray-700">
                        {ev.visibility}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
