import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'
import StatCard from '../components/StatCard'
import { showLoadingHint, setLoadingProgress, clearLoadingHint } from '../utils/loading'

// Simple in-memory cache so that navigating away and back within the same
// session can reuse previously loaded data without refetching immediately.
let cachedStudents = null
let cachedClasses = null
let cachedTab = 'active'
let studentsCacheTimestamp = 0
const STUDENTS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export default function AdminStudents(){
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [studentsTotal, setStudentsTotal] = useState(0)
  const [studentsNext, setStudentsNext] = useState('') // pagination next URL for students
  const [loadingMore, setLoadingMore] = useState(false)
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
  const [isLoading, setIsLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmStudent, setConfirmStudent] = useState(null)
  const [confirmTargetActive, setConfirmTargetActive] = useState(true)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const [confirmAgree, setConfirmAgree] = useState(false)

  // Tab: active vs graduated vs inactive
  const [tab, setTab] = useState('active') // 'active' | 'graduated' | 'inactive'
  const [isCompact, setIsCompact] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [statIndex, setStatIndex] = useState(0)

  const { showSuccess, showError } = useNotification()

  const load = async () => {
    try {
      setIsLoading(true)
      try { showLoadingHint('Loading students…', 8) } catch {}
      // Build students query with optional tab/search and server-side grade/class filters
      let base = `/academics/students/`
      const params = new URLSearchParams()
      if (searchTerm) {
        // Search across ALL students (ignore tab constraints)
        params.set('q', searchTerm)
      } else if (tab === 'graduated') {
        params.set('is_graduated', 'true')
      } else if (tab === 'inactive') {
        // Count graduated among inactive: fetch all students with is_active=false (any graduation state)
        params.set('is_active', 'false')
      } else {
        // active
        params.set('is_graduated', 'false')
        params.set('is_active', 'true')
      }
      // Server-side Specific Grade & Class filters (if provided)
      if (filterGrade) params.set('grade', String(filterGrade))
      if (filterClass) params.set('klass', String(filterClass))
      const studentsUrl = `${base}?${params.toString()}`
      try { setLoadingProgress(25) } catch {}
      const [st, cl] = await Promise.all([
        api.get(studentsUrl),
        api.get('/academics/classes/?page_size=200')
      ])
      try { setLoadingProgress(80) } catch {}
      const stIsArray = Array.isArray(st.data)
      const stData = stIsArray ? st.data : (Array.isArray(st.data?.results) ? st.data.results : [])
      const clData = Array.isArray(cl.data) ? cl.data : (Array.isArray(cl.data?.results) ? cl.data.results : [])
      setStudents(stData)
      setClasses(clData)
      // Total count: if paginated, use count; if array response, use length
      setStudentsTotal(stIsArray ? stData.length : (Number(st.data?.count) || stData.length))
      // Save next link for incremental loading (only when paginated)
      setStudentsNext(stIsArray ? '' : (st.data?.next || ''))
      // Update cache for this tab
      cachedStudents = stData
      cachedClasses = clData
      cachedTab = tab
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
      setStudents(prev => prev.concat(arr))
      setStudentsNext(Array.isArray(data) ? '' : (data?.next || ''))
    }catch(e){
      showError('Load Failed', 'Could not load more students.')
      setStudentsNext('')
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

  useEffect(()=>{ 
    // Try to hydrate from cache first for this tab (but not during a search)
    const now = Date.now()
    if (
      !searchTerm &&
      cachedStudents &&
      cachedClasses &&
      cachedTab === tab &&
      now - studentsCacheTimestamp < STUDENTS_CACHE_TTL_MS
    ){
      setStudents(cachedStudents)
      setClasses(cachedClasses)
      setIsLoading(false)
      try { clearLoadingHint() } catch {}
    } else {
      load()
    }
  },[tab, searchTerm])

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
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed to enroll student')
      setAddError(msg)
      showError('Failed to Enroll Student', 'There was an error enrolling the student. Please try again.')
    }
  }

  // Options for grade filter derived from classes
  const gradeOptions = Array.from(new Set(
    (Array.isArray(classes) ? classes : []).map(c => String(c?.grade_level ?? c?.grade)).filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b))

  const classOptions = (Array.isArray(classes) ? classes : []).filter(c => !filterGrade || String(c.grade_level) === String(filterGrade))

  // Filter students based on search term and selected filters
  const filteredStudents = students.filter(student => {
    const lower = searchTerm.toLowerCase()
    const searchMatch = !searchTerm ||
      student.name.toLowerCase().includes(lower) ||
      student.admission_no.toLowerCase().includes(lower) ||
      (student.klass_detail?.name || '').toLowerCase().includes(lower)

    if (!searchMatch) return false

    // Class and grade helpers
    const klassId = student.klass || student.klass_detail?.id
    const klassObj = classes.find(c => String(c.id) === String(klassId))
    const studentGrade = student.klass_detail?.grade_level ?? klassObj?.grade_level ?? ''

    const genderMatch = !filterGender || String(student.gender || '').toLowerCase() === String(filterGender).toLowerCase()
    const classMatch = !filterClass || String(klassId) === String(filterClass)
    const gradeMatch = !filterGrade || String(studentGrade) === String(filterGrade)

    return genderMatch && classMatch && gradeMatch
  })

  // Handle print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    const currentDate = new Date().toLocaleDateString()

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
            <p>Total Students: ${students.length}</p>
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
              ${filteredStudents.map(student => `
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
  }

  // Handle CSV download functionality
  const handleDownload = () => {
    const csvContent = [
      // Header row
      ['Admission No', 'Name', 'UPI Number', 'Date of Birth', 'Gender', 'Class', 'Guardian Phone'],
      // Data rows
      ...filteredStudents.map(student => [
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
  }

  return (
    <React.Fragment>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Students</h1>
            <p className="text-gray-600 mt-1">Manage and organize your student records</p>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible flex-nowrap sm:flex-wrap">
            <button
              onClick={() => setShowAddStudent(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors shrink-0"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Enroll Student
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-md transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {(() => {
          const newThisMonth = students.filter(s => {
            const studentDate = new Date(s.created_at || s.id)
            const now = new Date()
            return studentDate.getMonth() === now.getMonth() && studentDate.getFullYear() === now.getFullYear()
          }).length

          const cards = [
            (
              <StatCard
                title="Students"
                value={isLoading ? 0 : studentsTotal}
                icon="👥"
                accent="from-brand-500 to-brand-600"
                animate
                format={(v)=>v.toLocaleString()}
                trend={0}
                size="sm"
              />
            ),
            (
              <StatCard
                title="Active Classes"
                value={isLoading ? 0 : classes.length}
                icon="🏫"
                accent="from-emerald-500 to-emerald-600"
                animate
                format={(v)=>v.toLocaleString()}
                trend={0}
                size="sm"
              />
            ),
            (
              <StatCard
                title="New This Month"
                value={isLoading ? 0 : newThisMonth}
                icon="📈"
                accent="from-fuchsia-500 to-fuchsia-600"
                animate
                format={(v)=>v.toLocaleString()}
                trend={0}
                size="sm"
              />
            )
          ]

          if (isCompact) {
            return (
              <div className="relative overflow-hidden">
                <div
                  className="flex"
                  style={{ transform: `translateX(-${statIndex * 100}%)`, transition: 'transform 500ms ease' }}
                >
                  {cards.map((c, idx) => (
                    <div key={idx} className="min-w-full shrink-0 pr-0">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            )
          }
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {cards}
            </div>
          )
        })()}

        {/* Quick Actions banner */}
        <div className="hidden md:block relative overflow-hidden rounded-2xl shadow-elevated p-4 text-white bg-gradient-to-r from-brand-600 via-indigo-600 to-fuchsia-600">
          <div className="pointer-events-none absolute -top-8 right-0 w-40 h-40 rounded-full bg-white/20 blur-2 opacity-20" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-white/90">Quick Actions</div>
              <div className="text-base font-semibold">Enroll Student</div>
              <div className="text-xs text-white/80">Add new enrollment</div>
            </div>
            <button
              onClick={() => setShowAddStudent(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-md transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add New Student
            </button>
          </div>
        </div>

        <button
          onClick={()=> setShowAddStudent(true)}
          aria-label="Enroll student"
          title="Enroll student"
          className="md:hidden fixed right-4 bottom-24 z-40 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white shadow-soft"
        >
          + Enroll
        </button>

        {/* Tabs: Active / Graduated / Inactive */}
        <div className="mt-2 inline-flex w-full max-w-xs rounded-full bg-gray-100 p-0.5 shadow-inner">
          <button
            className={`flex-1 px-2.5 py-1.5 text-[11px] font-medium rounded-full border transition-colors ${
              tab==='active'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-transparent text-gray-700 border-transparent hover:bg-white'
            }`}
            onClick={()=>{ setTab('active'); setSearchTerm(''); setSearchDraft(''); }}
          >
            Active
          </button>
          <button
            className={`flex-1 px-2.5 py-1.5 text-[11px] font-medium rounded-full border transition-colors ${
              tab==='graduated'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-transparent text-gray-700 border-transparent hover:bg-white'
            }`}
            onClick={()=>{ setTab('graduated'); setSearchTerm(''); setSearchDraft(''); }}
          >
            Graduated
          </button>
          <button
            className={`flex-1 px-2.5 py-1.5 text-[11px] font-medium rounded-full border transition-colors ${
              tab==='inactive'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-transparent text-gray-700 border-transparent hover:bg-white'
            }`}
            onClick={()=>{ setTab('inactive'); setSearchTerm(''); setSearchDraft(''); }}
          >
            Inactive
          </button>
        </div>

        {/* Mobile toolbar */}
        <div className="sm:hidden space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search students..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="pl-10 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <button
              onClick={()=> setSearchTerm(searchDraft)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.35-4.65a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              Search
            </button>
            <button
              onClick={()=> setShowFilters(v=>!v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h18M6 12h12m-9 8h6"/></svg>
              Filters
            </button>
          </div>
          {showFilters && (
            <div className="p-3 rounded-xl border border-gray-200 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 space-y-2">
              {tab==='active' && (
                <div className="flex items-center gap-2">
                  <select
                    value={filterGrade}
                    onChange={(e)=>{ setFilterGrade(e.target.value); setFilterClass('') }}
                    className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Grades</option>
                    {gradeOptions.map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                  <select
                    value={filterClass}
                    onChange={(e)=>setFilterClass(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Classes</option>
                    {classOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.grade_level ? `- ${c.grade_level}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={filterGender}
                  onChange={(e)=>setFilterGender(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <button
                  onClick={()=>{ setFilterGrade(''); setFilterClass(''); setFilterGender(''); setSearchTerm(''); setSearchDraft('') }}
                  className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >Clear</button>
              </div>
            </div>
          )}
        </div>

        {/* Filters & Search Toolbar (desktop) */}
        <div className="hidden sm:flex items-center gap-2.5 flex-wrap">
          {/* Filters */}
          {tab==='active' && (
          <select
            value={filterGrade}
            onChange={(e)=>{ setFilterGrade(e.target.value); setFilterClass('') }}
            className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Grades</option>
            {gradeOptions.map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
          )}
          {tab==='active' && (
          <select
            value={filterClass}
            onChange={(e)=>setFilterClass(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Classes</option>
            {classOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.grade_level ? `- ${c.grade_level}` : ''}</option>
            ))}
          </select>
          )}
          <select
            value={filterGender}
            onChange={(e)=>setFilterGender(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <button
            onClick={()=>{ setFilterGrade(''); setFilterClass(''); setFilterGender(''); setSearchTerm(''); setSearchDraft('') }}
            className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <div className="relative">
            <input
              type="text"
              placeholder="Search students..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="pl-10 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <button
            onClick={()=> setSearchTerm(searchDraft)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.35-4.65a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Search
          </button>
        </div>

        {/* Mobile Card List */}
        <div className="sm:hidden space-y-3">
          {isLoading ? (
            <div className="bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl p-3 shadow-card">Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl p-6 text-center text-gray-600">No students found</div>
          ) : (
            filteredStudents.map((s) => (
              <div key={s.id} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 shadow-card p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-soft">
                    {s.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <Link to={`/admin/students/${s.id}`} className="font-semibold text-gray-900 hover:underline truncate block">{s.name}</Link>
                    <div className="text-xs text-gray-500 font-mono truncate">{s.admission_no}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/admin/students/${s.id}`} className="px-2 py-1.5 text-xs rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200">View</Link>
                    <button
                      onClick={()=>{ setConfirmStudent(s); setConfirmTargetActive(!s.is_active); setConfirmAgree(false); setConfirmOpen(true); }}
                      className={`${s.is_active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'} px-2 py-1.5 text-xs rounded-lg`}
                    >{s.is_active ? 'Deactivate' : 'Activate'}</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Students Table (desktop) */}
        <div className="hidden sm:block bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{searchTerm ? 'Search Results' : (tab==='active' ? 'Active Students' : (tab==='inactive' ? 'Inactive Students' : 'Graduated Students'))}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredStudents.length} of {studentsTotal} students
                  {searchTerm && ` matching "${searchTerm}"`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${tab==='active'?'bg-green-400': (tab==='inactive'?'bg-red-400':'bg-gray-400')}`}></div>
                  {tab==='active'?'Active': (tab==='inactive'?'Inactive':'Graduated')}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Student Details
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Class Info
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-12 text-center">
                      <div className="flex items-center justify-center gap-3 text-gray-600">
                        <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        <span>Loading students...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-16 text-center">
                      <div className="text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-lg font-semibold text-gray-600">No students found</p>
                        <p className="text-sm text-gray-500 mt-2">
                          {searchTerm ? 'Try adjusting your search terms' : 'Get started by enrolling your first student'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, index) => (
                    <tr key={s.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 group">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm mr-4 shadow-md">
                            {s.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <Link
                              className="text-blue-600 hover:text-blue-800 font-semibold text-base hover:underline transition-colors"
                              to={`/admin/students/${s.id}`}
                            >
                              {s.name}
                            </Link>
                            <p className="text-sm text-gray-500 font-mono">{s.admission_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {tab==='active' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
                            {s.klass_detail?.name || s.klass || 'Not Assigned'}
                          </span>
                        ) : tab==='inactive' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                            <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            <div className="w-2 h-2 rounded-full bg-gray-500 mr-2"></div>
                            Graduated{s.graduation_year ? ` • ${s.graduation_year}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">{s.guardian_id || 'N/A'}</div>
                        <div className="text-xs text-gray-500">Guardian Phone</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/admin/students/${s.id}`}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </Link>
                          <button
                            onClick={()=>{ setConfirmStudent(s); setConfirmTargetActive(!s.is_active); setConfirmAgree(false); setConfirmOpen(true); }}
                            className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${s.is_active ? 'text-red-700 bg-red-100 hover:bg-red-200 border-transparent focus:ring-red-500' : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border-transparent focus:ring-emerald-500'}`}
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m-4-4h8" />
                            </svg>
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {/* Load More row */}
            {studentsNext && (
              <div className="px-5 py-3 border-t bg-white flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load More'}
                </button>
              </div>
            )}
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

      <Modal
        open={confirmOpen}
        onClose={()=>{ if(!confirmSubmitting){ setConfirmOpen(false); setConfirmStudent(null); } }}
        title={confirmTargetActive ? 'Activate Student' : 'Deactivate Student'}
        size="md"
      >
        <div className="space-y-4">
          {!confirmTargetActive && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              <p className="font-semibold mb-2">Before you deactivate, please acknowledge:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>The student will not be counted among exam participants.</li>
                <li>The student will not be assigned fees or new invoices.</li>
                <li>The student will not receive emails or messages.</li>
                <li>Their login will be disabled immediately.</li>
                <li>Admins can still view the student record from the admin side.</li>
              </ul>
              <label className="flex items-center gap-2 mt-3 text-red-900">
                <input type="checkbox" checked={confirmAgree} onChange={(e)=>setConfirmAgree(e.target.checked)} />
                <span>I understand and agree to deactivate this student.</span>
              </label>
            </div>
          )}
          {confirmTargetActive && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
              <p className="font-semibold mb-2">Activate this student?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>The student will be eligible for exams.</li>
                <li>Fees and invoices may be assigned again.</li>
                <li>They may receive emails and messages.</li>
                <li>Their login will be enabled.</li>
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={()=>{ if(!confirmSubmitting){ setConfirmOpen(false); setConfirmStudent(null); } }}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={confirmSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={async ()=>{
                if(!confirmStudent) return;
                if(!confirmTargetActive && !confirmAgree) return;
                try{
                  setConfirmSubmitting(true)
                  await api.post(`/academics/students/${confirmStudent.id}/set-active/`, { is_active: confirmTargetActive })
                  await load()
                  setConfirmOpen(false)
                  setConfirmStudent(null)
                }catch(e){
                }finally{
                  setConfirmSubmitting(false)
                }
              }}
              className={`${confirmTargetActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} px-4 py-2 rounded-lg text-white disabled:opacity-50`}
              disabled={confirmSubmitting || (!confirmTargetActive ? !confirmAgree : false)}
            >
              {confirmSubmitting ? 'Please wait...' : (confirmTargetActive ? 'Activate' : 'Deactivate')}
            </button>
          </div>
        </div>
      </Modal>
    </React.Fragment>
  )
}
