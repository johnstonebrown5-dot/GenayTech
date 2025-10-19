import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import api from '../api'

export default function AdminClassProfile(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [klass, setKlass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('class') // class | subjects | students | results
  const [searchParams, setSearchParams] = useSearchParams()
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [exams, setExams] = useState([])
  const [recentExam, setRecentExam] = useState(null)
  const [recentSummary, setRecentSummary] = useState({ subjects: [], students: [] })
  const [gradePerf, setGradePerf] = useState([]) // [{klass, klass_name, mean}]
  const [loadingGradePerf, setLoadingGradePerf] = useState(false)
  const [teachers, setTeachers] = useState([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({ subject: '', teacher: '' })
  const [showReassignCT, setShowReassignCT] = useState(false)
  const [reassignTeacher, setReassignTeacher] = useState('')
  const availableCTs = useMemo(() => {
    const cid = String(id)
    const list = Array.isArray(teachers) ? teachers : []
    const preferred = list.filter(t => {
      const tk = t?.klass
      // allow if unassigned OR already assigned to this class
      return tk === null || tk === '' || typeof tk === 'undefined' || String(tk) === cid
    })
    // Fallback: if none match (e.g., everyone is assigned elsewhere), show all teachers
    return preferred.length > 0 ? preferred : list
  }, [teachers, id])

  useEffect(() => {
    let cancelled = false
    async function load(){
      try {
        setLoading(true)
        const { data } = await api.get(`/academics/classes/${id}/`)
        if (!cancelled) setKlass(data)
      } catch (e) {
        if (!cancelled) setError('Failed to load class')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    try{
      const t = (searchParams.get('tab') || '').toLowerCase()
      if (['class','subjects','students','results'].includes(t)) {
        setActiveTab(t)
      }
    }catch{}
  }, [searchParams])

  // Load students once for this page (then filter by class id)
  useEffect(() => {
    let cancelled = false
    async function loadStudents(){
      try {
        setLoadingStudents(true)
        const { data } = await api.get('/academics/students/')
        if (!cancelled) setStudents(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setStudents([])
      } finally {
        if (!cancelled) setLoadingStudents(false)
      }
    }
    loadStudents()
    return () => { cancelled = true }
  }, [])

  const subjects = Array.isArray(klass?.subjects) ? klass.subjects : []
  // Filter teachers by selected subject (match by subject code or name in profile.subjects comma list)
  const filteredTeachers = useMemo(() => {
    if (!assignForm.subject) return teachers
    const subj = subjects.find(s => String(s.id) === String(assignForm.subject))
    if (!subj) return teachers
    const code = (subj.code || '').toLowerCase()
    const name = (subj.name || '').toLowerCase()
    return teachers.filter(t => {
      const subjStr = (t.subjects || t.user?.subjects || '').toLowerCase()
      return subjStr.includes(code) || subjStr.includes(name)
    })
  }, [assignForm.subject, subjects, teachers])
  const classStudents = useMemo(() => {
    const cid = String(id)
    return students.filter(s => String(s.klass) === cid || String(s.klass_detail?.id || '') === cid)
  }, [students, id])
  const genderStats = useMemo(() => {
    const boys = classStudents.filter(s => (s.gender || '').toLowerCase().startsWith('m')).length
    const girls = classStudents.filter(s => (s.gender || '').toLowerCase().startsWith('f')).length
    const total = classStudents.length
    return { boys, girls, total }
  }, [classStudents])

  // Load exams and derive most recent for this class
  useEffect(() => {
    let cancelled = false
    async function loadExams(){
      try {
        const { data } = await api.get('/academics/exams/')
        if (cancelled) return
        setExams(Array.isArray(data) ? data : [])
        // filter by class id
        const cid = Number(id)
        const forClass = (Array.isArray(data) ? data : []).filter(e => Number(e.klass) === cid)
        if (forClass.length === 0) { setRecentExam(null); return }
        // sort by date then id as fallback
        forClass.sort((a,b)=>{
          const da = a.date ? new Date(a.date).getTime() : 0
          const db = b.date ? new Date(b.date).getTime() : 0
          if (db !== da) return db - da
          return (b.id||0) - (a.id||0)
        })
        const latest = forClass[0]
        setRecentExam(latest)
      } catch (e) {
        if (!cancelled) { setExams([]); setRecentExam(null) }
      }
    }
    loadExams()
    return ()=>{ cancelled = true }
  }, [id])

  // When recentExam changes, load its summary
  useEffect(() => {
    let cancelled = false
    async function loadSummary(){
      if (!recentExam?.id) { setRecentSummary({ subjects: [], students: [] }); return }
      try {
        setLoadingResults(true)
        const { data } = await api.get(`/academics/exams/${recentExam.id}/summary/`)
        if (!cancelled) setRecentSummary(data)
      } catch (e) {
        if (!cancelled) setRecentSummary({ subjects: [], students: [] })
      } finally {
        if (!cancelled) setLoadingResults(false)
      }
    }
    loadSummary()
    return ()=>{ cancelled = true }
  }, [recentExam])

  // Load teachers for assignment (admin scope)
  useEffect(() => {
    let cancelled = false
    async function loadTeachers(){
      try {
        const { data } = await api.get('/academics/teachers/')
        if (!cancelled) setTeachers(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setTeachers([])
      }
    }
    loadTeachers()
    return ()=>{ cancelled = true }
  }, [])

  const subjectAssignments = useMemo(() => {
    const map = {}
    for (const a of (klass?.subject_teachers || [])) {
      map[String(a.subject)] = a
    }
    return map
  }, [klass])

  const openAssign = async (subjectId) => {
    const subjId = subjectId || ''
    setAssignForm({ subject: subjId, teacher: subjectAssignments[String(subjId)]?.teacher || '' })
    setShowAssignModal(true)
    // Load teachers filtered by subject for smaller dropdown and accuracy
    if (subjId) {
      try {
        const { data } = await api.get(`/academics/teachers/?subject=${subjId}`)
        setTeachers(Array.isArray(data) ? data : [])
      } catch (e) {
        /* ignore; fallback to previously loaded all teachers */
      }
    }
  }

  const saveAssignment = async (e) => {
    e?.preventDefault?.()
    try {
      // If an assignment exists for this subject, delete then re-create (simpler client-side)
      const existing = subjectAssignments[String(assignForm.subject)]
      if (existing) {
        await api.delete(`/academics/class_subject_teachers/${existing.id}/`)
      }
      await api.post('/academics/class_subject_teachers/', {
        klass: Number(id),
        subject: Number(assignForm.subject),
        teacher: Number(assignForm.teacher)
      })
      // Refresh class to get updated assignments
      const { data } = await api.get(`/academics/classes/${id}/`)
      setKlass(data)
      setShowAssignModal(false)
    } catch (e) {
      // no-op basic error; could show notification if context exists
      setShowAssignModal(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{klass?.name || 'Class'}</h1>
            <div className="text-sm text-gray-500">Grade: {klass?.grade_level || '-'} • Stream: {klass?.stream_detail?.name || '-'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded bg-gray-100 text-gray-800 hover:bg-gray-200">Back</button>
            <Link to="/admin/classes" className="px-3 py-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">All Classes</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow border border-gray-100">
          <div className="px-4 pt-3">
            <div className="flex gap-1 border-b overflow-x-auto no-scrollbar -mx-2 px-2">
              {[
                { key: 'class', label: 'Class' },
                { key: 'subjects', label: 'Subjects' },
                { key: 'students', label: 'Students' },
                { key: 'results', label: 'Results' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={()=>setActiveTab(t.key)}
                  className={`shrink-0 px-3 py-2 text-sm border-b-2 -mb-px rounded-t ${activeTab===t.key ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                >{t.label}</button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {loading && <div>Loading class...</div>}
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {!loading && !error && klass && (
              <>
                {activeTab === 'class' && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-3 rounded border bg-gray-50">
                        <div className="text-xs text-gray-500">Grade</div>
                        <div className="font-medium">{klass?.grade_level || '-'}</div>
                      </div>
                      <div className="p-3 rounded border bg-gray-50">
                        <div className="text-xs text-gray-500">Stream</div>
                        <div className="font-medium">{klass?.stream_detail?.name || '-'}</div>
                      </div>
                      <div className="p-3 rounded border bg-gray-50">
                        <div className="text-xs text-gray-500">Class Teacher</div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium truncate">{klass?.teacher_detail ? `${klass.teacher_detail.first_name} ${klass.teacher_detail.last_name}` : '—'}</div>
                          <button onClick={()=>{ setReassignTeacher(String(klass?.teacher_detail?.id||'')); setShowReassignCT(true) }} className="text-xs px-2 py-1 rounded border hover:bg-white">Reassign</button>
                        </div>
                      </div>
                    </div>

                    {/* Gender Distribution */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 rounded border bg-white">
                        <div className="text-sm font-medium mb-2">Gender Distribution</div>
                        <div className="flex items-end gap-6 h-24">
                          <div className="flex flex-col items-center flex-1">
                            <div className="w-10 bg-blue-500 rounded-t" style={{height: `${genderStats.total? Math.round((genderStats.boys/genderStats.total)*100) : 0}%`}}></div>
                            <div className="text-xs text-gray-600 mt-1">Boys ({genderStats.boys})</div>
                          </div>
                          <div className="flex flex-col items-center flex-1">
                            <div className="w-10 bg-pink-500 rounded-t" style={{height: `${genderStats.total? Math.round((genderStats.girls/genderStats.total)*100) : 0}%`}}></div>
                            <div className="text-xs text-gray-600 mt-1">Girls ({genderStats.girls})</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">Total: {genderStats.total}</div>
                      </div>

                      {/* Performance vs Other Classes */}
                      <div className="md:col-span-2 p-4 rounded border bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">Performance vs same grade</div>
                          {loadingGradePerf && <div className="text-xs text-gray-500">Loading…</div>}
                        </div>
                        {gradePerf.length === 0 ? (
                          <div className="text-sm text-gray-500">No recent exams available for this grade.</div>
                        ) : (
                          <div className="space-y-2">
                            {(() => {
                              const max = Math.max(...gradePerf.map(g=>g.mean||0), 1)
                              return gradePerf.map(g => (
                                <div key={g.klass} className="flex items-center gap-3">
                                  <div className={`text-xs w-28 ${String(g.klass)===String(klass?.id)?'font-semibold text-indigo-700':'text-gray-700'}`}>{g.klass_name}</div>
                                  <div className="flex-1 bg-gray-100 rounded h-3">
                                    <div className={`${String(g.klass)===String(klass?.id)?'bg-indigo-600':'bg-gray-400'} h-3 rounded`} style={{width: `${Math.min(100, (g.mean/max)*100)}%`}}></div>
                                  </div>
                                  <div className="w-12 text-right text-xs text-gray-700">{Number(g.mean||0).toFixed(1)}</div>
                                </div>
                              ))
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'subjects' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">Subjects</div>
                      {subjects.length > 0 && (
                        <button onClick={()=>openAssign(subjects[0]?.id)} className="text-sm px-3 py-1.5 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100">Assign Teacher</button>
                      )}
                    </div>
                    {subjects.length === 0 ? (
                      <div className="text-sm text-gray-500">No subjects assigned.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {subjects.map(s => {
                          const a = subjectAssignments[String(s.id)]
                          return (
                            <div key={s.id} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 border rounded-xl px-3 py-2 bg-white">
                              <div className="min-w-0">
                                <Link to={`/admin/subjects/${s.id}`} className="inline-flex items-center gap-2 hover:underline">
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{s.code}</span>
                                  <span className="text-gray-800 truncate">{s.name}</span>
                                </Link>
                              </div>
                              <div className="text-sm text-gray-600 min-w-0">
                                {a?.teacher_detail ? (
                                  <span className="truncate block">Teacher: {a.teacher_detail.first_name} {a.teacher_detail.last_name}</span>
                                ) : (
                                  <span className="text-gray-400">No teacher</span>
                                )}
                              </div>
                              <div className="sm:text-right">
                                <button
                                  onClick={()=>openAssign(s.id)}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${a
                                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                >
                                  {a ? 'Change' : 'Assign'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'students' && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Students in {klass?.name}</div>
                    {loadingStudents ? (
                      <div className="text-sm text-gray-500">Loading students...</div>
                    ) : classStudents.length === 0 ? (
                      <div className="text-sm text-gray-500">No students enrolled in this class.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2">Admission No</th>
                              <th className="px-3 py-2">Name</th>
                              <th className="px-3 py-2">Guardian Phone</th>
                              <th className="px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStudents.map(s => (
                              <tr key={s.id} className="border-t hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-xs">{s.admission_no}</td>
                                <td className="px-3 py-2">
                                  <Link to={`/admin/students/${s.id}`} className="text-blue-700 hover:underline">{s.name}</Link>
                                </td>
                                <td className="px-3 py-2">{s.guardian_id || 'N/A'}</td>
                                <td className="px-3 py-2 text-right">
                                  <Link to={`/admin/students/${s.id}`} className="text-blue-600 hover:underline">View</Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'results' && (
                  <div className="space-y-3">
                    <div className="text-xs sm:text-sm text-gray-600">Most Recent Exam</div>
                    {!recentExam ? (
                      <div className="text-sm text-gray-500">No exams found for this class.</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <div className="px-2.5 py-1 rounded border bg-gray-50 text-xs sm:text-sm"><span className="text-[10px] sm:text-xs text-gray-500">Exam</span> <span className="ml-2 font-medium text-xs sm:text-sm">{recentExam.name}</span></div>
                          <div className="px-2.5 py-1 rounded border bg-gray-50 text-xs sm:text-sm"><span className="text-[10px] sm:text-xs text-gray-500">Year</span> <span className="ml-2 font-medium text-xs sm:text-sm">{recentExam.year}</span></div>
                          <div className="px-2.5 py-1 rounded border bg-gray-50 text-xs sm:text-sm"><span className="text-[10px] sm:text-xs text-gray-500">Term</span> <span className="ml-2 font-medium text-xs sm:text-sm">T{recentExam.term}</span></div>
                          <div className="px-2.5 py-1 rounded border bg-gray-50 text-xs sm:text-sm"><span className="text-[10px] sm:text-xs text-gray-500">Date</span> <span className="ml-2 font-medium text-xs sm:text-sm">{recentExam.date || '-'}</span></div>
                        </div>
                        {loadingResults ? (
                          <div className="text-sm text-gray-500">Loading results...</div>
                        ) : (
                          <>
                            <div className="md:hidden text-xs text-gray-500">Swipe horizontally to see all subjects.</div>
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                              <table className="min-w-full text-xs md:text-sm">
                              <thead className="sticky top-0 bg-gray-50 z-10">
                                <tr>
                                  <th className="border px-2 py-1 text-left whitespace-nowrap sticky left-0 bg-gray-50">Student</th>
                                  {recentSummary.subjects.map(s => (
                                    <th key={s.id} className="border px-2 py-1 text-center whitespace-nowrap">{s.code}</th>
                                  ))}
                                  <th className="border px-2 py-1 text-right whitespace-nowrap">Total</th>
                                  <th className="border px-2 py-1 text-right whitespace-nowrap">Average</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recentSummary.students.length === 0 ? (
                                  <tr><td className="px-2 py-3 text-sm text-gray-500" colSpan={(recentSummary.subjects?.length||0)+3}>No results captured for this exam yet.</td></tr>
                                ) : (
                                  recentSummary.students.map(st => (
                                    <tr key={st.id} className="hover:bg-gray-50">
                                      <td className="border px-2 py-1 sticky left-0 bg-white">{st.name}</td>
                                      {recentSummary.subjects.map(s => (
                                        <td key={s.id} className="border px-2 py-1 text-center">{st.marks?.[String(s.id)] ?? '-'}</td>
                                      ))}
                                      <td className="border px-2 py-1 font-medium text-right">{st.total}</td>
                                      <td className="border px-2 py-1 text-right">{typeof st.average === 'number' ? Number(st.average).toFixed(1) : (st.average || '-')}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              </table>
                            </div>
                          </>
                        )}
                        <div>
                          <Link to={`/admin/results?exam=${recentExam.id}&grade=${encodeURIComponent(klass?.grade_level || '')}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 w-fit">Open in Results</Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {/* Assign Subject Teacher Modal */}
      <Modal open={showAssignModal} onClose={()=>setShowAssignModal(false)} title="Assign Subject Teacher" size="sm">
        <form onSubmit={saveAssignment} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Subject</span>
            <select className="border p-2 rounded" value={assignForm.subject} onChange={e=>setAssignForm({...assignForm, subject:e.target.value})} required>
              <option value="">Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Teacher</span>
            <select className="border p-2 rounded" value={assignForm.teacher} onChange={e=>setAssignForm({...assignForm, teacher:e.target.value})} required>
              <option value="">Select Teacher</option>
              {filteredTeachers.map(t => (
                <option key={t.user?.id || t.id} value={t.user?.id || t.id}>
                  {t.user?.first_name || ''} {t.user?.last_name || ''} (@{t.user?.username})
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowAssignModal(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </Modal>
      {/* Reassign Class Teacher Modal */}
      <Modal open={showReassignCT} onClose={()=>setShowReassignCT(false)} title="Reassign Class Teacher" size="sm">
        <form onSubmit={async (e)=>{
          e.preventDefault()
          try{
            const payload = { teacher: reassignTeacher ? Number(reassignTeacher) : null }
            await api.patch(`/academics/classes/${id}/`, payload)
            const { data } = await api.get(`/academics/classes/${id}/`)
            setKlass(data)
            setShowReassignCT(false)
          }catch(err){
            // Surface errors to aid debugging (instead of failing silently)
            console.error('Failed to reassign class teacher', err?.response || err)
            const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Unknown error')
            try { alert(`Failed to save: ${msg}`) } catch(_) {}
            setShowReassignCT(false)
          }
        }} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Select Teacher</span>
            <select className="border p-2 rounded" value={reassignTeacher} onChange={e=>setReassignTeacher(e.target.value)} required>
              <option value="">Choose a teacher</option>
              {availableCTs.map(t=> (
                <option key={t.user?.id || `tp-${t.id}`} value={t.user?.id || ''}>
                  {(t.user?.first_name||'') + ' ' + (t.user?.last_name||'') + (t.user?.username ? ` (@${t.user.username})` : '')}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowReassignCT(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}
