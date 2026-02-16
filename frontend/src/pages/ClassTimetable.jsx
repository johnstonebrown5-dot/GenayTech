import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'

export default function ClassTimetable(){
  const [sp] = useSearchParams()
  const classId = sp.get('classId') ? Number(sp.get('classId')) : null
  const planIdQS = sp.get('planId') ? Number(sp.get('planId')) : null

  const [loading, setLoading] = useState(true)
  const [klass, setKlass] = useState(null)
  const [teachersMap, setTeachersMap] = useState({}) // `${classId}-${subjectId}` -> teacher_detail
  const [plan, setPlan] = useState(null)
  const [template, setTemplate] = useState(null)
  const [periods, setPeriods] = useState([])
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(null)

  const activeDays = useMemo(()=>{
    const arr = (template?.days_active || [1,2,3,4,5]).filter(d=>d>=1&&d<=7)
    return arr.sort((a,b)=>a-b)
  },[template])
  const dayNames = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  // Badge letters for days (Mon..Fri). Spells BREAK: Mon=B, Tue=R, Wed=E, Thu=A, Fri=K
  const dayBadges = { 1:'B', 2:'R', 3:'E', 4:'A', 5:'K', 6:'S', 7:'S' }

  // Load plan -> template -> periods, class, teachers
  useEffect(()=>{ (async()=>{
    if(!classId){ setLoading(false); return }
    try{
      // plan
      let chosenPlan = null
      if(planIdQS){
        try{ const res = await api.get(`/academics/timetable/plans/${planIdQS}/`); chosenPlan = res.data }catch(e){}
      }
      if(!chosenPlan){
        try{
          const pub = await api.get('/academics/timetable/plans/?status=published')
          const pubList = Array.isArray(pub.data)? pub.data : (pub.data?.results||[])
          chosenPlan = pubList?.[0] || null
        }catch(e){}
        if(!chosenPlan){
          const res = await api.get('/academics/timetable/plans/')
          const list = Array.isArray(res.data)? res.data : (res.data?.results||[])
          chosenPlan = list?.[0] || null
        }
      }
      setPlan(chosenPlan)

      // template + periods
      const tmplId = chosenPlan?.template
      if(tmplId){
        const tRes = await api.get(`/academics/timetable/templates/${tmplId}/`)
        setTemplate(tRes.data)
        const pRes = await api.get(`/academics/timetable/periods/?template=${tmplId}`)
        const list = Array.isArray(pRes.data)? pRes.data : (pRes.data?.results||[])
        setPeriods(list.sort((a,b)=>a.period_index-b.period_index))
      } else {
        setTemplate(null)
        setPeriods([])
      }

      // class detail (try list then detail for teacher info)
      try{
        let k = null
        try{
          const cRes = await api.get('/academics/classes/')
          const cs = Array.isArray(cRes.data)? cRes.data : (cRes.data?.results||[])
          k = cs.find(x=>x.id===classId) || null
        }catch(e){}
        try{
          const one = await api.get(`/academics/classes/${classId}/`)
          // prefer detailed response if available
          k = { ...(k||{}), ...(one?.data||{}) }
        }catch(e){}
        setKlass(k)
      }catch(e){ setKlass(null) }

      // class-subject-teacher map
      try{
        const map = {}
        const cstRes = await api.get(`/academics/class_subject_teachers/?klass=${classId}`)
        const items = Array.isArray(cstRes.data)? cstRes.data : (cstRes.data?.results||[])
        for(const it of items){ map[`${classId}-${it.subject}`] = it.teacher_detail || null }
        setTeachersMap(map)
      }catch(e){ setTeachersMap({}) }
    }finally{
      setLoading(false)
    }
  })() }, [classId, planIdQS])

  const teacherNameFor = (subjectId)=>{
    const t = teachersMap[`${classId}-${subjectId}`]
    if(!t) return ''
    const first = t.first_name || ''
    const last = t.last_name || ''
    const username = t.username || ''
    const full = `${first} ${last}`.trim()
    return full || username
  }

  // read block assignments from localStorage per-plan
  const blockAssignments = useMemo(()=>{
    const key = plan?.id ? `timetable:blockAssign:${plan.id}` : null
    if(!key) return {}
    try{ const raw = localStorage.getItem(key); return raw? JSON.parse(raw) : {} }catch{ return {} }
  }, [plan?.id])

  // Determine current period index for today using period start/end times
  useEffect(()=>{
    if (!periods || periods.length===0) { setCurrentPeriodIndex(null); return }
    const now = new Date()
    const parse = (t)=>{
      const parts = String(t||'').split(':')
      const hh = parseInt(parts[0]||'0',10)||0
      const mm = parseInt(parts[1]||'0',10)||0
      const ss = parseInt(parts[2]||'0',10)||0
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, ss)
      return d
    }
    const idx = periods.find(p=>{
      const st = parse(p.start_time)
      const en = parse(p.end_time)
      return now >= st && now < en
    })?.period_index || null
    setCurrentPeriodIndex(idx)
    // refresh every 30s
    const id = setInterval(()=>{
      const nx = periods.find(p=>{
        const st = parse(p.start_time)
        const en = parse(p.end_time)
        const n = new Date()
        return n >= st && n < en
      })?.period_index || null
      setCurrentPeriodIndex(nx)
    }, 30000)
    return ()=> clearInterval(id)
  }, [periods])

  const subjectFromId = (sid)=> (klass?.subjects||[]).find(s=>s.id===sid)
  const classTeacherName = ()=>{
    const t = klass?.class_teacher_detail || klass?.teacher_detail || klass?.class_teacher || klass?.teacher
    if(!t || typeof t === 'number') return ''
    const first = t.first_name || ''
    const last = t.last_name || ''
    const username = t.username || ''
    const full = `${first} ${last}`.trim()
    return full || username
  }

  return (
    <React.Fragment>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Print styles for A4 landscape */}
        <style>{`
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            /* Hide everything except the print area */
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            .a4-sheet { box-shadow: none !important; border: none !important; width: 100% !important; }
          }
        `}</style>
        <div className="flex items-center justify-between mb-4 no-print">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Class Timetable</h1>
            <div className="text-base text-gray-700">Plan: <span className="font-semibold">{plan?.name||'-'}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50" onClick={()=>window.print()}>Print</button>
          </div>
        </div>

        <div id="print-area">
        <div className="flex flex-wrap items-center gap-8 mb-4 text-[15px]">
          <div>Class: <span className="font-bold text-lg">{klass?.name || classId}</span></div>
          <div>Term: <span className="font-semibold">{plan?.term_detail?.name || `T${plan?.term_detail?.number||''}`}</span></div>
          <div>Year: <span className="font-semibold">{plan?.term_detail?.academic_year_label || ''}</span></div>
          {classTeacherName() && (<div>Class Teacher: <span className="font-semibold">{classTeacherName()}</span></div>)}
        </div>

        {loading? (
          <div className="text-gray-500">Loading…</div>
        ) : (!klass || periods.length===0) ? (
          <div className="text-gray-500">No timetable data.</div>
        ) : (
          <div className="a4-sheet bg-white rounded-lg border border-gray-200 shadow-sm mx-auto">
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-[12px] border-collapse">
                <thead>
                  <tr className="bg-blue-50/60">
                    <th className="px-2 py-3 text-left text-gray-700 w-20 uppercase tracking-wide">Day</th>
                    {periods.map(p=> {
                      const isNow = p.period_index === currentPeriodIndex
                      return (
                        <th key={`h-${p.period_index}`} className={`px-2 py-3 text-center font-semibold ${isNow? 'text-emerald-800 bg-emerald-50 ring-1 ring-emerald-300':'text-gray-800'}`}>
                          {p.kind==='lesson'? `Lesson ${p.period_index}` : (p.label||p.kind.toUpperCase())}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map(d=> (
                    <tr key={`d-${d}`} className="border-t">
                      <td className="px-2 py-3 font-semibold text-gray-900 bg-gray-50 uppercase align-middle">{dayNames[d]}</td>
                      {periods.map(p=>{
                        const cell = blockAssignments[`${d}-${classId}-${p.period_index}`]
                        if(p.kind==='break' || p.kind==='lunch'){
                          const isNow = p.period_index === currentPeriodIndex
                          const bg = isNow ? 'bg-emerald-200 text-emerald-900' : (p.kind==='break'? 'bg-amber-200 text-amber-900' : 'bg-yellow-200 text-yellow-900')
                          const breakBadge = {1:'B',2:'R',3:'E',4:'A',5:'K'}[d] || 'B'
                          const lunchBadge = {1:'L',2:'U',3:'N',4:'C',5:'H'}[d] || 'L'
                          const content = p.kind==='break' ? breakBadge : lunchBadge
                          return <td key={`c-${d}-${p.period_index}`} className={`px-2 py-3 text-center font-bold align-middle ${bg}`}>{content}</td>
                        }
                        if(!cell){
                          const isNow = p.period_index === currentPeriodIndex
                          return <td key={`c-${d}-${p.period_index}`} className={`px-2 py-3 text-center align-middle ${isNow? 'bg-emerald-50 text-emerald-700 font-medium':'text-gray-400'}`}>—</td>
                        }
                        const subj = subjectFromId(cell.subjectId)
                        const tn = teacherNameFor(cell.subjectId)
                        const isNow = p.period_index === currentPeriodIndex
                        return (
                          <td key={`c-${d}-${p.period_index}`} className={`px-2 py-3 text-center align-middle ${isNow? 'bg-emerald-50 ring-1 ring-emerald-200':''}`}>
                            <div className="font-medium text-gray-900 leading-tight">{subj?.code || subj?.name || ''}</div>
                            {tn && <div className="text-[10px] text-gray-600 leading-tight">{tn}</div>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 text-[11px] text-gray-600">Class Teacher: <span className="font-medium">{classTeacherName() || '____________________'}</span></div>
          </div>
        )}
        </div>
      </div>
    </React.Fragment>
  )
}
