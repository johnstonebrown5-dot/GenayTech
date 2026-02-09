import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import StatCard from '../components/StatCard'

let __studentDashboardCache = null

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
  const [paySimulate, setPaySimulate] = useState(true)
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

  // Build fee statement rows from invoices and their embedded payments
  const feeStatement = useMemo(() => {
    try {
      const rows = []
      const list = Array.isArray(invoices) ? invoices : (invoices?.results || [])
      for (const inv of list) {
        const invDate = inv.created_at || inv.due_date || inv.date || inv.updated_at
        rows.push({
          type: 'invoice',
          date: invDate,
          ref: inv.reference || `Invoice #${inv.id}`,
          description: inv.description || inv.term_label || (inv.category_detail?.name || 'Tuition'),
          debit: Number(inv.amount || 0),
          credit: 0,
          status: inv.status || 'unpaid',
        })
        const pays = Array.isArray(inv.payments) ? inv.payments : []
        for (const p of pays) {
          rows.push({
            type: 'payment',
            date: p.created_at,
            ref: p.reference || `PAY-${p.id}`,
            description: `Payment (${String(p.method || '').toUpperCase()})`,
            debit: 0,
            credit: Number(p.amount || 0),
            status: 'payment',
          })
        }
      }
      // Sort by date ascending
      rows.sort((a,b)=>{
        const da = new Date(a.date||0).getTime() || 0
        const db = new Date(b.date||0).getTime() || 0
        if (da !== db) return da - db
        // Ensure payments come after invoice on same timestamp
        if (a.type !== b.type) return a.type === 'invoice' ? -1 : 1
        return 0
      })
      // Running balance: debit increases, credit decreases
      let balance = 0
      return rows.map(r => {
        balance = balance + (Number(r.debit||0)) - (Number(r.credit||0))
        return { ...r, balance }
      })
    } catch { return [] }
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

    const ensureCache = () => {
      if (!__studentDashboardCache) {
        __studentDashboardCache = {
          baseLoaded: false,
          academicsLoaded: false,
          financeLoaded: false,
          student: null,
          assessments: [],
          attendance: [],
          examResults: [],
          invoices: [],
          summary: { total_billed: 0, total_paid: 0, balance: 0 },
        }
      }
      return __studentDashboardCache
    }

    const hydrateFromCache = (c) => {
      setStudent(c.student || null)
      setAssessments(c.assessments || [])
      setAttendance(c.attendance || [])
      setExamResults(c.examResults || [])
      setInvoices(c.invoices || [])
      setSummary(c.summary || { total_billed: 0, total_paid: 0, balance: 0 })
    }

    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const c = ensureCache()

        // 1) Base student record (required for dashboard/profile + academics)
        // Finance tab should not be blocked by this call.
        if (!c.baseLoaded && currentTab !== 'finance') {
          const stRes = await api.get('/academics/students/my/')
          if (!mounted) return
          c.student = stRes.data
          c.baseLoaded = true
        }

        // Hydrate UI immediately from cache before optional tab-specific fetches.
        hydrateFromCache(c)

        // 2) Tab-specific data loads once per tab (only when user opens that tab)
        if (currentTab === 'academics' && !c.academicsLoaded) {
          const stId = c.student?.id
          const settled = await Promise.allSettled([
            api.get('/academics/assessments/my/'),
            api.get('/academics/attendance/my/'),
            stId ? api.get(`/academics/exam_results/?student=${stId}`) : Promise.resolve({ data: [] }),
          ])
          if (!mounted) return
          const [assS, attS, exmS] = settled
          c.assessments = assS.status==='fulfilled' ? (Array.isArray(assS.value?.data) ? assS.value.data : (assS.value?.data?.results || [])) : []
          c.attendance = attS.status==='fulfilled' ? (Array.isArray(attS.value?.data) ? attS.value.data : (attS.value?.data?.results || [])) : []
          c.examResults = exmS.status==='fulfilled' ? (Array.isArray(exmS.value?.data) ? exmS.value.data : (exmS.value?.data?.results || [])) : []
          c.academicsLoaded = true
          hydrateFromCache(c)
        }

        if (currentTab === 'finance' && !c.financeLoaded) {
          const settled = await Promise.allSettled([
            api.get('/finance/invoices/my/'),
            api.get('/finance/invoices/my-summary/'),
          ])
          if (!mounted) return
          const [invS, sumS] = settled
          c.invoices = invS.status==='fulfilled' ? (Array.isArray(invS.value?.data) ? invS.value.data : (invS.value?.data?.results || [])) : []
          c.summary = sumS.status==='fulfilled' ? (sumS.value?.data || { total_billed:0, total_paid:0, balance:0 }) : { total_billed:0, total_paid:0, balance:0 }
          c.financeLoaded = true
          hydrateFromCache(c)
        }
      } catch (e) {
        if (!mounted) return
        // Only block page when we cannot load the student record (non-finance tabs).
        if (currentTab !== 'finance') {
          setError(e?.response?.data?.detail || e?.message || 'Failed to load your profile')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [currentTab])

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
    setPayForm({ amount: '', method: 'mpesa', reference: '', phone: '' })
    setPayError('')
    setPaySimulate(true)
    setShowPay(true)
  }

  const submitPay = async (e) => {
    e.preventDefault()
    setPaySubmitting(true)
    setPayError('')
    try {
      const payload = { amount: parseFloat(payForm.amount || 0), method: payForm.method, reference: payForm.reference }
      if (!payload.amount || isNaN(payload.amount) || payload.amount <= 0) {
        setPayError('Enter a valid amount greater than 0')
        setPaySubmitting(false)
        return
      }
      // If M-Pesa, run STK via Co-op instead of manual recording.
      // Now support paying overall balance (no specific invoice) using pay_balance_stk.
      if (String(payForm.method).toLowerCase()==='mpesa'){
        if (!payForm.phone) { setPayError('Phone number required for STK'); setPaySubmitting(false); return }
        setStkStatus('initiating')
        // Baseline: overall summary before push (avoid blocking when already available)
        let beforeBalance = Number(summary?.balance || 0)
        if (!Number.isFinite(beforeBalance) || beforeBalance === 0) {
          try {
            const beforeSumRes = await api.get('/finance/invoices/my-summary/', { timeout: 15000 })
            beforeBalance = Number(beforeSumRes?.data?.balance || beforeBalance || 0)
          } catch {}
        }
        // Normalize phone: 07XXXXXXXX -> 2547XXXXXXXX; accept +2547XXXXXXXX
        let phone = String(payForm.phone).trim()
        if (phone.startsWith('+')) phone = phone.slice(1)
        if (phone.startsWith('0') && phone.length === 10) phone = '254' + phone.slice(1)
        // Use balance STK endpoint (no invoice required)
        await api.post('/finance/invoices/pay_balance_stk/', {
          phone,
          amount: payload.amount,
          simulate: paySimulate,
        })
        setStkStatus('sent')
        setShowPay(false)
        setPaySubmitting(false)

        // Poll in the background (do not block UI). Stop once balance changes or after a short timeout.
        setStkStatus('polling')
        ;(async () => {
          const started = Date.now()
          let updated = false
          while (Date.now() - started < 25000) {
            await new Promise(r=>setTimeout(r, 2500))
            let pollSum
            try {
              pollSum = await api.get('/finance/invoices/my-summary/', { timeout: 15000, _skipGlobalLoading: true })
            } catch {
              continue
            }
            const nowBal = Number(pollSum?.data?.balance)
            if (Number.isFinite(nowBal) && nowBal !== beforeBalance) { updated = true; break }
          }

          if (!updated) {
            setStkStatus('sent')
            return
          }

          try {
            const [invRes, sumRes] = await Promise.all([
              api.get('/finance/invoices/my/', { timeout: 20000, _skipGlobalLoading: true }),
              api.get('/finance/invoices/my-summary/', { timeout: 20000, _skipGlobalLoading: true }),
            ])
            const inv = (Array.isArray(invRes?.data) ? invRes.data : (invRes?.data?.results || []))
            const sum = sumRes?.data || { total_billed: 0, total_paid: 0, balance: 0 }
            setInvoices(inv)
            setSummary(sum)
            if (__studentDashboardCache) {
              __studentDashboardCache.invoices = inv
              __studentDashboardCache.summary = sum
              __studentDashboardCache.financeLoaded = true
            }
          } catch {}

          setStkStatus('success')
        })()

        return
      } else {
        if (!selectedInvoice) { setPayError('Please select an invoice'); setPaySubmitting(false); return }
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
      try{
        const raw = err?.response?.data
        const msg = typeof raw === 'string' ? raw.replace(/<[^>]+>/g,'').slice(0,300) : (raw?.detail || err?.message)
        setPayError(msg || 'Payment failed')
      }catch{
        setPayError(err?.message || 'Payment failed')
      }
    } finally {
      setPaySubmitting(false)
    }
  }

  return (
    <div className="px-3 sm:px-6 py-4 space-y-5 sm:space-y-7">

      {loading && <div className="bg-white sm:rounded-xl shadow p-3 sm:p-4">Loading...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 sm:p-3 rounded sm:rounded">{error}</div>}

  {currentTab === 'dashboard' && (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-green-600 text-white rounded shadow p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div className="font-medium break-words">Welcome {student?.name ? String(student.name).toUpperCase() : ''}</div>
        <div className="text-xs opacity-90">Dashboard</div>
      </div>

      {/* Quick actions removed as per request */}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-amber-500 text-white rounded shadow p-3 sm:p-4">
          <div className="text-xs sm:text-sm opacity-90">Total Billed</div>
          <div className="text-xl sm:text-2xl font-semibold">{money(summary.total_billed)}</div>
          <div className="text-[10px] sm:text-xs mt-1 opacity-90">All time invoiced</div>
        </div>
        <div className="bg-green-600 text-white rounded shadow p-3 sm:p-4">
          <div className="text-xs sm:text-sm opacity-90">Total Paid</div>
          <div className="text-xl sm:text-2xl font-semibold">{money(summary.total_paid)}</div>
          <div className="text-[10px] sm:text-xs mt-1 opacity-90">All time payments</div>
        </div>
        <div className="bg-sky-600 text-white rounded shadow p-3 sm:p-4">
          <div className="text-xs sm:text-sm opacity-90">Balance</div>
          <div className="text-xl sm:text-2xl font-semibold">{money(summary.balance)}</div>
          <div className="text-[10px] sm:text-xs mt-1 opacity-90">Outstanding</div>
        </div>
      </div>

      {/* User Profile */}
      {student && (
        <div className="bg-white rounded shadow p-0 overflow-hidden">
          <div className="border-b px-4 py-2 font-medium flex items-center justify-between">
            <span>User Profile</span>
            <button
              onClick={() => { setEditError(''); setEditForm({ email: student.email || '', phone: student.guardian_id || '', address: student.address || '' }); setShowEdit(true) }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-xs"
              title="Edit Details"
            >
              <span>✏️</span>
              <span className="hidden sm:inline">Edit</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            <div className="p-4 md:border-r flex flex-col sm:flex-row md:flex-col items-center sm:items-start gap-4">
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 bg-gray-100 rounded overflow-hidden flex items-center justify-center shrink-0">
                {student.photo_url ? (
                  <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-400 text-6xl">👤</div>
                )}
              </div>
              {student.admission_no && (
                <div className="text-sm text-gray-600 break-words">{student.admission_no}</div>
              )}
            </div>
            <div className="md:col-span-2 p-4">
              <div className="text-gray-700 font-medium mb-3">Personal Information</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <div className="text-gray-500">Full Name</div>
                  <div className="font-medium uppercase">{student.name}</div>
                </div>
                <div>
                  <div className="text-gray-500">Phone Number</div>
                  <div className="font-medium">{student.guardian_id || '-'}</div>
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
                  <div className="font-medium">{student.dob || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Class</div>
                  <div className="font-medium">{classLabel}</div>
                </div>
                <div>
                  <div className="text-gray-500">Passport No</div>
                  <div className="font-medium">{student.passport_no || '-'}</div>
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

      {/* Assessments & Attendance */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-medium mb-2">Assessments</h2>
          {!Array.isArray(assessments) || assessments.length === 0 ? (
            <div className="text-sm text-gray-500">No assessments yet.</div>
          ) : (
            <>
              <div className="grid gap-2 sm:hidden">
                {assessments.map(a => (
                  <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="font-medium text-slate-900 break-words">{a.competency}</div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-600">
                      <span className="shrink-0">Level: <span className="font-medium text-slate-800">{a.level}</span></span>
                      <span className="whitespace-nowrap">{a.date}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[520px]">
                  <thead>
                    <tr>
                      <th>Competency</th>
                      <th>Level</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map(a => (
                      <tr key={a.id} className="border-top border-t">
                        <td className="py-2 pr-3">{a.competency}</td>
                        <td className="py-2 pr-3">{a.level}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{a.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-medium mb-2">Attendance</h2>
          {!Array.isArray(attendance) || attendance.length === 0 ? (
            <div className="text-sm text-gray-500">No attendance records yet.</div>
          ) : (
            <>
              <div className="grid gap-2 sm:hidden">
                {attendance.map(at => (
                  <div key={at.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-900 whitespace-nowrap">{at.date}</div>
                    <div className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 capitalize whitespace-nowrap">{at.status}</div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[360px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map(at => (
                      <tr key={at.id} className="border-t">
                        <td className="py-2 pr-3 whitespace-nowrap">{at.date}</td>
                        <td className="py-2 pr-3 capitalize">{at.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )}

  {currentTab === 'finance' && (
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/70 shadow-[0_18px_45px_rgba(15,23,42,0.08)] rounded-3xl pt-4 pb-6 px-4 sm:p-6">
      <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-1">Finance</h2>
      <p className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Fees & payments</p>

      {/* Printable Fee Statement */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5" id="fee-statement">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Fee Statement</h3>
          <div className="flex items-center gap-2">
            <button
              className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 print:hidden"
              onClick={() => {
                try{
                  const list = Array.isArray(invoices) ? invoices : (invoices?.results || [])
                  const unpaid = list.find(inv => String(inv.status||'').toLowerCase() !== 'paid') || list[0]
                  if (unpaid) setSelectedInvoice(unpaid)
                }catch{}
                setPayForm({ amount: '', method: 'mpesa', reference: '', phone: '' })
                setPayError('')
                setShowPay(true)
              }}
            >Pay Fees</button>
            <button
              className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 print:hidden"
              onClick={() => { try { window.print() } catch {} }}
            >
              Print
            </button>
          </div>
        </div>
        {Array.isArray(feeStatement) && feeStatement.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2 text-right">Debit</th>
                  <th className="px-2 py-2 text-right">Credit</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {feeStatement.map((r, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-2 py-2 whitespace-nowrap">{r.date ? String(r.date).slice(0,10) : '-'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{r.ref}</td>
                    <td className="px-2 py-2">{r.description}</td>
                    <td className="px-2 py-2 text-right">{r.debit ? money(r.debit) : ''}</td>
                    <td className="px-2 py-2 text-right">{r.credit ? money(r.credit) : ''}</td>
                    <td className={`px-2 py-2 text-right font-medium ${r.type==='payment' ? 'text-emerald-700' : 'text-slate-900'}`}>{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-500">No transactions yet. Your detailed statement will appear here.</div>
        )}
        {/* Minimal print styles to focus on statement */}
        <style>{`@media print{ body *{ visibility:hidden } #fee-statement, #fee-statement *{ visibility:visible } #fee-statement{ position:absolute; left:0; top:0; width:100% } }`}</style>
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
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/70 shadow-[0_18px_45px_rgba(15,23,42,0.08)] rounded-3xl pt-4 pb-6 px-4 sm:p-6">
      <h2 className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase mb-1">Performance</h2>
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg sm:text-xl font-semibold text-slate-900">Academics</p>
        <button
          className="text-xs sm:text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          onClick={() => latestExamLabel ? navigate('/student/report-card') : null}
          disabled={!latestExamLabel}
        >{latestExamLabel ? 'Open Report Card' : 'No Exam Yet'}</button>
      </div>

      {/* Exams list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Exams</h2>
          {latestExamLabel && <span className="text-xs text-slate-500">Latest: {latestExamLabel}</span>}
        </div>
        {Array.isArray(groupedExamResults) && groupedExamResults.length > 0 ? (
          <>
            {/* Mobile cards */}
            <div className="grid gap-2 sm:hidden">
              {groupedExamResults.map(([name, rows]) => {
                const total = rows.reduce((s,r)=> s + Number(r.marks||0), 0)
                const avg = rows.length ? (total / rows.length) : 0
                const badge = avg >= 75 ? 'bg-emerald-100 text-emerald-700' : avg >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                return (
                  <div key={name} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-500">Subjects • {rows.length}</div>
                    </div>
                    <span className={`ml-3 text-xs px-2 py-1 rounded-full ${badge}`}>{avg.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="py-2 px-3">Exam</th>
                    <th className="py-2 px-3">Subjects</th>
                    <th className="py-2 px-3">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedExamResults.map(([name, rows]) => {
                    const total = rows.reduce((s,r)=> s + Number(r.marks||0), 0)
                    const avg = rows.length ? (total / rows.length) : 0
                    const badge = avg >= 75 ? 'bg-emerald-100 text-emerald-700' : avg >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    return (
                      <tr key={name} className="border-t hover:bg-slate-50">
                        <td className="py-2 px-3 whitespace-nowrap">{name}</td>
                        <td className="py-2 px-3">{rows.length}</td>
                        <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded-full text-xs ${badge}`}>{avg.toFixed(1)}%</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-500">No exams yet.</div>
        )}
      </div>

      {/* Attendance */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
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

      {/* Performance chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
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

  <Modal open={showPay} onClose={() => (!paySubmitting && setShowPay(false))} title="Pay Fees" size="sm">
    <form onSubmit={submitPay} className="space-y-3">
      {payError && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">{payError}</div>
      )}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Amount</label>
        <input
          type="number"
          step="0.01"
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          value={payForm.amount}
          onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
          placeholder="Enter amount"
        />
      </div>
      <div className="space-y-1">
        <div className="text-xs text-slate-600 mb-1">Phone (M-Pesa)</div>
        <input
          type="tel"
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          value={payForm.phone}
          onChange={e => setPayForm({ ...payForm, phone: e.target.value })}
          placeholder="07XXXXXXXX or 2547XXXXXXXX"
          inputMode="tel"
          pattern="^(0[0-9]{9}|\\+?2547[0-9]{8})$"
        />
      </div>
      <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
        <span>Method: M-Pesa STK</span>
        {stkStatus !== 'idle' && <span>Status: {stkStatus}</span>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="px-4 py-1.5 rounded border text-sm" onClick={() => !paySubmitting && setShowPay(false)} disabled={paySubmitting}>Cancel</button>
        <button
          type="submit"
          className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm disabled:opacity-60"
          disabled={paySubmitting || !(Number(payForm.amount) > 0 && /^(0[0-9]{9}|\+?2547[0-9]{8})$/.test(String(payForm.phone||'').trim()))}
        >
          {paySubmitting ? 'Processing…' : 'Pay Now'}
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
