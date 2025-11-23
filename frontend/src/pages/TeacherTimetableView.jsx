import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'

export default function TeacherTimetableView(){
  const [sp] = useSearchParams()
  const teacherIdQS = sp.get('teacherId') ? Number(sp.get('teacherId')) : null
  const planIdQS = sp.get('planId') ? Number(sp.get('planId')) : null

  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState(teacherIdQS)
  const [teacher, setTeacher] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [plan, setPlan] = useState(null)
  const [template, setTemplate] = useState(null)
  const [periods, setPeriods] = useState([])
  const [classList, setClassList] = useState([])
  const [classSubjectTeacherMap, setClassSubjectTeacherMap] = useState({}) // `${classId}-${subjectId}` -> teacher_detail

  const activeDays = useMemo(()=>{
    const arr = (template?.days_active || [1,2,3,4,5]).filter(d=>d>=1&&d<=7)
    return arr.sort((a,b)=>a-b)
  },[template])
  const dayNames = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  useEffect(()=>{ (async()=>{
    try{
      // teachers list
      try{
        const res = await api.get('/academics/teachers/')
        const list = Array.isArray(res.data)? res.data : (res.data?.results||[])
        setTeachers(list)
        if(teacherIdQS){
          const t = list.find(x=>x.id===teacherIdQS) || null
          setTeacher(t)
        }
      }catch(e){ setTeachers([]) }

      // plan
      let chosenPlan = null
      if(planIdQS){
        try{ const res = await api.get(`/academics/timetable/plans/${planIdQS}/`); chosenPlan = res.data }catch(e){}
      }
      if(!chosenPlan){
        const res = await api.get('/academics/timetable/plans/')
        const list = Array.isArray(res.data)? res.data : (res.data?.results||[])
        chosenPlan = list?.[0] || null
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

      // classes + class-subject-teacher map
      try {
        const { data } = await api.get('/academics/classes/')
        const list = Array.isArray(data)? data : (data?.results||[])
        setClassList(list)
        try {
          const all = await Promise.all(
            (list||[]).map(async (cls)=>{
              const res = await api.get(`/academics/class_subject_teachers/?klass=${cls.id}`)
              const items = Array.isArray(res.data)? res.data : (res.data?.results||[])
              return items.map(i=> ({ key: `${cls.id}-${i.subject}`, teacher: i.teacher_detail || null }))
            })
          )
          const map = {}
          for(const arr of all){ for(const it of arr){ map[it.key] = it.teacher } }
          setClassSubjectTeacherMap(map)
        }catch(e){ setClassSubjectTeacherMap({}) }
      } catch(e) { setClassList([]) }
    } finally { setLoading(false) }
  })() }, [teacherIdQS, planIdQS])

  const displayTeacherName = (t)=>{
    if(!t) return ''
    const u = t.user || {}
    const first = t.first_name || u.first_name || ''
    const last = t.last_name || u.last_name || ''
    const full = `${first} ${last}`.trim()
    const uname = t.username || u.username || t.email || u.email || ''
    return full || uname
  }
  const teacherName = useMemo(()=>{
    const t = teacher || teachers.find(x=>x.id===teacherId) || null
    if(!t) return ''
    const full = `${t.first_name||''} ${t.last_name||''}`.trim()
    return full || t.username || ''
  }, [teacher, teacherId, teachers])

  const teacherUserId = useMemo(()=>{
    const t = teacher || teachers.find(x=>x.id===teacherId) || null
    return t?.user?.id || null
  }, [teacher, teacherId, teachers])
  
  // read block assignments per plan
  const blockAssignments = useMemo(()=>{
    const key = plan?.id ? `timetable:blockAssign:${plan.id}` : null
    if(!key) return {}
    try{ const raw = localStorage.getItem(key); return raw? JSON.parse(raw) : {} }catch{ return {} }
  }, [plan?.id])

  // For each day/period, find classes where this teacher teaches; return array of labels
  const cellEntries = (day, periodIndex)=>{
    if(!teacherId && !teacherUserId) return []
    const entries = []
    for(const cls of classList){
      const assign = blockAssignments[`${day}-${cls.id}-${periodIndex}`]
      if(!assign) continue
      const t = classSubjectTeacherMap[`${cls.id}-${assign.subjectId}`]
      if(t && ((teacherId && t.id === teacherId) || (teacherUserId && t.user && t.user.id === teacherUserId))){
        const subj = (cls.subjects||[]).find(s=>s.id===assign.subjectId)
        const label = `${cls.name} — ${(subj?.code||subj?.name||'')}`
        entries.push(label)
      }
    }
    return entries
  }

  return (
    <React.Fragment>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Print styles */}
        <style>{`
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>

        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap no-print">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Teacher Timetable</h1>
            <div className="text-base text-gray-700">Plan: <span className="font-semibold">{plan?.name||'-'}</span></div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50" onClick={()=>window.print()}>Print</button>
          </div>
        </div>

        <div id="print-area">
          <div className="flex flex-wrap items-center gap-4 sm:gap-8 mb-3 text-[15px]">
            <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
              <div className="min-w-0">Teacher: <span className="font-bold text-lg">{teacherName || 'Select a teacher'}</span></div>
              <div className="no-print w-full sm:w-auto">
                <div className="relative w-full sm:w-auto">
                  <select
                    value={teacherId||''}
                    onChange={(e)=>setTeacherId(e.target.value? Number(e.target.value): null)}
                    className="rounded-lg border-gray-300 pl-3 pr-9 py-2 text-base sm:text-sm shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-[260px]"
                  >
                    <option value="">Select teacher</option>
                    {teachers.map(t=> (
                      <option key={t.id} value={t.id}>{displayTeacherName(t) || `Teacher #${t.id}`}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
            </div>
            <div>Term: <span className="font-semibold">{plan?.term_detail?.name || `T${plan?.term_detail?.number||''}`}</span></div>
            <div>Year: <span className="font-semibold">{plan?.term_detail?.academic_year_label || ''}</span></div>
          </div>

          {loading? (
            <div className="text-gray-500">Loading…</div>
          ) : !teacherId ? (
            <div className="text-gray-500">Select a teacher to view timetable.</div>
          ) : periods.length===0 ? (
            <div className="text-gray-500">No timetable data.</div>
          ) : (
            <div className="a4-sheet bg-white rounded-lg border border-gray-200 shadow-sm mx-auto">
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-[12px] border-collapse min-w-[640px]">
                  <thead className="sticky top-0 bg-blue-50/60 z-10">
                    <tr>
                      <th className="px-2 py-4 text-left text-gray-700 w-24 sticky left-0 bg-blue-50/60 z-20 uppercase tracking-wide">Day</th>
                      {periods.map(p=> (
                        <th key={`h-${p.period_index}`} className="px-2 py-4 text-center text-gray-800 font-semibold min-w-20 md:min-w-28">
                          {p.kind==='lesson'? `Lesson ${p.period_index}` : (p.label||p.kind.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDays.map(d=> (
                      <tr key={`d-${d}`} className="border-t">
                        <td className="px-2 py-4 font-semibold text-gray-900 bg-white sticky left-0 z-10 uppercase align-middle w-24 border-r">{dayNames[d]}</td>
                        {periods.map(p=>{
                          if(p.kind==='break' || p.kind==='lunch'){
                            const bg = p.kind==='break'? 'bg-amber-200 text-amber-900' : 'bg-yellow-200 text-yellow-900'
                            return <td key={`c-${d}-${p.period_index}`} className={`px-2 py-4 text-center font-bold align-middle ${bg}`}>{(p.label||p.kind||'').toString().toUpperCase()}</td>
                          }
                          const entries = cellEntries(d, p.period_index)
                          if(entries.length===0){
                            return <td key={`c-${d}-${p.period_index}`} className="px-2 py-4 text-center text-gray-400 align-middle">—</td>
                          }
                          return (
                            <td key={`c-${d}-${p.period_index}`} className="px-2 py-4 text-center align-middle">
                              {entries.map((txt, idx)=> (
                                <div key={idx} className="leading-tight text-gray-900">{txt}</div>
                              ))}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  )
}
