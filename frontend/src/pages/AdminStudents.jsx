import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'
import StatCard from '../components/StatCard'
import { showLoadingHint, setLoadingProgress, clearLoadingHint } from '../utils/loading'
import {
  Users,
  UserPlus,
  Printer,
  Download,
  Search,
  SlidersHorizontal,
  X,
  CheckCircle2,
  GraduationCap,
  UserX
} from 'lucide-react'

// Simple in-memory cache so that navigating away and back within the same
// session can reuse previously loaded data without refetching immediately.
let cachedStudents = null
let cachedClasses = null
let cachedTab = 'active'
let cachedStudentsTotal = 0
let cachedStudentsNext = ''
let studentsCacheTimestamp = 0
const STUDENTS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

const PAGE_SIZE = 10

export default function AdminStudents(){
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [studentsTotal, setStudentsTotal] = useState(0)
  const [studentsNext, setStudentsNext] = useState('') // pagination next URL for students
  const [studentsPrev, setStudentsPrev] = useState('')
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkAgree, setBulkAgree] = useState(false)
  const [bulkForm, setBulkForm] = useState({ gender: '', klass: '', boarding_status: '' })
  const [bulkOtpCode, setBulkOtpCode] = useState('')
  const [bulkOtpSending, setBulkOtpSending] = useState(false)
  const [bulkOtpSent, setBulkOtpSent] = useState(false)
  const [bulkOtpError, setBulkOtpError] = useState('')
  const [form, setForm] = useState({ admission_no:'', upi_number:'', name:'', dob:'', gender:'', guardian_id:'', guardian_name:'', guardian_passport_no:'', birth_certificate_no:'', klass:'', boarding_status:'day' })
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [addStatus, setAddStatus] = useState('idle') // idle | adding | completed
  const [addError, setAddError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [schoolName, setSchoolName] = useState('')
  // Filters
  const [filterGrade, setFilterGrade] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [filterStatus, setFilterStatus] = useState('active') // all | active | inactive | graduated
  const [isLoading, setIsLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmStudent, setConfirmStudent] = useState(null)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const [confirmAgree, setConfirmAgree] = useState(false)
  const [confirmAction, setConfirmAction] = useState('') // 'deactivate' | 'delete' | 'transfer'

  const handleAction = async (student, action) => {
    setConfirmStudent(student)
    setConfirmAction(action)
    setConfirmAgree(false)
    setConfirmOpen(true)
  }

  const runIndividualAction = async () => {
    if (!confirmStudent || confirmSubmitting) return
    try {
      setConfirmSubmitting(true)
      if (confirmAction === 'delete') {
        await api.delete(`/academics/students/${confirmStudent.id}/`)
        showSuccess('Deleted', `Student ${confirmStudent.name} deleted.`)
      } else if (confirmAction === 'transfer') {
        await api.patch(`/academics/students/${confirmStudent.id}/`, { is_transferred: true, is_active: false })
        showSuccess('Transferred', `Student ${confirmStudent.name} marked as transferred.`)
      } else {
        // deactive / toggle active
        await api.patch(`/academics/students/${confirmStudent.id}/`, { is_active: !confirmStudent.is_active })
        showSuccess('Updated', `Student ${confirmStudent.name} status updated.`)
      }
      await load()
      setConfirmOpen(false)
    } catch (e) {
      showError('Action Failed', e?.response?.data?.detail || 'Could not complete action.')
    } finally {
      setConfirmSubmitting(false)
    }
  }

  // Keep tab state for existing logic (status dropdown controls it)
  const [tab, setTab] = useState('active') // 'all' | 'active' | 'graduated' | 'inactive'
  const [isCompact, setIsCompact] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [statIndex, setStatIndex] = useState(0)

  // Summary stats (real data)
  const [summary, setSummary] = useState(null)
  const [maleCount, setMaleCount] = useState(0)
  const [femaleCount, setFemaleCount] = useState(0)
  const [currentYearLabel, setCurrentYearLabel] = useState('')

  const { showSuccess, showError } = useNotification()

  const load = async () => {
    try {
      setIsLoading(true)
      setStudentsNext('')
      setStudentsPrev('')
      try { showLoadingHint('Loading students…', 8) } catch {}
      // Build students query with optional tab/search and server-side grade/class filters
      let base = `/academics/students/`
      const params = new URLSearchParams()
      params.set('page_size', String(PAGE_SIZE))
      params.set('page', String(page || 1))
      if (searchTerm) params.set('q', searchTerm)
      if (tab === 'graduated') params.set('is_graduated', 'true')
      else if (tab === 'inactive') params.set('is_active', 'false')
      else if (tab === 'active') { params.set('is_graduated', 'false'); params.set('is_active', 'true') }
      // Server-side Specific Grade & Class filters (if provided)
      if (tab === 'active' && filterGrade) params.set('grade', String(filterGrade))
      if (filterClass) params.set('klass', String(filterClass))
      if (filterGender) params.set('gender', String(filterGender))
      const studentsUrl = `${base}?${params.toString()}`
      try { setLoadingProgress(25) } catch {}
      const [st, cl, sum, yr, maleRes, femaleRes] = await Promise.allSettled([
        api.get(studentsUrl),
        api.get('/academics/classes/?page_size=200'),
        api.get('/reports/summary/', { _skipGlobalLoading: true }),
        api.get('/academics/academic_years/current/', { _skipGlobalLoading: true }).catch(() => ({ data: null })),
        api.get(`/academics/students/?page_size=1&gender=Male`, { _skipGlobalLoading: true }).catch(() => ({ data: null })),
        api.get(`/academics/students/?page_size=1&gender=Female`, { _skipGlobalLoading: true }).catch(() => ({ data: null })),
      ])
      try { setLoadingProgress(80) } catch {}
      const stVal = st.status === 'fulfilled' ? st.value : { data: [] }
      const clVal = cl.status === 'fulfilled' ? cl.value : { data: [] }
      const sumVal = sum.status === 'fulfilled' ? sum.value : { data: null }
      const yrVal = yr.status === 'fulfilled' ? yr.value : { data: null }
      const maleVal = maleRes.status === 'fulfilled' ? maleRes.value : { data: null }
      const femaleVal = femaleRes.status === 'fulfilled' ? femaleRes.value : { data: null }

      const stIsArray = Array.isArray(stVal.data)
      const stData = stIsArray ? stVal.data : (Array.isArray(stVal.data?.results) ? stVal.data.results : [])
      const clData = Array.isArray(clVal.data) ? clVal.data : (Array.isArray(clVal.data?.results) ? clVal.data.results : [])
      setStudents(stData)
      setClasses(clData)
      // Total count: if paginated, use count; if array response, use length
      setStudentsTotal(stIsArray ? stData.length : (Number(stVal.data?.count) || stData.length))
      // Save next link for incremental loading (only when paginated)
      setStudentsNext(stIsArray ? '' : (stVal.data?.next || ''))
      setStudentsPrev(stIsArray ? '' : (stVal.data?.previous || ''))

      // Summary stats
      setSummary(sumVal?.data || null)
      setMaleCount(Number(maleVal?.data?.count || 0))
      setFemaleCount(Number(femaleVal?.data?.count || 0))
      try {
        const y = yrVal?.data
        let label = ''
        if (y?.end_date) label = String(y.end_date).slice(0, 4)
        if (!label && y?.label) {
          const hits = String(y.label).match(/\b(20\d{2})\b/g)
          if (hits && hits.length) label = hits[hits.length - 1]
          else label = String(y.label)
        }
        setCurrentYearLabel(label)
      } catch {
        setCurrentYearLabel('')
      }
      // Update cache for this tab
      cachedStudents = stData
      cachedClasses = clData
      cachedTab = tab
      cachedStudentsTotal = stIsArray ? stData.length : (Number(st.data?.count) || stData.length)
      cachedStudentsNext = stIsArray ? '' : (st.data?.next || '')
      studentsCacheTimestamp = Date.now()
    } catch (e) {
      showError('Load Failed', 'Could not load students or classes.')
    } finally {
      setIsLoading(false)
      try { setLoadingProgress(100); clearLoadingHint() } catch {}
    }
  }

  // Load next page of students when available
  const loadMore = async () => {
    if (!studentsNext) return
    try{
      setLoadingMore(true)
      const res = await api.get(studentsNext)
      const data = res?.data
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      const nextUrl = Array.isArray(data) ? '' : (data?.next || '')
      setStudents(prev => {
        const merged = prev.concat(arr)
        cachedStudents = merged
        return merged
      })
      setStudentsNext(nextUrl)
      cachedStudentsNext = nextUrl
    }catch(e){
      showError('Load Failed', 'Could not load more students.')
      setStudentsNext('')
      cachedStudentsNext = ''
    }finally{
      setLoadingMore(false)
    }
  }

  // Load school name for print header
  const loadSchoolName = async () => {
    try {
      const { data } = await api.get('/auth/school/me/')
      setSchoolName(data?.name || 'School')
    } catch (e) {
      setSchoolName('School')
    }
  }

  useEffect(()=>{ load() },[tab, searchTerm, filterGrade, filterClass, filterGender, page])

  useEffect(() => {
    setSelectedStudentIds([])
  }, [tab, searchTerm, filterGrade, filterClass, filterGender, page])

  // Load school name for print header (once per session)
  useEffect(() => {
    loadSchoolName()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(max-width: 640px)')
    const onChange = (e) => setIsCompact(!!(e && e.matches))
    setIsCompact(mql.matches)
    try { mql.addEventListener('change', onChange) } catch { try { mql.addListener(onChange) } catch {} }
    return () => { try { mql.removeEventListener('change', onChange) } catch { try { mql.removeListener(onChange) } catch {} } }
  }, [])

  useEffect(() => {
    const v = String(searchDraft || '')
    if (v === String(searchTerm || '')) return
    const id = setTimeout(() => {
      setSearchTerm(v)
      setPage(1)
    }, 350)
    return () => clearTimeout(id)
  }, [searchDraft])

  useEffect(() => {
    if (!isCompact) return
    const id = setInterval(() => setStatIndex(i => (i + 1) % 3), 3000)
    return () => clearInterval(id)
  }, [isCompact])

  const create = async (e) => {
    e.preventDefault()
    try {
      setAddStatus('adding')
      setAddError('')

      // Create user account first using admission number as username and guardian phone as password
      const userPayload = {
        username: form.admission_no,
        password: form.guardian_id, // Use guardian phone as password
        first_name: form.name.split(' ')[0],
        last_name: form.name.split(' ').slice(1).join(' '),
        email: '', // Optional email
        role: 'student'
      }

      const { data: userData } = await api.post('/auth/users/create/', userPayload)

      // Create student with the user_id
      const studentPayload = {
        ...form,
        klass: form.klass || null,
        user_id: userData.id
      }

      await api.post('/academics/students/', studentPayload)

      // Clear form and mark completed
      setForm({ admission_no:'', upi_number:'', name:'', dob:'', gender:'', guardian_id:'', guardian_name:'', guardian_passport_no:'', birth_certificate_no:'', klass:'', boarding_status:'day' })
      setAddStatus('completed')

      // Revert button text after a short delay so user can add another or close
      setTimeout(() => setAddStatus('idle'), 1500)

      load()
      showSuccess('Student Enrolled', `Student ${form.name} has been successfully enrolled with account created. Username: ${form.admission_no}, Password: ${form.guardian_id}`)
    } catch (err) {
      setAddStatus('idle')
      const data = err?.response?.data
      let msg = data?.detail || err?.message || 'Failed to enroll student'
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const parts = []
        Object.keys(data).forEach(k => {
          parts.push(`${k}: ${Array.isArray(data[k]) ? data[k].join(' ') : String(data[k])}`)
        })
        if (parts.length) msg = parts.join('; ')
      }
      setAddError(msg)
      showError('Failed to Enroll Student', msg)
    }
  }

  // Options for grade filter derived from classes
  const gradeOptions = Array.from(new Set(
    (Array.isArray(classes) ? classes : []).map(c => String(c?.grade_level ?? c?.grade)).filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b))

  const classOptions = (Array.isArray(classes) ? classes : []).filter(c => !filterGrade || String(c.grade_level) === String(filterGrade))

  // Server already filters; keep minimal local filtering as safety
  const filteredStudents = useMemo(() => {
    return (Array.isArray(students) ? students : []).filter((student) => {
      if (!student) return false
      if (filterGender && String(student.gender || '').toLowerCase() !== String(filterGender).toLowerCase()) return false
      if (filterClass && String(student.klass || student.klass_detail?.id || '') !== String(filterClass)) return false
      if (filterGrade) {
        const klassId = student.klass || student.klass_detail?.id
        const klassObj = classes.find(c => String(c.id) === String(klassId))
        const studentGrade = student.klass_detail?.grade_level ?? klassObj?.grade_level ?? ''
        if (String(studentGrade) !== String(filterGrade)) return false
      }
      return true
    })
  }, [students, classes, filterGender, filterClass, filterGrade])

  const totalPages = useMemo(() => {
    const total = Number(studentsTotal || 0)
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [studentsTotal])

  const showingFrom = useMemo(() => {
    if (!studentsTotal) return 0
    return (Math.max(1, Number(page || 1)) - 1) * PAGE_SIZE + 1
  }, [studentsTotal, page])

  const showingTo = useMemo(() => {
    if (!studentsTotal) return 0
    return Math.min(Number(studentsTotal || 0), (Math.max(1, Number(page || 1)) - 1) * PAGE_SIZE + filteredStudents.length)
  }, [studentsTotal, page, filteredStudents.length])

  const pageButtons = useMemo(() => {
    const p = Math.max(1, Number(page || 1))
    const tp = Math.max(1, Number(totalPages || 1))
    const out = []
    const push = (x) => out.push(x)
    if (tp <= 6) {
      for (let i = 1; i <= tp; i += 1) push(i)
      return out
    }
    // 1,2,3,...,last style
    push(1)
    if (p > 3) push('…')
    const start = Math.max(2, p - 1)
    const end = Math.min(tp - 1, p + 1)
    for (let i = start; i <= end; i += 1) push(i)
    if (p < tp - 2) push('…')
    push(tp)
    return out
  }, [page, totalPages])

  const selectedSet = new Set(selectedStudentIds)
  const selectedCount = selectedStudentIds.length
  const allVisibleSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedSet.has(s.id))

  const toggleSelectStudent = (id) => {
    setSelectedStudentIds(prev => {
      const set = new Set(prev)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return Array.from(set)
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedStudentIds(prev => {
      const set = new Set(prev)
      const visibleIds = filteredStudents.map(s => s.id)
      const isAllSelected = visibleIds.length > 0 && visibleIds.every(id => set.has(id))
      if (isAllSelected) {
        visibleIds.forEach(id => set.delete(id))
      } else {
        visibleIds.forEach(id => set.add(id))
      }
      return Array.from(set)
    })
  }

  const openBulk = (action) => {
    setBulkAction(action)
    setBulkAgree(false)
    setBulkSubmitting(false)
    setBulkForm({ gender: '', klass: '', boarding_status: '' })
    setBulkOtpCode('')
    setBulkOtpSent(false)
    setBulkOtpError('')
    setBulkOtpSending(false)
    setBulkOpen(true)
  }

  const requestBulkOtp = async () => {
    if (bulkOtpSending) return
    try {
      setBulkOtpSending(true)
      setBulkOtpError('')
      const res = await api.post('/academics/students/bulk-otp/request/', {})
      setBulkOtpSent(true)
      const code = res?.data?.code
      const loopback = !!res?.data?.loopback
      if (loopback && code) {
        setBulkOtpCode(String(code || '').replace(/\D/g, '').slice(0, 6))
        showSuccess('Verification Code Sent', 'Verification code generated on server (loopback). It has been filled in for you.')
      } else {
        showSuccess('Verification Code Sent', 'Check your email for the 6-digit code.')
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Could not send verification code.'
      setBulkOtpError(msg)
      showError('Send Code Failed', msg)
    } finally {
      setBulkOtpSending(false)
    }
  }

  const runBulk = async () => {
    if (bulkSubmitting) return
    if (selectedCount === 0) return

    try {
      setBulkSubmitting(true)
      if (bulkAction === 'delete') {
        if (!bulkAgree) return
        await api.post('/academics/students/bulk-delete/', { student_ids: selectedStudentIds, otp_code: bulkOtpCode })
        showSuccess('Deleted', `Deleted ${selectedCount} student(s).`)
      } else {
        const updates = {}
        if (bulkAction === 'gender') updates.gender = bulkForm.gender
        if (bulkAction === 'klass') updates.klass = bulkForm.klass
        if (bulkAction === 'boarding_status') updates.boarding_status = bulkForm.boarding_status
        await api.post('/academics/students/bulk-update/', { student_ids: selectedStudentIds, updates, otp_code: bulkOtpCode })
        const label = bulkAction === 'klass' ? 'class' : (bulkAction === 'boarding_status' ? 'boarding status' : 'gender')
        showSuccess('Updated', `Updated ${label} for ${selectedCount} student(s).`)
      }
      await load()
      setSelectedStudentIds([])
      setBulkOpen(false)
      setBulkAction('')
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Bulk action failed.'
      showError('Bulk Action Failed', msg)
    } finally {
      setBulkSubmitting(false)
    }
  }

  const filterStudentsForExport = (list) => {
    return (Array.isArray(list) ? list : []).filter(student => {
      const lower = searchTerm.toLowerCase()
      const searchMatch = !searchTerm ||
        String(student?.name || '').toLowerCase().includes(lower) ||
        String(student?.admission_no || '').toLowerCase().includes(lower) ||
        String(student?.klass_detail?.name || '').toLowerCase().includes(lower)

      if (!searchMatch) return false

      const klassId = student.klass || student.klass_detail?.id
      const klassObj = classes.find(c => String(c.id) === String(klassId))
      const studentGrade = student.klass_detail?.grade_level ?? klassObj?.grade_level ?? ''

      const genderMatch = !filterGender || String(student.gender || '').toLowerCase() === String(filterGender).toLowerCase()
      const classMatch = !filterClass || String(klassId) === String(filterClass)
      const gradeMatch = !filterGrade || String(studentGrade) === String(filterGrade)

      return genderMatch && classMatch && gradeMatch
    })
  }

  const fetchAllStudentsForExport = async () => {
    let base = `/academics/students/`
    const params = new URLSearchParams()
    params.set('page_size', '2000')
    if (searchTerm) {
      params.set('q', searchTerm)
    } else if (tab === 'graduated') {
      params.set('is_graduated', 'true')
    } else if (tab === 'inactive') {
      params.set('is_active', 'false')
    } else {
      params.set('is_graduated', 'false')
      params.set('is_active', 'true')
    }
    if (filterGrade) params.set('grade', String(filterGrade))
    if (filterClass) params.set('klass', String(filterClass))
    if (filterGender) params.set('gender', String(filterGender))

    const firstUrl = `${base}?${params.toString()}`
    const out = []
    let nextUrl = firstUrl
    let guard = 0
    while (nextUrl && guard < 200) {
      guard += 1
      const res = await api.get(nextUrl)
      const data = res?.data
      if (Array.isArray(data)) {
        out.push(...data)
        break
      }
      const arr = Array.isArray(data?.results) ? data.results : []
      out.push(...arr)
      nextUrl = data?.next || ''
    }
    return out
  }

  // Handle print functionality
  const handlePrint = async () => {
    if (exporting) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      showError('Print Failed', 'Please allow popups to print the students list.')
      return
    }
    const currentDate = new Date().toLocaleDateString()
    try {
      setExporting(true)
      try { showLoadingHint('Preparing print…', 8) } catch {}
      try { setLoadingProgress(10) } catch {}
      const all = await fetchAllStudentsForExport()
      const exportStudents = filterStudentsForExport(all)
      try { setLoadingProgress(80) } catch {}

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Students List - ${currentDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #333; font-size: 24px; }
            .header .school-name { font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
            .header p { margin: 5px 0; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .student-avatar { width: 30px; height: 30px; border-radius: 50%; background: #e0e7ff; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">${schoolName}</div>
            <h1>Students List</h1>
            <p>Total Students: ${exportStudents.length}</p>
            <p>Generated on: ${currentDate}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Admission No</th>
                <th>Name</th>
                <th>UPI Number</th>
                <th>Class</th>
                <th>Guardian Phone</th>
              </tr>
            </thead>
            <tbody>
              ${exportStudents.map(student => `
                <tr>
                  <td>${student.admission_no}</td>
                  <td>
                    <div class="student-avatar">
                      ${student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    ${student.name}
                  </td>
                  <td>${student.upi_number || 'N/A'}</td>
                  <td>${student.klass_detail?.name || student.klass || 'Not Assigned'}</td>
                  <td>${student.guardian_id || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Powered by Edu-Track</p>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
    } catch (e) {
      try { printWindow.close() } catch {}
      showError('Print Failed', 'Could not prepare the students list for printing.')
    } finally {
      setExporting(false)
      try { setLoadingProgress(100); clearLoadingHint() } catch {}
    }
  }

  // Handle CSV download functionality
  const handleDownload = async () => {
    if (exporting) return
    try {
      setExporting(true)
      try { showLoadingHint('Preparing download…', 8) } catch {}
      try { setLoadingProgress(10) } catch {}
      const all = await fetchAllStudentsForExport()
      const exportStudents = filterStudentsForExport(all)
      try { setLoadingProgress(80) } catch {}
      const csvContent = [
        // Header row
        ['Admission No', 'Name', 'UPI Number', 'Date of Birth', 'Gender', 'Class', 'Guardian Phone'],
        // Data rows
        ...exportStudents.map(student => [
          student.admission_no,
          student.name,
          student.upi_number || 'N/A',
          student.dob || 'N/A',
          student.gender || 'N/A',
          student.klass_detail?.name || student.klass || 'Not Assigned',
          student.guardian_id || 'N/A'
        ])
      ]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `students_list_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      showError('Download Failed', 'Could not prepare the students list for download.')
    } finally {
      setExporting(false)
      try { setLoadingProgress(100); clearLoadingHint() } catch {}
    }
  }

  return (
    <div className="w-full space-y-5 pb-20 text-left">
      {/* Hero (exact screenshot style) */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-elevated">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <div className="text-xl sm:text-2xl font-black tracking-tight">Students</div>
            </div>
            <div className="mt-1 text-sm text-white/85 font-medium">Manage and view all student information</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={currentYearLabel || ''}
                onChange={() => {}}
                className="h-10 rounded-xl bg-white/95 text-gray-900 border border-white/50 px-3 pr-8 text-sm font-semibold shadow-sm focus:outline-none"
              >
                <option value={currentYearLabel || ''}>{currentYearLabel || 'Year'}</option>
              </select>
            </div>
            <button
              type="button"
              className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"
              title="Students"
              aria-label="Students"
            >
              <GraduationCap size={18} className="text-white/90" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black text-gray-500">Total Students</div>
              <div className="mt-1 text-2xl font-black text-gray-900">{Number(studentsTotal || 0).toLocaleString()}</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">All enrolled students</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">👥</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black text-gray-500">Male Students</div>
              <div className="mt-1 text-2xl font-black text-gray-900">{Number(maleCount || 0).toLocaleString()}</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">{studentsTotal ? `${Math.round((maleCount / (studentsTotal || 1)) * 1000) / 10}% of total` : ''}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center">♂</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black text-gray-500">Female Students</div>
              <div className="mt-1 text-2xl font-black text-gray-900">{Number(femaleCount || 0).toLocaleString()}</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">{studentsTotal ? `${Math.round((femaleCount / (studentsTotal || 1)) * 1000) / 10}% of total` : ''}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">♀</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black text-gray-500">New Admissions</div>
              <div className="mt-1 text-2xl font-black text-gray-900">{Number(summary?.newAdmissionsAcademicYear ?? summary?.newAdmissions ?? 0).toLocaleString()}</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">This academic year</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">➕</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black text-gray-500">Average Age</div>
              <div className="mt-1 text-2xl font-black text-gray-900">{summary?.studentsAvgAge != null ? Number(summary.studentsAvgAge).toLocaleString() : '—'}</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">Years</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">🗓️</div>
          </div>
        </div>
      </div>

        <button
          onClick={()=> setShowAddStudent(true)}
          aria-label="Enroll student"
          title="Enroll student"
          className="md:hidden fixed right-4 bottom-24 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-gray-950 px-4 text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-slate-400/40"
        >
          <UserPlus size={16} />
          Enroll
        </button>

      {/* Filters row (exact screenshot placement) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search students by name, roll number, or email..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="h-11 w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 text-sm font-semibold focus:border-indigo-500 transition-all outline-none"
              />
            </div>

            <select
              value={filterClass}
              onChange={(e)=>{ setFilterClass(e.target.value); setPage(1) }}
              className="h-11 w-full sm:w-44 bg-white border border-slate-200 rounded-xl px-3 text-sm font-semibold focus:border-indigo-500 transition-all outline-none"
            >
              <option value="">All Classes</option>
              {classOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={filterGender}
              onChange={(e)=>{ setFilterGender(e.target.value); setPage(1) }}
              className="h-11 w-full sm:w-40 bg-white border border-slate-200 rounded-xl px-3 text-sm font-semibold focus:border-indigo-500 transition-all outline-none"
            >
              <option value="">All Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e)=>{
                const v = e.target.value
                setFilterStatus(v)
                setPage(1)
                if (v === 'graduated') setTab('graduated')
                else if (v === 'inactive') setTab('inactive')
                else if (v === 'active') setTab('active')
                else setTab('all')
              }}
              className="h-11 w-full sm:w-40 bg-white border border-slate-200 rounded-xl px-3 text-sm font-semibold focus:border-indigo-500 transition-all outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleDownload}
              disabled={exporting}
              className="h-11 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => setShowAddStudent(true)}
              className="h-11 px-4 rounded-xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 inline-flex items-center gap-2"
            >
              <UserPlus size={16} />
              Add Student
            </button>
          </div>
        </div>
      </div>

        {/* Mobile Card List */}
        <div className="sm:hidden space-y-3">
          {isLoading ? (
            <div className="rounded-[1.5rem] border border-white/80 bg-white p-4 text-sm font-semibold text-slate-600 shadow-lg shadow-slate-200/70">Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/80 bg-white p-6 text-center text-sm font-semibold text-slate-600 shadow-lg shadow-slate-200/70">No students found</div>
          ) : (
            filteredStudents.map((s) => (
              <div key={s.id} className="relative overflow-hidden rounded-[1.5rem] border border-white/80 bg-white p-3.5 shadow-lg shadow-slate-200/70">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(s.id)}
                    onChange={()=> toggleSelectStudent(s.id)}
                    aria-label={`Select ${s.name}`}
                    className="mt-2 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-200 shrink-0">
                    {s.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/admin/students/${s.id}`} className="font-semibold text-gray-900 hover:underline truncate block leading-snug">{s.name}</Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono bg-gray-100 text-gray-700 border border-gray-200">
                            {s.admission_no}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/admin/students/${s.id}`}
                        className="shrink-0 inline-flex items-center justify-center h-9 px-3 text-xs font-black rounded-xl bg-slate-950 text-white hover:bg-slate-800"
                      >
                        View
                      </Link>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <div className="col-span-3 min-w-0 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 truncate">
                        {s.klass_detail?.name || s.klass || 'Not Assigned'}
                      </div>
                      <button
                        onClick={()=>handleAction(s, 'deactivate')}
                        className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-black transition-all ${s.is_active ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={()=>handleAction(s, 'transfer')}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-100 transition-all"
                      >
                        ✈️ Transfer
                      </button>
                      <button
                        onClick={()=>handleAction(s, 'delete')}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[10px] font-black text-rose-700 hover:bg-rose-100 transition-all"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {studentsNext && (
          <div className="sm:hidden flex justify-center pt-2 pb-28">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}

      {/* Students table (screenshot style) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 text-[10px] uppercase tracking-wider text-gray-500 border-b">
              <tr>
                <th className="py-3 px-5 text-left">Student</th>
                <th className="py-3 px-5 text-left">Roll Number</th>
                <th className="py-3 px-5 text-left">Class</th>
                <th className="py-3 px-5 text-left">Date of Birth</th>
                <th className="py-3 px-5 text-left">Gender</th>
                <th className="py-3 px-5 text-left">Parent/Guardian</th>
                <th className="py-3 px-5 text-left">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-500 font-semibold">Loading students...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-500 font-semibold">No students found.</td></tr>
              ) : (
                filteredStudents.map((s) => {
                  const name = s?.name || 'Student'
                  const email = s?.email || ''
                  const roll = s?.admission_no || '—'
                  const klassName = s?.klass_detail?.name || 'Not Assigned'
                  const dob = s?.dob ? new Date(s.dob).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
                  const gender = String(s?.gender || '').toLowerCase()
                  const guardianName = s?.guardian_name || '—'
                  const guardianPhone = s?.guardian_id || ''
                  const isActive = typeof s?.is_active === 'boolean' ? s.is_active : true
                  return (
                    <tr key={s.id} className="text-gray-800">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xs">
                            {String(name).split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link to={`/admin/students/${s.id}`} className="font-bold text-gray-900 hover:underline truncate block">{name}</Link>
                            <div className="text-xs text-gray-500 truncate">{email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-gray-700 font-semibold">{roll}</td>
                      <td className="py-3 px-5 text-gray-700 font-semibold">{klassName}</td>
                      <td className="py-3 px-5 text-gray-700 font-semibold">{dob}</td>
                      <td className="py-3 px-5">
                        {gender ? (
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${
                            gender === 'female' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}>{gender === 'female' ? 'Female' : 'Male'}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-5">
                        <div className="text-sm font-bold text-gray-900">{guardianName}</div>
                        <div className="text-xs text-gray-500">{guardianPhone || ''}</div>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${
                          isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>{isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/students/${s.id}`)}
                            className="w-9 h-9 rounded-xl bg-transparent hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                            title="View"
                            aria-label="View"
                          >
                            ⋮
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(s, 'deactivate')}
                            className="hidden"
                            aria-hidden="true"
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t bg-white flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-500">
            Showing {showingFrom} to {showingTo} of {Number(studentsTotal || 0).toLocaleString()} students
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, Number(p || 1) - 1))}
              disabled={Number(page || 1) <= 1}
              className="w-8 h-8 rounded-lg border border-gray-200 bg-white disabled:opacity-50"
              aria-label="Previous page"
              title="Previous"
            >
              ‹
            </button>
            {pageButtons.map((p, idx) => (
              p === '…' ? (
                <span key={`dots-${idx}`} className="px-2 text-sm text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(Number(p))}
                  className={`w-8 h-8 rounded-lg text-sm font-bold border ${
                    Number(page || 1) === Number(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              )
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, Number(p || 1) + 1))}
              disabled={Number(page || 1) >= totalPages}
              className="w-8 h-8 rounded-lg border border-gray-200 bg-white disabled:opacity-50"
              aria-label="Next page"
              title="Next"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      <Modal open={showAddStudent} onClose={()=>setShowAddStudent(false)} title="Enroll New Student" size="lg">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-blue-600 mr-3">ℹ️</div>
              <div className="text-blue-800 text-sm">
                <p className="font-medium mb-1">Account Creation:</p>
                <p>A student account will be automatically created with:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><strong>Username:</strong> Admission Number</li>
                  <li><strong>Password:</strong> Guardian Phone Number</li>
                </ul>
              </div>
            </div>
          </div>

          {addError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="text-red-600 mr-3">⚠️</div>
                <p className="text-red-800 text-sm">{addError}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admission Number *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter admission number"
                value={form.admission_no}
                onChange={e=>setForm({...form, admission_no:e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UPI Number</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter UPI Number (optional)"
                value={form.upi_number}
                onChange={e=>setForm({...form, upi_number:e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter full name"
                value={form.name}
                onChange={e=>setForm({...form, name:e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="date"
                value={form.dob}
                onChange={e=>setForm({...form, dob:e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.gender}
                onChange={e=>setForm({...form, gender:e.target.value})}
                required
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Boarding Status *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.boarding_status}
                onChange={e=>setForm({...form, boarding_status:e.target.value})}
                required
              >
                <option value="day">Day</option>
                <option value="boarding">Boarding</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone Number *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter guardian phone number (will be used as password)"
                value={form.guardian_id}
                onChange={e=>setForm({...form, guardian_id:e.target.value})}
                required
              />
              <p className="text-xs text-gray-500 mt-1">This will be used as the student's login password</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Class</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.klass}
                onChange={e=>setForm({...form, klass:e.target.value})}
              >
                <option value="">Select Class (Optional)</option>
                {classes.map(c=> <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent/Guardian Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter parent/guardian full name"
                value={form.guardian_name}
                onChange={e=>setForm({...form, guardian_name:e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent/Guardian Passport Number</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter passport number (if applicable)"
                value={form.guardian_passport_no}
                onChange={e=>setForm({...form, guardian_passport_no:e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Birth Certificate Number</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter birth certificate number"
                value={form.birth_certificate_no}
                onChange={e=>setForm({...form, birth_certificate_no:e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={()=>setShowAddStudent(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={create}
              className={`px-6 py-2 rounded-lg transition-all duration-200 ${
                addStatus === 'completed'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={addStatus === 'adding'}
            >
              {addStatus === 'adding' ? 'Enrolling Student...' : addStatus === 'completed' ? '✓ Student Enrolled' : 'Enroll Student'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Action Confirmation Modal */}
      <Modal
        open={confirmOpen}
        onClose={() => !confirmSubmitting && setConfirmOpen(false)}
        title="Confirm Action"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This action cannot be undone. Are you sure you want to proceed?
          </p>
          
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="confirmAgree" 
              checked={confirmAgree} 
              onChange={e => setConfirmAgree(e.target.checked)} 
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="confirmAgree" className="text-xs text-gray-700 select-none cursor-pointer font-medium">
              I understand and wish to proceed
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={confirmSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={runIndividualAction}
              disabled={confirmSubmitting || !confirmAgree}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-all bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {confirmSubmitting ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={()=>{ if(!bulkSubmitting){ setBulkOpen(false); setBulkAction(''); } }}
        title={bulkAction === 'delete' ? 'Delete Selected Students' : 'Bulk Update Students'}
        size="md"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            Selected: <span className="font-semibold">{selectedCount}</span>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-gray-800">Admin Verification</div>
              <button
                onClick={requestBulkOtp}
                disabled={bulkOtpSending}
                className="px-3 py-1.5 text-xs rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {bulkOtpSending ? 'Sending…' : (bulkOtpSent ? 'Resend Code' : 'Send Code')}
              </button>
            </div>
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">6-digit code</label>
              <input
                value={bulkOtpCode}
                onChange={(e)=>setBulkOtpCode(String(e.target.value || '').replace(/\D/g,'').slice(0,6))}
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {bulkOtpError ? <div className="text-xs text-red-700 mt-1">{bulkOtpError}</div> : null}
            </div>
          </div>

          {bulkAction === 'gender' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={bulkForm.gender}
                onChange={(e)=> setBulkForm(prev => ({ ...prev, gender: e.target.value }))}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          )}

          {bulkAction === 'klass' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={bulkForm.klass}
                onChange={(e)=> setBulkForm(prev => ({ ...prev, klass: e.target.value }))}
              >
                <option value="">Select Class</option>
                {classes.map(c=> (
                  <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
                ))}
              </select>
            </div>
          )}

          {bulkAction === 'boarding_status' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Boarding Status</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={bulkForm.boarding_status}
                onChange={(e)=> setBulkForm(prev => ({ ...prev, boarding_status: e.target.value }))}
              >
                <option value="">Select Status</option>
                <option value="day">Day</option>
                <option value="boarding">Boarding</option>
              </select>
            </div>
          )}

          {bulkAction === 'delete' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              <p className="font-semibold mb-2">This will permanently delete the selected students.</p>
              <label className="flex items-center gap-2 mt-2 text-red-900">
                <input type="checkbox" checked={bulkAgree} onChange={(e)=>setBulkAgree(e.target.checked)} />
                <span>I understand and agree to delete these students.</span>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={()=>{ if(!bulkSubmitting){ setBulkOpen(false); setBulkAction(''); } }}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={bulkSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={runBulk}
              className={`${bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} px-4 py-2 rounded-lg text-white disabled:opacity-50`}
              disabled={
                bulkSubmitting ||
                selectedCount === 0 ||
                String(bulkOtpCode || '').length !== 6 ||
                (bulkAction === 'delete' ? !bulkAgree : false) ||
                (bulkAction === 'gender' ? !bulkForm.gender : false) ||
                (bulkAction === 'klass' ? !bulkForm.klass : false) ||
                (bulkAction === 'boarding_status' ? !bulkForm.boarding_status : false)
              }
            >
              {bulkSubmitting ? 'Please wait...' : (bulkAction === 'delete' ? 'Delete' : 'Update')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
