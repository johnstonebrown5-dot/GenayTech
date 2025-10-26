import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import AdminLayout from '../components/AdminLayout'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'

export default function AdminStudents(){
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
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

  const { showSuccess, showError } = useNotification()

  const load = async () => {
    try {
      setIsLoading(true)
      // Build students query
      let studentsUrl = `/academics/students/?page_size=2000`
      if (tab === 'graduated') {
        studentsUrl += `&is_graduated=true`
      } else if (tab === 'inactive') {
        // Count graduated among inactive: fetch all students with is_active=false (any graduation state)
        studentsUrl += `&is_active=false`
      } else {
        // active
        studentsUrl += `&is_graduated=false&is_active=true`
      }
      const [st, cl] = await Promise.all([
        api.get(studentsUrl),
        api.get('/academics/classes/?page_size=2000')
      ])
      const stData = Array.isArray(st.data) ? st.data : (Array.isArray(st.data?.results) ? st.data.results : [])
      const clData = Array.isArray(cl.data) ? cl.data : (Array.isArray(cl.data?.results) ? cl.data.results : [])
      setStudents(stData)
      setClasses(clData)
    } catch (e) {
      showError('Load Failed', 'Could not load students or classes.')
    } finally {
      setIsLoading(false)
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
    load()
    loadSchoolName()
  },[tab])

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
    <AdminLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Students</h1>
            <p className="text-gray-600 mt-1">Manage and organize your student records</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print List
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download CSV
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Students</p>
                {isLoading ? (
                  <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Active enrollments</p>
              </div>
              <div className="text-3xl p-2 rounded-lg bg-blue-100 text-blue-600">👥</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Active Classes</p>
                {isLoading ? (
                  <div className="h-7 w-12 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Available sections</p>
              </div>
              <div className="text-3xl p-2 rounded-lg bg-green-100 text-green-600">🏫</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">New This Month</p>
                {isLoading ? (
                  <div className="h-7 w-10 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900">
                    {students.filter(s => {
                      const studentDate = new Date(s.created_at || s.id)
                      const now = new Date()
                      return studentDate.getMonth() === now.getMonth() && studentDate.getFullYear() === now.getFullYear()
                    }).length}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">Recent additions</p>
              </div>
              <div className="text-3xl p-2 rounded-lg bg-purple-100 text-purple-600">📈</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-5 text-white relative overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-105">
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-100 mb-1">Quick Actions</p>
                  <p className="text-lg font-bold text-white">Enroll Student</p>
                  <p className="text-xs text-blue-100 mt-1">Add new enrollment</p>
                </div>
                <div className="text-3xl">➕</div>
              </div>
              <button
                onClick={() => setShowAddStudent(true)}
                className="mt-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 w-full"
              >
                Add New Student
              </button>
            </div>
            {/* Enhanced decorative background elements */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6"></div>
            <div className="absolute bottom-0 right-4 w-16 h-16 bg-white/5 rounded-full translate-y-4 translate-x-4"></div>
            <div className="absolute top-1/2 left-0 w-2 h-12 bg-white/10 rounded-r-full"></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded border text-sm ${tab==='active'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700'}`}
            onClick={()=>{ setTab('active'); setSearchTerm(''); setSearchDraft(''); }}
          >Active Students</button>
          <button
            className={`px-3 py-1.5 rounded border text-sm ${tab==='graduated'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700'}`}
            onClick={()=>{ setTab('graduated'); setSearchTerm(''); setSearchDraft(''); }}
          >Graduated Students</button>
          <button
            className={`px-3 py-1.5 rounded border text-sm ${tab==='inactive'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700'}`}
            onClick={()=>{ setTab('inactive'); setSearchTerm(''); setSearchDraft(''); }}
          >Inactive Students</button>
        </div>

        {/* Filters & Search Toolbar (moved below cards) */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filters */}
          {tab==='active' && (
          <select
            value={filterGrade}
            onChange={(e)=>{ setFilterGrade(e.target.value); setFilterClass('') }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <button
            onClick={()=>{ setFilterGrade(''); setFilterClass(''); setFilterGender(''); setSearchTerm(''); setSearchDraft('') }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <div className="relative">
            <input
              type="text"
              placeholder="Search students..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <button
            onClick={()=> setSearchTerm(searchDraft)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Search
          </button>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{tab==='active' ? 'Active Students' : (tab==='inactive' ? 'Inactive Students' : 'Graduated Students')}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredStudents.length} of {students.length} students
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Student Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Class Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
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
                    <td colSpan="4" className="px-6 py-16 text-center">
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
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">{s.guardian_id || 'N/A'}</div>
                        <div className="text-xs text-gray-500">Guardian Phone</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
    </AdminLayout>
  )
}
