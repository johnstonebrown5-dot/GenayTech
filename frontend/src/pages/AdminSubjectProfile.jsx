import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useNotification } from '../components/NotificationContext'

export default function AdminSubjectProfile(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [subject, setSubject] = useState(null)
  const [stats, setStats] = useState({ avg_by_grade: [], teachers: [], grading: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingSubject, setEditingSubject] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', category: 'other' })
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
          setForm({ code: s.data?.code || '', name: s.data?.name || '', category: s.data?.category || 'other' })
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

  const gradePerf = stats?.avg_by_grade || []
  const teachers = stats?.teachers || []
  const grading = (bands && bands.length>0) ? bands : (stats?.grading || [])
  const categoryBadgeClasses = useMemo(()=>{
    const c = (subject?.category || 'other').toString()
    if (c === 'language') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (c === 'science') return 'bg-green-50 text-green-700 border-green-200'
    if (c === 'arts') return 'bg-pink-50 text-pink-700 border-pink-200'
    if (c === 'humanities') return 'bg-yellow-50 text-yellow-800 border-yellow-200'
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }, [subject?.category])

  return (
    <React.Fragment>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="space-y-1">
            {!editingSubject ? (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{subject?.name || 'Subject'}</h1>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-white text-gray-700 border-gray-200">Code: {subject?.code || '-'}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${categoryBadgeClasses}`}>Category: {(subject?.category||'other').toString().replace(/^./,c=>c.toUpperCase())}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Code"
                  value={form.code}
                  onChange={e=>setForm(f=>({...f, code: e.target.value}))}
                />
                <input
                  className="border rounded px-3 py-1.5 min-w-[260px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Name"
                  value={form.name}
                  onChange={e=>setForm(f=>({...f, name: e.target.value}))}
                />
                <select
                  className="border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 bg-white">Back</button>
            <Link to="/admin/subjects" className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 bg-white">All Subjects</Link>
            {!editingSubject ? (
              <button onClick={()=>setEditingSubject(true)} className="px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Edit</button>
            ) : (
              <>
                <button
                  disabled={savingSubject}
                  onClick={async()=>{
                    setSavingSubject(true)
                    try{
                      const payload = { code: form.code, name: form.name, category: form.category }
                      const { data } = await api.patch(`/academics/subjects/${id}/`, payload)
                      setSubject(data)
                      setForm({ code: data.code, name: data.name, category: data.category||'other' })
                      setEditingSubject(false)
                      showSuccess && showSuccess('Saved', 'Subject updated')
                    }catch(e){
                      showError && showError('Save Failed', e?.response?.data ? JSON.stringify(e.response.data) : 'Could not update subject')
                    }finally{ setSavingSubject(false) }
                  }}
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingSubject? 'Saving…' : 'Save'}
                </button>
                <button
                  disabled={savingSubject}
                  onClick={()=>{ setEditingSubject(false); setForm({ code: subject?.code||'', name: subject?.name||'', category: subject?.category||'other' }) }}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                >Cancel</button>
              </>
            )}
          </div>
        </div>

        {loading && <div>Loading subject...</div>}
        {error && <div className="text-red-600 text-sm">{error}</div>}

        {!loading && !error && (
          <div className="grid md:grid-cols-3 gap-5">
            {/* Performance across grades */}
            <div className="md:col-span-2 p-5 rounded-lg border border-gray-200 bg-white shadow-sm border-t-4 border-indigo-500">
              <div className="text-sm font-semibold text-gray-900 mb-3">Average Performance Across Grades</div>
              {gradePerf.length === 0 ? (
                <div className="text-sm text-gray-500">No data available.</div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const max = Math.max(...gradePerf.map(g=>g.average||0), 1)
                    return gradePerf.map(g => (
                      <div key={g.grade_level} className="flex items-center gap-3">
                        <div className="text-xs w-24 text-gray-700">{g.grade_level}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-indigo-600 h-2 rounded-full" style={{width: `${Math.min(100, (g.average/max)*100)}%`}}></div>
                        </div>
                        <div className="w-12 text-right text-xs text-gray-700">{Number(g.average||0).toFixed(1)}</div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>

            {/* Teachers */}
            <div className="p-5 rounded-lg border border-gray-200 bg-white shadow-sm border-t-4 border-emerald-500">
              <div className="text-sm font-semibold text-gray-900 mb-3">Teachers</div>
              {teachers.length === 0 ? (
                <div className="text-sm text-gray-500">No teachers allocated for this subject.</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {teachers.map(t => (
                    <li key={t.id} className="flex items-center justify-between">
                      <span className="text-gray-800">{t.user?.first_name} {t.user?.last_name} (@{t.user?.username})</span>
                      {t.klass_detail?.name && <span className="text-xs text-gray-500">Class: {t.klass_detail.name}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Subject Components (Papers) */}
            <div className="md:col-span-3 p-5 rounded-lg border border-gray-200 bg-white shadow-sm border-t-4 border-slate-500">
              <div className="text-sm font-semibold text-gray-900 mb-3">Subject Components (Papers)</div>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {loadingComponents ? (
                  <div className="text-sm text-gray-500">Loading components…</div>
                ) : (
                  (components||[]).map((c, idx) => (
                    <div key={c.id || `cm-${idx}`} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{c.name || 'Component'}</div>
                        {!compEditMode && (
                          <button type="button" title="Edit" className="text-gray-600 hover:text-gray-900" onClick={ensureCompEditable}>✏️</button>
                        )}
                      </div>
                      {compEditMode ? (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <input className="border p-2 rounded" placeholder="Code" value={c.code||''} onChange={e=>updateCompField(idx,'code',e.target.value)} />
                          <input className="border p-2 rounded col-span-2" placeholder="Name" value={c.name||''} onChange={e=>updateCompField(idx,'name',e.target.value)} />
                          <input className="border p-2 rounded" type="number" min={0} step="1" placeholder="Max Marks" value={c.max_marks ?? ''} onChange={e=>updateCompField(idx,'max_marks',e.target.value)} />
                          <input className="border p-2 rounded" type="number" step="0.01" placeholder="Weight" value={c.weight ?? 1} onChange={e=>updateCompField(idx,'weight',e.target.value)} />
                          <input className="border p-2 rounded" type="number" placeholder="Order" value={c.order ?? idx} onChange={e=>updateCompField(idx,'order',e.target.value)} />
                          <div className="col-span-2 flex items-center gap-4 pt-1">
                            <button type="button" onClick={()=>saveCompRow(idx)} className="text-blue-600">Save</button>
                            <button type="button" onClick={()=>deleteCompRow(idx)} className="text-red-600">Delete</button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700 space-y-1">
                          <div><span className="text-gray-500">Code:</span> {c.code||'-'}</div>
                          <div><span className="text-gray-500">Max Marks:</span> {c.max_marks ?? '-'}</div>
                          <div><span className="text-gray-500">Weight:</span> {c.weight ?? 1}</div>
                          <div><span className="text-gray-500">Order:</span> {c.order ?? idx}</div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {/* Desktop table */}
              <div className="overflow-x-auto rounded-md border hidden md:block">
                <table className="min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="border px-2 py-1 text-left w-10"></th>
                      <th className="border px-2 py-1 text-left">Code</th>
                      <th className="border px-2 py-1 text-left">Name</th>
                      <th className="border px-2 py-1 text-left">Max Marks</th>
                      <th className="border px-2 py-1 text-left">Weight</th>
                      <th className="border px-2 py-1 text-left">Order</th>
                      <th className="border px-2 py-1 text-left w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingComponents ? (
                      <tr><td className="px-2 py-2 text-gray-500" colSpan={7}>Loading components…</td></tr>
                    ) : (
                      (components||[]).map((c, idx) => (
                        <tr key={c.id || `c-${idx}`}>
                          <td className="border px-2 py-1 text-center">
                            <button type="button" title="Edit" className="text-gray-600 hover:text-gray-900" onClick={ensureCompEditable}>✏️</button>
                          </td>
                          <td className="border px-2 py-1 w-28">
                            {compEditMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" value={c.code||''} onChange={e=>updateCompField(idx,'code',e.target.value)} />
                            ) : (c.code || '')}
                          </td>
                          <td className="border px-2 py-1 w-64">
                            {compEditMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" value={c.name||''} onChange={e=>updateCompField(idx,'name',e.target.value)} />
                            ) : (c.name || '')}
                          </td>
                          <td className="border px-2 py-1 w-28">
                            {compEditMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" min={0} step="1" value={c.max_marks ?? ''} onChange={e=>updateCompField(idx,'max_marks',e.target.value)} />
                            ) : (c.max_marks ?? '')}
                          </td>
                          <td className="border px-2 py-1 w-28">
                            {compEditMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" step="0.01" value={c.weight ?? 1} onChange={e=>updateCompField(idx,'weight',e.target.value)} />
                            ) : (c.weight ?? 1)}
                          </td>
                          <td className="border px-2 py-1 w-24">
                            {compEditMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" value={c.order ?? idx} onChange={e=>updateCompField(idx,'order',e.target.value)} />
                            ) : (c.order ?? idx)}
                          </td>
                          <td className="border px-2 py-1 w-40">
                            {compEditMode ? (
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={()=>saveCompRow(idx)} className="text-blue-600 hover:underline">Save</button>
                                <button type="button" onClick={()=>deleteCompRow(idx)} className="text-red-600 hover:underline">Delete</button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={addCompRow} className="px-3 py-1.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Add Component</button>
                {!compEditMode && <div className="text-xs text-gray-500">Click ✏️ to start editing. Changes are saved when you click Save.</div>}
              </div>
            </div>

            {/* Grading Bands */}
            <div className="md:col-span-3 p-5 rounded-lg border border-gray-200 bg-white shadow-sm border-t-4 border-amber-500">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-900">Grading Bands</div>
                <div className="flex items-center gap-2">
                  {!editMode ? (
                    <button type="button" onClick={ensureEditable} className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100">Edit</button>
                  ) : null}
                  <button type="button" onClick={addRow} className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Add Band</button>
                </div>
              </div>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {(grading||[]).length === 0 ? (
                  <div className="text-sm text-gray-500">No grading bands yet.</div>
                ) : (
                  (grading||[]).map((g, idx) => (
                    <div key={g.id || `gm-${idx}`} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">Band {g.grade || '-'}</div>
                        {!editMode && (
                          <button type="button" title="Edit" className="text-gray-600 hover:text-gray-900" onClick={ensureEditable}>✏️</button>
                        )}
                      </div>
                      {editMode ? (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <input className="border p-2 rounded" placeholder="Grade" value={g.grade||''} onChange={e=>updateField(idx,'grade',e.target.value)} />
                          <input className="border p-2 rounded" type="number" min={0} step="1" placeholder="Min" value={g.min ?? ''} onChange={e=>updateField(idx,'min',e.target.value)} />
                          <input className="border p-2 rounded" type="number" min={0} step="1" placeholder="Max" value={g.max ?? ''} onChange={e=>updateField(idx,'max',e.target.value)} />
                          <input className="border p-2 rounded" type="number" placeholder="Order" value={g.order ?? idx} onChange={e=>updateField(idx,'order',e.target.value)} />
                          <div className="col-span-2 flex items-center gap-4 pt-1">
                            <button type="button" onClick={()=>saveRow(idx)} className="text-blue-600">Save</button>
                            <button type="button" onClick={()=>deleteRow(idx)} className="text-red-600">Delete</button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700 space-y-1">
                          <div><span className="text-gray-500">Min:</span> {g.min ?? '-'}</div>
                          <div><span className="text-gray-500">Max:</span> {g.max ?? '-'}</div>
                          <div><span className="text-gray-500">Order:</span> {g.order ?? idx}</div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {/* Desktop table */}
              <div className="overflow-x-auto rounded-md border hidden md:block">
                <table className="min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="border px-2 py-1 text-left w-10"></th>
                      <th className="border px-2 py-1 text-left">Grade</th>
                      <th className="border px-2 py-1 text-left">Min</th>
                      <th className="border px-2 py-1 text-left">Max</th>
                      <th className="border px-2 py-1 text-left">Order</th>
                      <th className="border px-2 py-1 text-left w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(grading||[]).length === 0 ? (
                      <tr><td className="px-2 py-2 text-gray-500" colSpan={6}>No grading bands yet.</td></tr>
                    ) : (
                      (grading||[]).map((g, idx) => (
                        <tr key={g.id || `g-${idx}`}>
                          <td className="border px-2 py-1 text-center">
                            {!editMode ? (
                              <button type="button" title="Edit" className="text-gray-600 hover:text-gray-900" onClick={ensureEditable}>✏️</button>
                            ) : null}
                          </td>
                          <td className="border px-2 py-1 w-28">
                            {editMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" value={g.grade||''} onChange={e=>updateField(idx,'grade',e.target.value)} />
                            ) : (g.grade || '')}
                          </td>
                          <td className="border px-2 py-1 w-28">
                            {editMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" min={0} step={1} value={g.min ?? ''} onChange={e=>updateField(idx,'min',e.target.value)} />
                            ) : (g.min ?? '')}
                          </td>
                          <td className="border px-2 py-1 w-28">
                            {editMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" min={0} step={1} value={g.max ?? ''} onChange={e=>updateField(idx,'max',e.target.value)} />
                            ) : (g.max ?? '')}
                          </td>
                          <td className="border px-2 py-1 w-24">
                            {editMode ? (
                              <input className="border p-1 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" value={g.order ?? idx} onChange={e=>updateField(idx,'order',e.target.value)} />
                            ) : (g.order ?? idx)}
                          </td>
                          <td className="border px-2 py-1 w-40">
                            {editMode ? (
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={()=>saveRow(idx)} className="text-blue-600 hover:underline">Save</button>
                                <button type="button" onClick={()=>deleteRow(idx)} className="text-red-600 hover:underline">Delete</button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!editMode && <div className="mt-2 text-xs text-gray-500">Click ✏️ or Edit to start editing. Changes are saved when you click Save.</div>}
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  )
}
