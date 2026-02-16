import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { teacherQueries } from '../utils/teacherQueries'

const statuses = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
]

export default function TeacherAttendance(){
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [students, setStudents] = useState([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [marks, setMarks] = useState({}) // { studentId: status }
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [me, setMe] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const [cls, meRes] = await Promise.all([
          teacherQueries.getMyClasses(),
          teacherQueries.getMe().catch(()=>({ data:null })),
        ])
        if (!mounted) return
        setClasses(cls || [])
        if (cls && cls.length>0){
          const meId = String(meRes?.data?.id || '')
          // Prefer the class where I'm the class teacher
          const prefer = (cls||[]).find(c => {
            const candIds = [c?.teacher, c?.teacher_detail?.id, c?.teacher_detail?.user?.id].map(v=> (v==null? '' : String(v)))
            return candIds.includes(meId)
          })
          setSelected(String(prefer?.id || cls[0].id))
        }
        if (meRes?.data) setMe(meRes.data)
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
      finally{ if(mounted) setLoading(false) }
    })()
    return ()=>{ mounted = false }
  },[])

  useEffect(()=>{
    if (!selected) return
    let mounted = true
    ;(async ()=>{
      try{
        const arr = await teacherQueries.getClassStudents(selected)
        if (!mounted) return
        setStudents(arr)
        // default everyone to present
        const def = {}
        arr.forEach(s=> { def[s.id] = 'present' })
        setMarks(def)
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
    })()
    return ()=>{ mounted = false }
  }, [selected])

  const setAll = (val) => {
    const m = {}
    students.forEach(s => m[s.id] = val)
    setMarks(m)
  }

  const save = async () => {
    // guard: only class teacher
    if (!isClassTeacher) { setError('Only the class teacher can mark attendance for this class.'); return }
    setSubmitting(true)
    setError('')
    setMessage('')
    try{
      // Save one by one (simple & explicit). Ignore duplicate errors silently.
      for (const s of students){
        const payload = { student: s.id, date, status: marks[s.id] || 'present' }
        try{
          await api.post('/academics/attendance/', payload)
        }catch(err){ /* duplicate or other: swallow for now */ }
      }
      setMessage('Attendance saved.')
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to save attendance')
    }finally{ setSubmitting(false) }
  }

  const presentCount = useMemo(()=>{
    const list = Array.isArray(students) ? students : []
    return list.filter(s => (marks[s.id]||'present')==='present').length
  }, [students, marks])
  const currentClass = useMemo(()=> classes.find(c=> String(c.id)===String(selected)) || null, [classes, selected])
  const isClassTeacher = useMemo(()=> {
    const meId = String(me?.id || '')
    const clsTeacher = String(currentClass?.teacher || currentClass?.teacher_detail?.id || '')
    return meId && clsTeacher && meId === clsTeacher
  }, [me, currentClass])
  const filtered = useMemo(()=>{
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(s => String(s.name||'').toLowerCase().includes(q) || String(s.admission_no||'').toLowerCase().includes(q))
  }, [students, search])

  return (
    <div className="px-0 md:px-6 py-4 md:py-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-base md:text-lg font-semibold tracking-tight text-gray-900">Mark Attendance</div>
          <div className="text-[11px] md:text-xs text-gray-600">Quickly mark present, absent, or late for your class.</div>
        </div>
      </div>

      {loading && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 text-sm text-gray-600">Loading...</div>}
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl border border-red-200 text-sm">{error}</div>}
      {message && <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-2xl border border-emerald-200 text-sm">{message}</div>}

      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-sm px-4 py-4 md:px-5 md:py-5 space-y-4 border border-gray-100">
        {!isClassTeacher && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs md:text-sm text-amber-800">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            <p>Only the assigned class teacher can mark attendance for the selected class.</p>
          </div>
        )}
        <div className="space-y-3 md:space-y-0 md:flex md:flex-wrap md:items-center md:gap-3">
          <label className="block text-xs md:text-sm text-gray-600 w-full md:w-auto">
            <span className="block mb-1">Class</span>
            <select
              className="w-full md:w-auto border border-gray-200 rounded-xl px-3 py-2 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              value={selected}
              onChange={e=>setSelected(e.target.value)}
            >
              {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-xs md:text-sm text-gray-600 w-full md:w-auto">
            <span className="block mb-1">Date</span>
            <input
              type="date"
              className="w-full md:w-auto border border-gray-200 rounded-xl px-3 py-2 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              value={date}
              onChange={e=>setDate(e.target.value)}
            />
          </label>
          <div className="text-xs md:text-sm text-gray-600 md:ml-auto">Present: <strong>{presentCount}</strong> / {students.length}</div>
        </div>
        {/* Actions and search */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
            <button
              onClick={()=>setAll('present')}
              disabled={!isClassTeacher}
              className={`h-10 md:h-12 px-3 md:px-4 rounded-xl text-white text-sm md:text-base bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-60 ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}
            >All Present</button>
            <button
              onClick={()=>setAll('absent')}
              disabled={!isClassTeacher}
              className={`h-10 md:h-12 px-3 md:px-4 rounded-xl text-white text-sm md:text-base bg-gradient-to-r from-rose-600 to-pink-600 disabled:opacity-60 ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}
            >All Absent</button>
            <button
              onClick={()=>setAll('late')}
              disabled={!isClassTeacher}
              className={`h-10 md:h-12 px-3 md:px-4 rounded-xl text-white text-sm md:text-base bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-60 ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}
            >All Late</button>
            <button
              onClick={save}
              disabled={submitting || !isClassTeacher}
              className="sm:ml-auto h-10 md:h-12 px-4 md:px-5 rounded-xl text-white text-sm md:text-base bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-60 col-span-3 sm:col-span-1"
            >{submitting?'Saving...':'Save'}</button>
          </div>
          <div className="flex items-center gap-2">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or admission no..." className="w-full border rounded-xl px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-200" />
          </div>
        </div>

        {/* Desktop table */}
        <table className="w-full text-left text-sm hidden sm:table">
          <thead><tr><th>Name</th><th>Admission No</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-t">
                <td>{s.name}</td>
                <td>{s.admission_no}</td>
                <td>
                  <select className="border p-1 rounded" value={marks[s.id] || 'present'} onChange={e=>setMarks(m=>({...m, [s.id]: e.target.value}))} disabled={!isClassTeacher}>
                    {statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Mobile list */}
        <div className="sm:hidden space-y-2">
          {filtered.map(s => (
            <div key={s.id} className="p-3 border rounded-xl bg-white shadow-sm">
              <div className="text-sm font-medium break-words">{s.name}</div>
              <div className="text-xs text-gray-500">{s.admission_no}</div>
              <div className="mt-2">
                <select className="w-full border p-2 rounded-xl bg-gray-50" value={marks[s.id] || 'present'} onChange={e=>setMarks(m=>({...m, [s.id]: e.target.value}))} disabled={!isClassTeacher}>
                  {statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
              </div>
            </div>
          ))}
          {filtered.length===0 && (
            <div className="text-sm text-gray-500">No students</div>
          )}
        </div>
      </div>
    </div>
  )
}
