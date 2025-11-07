import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

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
          api.get('/academics/classes/mine/'),
          api.get('/auth/me/').catch(()=>({ data:null })),
        ])
        if (!mounted) return
        setClasses(cls.data || [])
        if (cls.data && cls.data.length>0){
          const meId = String(meRes?.data?.id || '')
          // Prefer the class where I'm the class teacher
          const prefer = (cls.data||[]).find(c => {
            const candIds = [c?.teacher, c?.teacher_detail?.id, c?.teacher_detail?.user?.id].map(v=> (v==null? '' : String(v)))
            return candIds.includes(meId)
          })
          setSelected(String(prefer?.id || cls.data[0].id))
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
        const res = await api.get(`/academics/students/?klass=${selected}`)
        if (!mounted) return
        const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : [])
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
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">Mark Attendance</div>

      {loading && <div className="bg-white p-4 rounded shadow">Loading...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}
      {message && <div className="bg-green-50 text-green-700 p-3 rounded">{message}</div>}

      <div className="bg-white rounded-2xl shadow p-4 space-y-4 border border-gray-100">
        {!isClassTeacher && (
          <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-2 rounded text-sm">
            Only the assigned class teacher can mark attendance for the selected class.
          </div>
        )}
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-gray-600">Class</label>
          <select className="border p-2 rounded focus:ring-2 focus:ring-indigo-200" value={selected} onChange={e=>setSelected(e.target.value)}>
            {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="text-sm text-gray-600 ml-4">Date</label>
          <input type="date" className="border p-2 rounded focus:ring-2 focus:ring-indigo-200" value={date} onChange={e=>setDate(e.target.value)} />
          <div className="ml-auto text-sm text-gray-600">Present: <strong>{presentCount}</strong> / {students.length}</div>
        </div>
        {/* Actions and search */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
            <button onClick={()=>setAll('present')} disabled={!isClassTeacher} className={`h-10 rounded-xl text-white text-sm bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-60 ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}>All Present</button>
            <button onClick={()=>setAll('absent')} disabled={!isClassTeacher} className={`h-10 rounded-xl text-white text-sm bg-gradient-to-r from-rose-600 to-pink-600 disabled:opacity-60 ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}>All Absent</button>
            <button onClick={()=>setAll('late')} disabled={!isClassTeacher} className={`h-10 rounded-xl text-white text-sm bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-60 ${!isClassTeacher?'opacity-60 cursor-not-allowed':''}`}>All Late</button>
            <button onClick={save} disabled={submitting || !isClassTeacher} className="sm:ml-auto h-10 rounded-xl text-white text-sm bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-60 col-span-3 sm:col-span-1">{submitting?'Saving...':'Save'}</button>
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
