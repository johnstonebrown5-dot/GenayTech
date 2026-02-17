import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../auth'
import Modal from '../components/Modal'
import StatCard from '../components/StatCard'
import StudentReportCardViewer from './StudentReportCardViewer'

let __studentDashboardCache = null

function Skeleton({ className = '' }){
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />
}

export default function StudentDashboard(){
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [schoolInfo, setSchoolInfo] = useState(null)
  const { user: authUser } = useAuth()
  const [personalInfoOpen, setPersonalInfoOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 640
  })
  const [openExam, setOpenExam] = useState(null)
  const [examSearchOpen, setExamSearchOpen] = useState(false)
  const [examQuery, setExamQuery] = useState('')
  const [printExamId, setPrintExamId] = useState(null)
  const [academicsSubTab, setAcademicsSubTab] = useState('exams') // 'exams' or 'reports'
  const [financeSubTab, setFinanceSubTab] = useState('statement') // 'statement' or 'reports'
  const [assessments, setAssessments] = useState([])
  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invoices, setInvoices] = useState([])
  const [summary, setSummary] = useState({ total_billed: 0, total_paid: 0, balance: 0 })
  const [financeDetailsOpen, setFinanceDetailsOpen] = useState(false)
  const [financeDetailsMode, setFinanceDetailsMode] = useState('invoices')
  const [refreshingFinance, setRefreshingFinance] = useState(false)
  const [refreshingAcademics, setRefreshingAcademics] = useState(false)
  const [statementFilter, setStatementFilter] = useState('all') // all | invoice | payment
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

  useEffect(() => {
    if (currentTab !== 'academics') return
    if (openExam) return
    if (!latestExamLabel) return
    setOpenExam(latestExamLabel)
  }, [currentTab, latestExamLabel, openExam])

  useEffect(() => {
    if (!printExamId) return
    let alive = true
    const onAfter = () => {
      if (!alive) return
      setPrintExamId(null)
    }
    try { window.addEventListener('afterprint', onAfter) } catch {}
    const t = setTimeout(() => {
      try { window.print() } catch {}
      // Fallback cleanup if afterprint doesn't fire
      setTimeout(() => { if (alive) setPrintExamId(null) }, 1200)
    }, 60)
    return () => {
      alive = false
      clearTimeout(t)
      try { window.removeEventListener('afterprint', onAfter) } catch {}
    }
  }, [printExamId])

  const examDomId = (name) => {
    const raw = String(name || '')
    const safe = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    return `exam-report-${safe || 'unknown'}`
  }

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

  const transactionPillClasses = (r) => {
    if (r?.type !== 'payment') return 'bg-slate-50 text-slate-700 border-slate-200'
    const m = String(r?.method || '').toLowerCase()
    if (m.includes('mpesa') || m.includes('m-pesa')) return 'bg-emerald-50 text-emerald-700 border-emerald-100'
    if (m.includes('cash')) return 'bg-amber-50 text-amber-800 border-amber-100'
    if (m.includes('bank') || m.includes('transfer')) return 'bg-sky-50 text-sky-700 border-sky-100'
    if (m.includes('card') || m.includes('visa') || m.includes('master')) return 'bg-purple-50 text-purple-700 border-purple-100'
    return 'bg-indigo-50 text-indigo-700 border-indigo-100'
  }

  const transactionRowAccentClasses = (r) => {
    if (r?.type !== 'payment') return 'border-slate-200'
    const m = String(r?.method || '').toLowerCase()
    if (m.includes('mpesa') || m.includes('m-pesa')) return 'border-emerald-200'
    if (m.includes('cash')) return 'border-amber-200'
    if (m.includes('bank') || m.includes('transfer')) return 'border-sky-200'
    if (m.includes('card') || m.includes('visa') || m.includes('master')) return 'border-purple-200'
    return 'border-indigo-200'
  }

  const invoiceRows = useMemo(() => {
    const list = Array.isArray(invoices) ? invoices : (invoices?.results || [])
    return list.map(inv => ({
      id: inv.id,
      date: inv.created_at || inv.due_date || inv.date || inv.updated_at,
      reference: inv.reference || `Invoice #${inv.id}`,
      description: inv.description || inv.term_label || (inv.category_detail?.name || 'Invoice'),
      amount: Number(inv.amount || 0),
      status: inv.status || 'unpaid',
    }))
  }, [invoices])

  const paymentRows = useMemo(() => {
    const list = Array.isArray(invoices) ? invoices : (invoices?.results || [])
    const rows = []
    for (const inv of list) {
      const pays = Array.isArray(inv.payments) ? inv.payments : []
      for (const p of pays) {
        rows.push({
          id: p.id,
          date: p.created_at || p.date,
          reference: p.reference || `PAY-${p.id}`,
          method: p.method || 'Unknown',
          amount: Number(p.amount || 0),
        })
      }
    }
    rows.sort((a,b)=>{
      const da = new Date(a.date||0).getTime() || 0
      const db = new Date(b.date||0).getTime() || 0
      return db - da
    })
    return rows
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
          const method = String(p.method || '').trim() || 'Unknown'
          rows.push({
            type: 'payment',
            date: p.created_at,
            ref: p.reference || `PAY-${p.id}`,
            method,
            description: `Payment (${method.toUpperCase()})`,
            debit: 0,
            credit: Number(p.amount || 0),
            status: 'payment',
          })
        }
      }
      // Compute running balance in chronological order (oldest -> newest)
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
      const withBalance = rows.map(r => {
        balance = balance + (Number(r.debit||0)) - (Number(r.credit||0))
        return { ...r, balance }
      })

      // Display latest first, while keeping correct balance values
      return withBalance.reverse()
    } catch { return [] }
  }, [invoices])

  const filteredFeeStatement = useMemo(() => {
    const rows = Array.isArray(feeStatement) ? feeStatement : []
    if (statementFilter === 'invoice') return rows.filter(r => r?.type === 'invoice')
    if (statementFilter === 'payment') return rows.filter(r => r?.type === 'payment')
    return rows
  }, [feeStatement, statementFilter])

  const paymentsByMethod = useMemo(() => {
    const byMethod = new Map()
    for (const inv of invoices) {
      const pays = Array.isArray(inv.payments) ? inv.payments : []
      for (const p of pays) {
        const method = p.method || 'Unknown'
        const amount = Number(p.amount || 0)
        byMethod.set(method, (byMethod.get(method) || 0) + amount)
      }
    }
    return Array.from(byMethod.entries()).map(([method, total]) => ({ method, total })).sort((a,b)=> b.total - a.total)
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

  const filteredExamResults = useMemo(() => {
    const q = String(examQuery || '').trim().toLowerCase()
    if (!q) return groupedExamResults
    return (groupedExamResults || []).filter(([name]) => String(name || '').toLowerCase().includes(q))
  }, [groupedExamResults, examQuery])

  useEffect(()=>{
    let mounted = true

    const now = () => Date.now()
    const isFresh = (ts, ttlMs) => {
      const t = Number(ts || 0)
      if (!t) return false
      return (now() - t) < ttlMs
    }

    const TTL = {
      base: 12 * 60 * 60 * 1000,
      dashboard: 5 * 60 * 1000,
      academics: 5 * 60 * 1000, // Reduced from 30m to 5m for better responsiveness
      financeSummary: 60 * 1000,
      invoices: 5 * 60 * 1000,
      finance: 2 * 60 * 1000,
    }

    const ensureCache = () => {
      if (!__studentDashboardCache) {
        // Try to load from localStorage for cross-session persistence
        const persistent = localStorage.getItem('student_dashboard_cache')
        if (persistent) {
          try {
            __studentDashboardCache = JSON.parse(persistent)
          } catch (e) {
            __studentDashboardCache = null
          }
        }
      }

      if (!__studentDashboardCache) {
        __studentDashboardCache = {
          baseLoaded: false,
          dashboardLoaded: false,
          academicsLoaded: false,
          financeLoaded: false,
          financeSummaryLoaded: false,
          invoicesLoaded: false,
          baseFetchedAt: 0,
          dashboardFetchedAt: 0,
          academicsFetchedAt: 0,
          financeFetchedAt: 0,
          financeSummaryFetchedAt: 0,
          invoicesFetchedAt: 0,
          student: null,
          schoolInfo: null,
          assessments: [],
          examResults: [],
          invoices: [],
          summary: { total_billed: 0, total_paid: 0, balance: 0 },
        }
      }
      return __studentDashboardCache
    }

    const saveToPersistentCache = (c) => {
      try {
        localStorage.setItem('student_dashboard_cache', JSON.stringify(c))
      } catch (e) {}
    }

    const hydrateFromCache = (c) => {
      setStudent(c.student || null)
      setSchoolInfo(c.schoolInfo || null)
      setAssessments(c.assessments || [])
      setExamResults(c.examResults || [])
      setInvoices(c.invoices || [])
      setSummary(c.summary || { total_billed: 0, total_paid: 0, balance: 0 })
    }

    ;(async () => {
      // If we have cached data, don't show the initial loading spinner
      const c = ensureCache()
      const hasInitialData = c.baseLoaded || c.dashboardLoaded || c.academicsLoaded || c.financeLoaded
      setLoading(!hasInitialData)
      setError('')
      try {
        // Hydrate UI immediately from cache before optional tab-specific fetches.
        hydrateFromCache(c)

        if (!c.schoolInfo) {
          try {
            const scRes = await api.get('/auth/school/info/', { timeout: 15000, _skipGlobalLoading: true })
            if (!mounted) return
            c.schoolInfo = scRes.data
            setSchoolInfo(scRes.data)
            saveToPersistentCache(c)
          } catch {
            if (!mounted) return
          }
        }

        // Base student record (required for personalized sections)
        try {
          const shouldFetchBase = !c.baseLoaded || !isFresh(c.baseFetchedAt, TTL.base)
          if (shouldFetchBase) {
            const [stRes, scRes] = await Promise.all([
              api.get('/academics/students/my/', { timeout: 15000, _skipGlobalLoading: true }),
              api.get('/auth/school/info/', { timeout: 15000, _skipGlobalLoading: true })
            ])
            if (!mounted) return
            c.student = stRes.data
            c.schoolInfo = scRes.data
            setSchoolInfo(scRes.data)
            c.baseLoaded = true
            c.baseFetchedAt = now()
            saveToPersistentCache(c)
            hydrateFromCache(c)
          }
        } catch {
          if (!mounted) return
        }

        // Prefetch core personalized data for the main dashboard once per session.
        if (currentTab === 'dashboard') {
          const shouldFetchDashboard = !c.dashboardLoaded || !isFresh(c.dashboardFetchedAt, TTL.dashboard)
          if (shouldFetchDashboard) {
            const settled = await Promise.allSettled([
              api.get('/academics/assessments/my/', { timeout: 15000, _skipGlobalLoading: true }),
              api.get('/finance/invoices/my-summary/', { timeout: 15000, _skipGlobalLoading: true }),
            ])
            if (!mounted) return
            const [assS, sumS] = settled
            
            if (assS.status === 'fulfilled') {
              c.assessments = Array.isArray(assS.value?.data) ? assS.value.data : (assS.value?.data?.results || [])
            }
            if (sumS.status === 'fulfilled') {
              c.summary = sumS.value?.data || { total_billed: 0, total_paid: 0, balance: 0 }
              c.financeSummaryLoaded = true
              c.financeSummaryFetchedAt = now()
            }
            
            c.dashboardLoaded = true
            c.dashboardFetchedAt = now()
            saveToPersistentCache(c)
            hydrateFromCache(c)
          }
        }

        // 2) Tab-specific data loads
        if (currentTab === 'academics') {
          const stId = c.student?.id
          const shouldFetchAcademics = !c.academicsLoaded || !isFresh(c.academicsFetchedAt, TTL.academics)
          if (shouldFetchAcademics) {
            const settled = await Promise.allSettled([
              api.get('/academics/assessments/my/'),
              stId ? api.get(`/academics/exam_results/?student=${stId}`) : Promise.resolve({ data: [] }),
            ])
            if (!mounted) return
            const [assS, exmS] = settled
            
            if (assS.status === 'fulfilled') {
              c.assessments = Array.isArray(assS.value?.data) ? assS.value.data : (assS.value?.data?.results || [])
            }
            if (exmS.status === 'fulfilled') {
              c.examResults = Array.isArray(exmS.value?.data) ? exmS.value.data : (exmS.value?.data?.results || [])
            }
            
            c.academicsLoaded = true
            c.academicsFetchedAt = now()
            saveToPersistentCache(c)
            hydrateFromCache(c)
          }
        }

        if (currentTab === 'finance') {
          const shouldFetchFinance = !c.financeLoaded || !isFresh(c.financeFetchedAt, TTL.finance)
          const shouldFetchSummary = !c.financeSummaryLoaded || !isFresh(c.financeSummaryFetchedAt, TTL.financeSummary)
          const shouldFetchInvoices = !c.invoicesLoaded || !isFresh(c.invoicesFetchedAt, TTL.invoices)

          if (shouldFetchFinance || shouldFetchSummary || shouldFetchInvoices) {
            const reqs = []
            reqs.push(shouldFetchSummary
              ? api.get('/finance/invoices/my-summary/', { timeout: 15000, _skipGlobalLoading: true })
              : Promise.resolve({ data: c.summary })
            )
            reqs.push(shouldFetchInvoices
              ? api.get('/finance/invoices/my/', { params: { page_size: 200 }, timeout: 20000, _skipGlobalLoading: true })
              : Promise.resolve({ data: c.invoices })
            )

            const settled = await Promise.allSettled(reqs)

            if (!mounted) return
            const [sumS, invS] = settled

            if (sumS.status === 'fulfilled') {
              c.summary = sumS.value?.data || { total_billed: 0, total_paid: 0, balance: 0 }
              c.financeSummaryLoaded = true
              c.financeSummaryFetchedAt = now()
            }
            if (invS.status === 'fulfilled') {
              c.invoices = Array.isArray(invS.value?.data) ? invS.value.data : (invS.value?.data?.results || [])
              c.invoicesLoaded = true
              c.invoicesFetchedAt = now()
            }

            c.financeLoaded = true
            c.financeFetchedAt = now()
            saveToPersistentCache(c)
            hydrateFromCache(c)
          }
        }
      } catch (e) {
        if (!mounted) return
        if (currentTab !== 'finance' && !c.baseLoaded) {
          setError(e?.response?.data?.detail || e?.message || 'Failed to load your profile')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [currentTab])

  async function refreshAcademicsData() {
    setRefreshingAcademics(true)
    try {
      const stId = student?.id || __studentDashboardCache?.student?.id
      const settled = await Promise.allSettled([
        api.get('/academics/assessments/my/', { timeout: 15000, _skipGlobalLoading: true }),
        stId ? api.get(`/academics/exam_results/?student=${stId}`, { timeout: 15000, _skipGlobalLoading: true }) : Promise.resolve({ data: [] }),
      ])

      const [assS, exmS] = settled
      const newAssessments = assS.status === 'fulfilled' ? (Array.isArray(assS.value?.data) ? assS.value.data : (assS.value?.data?.results || [])) : assessments
      const newResults = exmS.status === 'fulfilled' ? (Array.isArray(exmS.value?.data) ? exmS.value.data : (exmS.value?.data?.results || [])) : examResults

      setAssessments(newAssessments)
      setExamResults(newResults)

      if (__studentDashboardCache) {
        __studentDashboardCache.assessments = newAssessments
        __studentDashboardCache.examResults = newResults
        __studentDashboardCache.academicsLoaded = true
        __studentDashboardCache.academicsFetchedAt = Date.now()
        try {
          localStorage.setItem('student_dashboard_cache', JSON.stringify(__studentDashboardCache))
        } catch {}
      }
    } catch (e) {
      console.error("Failed to refresh academics:", e)
    } finally {
      setRefreshingAcademics(false)
    }
  }

  async function refreshFinanceData(){
    setRefreshingFinance(true)
    try {
      const [sumRes, invRes] = await Promise.all([
        api.get('/finance/invoices/my-summary/', { timeout: 15000, _skipGlobalLoading: true }),
        api.get('/finance/invoices/my/', { params: { page_size: 200 }, timeout: 20000, _skipGlobalLoading: true })
      ])
      const sum = sumRes?.data || { total_billed: 0, total_paid: 0, balance: 0 }
      const inv = (Array.isArray(invRes?.data) ? invRes.data : (invRes?.data?.results || []))
      setSummary(sum)
      setInvoices(inv)
      if (__studentDashboardCache) {
        __studentDashboardCache.summary = sum
        __studentDashboardCache.invoices = inv
        __studentDashboardCache.financeLoaded = true
        __studentDashboardCache.financeSummaryLoaded = true
        __studentDashboardCache.invoicesLoaded = true
        __studentDashboardCache.financeFetchedAt = Date.now()
        __studentDashboardCache.financeSummaryFetchedAt = Date.now()
        __studentDashboardCache.invoicesFetchedAt = Date.now()
        try {
          localStorage.setItem('student_dashboard_cache', JSON.stringify(__studentDashboardCache))
        } catch {}
      }
      return true
    } catch {
      return false
    } finally {
      setRefreshingFinance(false)
    }
  }

  useEffect(() => {
    if (!location?.state?.refreshFinance) return
    if (currentTab !== 'finance') return

    let alive = true
    ;(async () => {
      try {
        await refreshFinanceData()
        if (!alive) return
      } catch {
      } finally {
        try { navigate('/student/finance', { replace: true, state: null }) } catch {}
      }
    })()

    return () => { alive = false }
  }, [location?.state?.refreshFinance, currentTab, navigate])

  const classLabel = useMemo(() => {
    const k = student?.klass_detail
    if (!k) return student?.klass || '-'
    return `${k.name} • ${k.grade_level}`
  }, [student])

  const isBaseLoading = useMemo(() => {
    if (!__studentDashboardCache) return loading
    return !__studentDashboardCache.baseLoaded
  }, [loading, currentTab])

  const isFinanceSummaryLoading = useMemo(() => {
    if (!__studentDashboardCache) return loading
    return !__studentDashboardCache.financeSummaryLoaded
  }, [loading, currentTab])

  const isInvoicesLoading = useMemo(() => {
    if (!__studentDashboardCache) return loading
    return !__studentDashboardCache.invoicesLoaded
  }, [loading, currentTab])

  useEffect(() => {
    if (!financeDetailsOpen) return
    // On the dashboard tab we usually only preload summary; fetch invoices on-demand for the View modal.
    if (__studentDashboardCache?.invoicesLoaded) return

    let alive = true
    ;(async () => {
      try {
        const invRes = await api.get('/finance/invoices/my/', {
          params: { page_size: 200 },
          timeout: 20000,
          _skipGlobalLoading: true,
        })
        if (!alive) return
        const inv = (Array.isArray(invRes?.data) ? invRes.data : (invRes?.data?.results || []))
        setInvoices(inv)
        if (__studentDashboardCache) {
          __studentDashboardCache.invoices = inv
          __studentDashboardCache.invoicesLoaded = true
        }
      } catch {
        if (!alive) return
        setInvoices([])
        if (__studentDashboardCache) {
          __studentDashboardCache.invoices = []
          __studentDashboardCache.invoicesLoaded = true
        }
      }
    })()

    return () => { alive = false }
  }, [financeDetailsOpen])

  const isAcademicsLoading = useMemo(() => {
    if (!__studentDashboardCache) return loading
    return !__studentDashboardCache.academicsLoaded
  }, [loading, currentTab])

  function money(n){
    try {
      const val = Number(n || 0)
      return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val)
    } catch {
      return `Ksh. ${n}`
    }
  }

  function moneyPlain(n){
    try {
      const val = Number(n || 0)
      return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
    } catch {
      return String(n ?? '')
    }
  }

  function printFeeStatement(){
    try {
      const esc = (v) => {
        try {
          return String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
        } catch { return '' }
      }

      const logoUrl = schoolInfo?.logo_url || schoolInfo?.logo || ''
      const schoolName = schoolInfo?.name || 'School Name'
      const schoolAddress = schoolInfo?.address || ''
      const schoolPhone = schoolInfo?.phone || ''
      const schoolEmail = schoolInfo?.email || ''
      const schoolWebsite = schoolInfo?.website || ''

      const rows = Array.isArray(feeStatement) ? feeStatement : []
      const tableRows = rows.map(r => {
        const date = r?.date ? String(r.date).slice(0, 10) : '-'
        const ref = esc(r?.ref || '')
        const desc = esc(r?.description || '')
        const debit = r?.debit ? moneyPlain(r.debit) : ''
        const credit = r?.credit ? moneyPlain(r.credit) : ''
        const bal = moneyPlain(r?.balance)
        return `
          <tr>
            <td>${esc(date)}</td>
            <td>${ref}</td>
            <td>${desc}</td>
            <td style="text-align:right">${debit}</td>
            <td style="text-align:right">${credit}</td>
            <td style="text-align:right">${bal}</td>
          </tr>
        `
      }).join('')

      const w = window.open('', '_blank', 'width=900,height=700')
      if (!w) {
        try { window.print() } catch {}
        return
      }
      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fee Statement</title>
    <style>
      body{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 16px; color:#0f172a; }
      .letterhead { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
      .logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 5px; }
      .school-info { width: 100%; }
      .school-name { font-size: 24px; font-weight: bold; margin: 0; color: #1e293b; text-transform: uppercase; }
      .school-details { font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4; }
      h1{ font-size: 18px; margin: 20px 0 10px; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
      .meta{ color:#475569; font-size: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; }
      table{ width:100%; border-collapse: collapse; }
      th, td{ border:1px solid #e2e8f0; padding: 8px; font-size: 12px; }
      th{ background:#f8fafc; text-align:left; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
      .right{ text-align:right; }
      .muted{ color:#64748b; font-size: 12px; }
      @media print{ body{ padding: 0; } .letterhead { border-bottom-color: #000; } }
    </style>
  </head>
  <body>
    <div class="letterhead">
      ${logoUrl ? `<img src="${esc(logoUrl)}" class="logo" />` : ''}
      <div class="school-info">
        <h2 class="school-name">${esc(schoolName)}</h2>
        <div class="school-details">
          ${schoolAddress ? `<div>${esc(schoolAddress)}</div>` : ''}
          <div>
            ${schoolPhone ? `Tel: ${esc(schoolPhone)}` : ''} 
            ${schoolEmail ? ` | Email: ${esc(schoolEmail)}` : ''}
          </div>
          ${schoolWebsite ? `<div>Website: ${esc(schoolWebsite)}</div>` : ''}
        </div>
      </div>
    </div>

    <h1>Fee Statement</h1>

    <div class="meta">
      <div><span class="muted">STUDENT:</span> <b>${esc(student?.name || authUser?.username || '').toUpperCase()}</b></div>
      <div><span class="muted">Printed:</span> ${esc(new Date().toLocaleString())}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Reference</th>
          <th>Description</th>
          <th class="right">Debit</th>
          <th class="right">Credit</th>
          <th class="right">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="6" class="muted">No transactions</td></tr>'}
      </tbody>
    </table>
  </body>
</html>`
      w.document.open()
      w.document.write(html)
      w.document.close()
      try { w.focus() } catch {}
      setTimeout(() => {
        try { w.print() } catch {}
      }, 250)
    } catch {
      try { window.print() } catch {}
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

  return (
    <div className="space-y-5 sm:space-y-7 bg-white">

      {error && <div className="-mx-3 sm:mx-0 bg-red-50 text-red-700 p-3 sm:p-3 rounded-none sm:rounded">{error}</div>}

  {currentTab === 'dashboard' && (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="hidden sm:flex bg-green-600 text-white rounded shadow p-3 items-center justify-between">
        <div className="font-medium">
          {isBaseLoading && !student?.name && !authUser?.first_name ? (
            <Skeleton className="h-4 w-56 bg-white/25" />
          ) : (
            <>Welcome {(student?.name || authUser?.first_name || authUser?.username || '').toUpperCase()}</>
          )}
        </div>
        <div className="text-xs opacity-90">Dashboard</div>
      </div>

      {/* Quick actions removed as per request */}

      {/* Summary cards */}
      <div className="px-3 sm:px-0 grid md:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-amber-500 text-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs sm:text-sm opacity-90 font-medium">Total Billed</div>
            <button
              type="button"
              onClick={() => { setFinanceDetailsMode('invoices'); setFinanceDetailsOpen(true) }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-white/15 hover:bg-white/20 border border-white/20 transition"
              title="View invoices"
            >
              <span>View</span>
              <span className="text-xs">→</span>
            </button>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1">
            {isFinanceSummaryLoading ? <Skeleton className="h-7 w-32 bg-white/25" /> : moneyPlain(summary.total_billed)}
          </div>
          <div className="text-[10px] sm:text-xs mt-1 opacity-80">All time invoiced</div>
        </div>
        <div className="bg-green-600 text-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs sm:text-sm opacity-90 font-medium">Total Paid</div>
            <button
              type="button"
              onClick={() => { setFinanceDetailsMode('payments'); setFinanceDetailsOpen(true) }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-white/15 hover:bg-white/20 border border-white/20 transition"
              title="View payments"
            >
              <span>View</span>
              <span className="text-xs">→</span>
            </button>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1">
            {isFinanceSummaryLoading ? <Skeleton className="h-7 w-32 bg-white/25" /> : moneyPlain(summary.total_paid)}
          </div>
          <div className="text-[10px] sm:text-xs mt-1 opacity-80">All time payments</div>
        </div>
        <div className="bg-sky-600 text-white rounded-xl shadow-sm p-4">
          <div className="text-xs sm:text-sm opacity-90 font-medium">Balance</div>
          <div className="text-xl sm:text-2xl font-bold mt-1">
            {isFinanceSummaryLoading ? <Skeleton className="h-7 w-32 bg-white/25" /> : moneyPlain(summary.balance)}
          </div>
          <div className="text-[10px] sm:text-xs mt-1 opacity-80">Outstanding</div>
        </div>
      </div>

      {/* User Profile */}
      <div className="px-3 sm:px-0">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Header area */}
          <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">👤</span>
              <h2 className="font-semibold text-slate-800">Personal Information</h2>
            </div>
            <button
              onClick={() => {
                if (!student) return
                setEditError('')
                setEditForm({ email: student.email || '', phone: student.guardian_id || '', address: student.address || '' })
                setShowEdit(true)
              }}
              className="p-2 rounded-full hover:bg-slate-200/50 text-indigo-600 transition-colors disabled:opacity-50"
              title="Edit Details"
              disabled={!student}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>

          <div className="p-4 md:p-6 flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="relative group">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-slate-100 border-4 border-white shadow-sm overflow-hidden flex items-center justify-center">
                  {isBaseLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : student?.photo_url ? (
                    <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl md:text-5xl opacity-20">👤</span>
                  )}
                </div>
              </div>
              {!isBaseLoading && student?.admission_no && (
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold tracking-wider">
                  {student.admission_no}
                </span>
              )}

              <button
                type="button"
                onClick={() => setPersonalInfoOpen(v => !v)}
                className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                title={personalInfoOpen ? 'Hide details' : 'Show details'}
                aria-label={personalInfoOpen ? 'Collapse personal information details' : 'Expand personal information details'}
                aria-expanded={personalInfoOpen}
                aria-controls="personal-info-details"
              >
                <span>{personalInfoOpen ? 'Hide details' : 'Show details'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 transition-transform ${personalInfoOpen ? 'rotate-180' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Details Grid */}
            <div
              id="personal-info-details"
              className={`flex-1 transition-all duration-300 ease-in-out overflow-hidden ${personalInfoOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
              {isBaseLoading && !student?.name && !authUser?.first_name ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Full Name</label>
                    <p className="text-sm md:text-base font-semibold text-slate-900">
                      {student?.name || `${authUser?.first_name || ''} ${authUser?.last_name || ''}`.trim() || authUser?.username}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Class & Grade</label>
                    <p className="text-sm md:text-base font-semibold text-slate-900">{classLabel}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Parent Phone</label>
                    <p className="text-sm md:text-base font-semibold text-slate-900">{student?.guardian_id || authUser?.phone || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Email Address</label>
                    <p className="text-sm md:text-base font-semibold text-slate-900 truncate">{student?.email || authUser?.email || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Boarding Status</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-tight">
                        {student?.boarding_status || 'Day'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Date of Birth</label>
                    <p className="text-sm md:text-base font-semibold text-slate-900">{student?.dob || '-'}</p>
                  </div>

                  <div className="sm:col-span-2 space-y-1 pt-2 border-t border-slate-50">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Postal Address</label>
                    <p className="text-sm text-slate-600 leading-relaxed">{student?.address || 'No address provided'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {currentTab === 'finance' && (
    <div className="-mx-3 sm:mx-0 bg-white sm:rounded-3xl p-4 sm:p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">Finance</h2>
          <div className="text-xs text-slate-500 mt-0.5">Track your statement and confirm payments</div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFinanceSubTab('statement')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${financeSubTab === 'statement' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            STATEMENT
          </button>
          <button
            onClick={() => setFinanceSubTab('reports')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${financeSubTab === 'reports' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            REPORTS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <button
          type="button"
          onClick={() => { setStatementFilter('invoice'); setFinanceSubTab('statement') }}
          className={`text-left rounded-2xl border bg-white p-3 sm:p-4 transition ${statementFilter === 'invoice' ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:bg-slate-50'}`}
        >
          <div className="text-[11px] text-slate-500 font-semibold">Billed in Ksh</div>
          {isFinanceSummaryLoading ? (
            <Skeleton className="h-6 w-24 mt-2" />
          ) : (
            <div className="text-sm sm:text-base font-bold text-slate-900 mt-1">{moneyPlain(summary?.total_billed)}</div>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setStatementFilter('payment'); setFinanceSubTab('statement') }}
          className={`text-left rounded-2xl border bg-white p-3 sm:p-4 transition ${statementFilter === 'payment' ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200 hover:bg-slate-50'}`}
        >
          <div className="text-[11px] text-slate-500 font-semibold">Paid in Ksh</div>
          {isFinanceSummaryLoading ? (
            <Skeleton className="h-6 w-24 mt-2" />
          ) : (
            <div className="text-sm sm:text-base font-bold text-emerald-700 mt-1">{moneyPlain(summary?.total_paid)}</div>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setStatementFilter('all'); setFinanceSubTab('statement') }}
          className={`text-left rounded-2xl border bg-white p-3 sm:p-4 transition ${statementFilter === 'all' ? 'border-slate-300 ring-2 ring-slate-100' : 'border-slate-200 hover:bg-slate-50'}`}
        >
          <div className="text-[11px] text-slate-500 font-semibold">Balance in Ksh</div>
          {isFinanceSummaryLoading ? (
            <Skeleton className="h-6 w-24 mt-2" />
          ) : (
            <div className="text-sm sm:text-base font-bold text-indigo-700 mt-1">{moneyPlain(summary?.balance)}</div>
          )}
        </button>
      </div>
      
      <div className="space-y-6">
        {financeSubTab === 'statement' ? (
          /* Statement section */
          <section>
            {/* Fee Statement */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5" id="fee-statement">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Fee Statement</h3>
                <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:flex-wrap items-center gap-2 sm:justify-end">
                  <button
                    className="w-full sm:w-auto text-xs px-3 py-2 sm:py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 print:hidden"
                    onClick={() => {
                      navigate('/student/finance/pay')
                    }}
                  >Pay Fees</button>
                  <button
                    className="w-full sm:w-auto text-xs px-3 py-2 sm:py-1.5 rounded border border-slate-300 hover:bg-slate-50 print:hidden"
                    onClick={() => navigate('/student/finance/verify')}
                  >Verify Payment</button>
                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                    <button
                      className="w-full sm:w-auto text-xs px-3 py-2 sm:py-1.5 rounded border border-slate-300 hover:bg-slate-50 print:hidden"
                      onClick={printFeeStatement}
                    >
                      Print
                    </button>
                    <button
                      className="w-full sm:w-auto text-xs px-3 py-2 sm:py-1.5 rounded border border-slate-300 hover:bg-slate-50 print:hidden disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => refreshFinanceData()}
                      disabled={refreshingFinance}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {refreshingFinance && (
                          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                        )}
                        {refreshingFinance ? 'Refreshing' : 'Refresh'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              {isInvoicesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : Array.isArray(filteredFeeStatement) && filteredFeeStatement.length > 0 ? (
                <>
                  <div className="sm:hidden space-y-2">
                    {filteredFeeStatement.map((r, idx) => (
                      <div key={idx} className={`rounded-xl border ${transactionRowAccentClasses(r)} p-3`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">{r.date ? String(r.date).slice(0,10) : '-'}</div>
                            <div className="text-sm font-semibold text-slate-900 truncate">{r.description}</div>
                            <div className="text-[11px] text-slate-500 truncate">{r.ref}</div>
                          </div>
                          <div className={`shrink-0 text-[11px] px-2 py-1 rounded-full border ${transactionPillClasses(r)}`}>
                            {r.type==='payment' ? (r.method ? String(r.method).toUpperCase() : 'PAYMENT') : 'INVOICE'}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg bg-slate-50 p-2">
                            <div className="text-[11px] text-slate-500">Debit</div>
                            <div className="font-semibold text-slate-900">{r.debit ? moneyPlain(r.debit) : '-'}</div>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <div className="text-[11px] text-slate-500">Credit</div>
                            <div className="font-semibold text-slate-900">{r.credit ? moneyPlain(r.credit) : '-'}</div>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <div className="text-[11px] text-slate-500">Balance</div>
                            <div className={`font-semibold ${r.type==='payment' ? 'text-emerald-700' : 'text-slate-900'}`}>{moneyPlain(r.balance)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
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
                        {filteredFeeStatement.map((r, idx) => (
                          <tr key={idx} className={`border-t ${r.type==='payment' ? 'bg-white' : ''}`}>
                            <td className="px-2 py-2 whitespace-nowrap">{r.date ? String(r.date).slice(0,10) : '-'}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{r.ref}</td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${transactionPillClasses(r)}`}>{r.type==='payment' ? (r.method ? String(r.method).toUpperCase() : 'PAYMENT') : 'INVOICE'}</span>
                                <span className="min-w-0">{r.description}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right">{r.debit ? moneyPlain(r.debit) : ''}</td>
                            <td className="px-2 py-2 text-right">{r.credit ? moneyPlain(r.credit) : ''}</td>
                            <td className={`px-2 py-2 text-right font-medium ${r.type==='payment' ? 'text-emerald-700' : 'text-slate-900'}`}>{moneyPlain(r.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">No transactions yet. Your detailed statement will appear here.</div>
              )}
              {/* Minimal print styles to focus on statement */}
              <style>{`@media print{ body *{ visibility:hidden } #fee-statement, #fee-statement *{ visibility:visible } #fee-statement{ position:absolute; left:0; top:0; width:100% } }`}</style>
            </div>
          </section>
        ) : (
          /* Reports Section */
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Financial Overview Cards in Reports */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-md">
                <div className="text-xs opacity-80 uppercase tracking-wider font-bold mb-1">Utilization</div>
                <div className="text-2xl font-black">
                  {summary?.total_billed > 0 
                    ? ((summary.total_paid / summary.total_billed) * 100).toFixed(1) 
                    : '0.0'}%
                </div>
                <div className="text-[11px] mt-2 opacity-90 leading-tight">
                  Percentage of total fees paid to date.
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-md">
                <div className="text-xs opacity-80 uppercase tracking-wider font-bold mb-1">Last Payment</div>
                <div className="text-2xl font-black">
                  {paymentRows?.[0] ? moneyPlain(paymentRows[0].amount) : '0.00'}
                </div>
                <div className="text-[11px] mt-2 opacity-90 leading-tight">
                  {paymentRows?.[0] ? `Received on ${new Date(paymentRows[0].date).toLocaleDateString()}` : 'No payments recorded yet.'}
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payments Over Time */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-7-7 7"/><path d="M19 3v14H5V3"/><path d="M10 7v4h4"/></svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Payment History</h3>
                      <p className="text-[10px] text-slate-500">Transaction volume over time</p>
                    </div>
                  </div>
                </div>
                
                {paymentsOverTime && paymentsOverTime.length > 0 ? (
                  <div className="h-[280px] w-full mt-auto">
                    <ResponsiveLine data={paymentsOverTime} />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl">📉</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium italic">No payment history found</p>
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Payment Channels</h3>
                      <p className="text-[10px] text-slate-500">Distribution by method</p>
                    </div>
                  </div>
                </div>

                {paymentsByMethod && paymentsByMethod.length > 0 ? (
                  <div className="h-[280px] w-full mt-auto">
                    <ResponsiveBar data={paymentsByMethod} />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl">📊</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium italic">No channel data available</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Helper Footer */}
            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
              <div className="flex items-start gap-3">
                <span className="text-indigo-600 mt-0.5">💡</span>
                <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                  These reports are generated based on your confirmed payments. 
                  If a payment is missing, please go to the <b>Statement</b> tab and use <b>Verify Payment</b> to sync your latest transactions.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )}

  {currentTab === 'academics' && (
    <div className="-mx-3 sm:mx-0 bg-white sm:rounded-3xl p-4 sm:p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">Academics</h2>
          <div className="text-xs text-slate-500 mt-0.5">View your exam results and performance reports</div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setAcademicsSubTab('exams')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${academicsSubTab === 'exams' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            EXAMS
          </button>
          <button
            onClick={() => setAcademicsSubTab('reports')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${academicsSubTab === 'reports' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            REPORTS
          </button>
        </div>
      </div>
      
      <div className="space-y-6">
        {academicsSubTab === 'exams' ? (
          /* Exams Section */
          <section>
          <div className="flex items-center justify-between gap-3 mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Exam Sessions</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setExamSearchOpen(v => !v)
                  if (examSearchOpen) setExamQuery('')
                }}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${examSearchOpen ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                aria-label="Search exams"
                title="Search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={refreshAcademicsData}
                disabled={refreshingAcademics}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${refreshingAcademics ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                title="Refresh"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className={refreshingAcademics ? "animate-spin text-indigo-600" : ""}
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
              </button>
            </div>
          </div>

          {examSearchOpen && (
            <div className="mb-4 animate-in slide-in-from-top-2 duration-300">
              <div className="relative">
                <input
                  value={examQuery}
                  onChange={(e) => setExamQuery(e.target.value)}
                  placeholder="Search exams by name..."
                  className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-300 transition-all shadow-sm"
                  autoFocus
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
              </div>
            </div>
          )}
          {isAcademicsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : Array.isArray(filteredExamResults) && filteredExamResults.length > 0 ? (
            <div className="space-y-3">
              {filteredExamResults.map(([name, rows]) => {
                const total = rows.reduce((s, r) => s + Number(r.marks || 0), 0)
                const avg = rows.length ? (total / rows.length) : 0
                const isOpen = openExam === name
                const domId = examDomId(name)
                const examId = rows?.[0]?.exam_detail?.id || rows?.[0]?.exam || null
                const report = rows
                  .map(r => ({
                    subjectLabel: r.subject_detail
                      ? `${r.subject_detail.code ? r.subject_detail.code + ' — ' : ''}${r.subject_detail.name || ''}`
                      : String(r.subject || ''),
                    marks: Number(r.marks || 0),
                  }))
                  .sort((a, b) => String(a.subjectLabel).localeCompare(String(b.subjectLabel)))

                return (
                  <div key={name} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenExam(prev => (prev === name ? null : name))}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50"
                      aria-expanded={isOpen}
                    >
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-semibold text-slate-900 truncate">{name}</div>
                        <div className="text-[11px] text-slate-500">Tap to view report card</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-wider text-slate-400">Average</div>
                          <div className="text-sm font-bold text-indigo-600">{avg.toFixed(1)}%</div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[80vh] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                      <div className="px-4 pb-4" id={domId}>
                        {printExamId === domId && (
                          <style>{`@media print{ body *{ visibility:hidden } #${domId}, #${domId} *{ visibility:visible } #${domId}{ position:absolute; left:0; top:0; width:100%; padding:16px } }`}</style>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Report Card</div>
                          <button
                            type="button"
                            onClick={() => setPrintExamId(domId)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                          >
                            Print report card
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500">Total</div>
                            <div className="text-sm font-bold text-slate-900">{Number.isFinite(total) ? total.toFixed(0) : '0'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500">Subjects</div>
                            <div className="text-sm font-bold text-slate-900">{rows.length}</div>
                          </div>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          {examId && student?.id ? (
                            <div className="-mx-4">
                              <StudentReportCardViewer
                                embedded={true}
                                hideControls={true}
                                hideHistory={true}
                                showTermSelector={false}
                                showExamSelector={false}
                                showBackPrint={false}
                                studentIdProp={student.id}
                                selectedExamId={examId}
                              />
                            </div>
                          ) : (
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                  <th className="px-2 py-2">Subject</th>
                                  <th className="px-2 py-2 text-right">Marks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.map((r, idx) => (
                                  <tr key={idx} className="border-t">
                                    <td className="px-2 py-2 text-slate-900">{r.subjectLabel || '-'}</td>
                                    <td className="px-2 py-2 text-right font-semibold text-slate-900">{Number.isFinite(r.marks) ? r.marks : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic">No exams yet</div>
          )}
        </section>
        ) : (
          /* Reports Section */
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-xs">📈</span>
                Performance Over Time
              </h3>
              {performance && performance.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveLine data={performance} />
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm italic">
                  Not enough exam data to generate charts.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-indigo-600 text-white rounded-2xl p-5 shadow-sm">
                <div className="text-xs opacity-80 font-medium uppercase tracking-wider mb-1">Average Score</div>
                <div className="text-3xl font-bold">
                  {performance.length > 0 
                    ? (performance.reduce((acc, curr) => acc + curr.avg, 0) / performance.length).toFixed(1)
                    : '0'
                  }%
                </div>
                <div className="mt-4 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full" 
                    style={{ width: `${performance.length > 0 ? (performance.reduce((acc, curr) => acc + curr.avg, 0) / performance.length) : 0}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Highest Performance</div>
                <div className="text-3xl font-bold text-slate-900">
                  {performance.length > 0 
                    ? Math.max(...performance.map(p => p.avg)).toFixed(1)
                    : '0'
                  }%
                </div>
                <div className="mt-2 text-xs text-indigo-600 font-semibold">
                  {performance.length > 0 
                    ? performance.find(p => p.avg === Math.max(...performance.map(x => x.avg)))?.label
                    : 'No exams yet'
                  }
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Improvement Summary</h3>
              <div className="space-y-4">
                {performance.length >= 2 ? (
                  (() => {
                    const latest = performance[performance.length - 1].avg;
                    const previous = performance[performance.length - 2].avg;
                    const diff = latest - previous;
                    const isImproved = diff >= 0;
                    return (
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${isImproved ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {isImproved ? '▲' : '▼'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {isImproved ? 'Performance is up!' : 'Performance declined'}
                          </div>
                          <div className="text-xs text-slate-500">
                            You {isImproved ? 'gained' : 'lost'} {Math.abs(diff).toFixed(1)}% compared to the previous exam.
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-xs text-slate-500 italic">
                    Requires at least two exams to show improvement metrics.
                  </div>
                )}
              </div>
            </div>
          </section>
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

  <Modal
    open={financeDetailsOpen}
    onClose={() => setFinanceDetailsOpen(false)}
    title={financeDetailsMode === 'payments' ? 'Payment details' : 'Invoice details'}
    size="lg"
  >
    {isInvoicesLoading ? (
      <div className="text-sm text-gray-600">Loading…</div>
    ) : (
      <div className="space-y-3">
        <div className="overflow-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              {financeDetailsMode === 'payments' ? (
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Reference</th>
                  <th className="text-left px-3 py-2 font-semibold">Method</th>
                  <th className="text-right px-3 py-2 font-semibold">Amount</th>
                </tr>
              ) : (
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Reference</th>
                  <th className="text-left px-3 py-2 font-semibold">Description</th>
                  <th className="text-right px-3 py-2 font-semibold">Amount</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(financeDetailsMode === 'payments' ? paymentRows : invoiceRows).length === 0 ? (
                <tr>
                  <td colSpan={financeDetailsMode === 'payments' ? 4 : 5} className="px-3 py-6 text-center text-gray-500">
                    No {financeDetailsMode === 'payments' ? 'payments' : 'invoices'} found.
                  </td>
                </tr>
              ) : (
                (financeDetailsMode === 'payments' ? paymentRows : invoiceRows).map((row) => (
                  <tr key={`${financeDetailsMode}-${row.id}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.reference}</td>
                    {financeDetailsMode === 'payments' ? (
                      <>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{String(row.method || '').toUpperCase()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-gray-900">{moneyPlain(row.amount)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-gray-700 min-w-[220px]">{row.description}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-gray-900">{moneyPlain(row.amount)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{String(row.status || '').toUpperCase()}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

// Lightweight responsive bar chart component (no external deps)
function ResponsiveBar({ data }){
  // dimensions
  const height = 220
  const padding = { top: 20, right: 20, bottom: 60, left: 60 }
  const width = Math.min(900, Math.max(320, (typeof window !== 'undefined' ? window.innerWidth - 120 : 600)))
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const barWidth = innerW / data.length
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const yScale = v => padding.top + innerH - (innerH * v / maxTotal)
  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Payment methods bar chart">
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => (
          <line key={idx} x1={padding.left} y1={yScale(p * maxTotal)} x2={width - padding.right} y2={yScale(p * maxTotal)} stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {/* axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#9ca3af" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#9ca3af" />
        {/* y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => (
          <text key={idx} x={padding.left - 6} y={yScale(p * maxTotal) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(p * maxTotal)}</text>
        ))}
        {/* bars */}
        {data.map((d, i) => (
          <rect key={i} x={padding.left + i * barWidth + 2} y={yScale(d.total)} width={barWidth - 4} height={innerH - (yScale(d.total) - padding.top)} fill="#10b981" />
        ))}
        {/* x-axis labels */}
        {data.map((d, i) => (
          <text key={i} x={padding.left + i * barWidth + barWidth / 2} y={height - padding.bottom + 16} textAnchor="middle" fontSize="10" fill="#6b7280">
            {String(d.method).slice(0, 8)}
          </text>
        ))}
      </svg>
    </div>
  )
}
