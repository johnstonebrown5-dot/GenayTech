import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Link } from 'react-router-dom'

export default function AdminDuties(){
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [duties, setDuties] = useState([])
  const [teachers, setTeachers] = useState([])
  const [status, setStatus] = useState('pending')
  const [teacherId, setTeacherId] = useState('')
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const load = async()=>{
    try{
      setLoading(true)
      setError('')
      const params = new URLSearchParams()
      if (status && status !== 'all') params.set('status', status)
      if (teacherId) params.set('teacher', teacherId)
      const [dutiesRes, teachersRes] = await Promise.all([
        api.get(`/academics/teacher_duties/?${params.toString()}`),
        api.get('/academics/teachers/')
      ])
      const list = Array.isArray(dutiesRes.data) ? dutiesRes.data : (dutiesRes.data?.results || [])
      setDuties(list)
      const tlist = Array.isArray(teachersRes.data) ? teachersRes.data : (teachersRes.data?.results || [])
      setTeachers(tlist)
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to load duties')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])
  useEffect(()=>{ load() }, [status, teacherId])

  const filtered = useMemo(()=>{
    if (!q) return duties
    const s = q.toLowerCase()
    return (duties||[]).filter(d =>
      String(d.title||'').toLowerCase().includes(s) ||
      String(d.description||'').toLowerCase().includes(s) ||
      String(d.teacher_detail?.first_name||'').toLowerCase().includes(s) ||
      String(d.teacher_detail?.last_name||'').toLowerCase().includes(s)
    )
  }, [duties, q])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <div className="text-xl font-bold">Teacher Duties</div>
          <div className="text-sm text-slate-600">Assign, track and remind duties for teachers</div>
        </div>
        <button onClick={()=> setModalOpen(true)} className="px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black/90 text-sm shadow-sm">New Duty</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3">
        <div className="grid sm:grid-cols-4 gap-2">
          <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Search title, description, teacher..." className="border rounded-lg px-3 py-2 text-sm" />
          <select value={status} onChange={e=> setStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="canceled">Canceled</option>
            <option value="all">All</option>
          </select>
          <select value={teacherId} onChange={e=> setTeacherId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Teachers</option>
            {teachers.map(t => (
              <option key={t.id} value={t.user?.id}>{t.user?.first_name || t.user?.username} {t.user?.last_name||''}</option>
            ))}
          </select>
          <button onClick={load} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">Refresh</button>
        </div>
      </div>

      {loading && <div className="p-3 text-slate-600">Loading...</div>}
      {error && <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Title</th>
                <th className="text-left p-2 border-b">Teacher</th>
                <th className="text-left p-2 border-b">Due</th>
                <th className="text-left p-2 border-b">Status</th>
                <th className="text-left p-2 border-b">Created</th>
                <th className="text-right p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/60">
                  <td className="p-2 border-b">
                    <div className="font-medium">{d.title}</div>
                    {d.description && <div className="text-xs text-slate-600 line-clamp-2 max-w-[520px]">{d.description}</div>}
                  </td>
                  <td className="p-2 border-b">{d.teacher_detail?.first_name || d.teacher_detail?.username} {d.teacher_detail?.last_name||''}</td>
                  <td className="p-2 border-b">{d.due_date || '—'}</td>
                  <td className="p-2 border-b">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${d.status==='pending'?'bg-amber-50 text-amber-700 border-amber-200': d.status==='done'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-slate-50 text-slate-600 border-slate-200'}`}>{d.status}</span>
                  </td>
                  <td className="p-2 border-b">{new Date(d.created_at).toLocaleString()}</td>
                  <td className="p-2 border-b text-right">
                    {d.status !== 'done' && (
                      <button onClick={async()=>{ try{ await api.post(`/academics/teacher_duties/${d.id}/mark-done/`); load() }catch{} }} className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">Mark Done</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-600" colSpan={6}>No duties match the filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <NewDutyModal onClose={()=> setModalOpen(false)} teachers={teachers} onCreated={()=>{ setModalOpen(false); load() }} />
      )}
    </div>
  )
}

function NewDutyModal({ onClose, onCreated, teachers }){
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [teacher, setTeacher] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [remindDaily, setRemindDaily] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async()=>{
    try{
      setSaving(true)
      setError('')
      if(!title || !teacher){
        setError('Title and Teacher are required')
        setSaving(false)
        return
      }
      await api.post('/academics/teacher_duties/', {
        title,
        description,
        teacher: teacher, // expects USER id
        due_date: dueDate || null,
        remind_daily: remindDaily,
      })
      onCreated?.()
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to create duty')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-slate-900">New Duty</div>
          <button onClick={onClose} className="text-slate-600 hover:text-black">✕</button>
        </div>
        {error && <div className="p-2 mb-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}
        <div className="grid gap-2">
          <label className="text-sm">Title<input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={title} onChange={e=> setTitle(e.target.value)} placeholder="e.g., Supervise morning prep" /></label>
          <label className="text-sm">Description<textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]" value={description} onChange={e=> setDescription(e.target.value)} placeholder="Optional details..." /></label>
          <label className="text-sm">Teacher<select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={teacher} onChange={e=> setTeacher(e.target.value)}>
            <option value="">Select a teacher</option>
            {teachers.map(t=> (
              <option key={t.id} value={t.user?.id}>{t.user?.first_name || t.user?.username} {t.user?.last_name||''}</option>
            ))}
          </select></label>
          <label className="text-sm">Due Date<input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={dueDate} onChange={e=> setDueDate(e.target.value)} /></label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={remindDaily} onChange={e=> setRemindDaily(e.target.checked)} /> Remind daily</label>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-60">{saving? 'Saving...':'Create'}</button>
        </div>
      </div>
    </div>
  )
}
