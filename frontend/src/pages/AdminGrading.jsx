import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'

export default function AdminGrading(){
  const [subjects, setSubjects] = useState([])
  const [stageTab, setStageTab] = useState('primary') // 'primary' | 'junior'
  const [stageBands, setStageBands] = useState({ primary: [], junior: [] })
  const [stageLoading, setStageLoading] = useState(false)
  const [stageEdit, setStageEdit] = useState(false)
  const savingStageRef = useRef({})

  const [subjectId, setSubjectId] = useState('')
  const [subjectBands, setSubjectBands] = useState([])
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [subjectEdit, setSubjectEdit] = useState(false)
  const savingSubRef = useRef({})

  useEffect(()=>{
    let active = true
    ;(async()=>{
      try{
        const s = await api.get('/academics/subjects/')
        const sArr = Array.isArray(s.data) ? s.data : (Array.isArray(s.data?.results)? s.data.results: [])
        if (active) setSubjects(sArr)
      }catch{
        if (active) setSubjects([])
      }
    })()
    return ()=>{ active = false }
  }, [])

  const loadStage = async (stg) => {
    setStageLoading(true)
    try{
      const r = await api.get('/academics/stage_grading/', { params: { stage: stg, _: Date.now() } })
      const list = Array.isArray(r.data) ? r.data : (Array.isArray(r.data?.results) ? r.data.results : [])
      setStageBands(prev => ({ ...prev, [stg]: list }))
    }catch{
      setStageBands(prev => ({ ...prev, [stg]: [] }))
    }finally{
      setStageLoading(false)
    }
  }

  useEffect(()=>{ loadStage('primary') }, [])
  useEffect(()=>{ loadStage('junior') }, [])

  const addStageRow = () => {
    setStageEdit(true)
    setStageBands(prev => ({ ...prev, [stageTab]: [...(prev[stageTab]||[]), { id: undefined, stage: stageTab, grade: '', min: 0, max: 0, order: (prev[stageTab]||[]).length }] }))
  }
  const updateStageField = (idx, key, value) => {
    setStageEdit(true)
    setStageBands(prev => ({ ...prev, [stageTab]: (prev[stageTab]||[]).map((b,i)=> i===idx ? { ...b, [key]: key==='grade' ? value : Number(value) } : b) }))
  }
  const saveStageRow = async (idx) => {
    const row = (stageBands[stageTab]||[])[idx]
    try{
      savingStageRef.current[idx] = true
      if (row.id){
        const { data } = await api.patch(`/academics/stage_grading/${row.id}/`, { grade: row.grade, min: row.min, max: row.max, order: row.order })
        setStageBands(prev => ({ ...prev, [stageTab]: (prev[stageTab]||[]).map((b,i)=> i===idx ? data : b) }))
      }else{
        const { data } = await api.post(`/academics/stage_grading/`, { stage: stageTab, grade: row.grade, min: row.min, max: row.max, order: row.order })
        setStageBands(prev => ({ ...prev, [stageTab]: (prev[stageTab]||[]).map((b,i)=> i===idx ? data : b) }))
      }
    }finally{
      savingStageRef.current[idx] = false
    }
  }
  const deleteStageRow = async (idx) => {
    const row = (stageBands[stageTab]||[])[idx]
    if (row.id){
      await api.delete(`/academics/stage_grading/${row.id}/`)
    }
    setStageBands(prev => ({ ...prev, [stageTab]: (prev[stageTab]||[]).filter((_,i)=>i!==idx) }))
  }

  const loadSubjectBands = async (sid) => {
    if (!sid){ setSubjectBands([]); return }
    setSubjectLoading(true)
    try{
      const r = await api.get(`/academics/subject_grading/?subject=${sid}`)
      const list = Array.isArray(r.data) ? r.data : (Array.isArray(r.data?.results) ? r.data.results : [])
      setSubjectBands(list)
    }catch{ setSubjectBands([]) }
    finally{ setSubjectLoading(false) }
  }

  useEffect(()=>{ loadSubjectBands(subjectId) }, [subjectId])

  const addSubjectRow = () => {
    setSubjectEdit(true)
    setSubjectBands(prev => [...prev, { id: undefined, subject: Number(subjectId), grade: '', min: 0, max: 0, order: prev.length }])
  }
  const updateSubjectField = (idx, key, value) => {
    setSubjectEdit(true)
    setSubjectBands(prev => prev.map((b,i)=> i===idx ? { ...b, [key]: key==='grade' ? value : Number(value) } : b))
  }
  const saveSubjectRow = async (idx) => {
    const row = subjectBands[idx]
    try{
      savingSubRef.current[idx] = true
      if (row.id){
        const { data } = await api.patch(`/academics/subject_grading/${row.id}/`, { grade: row.grade, min: row.min, max: row.max, order: row.order })
        setSubjectBands(prev => prev.map((b,i)=> i===idx ? data : b))
      }else{
        const { data } = await api.post(`/academics/subject_grading/`, { subject: Number(subjectId), grade: row.grade, min: row.min, max: row.max, order: row.order })
        setSubjectBands(prev => prev.map((b,i)=> i===idx ? data : b))
      }
    }finally{
      savingSubRef.current[idx] = false
    }
  }
  const deleteSubjectRow = async (idx) => {
    const row = subjectBands[idx]
    if (row.id){ await api.delete(`/academics/subject_grading/${row.id}/`) }
    setSubjectBands(prev => prev.filter((_,i)=>i!==idx))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Grading</h1>
          <p className="text-sm text-gray-600">Manage common stage grading and subject overrides.</p>
        </div>
      </div>

      {/* Stage grading */}
      <div className="bg-white rounded-xl shadow p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Stage Grading (School-wide)</div>
          <div className="inline-flex rounded overflow-hidden border">
            <button className={`px-3 py-1 text-sm ${stageTab==='primary'?'bg-gray-800 text-white':'bg-white'}`} onClick={()=>setStageTab('primary')}>Primary</button>
            <button className={`px-3 py-1 text-sm ${stageTab==='junior'?'bg-gray-800 text-white':'bg-white'}`} onClick={()=>setStageTab('junior')}>Junior Secondary</button>
          </div>
        </div>
        <div className="overflow-x-auto rounded border">
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
              {(stageBands[stageTab]||[]).length===0 ? (
                <tr><td className="px-2 py-2 text-gray-500" colSpan={6}>{stageLoading? 'Loading…' : 'No bands yet.'}</td></tr>
              ) : (
                (stageBands[stageTab]||[]).map((g, idx) => (
                  <tr key={g.id || `stg-${idx}`}>
                    <td className="border px-2 py-1 text-center">
                      {!stageEdit ? (
                        <button type="button" title="Edit" className="text-gray-600 hover:text-gray-900" onClick={()=>setStageEdit(true)}>✏️</button>
                      ) : null}
                    </td>
                    <td className="border px-2 py-1 w-28">
                      {stageEdit ? (
                        <input className="border p-1 rounded w-full" value={g.grade||''} onChange={e=>updateStageField(idx,'grade',e.target.value)} />
                      ) : (g.grade || '')}
                    </td>
                    <td className="border px-2 py-1 w-28">
                      {stageEdit ? (
                        <input className="border p-1 rounded w-full" type="number" min={0} step={1} value={g.min ?? ''} onChange={e=>updateStageField(idx,'min',e.target.value)} />
                      ) : (g.min ?? '')}
                    </td>
                    <td className="border px-2 py-1 w-28">
                      {stageEdit ? (
                        <input className="border p-1 rounded w-full" type="number" min={0} step={1} value={g.max ?? ''} onChange={e=>updateStageField(idx,'max',e.target.value)} />
                      ) : (g.max ?? '')}
                    </td>
                    <td className="border px-2 py-1 w-24">
                      {stageEdit ? (
                        <input className="border p-1 rounded w-full" type="number" value={g.order ?? idx} onChange={e=>updateStageField(idx,'order',e.target.value)} />
                      ) : (g.order ?? idx)}
                    </td>
                    <td className="border px-2 py-1 w-40">
                      {stageEdit ? (
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={()=>saveStageRow(idx)} className="text-blue-600 hover:underline">Save</button>
                          <button type="button" onClick={()=>deleteStageRow(idx)} className="text-red-600 hover:underline">Delete</button>
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
          <button type="button" onClick={addStageRow} className="px-3 py-1.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Add Band</button>
          {!stageEdit && <div className="text-xs text-gray-500">Click ✏️ to start editing. Changes are saved when you click Save.</div>}
        </div>
      </div>

      {/* Subject overrides */}
      <div className="bg-white rounded-xl shadow p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Subject Overrides</div>
          <div className="flex items-center gap-2">
            <select className="border p-2 rounded" value={subjectId} onChange={e=>setSubjectId(e.target.value)}>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" onClick={()=> setSubjectEdit(true)} className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100">Edit</button>
            <button type="button" onClick={addSubjectRow} className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Add Band</button>
          </div>
        </div>
        <div className="overflow-x-auto rounded border">
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
              {(!subjectId || subjectBands.length===0) ? (
                <tr><td className="px-2 py-2 text-gray-500" colSpan={6}>{subjectLoading? 'Loading…' : (subjectId? 'No bands yet.' : 'Select a subject')}</td></tr>
              ) : (
                subjectBands.map((g, idx) => (
                  <tr key={g.id || `sb-${idx}`}>
                    <td className="border px-2 py-1 text-center">
                      {!subjectEdit ? (
                        <button type="button" title="Edit" className="text-gray-600 hover:text-gray-900" onClick={()=>setSubjectEdit(true)}>✏️</button>
                      ) : null}
                    </td>
                    <td className="border px-2 py-1 w-28">
                      {subjectEdit ? (
                        <input className="border p-1 rounded w-full" value={g.grade||''} onChange={e=>updateSubjectField(idx,'grade',e.target.value)} />
                      ) : (g.grade || '')}
                    </td>
                    <td className="border px-2 py-1 w-28">
                      {subjectEdit ? (
                        <input className="border p-1 rounded w-full" type="number" min={0} step={1} value={g.min ?? ''} onChange={e=>updateSubjectField(idx,'min',e.target.value)} />
                      ) : (g.min ?? '')}
                    </td>
                    <td className="border px-2 py-1 w-28">
                      {subjectEdit ? (
                        <input className="border p-1 rounded w-full" type="number" min={0} step={1} value={g.max ?? ''} onChange={e=>updateSubjectField(idx,'max',e.target.value)} />
                      ) : (g.max ?? '')}
                    </td>
                    <td className="border px-2 py-1 w-24">
                      {subjectEdit ? (
                        <input className="border p-1 rounded w-full" type="number" value={g.order ?? idx} onChange={e=>updateSubjectField(idx,'order',e.target.value)} />
                      ) : (g.order ?? idx)}
                    </td>
                    <td className="border px-2 py-1 w-40">
                      {subjectEdit ? (
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={()=>saveSubjectRow(idx)} className="text-blue-600 hover:underline">Save</button>
                          <button type="button" onClick={()=>deleteSubjectRow(idx)} className="text-red-600 hover:underline">Delete</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
