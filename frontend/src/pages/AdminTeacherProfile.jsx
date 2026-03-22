import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useNotification } from '../components/NotificationContext'
import { 
  User, 
  Mail, 
  Phone, 
  Hash, 
  BookOpen, 
  School, 
  ArrowLeft, 
  Save, 
  Search, 
  CheckCircle2, 
  ShieldCheck,
  UserCircle,
  LayoutGrid
} from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function AdminTeacherProfile(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [teacher, setTeacher] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [classes, setClasses] = useState([])
  const [subjectsCatalog, setSubjectsCatalog] = useState([])
  const [subjectSearch, setSubjectSearch] = useState('')
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set())
  const { showSuccess, showError } = useNotification()

  // editable form fields
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone: '',
    subjects: '',
    klass: '',
    tsc_number: '',
  })

  useEffect(()=>{
    let cancelled = false
    async function load(){
      try {
        setLoading(true)
        const [tRes, cRes, sRes] = await Promise.all([
          api.get(`/academics/teachers/${id}/`),
          api.get('/academics/classes/'),
          api.get('/academics/subjects/')
        ])
        if (!cancelled) {
          setTeacher(tRes.data)
          // Coerce to array in case API is paginated {results: [...]} or returns non-array
          const cls = Array.isArray(cRes.data) ? cRes.data : (Array.isArray(cRes.data?.results) ? cRes.data.results : [])
          setClasses(cls)
          const subs = Array.isArray(sRes.data) ? sRes.data : (Array.isArray(sRes.data?.results) ? sRes.data.results : [])
          setSubjectsCatalog(subs)
          setForm({
            first_name: tRes.data?.user?.first_name || '',
            last_name: tRes.data?.user?.last_name || '',
            email: tRes.data?.user?.email || '',
            username: tRes.data?.user?.username || '',
            phone: tRes.data?.user?.phone || '',
            subjects: tRes.data?.subjects || '',
            klass: tRes.data?.klass || '',
            tsc_number: tRes.data?.tsc_number || '',
          })
          // Initialize selection from existing subjects string (match by code or name)
          const subjStr = (tRes.data?.subjects || '').toLowerCase()
          const preSel = new Set(
            (subs||[])
              .filter(s=> subjStr.includes((s.code||'').toLowerCase()) || subjStr.includes((s.name||'').toLowerCase()))
              .map(s=> String(s.id))
          )
          setSelectedSubjectIds(preSel)
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load teacher profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return ()=>{ cancelled = true }
  },[id])

  const subjects = (teacher?.subjects || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const save = async (e) => {
    e?.preventDefault?.()
    if (!teacher?.user?.id) return
    try {
      setSaving(true)
      // 1) Update user personal info (no password)
      await api.patch('/auth/users/update/', {
        user_id: teacher.user.id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        username: form.username,
        phone: form.phone,
      })
      // 2) Update teacher profile subjects and klass
      const body = { subjects: form.subjects || '' }
      if (form.tsc_number !== undefined) body.tsc_number = form.tsc_number || null
      // Allow clearing class by setting null
      if (form.klass === '' || form.klass === null) {
        body.klass = null
      } else {
        body.klass = form.klass
      }
      await api.patch(`/academics/teachers/${id}/`, body)
      // 3) If a class selected, set class teacher to this user (best-effort)
      if (form.klass) {
        await api.patch(`/academics/classes/${form.klass}/`, { teacher: teacher.user.id })
      }
      // reload
      const { data } = await api.get(`/academics/teachers/${id}/`)
      setTeacher(data)
      setForm(f => ({ ...f, subjects: data.subjects || '', klass: data.klass || '' }))
      showSuccess('Profile Updated', 'Teacher profile and assignments have been updated.')
    } catch (err) {
      showError('Update Failed', 'Could not update teacher. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 text-left">
      {/* Premium Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={()=>navigate(-1)}
                className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-gray-100"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xl shadow-sm ring-2 ring-white">
                  {(teacher?.user?.first_name?.[0] || teacher?.user?.username?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck size={16} className="text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Faculty Profile</span>
                  </div>
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                    {teacher?.user?.first_name} {teacher?.user?.last_name}
                  </h1>
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                    <UserCircle size={12} />
                    @{teacher?.user?.username}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/admin/teachers" className="h-11 px-5 rounded-xl bg-white border-2 border-gray-100 text-gray-600 font-black text-[10px] uppercase tracking-widest hover:border-gray-900 hover:text-gray-900 transition-all flex items-center gap-2">
                <LayoutGrid size={16} />
                Directory
              </Link>
              <button 
                onClick={save}
                disabled={saving || loading}
                className="h-11 px-8 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Processing...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column: Personal Information */}
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Identity & Contact</h2>
                    <p className="text-xs font-medium text-gray-500 italic">Personal registration details</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                {loading ? (
                  <div className="space-y-6">
                    <div className="h-12 bg-gray-50 rounded-2xl animate-pulse" />
                    <div className="h-12 bg-gray-50 rounded-2xl animate-pulse" />
                    <div className="h-12 bg-gray-50 rounded-2xl animate-pulse" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">First Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none" value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Last Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none" value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 text-left">Primary Email</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input type="email" className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 text-left">Portal Username</label>
                      <div className="relative group">
                        <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-left md:col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 text-left">Contact Number</label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <BookOpen size={20} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Academic Expertise</h2>
                    <p className="text-xs font-medium text-gray-500 italic">Subject allocations and search</p>
                  </div>
                </div>
                <div className="px-4 py-1.5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-black uppercase tracking-widest">
                  {selectedSubjectIds.size} Subjects
                </div>
              </div>
              
              <div className="p-8">
                <div className="space-y-6">
                  <div className="relative group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input 
                      value={subjectSearch} 
                      onChange={e=>setSubjectSearch(e.target.value)}
                      placeholder="Search global curriculum..."
                      className="h-12 w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold focus:border-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div className="bg-gray-50 rounded-[2rem] border-2 border-gray-100 p-6 max-h-[400px] overflow-y-auto custom-scrollbar text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                      {(subjectsCatalog||[])
                        .filter(s=>{
                          const q = subjectSearch.trim().toLowerCase()
                          if(!q) return true
                          return (s.code||'').toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q)
                        })
                        .map(s=>{
                          const sid = String(s.id)
                          const isChecked = selectedSubjectIds.has(sid)
                          return (
                            <button
                              type="button"
                              key={sid}
                              onClick={() => {
                                setSelectedSubjectIds(prev => {
                                  const next = new Set(Array.from(prev))
                                  if(!isChecked) next.add(sid); else next.delete(sid)
                                  const names = (subjectsCatalog||[])
                                    .filter(x=> next.has(String(x.id)))
                                    .map(x=> x.name || x.code || '')
                                    .filter(Boolean)
                                  setForm(f=>({ ...f, subjects: names.join(', ') }))
                                  return next
                                })
                              }}
                              className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-white text-gray-600 hover:border-indigo-100'}`}
                            >
                              <div className="flex items-center gap-3 text-left overflow-hidden">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${isChecked ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                                  {s.code}
                                </div>
                                <span className="text-xs font-bold truncate">{s.name}</span>
                              </div>
                              {isChecked && <CheckCircle2 size={16} className="shrink-0" />}
                            </button>
                          )
                        })}
                    </div>
                  </div>

                  {form.subjects && (
                    <div className="flex flex-wrap gap-2 pt-2 text-left">
                      {form.subjects.split(',').map(s=>s.trim()).filter(Boolean).map((s,i)=>(
                        <span key={i} className="px-3 py-1 rounded-full text-[10px] font-black bg-white border-2 border-purple-100 text-purple-600 uppercase tracking-widest">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Deployment & Meta */}
          <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <School size={20} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Staff Deployment</h2>
                    <p className="text-xs font-medium text-gray-500 italic text-left">Official designations</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-6 text-left">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 text-left">T.S.C Number</label>
                  <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none" value={form.tsc_number} onChange={e=>setForm({...form, tsc_number:e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 text-left">Primary Class</label>
                  <div className="relative group">
                    <School className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <select 
                      className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none appearance-none" 
                      value={form.klass || ''} 
                      onChange={e=>setForm({...form, klass:e.target.value})}
                    >
                      <option value="">No Assigned Class</option>
                      {(Array.isArray(classes) ? classes : []).map(c => (
                        <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 px-1 text-left">Selecting a class establishes this faculty as Class Teacher</p>
                </div>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-gray-900 rounded-[2.5rem] p-8 shadow-xl text-left">
              <h3 className="text-white font-black uppercase tracking-widest text-[10px] mb-6 text-left">Employment Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Profile Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white font-black text-[10px] uppercase tracking-widest">Active Member</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/10 text-left">
                  <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Permissions</span>
                  <span className="text-white font-black text-[10px] uppercase tracking-widest">Faculty Access</span>
                </div>
                <div className="flex items-center justify-between py-3 text-left">
                  <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Joined</span>
                  <span className="text-white font-black text-[10px] uppercase tracking-widest">
                    {teacher?.user?.date_joined ? new Date(teacher.user.date_joined).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
