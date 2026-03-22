import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useNotification } from '../components/NotificationContext'
import { Line } from 'react-chartjs-2'
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js'
import { 
  BookOpen, 
  ChevronLeft, 
  Edit3, 
  GraduationCap, 
  Users, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  TrendingUp, 
  UserCheck, 
  FileText, 
  Calendar,
  Layers,
  LayoutGrid,
  Info,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Tooltip, 
  Legend,
  Filler
)

export default function AdminSubjectProfile(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [subject, setSubject] = useState(null)
  const [stats, setStats] = useState({ avg_by_grade: [], teachers: [], grading: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingSubject, setEditingSubject] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', category: 'other', is_examinable: true })
  const [savingSubject, setSavingSubject] = useState(false)
  const [bands, setBands] = useState([]) // [{id, grade, min, max, order}]
  const [loadingBands, setLoadingBands] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const savingMapRef = useRef({})
  const { showSuccess, showError } = useNotification?.() || { showSuccess:()=>{}, showError:()=>{} }

  // Components (papers) state
  const [components, setComponents] = useState([]) // [{id, code, name, max_marks, weight, order}]
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [compEditMode, setCompEditMode] = useState(false)
  const compSavingMapRef = useRef({})
  const compDebounceRef = useRef({})

  useEffect(() => {
    let cancelled = false
    async function load(){
      try {
        setLoading(true)
        const [s, st] = await Promise.all([
          api.get(`/academics/subjects/${id}/`),
          api.get(`/academics/subjects/${id}/stats/`),
        ])
        if (!cancelled) {
          setSubject(s.data)
          setStats(st.data || {})
          setForm({ code: s.data?.code || '', name: s.data?.name || '', category: s.data?.category || 'other', is_examinable: (s.data?.is_examinable ?? true) })
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load subject')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return ()=>{ cancelled = true }
  }, [id])

  // Load subject components (papers)
  useEffect(() => {
    let cancelled = false
    async function loadComponents(){
      if (!id) return
      try {
        setLoadingComponents(true)
        const { data } = await api.get(`/academics/subject_components/?subject=${id}`)
        if (!cancelled) setComponents(Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []))
      } catch (e) {
        if (!cancelled) setComponents([])
      } finally {
        if (!cancelled) setLoadingComponents(false)
      }
    }
    loadComponents()
    return ()=>{ cancelled = true }
  }, [id])

  // Load grading bands for this subject
  useEffect(() => {
    let cancelled = false
    async function loadBands(){
      try {
        setLoadingBands(true)
        const { data } = await api.get(`/academics/subject_grading/?subject=${id}`)
        if (!cancelled) setBands(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setBands([])
      } finally {
        if (!cancelled) setLoadingBands(false)
      }
    }
    if (id) loadBands()
    return ()=>{ cancelled = true }
  }, [id])

  const ensureEditable = () => {
    // If no custom bands loaded yet (bands is empty) but we have defaults from stats,
    // copy defaults into editable bands array so user can edit them.
    if (bands.length === 0 && (stats?.grading || []).length) {
      const cloned = (stats.grading || []).map((g, idx) => ({ id: undefined, subject: Number(id), grade: g.grade, min: g.min, max: g.max, order: g.order ?? idx }))
      setBands(cloned)
    }
    if (!editMode) setEditMode(true)
  }

  // Enable component editing (papers)
  const ensureCompEditable = () => {
    if (!compEditMode) setCompEditMode(true)
  }

  // Add a new component row
  const addCompRow = () => {
    ensureCompEditable()
    setComponents(prev => [
      ...prev,
      { id: undefined, subject: Number(id), code: '', name: '', max_marks: 100, weight: 1, order: prev.length }
    ])
  }

  const addRow = () => {
    ensureEditable()
    setBands(prev => [...prev, { id: undefined, subject: Number(id), grade: '', min: 0, max: 0, order: prev.length }])
  }

  const updateField = (idx, key, value) => {
    ensureEditable()
    setBands(prev => prev.map((b,i)=> i===idx ? { ...b, [key]: key==='grade' ? value : Number(value) } : b))
  }

  const saveRow = async (idx) => {
    const row = bands[idx]
    try {
      savingMapRef.current[idx] = true
      if (row.id) {
        const { data } = await api.patch(`/academics/subject_grading/${row.id}/`, {
          grade: row.grade, min: row.min, max: row.max, order: row.order
        })
        setBands(prev => prev.map((b,i)=> i===idx ? data : b))
        showSuccess && showSuccess('Saved', 'Grading band updated')
      } else {
        const { data } = await api.post(`/academics/subject_grading/`, {
          subject: Number(id), grade: row.grade, min: row.min, max: row.max, order: row.order
        })
        setBands(prev => prev.map((b,i)=> i===idx ? data : b))
        showSuccess && showSuccess('Saved', 'Grading band created')
      }
    } catch (e) {
      showError && showError('Save Failed', e?.response?.data ? JSON.stringify(e.response.data) : 'Could not save grading band')
    } finally {
      savingMapRef.current[idx] = false
    }
  }

  // === Components (papers) inline CRUD helpers ===
  // Removed autosave for components; saving is now manual via a Save button

  const updateCompField = (idx, key, value) => {
    ensureCompEditable()
    setComponents(prev => prev.map((c,i)=> i===idx ? { ...c, [key]: (key==='code'||key==='name') ? value : (value===''? '' : Number(value)) } : c))
  }

  const saveCompRow = async (idx) => {
    const row = components[idx]
    try {
      compSavingMapRef.current[idx] = true
      if (row.id) {
        const { data } = await api.patch(`/academics/subject_components/${row.id}/`, {
          code: row.code, name: row.name, max_marks: row.max_marks, weight: row.weight, order: row.order
        })
        setComponents(prev => prev.map((c,i)=> i===idx ? data : c))
        showSuccess && showSuccess('Saved', 'Component updated')
      } else {
        const { data } = await api.post(`/academics/subject_components/`, {
          subject: Number(id), code: row.code, name: row.name, max_marks: row.max_marks, weight: row.weight, order: row.order
        })
        setComponents(prev => prev.map((c,i)=> i===idx ? data : c))
        showSuccess && showSuccess('Saved', 'Component created')
      }
    } catch (e) {
      showError && showError('Save Failed', e?.response?.data ? JSON.stringify(e.response.data) : 'Could not save component')
    } finally {
      compSavingMapRef.current[idx] = false
    }
  }

  const deleteCompRow = async (idx) => {
    const row = components[idx]
    if (row.id) {
      try {
        await api.delete(`/academics/subject_components/${row.id}/`)
        setComponents(prev => prev.filter((_,i)=>i!==idx))
        showSuccess && showSuccess('Deleted', 'Component removed')
      } catch (e) {
        showError && showError('Delete Failed', 'Could not delete component')
      }
    } else {
      setComponents(prev => prev.filter((_,i)=>i!==idx))
    }
  }

  const deleteRow = async (idx) => {
    const row = bands[idx]
    if (row.id) {
      try {
        await api.delete(`/academics/subject_grading/${row.id}/`)
        setBands(prev => prev.filter((_,i)=>i!==idx))
        showSuccess && showSuccess('Deleted', 'Grading band removed')
      } catch (e) {
        showError && showError('Delete Failed', 'Could not delete grading band')
      }
    } else {
      setBands(prev => prev.filter((_,i)=>i!==idx))
    }
  }

  const teachers = stats?.teachers || []
  const gradePerf = stats?.avg_by_grade || []
  const grading = (bands && bands.length>0) ? bands : (stats?.grading || [])
  
  const performanceData = useMemo(() => {
    return {
      labels: gradePerf.map(g => g.grade_level),
      datasets: [
        {
          label: 'Average Performance',
          data: gradePerf.map(g => g.average || 0),
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
        }
      ]
    }
  }, [gradePerf])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        borderRadius: 8,
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: '#f1f5f9' },
        ticks: { font: { size: 10, weight: '600' }, color: '#64748b' }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, weight: '600' }, color: '#64748b' }
      }
    }
  }

  const categoryConfig = useMemo(()=>{
    const c = (subject?.category || 'other').toString().toLowerCase()
    const configs = {
      language: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <BookOpen size={16} /> },
      science: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <Layers size={16} /> },
      arts: { color: 'bg-pink-50 text-pink-700 border-pink-200', icon: <LayoutGrid size={16} /> },
      humanities: { color: 'bg-amber-50 text-amber-800 border-amber-200', icon: <GraduationCap size={16} /> },
      other: { color: 'bg-gray-50 text-gray-700 border-gray-200', icon: <BookOpen size={16} /> }
    }
    return configs[c] || configs.other
  }, [subject?.category])

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <button 
                onClick={() => navigate(-1)} 
                className="mt-1 w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all active:scale-95"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                {!editingSubject ? (
                  <>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
                      {subject?.name || 'Subject'}
                    </h1>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-gray-100 text-gray-500 uppercase tracking-widest border border-gray-200">
                        Code: {subject?.code || '-'}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${categoryConfig.color}`}>
                        {categoryConfig.icon}
                        {subject?.category || 'Other'}
                      </span>
                      {subject?.is_examinable !== false && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 uppercase tracking-widest border border-emerald-100">
                          <CheckCircle2 size={12} />
                          Examinable
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      className="h-11 border-2 border-gray-100 rounded-xl px-4 font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none"
                      placeholder="Code"
                      value={form.code}
                      onChange={e=>setForm(f=>({...f, code: e.target.value}))}
                    />
                    <input
                      className="h-11 border-2 border-gray-100 rounded-xl px-4 min-w-[260px] font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none"
                      placeholder="Name"
                      value={form.name}
                      onChange={e=>setForm(f=>({...f, name: e.target.value}))}
                    />
                    <select
                      className="h-11 border-2 border-gray-100 rounded-xl px-4 font-bold text-gray-900 focus:border-indigo-500 transition-all outline-none appearance-none bg-white pr-10"
                      value={form.category}
                      onChange={e=>setForm(f=>({...f, category: e.target.value}))}
                    >
                      <option value="language">Language</option>
                      <option value="science">Science</option>
                      <option value="arts">Arts</option>
                      <option value="humanities">Humanities</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/admin/subjects" className="h-11 px-5 rounded-xl bg-white border-2 border-gray-100 text-gray-600 font-bold hover:border-gray-900 hover:text-gray-900 transition-all flex items-center gap-2">
                <LayoutGrid size={18} />
                Directory
              </Link>
              {!editingSubject ? (
                <button 
                  onClick={()=>setEditingSubject(true)} 
                  className="h-11 px-6 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95"
                >
                  <Edit3 size={18} />
                  Edit Subject
                </button>
              ) : (
                <>
                  <button
                    disabled={savingSubject}
                    onClick={async()=>{
                      setSavingSubject(true)
                      try{
                        const payload = { code: form.code, name: form.name, category: form.category, is_examinable: !!form.is_examinable }
                        const { data } = await api.patch(`/academics/subjects/${id}/`, payload)
                        setSubject(data)
                        setForm({ code: data.code, name: data.name, category: data.category||'other', is_examinable: (data?.is_examinable ?? true) })
                        setEditingSubject(false)
                        toast.success('Subject updated!')
                      }catch(e){
                        toast.error('Failed to update')
                      }finally{ setSavingSubject(false) }
                    }}
                    className="h-11 px-6 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    <Save size={18} />
                    {savingSubject? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    disabled={savingSubject}
                    onClick={()=>{ setEditingSubject(false); setForm({ code: subject?.code||'', name: subject?.name||'', category: subject?.category||'other' }) }}
                    className="h-11 px-5 rounded-xl border-2 border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-all"
                  >Cancel</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {loading && (
          <div className="py-20 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Loading profile...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-center gap-4 text-rose-700 max-w-2xl mx-auto">
            <AlertCircle size={32} />
            <div>
              <h3 className="font-black uppercase tracking-tight text-lg leading-none mb-1">Load Failed</h3>
              <p className="text-sm font-medium opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {/* Top Row: Quick Metrics & Subject Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                  <FileText size={24} />
                </div>
                <div>
                  <div className="text-2xl font-black text-gray-900 leading-none">{components.length}</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Assessment Units</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                  <Users size={24} />
                </div>
                <div>
                  <div className="text-2xl font-black text-gray-900 leading-none">{teachers.length}</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Staff Allocated</div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="text-2xl font-black text-gray-900 leading-none">
                    {gradePerf.length > 0 ? (gradePerf.reduce((a,b)=>a+(b.average||0),0)/gradePerf.length).toFixed(1) : '0'}%
                  </div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Avg. performance</div>
                </div>
              </div>
              <div className="bg-gray-900 p-6 rounded-[2rem] shadow-xl flex items-center justify-between group">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-black text-white uppercase tracking-wider">Active Curriculum</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <CheckCircle2 size={20} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* Main Analytics Column */}
              <div className="xl:col-span-12 space-y-8">
                {/* Performance Chart Card */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                        <TrendingUp size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">Academic Performance</h2>
                        <p className="text-xs font-medium text-gray-500 italic">Historical trends across grade levels</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-8">
                    {gradePerf.length === 0 ? (
                      <div className="py-12 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                        <TrendingUp size={48} className="text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No exam data recorded yet</p>
                      </div>
                    ) : (
                      <div className="h-[350px] w-full">
                        <Line data={performanceData} options={chartOptions} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="xl:col-span-8 space-y-8">
                {/* Subject Components (Papers) Card */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shadow-sm">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">Curriculum Components</h2>
                        <p className="text-xs font-medium text-gray-500 italic">Papers and assessment weights</p>
                      </div>
                    </div>
                    <button 
                      onClick={addCompRow} 
                      className="h-10 px-4 rounded-xl bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2 border border-emerald-100"
                    >
                      <Plus size={14} />
                      Add Paper
                    </button>
                  </div>

                  <div className="p-8">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50">
                            <th className="pb-4 px-2 w-10">#</th>
                            <th className="pb-4 px-2">Code</th>
                            <th className="pb-4 px-2">Paper Name</th>
                            <th className="pb-4 px-2 text-center">Max Marks</th>
                            <th className="pb-4 px-2 text-center">Weight</th>
                            <th className="pb-4 px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {loadingComponents ? (
                            <tr>
                              <td colSpan={6} className="py-12 text-center">
                                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                              </td>
                            </tr>
                          ) : components.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-12 text-center">
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No components defined</p>
                              </td>
                            </tr>
                          ) : (
                            components.map((c, idx) => (
                              <tr key={c.id || `c-${idx}`} className="group hover:bg-gray-50/50 transition-colors">
                                <td className="py-4 px-2 text-[10px] font-black text-gray-300">
                                  {compEditMode ? (
                                    <input className="w-full bg-transparent border-b border-gray-200 text-center focus:border-indigo-500 outline-none" type="number" value={c.order ?? idx} onChange={e=>updateCompField(idx,'order',e.target.value)} />
                                  ) : (c.order ?? idx + 1)}
                                </td>
                                <td className="py-4 px-2">
                                  {compEditMode ? (
                                    <input className="w-24 bg-gray-50 border-gray-100 border-2 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500" value={c.code||''} onChange={e=>updateCompField(idx,'code',e.target.value)} />
                                  ) : (
                                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{c.code || '-'}</span>
                                  )}
                                </td>
                                <td className="py-4 px-2">
                                  {compEditMode ? (
                                    <input className="w-full max-w-[200px] bg-gray-50 border-gray-100 border-2 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500" value={c.name||''} onChange={e=>updateCompField(idx,'name',e.target.value)} />
                                  ) : (
                                    <span className="text-sm font-bold text-gray-700">{c.name || '-'}</span>
                                  )}
                                </td>
                                <td className="py-4 px-2 text-center">
                                  {compEditMode ? (
                                    <input className="w-16 bg-gray-50 border-gray-100 border-2 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500 text-center" type="number" value={c.max_marks ?? ''} onChange={e=>updateCompField(idx,'max_marks',e.target.value)} />
                                  ) : (
                                    <span className="text-xs font-bold text-gray-500">{c.max_marks ?? '-'}</span>
                                  )}
                                </td>
                                <td className="py-4 px-2 text-center">
                                  {compEditMode ? (
                                    <input className="w-16 bg-gray-50 border-gray-100 border-2 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500 text-center" type="number" step="0.01" value={c.weight ?? 1} onChange={e=>updateCompField(idx,'weight',e.target.value)} />
                                  ) : (
                                    <span className="text-xs font-black text-gray-900">{c.weight ?? 1}x</span>
                                  )}
                                </td>
                                <td className="py-4 px-2 text-right">
                                  {compEditMode ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <button onClick={()=>saveCompRow(idx)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all">
                                        <Save size={14} />
                                      </button>
                                      <button onClick={()=>deleteCompRow(idx)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all">
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button onClick={ensureCompEditable} className="p-2 text-gray-300 hover:text-indigo-600 transition-colors">
                                      <Edit3 size={16} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!compEditMode && components.length > 0 && (
                      <div className="mt-6 flex items-center gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <Info size={14} className="text-gray-400" />
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Click the pencil icon to modify paper settings</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Column: Teachers Simplified */}
              <div className="xl:col-span-4 space-y-8">
                {/* Simplified Staff Directory Card */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden group">
                  <div className="p-8 bg-gradient-to-r from-gray-50/50 to-white flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                        <Users size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">Staff Count</h2>
                        <p className="text-xs font-medium text-gray-500 italic">Total allocated instructors</p>
                      </div>
                    </div>
                    <div className="text-4xl font-black text-emerald-600">{teachers.length}</div>
                  </div>
                  
                  <div className="p-8 pt-0">
                    <p className="text-xs text-gray-500 leading-relaxed mb-6">
                      There are currently <strong>{teachers.length}</strong> staff members assigned to teach this subject across various grade levels.
                    </p>
                    <Link 
                      to="/admin/subjects" 
                      className="w-full h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 border border-emerald-100"
                    >
                      <ArrowRight size={16} />
                      Manage Allocations
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
