import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

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
      await load()

      // After creating a new academic year, gently remind the admin to run promotions
      if (created?.id) {
        const doPromote = window.confirm('Academic year created successfully.\n\nDo you want to promote classes/students now for this new academic year?')
        if (doPromote) {
          // Redirect admin to the Classes page where promotions are managed
          navigate('/admin/classes')
        }
      }
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  const createTerm = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api.post('/academics/terms/', termForm)
      setTermForm(f=> ({...f, name:'', start_date:'', end_date:'', is_current:false}))
      await load()
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  const setCurrentYearAction = async (id) => {
    try {
      if (!window.confirm('Set this year as current?')) return
      await api.post(`/academics/academic_years/${id}/set-current/`, {})
      await load()
    } catch (e) {
      alert(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  const promoteYear = async (id, skipConfirm=false) => {
    if (!skipConfirm) {
      if (!window.confirm('Promote classes/students for this academic year now?\n\nNote: Grade 9 students will be marked as Graduated and removed from classes.')) return
    }
    try {
      const res = await api.post(`/academics/academic_years/${id}/promote/`)
      const s = res?.data?.summary
      if (s) {
        const lines = []
        lines.push('Promotion completed.')
        lines.push(`Graduated classes: ${s.graduated_classes?.length || 0}`)
        lines.push(`Moved classes: ${s.moved_classes?.length || 0}`)
        lines.push(`Renamed classes: ${s.renamed_classes?.length || 0}`)
        if ((s.skipped?.length || 0) > 0) {
          lines.push(`Skipped: ${s.skipped.length} (see console for details)`) 
          // Log details for debugging
          // eslint-disable-next-line no-console
          console.table(s.skipped)
        }
        alert(lines.join('\n'))
      } else {
        alert('Promotion completed.')
      }
      await load()
    } catch (e) {
      alert(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  const setCurrentTermAction = async (id) => {
    try {
      await api.post(`/academics/terms/${id}/set-current/`)
      await load()
    } catch (e) {
      alert(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  // Edit handlers
  const openEditYear = (year) => {
    setEditYearId(year.id)
    setEditYearForm({
      label: year.label,
      start_date: year.start_date,
      end_date: year.end_date,
      is_current: year.is_current,
    })
    setIsEditYearOpen(true)
  }

  const updateYear = async (e) => {
    e.preventDefault(); setError('')
    if (!editYearId) return
    try {
      await api.patch(`/academics/academic_years/${editYearId}/`, editYearForm)
      setIsEditYearOpen(false)
      setEditYearId(null)
      await load()
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  const openEditTerm = (term) => {
    setEditTermId(term.id)
    setEditTermForm({
      academic_year: term.academic_year,
      number: term.number,
      name: term.name || '',
      start_date: term.start_date,
      end_date: term.end_date,
      is_current: term.is_current,
    })
    setIsEditTermOpen(true)
  }

  const updateTerm = async (e) => {
    e.preventDefault(); setError('')
    if (!editTermId) return
    try {
      await api.patch(`/academics/terms/${editTermId}/`, editTermForm)
      setIsEditTermOpen(false)
      setEditTermId(null)
      await load()
    } catch (e) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  const deleteYear = async (id) => {
    if (!confirm('Delete this academic year? This will also delete all terms and events.')) return
    try {
      await api.delete(`/academics/academic_years/${id}/`)
      await load()
    } catch (e) {
      alert(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  const deleteTerm = async (id) => {
    if (!confirm('Delete this term? This will also delete the associated event.')) return
    try {
      await api.delete(`/academics/terms/${id}/`)
      await load()
    } catch (e) {
      alert(e?.response?.data ? JSON.stringify(e.response.data) : e.message)
    }
  }

  return (
    <React.Fragment>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">Academic Calendar</h1>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded shadow p-4">
            <h2 className="font-medium mb-3">Create Academic Year</h2>
            <form onSubmit={createYear} className="grid gap-3">
              <input className="border p-2 rounded" placeholder="Label e.g. 2024/2025" value={yearForm.label} onChange={e=>setYearForm({...yearForm, label:e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Start Date</label>
                  <input type="date" className="border p-2 rounded w-full" value={yearForm.start_date} onChange={e=>setYearForm({...yearForm, start_date:e.target.value})} required />
                </div>
                <div>
                  <label className="text-sm text-gray-700">End Date</label>
                  <input type="date" className="border p-2 rounded w-full" value={yearForm.end_date} onChange={e=>setYearForm({...yearForm, end_date:e.target.value})} required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={yearForm.is_current} onChange={e=>setYearForm({...yearForm, is_current:e.target.checked})} /> Set as current
              </label>
              <div className="flex justify-end">
                <button className="bg-blue-600 text-white px-4 py-2 rounded">Save Year</button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded shadow p-4">
            <h2 className="font-medium mb-1">Current Academic Year</h2>
            {currentYear ? (
              <div className="text-sm text-gray-700">
                <div className="font-medium">{currentYear.label}</div>
                <div>{currentYear.start_date} — {currentYear.end_date}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Not set</div>
            )}
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">All Academic Years</div>
              <div className="divide-y border rounded">
                {(Array.isArray(years) ? years : []).map(y => (
                  <div key={y.id} className="p-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{y.label}</div>
                      <div className="text-xs text-gray-600">{y.start_date} — {y.end_date}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {y.is_current ? (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Current</span>
                        </>
                      ) : (
                        <button onClick={()=>setCurrentYearAction(y.id)} className="text-xs px-2 py-1 rounded border">Set current</button>
                      )}
                      <button onClick={()=>openEditYear(y)} className="text-xs px-2 py-1 rounded border">Edit</button>
                      <button onClick={()=>deleteYear(y.id)} className="text-xs px-2 py-1 rounded border text-red-600">Delete</button>
                    </div>
                  </div>
                ))}
                {(Array.isArray(years) ? years : []).length===0 && <div className="p-3 text-xs text-gray-500">No academic years yet.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded shadow p-4">
            <h2 className="font-medium mb-3">Create Term</h2>
            <p className="text-sm text-gray-600 mb-3">Note: Terms cannot overlap in date ranges within the same academic year. Each term number must be unique per year.</p>
            <form onSubmit={createTerm} className="grid gap-3">
              <div>
                <label className="text-sm text-gray-700">Academic Year</label>
                <select className="border p-2 rounded w-full" value={termForm.academic_year} onChange={e=>setTermForm({...termForm, academic_year:e.target.value})} required>
                  <option value="">Select year</option>
                  {(Array.isArray(years) ? years : []).map(y => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Term Number</label>
                  <select className="border p-2 rounded w-full" value={termForm.number} onChange={e=>setTermForm({...termForm, number: Number(e.target.value)})}>
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Optional Name</label>
                  <input className="border p-2 rounded w-full" placeholder="e.g. Trinity" value={termForm.name} onChange={e=>setTermForm({...termForm, name:e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Start Date</label>
                  <input type="date" className="border p-2 rounded w-full" value={termForm.start_date} onChange={e=>setTermForm({...termForm, start_date:e.target.value})} required />
                </div>
                <div>
                  <label className="text-sm text-gray-700">End Date</label>
                  <input type="date" className="border p-2 rounded w-full" value={termForm.end_date} onChange={e=>setTermForm({...termForm, end_date:e.target.value})} required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={termForm.is_current} onChange={e=>setTermForm({...termForm, is_current:e.target.checked})} /> Set as current
              </label>
              <div className="flex justify-end">
                <button className="bg-blue-600 text-white px-4 py-2 rounded">Save Term</button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded shadow p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium mb-1">Terms in Current Year</h2>
              {currentTerm && (
                <div className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Current: T{currentTerm.number}{currentTerm.name? ` • ${currentTerm.name}`:''}</div>
              )}
            </div>
            <div className="divide-y border rounded mt-2">
              {(Array.isArray(terms) ? terms : []).map(t => (
                <div key={t.id} className="p-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">T{t.number} {t.name || ''}</div>
                    <div className="text-xs text-gray-600">{t.start_date} — {t.end_date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTermCurrent(t) ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Current</span>
                    ) : (
                      <button onClick={()=>setCurrentTermAction(t.id)} className="text-xs px-2 py-1 rounded border">Set current</button>
                    )}
                    <button onClick={()=>openEditTerm(t)} className="text-xs px-2 py-1 rounded border">Edit</button>
                    <button onClick={()=>deleteTerm(t.id)} className="text-xs px-2 py-1 rounded border text-red-600">Delete</button>
                  </div>
                </div>
              ))}
              {(Array.isArray(terms) ? terms : []).length===0 && (
                <div className="p-3 text-xs text-gray-500">No terms yet for the current year.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Year Modal */}
      {isEditYearOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Academic Year</h2>
            <form onSubmit={updateYear} className="grid gap-3">
              <input className="border p-2 rounded" placeholder="Label e.g. 2024/2025" value={editYearForm.label} onChange={e=>setEditYearForm({...editYearForm, label:e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Start Date</label>
                  <input type="date" className="border p-2 rounded w-full" value={editYearForm.start_date} onChange={e=>setEditYearForm({...editYearForm, start_date:e.target.value})} required />
                </div>
                <div>
                  <label className="text-sm text-gray-700">End Date</label>
                  <input type="date" className="border p-2 rounded w-full" value={editYearForm.end_date} onChange={e=>setEditYearForm({...editYearForm, end_date:e.target.value})} required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editYearForm.is_current} onChange={e=>setEditYearForm({...editYearForm, is_current:e.target.checked})} /> Set as current
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setIsEditYearOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
                <button className="bg-blue-600 text-white px-4 py-2 rounded">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Term Modal */}
      {isEditTermOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Term</h2>
            <p className="text-sm text-gray-600 mb-3">Note: Terms cannot overlap in date ranges within the same academic year. Each term number must be unique per year.</p>
            <form onSubmit={updateTerm} className="grid gap-3">
              <div>
                <label className="text-sm text-gray-700">Academic Year</label>
                <select className="border p-2 rounded w-full" value={editTermForm.academic_year} onChange={e=>setEditTermForm({...editTermForm, academic_year:e.target.value})} required>
                  <option value="">Select year</option>
                  {years.map(y => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Term Number</label>
                  <select className="border p-2 rounded w-full" value={editTermForm.number} onChange={e=>setEditTermForm({...editTermForm, number: Number(e.target.value)})}>
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Optional Name</label>
                  <input className="border p-2 rounded w-full" placeholder="e.g. Trinity" value={editTermForm.name} onChange={e=>setEditTermForm({...editTermForm, name:e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Start Date</label>
                  <input type="date" className="border p-2 rounded w-full" value={editTermForm.start_date} onChange={e=>setEditTermForm({...editTermForm, start_date:e.target.value})} required />
                </div>
                <div>
                  <label className="text-sm text-gray-700">End Date</label>
                  <input type="date" className="border p-2 rounded w-full" value={editTermForm.end_date} onChange={e=>setEditTermForm({...editTermForm, end_date:e.target.value})} required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editTermForm.is_current} onChange={e=>setEditTermForm({...editTermForm, is_current:e.target.checked})} /> Set as current
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setIsEditTermOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
                <button className="bg-blue-600 text-white px-4 py-2 rounded">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </React.Fragment>
  )
}
