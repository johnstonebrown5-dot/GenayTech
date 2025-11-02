import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import StudentReportCardViewer from './StudentReportCardViewer'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import api from '../api'
import { uploadToCloudinary } from '../utils/cloudinary'
import { toast } from '../utils/toast'

function Selectors({ examResults, uiSelectedTerm, setUiSelectedTerm, uiSelectedExamId, setUiSelectedExamId }){
  const termOptions = React.useMemo(()=>{
    const s = new Set()
    for (const r of (examResults||[])){
      const ed = r.exam_detail || {}
      if (!ed?.published) continue
      if (ed.year && ed.term){ s.add(`${ed.year}-T${ed.term}`) }
    }
    return Array.from(s)
  }, [examResults])

  const parsedTerm = React.useMemo(()=>{
    if (!uiSelectedTerm) return null
    const [y,t] = String(uiSelectedTerm).split('-T')
    const year = Number(y), term = Number(t)
    if (!Number.isFinite(year) || !Number.isFinite(term)) return null
    return { year, term }
  }, [uiSelectedTerm])

  const termExams = React.useMemo(()=>{
    if (!parsedTerm) return []
    const seen = new Set()
    const out = []
    for (const r of (examResults||[])){
      const ed = r.exam_detail || {}
      const id = ed.id || r.exam
      if (!id || seen.has(String(id))) continue
      if (!ed?.published) continue
      if (ed.year === parsedTerm.year && ed.term === parsedTerm.term){
        seen.add(String(id))
        out.push({ id, name: ed.name || String(r.exam||'') })
      }
    }
    return out
  }, [examResults, parsedTerm])

  React.useEffect(()=>{
    if (!uiSelectedTerm && termOptions.length){
      setUiSelectedTerm(termOptions[0])
    }
  }, [uiSelectedTerm, termOptions, setUiSelectedTerm])

  React.useEffect(()=>{
    if (!uiSelectedExamId && termExams.length){
      setUiSelectedExamId(termExams[0].id)
    }
  }, [uiSelectedExamId, termExams, setUiSelectedExamId])

  return (
    <div className="mb-3 flex items-center gap-2">
      <select className="px-2 py-1.5 border rounded bg-white text-sm" value={uiSelectedTerm || ''} onChange={(e)=> setUiSelectedTerm(e.target.value || null)} title="Select Term">
        {termOptions.map(k=> (
          <option key={k} value={k}>{k.replace('-', ' ')}</option>
        ))}
      </select>
      <select className="px-2 py-1.5 border rounded bg-white text-sm" value={uiSelectedExamId || ''} onChange={(e)=> setUiSelectedExamId(e.target.value || null)} title="Select Exam">
        {termExams.map(ex => (
          <option key={ex.id} value={ex.id}>{ex.name}</option>
        ))}
      </select>
    </div>
  )
}

export default function AdminStudentDashboard() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [attendance, setAttendance] = useState([])
  const [examResults, setExamResults] = useState([])
  const [uiSelectedTerm, setUiSelectedTerm] = useState(null)
  const [uiSelectedExamId, setUiSelectedExamId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [finance, setFinance] = useState({ total_billed: 0, total_paid: 0, balance: 0 })
  const [uploading, setUploading] = useState(false)
  const [classes, setClasses] = useState([])
  const [showEdit, setShowEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editErr, setEditErr] = useState('')
  const [form, setForm] = useState({
    name: '',
    dob: '',
    gender: '',
    klass: '',
    guardian_id: '',
    email: '',
    address: '',
    passport_no: '',
    boarding_status: 'day'
  })
  const [historyData, setHistoryData] = useState(null)
  const [historyError, setHistoryError] = useState('')
  const [histYear, setHistYear] = useState('')
  const [histTerm, setHistTerm] = useState('')
  const [histAcademicYear, setHistAcademicYear] = useState('')
  const [histIncludeSubjects, setHistIncludeSubjects] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        setLoading(true)
        setError('')
        const params = {}
        if (histYear) params.year = histYear
        if (histTerm) params.term = histTerm
        if (histAcademicYear) params.academic_year = histAcademicYear
        if (histIncludeSubjects) params.include_subjects = 'true'
        const [st, asRes, atRes, exRes, fin, cl, hist] = await Promise.all([
          api.get(`/academics/students/${id}/`),
          api.get(`/academics/assessments/?student=${id}`),
          api.get(`/academics/attendance/?student=${id}`),
          api.get(`/academics/exam_results/?student=${id}`),
          api.get(`/finance/invoices/student-summary?student=${id}`),
          api.get('/academics/classes/'),
          api.get(`/academics/students/${id}/history/`, { params })
        ])
        if (!isMounted) return
        setStudent(st.data)
        const assessArr = Array.isArray(asRes.data) ? asRes.data : (Array.isArray(asRes.data?.results) ? asRes.data.results : [])
        const attendanceArr = Array.isArray(atRes.data) ? atRes.data : (Array.isArray(atRes.data?.results) ? atRes.data.results : [])
        const examResArr = Array.isArray(exRes.data) ? exRes.data : (Array.isArray(exRes.data?.results) ? exRes.data.results : [])
        setAssessments(assessArr)
        setAttendance(attendanceArr)
        setExamResults(examResArr)
        setFinance(fin.data)
        const classesData = Array.isArray(cl.data) ? cl.data : (Array.isArray(cl.data?.results) ? cl.data.results : [])
        setClasses(classesData)
        setHistoryData(hist.data)
        setHistoryError('')
      } catch (e) {
        if (!isMounted) return
        setError(e?.response?.data?.detail || e?.message || 'Failed to load student dashboard')
        setHistoryError(e?.response?.data?.detail || e?.message || 'Failed to load history')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [id, histYear, histTerm, histAcademicYear, histIncludeSubjects])

  async function onPhotoChange(e){
    const file = e.target.files?.[0]
    if (!file) return
    try{
      setUploading(true)
      const { url } = await uploadToCloudinary(file, { folder: 'edu-track/students' })
      await api.patch(`/academics/students/${id}/`, { photo_url: url })
      const { data } = await api.get(`/academics/students/${id}/`)
      setStudent(data)
    } catch(err){
      toast(err?.response?.data?.detail || err?.message || 'Failed to upload student photo', 'error')
    } finally{
      setUploading(false)
      e.target.value = ''
    }
  }

  const classLabel = useMemo(() => {
    const k = student?.klass_detail
    if (!k) return student?.klass || '-'
    return `${k.name} • ${k.grade_level}`
  }, [student])

  function openEdit(){
    if (!student) return
    setEditErr('')
    setForm({
      name: student.name || '',
      dob: student.dob || '',
      gender: student.gender || '',
      klass: student.klass || student.klass_detail?.id || '',
      guardian_id: student.guardian_id || '',
      email: student.email || '',
      address: student.address || '',
      passport_no: student.passport_no || '',
      boarding_status: student.boarding_status || 'day'
    })
    setShowEdit(true)
  }

  async function saveEdit(e){
    e?.preventDefault?.()
    try{
      setSaving(true)
      setEditErr('')
      const payload = {
        name: form.name,
        dob: form.dob,
        gender: form.gender,
        guardian_id: form.guardian_id,
        email: form.email,
        address: form.address,
        passport_no: form.passport_no,
        klass: form.klass || null,
        boarding_status: form.boarding_status
      }
      await api.patch(`/academics/students/${id}/`, payload)
      const { data } = await api.get(`/academics/students/${id}/`)
      setStudent(data)
      setShowEdit(false)
    } catch(err){
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed to update student')
      setEditErr(msg)
    } finally{
      setSaving(false)
    }
  }

  function money(n){
    try {
      const val = Number(n || 0)
      return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val)
    } catch {
      return `Ksh. ${n}`
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <div className="text-sm text-gray-500"><Link to="/admin" className="hover:underline">Admin</Link> / <Link to="/admin/students" className="hover:underline">Students</Link> / <span className="text-gray-700">Dashboard</span></div>
        {/* Header banner */}
        <div className="bg-green-600 text-white rounded shadow p-3 flex items-center justify-between">
          <div className="font-medium">Welcome {student?.name ? student.name.toUpperCase() : ''}</div>
          <div className="text-xs opacity-90">Dashboard</div>
        </div>

        {loading && (
          <div className="bg-white rounded shadow p-4">Loading...</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>
        )}

        {/* Quick actions */}
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/admin/students/${id}/payments`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            <span>➕</span>
            <span>Make Payment</span>
          </Link>
          <Link
            to={`/admin/students/${id}/report-card`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-slate-700 text-white hover:bg-slate-800"
          >
            <span>🧾</span>
            <span>View Report Card</span>
          </Link>
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <span>✏️</span>
            <span>Edit Details</span>
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-amber-500 text-white rounded shadow p-4">
            <div className="text-sm opacity-90">Total Billed</div>
            <div className="text-2xl font-semibold">{money(finance.total_billed)}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs opacity-90">All time invoiced</div>
              <Link className="text-xs underline" to={`/admin/students/${id}/invoices`}>View Details</Link>
            </div>
          </div>
          <div className="bg-green-600 text-white rounded shadow p-4">
            <div className="text-sm opacity-90">Total Paid</div>
            <div className="text-2xl font-semibold">{money(finance.total_paid)}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs opacity-90">All time payments</div>
              <Link className="text-xs underline" to={`/admin/students/${id}/payments`}>View Details</Link>
            </div>
          </div>
          <div className="bg-sky-600 text-white rounded shadow p-4">
            <div className="text-sm opacity-90">Balance</div>
            <div className="text-2xl font-semibold">{money(finance.balance)}</div>
            <div className="text-xs mt-1 opacity-90">Outstanding</div>
          </div>
        </div>

        {student && (
          <div className="bg-white rounded shadow p-0 overflow-hidden">
            <div className="border-b px-4 py-2 font-medium">User Profile</div>
            <div className="grid md:grid-cols-3 gap-0">
              <div className="p-4 border-r">
                <div className="w-40 h-40 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                  {student.photo_url ? (
                    <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-gray-400 text-6xl">👤</div>
                  )}
                </div>
                <div className="mt-3 text-sm text-gray-600">{student.admission_no}</div>
                <label className="inline-flex mt-2 text-xs text-blue-600 hover:underline cursor-pointer">
                  <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                  {uploading ? 'Uploading...' : 'Change Photo'}
                </label>
              </div>
              <div className="md:col-span-2 p-4">
                <div className="text-gray-700 font-medium mb-3">Personal Information</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  <div>
                    <div className="text-gray-500">Admission No</div>
                    <div className="font-medium">{student.admission_no}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Full Name</div>
                    <div className="font-medium uppercase">{student.name}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Passport No</div>
                    <div className="font-medium">{student.passport_no || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Phone Number</div>
                    <div className="font-medium">{student.phone || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Gender</div>
                    <div className="font-medium">{student.gender || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Boarding Status</div>
                    <div className="font-medium capitalize">{student.boarding_status || 'day'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Date of Birth</div>
                    <div className="font-medium">{student.dob}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Class</div>
                    <div className="font-medium">{classLabel}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Guardian ID/Phone</div>
                    <div className="font-medium">{student.guardian_id || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Email</div>
                    <div className="font-medium">{student.email || '-'}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-gray-500">Postal Address</div>
                    <div className="font-medium">{student.address || '-'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded shadow p-4">
            <h2 className="font-medium mb-2">Assessments</h2>
            {assessments.length === 0 ? (
              <div className="text-sm text-gray-500">No assessments yet.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Competency</th>
                    <th>Level</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map(a => (
                    <tr key={a.id} className="border-t">
                      <td>{a.competency}</td>
                      <td>{a.level}</td>
                      <td>{a.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded shadow p-4">
            <h2 className="font-medium mb-2">Attendance</h2>
            {attendance.length === 0 ? (
              <div className="text-sm text-gray-500">No attendance records yet.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(at => (
                    <tr key={at.id} className="border-t">
                      <td>{at.date}</td>
                      <td className="capitalize">{at.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Exam Results</h2>
            <Link to={`/admin/students/${id}/report-card`} className="text-sm text-indigo-600 hover:underline">Open Printable</Link>
          </div>
          {examResults.length === 0 ? (
            <div className="text-sm text-gray-500">No exam results yet.</div>
          ) : (
            <>
              <Selectors examResults={examResults} uiSelectedTerm={uiSelectedTerm} setUiSelectedTerm={setUiSelectedTerm} uiSelectedExamId={uiSelectedExamId} setUiSelectedExamId={setUiSelectedExamId} />
              <div className="-mx-4">
                <StudentReportCardViewer embedded hideHistory showTermSelector={false} showExamSelector={false} showBackPrint={false} selectedTermYear={uiSelectedTerm} onSelectedTermYearChange={setUiSelectedTerm} selectedExamId={uiSelectedExamId} onSelectedExamIdChange={setUiSelectedExamId} />
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-medium mb-2">Student History</h2>
          {!!historyError && <div className="text-sm text-red-600 mb-2">{historyError}</div>}
          {!historyData && !historyError && <div className="text-sm text-gray-500">Loading history...</div>}
          {historyData && (
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Class Progression</div>
                </div>
                {(!historyData.classes || historyData.classes.length === 0) ? (
                  <div className="text-sm text-gray-500">No class history found.</div>
                ) : (
                  <div className="text-sm relative pl-4 border-l-2 border-slate-200">
                    {historyData.classes
                      .filter(x => x.year || x.grade || x.class_name)
                      .map((c, idx) => (
                        <div key={idx} className="mb-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full -ml-[9px]"></span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
                              {(c.year ? `${c.year}` : '')}{(c.term ? ` · T${c.term}` : '')}
                            </span>
                            {c.action && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs capitalize">
                                {c.action}
                              </span>
                            )}
                          </div>
                          <div className="ml-3 mt-1 text-slate-800 font-medium">{c.class_name || c.grade || '-'}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Exams Overview</div>
                </div>
                {(!historyData.exams || historyData.exams.length === 0) ? (
                  <div className="text-sm text-gray-500">No exams yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border rounded">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Exam</th>
                          <th className="px-3 py-2">Term</th>
                          <th className="px-3 py-2">Subjects</th>
                          <th className="px-3 py-2">Total</th>
                          <th className="px-3 py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.exams.map((e)=> {
                          const pct = e.approx_percentage
                          const pctClass = pct == null ? 'bg-slate-100 text-slate-600' : (pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')
                          return (
                            <tr key={e.exam.id} className="border-t">
                              <td className="px-3 py-2">{e.exam.name}</td>
                              <td className="px-3 py-2">{e.exam.year}-T{e.exam.term}</td>
                              <td className="px-3 py-2">{e.subjects_count}</td>
                              <td className="px-3 py-2">{e.total_marks_obtained}</td>
                              <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${pctClass}`}>{pct ?? '-'}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Fees by Term</div>
                </div>
                {(!historyData.fees || !historyData.fees.by_term || historyData.fees.by_term.length === 0) ? (
                  <div className="text-sm text-gray-500">No fee records.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border rounded">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Term</th>
                          <th className="px-3 py-2">Billed</th>
                          <th className="px-3 py-2">Paid</th>
                          <th className="px-3 py-2">Bal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.fees.by_term.map((t, i) => {
                          const billed = Number(t.billed || 0)
                          const paid = Number(t.paid || 0)
                          const bal = billed - paid
                          const balClass = bal <= 0 ? 'text-emerald-700' : 'text-rose-700'
                          return (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2">{t.year ? `${t.year}-T${t.term || '-'}` : '-'}</td>
                              <td className="px-3 py-2">{money(billed)}</td>
                              <td className="px-3 py-2">{money(paid)}</td>
                              <td className={`px-3 py-2 ${balClass}`}>{money(bal)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {historyData.fees?.summary && (
                  <div className="text-sm bg-slate-50 rounded border p-3 mt-3 space-y-1">
                    <div className="flex items-center justify-between"><span className="text-slate-600">Total Billed</span><span className="font-medium">{money(historyData.fees.summary.total_billed)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-600">Total Paid</span><span className="font-medium">{money(historyData.fees.summary.total_paid)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-600">Balance</span><span className={`font-semibold ${Number(historyData.fees.summary.balance||0) <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(historyData.fees.summary.balance)}</span></div>
                  </div>
                )}
              </div>
            </div>
          )}
          {historyData && (
            <div className="mt-6">
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <input className="px-2 py-1.5 border rounded text-sm w-28" placeholder="Year" value={histYear} onChange={e=>setHistYear(e.target.value)} />
                <select className="px-2 py-1.5 border rounded text-sm w-28" value={histTerm} onChange={e=>setHistTerm(e.target.value)}>
                  <option value="">Term</option>
                  <option value="1">T1</option>
                  <option value="2">T2</option>
                  <option value="3">T3</option>
                </select>
                <input className="px-2 py-1.5 border rounded text-sm w-40" placeholder="Academic Year" value={histAcademicYear} onChange={e=>setHistAcademicYear(e.target.value)} />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={histIncludeSubjects} onChange={e=>setHistIncludeSubjects(e.target.checked)} />
                  <span>Include Subjects</span>
                </label>
              </div>
              {Array.isArray(historyData.exams_grouped_academic_year) && historyData.exams_grouped_academic_year.length > 0 ? (
                <div className="space-y-4">
                  {historyData.exams_grouped_academic_year.map((ay, idx) => (
                    <div key={idx} className="border rounded">
                      <div className="px-3 py-2 bg-slate-50 font-medium">{ay.academic_year_label}</div>
                      <div className="divide-y">
                        {(ay.terms || []).map((t, i) => (
                          <div key={i} className="p-3">
                            <div className="text-sm font-medium mb-2">Term {t.term} • Exams: {t.total_exams} • Total: {Number(t.total_marks_obtained || 0)}</div>
                            {t.approx_percentage_mean != null && (
                              <div className="text-xs mb-2">Avg %: {t.approx_percentage_mean}</div>
                            )}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead>
                                  <tr>
                                    <th className="px-2 py-1.5">Exam</th>
                                    <th className="px-2 py-1.5">Subjects</th>
                                    <th className="px-2 py-1.5">Total</th>
                                    <th className="px-2 py-1.5">%</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(t.items || []).map((e, j) => (
                                    <tr key={j} className="border-t">
                                      <td className="px-2 py-1.5">{e.exam?.name}</td>
                                      <td className="px-2 py-1.5">{e.subjects_count}</td>
                                      <td className="px-2 py-1.5">{e.total_marks_obtained}</td>
                                      <td className="px-2 py-1.5">{e.approx_percentage ?? '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No grouped exam history found.</div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Edit Student Modal */}
      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title="Edit Student Details" size="lg">
        <form onSubmit={saveEdit} className="space-y-4">
          {editErr && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">{editErr}</div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Full Name</label>
              <input className="w-full border rounded px-3 py-2" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Class</label>
              <select className="w-full border rounded px-3 py-2" value={form.klass} onChange={e=>setForm({...form, klass:e.target.value})}>
                <option value="">Not Assigned</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Gender</label>
              <select className="w-full border rounded px-3 py-2" value={form.gender} onChange={e=>setForm({...form, gender:e.target.value})}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Boarding Status</label>
              <select className="w-full border rounded px-3 py-2" value={form.boarding_status} onChange={e=>setForm({...form, boarding_status:e.target.value})}>
                <option value="day">Day</option>
                <option value="boarding">Boarding</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Date of Birth</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Guardian Phone</label>
              <input className="w-full border rounded px-3 py-2" value={form.guardian_id} onChange={e=>setForm({...form, guardian_id:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border rounded px-3 py-2" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Passport No</label>
              <input className="w-full border rounded px-3 py-2" value={form.passport_no} onChange={e=>setForm({...form, passport_no:e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Address</label>
              <input className="w-full border rounded px-3 py-2" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={()=>setShowEdit(false)} className="px-4 py-2 border rounded">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}
