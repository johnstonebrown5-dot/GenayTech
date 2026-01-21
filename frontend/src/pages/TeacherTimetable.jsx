import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import api, { toAbsoluteUrl } from '../api'

export default function TeacherTimetable() {
  const [sp] = useSearchParams()
  const planIdQS = sp.get('planId') ? Number(sp.get('planId')) : null
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState(null)
  const [teacher, setTeacher] = useState(null)
  const [plan, setPlan] = useState(null)
  const [template, setTemplate] = useState(null)
  const [periods, setPeriods] = useState([])
  const [classList, setClassList] = useState([])
  const [classSubjectTeacherMap, setClassSubjectTeacherMap] = useState({})
  const [currentTerm, setCurrentTerm] = useState(null)
  const [currentYear, setCurrentYear] = useState(null)
  const [serverAssignments, setServerAssignments] = useState(null)
  const [school, setSchool] = useState(null)

  const activeDays = useMemo(()=>{
    const arr = (template?.days_active || [1,2,3,4,5]).filter(d=>d>=1&&d<=7)
    return arr.sort((a,b)=>a-b)
  },[template])
  const dayNames = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  const displayTeacherName = (t)=>{
    if(!t) return ''
    const u = t.user || {}
    const first = t.first_name || u.first_name || ''
    const last = t.last_name || u.last_name || ''
    const username = t.username || u.username || t.email || u.email || ''
    const full = `${first} ${last}`.trim()
    return full || username
  }

  // Initialize teacher id from user
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(()=>{ (async()=>{
    try{
      const isAdmin = !!(user?.role === 'admin' || user?.is_staff || user?.is_superuser)
      // Infer teacher id: for admins we can look up; for teachers rely on auth user
      let tid = user?.teacher_id || user?.teacher?.id || null
      if(!tid && user?.id && isAdmin){
        try{
          const res = await api.get(`/academics/teachers/?user=${user.id}`)
          const list = Array.isArray(res.data)? res.data : (res.data?.results||[])
          if(list.length>0){ tid = list[0].id; setTeacher(list[0]) }
        }catch(e){}
      }
      // For non-admin, compose a minimal teacher object from auth user for display
      if(!isAdmin && !teacher){
        setTeacher({ user: { id: user?.id }, first_name: user?.first_name, last_name: user?.last_name, username: user?.username, email: user?.email })
      }
      setTeacherId(tid||null)

      // Load plan (teacher-safe)
      let chosenPlan = null
      if(planIdQS){
        chosenPlan = { id: planIdQS, name: `Plan ${planIdQS}` }
      } else {
        // Try fetch plans for both admin and teacher (read-only for teacher)
        try{
          const res = await api.get('/academics/timetable/plans/')
          const list = Array.isArray(res.data)? res.data : (res.data?.results||[])
          chosenPlan = list?.[0] || null
        }catch(e){}
      }
      // Fallback: derive from localStorage keys
      if(!chosenPlan){
        try{
          const keys = Object.keys(localStorage)
          const ids = keys.map(k=>{ const m = k.match(/^timetable:blockAssign:(\d+)$/); return m? Number(m[1]) : null }).filter(Boolean)
          if(ids.length){ const pid = ids.sort((a,b)=>b-a)[0]; chosenPlan = { id: pid, name: `Plan ${pid}` } }
        }catch{}
      }
      setPlan(chosenPlan)
      // Load plan detail to retrieve server-side block assignments
      if(chosenPlan?.id){
        try{ const r = await api.get(`/academics/timetable/plans/${chosenPlan.id}/`); setServerAssignments(r.data?.block_assignments || null) }catch{ setServerAssignments(null) }
      } else {
        setServerAssignments(null)
      }

      // template + periods
      const tmplId = chosenPlan?.template
      if(tmplId){
        try{
          const tRes = await api.get(`/academics/timetable/templates/${tmplId}/`)
          setTemplate(tRes.data)
        }catch{}
        try{
          const pRes = await api.get(`/academics/timetable/periods/?template=${tmplId}`)
          const list = Array.isArray(pRes.data)? pRes.data : (pRes.data?.results||[])
          setPeriods(list.sort((a,b)=>a.period_index-b.period_index))
        }catch{}
      } else if (chosenPlan && !tmplId){
        // If plan was loaded but lacks embedded template id, refetch plan detail to get template
        try{
          const r = await api.get(`/academics/timetable/plans/${chosenPlan.id}/`)
          const tId = r.data?.template
          if (tId){
            try{ const tRes = await api.get(`/academics/timetable/templates/${tId}/`); setTemplate(tRes.data) }catch{}
            try{ const pRes = await api.get(`/academics/timetable/periods/?template=${tId}`); const list = Array.isArray(pRes.data)? pRes.data : (pRes.data?.results||[]); setPeriods(list.sort((a,b)=>a.period_index-b.period_index)) }catch{}
          }
        }catch{}
      }

      // classes + class-subject-teacher map
      try {
        const isAdminNow = !!(user?.role === 'admin' || user?.is_staff || user?.is_superuser)
        let list = []
        try {
          const { data } = await api.get(isAdminNow? '/academics/classes/' : '/academics/classes/mine/')
          list = Array.isArray(data)? data : (data?.results||[])
        } catch {}
        // Fallback: try general endpoint if mine() returns nothing for a teacher
        if (!isAdminNow && (!list || list.length===0)){
          try {
            const { data } = await api.get('/academics/classes/')
            list = Array.isArray(data)? data : (data?.results||[])
          } catch {}
        }
        // Hydrate classes with subjects if missing
        let hydrated = list || []
        const needDetails = (hydrated||[]).filter(c=> !Array.isArray(c.subjects) || c.subjects.length===0)
        if (needDetails.length){
          try{
            const details = await Promise.all(needDetails.map(async c=>{
              try{ const r = await api.get(`/academics/classes/${c.id}/`); return r.data }catch{return c}
            }))
            const byId = new Map(details.map(d=> [d.id, d]))
            hydrated = hydrated.map(c=> byId.get(c.id) || c)
          }catch{}
        }
        setClassList(hydrated)

        const map = {}
        if (isAdminNow){
          try {
            const all = await Promise.all((list||[]).map(async (cls)=>{
              const res = await api.get(`/academics/class_subject_teachers/?klass=${cls.id}`)
              const items = Array.isArray(res.data)? res.data : (res.data?.results||[])
              return items.map(i=> ({ key: `${cls.id}-${(i.subject||i.subject_id)}`, teacher: i.teacher_detail || { id: (i.teacher||i.teacher_id), user: (i.teacher_user? { id: i.teacher_user } : null) } }))
            }))
            for(const arr of all){ for(const it of arr){ if(it.key) map[it.key] = it.teacher } }
          } catch {}
        } else {
          // Build from embedded subject_teachers within class payload; support many shapes
          for (const cls of (hydrated||[])){
            const sts = Array.isArray(cls.subject_teachers)? cls.subject_teachers : []
            for (const st of sts){
              const subjId = st.subject || st.subject_id || st.subject_detail?.id
              // teacher_detail is the AUTH user fields (id, first_name, ...), not nested user
              const base = st.teacher_detail || {}
              const tId = st.teacher || st.teacher_id || base.id
              const tUserId = st.teacher_user || st.teacher_user_id || base.user?.id || base.id
              const tDetail = base && Object.keys(base).length>0
                ? { ...base, user: base.user || (tUserId? { id: tUserId } : undefined) }
                : { id: tId, user: tUserId? { id: tUserId } : undefined }
              if (subjId) { map[`${cls.id}-${subjId}`] = tDetail }
            }
          }
        }
        setClassSubjectTeacherMap(map)
      } catch(e) { setClassList([]); setClassSubjectTeacherMap({}) }

      // Load academic term/year (teacher-safe with graceful fallbacks)
      try {
        let year = null
        let term = null
        try { const yr = await api.get('/academics/academic_years/current/'); year = yr.data } catch {}
        try { const tr = await api.get('/academics/terms/current/'); term = tr.data } catch {}
        if (!year) {
          try {
            const mine = await api.get('/academics/academic_years/mine/')
            const list = Array.isArray(mine.data?.results) ? mine.data.results : (Array.isArray(mine.data)? mine.data : [])
            year = list[0] || null
          } catch {}
        }
        if (!term) {
          try {
            const t = await api.get('/academics/terms/of-current-year/')
            const arr = Array.isArray(t.data?.results) ? t.data.results : (Array.isArray(t.data)? t.data : [])
            term = arr.find(x=>x.is_current) || arr.sort((a,b)=> (a.number||0)-(b.number||0))[0] || null
          } catch {}
        }
        setCurrentYear(year || null)
        setCurrentTerm(term || null)
      } catch {}
      // Load school branding (safe for teacher)
      try {
        const { data } = await api.get('/auth/school/info/')
        setSchool(data || null)
      } catch {}
    } finally { setLoading(false) }
  })() }, [user?.id, refreshTick])

  const teacherName = useMemo(()=> {
    const n = displayTeacherName(teacher)
    if(n) return n
    // Fallback to auth user name if teacher profile not linked
    return `${user?.first_name||''} ${user?.last_name||''}`.trim() || user?.username || user?.email || ''
  }, [teacher, user?.first_name, user?.last_name, user?.username, user?.email])

  const blockAssignments = useMemo(()=>{
    // Prefer server-provided assignments if present
    if(serverAssignments && typeof serverAssignments === 'object') return serverAssignments
    const key = plan?.id ? `timetable:blockAssign:${plan.id}` : null
    if(!key) return {}
    try{ const raw = localStorage.getItem(key); return raw? JSON.parse(raw) : {} }catch{ return {} }
  }, [plan?.id, serverAssignments])

  const cellEntries = (day, periodIndex)=>{
    const entries = []
    for(const cls of classList){
      const assign = blockAssignments[`${day}-${cls.id}-${periodIndex}`]
      if(!assign) continue
      const t = classSubjectTeacherMap[`${cls.id}-${assign.subjectId}`]
      // match by teacher.id or nested user.id vs auth user.id
      const match = (t && (
        (teacherId && t.id === teacherId) ||
        (user?.id && (t.user?.id === user.id || t.id === user.id))
      ))
      if(match){
        const subj = (cls.subjects||[]).find(s=>s.id===assign.subjectId)
        const label = `${cls.name} — ${(subj?.code||subj?.name||'')}`
        entries.push(label)
      }
    }
    return entries
  }

  // Classes this teacher teaches (any subject mapped to this teacher)
  const teacherClasses = useMemo(()=>{
    const out = []
    for(const cls of classList){
      const teachesSubject = (cls.subjects||[]).some(s=>{
        const t = classSubjectTeacherMap[`${cls.id}-${s.id}`]
        return t && ((teacherId && t.id===teacherId) || (user?.id && t.user?.id===user.id))
      })
      const isClassTeacher = (
        String(cls.teacher||'') === String(user?.id||'') ||
        String(cls.teacher_id||'') === String(user?.id||'') ||
        cls.teacher_detail?.id === user?.id ||
        cls.teacher_detail?.user?.id === user?.id
      )
      if(teachesSubject || isClassTeacher) out.push(cls)
    }
    return out
  },[teacherId, classList, classSubjectTeacherMap, user?.id])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(null)
  const [currentDay, setCurrentDay] = useState(null) // 1=Mon..7=Sun

  // Fallback columns if periods are not defined yet
  const displayPeriods = periods && periods.length>0
    ? periods
    : Array.from({length: 11}, (_,i)=> ({ period_index: i+1, kind: 'lesson', label: `P${i+1}` }))

  // Compute current day and period based on start/end times
  useEffect(()=>{
    const now = new Date()
    const dow = ((now.getDay()+6)%7)+1
    setCurrentDay(dow)
    if (!periods || periods.length===0){ setCurrentPeriodIndex(null); return }
    const parse = (t)=>{
      const parts = String(t||'').split(':')
      const hh = parseInt(parts[0]||'0',10)||0
      const mm = parseInt(parts[1]||'0',10)||0
      const ss = parseInt(parts[2]||'0',10)||0
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, ss)
    }
    const hit = periods.find(p=>{
      if(p.kind!=='lesson') return false
      const st = parse(p.start_time)
      const en = parse(p.end_time)
      return now>=st && now<en
    })
    setCurrentPeriodIndex(hit?.period_index || null)
    const id = setInterval(()=>{
      const n = new Date()
      const h = periods.find(p=>{
        if(p.kind!=='lesson') return false
        const st = parse(p.start_time); const en = parse(p.end_time)
        return n>=st && n<en
      })
      setCurrentPeriodIndex(h?.period_index || null)
      setCurrentDay(((n.getDay()+6)%7)+1)
    }, 60000)
    return ()=> clearInterval(id)
  }, [periods])

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-header h1 { font-size: 18px; }
          .print-header p { font-size: 12px; }
        }
      `}</style>

      <div className="mb-4 rounded-2xl border border-gray-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Your Timetable</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Term: {plan?.term_detail?.name || (currentTerm ? (`T${currentTerm?.number||''}`) : (currentYear?.terms?.find(t=>t.is_current)?.name || ''))}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Year: {plan?.term_detail?.academic_year_label || currentYear?.label || ''}</span>
              {teacherName && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Teacher: {teacherName}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <select value={selectedClassId||''} onChange={(e)=>setSelectedClassId(e.target.value? Number(e.target.value): null)} className="rounded-lg border-gray-300 px-2 py-1.5 text-sm bg-white min-w-[160px] focus:ring-2 focus:ring-indigo-200">
                <option value="">Select class</option>
                {(teacherClasses.length? teacherClasses : classList).map(c=> (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <button
                disabled={!selectedClassId}
                onClick={()=>{ if(selectedClassId){ const url = `/admin/timetable/class?classId=${selectedClassId}${plan?`&planId=${plan.id}`:''}`; navigate(url) } }}
                className="px-3 py-1.5 rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 text-sm disabled:opacity-50"
              >Class View</button>
              <button
                onClick={()=>{ navigate('/teacher/block-timetable') }}
                className="px-3 py-1.5 rounded-lg text-white bg-gradient-to-r from-sky-500 to-blue-600 text-sm"
              >Block View</button>
            </div>
            <button className="px-3 py-1.5 rounded-lg text-white bg-gradient-to-r from-amber-500 to-orange-600 text-sm" onClick={()=>window.print()}>Print</button>
          </div>
        </div>
      </div>

      <div id="print-area">
        {/* Print header with school branding */}
        <div className="print-header mb-4 flex flex-col items-center gap-2 text-center">
          {school?.logo_url && (
            <img src={toAbsoluteUrl(school.logo_url)} alt="School Logo" className="h-12 w-12 object-contain mx-auto" />
          )}
          <div className="min-w-0">
            <h1 className="font-extrabold text-gray-900 leading-tight">{school?.name || ''}</h1>
            {school?.motto && <p className="text-gray-600 italic leading-tight">{school.motto}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-8 mb-3 text-[15px]">
          <div>Teacher: <span className="font-bold text-lg">{teacherName || '—'}</span></div>
          <div>Term: <span className="font-semibold">{plan?.term_detail?.name || (currentTerm ? (`T${currentTerm?.number||''}`) : (currentYear?.terms?.find(t=>t.is_current)?.name || ''))}</span></div>
          <div>Year: <span className="font-semibold">{plan?.term_detail?.academic_year_label || currentYear?.label || ''}</span></div>
        </div>
        {loading? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          <div className="a4-sheet bg-white rounded-lg border border-gray-200 shadow-sm mx-auto min-h-[60vh] flex flex-col">
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full min-w-[800px] md:min-w-0 table-fixed text-[11px] md:text-[12px] border-collapse">
                <thead>
                  <tr className="bg-blue-50/60">
                    <th className="px-2 py-5 text-left text-gray-700 w-20 uppercase tracking-wide sticky left-0 z-20 bg-blue-50/60">Day</th>
                    {displayPeriods.map(p=> {
                      const isNow = p.period_index===currentPeriodIndex
                      return (
                      <th key={`h-${p.period_index}`} className={`px-2 py-5 text-center font-semibold ${isNow? 'text-emerald-800 bg-emerald-50 ring-1 ring-emerald-300':'text-gray-800'}`}>
                        {p.kind==='lesson'? `Lesson ${p.period_index}` : (p.label||p.kind.toUpperCase())}
                      </th>)
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map(d=> {
                    const isToday = d===currentDay
                    return (
                    <tr key={`d-${d}`} className="border-t">
                      <td className={`px-2 py-5 font-semibold uppercase align-middle sticky left-0 z-10 ${isToday? 'text-emerald-800 bg-emerald-50 ring-1 ring-emerald-300':'text-gray-900 bg-gray-50'}`}>{dayNames[d]}</td>
                      {displayPeriods.map(p=>{
                        if(p.kind==='break' || p.kind==='lunch'){
                          const isNow = p.period_index===currentPeriodIndex && isToday
                          const bg = isNow ? 'bg-emerald-200 text-emerald-900' : (p.kind==='break'? 'bg-amber-200 text-amber-900' : 'bg-yellow-200 text-yellow-900')
                          return <td key={`c-${d}-${p.period_index}`} className={`px-2 py-5 text-center font-bold align-middle ${bg}`}>{(p.label||p.kind||'').toString().toUpperCase()}</td>
                        }
                        const entries = periods.length? cellEntries(d, p.period_index) : []
                        if(entries.length===0){
                          const isNow = p.period_index===currentPeriodIndex && isToday
                          return <td key={`c-${d}-${p.period_index}`} className={`px-2 py-5 text-center align-middle ${isNow? 'bg-emerald-50 text-emerald-700 font-medium':'text-gray-400'}`}>—</td>
                        }
                        const isNow = p.period_index===currentPeriodIndex && isToday
                        return (
                          <td key={`c-${d}-${p.period_index}`} className={`px-2 py-5 text-center align-middle ${isNow? 'bg-emerald-50 ring-1 ring-emerald-200':''}`}>
                            {entries.map((txt, idx)=> (
                              <div key={idx} className="leading-tight text-gray-900">{txt}</div>
                            ))}
                          </td>
                        )
                      })}
                    </tr>)
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
