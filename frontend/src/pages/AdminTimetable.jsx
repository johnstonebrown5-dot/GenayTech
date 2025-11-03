import React, { useEffect, useMemo, useState, useRef } from 'react'
import AdminLayout from '../components/AdminLayout'
import api from '../api'

export default function AdminTimetable() {
  const [showCreate, setShowCreate] = useState(false)
  const [showManage, setShowManage] = useState(false)
  // templates
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const selectedTemplate = useMemo(()=> templates.find(t=>t.id===selectedTemplateId) || null, [templates, selectedTemplateId])
  const [periods, setPeriods] = useState([]) // fixed design periods
  // in-grid lesson text (local draft only for the single design)
  const [cellLessons, setCellLessons] = useState({}) // key `${day}-${period_index}` -> string
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  // plan state
  const [years, setYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState(null)
  const [terms, setTerms] = useState([])
  const [currentPlan, setCurrentPlan] = useState(null)
  const [plans, setPlans] = useState([])
  // create modal form
  const [createName, setCreateName] = useState('')
  const [createTermId, setCreateTermId] = useState(null)
  const [createTemplateId, setCreateTemplateId] = useState(null)
  // edit toggle for period headers
  const [editingTimes, setEditingTimes] = useState(false)
  const [showSessions, setShowSessions] = useState(false) // collapsed by default
  // Block view (default on, persisted)
  const [showBlockView, setShowBlockView] = useState(()=>{
    try { const v = localStorage.getItem('timetable:blockView'); return v ? v==='1' : true } catch { return true }
  })
  const [classList, setClassList] = useState([])
  // Block assignments per plan per day: { `${day}-${classId}-${period_index}`: { subjectId } }
  const [blockAssignments, setBlockAssignments] = useState({})
  const [editingCell, setEditingCell] = useState(null) // key `${day}-${classId}-${period_index}`
  const [selectedBlockDay, setSelectedBlockDay] = useState(1) // 1=Mon
  const [savingBlocks, setSavingBlocks] = useState(false)
  // Map of `${classId}-${subjectId}` -> teacherDetail
  const [classSubjectTeacherMap, setClassSubjectTeacherMap] = useState({})
  // Quick views
  const [showClassView, setShowClassView] = useState(false)
  const [showTeacherView, setShowTeacherView] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [backupAssign, setBackupAssign] = useState(null)
  // Priority selection UI state
  const [showPriorityModal, setShowPriorityModal] = useState(false)
  const [prioritySubjectIds, setPrioritySubjectIds] = useState([]) // array of subject ids
  const [priorityMaxPerDay, setPriorityMaxPerDay] = useState(2)
  const [mathKeyword, setMathKeyword] = useState('math')
  const [pendingGenerate, setPendingGenerate] = useState(false)
  const [allSubjects, setAllSubjects] = useState([])
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  // Daily cap for teacher workload (max lessons per day)
  const [maxTeacherLessonsPerDay, setMaxTeacherLessonsPerDay] = useState(5)
  // Save feedback
  const [saveError, setSaveError] = useState(null)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  // Prevent initial autosave race that can overwrite server with {}
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false)

  // Prefetch all subjects once so manual assignment isn't blocked when classes lack attached subjects
  useEffect(()=>{ (async()=>{
    try{
      if(allSubjects.length===0 && !loadingSubjects){
        setLoadingSubjects(true)
        const { data } = await api.get('/academics/subjects/')
        const list = Array.isArray(data) ? data : (data?.results || [])
        setAllSubjects(list)
      }
    }catch{ setAllSubjects([]) }
    finally{ setLoadingSubjects(false) }
  })() }, [])

  // ===== Auto-generate (greedy, teacher no-conflict) =====
  const autoGenerate = ()=>{
    if(!selectedTemplate) return
    // Save backup for revert
    try{
      setBackupAssign(blockAssignments)
      if(currentPlan?.id){ localStorage.setItem(`timetable:blockAssignBackup:${currentPlan.id}`, JSON.stringify(blockAssignments)) }
    }catch{}
    const days = (selectedTemplate?.days_active || [1,2,3,4,5]).slice().sort((a,b)=>a-b)
    const sortedPeriods = periods.slice().sort((a,b)=>a.period_index-b.period_index)
    const lessonPeriods = sortedPeriods.filter(p=>p.kind==='lesson')
    if(lessonPeriods.length===0 || classList.length===0) return

    // Build per-class subject cycle (ids only) and map to teacher ids
    const classSubjectsMap = new Map()
    for(const cls of classList){
      const subs = getClassSubjects(cls).map(s=>s.id)
      const startIdx = subs.length ? Math.floor(Math.random()*subs.length) : 0
      classSubjectsMap.set(cls.id, { subjects: subs, idx: startIdx })
    }

    


    const nextSubjectFor = (classId)=>{
      const rec = classSubjectsMap.get(classId)
      if(!rec || rec.subjects.length===0) return null
      const subjId = rec.subjects[rec.idx % rec.subjects.length]
      rec.idx = (rec.idx + 1) % rec.subjects.length
      return subjId
    }

    // teacher conflict tracker: day-period -> Set(teacherId)
    const busy = new Map()
    const keyDP = (d, p)=> `${d}-${p}`
    // Track per-day teaching load per teacher
    const teacherDailyCount = new Map() // key `${day}-${teacherId}` -> count
    const keyTD = (d, tid)=> `${d}-${String(tid)}`

    // Priority detection helpers
    const isPrioritySubject = (s)=>{
      if(!s) return false
      const name = (s.name||'').toLowerCase()
      const code = (s.code||'').toLowerCase()
      const kw = (mathKeyword||'').toLowerCase().trim()
      const keywordHit = kw? (name.includes(kw) || code.includes(kw)) : false
      const selectedHit = prioritySubjectIds.includes(s.id)
      return keywordHit || selectedHit
    }
    const isMathSubject = (s)=>{
      if(!s) return false
      const kw = (mathKeyword||'').toLowerCase().trim()
      if(!kw) return false
      const name = (s.name||'').toLowerCase()
      const code = (s.code||'').toLowerCase()
      return name.includes(kw) || code.includes(kw)
    }
    const subjectById = new Map()
    for(const cls of classList){
      for(const s of getClassSubjects(cls)) subjectById.set(s.id, s)
    }
    // Also include global subjects so labels work even when classes have no attached subjects
    for(const s of (allSubjects||[])){
      if(!subjectById.has(s.id)) subjectById.set(s.id, s)
    }

    // Morning window = before first 'lunch' period (if none, use first half of lessons)
    const lunchIdx = sortedPeriods.find(p=>p.kind==='lunch')?.period_index
    const morningLessonSet = new Set(
      lessonPeriods
        .filter(p=> (lunchIdx? p.period_index < lunchIdx : p.period_index <= (lessonPeriods[0]?.period_index||1) + Math.floor(lessonPeriods.length/2)-1))
        .map(p=>p.period_index)
    )

    // Since we overwrite, do NOT seed busy from previous assignments

    // Start from a clean slate to overwrite
    const newAssign = {}

    // RULE: P.P.I must appear only once — Friday Lesson 1 — assigned to Class Teacher
    const ppiByClass = new Map() // classId -> subjectId
    try{
      const friday = 5 // Mon=1..Fri=5
      const firstLessonIdx = lessonPeriods[0]?.period_index
      if(firstLessonIdx){
        const ppiMatch = (s)=>{
          const code = (s?.code||'').toLowerCase()
          const name = (s?.name||'').toLowerCase()
          const norm = (v)=> v.replace(/\./g,'')
          return norm(code).includes('ppi') || norm(name).includes('ppi')
        }
        const mapAugment = {}
        for(const cls of classList){
          const ppi = getClassSubjects(cls).find(ppiMatch)
          if(!ppi) continue
          ppiByClass.set(cls.id, ppi.id)
          const key = `${friday}-${cls.id}-${firstLessonIdx}`
          newAssign[key] = { subjectId: ppi.id }
          // For display, ensure teacher for PPI is the class teacher if available
          const tdet = cls.class_teacher_detail || cls.teacher_detail || null
          if(tdet){ mapAugment[`${cls.id}-${ppi.id}`] = tdet }
          // Mark teacher as busy for this slot and count toward their daily max
          const tid = tdet?.id || tdet?.user?.id
          if(tid){
            const kdp = keyDP(friday, firstLessonIdx)
            if(!busy.has(kdp)) busy.set(kdp, new Set())
            busy.get(kdp).add(String(tid))
            const ktd = keyTD(friday, tid)
            teacherDailyCount.set(ktd, (teacherDailyCount.get(ktd)||0) + 1)
          }
        }
        // Merge mapAugment into classSubjectTeacherMap for UI
        if(Object.keys(mapAugment).length){
          setClassSubjectTeacherMap(prev=> ({ ...prev, ...mapAugment }))
        }
      }
    }catch{}

    // Helper: prevent same subject in consecutive lesson periods for a class on the same day,
    // unless a break/lunch occurs between them.
    const violatesAdjacency = (day, classId, periodIndex, subjectId)=>{
      // Walk backwards to find the immediately preceding lesson with an assignment, stopping at break/lunch
      for(let i = periodIndex - 1; i >= 1; i--){
        const prev = periods.find(pp=>pp.period_index===i)
        if(!prev) continue
        if(prev.kind==='break' || prev.kind==='lunch') return false // break in between allows repeat
        if(prev.kind==='lesson'){
          const keyPrev = `${day}-${classId}-${i}`
          const assignedPrev = (newAssign[keyPrev] || blockAssignments[keyPrev])
          if(assignedPrev){
            // If same subject OR same category as previous (before a break), it violates adjacency
            if(String(assignedPrev.subjectId) === String(subjectId)) return true
            const currObj = subjectById.get(subjectId)
            const prevObj = subjectById.get(assignedPrev.subjectId)
            if(currObj && prevObj && currObj.category && prevObj.category){
              return String(currObj.category) === String(prevObj.category)
            }
            return false
          }
          // if no assignment on that lesson, keep scanning further back
        }
      }
      return false
    }
    // Track priority placements per class/day
    const priorityPlaced = new Map() // key: `${d}-${classId}` -> count

    for(const d of days){
      for(const p of lessonPeriods){
        const kdp = keyDP(d, p.period_index)
        if(!busy.has(kdp)) busy.set(kdp, new Set())
        const occupied = busy.get(kdp)
        // Shuffle class iteration each run for variation
        const classesShuffled = [...classList].sort(()=>Math.random()-0.5)
        for(const cls of classesShuffled){
          // skip if cell already has an assignment
          const cellKey = `${d}-${cls.id}-${p.period_index}`
          if(newAssign[cellKey]) continue
          // Try priority subject first if within morning (no per-day cap now)
          const wantsPriority = morningLessonSet.has(p.period_index)
          if(wantsPriority){
            const mathSubj = getClassSubjects(cls).find(isPrioritySubject)
            if(mathSubj){
              const sId = mathSubj.id
              const t = classSubjectTeacherMap[`${cls.id}-${sId}`]
              const tid = t?.id || t?.user?.id
              const teacherFree = (!tid || !occupied.has(String(tid)))
              const underDailyMax = (!tid) || ((teacherDailyCount.get(keyTD(d, tid))||0) < (Number(maxTeacherLessonsPerDay)||5))
              const okAdjacency = !violatesAdjacency(d, cls.id, p.period_index, sId)
              // If mathematics, enforce morning only
              const isMath = isMathSubject(mathSubj)
              if(isMath && !morningLessonSet.has(p.period_index)){
                // skip this slot for math
              } else if(teacherFree && underDailyMax && okAdjacency){
                newAssign[cellKey] = { subjectId: sId }
                if(tid) occupied.add(String(tid))
                if(tid){
                  const ktd = keyTD(d, tid)
                  teacherDailyCount.set(ktd, (teacherDailyCount.get(ktd)||0) + 1)
                }
                continue
              }
            }
          }

          // pick next subject whose teacher is free this slot and respects adjacency
          let attempts = 0
          const rec = classSubjectsMap.get(cls.id)
          if(!rec || rec.subjects.length===0) continue
          let chosenSubj = null
          // Try subjects starting from a random rotation for more variability
          const subs = rec.subjects || []
          const start = subs.length ? Math.floor(Math.random()*subs.length) : 0
          while(attempts < subs.length){
            const sId = subs[(start + attempts) % (subs.length || 1)] || nextSubjectFor(cls.id)
            // Skip PPI in all cells except the enforced Friday Lesson 1
            const ppiId = ppiByClass.get(cls.id)
            if(ppiId && String(ppiId) === String(sId)) { attempts += 1; continue }
            const t = classSubjectTeacherMap[`${cls.id}-${sId}`]
            const tid = t?.id || t?.user?.id
            // Check teacher availability and adjacency rule
            const teacherFree = (!tid || !occupied.has(String(tid)))
            const underDailyMax = (!tid) || ((teacherDailyCount.get(keyTD(d, tid))||0) < (Number(maxTeacherLessonsPerDay)||5))
            const okAdjacency = !violatesAdjacency(d, cls.id, p.period_index, sId)
            const subjObj = subjectById.get(sId)
            const isPr = isPrioritySubject(subjObj)
            // If this is Mathematics, enforce morning-only placement
            const isMath = isMathSubject(subjObj)
            if(isMath && !morningLessonSet.has(p.period_index)){ attempts += 1; continue }
            if(teacherFree && underDailyMax && okAdjacency){
              chosenSubj = sId
              if(tid) occupied.add(String(tid))
              if(tid){
                const ktd = keyTD(d, tid)
                teacherDailyCount.set(ktd, (teacherDailyCount.get(ktd)||0) + 1)
              }
              break
            }
            attempts += 1
          }
          if(chosenSubj){ newAssign[cellKey] = { subjectId: chosenSubj } }
        }
      }
    }

    // Ensure each class gets at least one priority subject per day
    for(const d of days){
      for(const cls of classList){
        const prSubs = getClassSubjects(cls).filter(isPrioritySubject)
        if(prSubs.length===0) continue
        const hasAnyPriority = lessonPeriods.some(lp=> {
          const a = newAssign[`${d}-${cls.id}-${lp.period_index}`]
          if(!a) return false
          const subj = subjectById.get(a.subjectId)
          return isPrioritySubject(subj)
        })
        if(hasAnyPriority) continue
        // Prefer Mathematics in morning if present; otherwise any priority (prefer morning)
        const mathSub = prSubs.find(isMathSubject)
        const ordered = lessonPeriods.slice().sort((a,b)=>{
          const amA = morningLessonSet.has(a.period_index) ? 0 : 1
          const amB = morningLessonSet.has(b.period_index) ? 0 : 1
          return amA - amB || a.period_index - b.period_index
        })
        const candidateSubjects = mathSub ? [mathSub] : prSubs
        for(const subj of candidateSubjects){
          for(const lp of ordered){
            // If subject is Math, enforce morning-only
            if(isMathSubject(subj) && !morningLessonSet.has(lp.period_index)) continue
            // Skip PPI unless Friday Lesson 1 (already assigned)
            const ppiId = ppiByClass.get(cls.id)
            if(ppiId && String(ppiId) === String(subj.id)) continue
            const cellKey = `${d}-${cls.id}-${lp.period_index}`
            if(newAssign[cellKey]) continue
            const t = classSubjectTeacherMap[`${cls.id}-${subj.id}`]
            const tid = t?.id || t?.user?.id
            const teacherFree = (!tid || !busy.get(keyDP(d, lp.period_index))?.has(String(tid)))
            const underDailyMax = (!tid) || ((teacherDailyCount.get(keyTD(d, tid))||0) < (Number(maxTeacherLessonsPerDay)||5))
            const okAdjacency = !violatesAdjacency(d, cls.id, lp.period_index, subj.id)
            if(teacherFree && underDailyMax && okAdjacency){
              newAssign[cellKey] = { subjectId: subj.id }
              if(tid){
                const k = keyDP(d, lp.period_index)
                if(!busy.has(k)) busy.set(k, new Set())
                busy.get(k).add(String(tid))
                const ktd = keyTD(d, tid)
                teacherDailyCount.set(ktd, (teacherDailyCount.get(ktd)||0) + 1)
              }
              break
            }
          }
          if(newAssign[`${d}-${cls.id}-${(ordered[0]||{}).period_index}`]) break
        }
      }
    }

    // Final pass: ensure no more than one free lesson per class per day.
    // Try to fill additional empty slots greedily while respecting constraints.
    for(const d of days){
      for(const cls of classList){
        const empties = lessonPeriods.filter(lp => !newAssign[`${d}-${cls.id}-${lp.period_index}`])
        if(empties.length <= 1) continue
        let freeLeft = empties.length
        // Subject pool for this class (fallback to all subjects if none attached)
        const poolIds = (classSubjectsMap.get(cls.id)?.subjects?.length
          ? classSubjectsMap.get(cls.id).subjects
          : getClassSubjects(cls).map(s=>s.id))
        const ppiId = ppiByClass.get(cls.id)
        for(const lp of empties){
          if(freeLeft <= 1) break
          const cellKey = `${d}-${cls.id}-${lp.period_index}`
          if(newAssign[cellKey]) { freeLeft -= 1; continue }
          let placed = false
          // Try pool sequence deterministically to avoid infinite loops
          for(const sId of poolIds){
            if(ppiId && String(ppiId) === String(sId)) continue
            const subjObj = subjectById.get(sId)
            // Keep Mathematics in morning only
            if(isMathSubject(subjObj) && !morningLessonSet.has(lp.period_index)) continue
            const t = classSubjectTeacherMap[`${cls.id}-${sId}`]
            const tid = t?.id || t?.user?.id
            const kdp = keyDP(d, lp.period_index)
            if(!busy.has(kdp)) busy.set(kdp, new Set())
            const teacherFree = (!tid || !busy.get(kdp).has(String(tid)))
            const underDailyMax = (!tid) || ((teacherDailyCount.get(keyTD(d, tid))||0) < (Number(maxTeacherLessonsPerDay)||5))
            const okAdjacency = !violatesAdjacency(d, cls.id, lp.period_index, sId)
            if(teacherFree && underDailyMax && okAdjacency){
              newAssign[cellKey] = { subjectId: sId }
              if(tid){ busy.get(kdp).add(String(tid)); const ktd = keyTD(d, tid); teacherDailyCount.set(ktd, (teacherDailyCount.get(ktd)||0) + 1) }
              placed = true
              freeLeft -= 1
              break
            }
          }
          // If nothing could be placed, keep it free and move on
        }
      }
    }

    setBlockAssignments(newAssign)
  }

  // Revert last auto-generate by restoring the backup snapshot
  const revertLastAutoGenerate = () => {
    try {
      let data = backupAssign
      if (!data && currentPlan?.id) {
        const raw = localStorage.getItem(`timetable:blockAssignBackup:${currentPlan.id}`)
        if (raw) data = JSON.parse(raw)
      }
      if (data) { setBlockAssignments(data) }
    } catch {}
  }

  // Always open the priority modal before generating; Auto Generate runs after Save
  const handleClickAutoGenerate = async () => {
    setPendingGenerate(true)
    if (allSubjects.length === 0 && !loadingSubjects) {
      try {
        setLoadingSubjects(true)
        const { data } = await api.get('/academics/subjects/')
        const list = Array.isArray(data) ? data : (data?.results || [])
        setAllSubjects(list)
      } catch { setAllSubjects([]) }
      finally { setLoadingSubjects(false) }
    }
    setShowPriorityModal(true)
  }

  // Shared time helper
  const addMinutes = (hhmm, mins)=>{
    if(!hhmm) return hhmm
    const [h,m] = String(hhmm).split(':').map(n=>parseInt(n||0,10))
    const total = h*60+m+mins
    const nh = Math.floor(total/60)%24
    const nm = total%60
    return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`
  }

  // Load teachers list lazily for teacher view
  const openTeacherView = async()=>{
    setShowTeacherView(true)
    try{
      if(teachers.length===0){
        const { data } = await api.get('/academics/teachers/')
        const list = (Array.isArray(data)? data : (data?.results||[])).filter(t => t?.user?.is_active !== false)
        setTeachers(list)
      }
    }catch(e){ setTeachers([]) }
  }

  // Reorder helpers
  const renumberPeriods = (list)=> list.map((p, i)=> ({...p, period_index: i+1}))
  const movePeriod = (colIdx, dir)=>{
    setPeriods(prev => {
      const arr = [...prev].sort((a,b)=>a.period_index-b.period_index)
      const from = arr[colIdx]
      const toIdx = dir === 'left' ? colIdx - 1 : colIdx + 1
      if(toIdx < 0 || toIdx >= arr.length) return prev
      const tmp = arr[toIdx]
      arr[toIdx] = from
      arr[colIdx] = tmp
      return renumberPeriods(arr)
    })
  }
  const deletePeriodCol = (colIdx)=>{
    setPeriods(prev => {
      const arr = [...prev].sort((a,b)=>a.period_index-b.period_index)
      const row = arr[colIdx]
      if(row?.id){
        arr[colIdx] = { ...row, __deleted: true, period_index: row.period_index }
      } else {
        arr.splice(colIdx,1)
      }
      // Keep non-deleted in order at the front, then deleted (to preserve ids for save)
      const kept = arr.filter(r=>!r.__deleted)
      const deleted = arr.filter(r=>r.__deleted)
      return [...renumberPeriods(kept), ...deleted]
    })
  }

  // Plans API helpers (component scope)
  const fetchPlans = async()=>{
    const { data } = await api.get('/academics/timetable/plans/')
    const list = Array.isArray(data)? data : (data?.results||[])
    setPlans(list)
    return list
  }

  // Ensure there is at least one TimetableTemplate; if none, create a default and seed periods
  const ensureDefaultTemplate = async()=>{
    try{
      // reload templates fresh
      const res = await api.get('/academics/timetable/templates/')
      let list = Array.isArray(res.data)? res.data : (res.data?.results||[])
      if(list && list.length>0){
        setTemplates(list)
        const def = list.find(t=>t.is_default) || list[0]
        setSelectedTemplateId(def?.id || null)
        setCreateTemplateId(def?.id || null)
        return def?.id || null
      }
      // create default template
      const created = await api.post('/academics/timetable/templates/', {
        name: 'Default Template',
        days_active: [1,2,3,4,5],
        default_period_minutes: 35,
        start_of_day: '08:00',
        is_default: true,
      })
      const newId = created?.data?.id
      // update local state
      const after = await api.get('/academics/timetable/templates/')
      list = Array.isArray(after.data)? after.data : (after.data?.results||[])
      setTemplates(list)
      setSelectedTemplateId(newId)
      setCreateTemplateId(newId)
      // seed periods for the new template
      await applySampleTemplate(true)
      return newId
    }catch(e){ return null }
  }

  const openManage = async()=>{
    setShowManage(true)
    try{ await fetchPlans() }catch(e){}
  }

  const deletePlan = async(id)=>{
    if(!id) return
    // eslint-disable-next-line no-alert
    if(!confirm('Delete this timetable plan?')) return
    await api.delete(`/academics/timetable/plans/${id}/`)
    await fetchPlans()
  }

  // Load templates and default selection
  useEffect(()=>{ (async()=>{
    try{
      const { data } = await api.get('/academics/timetable/templates/')
      const list = Array.isArray(data)? data : (data?.results||[])
      setTemplates(list)
      const def = list.find(t=>t.is_default) || list[0] || null
      setSelectedTemplateId(def?.id || null)
      setCreateTemplateId(def?.id || null)
    }catch(e){ setTemplates([]) }
    setLoading(false)
  })() },[])

  // Load existing plans on mount and default the active plan
  useEffect(()=>{ (async()=>{
    try{
      await fetchPlans()
      // if no active plan set but we have plans, pick the most recent
      if(!currentPlan && plans && plans.length>0){
        const p = plans[0]
        setCurrentPlan(p)
        if(p?.template) setSelectedTemplateId(p.template)
      }
    }catch(e){}
  })() },[])

  // Load academic years and terms for plan creation
  useEffect(()=>{ (async()=>{
    try{
      const ayRes = await api.get('/academics/academic_years/')
      const yearsList = Array.isArray(ayRes.data)? ayRes.data : (ayRes.data?.results||[])
      setYears(yearsList)
      const currentYear = yearsList.find(y=>y.is_current) || yearsList[0] || null
      setSelectedYearId(currentYear?.id || null)
      const { data } = await api.get('/academics/terms/')
      const list = Array.isArray(data)? data : (data?.results||[])
      setTerms(list)
      const cur = list.find(t=>t.is_current) || list.find(t=>t.academic_year===currentYear?.id) || list[0] || null
      setCreateTermId(cur?.id || null)
      if(!createName && cur){ setCreateName(`Timetable ${cur?.name? cur.name:`T${cur.number}`}`) }
    }catch(e){ setTerms([]) }
  })() },[])

  // Derive terms filtered by selected academic year
  const termsForYear = useMemo(()=>{
    if(!selectedYearId) return terms
    return (terms||[]).filter(t=>t.academic_year===selectedYearId)
  },[terms, selectedYearId])

  // Load (or enforce) fixed design periods when template changes
  useEffect(()=>{ (async()=>{
    if(!selectedTemplateId){ setPeriods([]); return }
    try{
      const { data } = await api.get(`/academics/timetable/periods/?template=${selectedTemplateId}`)
      let list = Array.isArray(data)? data : (data?.results||[])
      if(!list || list.length===0){
        // if empty, seed the fixed design silently
        await applySampleTemplate(true)
        const res = await api.get(`/academics/timetable/periods/?template=${selectedTemplateId}`)
        list = Array.isArray(res.data)? res.data : (res.data?.results||[])
      }
      setPeriods(list.sort((a,b)=>a.period_index-b.period_index))
    }catch(e){ setPeriods([]) }
  })() },[selectedTemplateId])

  // Load plans on mount and set default current plan/template
  useEffect(()=>{ (async()=>{
    try{
      const list = await fetchPlans()
      if(!currentPlan && list && list.length>0){
        const p = list[0]
        setCurrentPlan(p)
        if(p?.template) setSelectedTemplateId(p.template)
      }
    }catch(e){}
  })() }, [])

  // Load classes for Block view
  useEffect(()=>{ (async()=>{
    if(!showBlockView) return
    try {
      const { data } = await api.get('/academics/classes/')
      const list = Array.isArray(data)? data : (data?.results||[])
      setClassList(list)
      // Load class-subject-teacher map for all classes
      try {
        const all = await Promise.all(
          (list||[]).map(async (cls)=>{
            const res = await api.get(`/academics/class_subject_teachers/?klass=${cls.id}`)
            const items = Array.isArray(res.data)? res.data : (res.data?.results||[])
            return items.map(i=> ({
              key: `${cls.id}-${i.subject}`,
              teacher: i.teacher_detail || null
            }))
          })
        )
        const map = {}
        for (const arr of all){
          for (const it of arr){ map[it.key] = it.teacher }
        }
        setClassSubjectTeacherMap(map)
      } catch(e) { setClassSubjectTeacherMap({}) }
    } catch(e) { setClassList([]) }
  })() }, [showBlockView])

  // Deep-link support: auto open class timetable from URL
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(window.location.search)
      const view = sp.get('view')
      const cid = sp.get('classId')
      if(view==='class' && cid){
        setShowClassView(true)
        setSelectedClassId(Number(cid))
      }
    }catch(e){}
  },[])

  // Persist block view preference
  useEffect(()=>{
    try { localStorage.setItem('timetable:blockView', showBlockView ? '1':'0') } catch {}
  }, [showBlockView])

  // Load/save block assignments per plan
  useEffect(()=>{
    const key = currentPlan ? `timetable:blockAssign:${currentPlan.id}` : null
    if(!key) return
    (async()=>{
      try {
        // Prefer server-stored assignments if available
        let planObj = currentPlan
        try{ const res = await api.get(`/academics/timetable/plans/${currentPlan.id}/`); planObj = res.data || currentPlan }catch{}
        const fromServer = planObj?.block_assignments && typeof planObj.block_assignments === 'object' ? planObj.block_assignments : null
        // Only trust server if it has at least one assignment; otherwise keep local
        if(fromServer && Object.keys(fromServer).length > 0){
          setBlockAssignments(fromServer)
          try{ localStorage.setItem(key, JSON.stringify(fromServer)) }catch{}
          setAssignmentsLoaded(true)
          return
        }
        // Fallback to local storage
        const raw = localStorage.getItem(key)
        setBlockAssignments(raw? JSON.parse(raw) : {})
        setAssignmentsLoaded(true)
      } catch { setBlockAssignments({}) }
    })()
  }, [currentPlan?.id])
  useEffect(()=>{
    const key = currentPlan ? `timetable:blockAssign:${currentPlan.id}` : null
    if(!key) return
    try { localStorage.setItem(key, JSON.stringify(blockAssignments)) } catch {}
    // Also persist to backend so teachers on other devices can see it
    ;(async()=>{
      try{
        setSaveError(null)
        // Avoid autosaving before initial load completes to prevent overwriting server with {}
        if(!assignmentsLoaded) return
        if(currentPlan?.id){
          await api.patch(`/academics/timetable/plans/${currentPlan.id}/`, { block_assignments: blockAssignments })
          setLastSavedAt(new Date().toISOString())
        }
      }catch(e){
        const msg = e?.response?.status === 403
          ? 'You do not have permission to save the timetable. Ask admin to enable "can_manage_timetable".'
          : (e?.response?.data?.detail || e?.message || 'Failed to save timetable.')
        setSaveError(msg)
      }
    })()
  }, [currentPlan?.id, blockAssignments, assignmentsLoaded])

  const saveBlockAssignmentsNow = async()=>{
    if(!currentPlan?.id) return
    if(!assignmentsLoaded) { return }
    setSavingBlocks(true)
    try{
      setSaveError(null)
      await api.patch(`/academics/timetable/plans/${currentPlan.id}/`, { block_assignments: blockAssignments })
      try{ localStorage.setItem(`timetable:blockAssign:${currentPlan.id}`, JSON.stringify(blockAssignments)) }catch{}
      setLastSavedAt(new Date().toISOString())
    }catch(e){
      const msg = e?.response?.status === 403
        ? 'You do not have permission to save the timetable. Ask admin to enable "can_manage_timetable".'
        : (e?.response?.data?.detail || e?.message || 'Failed to save timetable.')
      setSaveError(msg)
    }
    setSavingBlocks(false)
  }

  const getClassSubjects = (cls)=>{
    const subs = Array.isArray(cls?.subjects)? cls.subjects : []
    return (subs && subs.length>0) ? subs : (allSubjects||[])
  }
  const subjectLabel = (subj)=> subj?.code || subj?.name || ''
  const teacherNameFor = (classId, subjectId)=>{
    const t = classSubjectTeacherMap[`${classId}-${subjectId}`]
    if(!t) return ''
    const first = t.first_name || ''
    const last = t.last_name || ''
    const username = t.username || ''
    const full = `${first} ${last}`.trim()
    return full || username
  }

  const dayNames = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const activeDays = useMemo(()=>{
    const arr = (selectedTemplate?.days_active || [1,2,3,4,5]).filter(d=>d>=1&&d<=7)
    return arr.sort((a,b)=>a-b)
  },[selectedTemplate])

  // Print current Block Timetable (selected day)
  const handlePrintBlock = ()=>{
    try{
      const day = selectedBlockDay
      const periodsSorted = periods.slice().sort((a,b)=>a.period_index-b.period_index)
      const title = `Block Timetable${currentPlan?` - ${currentPlan.name||''}`:''} — ${dayNames[day]}`
      const thead = `
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border:1px solid #ddd;min-width:180px;">Class</th>
            ${periodsSorted.map(p=>`<th style=\"text-align:center;padding:8px;border:1px solid #ddd;min-width:90px;\">${p.kind==='lesson'? `Lesson ${p.period_index}` : (p.label||p.kind.toUpperCase())}</th>`).join('')}
          </tr>
        </thead>`
      const tbodyRows = (classList||[]).map(cls=>{
        const cells = periodsSorted.map(p=>{
          if(p.kind==='break' || p.kind==='lunch'){
            return `<td style=\"text-align:center;padding:8px;border:1px solid #ddd;color:#374151;background:#f9fafb;\">${p.label||p.kind.toUpperCase()}</td>`
          }
          const cellKey = `${day}-${cls.id}-${p.period_index}`
          const assigned = blockAssignments[cellKey]
          if(!assigned){ return `<td style=\"text-align:center;padding:8px;border:1px solid #ddd;color:#6b7280;\">—</td>` }
          const subj = (cls.subjects||[]).find(s=>s.id===assigned.subjectId)
          const subjText = subj? (subj.code || subj.name || '') : ''
          const t = classSubjectTeacherMap[`${cls.id}-${assigned.subjectId}`]
          const tn = t ? `${t.first_name||''} ${t.last_name||''}`.trim() || (t.username||'') : ''
          const label = tn ? `${subjText} — ${tn}` : subjText
          return `<td style=\"text-align:center;padding:8px;border:1px solid #ddd;\">${label}</td>`
        }).join('')
        return `<tr><td style=\"padding:8px;border:1px solid #ddd;font-weight:600;\">${cls.name||`Class ${cls.id}`}</td>${cells}</tr>`
      }).join('')
      const tbody = `<tbody>${tbodyRows || `<tr><td colspan=\"${periodsSorted.length+1}\" style=\"padding:12px;text-align:center;color:#6b7280;border:1px solid #ddd;\">No classes found.</td></tr>`}</tbody>`
      const styles = `
        <style>
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          body { font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif; color:#111827; }
          h1 { font-size: 18px; margin: 0 0 12px; }
          .meta { font-size: 12px; color:#6b7280; margin-bottom: 12px; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th { background: #f3f4f6; }
        </style>`
      const html = `<!doctype html><html><head><meta charset=\"utf-8\">${styles}<title>${title}</title></head><body>
        <h1>${title}</h1>
        <div class=\"meta\">Generated on ${new Date().toLocaleString()}</div>
        <table>${thead}${tbody}</table>
      </body></html>`
      const w = window.open('', '_blank')
      if(!w) return
      w.document.open(); w.document.write(html); w.document.close()
      setTimeout(()=>{ try{ w.focus(); w.print(); }catch{} }, 150)
    }catch(e){}
  }

  const addPeriodRow = ()=>{
    const nextIndex = (periods[periods.length-1]?.period_index || 0) + 1
    const lastEnd = periods[periods.length-1]?.end_time || '08:00'
    // simple +40 minutes helper
    const addMins = (hhmm, mins)=>{
      const [h,m] = hhmm.split(':').map(n=>parseInt(n||0,10))
      const total = h*60+m+mins
      const nh = Math.floor(total/60)%24
      const nm = total%60
      return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`
    }
    const start = periods.length? lastEnd : (selectedTemplate?.start_of_day || '08:00')
    const end = addMins(start, selectedTemplate?.default_period_minutes || 35)
    setPeriods(p=>[...p, { id: undefined, template: selectedTemplateId, period_index: nextIndex, start_time: start, end_time: end, kind: 'lesson', label: `P${nextIndex}` }])
  }

  // Seed selected template with a standard structure resembling the provided sample
  const applySampleTemplate = async(silent=false)=>{
    if(!selectedTemplateId) return
    if(!silent){
      // eslint-disable-next-line no-alert
      if(!confirm('Apply sample structure to this template? Existing periods will be replaced.')) return
    }
    setSaving(true)
    try{
      // Delete existing periods
      const existing = periods.filter(p=>p.id)
      for(const row of existing){
        await api.delete(`/academics/timetable/periods/${row.id}/`)
      }
      // Ensure Mon-Fri active days on template and set start_of_day to 08:20
      await api.patch(`/academics/timetable/templates/${selectedTemplateId}/`, { days_active: [1,2,3,4,5], default_period_minutes: 35, start_of_day: '08:20' })

      // Apply exact session times
      const rows = [
        { label: 'P1', kind: 'lesson', start: '08:20', end: '08:55' },
        { label: 'P2', kind: 'lesson', start: '08:55', end: '09:30' },
        { label: 'BREAK', kind: 'break', start: '09:30', end: '09:50' },
        { label: 'P3', kind: 'lesson', start: '09:50', end: '10:25' },
        { label: 'P4', kind: 'lesson', start: '10:25', end: '11:00' },
        { label: 'BREAK', kind: 'break', start: '11:00', end: '11:30' },
        { label: 'P5', kind: 'lesson', start: '11:30', end: '12:05' },
        { label: 'P6', kind: 'lesson', start: '12:05', end: '12:40' },
        { label: 'LUNCH', kind: 'lunch', start: '12:40', end: '14:00' },
        { label: 'P7', kind: 'lesson', start: '14:00', end: '14:35' },
        { label: 'P8', kind: 'lesson', start: '14:35', end: '15:10' },
      ]
      let idx = 1
      for (const r of rows){
        await api.post('/academics/timetable/periods/', {
          template: selectedTemplateId,
          period_index: idx,
          start_time: r.start,
          end_time: r.end,
          kind: r.kind,
          label: r.label,
        })
        idx += 1
      }
      // reload
      const { data } = await api.get(`/academics/timetable/periods/?template=${selectedTemplateId}`)
      const list = Array.isArray(data)? data : (data?.results||[])
      setPeriods(list.sort((a,b)=>a.period_index-b.period_index))
    }catch(e){};
    setSaving(false)
  }

  // Create plan from modal
  const handleCreatePlan = async()=>{
    if(!createTermId){ return }
    setSaving(true)
    try{
      // pick default template automatically if not set
      let tmplId = createTemplateId
      if(!tmplId){
        const def = templates.find(t=>t.is_default) || templates[0]
        tmplId = def?.id
        if(!tmplId){
          tmplId = await ensureDefaultTemplate()
        }
      }
      const payload = { name: createName || 'Timetable', term: createTermId, template: tmplId }
      const { data } = await api.post('/academics/timetable/plans/', payload)
      setCurrentPlan(data)
      // refresh plans list
      try{ await fetchPlans() }catch(e){}
      // switch working template to plan template
      const applied = data?.template || tmplId
      setSelectedTemplateId(applied)
      setShowCreate(false)
      // If template has no periods yet, auto-seed with sample
      try{
        const res = await api.get(`/academics/timetable/periods/?template=${applied}`)
        const list = Array.isArray(res.data)? res.data : (res.data?.results||[])
        if(!list || list.length===0){
          await applySampleTemplate(true)
        }
      }catch(e){}
    }catch(e){}
    setSaving(false)
  }

  const updatePeriodField = (idx, field, value)=>{
    setPeriods(p=> p.map((row,i)=> {
      if(i!==idx) return row
      let next = { ...row, [field]: value }
      const lessonLen = selectedTemplate?.default_period_minutes || 35
      if(field==='start_time' && (row.kind==='lesson' || next.kind==='lesson')){
        next.end_time = addMinutes(value, lessonLen)
      }
      if(field==='kind' && value==='lesson'){
        const st = next.start_time || row.start_time
        if(st){ next.end_time = addMinutes(st, lessonLen) }
      }
      if(field==='end_time' && (row.kind==='lesson' || next.kind==='lesson')){
        // keep enforced at save; optionally snap now as well
        next.end_time = addMinutes(next.start_time, lessonLen)
      }
      return next
    }))
  }

  const removePeriodRow = (idx)=>{
    const row = periods[idx]
    if(row?.id){
      // mark deletion by setting a flag; will delete on save
      setPeriods(p=> p.map((r,i)=> i===idx? { ...r, __deleted: true } : r))
    }else{
      setPeriods(p=> p.filter((_,i)=> i!==idx))
    }
  }

  const saveTemplateChanges = async()=>{
    if(!selectedTemplateId) return
    setSaving(true)
    try{
      // Update template's days_active if changed
      // periods: upsert and delete rows
      for(const row of periods){
        if(row.__deleted && row.id){
          await api.delete(`/academics/timetable/periods/${row.id}/`)
          continue
        }
        const lessonLen = selectedTemplate?.default_period_minutes || 35
        const enforcedEnd = (row.kind==='lesson' && row.start_time) ? addMinutes(row.start_time, lessonLen) : row.end_time
        const payload = { template: selectedTemplateId, period_index: row.period_index, start_time: row.start_time, end_time: enforcedEnd, kind: row.kind, label: row.label }
        if(row.id){
          await api.patch(`/academics/timetable/periods/${row.id}/`, payload)
        }else if(!row.__deleted){
          await api.post(`/academics/timetable/periods/`, payload)
        }
      }
      // refetch
      const { data } = await api.get(`/academics/timetable/periods/?template=${selectedTemplateId}`)
      const list = Array.isArray(data)? data : (data?.results||[])
      setPeriods(list.sort((a,b)=>a.period_index-b.period_index))
    }catch(e){ /* noop; NotificationContainer will show global errors if any */ }
    setSaving(false)
  }
  return (
    <AdminLayout>
      <div className="space-y-6">
        {!currentPlan?.id && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            No timetable plan is selected. Create or select a plan to enable saving. Use the "New Timetable" button.
          </div>
        )}
        {saveError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
            {saveError}
          </div>
        )}
        {lastSavedAt && (
          <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            Saved at {new Date(lastSavedAt).toLocaleTimeString()}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Timetable</h1>
            <p className="text-gray-600 mt-1">Manage and view school-wide timetables.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto -mx-1 px-1">
            <button
              onClick={openManage}
              className="shrink-0 inline-flex items-center gap-0 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium shadow-sm"
              aria-label="Manage Timetables">
              <span className="sm:hidden">📋</span>
              <span className="hidden sm:inline">Manage Timetables</span>
            </button>
            <button
              onClick={()=>setShowCreate(true)}
              className="shrink-0 inline-flex items-center gap-0 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow"
              aria-label="New Timetable">
              <span className="sm:hidden">➕</span>
              <span className="hidden sm:inline">New Timetable</span>
            </button>
          </div>
        </div>

        {/* Plan header (when a plan exists) */}
        {currentPlan && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Active Plan</div>
              <div className="text-lg font-semibold text-gray-900">{currentPlan.name}</div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="mr-3">Term: {currentPlan.term_detail?.name || `T${currentPlan.term_detail?.number || ''}`}</span>
              <span>Template: {currentPlan.template_detail?.name}</span>
            </div>
          </div>
        )}

        {/* Template Sessions Editor */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <div className="font-medium text-gray-800">Template Sessions</div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setShowSessions(s=>!s)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm">{showSessions? 'Collapse' : 'Expand'}</button>
              {showSessions && (!editingTimes ? (
                <button onClick={()=>setEditingTimes(true)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm">Edit Sessions</button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={()=>setEditingTimes(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm">Cancel</button>
                  <button onClick={saveTemplateChanges} disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-60">{saving? 'Saving...' : 'Save Changes'}</button>
                </div>
              ))}
            </div>
          </div>
          {showSessions && (
          <div className="p-4">
            {!editingTimes ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">Label</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Start</th>
                      <th className="px-2 py-2 text-left">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.sort((a,b)=>a.period_index-b.period_index).map((p,i)=>(
                      <tr key={p.id||i} className="border-t">
                        <td className="px-2 py-2">{p.period_index}</td>
                        <td className="px-2 py-2">{p.label || (p.kind==='lesson'?`P${p.period_index}`:p.kind.toUpperCase())}</td>
                        <td className="px-2 py-2 capitalize">{p.kind}</td>
                        <td className="px-2 py-2 font-mono text-xs">{p.start_time}</td>
                        <td className="px-2 py-2 font-mono text-xs">{p.end_time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm align-middle">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-2 text-left">#</th>
                        <th className="px-2 py-2 text-left">Label</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Start</th>
                        <th className="px-2 py-2 text-left">End</th>
                        <th className="px-2 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.sort((a,b)=>a.period_index-b.period_index).map((p,i)=>(
                        <tr key={p.id||i} className="border-t">
                          <td className="px-2 py-2">{p.period_index}</td>
                          <td className="px-2 py-2">
                            <input className="border rounded px-2 py-1 w-28" value={p.label||''} onChange={e=>updatePeriodField(i,'label', e.target.value)} placeholder={p.kind==='lesson'?`P${p.period_index}`:''} />
                          </td>
                          <td className="px-2 py-2">
                            <select className="border rounded px-2 py-1" value={p.kind} onChange={e=>updatePeriodField(i,'kind', e.target.value)}>
                              <option value="lesson">lesson</option>
                              <option value="break">break</option>
                              <option value="lunch">lunch</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input type="time" className="border rounded px-2 py-1" value={p.start_time||''} onChange={e=>updatePeriodField(i,'start_time', e.target.value)} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="time" className="border rounded px-2 py-1" value={p.end_time||''} onChange={e=>updatePeriodField(i,'end_time', e.target.value)} />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={()=>movePeriod(i,'left')} className="px-2 py-1 rounded border">◀</button>
                              <button onClick={()=>movePeriod(i,'right')} className="px-2 py-1 rounded border">▶</button>
                              <button onClick={()=>deletePeriodRow(i)} className="px-2 py-1 rounded border text-red-600">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={addPeriodRow} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm">Add Session</button>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>setEditingTimes(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm">Cancel</button>
                    <button onClick={saveTemplateChanges} disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-60">{saving? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Priority Subjects Modal */}
        {showPriorityModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={()=>{ setShowPriorityModal(false); setPendingGenerate(false) }} />
            <div className="relative bg-white w-full max-w-2xl mx-4 rounded-2xl shadow-xl border border-gray-200">
              <div className="p-5 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">Select Priority Subjects</h3>
                <button className="p-2 hover:bg-gray-100 rounded" onClick={()=>{ setShowPriorityModal(false); setPendingGenerate(false) }} aria-label="Close">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <div className="text-sm font-medium mb-1">Subjects</div>
                    <div className="h-48 overflow-auto border rounded p-2">
                      {loadingSubjects ? (
                        <div className="text-sm text-gray-500">Loading subjects…</div>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-1">
                          {allSubjects.map(s=>{
                            const selected = prioritySubjectIds.includes(s.id)
                            return (
                              <label key={s.id} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${selected? 'bg-purple-50':''}`}>
                                <input type="checkbox" checked={selected} onChange={(e)=>{
                                  setPrioritySubjectIds(prev=> e.target.checked ? [...new Set([...prev, s.id])] : prev.filter(id=>id!==s.id))
                                }} />
                                <span className="text-sm">{s.name} <span className="text-xs text-gray-500">({s.code})</span></span>
                              </label>
                            )
                          })}
                          {!allSubjects.length && <div className="text-sm text-gray-500">No subjects found.</div>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium mb-1">Math keyword match</div>
                      <input className="border rounded px-2 py-1 w-full" value={mathKeyword} onChange={e=>setMathKeyword(e.target.value)} placeholder="e.g. math" />
                      <div className="text-xs text-gray-500 mt-1">Subjects whose code or name contains this keyword will be treated as priority too.</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">Max priority per day (per class)</div>
                      <input type="number" min={1} max={6} className="border rounded px-2 py-1 w-28" value={priorityMaxPerDay} onChange={e=>setPriorityMaxPerDay(Number(e.target.value||2))} />
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">Max lessons per teacher per day</div>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        className="border rounded px-2 py-1 w-28"
                        value={maxTeacherLessonsPerDay}
                        onChange={e=>setMaxTeacherLessonsPerDay(Number(e.target.value||5))}
                      />
                      <div className="text-xs text-gray-500 mt-1">Auto-generate will not assign more than this number of lessons to the same teacher in a single day.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 border-t flex items-center justify-end gap-2">
                <button className="px-3 py-1.5 rounded border hover:bg-gray-50" onClick={()=>{ setShowPriorityModal(false); setPendingGenerate(false) }}>Cancel</button>
                <button className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={()=>{ setShowPriorityModal(false); if(pendingGenerate){ setPendingGenerate(false); autoGenerate() } }}>Save & Continue</button>
              </div>
            </div>
          </div>
        )}

        {/* Class Timetable Modal */}
        {showClassView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={()=>setShowClassView(false)} />
            <div className="relative bg-white w-full max-w-6xl mx-4 rounded-2xl shadow-xl border border-gray-200 print:max-w-full">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Class Timetable</h3>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50" onClick={()=>window.print()}>Print</button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={()=>setShowClassView(false)} aria-label="Close">✕</button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Class</span>
                    <select value={selectedClassId||''} onChange={(e)=>setSelectedClassId(e.target.value? Number(e.target.value): null)} className="rounded-lg border-gray-300">
                      <option value="">Select class</option>
                      {classList.map(c=> (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                  </div>
                  <div className="text-sm text-gray-600">Term: <span className="font-medium">{currentPlan?.term_detail?.name || `T${currentPlan?.term_detail?.number || ''}`}</span></div>
                  <div className="text-sm text-gray-600">Year: <span className="font-medium">{currentPlan?.term_detail?.academic_year_label || ''}</span></div>
                </div>
                {selectedClassId ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border border-gray-300 rounded-lg overflow-hidden">
                      <thead className="bg-blue-50/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-700 w-28 uppercase tracking-wide">Day</th>
                          {periods.sort((a,b)=>a.period_index-b.period_index).map(p=> (
                            <th key={`cvh-${p.period_index}`} className="px-3 py-2 text-center text-gray-800 font-semibold min-w-28">
                              {p.kind==='lesson'? `Lesson ${p.period_index}` : (p.label||p.kind.toUpperCase())}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeDays.map(d=> (
                          <tr key={`cvd-${d}`} className="border-t">
                            <td className="px-3 py-2 bg-gray-50">
                              <div className="w-8 h-8 mx-auto rounded bg-gray-200 flex items-center justify-center font-extrabold text-gray-700 text-sm">
                                {({1:'B',2:'R',3:'E',4:'A',5:'K',6:'S',7:'S'})[d]}
                              </div>
                            </td>
                            {periods.sort((a,b)=>a.period_index-b.period_index).map(p=> {
                              const cell = blockAssignments[`${d}-${selectedClassId}-${p.period_index}`]
                              if(p.kind==='break' || p.kind==='lunch'){
                                const bg = p.kind==='break'? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-yellow-100 text-yellow-900 border-yellow-200'
                                return <td key={`cvc-${d}-${p.period_index}`} className={`px-2 py-2 text-center font-bold ${bg}`}>{(p.label||p.kind||'').toString().toUpperCase()}</td>
                              }
                              if(!cell){
                                return <td key={`cvc-${d}-${p.period_index}`} className="px-2 py-2 text-center text-gray-400">—</td>
                              }
                              const subj = (classList.find(c=>c.id===selectedClassId)?.subjects||[]).find(s=>s.id===cell.subjectId)
                              const tn = teacherNameFor(selectedClassId, cell.subjectId)
                              return (
                                <td key={`cvc-${d}-${p.period_index}`} className="px-2 py-2 text-center">
                                  <div className="font-medium text-gray-900">{subj?.code || subj?.name || ''}</div>
                                  {tn && <div className="text-[11px] text-gray-500">{tn}</div>}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 text-xs text-gray-500">Class Teacher: ____________________</div>
                  </div>
                ) : (
                  <div className="text-gray-500">Select a class to view its timetable.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Teacher Timetable Modal */}
        {showTeacherView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={()=>setShowTeacherView(false)} />
            <div className="relative bg-white w-full max-w-5xl mx-4 rounded-2xl shadow-xl border border-gray-200">
              <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Teacher Timetable</h3>
                <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={()=>setShowTeacherView(false)} aria-label="Close">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <select value={selectedTeacherId||''} onChange={(e)=>setSelectedTeacherId(e.target.value? Number(e.target.value): null)} className="rounded-lg border-gray-300">
                    <option value="">Select teacher</option>
                    {teachers.map(t=> (<option key={t.id} value={t.id}>{`${t.first_name||''} ${t.last_name||''}`.trim() || t.username}</option>))}
                  </select>
                </div>
                {selectedTeacherId ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-600 w-28">Day</th>
                          {periods.sort((a,b)=>a.period_index-b.period_index).map(p=> (
                            <th key={`tvh-${p.period_index}`} className="px-3 py-2 text-center text-gray-700 min-w-28">{p.kind==='lesson'? `Lesson ${p.period_index}` : (p.label||p.kind.toUpperCase())}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeDays.map(d=> (
                          <tr key={`tvd-${d}`} className="border-t">
                            <td className="px-3 py-2 font-medium text-gray-800 bg-gray-50">{dayNames[d]}</td>
                            {periods.sort((a,b)=>a.period_index-b.period_index).map(p=> {
                              if(p.kind==='break' || p.kind==='lunch'){
                                return <td key={`tvc-${d}-${p.period_index}`} className="px-2 py-2 text-center"><span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600 border border-gray-200">{p.label||p.kind.toUpperCase()}</span></td>
                              }
                              // find any class where this period has a subject taught by selected teacher
                              const hit = classList.find(cls=> {
                                const a = blockAssignments[`${d}-${cls.id}-${p.period_index}`]
                                if(!a) return false
                                const t = classSubjectTeacherMap[`${cls.id}-${a.subjectId}`]
                                return t && t.id === selectedTeacherId
                              })
                              if(!hit) return <td key={`tvc-${d}-${p.period_index}`} className="px-2 py-2 text-center text-gray-400">—</td>
                              const subjId = blockAssignments[`${d}-${hit.id}-${p.period_index}`]?.subjectId
                              const subj = (hit.subjects||[]).find(s=>s.id===subjId)
                              const label = `${hit.name} — ${(subj?.code||subj?.name||'')}`
                              return <td key={`tvc-${d}-${p.period_index}`} className="px-2 py-2 text-center">{label}</td>
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-gray-500">Select a teacher to view their timetable.</div>
                )}
              </div>
            </div>
          </div>
        )}

          {/* Block Timetable Template (Classes x Sessions) */}
          {showBlockView && periods.length>0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="text-sm font-semibold text-gray-800">Block Timetable Template (Classes × Sessions)</div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                  <button
                    onClick={()=>{ const url = `/admin/timetable/teacher${currentPlan?`?planId=${currentPlan.id}`:''}`; window.location.href = url }}
                    className="px-2.5 py-1 rounded text-xs border bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                    Teacher Timetable
                  </button>
                  <button
                    onClick={saveBlockAssignmentsNow}
                    disabled={savingBlocks}
                    className={`px-2.5 py-1 rounded text-xs border ${savingBlocks? 'bg-blue-300 text-white border-blue-400':'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'}`}
                  >{savingBlocks? 'Saving…' : 'Save'}</button>
                  <button
                    onClick={handleClickAutoGenerate}
                    className="px-2.5 py-1 rounded text-xs border bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700">
                    Auto Generate
                  </button>
                  <button
                    onClick={revertLastAutoGenerate}
                    className="px-2.5 py-1 rounded text-xs border bg-gray-700 text-white border-gray-800 hover:bg-gray-800">
                    Revert
                  </button>
                  <button
                    onClick={handlePrintBlock}
                    className="px-2.5 py-1 rounded text-xs border bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                    Print
                  </button>
                  {(selectedTemplate?.days_active || [1,2,3,4,5]).sort((a,b)=>a-b).map(d=> (
                    <button key={d} onClick={()=>setSelectedBlockDay(d)} className={`shrink-0 px-2.5 py-1 rounded text-xs border ${selectedBlockDay===d? 'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                      {dayNames[d]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="sticky top-0 bg-gray-50 z-20">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 w-48 sticky left-0 bg-gray-50 z-30">Class</th>
                      {periods.sort((a,b)=>a.period_index-b.period_index).map((p, colIdx)=> (
                        <th key={`bh-${p.id||p.period_index}`} className="px-3 py-2 text-center text-gray-700 min-w-24 md:min-w-28">
                          <div className="font-medium">{p.kind==='lesson' ? `Lesson ${p.period_index}` : (p.label || p.kind.toUpperCase())}</div>
                          {editingTimes && (
                            <div className="flex items-center justify-center gap-1 pt-1">
                              <button onClick={()=>movePeriod(colIdx,'left')} className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50">←</button>
                              <button onClick={()=>movePeriod(colIdx,'right')} className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50">→</button>
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classList.length>0 ? classList.map(cls => (
                      <tr key={cls.id} className="border-t">
                        <td className="px-3 py-2 font-medium text-blue-700 bg-white whitespace-nowrap sticky left-0 z-20 w-48 border-r">
                          <button
                            className="underline decoration-dotted hover:decoration-solid"
                            title="Open class timetable"
                            onClick={()=>{ const url = `/admin/timetable/class?classId=${cls.id}${currentPlan?`&planId=${currentPlan.id}`:''}`; window.location.href = url }}
                          >
                            {cls.name || `Class ${cls.id}`}
                          </button>
                        </td>
                        {periods.sort((a,b)=>a.period_index-b.period_index).map(p => {
                          const cellKey = `${selectedBlockDay}-${cls.id}-${p.period_index}`
                          const assigned = blockAssignments[cellKey]
                          const isEditing = editingCell === cellKey
                          return (
                            <td key={`bc-${cls.id}-${p.id||p.period_index}`} className="px-2 py-3 text-center align-middle border-l">
                              {p.kind==='break' || p.kind==='lunch' ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600 border border-gray-200">{p.label||p.kind.toUpperCase()}</span>
                              ) : isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <select
                                    className="w-28 md:w-40 px-2 py-1 text-xs rounded border border-gray-300"
                                    value={assigned?.subjectId || ''}
                                    onChange={(e)=> setBlockAssignments(prev=> ({...prev, [cellKey]: { ...(prev[cellKey]||{}), subjectId: e.target.value? Number(e.target.value): '' }}))}
                                  >
                                    <option value="">Select subject</option>
                                    {getClassSubjects(cls).map(s=> {
                                      const tn = teacherNameFor(cls.id, s.id)
                                      const label = tn ? `${subjectLabel(s)} — ${tn}` : subjectLabel(s)
                                      return <option key={s.id} value={s.id}>{label}</option>
                                    })}
                                  </select>
                                  <button onClick={()=> setEditingCell(null)} className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50">OK</button>
                                  <button onClick={()=> { setBlockAssignments(prev=> { const cp={...prev}; delete cp[cellKey]; return cp }) ; setEditingCell(null) }} className="px-2 py-0.5 text-xs rounded border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100">×</button>
                                </div>
                              ) : (
                                <button
                                  onClick={()=> setEditingCell(cellKey)}
                                  className={`min-w-20 w-20 md:min-w-24 md:w-32 px-2 py-1 rounded text-xs border ${assigned? 'border-blue-200 bg-blue-50 text-blue-700':'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                  title={assigned? 'Click to edit':'Assign subject'}
                                >
                                  {assigned? (()=>{
                                    const subj = getClassSubjects(cls).find(s=>s.id===assigned.subjectId)
                                    const tn = teacherNameFor(cls.id, assigned.subjectId)
                                    const code = subj?.code || subj?.name || 'Assigned'
                                    return tn ? `${code} — ${tn}` : code
                                  })() : 'Session'}
                                </button>
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
          )}

        {/* Create Timetable Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={()=>setShowCreate(false)} />
            <div className="relative bg-white w-full max-w-xl mx-4 rounded-2xl shadow-xl border border-gray-200">
              <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Create Timetable</h3>
                <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={()=>setShowCreate(false)} aria-label="Close">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-700">Name</label>
                    <input value={createName} onChange={(e)=>setCreateName(e.target.value)} className="mt-1 w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Term 3 2025" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Academic Year</label>
                    <select value={selectedYearId || ''} onChange={(e)=>{ const v=e.target.value? Number(e.target.value):null; setSelectedYearId(v); const first = (terms||[]).find(t=>t.academic_year===v); setCreateTermId(first?.id || null) }} className="mt-1 w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500">
                      {(years||[]).map(y=> (
                        <option key={y.id} value={y.id}>{y.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Term</label>
                    <select value={createTermId || ''} onChange={(e)=>setCreateTermId(e.target.value? Number(e.target.value): null)} className="mt-1 w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500">
                      {(termsForYear||[]).map(t=> (
                        <option key={t.id} value={t.id}>{t.name? t.name: `Term ${t.number}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-gray-200 flex items-center justify-end gap-2">
                <button onClick={()=>setShowCreate(false)} className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-sm">Cancel</button>
                <button onClick={handleCreatePlan} disabled={saving || !createTermId} className={`px-4 py-2 rounded-lg text-sm ${saving? 'bg-gray-300 text-gray-600':'bg-blue-600 text-white hover:bg-blue-700'}`}>{saving? 'Creating...':'Create'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Manage Timetables Modal */}
        {showManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={()=>setShowManage(false)} />
            <div className="relative bg-white w-full max-w-3xl mx-4 rounded-2xl shadow-xl border border-gray-200">
              <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Manage Timetables</h3>
                <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={()=>setShowManage(false)} aria-label="Close">✕</button>
              </div>
              <div className="p-5">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Year</th>
                        <th className="py-2 pr-4">Term</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.length>0 ? plans.map(p => {
                        const yearLabel = (years.find(y=>y.id===p.term_detail?.academic_year)?.label) || ''
                        const termLabel = p.term_detail?.name || (p.term_detail?.number? `Term ${p.term_detail.number}` : '')
                        const status = (p.status||'draft').toLowerCase()
                        const statusChip = status==='published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status==='generated' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        return (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium text-gray-900">{p.name}</td>
                            <td className="py-2 pr-4">{yearLabel}</td>
                            <td className="py-2 pr-4">{termLabel}</td>
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs border ${statusChip}`}>{status.charAt(0).toUpperCase()+status.slice(1)}</span>
                            </td>
                            <td className="py-2 pr-0 text-right">
                              <div className="inline-flex gap-2">
                                <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">Edit</button>
                                <button className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">Assign</button>
                                <button onClick={()=>deletePlan(p.id)} className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100">Delete</button>
                              </div>
                            </td>
                          </tr>
                        )
                      }) : (
                        <tr><td colSpan={5} className="py-6 text-center text-gray-500">No timetables yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-5 border-t border-gray-200 flex items-center justify-end">
                <button onClick={()=>setShowManage(false)} className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-sm">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
