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
    <div className="p-6 space-y-6">
      {/* Header banner (no buttons; navigation is in sidebar) */}
      <div className="rounded-xl p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs opacity-90">Welcome</div>
            <div className="text-lg sm:text-xl font-semibold tracking-tight">{student?.name ? student.name.toUpperCase() : ''}</div>
            <div className="text-xs opacity-90 mt-1">{student ? (classLabel || '') : ''}</div>
          </div>
          <div className="hidden sm:block w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl">
            <span>🎓</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded shadow p-4">Loading...</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>
      )}

      {/* Sidebar now handles navigation; in-page tab buttons removed */}

      {currentTab === 'dashboard' && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Total Billed"
              value={Number(summary.total_billed||0)}
              accent="from-amber-500 to-orange-600"
              icon="🧾"
              animate
              format={(v)=>money(v)}
            />
            <StatCard
              title="Total Paid"
              value={Number(summary.total_paid||0)}
              accent="from-emerald-500 to-emerald-600"
              icon="💳"
              animate
              format={(v)=>money(v)}
              trend={summary.total_paid && summary.total_billed ? ((summary.total_paid/Math.max(1, summary.total_billed))*100) : 0}
            />
            <StatCard
              title="Balance"
              value={Number(summary.balance||0)}
              accent="from-sky-500 to-blue-600"
              icon="📉"
              animate
              format={(v)=>money(v)}
            />
          </div>

          {/* User Profile */}
          {student && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="border-b px-4 py-2 font-medium flex items-center justify-between">
                <span>User Profile</span>
                <button
                  className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={()=>{ setEditError(''); setEditForm({ email: student.email || '', phone: student.guardian_id || '', address: student.address || '' }); setShowEdit(true) }}
                >Edit</button>
              </div>
              <div className="grid md:grid-cols-3 gap-0">
                <div className="p-4 border-r">
                  <div className="w-40 h-40 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-400 text-6xl">👤</div>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-gray-600">{student.admission_no}</div>
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
                      <div className="text-gray-500">Parent/Guardian Phone</div>
                      <div className="font-medium">{student.guardian_id || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Gender</div>
                      <div className="font-medium">{student.gender || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Date of Birth</div>
                      <div className="font-medium">{student.dob}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Class</div>
                      <div className="font-medium">{classLabel}</div>
                    </div>
                    {/* Guardian shown above as Phone Number */}
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
        </>
      )}

      {currentTab === 'academics' && (
        <>
          {/* Report Card quick access */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded shadow p-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-medium">Report Card</h2>
                <button
                  className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  onClick={()=> latestExamLabel ? navigate('/student/report-card') : null}
                  disabled={!latestExamLabel}
                >{latestExamLabel ? 'View' : 'No Exam Yet'}</button>
              </div>
              <div className="text-sm text-gray-600">{latestExamLabel ? `Latest exam: ${latestExamLabel}` : 'Your report card will appear here after the first exam is published.'}</div>
            </div>
            <div></div>
          </div>

          {/* Assessments and Attendance */}
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

          {/* Performance Over Time */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-medium mb-3">Performance Over Time</h2>
            {Array.isArray(performance) && performance.length > 0 ? (
              <ResponsiveLine data={performance} />
            ) : (
              <div className="text-sm text-gray-500">No exam performance data yet.</div>
            )}
          </div>

          {/* Exam Results */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-medium mb-2">Exam Results</h2>
            {!Array.isArray(examResults) || examResults.length === 0 ? (
              <div className="text-sm text-gray-500">No exam results yet.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-2">Subject</th>
                    <th className="py-2 px-2">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedExamResults.map(([examName, rows]) => (
                    <React.Fragment key={examName}>
                      <tr className="border-t bg-gray-50/70">
                        <td className="py-2 px-2 font-medium" colSpan={2}>{examName}</td>
                      </tr>
                      {rows.map(r => (
                        <tr key={r.id} className="border-t hover:bg-gray-50">
                          <td className="py-2 px-2">
                            {r.subject_detail
                              ? (
                                  (r.subject_detail.code ? `${r.subject_detail.code} — ` : '') +
                                  (r.subject_detail.name || '')
                                )
                              : r.subject
                            }
                          </td>
                          <td className="py-2 px-2">{r.marks}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {currentTab === 'finance' && (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="font-medium">My Fees</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Billed <strong className="ml-1">{Number(summary.total_billed||0).toLocaleString()}</strong></span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Paid <strong className="ml-1">{Number(summary.total_paid||0).toLocaleString()}</strong></span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${Number(summary.balance)>0? 'bg-rose-50 text-rose-700 border-rose-200':'bg-sky-50 text-sky-700 border-sky-200'}`}>Balance <strong className="ml-1">{Number(summary.balance||0).toLocaleString()}</strong></span>
            {invoices.some(inv => inv.status==='unpaid' || inv.status==='partial') && (
              <button
                onClick={()=>{
                  const unpaid = invoices.filter(inv => inv.status==='unpaid' || inv.status==='partial')
                  setSelectedInvoice(unpaid[0] || null)
                  setPayForm({ amount: '', method: 'mpesa', reference: '' })
                  setPayError('')
                  setShowPay(true)
                }}
                className="ml-auto px-3 py-1.5 rounded text-white bg-green-600 hover:bg-green-700"
              >
                Make Payment
              </button>
            )}
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-gray-600 bg-gray-50">You have no invoices yet.</div>
        ) : (
          <div className="overflow-auto rounded-lg border">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2">Year/Term</th>
                  <th className="py-2 px-2">Amount</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Due</th>
                  <th className="py-2 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-t hover:bg-gray-50/60">
                    <td className="py-2 px-2">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="py-2 px-2">{inv.category_detail?.name || '-'}</td>
                    <td className="py-2 px-2">{inv.year ? `${inv.year} / T${inv.term}` : '-'}</td>
                    <td className="py-2 px-2">{Number(inv.amount).toLocaleString()}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${inv.status==='paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : inv.status==='partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{inv.status}</span>
                    </td>
                    <td className="py-2 px-2">{inv.due_date || '-'}</td>
                    <td className="py-2 px-2 text-right">
                      {(inv.status === 'unpaid' || inv.status === 'partial') && (
                        <button onClick={()=>openPay(inv)} className="px-3 py-1.5 rounded text-white bg-green-600 hover:bg-green-700">Pay</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Pay Modal */}
      <Modal open={showPay} onClose={()=>setShowPay(false)} title={selectedInvoice ? `Pay Invoice #${selectedInvoice.id}` : 'Pay Invoice'} size="sm">
        {selectedInvoice && (
          <form onSubmit={submitPay} className="grid gap-3">
            {/* Allow selecting which invoice to pay when multiple invoices are due */}
            {invoices.filter(inv => inv.status==='unpaid' || inv.status==='partial').length > 1 && (
              <select
                className="border p-2 rounded"
                value={selectedInvoice?.id || ''}
                onChange={e => {
                  const inv = invoices.find(x => String(x.id) === e.target.value)
                  setSelectedInvoice(inv || selectedInvoice)
                }}
              >
                {invoices.filter(inv => inv.status==='unpaid' || inv.status==='partial').map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {(inv.category_detail?.name || 'General')} — {inv.year? `${inv.year}/T${inv.term}`:'-'} — {Number(inv.amount).toLocaleString()} ({inv.status})
                  </option>
                ))}
              </select>
            )}
            <div className="text-sm text-gray-700">Category: <strong>{selectedInvoice.category_detail?.name || '-'}</strong></div>
            <div className="text-sm text-gray-700">Amount Due: <strong>{Number(selectedInvoice.amount).toLocaleString()}</strong></div>
            {payError && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{payError}</div>}
            <input className="border p-2 rounded" type="number" step="0.01" placeholder="Amount" value={payForm.amount} onChange={e=>setPayForm({...payForm, amount:e.target.value})} required />
            {/* Mode selection removed: always use M-Pesa STK via Co-op */}
            <input className="border p-2 rounded" placeholder="Phone 07XXXXXXXX" value={payForm.phone} onChange={e=>setPayForm({...payForm, phone:e.target.value})} />
            {/* Always real STK; toggle removed */}
            {stkStatus==='failed' && (<div className="text-xs text-red-600">STK failed or timed out.</div>)}
            <input className="border p-2 rounded" placeholder="Reference (optional)" value={payForm.reference} onChange={e=>setPayForm({...payForm, reference:e.target.value})} />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded border" onClick={()=>setShowPay(false)}>Cancel</button>
              <button className="px-4 py-2 rounded text-white bg-green-600 disabled:opacity-60" disabled={paySubmitting}>{paySubmitting ? (stkStatus==='polling'?'Waiting...':'Initiating...') : 'Initiate STK'}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit Contact Modal */}
      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title="Edit Contact Details" size="sm">
        <form
          onSubmit={async (e)=>{
            e.preventDefault()
            setEditSubmitting(true)
            setEditError('')
            try{
              const payload = {
                email: editForm.email?.trim() || '',
                phone: editForm.phone?.trim() || '',
                address: editForm.address?.trim() || '',
              }
              // Basic client validation
              if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)){
                setEditError('Enter a valid email address')
                setEditSubmitting(false)
                return
              }
              await api.patch('/academics/students/my/update/', payload)
              // Refresh student data
              const stRes = await api.get('/academics/students/my/')
              setStudent(stRes.data)
              setShowEdit(false)
            }catch(err){
              setEditError(err?.response?.data?.detail || err?.message || 'Update failed')
            }finally{
              setEditSubmitting(false)
            }
          }}
          className="grid gap-3"
        >
          {editError && <div className="bg-red-50 text-red-700 text-sm p-2 rounded">{editError}</div>}
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600">Email</span>
            <input className="border p-2 rounded" type="email" value={editForm.email} onChange={e=>setEditForm({...editForm, email:e.target.value})} placeholder="e.g. student@email.com" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600">Parent/Guardian Phone</span>
            <input className="border p-2 rounded" value={editForm.phone} onChange={e=>setEditForm({...editForm, phone:e.target.value})} placeholder="Enter parent/guardian phone e.g. 0712345678" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600">Postal Address</span>
            <textarea className="border p-2 rounded min-h-[80px]" value={editForm.address} onChange={e=>setEditForm({...editForm, address:e.target.value})} placeholder="e.g. P.O. Box 12345, Nairobi" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded border" onClick={()=>setShowEdit(false)}>Cancel</button>
            <button className="px-4 py-2 rounded text-white bg-blue-600 disabled:opacity-60" disabled={editSubmitting}>{editSubmitting? 'Saving…':'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Report Card Modal */}
      <Modal open={showReport} onClose={()=>setShowReport(false)} title={latestExamLabel ? `Report Card — ${latestExamLabel}` : 'Report Card'} size="md">
        {reportRows.length === 0 ? (
          <div className="text-sm text-gray-600">No results available yet.</div>
        ) : (
          <div className="grid gap-3">
            <table className="w-full text-left text-sm">
              <thead>
                <tr><th>Subject</th><th>Marks</th></tr>
              </thead>
              <tbody>
                {reportRows.map((row, i) => (
                  <tr key={i} className="border-t"><td>{row.subjectLabel}</td><td>{row.marks}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium"><td>Total</td><td>{reportTotals.total.toFixed(2)}</td></tr>
                <tr className="font-medium"><td>Average</td><td>{reportTotals.average.toFixed(2)}</td></tr>
              </tfoot>
            </table>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded border" onClick={()=>setShowReport(false)}>Close</button>
              <button
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={()=>{
                  try{ window.print() }catch(_){}
                }}
              >Print</button>
            </div>
          </div>
        )}
      </Modal>
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
