import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { useNotification } from '../components/NotificationContext'
import { Link } from 'react-router-dom'
import { 
  BookOpen, 
  Plus, 
  Users, 
  UserCheck, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  List,
  Tags,
  FlaskConical,
  Languages,
  Palette,
  Globe2,
  HelpCircle,
  Settings2
} from 'lucide-react'
import Modal from '../components/Modal'
import { toast } from 'react-hot-toast'

export default function AdminSubjects(){
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [teacherUsers, setTeacherUsers] = useState([])

  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  const [newSubject, setNewSubject] = useState({ code: '', name: '', category: 'other', is_examinable: true })

  const [classAssign, setClassAssign] = useState({ klass: '', subject_ids: [] })
  const [teacherAssign, setTeacherAssign] = useState({ teacher_id: '', subject_ids: [] })

  const { showSuccess, showError } = useNotification()

  const [showCreateSubject, setShowCreateSubject] = useState(false)
  const [showClassAllocation, setShowClassAllocation] = useState(false)
  const [showTeacherAllocation, setShowTeacherAllocation] = useState(false)
  const [showDirectory, setShowDirectory] = useState(true)

  const stats = useMemo(() => {
    const total = subjects.length
    const examinable = subjects.filter(s => s.is_examinable !== false).length
    const unexaminable = total - examinable
    const categories = new Set(subjects.map(s => s.category)).size
    return { total, examinable, unexaminable, categories }
  }, [subjects])

  const getCategoryIcon = (category) => {
    switch (category?.toLowerCase()) {
      case 'language': return <Languages size={18} />
      case 'science': return <FlaskConical size={18} />
      case 'arts': return <Palette size={18} />
      case 'humanities': return <Globe2 size={18} />
      default: return <BookOpen size={18} />
    }
  }

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'language': return 'bg-blue-50 text-blue-600 border-blue-100'
      case 'science': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
      case 'arts': return 'bg-purple-50 text-purple-600 border-purple-100'
      case 'humanities': return 'bg-amber-50 text-amber-600 border-amber-100'
      default: return 'bg-gray-50 text-gray-600 border-gray-100'
    }
  }

  const load = async () => {
    try {
      setLoading(true)
      const [s, c, t, u] = await Promise.all([
        api.get('/academics/subjects/'),
        api.get('/academics/classes/'),
        api.get('/academics/teachers/'),
        api.get('/auth/users/?role=teacher')
      ])
      const sArr = Array.isArray(s.data) ? s.data : (Array.isArray(s.data?.results) ? s.data.results : [])
      const cArr = Array.isArray(c.data) ? c.data : (Array.isArray(c.data?.results) ? c.data.results : [])
      const tArrRaw = Array.isArray(t.data) ? t.data : (Array.isArray(t.data?.results) ? t.data.results : [])
      const tArr = tArrRaw.filter(teacher => teacher?.user?.is_active !== false)
      const uArrRaw = Array.isArray(u.data) ? u.data : (Array.isArray(u.data?.results) ? u.data.results : [])
      const uArr = uArrRaw.filter(user => user?.is_active !== false)
      setSubjects(sArr); setClasses(cArr); setTeachers(tArr); setTeacherUsers(uArr)
    } catch (e) {
      showError('Failed to Load Data', 'Could not load subjects/classes/teachers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() },[])

  const allTeacherDirectory = useMemo(()=>{
    // Start with teacher profiles
    const byUserId = new Set((teachers||[]).map(t=>t?.user?.id))
    // Users without teacher profile
    const missing = (teacherUsers||[]).filter(u=> !byUserId.has(u.id))
    return { profiles: teachers||[], missingUsers: missing }
  }, [teachers, teacherUsers])

  const createSubject = async (e) => {
    e.preventDefault()
    if (!newSubject.code || !newSubject.name) return
    try {
      setCreating(true)
      await api.post('/academics/subjects/', newSubject)
      setNewSubject({ code: '', name: '', category: 'other' })
      await load()
      showSuccess('Subject Created', 'New subject added to the curriculum')
    } catch (err) {
      showError('Creation Failed', 'Check that code is unique and try again')
    } finally {
      setCreating(false)
    }
  }

  const saveClassSubjects = async (e) => {
    e.preventDefault()
    if (!classAssign.klass) return
    try {
      await api.patch(`/academics/classes/${classAssign.klass}/`, { subject_ids: classAssign.subject_ids })
      showSuccess('Class Updated', 'Subjects allocated to class')
      await load()
    } catch (err) {
      showError('Update Failed', 'Could not allocate subjects to class')
    }
  }

  const saveTeacherSubjects = async (e) => {
    e.preventDefault()
    if (!teacherAssign.teacher_id) return
    try {
      const subNames = subjects.filter(s => teacherAssign.subject_ids.includes(s.id)).map(s => s.name)
      const val = String(teacherAssign.teacher_id)
      if (val.startsWith('t:')) {
        const tid = val.slice(2)
        await api.patch(`/academics/teachers/${tid}/`, { subjects: subNames.join(', ') })
      } else if (val.startsWith('u:')) {
        const uid = val.slice(2)
        // Create teacher profile if it doesn't exist, then set subjects
        const createRes = await api.post('/academics/teachers/', { user_id: Number(uid), subjects: subNames.join(', ') })
        // Optional: refresh selected to new profile id
        const newId = createRes?.data?.id
        if (newId) {
          setTeacherAssign(a=>({ ...a, teacher_id: `t:${newId}` }))
        }
      } else {
        // Backward compatibility: assume it is a teacher id
        await api.patch(`/academics/teachers/${val}/`, { subjects: subNames.join(', ') })
      }
      showSuccess('Teacher Updated', 'Subjects allocated to teacher')
      await load()
    } catch (err) {
      showError('Update Failed', 'Could not allocate subjects to teacher')
    }
  }

  const toggleId = (arr, id) => (arr.includes(id) ? arr.filter(i=>i!==id) : [...arr, id])

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <BookOpen size={20} />
                <span className="text-sm font-bold uppercase tracking-wider">Curriculum</span>
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                Subjects <span className="text-blue-600">Directory</span>
              </h1>
              <p className="text-gray-500 mt-1 font-medium italic">Manage curriculum subjects and staff allocations</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Link to="/admin/teachers" className="h-12 px-6 rounded-2xl bg-white border-2 border-gray-100 text-gray-700 font-black hover:border-gray-900 hover:text-gray-900 transition-all flex items-center gap-2 shadow-sm">
                <Users size={18} />
                Teachers
              </Link>
              <Link to="/admin/grading" className="h-12 px-6 rounded-2xl bg-amber-50 border-2 border-amber-100 text-amber-700 font-black hover:bg-amber-100 transition-all flex items-center gap-2 shadow-sm shadow-amber-100">
                <GraduationCap size={18} />
                Grading
              </Link>
              <button 
                onClick={() => setShowCreateSubject(true)}
                className="h-12 px-6 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 active:scale-95"
              >
                <Plus size={18} />
                Create Subject
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                <BookOpen size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">{stats.total}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Total Subjects</div>
              </div>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">{stats.examinable}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Examinable</div>
              </div>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                <HelpCircle size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">{stats.unexaminable}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Non-Examinable</div>
              </div>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                <Tags size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900 leading-none">{stats.categories}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Categories</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Main Directory Column */}
          <div className="xl:col-span-8 space-y-8">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
                    <LayoutGrid size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Subject Directory</h2>
                    <p className="text-xs font-medium text-gray-500 italic">Click a subject for detailed view</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                     <input 
                       className="bg-gray-50 border-gray-100 border-2 rounded-xl pl-9 pr-4 py-2 text-sm font-bold placeholder:text-gray-300 focus:border-blue-500 transition-all outline-none w-64"
                       placeholder="Search subjects..."
                     />
                   </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {subjects.map(s => (
                    <Link 
                      key={s.id} 
                      to={`/admin/subjects/${s.id}`} 
                      className="group bg-white border-2 border-gray-50 rounded-2xl p-4 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${getCategoryColor(s.category)}`}>
                          {getCategoryIcon(s.category)}
                        </div>
                        {s.is_examinable === false && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-600 uppercase tracking-widest border border-amber-100">
                            Non-Exams
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-gray-900 tracking-tight mb-0.5 group-hover:text-blue-600 transition-colors">
                          {s.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                          <span>{s.code}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-200" />
                          <span>{s.category || 'Other'}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {!subjects.length && !loading && (
                    <div className="col-span-full py-20 text-center">
                       <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border-2 border-gray-100 border-dashed">
                         <BookOpen size={40} className="text-gray-200" />
                       </div>
                       <h3 className="text-gray-400 font-black uppercase tracking-widest text-sm mb-1">No subjects found</h3>
                       <p className="text-gray-400 text-xs font-medium">Add subjects to the curriculum to get started</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Column: Allocations */}
          <div className="xl:col-span-4 space-y-8">
            {/* Class Allocation Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group">
              <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LayoutGrid size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight text-left">Class Allocation</h2>
                    <p className="text-[10px] font-medium text-gray-500 italic text-left">Assign subjects to classes</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowClassAllocation(!showClassAllocation)}
                  className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight size={18} className={`transform transition-transform ${showClassAllocation ? 'rotate-90' : ''}`} />
                </button>
              </div>

              {showClassAllocation && (
                <div className="p-6">
                  <form onSubmit={saveClassSubjects} className="space-y-6 text-left">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 block">Target Class</label>
                      <select 
                        className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all outline-none appearance-none" 
                        value={classAssign.klass} 
                        onChange={e=>setClassAssign({...classAssign, klass: e.target.value})}
                      >
                        <option value="">Select Class...</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 block">Select Subjects</label>
                      <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-4 max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                        {subjects.map(s => {
                          const selected = classAssign.subject_ids.includes(s.id)
                          return (
                            <button 
                              type="button" 
                              key={s.id} 
                              onClick={()=>setClassAssign(a=>({...a, subject_ids: toggleId(a.subject_ids, s.id)}))} 
                              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selected ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-white border-white text-gray-600 hover:border-purple-100'}`}
                            >
                              <div className="flex items-center gap-3">
                                {getCategoryIcon(s.category)}
                                <span className="text-sm font-bold">{s.name}</span>
                              </div>
                              {selected ? <CheckCircle2 size={16} /> : <Plus size={16} className="text-gray-300" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <button className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-lg shadow-purple-200 transition-all active:scale-[0.98] disabled:opacity-50" disabled={!classAssign.klass}>
                      Save Class Allocation
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Teacher Allocation Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group">
              <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UserCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight text-left">Staff Allocation</h2>
                    <p className="text-[10px] font-medium text-gray-500 italic text-left">Assign subjects to teachers</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTeacherAllocation(!showTeacherAllocation)}
                  className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight size={18} className={`transform transition-transform ${showTeacherAllocation ? 'rotate-90' : ''}`} />
                </button>
              </div>

              {showTeacherAllocation && (
                <div className="p-6">
                  <form onSubmit={saveTeacherSubjects} className="space-y-6 text-left">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 block text-left">Teacher / Staff</label>
                      <select 
                        className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none appearance-none" 
                        value={teacherAssign.teacher_id} 
                        onChange={e=>setTeacherAssign({...teacherAssign, teacher_id: e.target.value})}
                      >
                        <option value="">Select Teacher...</option>
                        {allTeacherDirectory.profiles.map(t => (
                          <option key={t.id} value={`t:${t.id}`}>{t.user?.first_name} {t.user?.last_name}</option>
                        ))}
                        {allTeacherDirectory.missingUsers.length > 0 && (
                          <optgroup label="Unlinked Staff Profiles">
                            {allTeacherDirectory.missingUsers.map(u => (
                              <option key={`u-${u.id}`} value={`u:${u.id}`}>{u.first_name} {u.last_name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 block text-left">Teaching Load</label>
                      <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-4 max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar text-left">
                        {subjects.map(s => {
                          const selected = teacherAssign.subject_ids.includes(s.id)
                          return (
                            <button 
                              type="button" 
                              key={s.id} 
                              onClick={()=>setTeacherAssign(a=>({...a, subject_ids: toggleId(a.subject_ids, s.id)}))} 
                              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-white text-gray-600 hover:border-indigo-100'}`}
                            >
                              <div className="flex items-center gap-3">
                                {getCategoryIcon(s.category)}
                                <span className="text-sm font-bold">{s.name}</span>
                              </div>
                              {selected ? <CheckCircle2 size={16} /> : <Plus size={16} className="text-gray-300" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <button className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50" disabled={!teacherAssign.teacher_id}>
                      Save Staff Allocation
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Subject Modal */}
      <Modal open={showCreateSubject} onClose={()=>setShowCreateSubject(false)} title="New Curriculum Subject" size="md">
        <form onSubmit={createSubject} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 block text-left">Subject Code</label>
              <input 
                className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                placeholder="e.g. MATH" 
                value={newSubject.code} 
                onChange={e=>setNewSubject({...newSubject, code:e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 block text-left">Department</label>
              <select 
                className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none" 
                value={newSubject.category} 
                onChange={e=>setNewSubject({...newSubject, category:e.target.value})}
              >
                <option value="language">Language</option>
                <option value="science">Science</option>
                <option value="arts">Arts</option>
                <option value="humanities">Humanities</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 block text-left">Full Name</label>
            <input 
              className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
              placeholder="e.g. Mathematics" 
              value={newSubject.name} 
              onChange={e=>setNewSubject({...newSubject, name:e.target.value})} 
              required 
            />
          </div>

          <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <GraduationCap size={20} />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-gray-900">Examinable Subject</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Included in results & reports</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={!!newSubject.is_examinable} 
                onChange={e=>setNewSubject({...newSubject, is_examinable: e.target.checked})} 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button" 
              onClick={()=>setShowCreateSubject(false)} 
              className="px-6 py-3 rounded-2xl border-2 border-gray-100 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Register Subject'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
