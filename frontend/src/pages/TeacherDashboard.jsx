import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function TeacherDashboard(){
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [school, setSchool] = useState(null)
  const [events, setEvents] = useState([])
  const [viewMonth, setViewMonth] = useState(new Date())
  const [me, setMe] = useState(null)
  const [plan, setPlan] = useState(null)
  const [template, setTemplate] = useState(null)
  const [periods, setPeriods] = useState([])
  const [blockAssignments, setBlockAssignments] = useState({})
  const [nextClass, setNextClass] = useState(null) // {label, start: Date}

function DutiesPanel({ duties=[], onChanged }){
  const [busyId, setBusyId] = React.useState(null)
  const markDone = async (id) => {
    if (!id) return
    setBusyId(id)
    try{ await api.post(`/academics/teacher_duties/${id}/mark-done/`); await onChanged?.() }catch{} finally{ setBusyId(null) }
  }
  const list = Array.isArray(duties) ? duties.slice(0,5) : []
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-slate-900">My Duties</div>
        <span className="text-xs text-slate-500">{duties?.length || 0} pending</span>
      </div>
      {list.length === 0 ? (
        <div className="text-sm text-slate-600">No pending duties.</div>
      ) : (
        <ul className="grid gap-2">
          {list.map(d => (
            <li key={d.id} className="p-2 rounded-lg border border-gray-100 hover:bg-slate-50/60 transition">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.title}</div>
                  {d.due_date && <div className="text-xs text-slate-600">Due {d.due_date}</div>}
                </div>
                <button onClick={()=> markDone(d.id)} disabled={busyId===d.id} className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 shadow-xs">{busyId===d.id? '...':'Done'}</button>
              </div>
              {d.description && <div className="mt-1 text-xs text-slate-600 line-clamp-2">{d.description}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
  const [countdown, setCountdown] = useState('')
  const [todayPlanCount, setTodayPlanCount] = useState(0)
  const [duties, setDuties] = useState([])

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        setError('')
        // pagination-aware fetcher for DRF-style endpoints
        const fetchAll = async (path)=>{
          let out = []
          let next = path
          let guard = 0
          while (next && guard < 50){
            const url = typeof next === 'string' ? next : path
            const res = await api.get(url)
            const data = res?.data
            if (Array.isArray(data)){
              // unpaginated list
              out = data
              break
            }
            if (data && Array.isArray(data.results)){
              out = out.concat(data.results)
              next = data.next
              guard++
              continue
            }
            // fallback single payload
            break
          }
          return out
        }

        const [clsAll, sch, ev, meRes, myDuties] = await Promise.all([
          fetchAll('/academics/classes/mine/'),
          api.get('/auth/school/info/'),
          api.get('/communications/events/'),
          api.get('/auth/me/'),
          api.get('/academics/teacher_duties/?mine=1&status=pending').catch(()=>({ data:{ results:[] } })),
        ])
        if (!mounted) return
        // dedupe by id and sort by name for stable display
        const deduped = Array.from(new Map((clsAll||[]).map(c=>[c.id, c])).values())
        deduped.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')))
        setClasses(deduped)
        if (sch?.data) setSchool(sch.data)
        if (ev?.data) setEvents(Array.isArray(ev.data) ? ev.data : (ev.data?.results || []))
        if (meRes?.data) setMe(meRes.data)
        try{
          const list = Array.isArray(myDuties?.data) ? myDuties.data : (myDuties?.data?.results || [])
          setDuties(list)
        }catch{}

        // Load minimal timetable data to derive next class
        try{
          const plans = await api.get('/academics/timetable/plans/').then(r=> Array.isArray(r.data)? r.data : (r.data?.results||[])).catch(()=>[])
          const p = plans?.[0] || null
          setPlan(p)
          if (p?.id){
            try{ const r = await api.get(`/academics/timetable/plans/${p.id}/`); const ba = r.data?.block_assignments||{}; if (ba && typeof ba==='object') setBlockAssignments(ba) }catch{}
            const tId = p.template || (await api.get(`/academics/timetable/plans/${p.id}/`).then(r=>r.data?.template).catch(()=>null))
            if (tId){
              try{ const tRes = await api.get(`/academics/timetable/templates/${tId}/`); setTemplate(tRes.data) }catch{}
              try{ const pr = await api.get(`/academics/timetable/periods/?template=${tId}`); const list = Array.isArray(pr.data)? pr.data : (pr.data?.results||[]); setPeriods(list.sort((a,b)=> (a.period_index||0)-(b.period_index||0))) }catch{}
            }
          }
        }catch{}

        // Today's lesson plans count (teacher-scope via viewset)
        try{
          const today = new Date().toISOString().slice(0,10)
          const lp = await api.get(`/academics/lesson_plans/?date=${today}`).then(r=> Array.isArray(r.data)? r.data : (r.data?.results||[])).catch(()=>[])
          setTodayPlanCount(lp.length || 0)
        }catch{ setTodayPlanCount(0) }
      }catch(e){
        if (!mounted) return
        setError(e?.response?.data?.detail || e?.message || 'Failed to load classes')
      }finally{
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  },[])

  // Derive next class for TODAY using template periods and block assignments
  useEffect(()=>{
    if (!me || !plan || !template || !periods?.length || !classes?.length) { setNextClass(null); return }
    const meId = String(me?.id||'')
    const now = new Date()
    const dow = ((now.getDay()+6)%7)+1 // convert JS Sun=0..Sat=6 -> Mon=1..Sun=7
    const todayPeriods = (periods||[]).filter(p=> (p.kind||'lesson')==='lesson').sort((a,b)=> (a.period_index||0)-(b.period_index||0))
    let best = null
    for (const c of (classes||[])){
      // quick helper: does current teacher teach subject s.id in class c?
      const teaches = (subjId)=>{
        const sts = Array.isArray(c.subject_teachers)? c.subject_teachers : []
        for (const st of sts){
          const sid = st.subject || st.subject_id || st.subject_detail?.id
          const tid = st.teacher || st.teacher_id || st.teacher_detail?.id || st.teacher_detail?.user?.id
          if (String(sid)===String(subjId) && String(tid)===meId) return true
        }
        // If class teacher and no mapping, allow all subjects of the class
        const isCT = [c?.teacher, c?.teacher_detail?.id, c?.teacher_detail?.user?.id].map(v=> (v==null?'':String(v))).includes(meId)
        return isCT
      }
      for (const p of todayPeriods){
        const key = `${dow}-${c.id}-${p.period_index}`
        const assign = (blockAssignments||{})[key]
        // If there is no assignment for this slot, skip unless teacher is class teacher (fallback placeholder)
        if (!assign){
          // Fallback: if teacher is CT of this class, propose generic lesson slot
          const isCT = [c?.teacher, c?.teacher_detail?.id, c?.teacher_detail?.user?.id].map(v=> (v==null?'':String(v))).includes(meId)
          if (!isCT) continue
        }
        const subjId = assign ? (assign.subjectId ?? assign.subject_id ?? assign.subject ?? assign.subjectID) : null
        if (assign && !teaches(subjId)) continue
        // Build Date for period start today
        const timeParts = String(p.start_time||'08:00:00').split(':')
        const hh = parseInt(timeParts[0]||'8',10)||8
        const mm = parseInt(timeParts[1]||'0',10)||0
        const ss = parseInt(timeParts[2]||'0',10)||0
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, ss||0)
        if (start > now){
          const subjectLabel = assign ? (assign.subjectCode || assign.subject_name || assign.subject || `Lesson ${p.period_index}`) : `Lesson ${p.period_index}`
          if (!best || start < best.start) best = { label: `${c.name} — ${subjectLabel}`.trim(), start }
        }
      }
    }
    setNextClass(best)
  }, [me, plan, template, periods, blockAssignments, classes])

  // Live countdown updater (1s for accuracy)
  useEffect(()=>{
    if (!nextClass?.start){ setCountdown(''); return }
    const tick = ()=>{
      const now = new Date()
      const diff = Math.max(0, nextClass.start - now)
      const mins = Math.floor(diff/60000)
      const secs = Math.floor((diff%60000)/1000)
      const hrs = Math.floor(mins/60)
      const remMin = mins%60
      const label = hrs>0 ? `${hrs}h ${remMin}m` : `${remMin}m ${secs.toString().padStart(2,'0')}s`
      setCountdown(label)
    }
    tick()
    const id = setInterval(tick, 1000)
    return ()=> clearInterval(id)
  }, [nextClass?.start])

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-gradient-to-b from-slate-50 to-white">
      {/* Header - elevated gradient card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
        <div className="pointer-events-none absolute -top-10 right-0 h-44 w-44 rounded-full bg-indigo-500/15 blur-2" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="p-4 md:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {school?.logo_url ? (
              <img src={school.logo_url} alt="School logo" className="h-12 w-12 rounded-xl bg-white p-1 object-contain border border-gray-200 shadow-sm" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl shadow-sm">🏫</div>
            )}
            <div>
              <div className="text-lg md:text-2xl font-extrabold tracking-tight text-slate-900">Teacher Dashboard</div>
              <div className="text-slate-600 text-xs md:text-sm truncate flex items-center gap-2">
                <span>{school?.name || '—'}</span>
                {school?.term && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">{school.term}</span>}
              </div>
            </div>
          </div>
          <div className="hidden sm:block text-xs md:text-sm text-slate-600">Quick actions and classes</div>
        </div>
      </div>

      {/* Summary cards */}
      {/* Mobile: horizontal snap scroller */}
      <div className="sm:hidden -mx-2 px-2">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 no-scrollbar">
          <DashCard title="Classes" value={classes.length} icon="📚" to="/teacher/classes" accent="from-indigo-500 to-indigo-600"/>
          <DashCard title="Attendance" value="Mark" icon="🗓️" to="/teacher/attendance" accent="from-emerald-500 to-emerald-600"/>
          <DashCard title="Lesson Plans" value="Create" icon="🧭" to="/teacher/lessons" accent="from-fuchsia-500 to-pink-600"/>
          <DashCard title="Grades" value="Input" icon="📝" to="/teacher/grades" accent="from-amber-500 to-orange-600"/>
        </div>
      </div>
      {/* Desktop/tablet: grid */}
      <div className="hidden sm:grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4 items-stretch">
        <DashCard title="Classes" value={classes.length} icon="📚" to="/teacher/classes" accent="from-indigo-500 to-indigo-600"/>
        <DashCard title="Attendance" value="Mark" icon="🗓️" to="/teacher/attendance" accent="from-emerald-500 to-emerald-600"/>
        <DashCard title="Lesson Plans" value="Create" icon="🧭" to="/teacher/lessons" accent="from-fuchsia-500 to-pink-600"/>
        <DashCard title="Grades" value="Input" icon="📝" to="/teacher/grades" accent="from-amber-500 to-orange-600"/>
      </div>

      {/* Next class + Today's tasks */}
      <div className="grid gap-3 sm:grid-cols-2">
        <NextClassCard nextClass={nextClass} countdown={countdown} />
        <TodayTasksCard classes={classes} me={me} plansCount={todayPlanCount} />
      </div>

      {/* Main content: Calendar left, Quick panels right on large screens */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Events Calendar" action={<Link to="/teacher/events" className="text-sm text-blue-600 hover:underline">View All →</Link>}>
            <MiniCalendar events={events} month={viewMonth} onPrev={()=>setViewMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()-1); return d })} onNext={()=>setViewMonth(prev=>{ const d=new Date(prev); d.setMonth(d.getMonth()+1); return d })} onToday={()=>setViewMonth(new Date())} />
          </SectionCard>
        </div>
        <div className="space-y-4">
          <QuickPanel title="Lesson Plans" description="Plan upcoming lessons, objectives and activities." link="/teacher/lessons" actionLabel="Create Plan"/>
          <QuickPanel title="Profile" description="Update your info or change your password." link="/teacher/profile" actionLabel="Open Profile"/>
          <DutiesPanel duties={duties} onChanged={async ()=>{
            try{
              const res = await api.get('/academics/teacher_duties/?mine=1&status=pending')
              const list = Array.isArray(res?.data) ? res.data : (res?.data?.results || [])
              setDuties(list)
            }catch{}
          }} />
        </div>
      </div>

      {/* Errors/Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({length:4}).map((_,i)=>(<SkeletonCard key={i}/>))}
        </div>
      )}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200">{error}</div>}

      {/* Assigned classes */}
      <SectionCard title="Assigned Classes" action={<Link to="/teacher/classes" className="text-sm text-blue-600 hover:underline">Manage</Link>}>
        {(!classes || classes.length===0) ? (
          <EmptyState icon="📦" title="No classes yet" subtitle="Once classes are assigned, they will show up here." action={<Link to="/teacher/classes" className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Browse Classes</Link>} />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {classes.map(c => (
              <li key={c.id} className="group border border-gray-200 rounded-2xl p-3 sm:p-4 bg-white hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-gray-500">ID: {c.id}</div>
                  </div>
                  <Chip>{c.grade_level}</Chip>
                </div>
                {/* Subjects taught */}
                {getMySubjectNames(c, me).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {getMySubjectNames(c, me).slice(0,6).map(sub => (
                      <Chip key={sub}>{sub}</Chip>
                    ))}
                    {getMySubjectNames(c, me).length > 6 && (
                      <span className="text-[11px] text-gray-500">+{getMySubjectNames(c, me).length - 6} more</span>
                    )}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Link to={`/teacher/classes?class=${c.id}`} className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Open<span>→</span></Link>
                  <Link to={`/teacher/attendance?class=${c.id}`} className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Attendance</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Assigned classes (full width) */}
      {/* Quick links moved to the right of calendar above on large screens */}
    </div>
  )
}

function DashCard({ title, value, to, icon, accent }){
  return (
    <Link to={to} className="group relative rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-3 sm:p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all snap-center min-w-[260px]">
      <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 blur-sm transition" />
      <div className="flex items-center gap-3 relative z-10">
        <IconBox accent={accent}>{icon || '➡️'}</IconBox>
        <div>
          <div className="text-xs text-slate-600">{title}</div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
        </div>
      </div>
      <div className="text-slate-400 group-hover:translate-x-0.5 transition relative z-10">→</div>
    </Link>
  )
}

function QuickPanel({ title, description, link, actionLabel }){
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-4 flex items-center justify-between shadow-sm hover:shadow-md transition">
      <div>
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-sm text-slate-600">{description}</div>
      </div>
      <Link to={link} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-black/90 text-sm shadow-sm">{actionLabel}</Link>
    </div>
  )
}

/* UI Helpers */
function SectionCard({ title, action, children }){
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="border-b px-4 py-2 flex items-center justify-between bg-gray-50">
        <div className="font-medium text-slate-800">{title}</div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Chip({ children }){
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">{children}</span>
}

function IconBox({ children, accent = 'from-indigo-500 to-indigo-600' }){
  return (
    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-white flex items-center justify-center text-xl bg-gradient-to-br ${accent} shadow-sm ring-1 ring-black/5`}>{children}</div>
  )
}

/* Next Class + Today Tasks */
function NextClassCard({ nextClass, countdown }){
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium text-slate-900">My Next Class</div>
        <span className="text-xs text-slate-500">Today</span>
      </div>
      {!nextClass ? (
        <div className="text-sm text-slate-600">No upcoming class today.</div>
      ) : (
        <div className="flex items-center gap-3">
          <IconBox accent="from-sky-500 to-blue-600">📘</IconBox>
          <div className="min-w-0">
            <div className="font-semibold truncate">{nextClass.label}</div>
            <div className="text-xs text-slate-600">Starts {nextClass.start?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            <div className="text-xs text-emerald-700 mt-0.5">{countdown}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function TodayTasksCard({ classes=[], me, plansCount=0 }){
  // Find class teacher class (first)
  const meId = String(me?.id || '')
  const myClass = (classes||[]).find(c => [c?.teacher, c?.teacher_detail?.id, c?.teacher_detail?.user?.id].map(v=> (v==null? '' : String(v))).includes(meId))
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-4 shadow-sm">
      <div className="font-medium text-slate-900 mb-2">Today's Tasks</div>
      <ul className="grid gap-2">
        <li className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-slate-50/60 transition">
          <div className="flex items-center gap-2 min-w-0">
            <IconBox accent="from-emerald-500 to-green-600">✅</IconBox>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">Lesson Plans</div>
              <div className="text-xs text-slate-600">{plansCount} plan(s) today</div>
            </div>
          </div>
          <Link to="/teacher/lessons" className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 shadow-xs">Open</Link>
        </li>
        <li className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-slate-50/60 transition">
          <div className="flex items-center gap-2 min-w-0">
            <IconBox accent="from-amber-500 to-orange-600">🗓️</IconBox>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">Attendance {myClass? `— ${myClass.name}`:''}</div>
              <div className="text-xs text-slate-600">Mark attendance for today</div>
            </div>
          </div>
          <Link to="/teacher/attendance" className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 shadow-xs">Mark</Link>
        </li>
      </ul>
    </div>
  )
}

function SkeletonCard(){
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200" />
        <div className="flex-1">
          <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon='📭', title='Nothing here', subtitle='No data to show yet.', action }){
  return (
    <div className="text-center py-8 text-slate-600">
      <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl shadow-xs">{icon}</div>
      <div className="font-medium text-slate-800">{title}</div>
      <div className="text-sm">{subtitle}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// Try to extract subject names from various possible API shapes
function getSubjectNames(c){
  if (!c) return []
  const out = []
  const push = (v) => { if (v && String(v).trim()) out.push(String(v).trim()) }
  // arrays of subjects
  if (Array.isArray(c.subjects)){
    c.subjects.forEach(s=> push(typeof s === 'string' ? s : (s?.name || s?.title || s?.code)))
  }
  if (Array.isArray(c.subject_names)){
    c.subject_names.forEach(s=> push(s))
  }
  if (Array.isArray(c.subject_details)){
    c.subject_details.forEach(s=> push(s?.name || s?.title || s?.code))
  }
  // single subject fields
  if (c.subject) push(typeof c.subject === 'string' ? c.subject : (c.subject?.name || c.subject?.title || c.subject?.code))
  if (c.subject_detail) push(c.subject_detail?.name || c.subject_detail?.title || c.subject_detail?.code)
  // sometimes mapping may be under teacher_subjects
  if (Array.isArray(c.teacher_subjects)){
    c.teacher_subjects.forEach(ts=> push(ts?.subject_name || ts?.name || ts?.subject || ts?.code))
  }
  // dedupe
  return Array.from(new Set(out))
}

// Derive subject names that the current teacher teaches in a given class, with graceful fallbacks
function getMySubjectNames(c, me){
  if (!c) return []
  const meId = String(me?.id || '')
  const subjectsArr = Array.isArray(c.subjects) ? c.subjects : []
  // If there is a mapping of subject_teachers, restrict to those where teacher matches me
  if (Array.isArray(c.subject_teachers) && c.subject_teachers.length && meId){
    const allowedIds = new Set(
      c.subject_teachers
        .filter(st => String(st?.teacher || st?.teacher_detail?.id || '') === meId)
        .map(st => String(st?.subject || st?.subject_id || st?.subject_detail?.id || ''))
        .filter(Boolean)
    )
    const mine = subjectsArr.filter(s => allowedIds.has(String(s?.id)))
    if (mine.length){
      return mine.map(s => s?.code || s?.name || s?.title).filter(Boolean)
    }
  }
  // If teacher is class teacher and no mapping available, show all subjects
  if (meId && String(c?.teacher) === meId){
    return subjectsArr.map(s => s?.code || s?.name || s?.title).filter(Boolean)
  }
  // Fallbacks: try any subject name fields available on the class
  const any = getSubjectNames(c)
  return any
}

/* Mini Calendar copied/adapted from AdminDashboard */
function MiniCalendar({ events=[], month=new Date(), onPrev, onNext, onToday }){
  const startOfMonth = (d) => { const x=new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x }
  const startOfCalendarGrid = (d) => {
    const first = startOfMonth(d)
    const day = first.getDay()
    const diff = day
    const gridStart = new Date(first); gridStart.setDate(first.getDate() - diff); gridStart.setHours(0,0,0,0)
    return gridStart
  }
  const buildMonthGrid = (d) => {
    const start = startOfCalendarGrid(d)
    const days = []
    for (let i=0; i<42; i++){
      const day = new Date(start); day.setDate(start.getDate()+i)
      day.setHours(0,0,0,0)
      days.push(day)
    }
    return days
  }
  const localKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}` }
  const monthDays = buildMonthGrid(month)
  const eventsByDay = (events||[]).reduce((map, ev) => { const key = localKey(ev.start); if (!map[key]) map[key] = []; map[key].push(ev); return map }, {})
  const colorForEvent = (ev) => {
    const key = (ev?.category || ev?.audience || ev?.visibility || '').toString().toLowerCase()
    switch (true) {
      case /student/.test(key): return { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
      case /teach/.test(key): return { chip: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' }
      case /parent|guard/.test(key): return { chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
      case /exam|assessment|test/.test(key): return { chip: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' }
      case /holiday|break|vacation/.test(key): return { chip: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' }
      default: return { chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
    }
  }

  return (
    <div className="overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs sm:text-sm text-slate-600 font-medium">{month.toLocaleString(undefined,{ month:'long', year:'numeric' })}</div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={onPrev} className="p-2 sm:p-2.5 rounded-full border border-slate-200 hover:bg-slate-50" aria-label="Previous month">‹</button>
          <button onClick={onNext} className="p-2 sm:p-2.5 rounded-full border border-slate-200 hover:bg-slate-50" aria-label="Next month">›</button>
          <button onClick={onToday} className="px-2 py-1 text-[10px] sm:text-xs rounded-full border border-slate-200 hover:bg-slate-50">Today</button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-7 text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="px-0.5 sm:px-1 py-0.5 sm:py-1 text-center tracking-wide">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((d,i)=>{
            const key = localKey(d)
            const inMonth = d.getMonth()===month.getMonth()
            const isToday = key === localKey(new Date())
            const dayEvents = eventsByDay[key] || []
            const color = dayEvents.length>0 ? colorForEvent(dayEvents[0]) : null
            const baseBg = inMonth ? 'bg-white' : 'bg-slate-50'
            const activeBg = color ? color.chip.split(' ').find(c=>c.startsWith('bg-')) : baseBg
            return (
              <div key={i} className={`relative rounded-xl min-h-[52px] sm:min-h-[68px] p-1.5 sm:p-2 text-[10px] sm:text-xs border ${inMonth? 'border-slate-200':'border-slate-200/70'} ${dayEvents.length? activeBg : baseBg} hover:border-indigo-300 hover:shadow-[0_2px_10px_rgba(2,6,23,0.06)] transition-all`}>
                <div className="flex items-center justify-between">
                  <div className={`${inMonth? 'text-slate-800':'text-slate-400'} text-[10px] sm:text-[11px] font-semibold`}>{d.getDate()}</div>
                  {isToday && <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Today</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayEvents.slice(0,2).map(ev => {
                    const c = colorForEvent(ev)
                    return (
                      <span key={ev.id} className={`px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] border truncate max-w-full shadow-xs ${c.chip}`} title={ev.title}>
                        {ev.title}
                      </span>
                    )
                  })}
                  {dayEvents.length>2 && <span className="text-[9px] sm:text-[10px] text-slate-500">+{dayEvents.length-2} more</span>}
                </div>
                {dayEvents.length>0 && (
                  <div className="absolute bottom-1 right-2 inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${color?.dot || 'bg-blue-500'}`} />
                    {dayEvents.length}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
