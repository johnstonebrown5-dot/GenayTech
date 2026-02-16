import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

export default function TeacherBlockTimetable(){
  const [plan, setPlan] = useState(null)
  const [template, setTemplate] = useState(null)
  const [periods, setPeriods] = useState([])
  const [classList, setClassList] = useState([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [serverAssignments, setServerAssignments] = useState(null)

  const activeDays = useMemo(()=>{
    const arr = (template?.days_active || [1,2,3,4,5]).filter(d=>d>=1&&d<=7)
    return arr.sort((a,b)=>a-b)
  },[template])
  const dayNames = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  // load plan/template/periods and classes
  useEffect(()=>{ (async()=>{
    try{
      // plan (teacher-safe): try API, else fallback from localStorage keys
      let chosenPlan = null
      try{
        const pub = await api.get('/academics/timetable/plans/?status=published')
        const pubList = Array.isArray(pub.data)? pub.data : (pub.data?.results||[])
        chosenPlan = pubList?.[0] || null
      }catch{}
      if(!chosenPlan){
        try{ const res = await api.get('/academics/timetable/plans/')
          const list = Array.isArray(res.data)? res.data : (res.data?.results||[])
          chosenPlan = list?.[0] || null
        }catch{}
      }
      if(!chosenPlan){
        try{
          const keys = Object.keys(localStorage)
          const ids = keys.map(k=>{ const m = k.match(/^timetable:blockAssign:(\d+)$/); return m? Number(m[1]) : null }).filter(Boolean)
          if(ids.length){ const pid = ids.sort((a,b)=>b-a)[0]; chosenPlan = { id: pid, name: `Plan ${pid}` } }
        }catch{}
      }
      setPlan(chosenPlan)

      // Fetch server-side block assignments from the plan detail
      if(chosenPlan?.id){
        try{ const r = await api.get(`/academics/timetable/plans/${chosenPlan.id}/`); setServerAssignments(r.data?.block_assignments || null) }catch{ setServerAssignments(null) }
      } else {
        setServerAssignments(null)
      }

      const tmplId = chosenPlan?.template
      if(tmplId){
        try{ const tRes = await api.get(`/academics/timetable/templates/${tmplId}/`); setTemplate(tRes.data) }catch{}
        try{ const pRes = await api.get(`/academics/timetable/periods/?template=${tmplId}`)
          const list = Array.isArray(pRes.data)? pRes.data : (pRes.data?.results||[])
          setPeriods(list.sort((a,b)=>a.period_index-b.period_index))
        }catch{}
      }

      try {
        let list = []
        try{ const { data } = await api.get('/academics/classes/mine/'); list = Array.isArray(data)? data : (data?.results||[]) }catch{}
        if(!list || list.length===0){
          try{ const { data } = await api.get('/academics/classes/'); list = Array.isArray(data)? data : (data?.results||[]) }catch{}
        }
        setClassList(list||[])
      } catch { setClassList([]) }
    }catch{}
  })() },[])

  // read block assignments
  const blockAssignments = useMemo(()=>{
    // Prefer server-side assignments if available
    if(serverAssignments && typeof serverAssignments === 'object') return serverAssignments
    const key = plan?.id ? `timetable:blockAssign:${plan.id}` : null
    if(!key) return {}
    try{ const raw = localStorage.getItem(key); return raw? JSON.parse(raw) : {} }catch{ return {} }
  }, [plan?.id, serverAssignments])

  // Fallback columns if periods are not defined
  const displayPeriods = periods && periods.length>0
    ? periods
    : Array.from({length: 11}, (_,i)=> ({ period_index: i+1, kind: 'lesson', label: `P${i+1}` }))

  return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Block Timetable</h1>
            <div className="text-sm text-gray-700">Plan: <span className="font-medium">{plan?.name || '-'}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-800">Classes × Sessions</div>
            <div className="flex items-center gap-1">
              {activeDays.map(d=> (
                <button key={d} onClick={()=>setSelectedDay(d)} className={`px-2.5 py-1 rounded text-xs border ${selectedDay===d? 'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                  {dayNames[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600 w-48">Class</th>
                  {displayPeriods.map((p)=> (
                    <th key={`bh-${p.id||p.period_index}`} className="px-3 py-2 text-center text-gray-700 min-w-28">
                      <div className="font-medium">{p.kind==='lesson' ? `Lesson ${p.period_index}` : (p.label || p.kind.toUpperCase())}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classList.length>0 ? classList.map(cls => (
                  <tr key={cls.id} className="border-t">
                    <td className="px-3 py-2 font-medium text-gray-800 bg-gray-50 whitespace-nowrap">{cls.name || `Class ${cls.id}`}</td>
                    {displayPeriods.map(p => {
                      const cellKey = `${selectedDay}-${cls.id}-${p.period_index}`
                      const assigned = blockAssignments[cellKey]
                      return (
                        <td key={`bc-${cls.id}-${p.id||p.period_index}`} className="px-2 py-3 text-center align-middle border-l">
                          {p.kind==='break' || p.kind==='lunch' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600 border border-gray-200">{p.label||p.kind.toUpperCase()}</span>
                          ) : (
                            <span className={`inline-block min-w-24 px-2 py-1 rounded text-xs border ${assigned? 'border-blue-200 bg-blue-50 text-blue-700':'border-gray-200 bg-gray-50 text-gray-500'}`}>
                              {assigned? (()=>{
                                const subj = (cls.subjects||[]).find(s=>s.id===assigned.subjectId)
                                return subj?.code || subj?.name || 'Assigned'
                              })() : 'Session'}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )) : (
                  <tr><td colSpan={periods.length+1} className="px-3 py-4 text-center text-gray-500">No classes found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}
