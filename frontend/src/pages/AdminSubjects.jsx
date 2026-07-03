import React, { useEffect, useMemo, useState } from 'react'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js'
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)
import api from '../api'
import { useNotification } from '../components/NotificationContext'
import { Link } from 'react-router-dom'
import { 
  BookOpen, 
  Plus, 
  Users, 
  UserCheck, 
  CheckCircle2, 
  GraduationCap,
  LayoutGrid,
  Tags,
  FlaskConical,
  Languages,
  Palette,
  Globe2,
  HelpCircle,
  Upload,
  Download,
  ArrowRight,
  SlidersHorizontal
} from 'lucide-react'
import Modal from '../components/Modal'

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
  const [activeFilter, setActiveFilter] = useState('All')
  const [sortBy, setSortBy] = useState('Newest')

  const normalizeCategory = (category) => {
    const value = String(category || '').trim().toLowerCase()
    if (value === 'language' || value === 'languages') return 'Languages'
    if (value === 'science') return 'Science'
    if (value === 'humanities') return 'Humanities'
    if (value === 'arts' || value === 'art') return 'Arts'
    return 'Other'
  }

  const stats = useMemo(() => {
    const total = subjects.length
    const examinable = subjects.filter(s => s.is_examinable !== false).length
    const unexaminable = total - examinable
    const categories = new Set(subjects.map(s => normalizeCategory(s.category))).size
    return { total, examinable, unexaminable, categories }
  }, [subjects])

  const categoriesChartData = useMemo(() => {
    const counts = {}
    subjects.forEach(s => {
      const cat = normalizeCategory(s.category)
      counts[cat] = (counts[cat] || 0) + 1
    })
    const labels = Object.keys(counts)
    const data = labels.map(l => counts[l])
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#A78BFA'],
        borderWidth: 0,
      }]
    }
  }, [subjects])


  const filterOptions = ['All', 'Science', 'Languages', 'Humanities', 'Arts', 'Other']
  const sortOptions = [
    { value: 'Newest', label: 'Newest' },
    { value: 'AtoZ', label: 'A → Z' },
    { value: 'Teachers', label: 'Most teachers' },
    { value: 'Classes', label: 'Most classes' },
  ]


  const getBadgeClasses = (category) => {
    switch (normalizeCategory(category)) {
      case 'Science': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'Languages': return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'Humanities': return 'bg-amber-50 text-amber-700 border-amber-100'
      case 'Arts': return 'bg-purple-50 text-purple-700 border-purple-100'
      default: return 'bg-slate-50 text-slate-600 border-slate-100'
    }
  }

  const classCountBySubject = useMemo(() => {
    const map = new Map()
    classes.forEach(c => {
      const ids = Array.isArray(c.subjects) ? c.subjects.map(s => s?.id || s) : []
      ids.forEach(id => {
        if (!id) return
        const key = String(id)
        map.set(key, (map.get(key) || 0) + 1)
      })
    })
    return map
  }, [classes])

  const teacherCountBySubject = useMemo(() => {
    const map = new Map()
    const addSubject = (subjectKey) => {
      if (!subjectKey) return
      const key = String(subjectKey).trim().toLowerCase()
      if (!key) return
      map.set(key, (map.get(key) || 0) + 1)
    }

    teachers.forEach(teacher => {
      const subjectField = teacher.subjects
      if (Array.isArray(subjectField)) {
        subjectField.forEach(item => addSubject(item?.name || item?.code || item))
      } else if (typeof subjectField === 'string') {
        subjectField.split(/[,;]+/).forEach(item => addSubject(item))
      }
    })

    return map
  }, [teachers])

  const topSubjectsByTeachers = useMemo(() => {
    const arr = (subjects||[]).map(s => ({
      id: s.id,
      name: s.name || s.code || `#${s.id}`,
      teachers: teacherCountBySubject.get(String(s.id)) || teacherCountBySubject.get(String((s.name||'').toLowerCase())) || 0
    }))
    arr.sort((a,b) => b.teachers - a.teachers)
    const top = arr.slice(0, 6)
    return {
      labels: top.map(t => t.name),
      datasets: [{
        label: 'Assigned teachers',
        data: top.map(t => t.teachers),
        backgroundColor: '#4F46E5'
      }]
    }
  }, [subjects, teacherCountBySubject])

  const filteredSubjects = useMemo(() => {
    let list = Array.isArray(subjects) ? [...subjects] : []
    if (activeFilter !== 'All') {
      list = list.filter(s => normalizeCategory(s.category) === activeFilter)
    }
    if (sortBy === 'AtoZ') {
      return list.sort((a, b) => String(a.name || a.code || '').localeCompare(String(b.name || b.code || '')))
    }
    if (sortBy === 'Teachers') {
      return list.sort((a, b) => {
        const aCount = teacherCountBySubject.get(String(a.id)) || teacherCountBySubject.get(String(a.name || '').toLowerCase()) || 0
        const bCount = teacherCountBySubject.get(String(b.id)) || teacherCountBySubject.get(String(b.name || '').toLowerCase()) || 0
        return bCount - aCount
      })
    }
    if (sortBy === 'Classes') {
      return list.sort((a, b) => (classCountBySubject.get(String(b.id)) || 0) - (classCountBySubject.get(String(a.id)) || 0))
    }
    return list
  }, [subjects, activeFilter, sortBy, teacherCountBySubject, classCountBySubject])

  const getTeacherCount = (subject) => {
    const exactNameKey = String(subject?.name || '').trim().toLowerCase()
    const codeKey = String(subject?.code || '').trim().toLowerCase()
    return teacherCountBySubject.get(String(subject?.id)) || teacherCountBySubject.get(exactNameKey) || teacherCountBySubject.get(codeKey) || 0
  }

  const getClassCount = (subject) => {
    return classCountBySubject.get(String(subject?.id)) || 0
  }

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
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-soft overflow-hidden">
            <div className="p-4 md:p-6 flex flex-col gap-4 md:gap-0 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  <BookOpen size={16} />
                  Subjects Directory
                </div>
                <div>
                  <h2 className="text-4xl font-black tracking-tight text-slate-900">Curriculum subjects and allocations</h2>
                  <p className="mt-2 text-sm text-slate-500">A clean overview of subjects, exam status, assigned staff, and class coverage.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 justify-end">
                <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                  <Upload size={16} />
                  Import
                </button>
                <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                  <Download size={16} />
                  Export
                </button>
                <button onClick={() => setShowCreateSubject(true)} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">
                  <Plus size={16} />
                  New Subject
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 bg-blue-50/70 px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-blue-100 p-3 text-blue-600"><BookOpen size={20} /></div>
                    <div className="text-xs uppercase tracking-[0.35em] font-black text-slate-400">Total</div>
                  </div>
                  <div className="mt-4 text-3xl font-black text-slate-900">{stats.total}</div>
                  <div className="mt-1 text-sm text-slate-500">Total Subjects</div>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600"><CheckCircle2 size={20} /></div>
                    <div className="text-xs uppercase tracking-[0.35em] font-black text-slate-400">Examinable</div>
                  </div>
                  <div className="mt-4 text-3xl font-black text-slate-900">{stats.examinable}</div>
                  <div className="mt-1 text-sm text-slate-500">Exam subjects ready for assessment</div>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-600"><HelpCircle size={20} /></div>
                    <div className="text-xs uppercase tracking-[0.35em] font-black text-slate-400">Non-Exam</div>
                  </div>
                  <div className="mt-4 text-3xl font-black text-slate-900">{stats.unexaminable}</div>
                  <div className="mt-1 text-sm text-slate-500">Subjects outside the formal exam scope</div>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-purple-100 p-3 text-purple-600"><Tags size={20} /></div>
                    <div className="text-xs uppercase tracking-[0.35em] font-black text-slate-400">Categories</div>
                  </div>
                  <div className="mt-4 text-3xl font-black text-slate-900">{stats.categories}</div>
                  <div className="mt-1 text-sm text-slate-500">Curriculum categories in use</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="rounded-lg bg-indigo-600/10 p-2 text-indigo-600 inline-flex"><Users size={18} /></div>
                  <div className="mt-4 text-slate-500 uppercase tracking-[0.35em] text-[11px] font-bold">Allocate Teachers</div>
                  <div className="mt-3 text-lg font-black text-slate-900">Assign staff to core subjects</div>
                </button>
                <button className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="rounded-lg bg-blue-600/10 p-2 text-blue-600 inline-flex"><LayoutGrid size={18} /></div>
                  <div className="mt-4 text-slate-500 uppercase tracking-[0.35em] text-[11px] font-bold">Allocate Classes</div>
                  <div className="mt-3 text-lg font-black text-slate-900">Map subjects to class schedules</div>
                </button>
                <button className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="rounded-lg bg-emerald-600/10 p-2 text-emerald-600 inline-flex"><GraduationCap size={18} /></div>
                  <div className="mt-4 text-slate-500 uppercase tracking-[0.35em] text-[11px] font-bold">Grading Setup</div>
                  <div className="mt-3 text-lg font-black text-slate-900">Configure exam rules and bands</div>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="rounded-xl bg-white p-4 shadow-soft border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black">Subjects by Category</h3>
                    <span className="text-sm text-slate-400">Overview</span>
                  </div>
                  <div className="w-full h-56">
                    <Doughnut data={categoriesChartData} options={{ plugins: { legend: { position: 'bottom' }, tooltip: { enabled: true } } }} />
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-soft border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black">Top Subjects by Assigned Teachers</h3>
                    <span className="text-sm text-slate-400">Most staffed</span>
                  </div>
                  <div className="w-full h-56">
                    <Bar data={topSubjectsByTeachers} options={{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setActiveFilter(option)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeFilter === option ? 'bg-indigo-600 text-white shadow-soft' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <SlidersHorizontal size={18} className="text-slate-400" />
                  <span className="text-sm font-semibold text-slate-500">Sort</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="border-none bg-transparent text-sm font-black text-slate-900 outline-none"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSubjects.map(subject => (
                  <div key={subject.id} className="group rounded-xl border border-slate-100 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-xl">
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${getCategoryColor(subject.category)}`}>
                        {getCategoryIcon(subject.category)}
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${getBadgeClasses(subject.category)}`}>
                        {normalizeCategory(subject.category)}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-xl font-black text-slate-900">{subject.name}</h3>
                        <p className="mt-2 text-sm text-slate-500 uppercase tracking-[0.24em] font-semibold">{subject.code}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-slate-500">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Teachers</div>
                          <div className="mt-2 text-lg font-black text-slate-900">{getTeacherCount(subject)}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Classes</div>
                          <div className="mt-2 text-lg font-black text-slate-900">{getClassCount(subject)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.28em] ${subject.is_examinable === false ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                          {subject.is_examinable === false ? 'Non-exam' : 'Examinable'}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">Updated 2d ago</span>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link to={`/admin/subjects/${subject.id}`} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        View
                      </Link>
                      <Link to={`/admin/subjects/${subject.id}`} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        Edit
                      </Link>
                      <button className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        More
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredSubjects.length === 0 && !loading && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-slate-500">
                  <p className="text-lg font-black">No subjects match this filter.</p>
                  <p className="mt-2 text-sm">Try switching categories or create a new subject to fill the directory.</p>
                </div>
              )}
            </div>

            <div className="xl:col-span-4">
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600"><Users size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Need help setting up?</p>
                    <p className="mt-1 text-sm text-slate-500">Use these core tools to allocate teachers, assign classes, or configure grading rules from one place.</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <button className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-slate-500 uppercase tracking-[0.25em] text-[10px]">Allocate Teachers</div>
                        <div className="mt-2 text-base font-black text-slate-900">Send subject lists to faculty</div>
                      </div>
                      <ArrowRight className="text-slate-400" size={18} />
                    </div>
                  </button>
                  <button className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-slate-500 uppercase tracking-[0.25em] text-[10px]">Allocate Classes</div>
                        <div className="mt-2 text-base font-black text-slate-900">Align subjects with grade groups</div>
                      </div>
                      <ArrowRight className="text-slate-400" size={18} />
                    </div>
                  </button>
                  <button className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-slate-500 uppercase tracking-[0.25em] text-[10px]">Grading Setup</div>
                        <div className="mt-2 text-base font-black text-slate-900">Create exam criteria and bands</div>
                      </div>
                      <ArrowRight className="text-slate-400" size={18} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowCreateSubject(true)}
        className="fixed bottom-8 right-8 z-50 inline-flex items-center gap-3 rounded-full bg-indigo-600 px-6 py-4 text-sm font-black text-white shadow-elevated hover:bg-indigo-700 transition"
      >
        <Plus size={18} />
        New Subject
      </button>

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
