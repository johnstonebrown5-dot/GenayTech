import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import StatCard from '../components/StatCard'

export default function StudentDashboard(){
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [attendance, setAttendance] = useState([])
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invoices, setInvoices] = useState([])
  const [summary, setSummary] = useState({ total_billed: 0, total_paid: 0, balance: 0 })
  const [showPay, setShowPay] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', method: 'mpesa', reference: '', phone: '' })
  const [payError, setPayError] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [stkStatus, setStkStatus] = useState('idle') // idle | initiating | sent | polling | fetching | success | failed
  // Report Card modal
  const [showReport, setShowReport] = useState(false)
  // Derive current tab from URL: /student, /student/academics, /student/finance
  const currentTab = useMemo(() => {
    if (pathname.includes('/student/academics')) return 'academics'
    if (pathname.includes('/student/finance')) return 'finance'
    return 'dashboard'
  }, [pathname])
  // Edit contact details
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ email: '', phone: '', address: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  // Derived: performance data over time (average marks per exam)
  const performance = useMemo(() => {
    if (!Array.isArray(examResults) || examResults.length === 0) return []
    const byExam = new Map()
    for (const r of examResults) {
      const label = r.exam_detail?.name || r.exam || 'Exam'
      const entry = byExam.get(label) || { sum: 0, count: 0 }
      entry.sum += Number(r.marks || 0)
      entry.count += 1
      byExam.set(label, entry)
    }
    return Array.from(byExam.entries()).map(([label, { sum, count }]) => ({ label, avg: count ? (sum / count) : 0 }))
  }, [examResults])

  // Derive the most recent exam label from available results (best-effort)
  const latestExamLabel = useMemo(() => {
    if (!Array.isArray(examResults) || examResults.length === 0) return null
    // Keep first occurrence order from API (already grouped in performance using names)
    const first = examResults[0]
    return first?.exam_detail?.name || first?.exam || null
  }, [examResults])

  // Build report card rows for the latest exam
  const reportRows = useMemo(() => {
    if (!latestExamLabel) return []
    return (examResults || []).filter(r => ((r.exam_detail?.name || r.exam) === latestExamLabel))
      .map(r => ({
        subjectLabel: r.subject_detail ? `${r.subject_detail.code ? r.subject_detail.code + ' — ' : ''}${r.subject_detail.name || ''}` : String(r.subject || ''),
        marks: Number(r.marks || 0)
      }))
  }, [examResults, latestExamLabel])

  const reportTotals = useMemo(() => {
    const total = reportRows.reduce((s, r) => s + (Number.isFinite(r.marks) ? r.marks : 0), 0)
    const count = reportRows.length || 0
    const average = count ? (total / count) : 0
    return { total, average }
  }, [reportRows])

  const groupedExamResults = useMemo(() => {
    if (!Array.isArray(examResults) || examResults.length === 0) return []
    const m = new Map()
    for (const r of examResults) {
      const name = r.exam_detail?.name || r.exam || 'Exam'
      if (!m.has(name)) m.set(name, [])
      m.get(name).push(r)
    }
    return Array.from(m.entries())
  }, [examResults])

  useEffect(()=>{
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        // 1) Student is required
        const stRes = await api.get('/academics/students/my/')
        if (!mounted) return
        const st = stRes.data
        setStudent(st)

        // 2) Secondary data is optional; fetch concurrently and tolerate failures
        const settled = await Promise.allSettled([
          // assessments
          api.get(`/academics/assessments/my/`),
          // attendance
          api.get(`/academics/attendance/my/`),
          // exam results
          api.get(`/academics/exam_results/?student=${st.id}`),
          // invoices
          api.get('/finance/invoices/my/'),
          // summary
          api.get('/finance/invoices/my-summary/'),
        ])
        if (!mounted) return
        const [assS, attS, exmS, invS, sumS] = settled
        setAssessments(assS.status==='fulfilled'
          ? (Array.isArray(assS.value?.data) ? assS.value.data : (assS.value?.data?.results || []))
          : []
        )
        setAttendance(attS.status==='fulfilled'
          ? (Array.isArray(attS.value?.data) ? attS.value.data : (attS.value?.data?.results || []))
          : []
        )
        setExamResults(exmS.status==='fulfilled'
          ? (Array.isArray(exmS.value?.data) ? exmS.value.data : (exmS.value?.data?.results || []))
          : []
        )
        setInvoices(invS.status==='fulfilled'
          ? (Array.isArray(invS.value?.data) ? invS.value.data : (invS.value?.data?.results || []))
          : []
        )
        setSummary(sumS.status==='fulfilled' ? (sumS.value?.data || { total_billed:0, total_paid:0, balance:0 }) : { total_billed:0, total_paid:0, balance:0 })
      } catch (e) {
        if (!mounted) return
        // Only block page when we cannot load the student record
        setError(e?.response?.data?.detail || e?.message || 'Failed to load your profile')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const classLabel = useMemo(() => {
    const k = student?.klass_detail
    if (!k) return student?.klass || '-'
    return `${k.name} • ${k.grade_level}`
  }, [student])

  function money(n){
    try {
      const val = Number(n || 0)
      return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val)
    } catch {
      return `Ksh. ${n}`
    }
  }

  const openPay = (invoice) => {
    setSelectedInvoice(invoice)
    setPayForm({ amount: '', method: 'mpesa', reference: '' })
    setPayError('')
    setShowPay(true)
  }

  const submitPay = async (e) => {
    e.preventDefault()
    if (!selectedInvoice) return
    setPaySubmitting(true)
    setPayError('')
    try {
      const payload = { amount: parseFloat(payForm.amount || 0), method: payForm.method, reference: payForm.reference }
      if (!payload.amount || isNaN(payload.amount) || payload.amount <= 0) {
        setPayError('Enter a valid amount greater than 0')
        setPaySubmitting(false)
        return
      }
      // If M-Pesa, run STK via Co-op instead of manual recording
      if (String(payForm.method).toLowerCase()==='mpesa'){
        if (!payForm.phone) { setPayError('Phone number required for STK'); setPaySubmitting(false); return }
        setStkStatus('initiating')
        // Baseline: current invoice status from my_invoices (students have access)
        const beforeInv = await api.get('/finance/invoices/my/')
        const beforeList = Array.isArray(beforeInv.data) ? beforeInv.data : (beforeInv.data?.results || [])
        const beforeItem = beforeList.find(x => Number(x.id) === Number(selectedInvoice.id))
        const beforeStatus = beforeItem?.status || 'unpaid'
        await api.post(`/finance/invoices/${selectedInvoice.id}/coop_stk/`, {
          phone: String(payForm.phone).trim(),
          amount: payload.amount,
          simulate: false,
        })
        setStkStatus('sent')
        // Poll up to 60s for invoice status change (unpaid -> partial/paid)
        setStkStatus('polling')
        const started = Date.now()
        let updated = false
        while (Date.now() - started < 60000) {
          await new Promise(r=>setTimeout(r, 3000))
          const pollInv = await api.get('/finance/invoices/my/')
          const list = Array.isArray(pollInv.data) ? pollInv.data : (pollInv.data?.results || [])
          const item = list.find(x => Number(x.id) === Number(selectedInvoice.id))
          const nowStatus = item?.status || beforeStatus
          if (nowStatus !== beforeStatus && (nowStatus === 'partial' || nowStatus === 'paid')) { updated = true; break }
        }
        if (!updated){ setPayError('STK sent, but no confirmation yet. It may complete later.'); setStkStatus('failed') }
        else { setStkStatus('success') }
      } else {
        await api.post(`/finance/invoices/${selectedInvoice.id}/pay/`, payload)
      }
      // Refresh
      const [invRes, sumRes] = await Promise.all([
        api.get('/finance/invoices/my/'),
        api.get('/finance/invoices/my-summary/'),
      ])
      setInvoices(invRes.data)
      setSummary(sumRes.data)
      setShowPay(false)
    } catch (err) {
      setPayError(err?.response?.data ? (err.response.data.detail || JSON.stringify(err.response.data)) : (err?.message || 'Payment failed'))
    } finally {
      setPaySubmitting(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <header className="relative overflow-hidden -mx-3 sm:mx-0 rounded-none sm:rounded-2xl px-4 py-5 sm:p-7 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-500 text-white shadow-lg">
        <div
          className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.65),transparent_55%)]"
          aria-hidden
        ></div>
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="space-y-3 text-center sm:text-left">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Welcome back</p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight drop-shadow-sm">
              {student?.name ? student.name.toUpperCase() : ''}
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {classLabel && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-sm">
                  <span className="text-sm" aria-hidden>
                    🏫
                  </span>
                  {classLabel}
                </span>
              )}
              {student?.admission_no && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-sm">
                  <span className="text-sm" aria-hidden>
                    🆔
                  </span>
                  Adm {student.admission_no}
                </span>
              )}
              {student?.dob && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-sm">
                  <span className="text-sm" aria-hidden>
                    🎂
                  </span>
                  {student.dob}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto sm:mx-0 rounded-2xl bg-white/18 backdrop-blur-md shadow-inner">
              <span className="text-2xl sm:text-3xl" aria-hidden>
                🎓
              </span>
            </div>
          </div>
        </div>
      </header>

      {loading && <div className="-mx-3 sm:mx-0 bg-white sm:rounded-xl shadow p-3 sm:p-4">Loading...</div>}
      {error && <div className="-mx-3 sm:mx-0 bg-red-50 text-red-700 p-3 sm:p-3 rounded-none sm:rounded">{error}</div>}

  {currentTab === 'dashboard' && (
    <div className="-mx-3 sm:mx-0 bg-white shadow-sm rounded-none sm:rounded-2xl pt-4 pb-6 px-4 sm:p-5">
      <h2 className="font-medium mb-2">Dashboard</h2>
      <div className="grid gap-4 sm:grid-cols-2 md:gap-5 md:grid-cols-3">
        <StatCard title="Total Billed" value={Number(summary.total_billed || 0)} accent="from-amber-500 to-orange-600" icon="🧾" animate format={v => money(v)} />
        <StatCard title="Total Paid" value={Number(summary.total_paid || 0)} accent="from-emerald-500 to-emerald-600" icon="💳" animate format={v => money(v)} trend={summary.total_paid && summary.total_billed ? ((summary.total_paid / Math.max(1, summary.total_billed)) * 100) : 0} />
        <StatCard title="Balance" value={Number(summary.balance || 0)} accent="from-sky-500 to-blue-600" icon="📉" animate format={v => money(v)} />
      </div>

      {student && (
        <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Profile</div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">Student Information</h2>
            </div>
            <button
              className="self-start sm:self-auto text-sm px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-700 transition"
              onClick={() => {
                setEditError('');
                setEditForm({ email: student.email || '', phone: student.guardian_id || '', address: student.address || '' });
                setShowEdit(true);
              }}
            >Edit</button>
          </div>
          <div className="grid md:grid-cols-[260px_1fr]">
            <div className="relative p-5 md:p-6 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.18),transparent_55%)] border-b md:border-b-0 md:border-r border-slate-200 flex flex-col items-center text-center gap-4">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-white/60 flex items-center justify-center">
                {student.photo_url ? (
                  <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-slate-300 text-6xl">👤</div>
                )}
              </div>
              <div className="space-y-2">
                {student.admission_no && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 text-slate-700 text-xs sm:text-sm font-medium shadow-sm">
                    <span className="text-base" aria-hidden>🆔</span>
                    {student.admission_no}
                  </span>
                )}
                {classLabel && (
                  <div className="text-sm text-slate-600 font-medium">{classLabel}</div>
                )}
              </div>
            </div>
            <div className="px-4 sm:px-5 py-5 sm:py-6 space-y-6">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Personal Details</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Full Name</dt>
                    <dd className="font-semibold text-slate-900 uppercase">{student.name}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Gender</dt>
                    <dd className="font-medium text-slate-900">{student.gender || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Date of Birth</dt>
                    <dd className="font-medium text-slate-900">{student.dob || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Passport No</dt>
                    <dd className="font-medium text-slate-900">{student.passport_no || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Class</dt>
                    <dd className="font-medium text-slate-900">{classLabel || '-'}</dd>
                  </div>
                </dl>
              </section>
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Contact & Guardian</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/80">
                    <div className="text-slate-500">Email</div>
                    <div className="font-medium text-slate-900 break-words">{student.email || '-'}</div>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/80">
                    <div className="text-slate-500">Parent/Guardian Phone</div>
                    <div className="font-medium text-slate-900">{student.guardian_id || '-'}</div>
                  </div>
                  <div className="sm:col-span-2 p-3 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/80">
                    <div className="text-slate-500">Postal Address</div>
                    <div className="font-medium text-slate-900">{student.address || '-'}</div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

  {currentTab === 'academics' && (
    <div className="-mx-3 sm:mx-0 bg-white shadow-sm rounded-none sm:rounded-2xl pt-4 pb-6 px-4 sm:p-5">
      <h2 className="font-medium mb-2">Academics</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium">Report Card</h2>
            <button
              className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              onClick={() => latestExamLabel ? navigate('/student/report-card') : null}
              disabled={!latestExamLabel}
            >{latestExamLabel ? 'View' : 'No Exam Yet'}</button>
          </div>
          <p className="text-sm text-gray-600">{latestExamLabel ? `Latest exam: ${latestExamLabel}` : 'Your report card will appear here after the first exam is published.'}</p>
        </div>
        <div className="bg-white rounded shadow p-4 border border-dashed border-indigo-200 text-sm text-indigo-700 flex items-center justify-center">
          <button className="px-3 py-1.5 rounded-full border border-indigo-300 bg-indigo-50 hover:bg-indigo-100" onClick={() => setShowReport(true)} disabled={!latestExamLabel}>
            View quick report
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-medium mb-2">Assessments</h2>
          {!Array.isArray(assessments) || assessments.length === 0 ? (
            <div className="text-sm text-gray-500">No assessments yet.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-2 px-2">Competency</th>
                  <th className="py-2 px-2">Level</th>
                  <th className="py-2 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map(a => (
                  <tr key={a.id} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-2">{a.competency}</td>
                    <td className="py-2 px-2">{a.level}</td>
                    <td className="py-2 px-2">{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-medium mb-2">Attendance</h2>
          {!Array.isArray(attendance) || attendance.length === 0 ? (
            <div className="text-sm text-gray-500">No attendance records yet.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(at => (
                  <tr key={at.id} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-2">{at.date}</td>
                    <td className="py-2 px-2 capitalize">{at.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium mb-3">Performance Over Time</h2>
        {Array.isArray(performance) && performance.length > 0 ? (
          <ResponsiveLine data={performance} />
        ) : (
          <div className="text-sm text-gray-500">No exam performance data yet.</div>
        )}
      </div>
    </div>
  )}

  </div>
  )
}

// Lightweight responsive line chart component (no external deps)
function ResponsiveLine({ data }){
  // dimensions
  const height = 220
  const padding = { top: 20, right: 20, bottom: 36, left: 36 }
  const width = Math.min(900, Math.max(320, (typeof window !== 'undefined' ? window.innerWidth - 120 : 600)))
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const xs = data.map((_, i) => i)
  const ys = data.map(d => Number(d.avg) || 0)
  const xMin = 0
  const xMax = Math.max(1, xs.length - 1)
  const yMin = 0
  const yMax = Math.max(100, Math.ceil(Math.max(...ys, 0) / 10) * 10)
  const xScale = i => padding.left + (innerW * (i - xMin) / (xMax - xMin || 1))
  const yScale = v => padding.top + innerH - (innerH * (v - yMin) / (yMax - yMin || 1))
  const points = xs.map((i, idx) => `${xScale(i)},${yScale(ys[idx])}`).join(' ')
  const gridY = [0, 25, 50, 75, 100].map(p => yMin + (p/100) * (yMax - yMin))
  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Performance line chart">
        {/* grid */}
        {gridY.map((g, idx) => (
          <line key={idx} x1={padding.left} y1={yScale(g)} x2={width - padding.right} y2={yScale(g)} stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {/* axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#9ca3af" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#9ca3af" />
        {/* y-axis labels */}
        {gridY.map((g, idx) => (
          <text key={idx} x={padding.left - 6} y={yScale(g) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(g)}</text>
        ))}
        {/* x-axis labels */}
        {data.map((d, i) => (
          <text key={i} x={xScale(i)} y={height - padding.bottom + 14} textAnchor="middle" fontSize="10" fill="#6b7280">
            {String(d.label).slice(0, 10)}
          </text>
        ))}
        {/* line */}
        <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={points} />
        {/* points */}
        {data.map((d, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(Number(d.avg)||0)} r="3" fill="#1d4ed8" />
        ))}
      </svg>
    </div>
  )
}
