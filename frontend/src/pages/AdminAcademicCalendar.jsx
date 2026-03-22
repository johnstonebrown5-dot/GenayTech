import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ChevronRight,
  Target,
  MoreVertical,
  ArrowRight,
  Info
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import Modal from '../components/Modal'

export default function AdminAcademicCalendar(){
  const navigate = useNavigate()
  const [years, setYears] = useState([])
  const [currentYear, setCurrentYear] = useState(null)
  const [currentTerm, setCurrentTerm] = useState(null)
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [yearForm, setYearForm] = useState({ label:'', start_date:'', end_date:'', is_current:false })
  const [termForm, setTermForm] = useState({ academic_year:'', number:1, name:'', start_date:'', end_date:'', is_current:false })

  // Edit states
  const [isEditYearOpen, setIsEditYearOpen] = useState(false)
  const [editYearId, setEditYearId] = useState(null)
  const [editYearForm, setEditYearForm] = useState({ label:'', start_date:'', end_date:'', is_current:false })

  const [isEditTermOpen, setIsEditTermOpen] = useState(false)
  const [editTermId, setEditTermId] = useState(null)
  const [editTermForm, setEditTermForm] = useState({ academic_year:'', number:1, name:'', start_date:'', end_date:'', is_current:false })

  // Helper to determine if a term is currently active based on calendar
  const isTermCurrent = (term) => {
    const today = new Date().toISOString().split('T')[0]
    return term.start_date <= today && term.end_date >= today
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [yearsRes, cyRes, ctRes, termsRes] = await Promise.allSettled([
        api.get('/academics/academic_years/mine/'),
        api.get('/academics/academic_years/current/'),
        api.get('/academics/terms/current/'),
        api.get('/academics/terms/of-current-year/'),
      ])
      if (yearsRes.status === 'fulfilled') {
        const y = yearsRes.value?.data
        setYears(Array.isArray(y) ? y : (y?.results || []))
      } else {
        setYears([])
      }
      if (cyRes.status === 'fulfilled') setCurrentYear(cyRes.value.data)
      else setCurrentYear(null)
      if (ctRes.status === 'fulfilled') setCurrentTerm(ctRes.value.data)
      else setCurrentTerm(null)
      if (termsRes.status === 'fulfilled') {
        const t = termsRes.value?.data
        setTerms(Array.isArray(t) ? t : (t?.results || []))
      } else {
        setTerms([])
      }
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  // When currentYear changes, default termForm academic_year
  useEffect(()=>{ if (currentYear?.id) setTermForm(f=> ({...f, academic_year: currentYear.id})) }, [currentYear?.id])

  const createYear = async (e) => {
    e.preventDefault(); setError('')
    try {
      const res = await api.post('/academics/academic_years/', yearForm)
      const created = res?.data
      setYearForm({ label:'', start_date:'', end_date:'', is_current:false })
      toast.success('Academic year created successfully!')
      await load()

      if (created?.id) {
        const doPromote = window.confirm('Academic year created successfully.\n\nDo you want to promote classes/students now for this new academic year?')
        if (doPromote) {
          navigate('/admin/classes')
        }
      }
    } catch (e) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : e.message
      setError(msg)
      toast.error('Failed to create year')
    }
  }

  const createTerm = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api.post('/academics/terms/', termForm)
      setTermForm(f=> ({...f, name:'', start_date:'', end_date:'', is_current:false}))
      toast.success('Term created successfully!')
      await load()
    } catch (e) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : e.message
      setError(msg)
      toast.error('Failed to create term')
    }
  }

  const setCurrentYearAction = async (id) => {
    try {
      if (!window.confirm('Set this year as current?')) return
      await api.post(`/academics/academic_years/${id}/set-current/`, {})
      toast.success('Academic year updated!')
      await load()
    } catch (e) {
      toast.error('Failed to update year')
    }
  }

  const setCurrentTermAction = async (id) => {
    try {
      await api.post(`/academics/terms/${id}/set-current/`)
      toast.success('Current term updated!')
      await load()
    } catch (e) {
      toast.error('Failed to update term')
    }
  }

  const updateYear = async (e) => {
    e.preventDefault(); setError('')
    if (!editYearId) return
    try {
      await api.patch(`/academics/academic_years/${editYearId}/`, editYearForm)
      setIsEditYearOpen(false)
      setEditYearId(null)
      toast.success('Year updated successfully!')
      await load()
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
      toast.error('Update failed')
    }
  }

  const updateTerm = async (e) => {
    e.preventDefault(); setError('')
    if (!editTermId) return
    try {
      await api.patch(`/academics/terms/${editTermId}/`, editTermForm)
      setIsEditTermOpen(false)
      setEditTermId(null)
      toast.success('Term updated successfully!')
      await load()
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
      toast.error('Update failed')
    }
  }

  const deleteYear = async (id) => {
    if (!confirm('Delete this academic year? This will also delete all terms and events.')) return
    try {
      await api.delete(`/academics/academic_years/${id}/`)
      toast.success('Year deleted')
      await load()
    } catch (e) {
      toast.error('Deletion failed')
    }
  }

  const deleteTerm = async (id) => {
    if (!confirm('Delete this term? This will also delete the associated event.')) return
    try {
      await api.delete(`/academics/terms/${id}/`)
      toast.success('Term deleted')
      await load()
    } catch (e) {
      toast.error('Deletion failed')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Calendar size={20} />
                <span className="text-sm font-bold uppercase tracking-wider">Management</span>
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                Academic <span className="text-blue-600">Calendar</span>
              </h1>
              <p className="text-gray-500 mt-1 font-medium">Manage school years, terms, and scheduling</p>
            </div>
            
            <div className="flex items-center gap-3">
              {currentYear && (
                <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <Target size={20} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Active Year</div>
                    <div className="text-sm font-bold text-blue-900">{currentYear.label}</div>
                  </div>
                </div>
              )}
              {currentTerm && (
                <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Active Term</div>
                    <div className="text-sm font-bold text-emerald-900">Term {currentTerm.number}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Column: Configuration Forms */}
          <div className="xl:col-span-5 space-y-8">
            {/* Create Year Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group">
              <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">New Academic Year</h2>
                    <p className="text-xs font-medium text-gray-500 italic">Define the start and end of a school year</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <form onSubmit={createYear} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Year Label</label>
                    <input 
                      className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                      placeholder="e.g. 2024/2025" 
                      value={yearForm.label} 
                      onChange={e=>setYearForm({...yearForm, label:e.target.value})} 
                      required 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Start Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                        value={yearForm.start_date} 
                        onChange={e=>setYearForm({...yearForm, start_date:e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">End Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                        value={yearForm.end_date} 
                        onChange={e=>setYearForm({...yearForm, end_date:e.target.value})} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded-lg border-gray-200 text-blue-600 focus:ring-blue-500"
                        checked={yearForm.is_current} 
                        onChange={e=>setYearForm({...yearForm, is_current:e.target.checked})} 
                      />
                      <span className="text-sm font-bold text-gray-700">Set as current active year</span>
                    </label>
                  </div>

                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                    <Plus size={20} />
                    Create Academic Year
                  </button>
                </form>
              </div>
            </div>

            {/* Create Term Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group">
              <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">New Term</h2>
                    <p className="text-xs font-medium text-gray-500 italic">Divide the year into academic periods</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6 flex gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-800 leading-relaxed">
                    Terms cannot overlap in date ranges within the same year. Term numbers must be unique per year.
                  </p>
                </div>

                <form onSubmit={createTerm} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 text-left block">Academic Year</label>
                    <select 
                      className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none" 
                      value={termForm.academic_year} 
                      onChange={e=>setTermForm({...termForm, academic_year:e.target.value})} 
                      required
                    >
                      <option value="">Select year...</option>
                      {(Array.isArray(years) ? years : []).map(y => (
                        <option key={y.id} value={y.id}>{y.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 text-left block">Term Number</label>
                      <select 
                        className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none" 
                        value={termForm.number} 
                        onChange={e=>setTermForm({...termForm, number: Number(e.target.value)})}
                      >
                        <option value={1}>Term 1</option>
                        <option value={2}>Term 2</option>
                        <option value={3}>Term 3</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 text-left block">Optional Name</label>
                      <input 
                        className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                        placeholder="e.g. Trinity" 
                        value={termForm.name} 
                        onChange={e=>setTermForm({...termForm, name:e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 text-left block">Start Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                        value={termForm.start_date} 
                        onChange={e=>setTermForm({...termForm, start_date:e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 text-left block">End Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                        value={termForm.end_date} 
                        onChange={e=>setTermForm({...termForm, end_date:e.target.value})} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded-lg border-gray-200 text-emerald-600 focus:ring-emerald-500"
                        checked={termForm.is_current} 
                        onChange={e=>setTermForm({...termForm, is_current:e.target.checked})} 
                      />
                      <span className="text-sm font-bold text-gray-700">Set as current active term</span>
                    </label>
                  </div>

                  <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                    <Plus size={20} />
                    Create Academic Term
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Column: Lists & Visualization */}
          <div className="xl:col-span-7 space-y-8">
            {/* Academic Years List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Academic Years</h2>
                    <p className="text-xs font-medium text-gray-500">History and current periods</p>
                  </div>
                </div>
                <div className="text-xs font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-widest">
                  {(Array.isArray(years) ? years : []).length} Total
                </div>
              </div>

              <div className="p-0">
                <div className="divide-y divide-gray-50">
                  {(Array.isArray(years) ? years : []).map(y => (
                    <div key={y.id} className={`p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors hover:bg-gray-50/50 ${y.is_current ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${y.is_current ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                          <Calendar size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base font-black text-gray-900 tracking-tight">{y.label}</span>
                            {y.is_current && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-600 uppercase tracking-widest border border-blue-200">
                                <CheckCircle2 size={10} />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <span>{y.start_date}</span>
                            <ArrowRight size={12} className="text-gray-300" />
                            <span>{y.end_date}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {!y.is_current && (
                          <button 
                            onClick={()=>setCurrentYearAction(y.id)} 
                            className="h-10 px-4 rounded-xl text-xs font-black bg-white border-2 border-gray-100 text-gray-600 hover:border-blue-600 hover:text-blue-600 transition-all uppercase tracking-widest active:scale-95 shadow-sm"
                          >
                            Set Active
                          </button>
                        )}
                        <button 
                          onClick={()=>openEditYear(y)} 
                          className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border-2 border-gray-100 text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-all active:scale-95 shadow-sm"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={()=>deleteYear(y.id)} 
                          className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border-2 border-gray-100 text-red-500 hover:border-red-600 hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(Array.isArray(years) ? years : []).length===0 && (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                        <Calendar size={32} className="text-gray-200" />
                      </div>
                      <h3 className="text-gray-400 font-black uppercase tracking-widest text-sm mb-1">No Academic Years</h3>
                      <p className="text-gray-400 text-xs font-medium">Create your first year to get started</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Terms List Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Active Year Terms</h2>
                    <p className="text-xs font-medium text-gray-500">Periods for {currentYear?.label || '...'}</p>
                  </div>
                </div>
                {currentTerm && (
                  <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    Current: Term {currentTerm.number}
                  </div>
                )}
              </div>

              <div className="p-0">
                <div className="divide-y divide-gray-50">
                  {(Array.isArray(terms) ? terms : []).map(t => {
                    const active = isTermCurrent(t)
                    return (
                      <div key={t.id} className={`p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors hover:bg-gray-50/50 ${active ? 'bg-emerald-50/30' : ''}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${active ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                            <span className="text-sm font-black tracking-tighter">T{t.number}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base font-black text-gray-900 tracking-tight">Term {t.number} {t.name ? `— ${t.name}` : ''}</span>
                              {active && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-600 uppercase tracking-widest border border-emerald-200">
                                  <CheckCircle2 size={10} />
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              <span>{t.start_date}</span>
                              <ArrowRight size={12} className="text-gray-300" />
                              <span>{t.end_date}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {!active && (
                            <button 
                              onClick={()=>setCurrentTermAction(t.id)} 
                              className="h-10 px-4 rounded-xl text-xs font-black bg-white border-2 border-gray-100 text-gray-600 hover:border-emerald-600 hover:text-emerald-600 transition-all uppercase tracking-widest active:scale-95 shadow-sm"
                            >
                              Set Active
                            </button>
                          )}
                          <button 
                            onClick={()=>openEditTerm(t)} 
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border-2 border-gray-100 text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-all active:scale-95 shadow-sm"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button 
                            onClick={()=>deleteTerm(t.id)} 
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border-2 border-gray-100 text-red-500 hover:border-red-600 hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {(Array.isArray(terms) ? terms : []).length===0 && (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                        <Clock size={32} className="text-gray-200" />
                      </div>
                      <h3 className="text-gray-400 font-black uppercase tracking-widest text-sm mb-1">No Terms Found</h3>
                      <p className="text-gray-400 text-xs font-medium">Add terms for the current year to manage schedules</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Year Modal */}
      <Modal open={isEditYearOpen} onClose={()=>setIsEditYearOpen(false)} title="Edit Academic Year" size="md">
        <form onSubmit={updateYear} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Year Label</label>
            <input 
              className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
              placeholder="e.g. 2024/2025" 
              value={editYearForm.label} 
              onChange={e=>setEditYearForm({...editYearForm, label:e.target.value})} 
              required 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Start Date</label>
              <input 
                type="date" 
                className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                value={editYearForm.start_date} 
                onChange={e=>setEditYearForm({...editYearForm, start_date:e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">End Date</label>
              <input 
                type="date" 
                className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                value={editYearForm.end_date} 
                onChange={e=>setEditYearForm({...editYearForm, end_date:e.target.value})} 
                required 
              />
            </div>
          </div>
          <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg border-gray-200 text-blue-600 focus:ring-blue-500"
                checked={editYearForm.is_current} 
                onChange={e=>setEditYearForm({...editYearForm, is_current:e.target.checked})} 
              />
              <span className="text-sm font-bold text-gray-700">Set as current active year</span>
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setIsEditYearOpen(false)} className="px-6 py-3 rounded-2xl border-2 border-gray-100 font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">Update Year</button>
          </div>
        </form>
      </Modal>

      {/* Edit Term Modal */}
      <Modal open={isEditTermOpen} onClose={()=>setIsEditTermOpen(false)} title="Edit Term" size="md">
        <form onSubmit={updateTerm} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Academic Year</label>
            <select 
              className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none" 
              value={editTermForm.academic_year} 
              onChange={e=>setEditTermForm({...editTermForm, academic_year:e.target.value})} 
              required
            >
              {(Array.isArray(years) ? years : []).map(y => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Term Number</label>
              <select 
                className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none" 
                value={editTermForm.number} 
                onChange={e=>setEditTermForm({...editTermForm, number: Number(e.target.value)})}
              >
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Optional Name</label>
              <input 
                className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                placeholder="e.g. Trinity" 
                value={editTermForm.name} 
                onChange={e=>setEditTermForm({...editTermForm, name:e.target.value})} 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Start Date</label>
              <input 
                type="date" 
                className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                value={editTermForm.start_date} 
                onChange={e=>setEditTermForm({...editTermForm, start_date:e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">End Date</label>
              <input 
                type="date" 
                className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-4 py-3 text-gray-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                value={editTermForm.end_date} 
                onChange={e=>setEditTermForm({...editTermForm, end_date:e.target.value})} 
                required 
              />
            </div>
          </div>
          <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg border-gray-200 text-emerald-600 focus:ring-emerald-500"
                checked={editTermForm.is_current} 
                onChange={e=>setEditTermForm({...editTermForm, is_current:e.target.checked})} 
              />
              <span className="text-sm font-bold text-gray-700">Set as current active term</span>
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setIsEditTermOpen(false)} className="px-6 py-3 rounded-2xl border-2 border-gray-100 font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button className="px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95">Update Term</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
