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

  const calendarDays = useMemo(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = endOfMonth.getDate()
    const startWeekday = startOfMonth.getDay() // 0-6, Sun-Sat
    const days = []
    // pad leading blanks
    for (let i = 0; i < startWeekday; i++) {
      days.push({ key: `blank-${i}`, label: '', isToday: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate()
      days.push({ key: `d-${d}`, label: String(d), isToday })
    }
    return {
      monthLabel: today.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      days,
    }
  }, [])

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

  const paymentsOverTime = useMemo(() => {
    if (!Array.isArray(invoices) || invoices.length === 0) return []
    const buckets = new Map()
    for (const inv of invoices) {
      const rawDate = inv.paid_at || inv.updated_at || inv.date || inv.due_date || inv.created || inv.created_at
      if (!rawDate) continue
      const d = new Date(rawDate)
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue
      const key = d.toISOString().slice(0, 10)
      const amount = Number(
        inv.amount_paid ??
        inv.paid_amount ??
        inv.total_paid ??
        inv.amount ??
        0
      )
      if (!amount) continue
      buckets.set(key, (buckets.get(key) || 0) + amount)
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, total]) => ({ label, avg: total }))
  }, [invoices])

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

  async function submitEdit(e){
    e?.preventDefault?.()
    if (!student) return
    try {
      setEditSubmitting(true)
      setEditError('')
      const payload = {
        email: editForm.email,
        guardian_id: editForm.phone,
        address: editForm.address,
      }
      await api.patch(`/academics/students/${student.id}/`, payload)
      const { data } = await api.get('/academics/students/my/')
      setStudent(data)
      setShowEdit(false)
    } catch (err) {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed to update contact details')
      setEditError(msg)
    } finally {
      setEditSubmitting(false)
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

      {loading && <div className="-mx-3 sm:mx-0 bg-white sm:rounded-xl shadow p-3 sm:p-4">Loading...</div>}
      {error && <div className="-mx-3 sm:mx-0 bg-red-50 text-red-700 p-3 sm:p-3 rounded-none sm:rounded">{error}</div>}

  {currentTab === 'dashboard' && (
    <div className="-mx-3 sm:mx-0 bg-white/95 backdrop-blur-xl border border-slate-200/70 shadow-[0_18px_45px_rgba(15,23,42,0.08)] rounded-none sm:rounded-3xl pt-4 pb-6 px-4 sm:p-6">
      <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-1">Overview</h2>
      <p className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Dashboard</p>

      <div className="mt-1 grid gap-4 lg:gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_minmax(260px,1fr)]">
        {/* Column 1: Fees summary */}
        <div className="space-y-4 order-1">
          {/* Fees / balance summary */}
          <div className="space-y-2.5">
            {/* Balance - primary card (compact) */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md px-3 py-2.5 active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 text-white text-lg">
                💰
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">Balance</div>
                <div className="text-xl font-semibold tracking-tight truncate">{money(Number(summary.balance || 0))}</div>
              </div>
            </div>

            {/* Total Billed */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-white shadow-sm border border-slate-200 px-3 py-2.5 active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-lg">
                🧾
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Billed</div>
                <div className="text-base font-semibold text-slate-900 truncate">{money(Number(summary.total_billed || 0))}</div>
              </div>
            </div>

            {/* Total Paid */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-white shadow-sm border border-slate-200 px-3 py-2.5 active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-lg">
                💳
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Paid</div>
                <div className="text-base font-semibold text-slate-900 truncate">{money(Number(summary.total_paid || 0))}</div>
              </div>
              {summary.total_paid && summary.total_billed ? (
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {Math.round((summary.total_paid / Math.max(1, summary.total_billed)) * 100)}%
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Column 2: Personal details + performance graph + latest exam summary */}
        <div className="space-y-4 order-3 lg:order-2">
          {student && (
            <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Profile</div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Personal details</h2>
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
              <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-5">
                <section className="space-y-3">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
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
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 tracking-[0.18em] uppercase">Contact & guardian</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-slate-50/80">
                      <div className="text-slate-500">Email</div>
                      <div className="font-medium text-slate-900 break-words">{student.email || '-'}</div>
                    </div>
                    <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-slate-50/80">
                      <div className="text-slate-500">Parent/Guardian Phone</div>
                      <div className="font-medium text-slate-900">{student.guardian_id || '-'}</div>
                    </div>
                    <div className="sm:col-span-2 p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-slate-50/80">
                      <div className="text-slate-500">Postal Address</div>
                      <div className="font-medium text-slate-900">{student.address || '-'}</div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* Performance graph */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Performance graph</h3>
              {latestExamLabel && (
                <span className="text-xs text-slate-500">Latest: {latestExamLabel}</span>
              )}
            </div>
            {Array.isArray(performance) && performance.length > 0 ? (
              <ResponsiveLine data={performance} />
            ) : (
              <div className="text-sm text-slate-500">No exam performance data yet.</div>
            )}
          </div>

          {/* Latest exam summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Latest exam summary</h3>
            <p className="text-xs text-slate-500 mb-3">Quick snapshot of your most recent published exam.</p>
            {latestExamLabel ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Exam</span>
                  <span className="font-medium text-slate-900">{latestExamLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Average mark</span>
                  <span className="font-semibold text-emerald-600">{reportTotals.average.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Subjects</span>
                  <span className="font-medium text-slate-900">{reportRows.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Position (latest exam)</span>
                  <span className="font-medium text-slate-900">-</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Your latest exam summary will appear here once results are published.</div>
            )}
          </div>
        </div>

        {/* Column 3: Photo + calendar */}
        <div className="space-y-4 order-2 lg:order-3">
          {student && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col items-center text-center gap-3">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-white/60 flex items-center justify-center">
                {student.photo_url ? (
                  <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-slate-300 text-5xl">👤</div>
                )}
              </div>
              {student.admission_no && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200">
                  <span className="text-base" aria-hidden>🆔</span>
                  {student.admission_no}
                </span>
              )}
              {classLabel && (
                <div className="text-xs text-slate-600 font-medium">{classLabel}</div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900">Calendar</h3>
              <span className="text-xs text-slate-500">{calendarDays.monthLabel}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 mb-1">
              {['S','M','T','W','T','F','S'].map(d => (
                <div key={d} className="text-center font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {calendarDays.days.map(day => (
                <div
                  key={day.key}
                  className={`h-7 flex items-center justify-center rounded-full ${day.label
                    ? day.isToday
                      ? 'bg-violet-600 text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                    : ''}`}
                >
                  {day.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {currentTab === 'finance' && (
    <div className="-mx-3 sm:mx-0 bg-white/95 backdrop-blur-xl border border-slate-200/70 shadow-[0_18px_45px_rgba(15,23,42,0.08)] rounded-none sm:rounded-3xl pt-4 pb-6 px-4 sm:p-6">
      <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-1">Finance</h2>
      <p className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Fees & payments</p>

      {/* Summary row */}
      <div className="grid md:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md px-3 py-3 flex flex-col justify-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">Balance</span>
          <span className="text-xl font-semibold tracking-tight">{money(Number(summary.balance || 0))}</span>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 px-3 py-3 flex flex-col justify-center">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total billed</span>
          <span className="text-base font-semibold text-slate-900">{money(Number(summary.total_billed || 0))}</span>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 px-3 py-3 flex flex-col justify-center">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total paid</span>
          <span className="text-base font-semibold text-slate-900">{money(Number(summary.total_paid || 0))}</span>
        </div>
      </div>

      {/* Invoices list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Invoices</h3>
          <span className="text-xs text-slate-500">{Array.isArray(invoices) ? invoices.length : 0} record(s)</span>
        </div>
        {Array.isArray(invoices) && invoices.length > 0 ? (
          <div className="space-y-2 text-sm max-h-72 overflow-y-auto">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/80">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{inv.reference || `Invoice #${inv.id}`}</div>
                  <div className="text-xs text-slate-500 truncate">{inv.description || inv.term_label || ''}</div>
                </div>
                <div className="text-right ml-3">
                  <div className="text-sm font-semibold text-slate-900">{money(inv.balance || inv.amount || 0)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">{inv.status || 'unpaid'}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">You have no invoices yet. New invoices will appear here.</div>
        )}
      </div>

      {/* Payments over time graph */}
      <div className="mt-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Payments over time</h3>
        </div>
        {Array.isArray(paymentsOverTime) && paymentsOverTime.length > 0 ? (
          <ResponsiveLine data={paymentsOverTime} />
        ) : (
          <div className="text-sm text-slate-500">No payments recorded yet. Once you start paying invoices, a trend will appear here.</div>
        )}
      </div>
    </div>
  )}

  {currentTab === 'academics' && (
    <div className="-mx-3 sm:mx-0 bg-white/95 backdrop-blur-xl border border-slate-200/70 shadow-[0_18px_45px_rgba(15,23,42,0.08)] rounded-none sm:rounded-3xl pt-4 pb-6 px-4 sm:p-6">
      <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-1">Performance</h2>
      <p className="text-base sm:text-lg font-semibold text-slate-900 mb-3">Academics</p>
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
  
  <Modal open={showEdit} onClose={() => (!editSubmitting && setShowEdit(false))} title="Update contact details" size="sm">
    <form onSubmit={submitEdit} className="space-y-4">
      {editError && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">{editError}</div>
      )}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          value={editForm.email}
          onChange={e => setEditForm({ ...editForm, email: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Parent/Guardian Phone</label>
        <input
          type="text"
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          value={editForm.phone}
          onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Postal Address</label>
        <textarea
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm min-h-[72px]"
          value={editForm.address}
          onChange={e => setEditForm({ ...editForm, address: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          className="px-4 py-1.5 rounded border text-sm"
          onClick={() => !editSubmitting && setShowEdit(false)}
          disabled={editSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 rounded bg-slate-900 text-white text-sm disabled:opacity-60"
          disabled={editSubmitting}
        >
          {editSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
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
