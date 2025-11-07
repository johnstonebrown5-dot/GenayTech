import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'

export default function AdminFees({ embed=false, initialTab='categories' }){
  const [tab, setTab] = useState(initialTab) // categories | classFees | specialAssignments | arrears | payments
  const { showSuccess, showError } = useNotification()
  const [counts, setCounts] = useState({ categories: null, classFees: null, studentFees: null, specialAssignments: null, arrears: null, payments: null, methods: null })
  const [loadingCounts, setLoadingCounts] = useState({ categories: true, classFees: true, studentFees: true, specialAssignments: true, arrears: true, payments: true, methods: true })
  const onCount = (key, value) => setCounts(prev=>({ ...prev, [key]: value }))
  const onLoading = (key, value) => setLoadingCounts(prev=>({ ...prev, [key]: value }))
  const content = (
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Fees Management</h1>
                  <p className="text-sm text-gray-600 mt-1">Manage fee categories, assignments, and student balances</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-4 overflow-x-auto no-scrollbar py-1" aria-label="Tabs">
              {[
                { id: 'categories', name: 'Fee Categories', icon: '📋' },
                { id: 'classFees', name: 'Assign Class Fees', icon: '💰' },
                { id: 'studentFees', name: 'Per-Student Fees', icon: '👤' },
                { id: 'arrears', name: 'Balances & Arrears', icon: '📊' },
                { id: 'payments', name: 'Payment History', icon: '💳' },
                { id: 'methods', name: 'Payment Methods', icon: '⚙️' },
              ].map((tabItem) => (
                <button
                  key={tabItem.id}
                  onClick={() => setTab(tabItem.id)}
                  className={`shrink-0 group relative py-3 sm:py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                    tab === tabItem.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{tabItem.icon}</span>
                    <span>{tabItem.name}</span>
                    {loadingCounts[tabItem.id] ? (
                      <div className={`inline-flex items-center justify-center w-6 h-4 rounded-full animate-pulse ${
                        tab === tabItem.id ? 'bg-blue-200' : 'bg-gray-200'
                      }`}>
                        <div className={`w-3 h-2 rounded-sm ${tab === tabItem.id ? 'bg-blue-400' : 'bg-gray-400'}`} />
                      </div>
                    ) : (
                      <span className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1 text-[10px] font-semibold rounded-full ${
                        tab === tabItem.id ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {counts[tabItem.id] ?? 0}
                      </span>
                    )}
                  </div>
                  {/* Active tab indicator */}
                  {tab === tabItem.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="transition-all duration-300 ease-in-out">
            {tab==='categories' && <FeeCategories showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('categories', n)} onLoading={(v)=>onLoading('categories', v)} />}
            {tab==='classFees' && <ClassFees showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('classFees', n)} onLoading={(v)=>onLoading('classFees', v)} />}
            {tab==='studentFees' && <StudentFees showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('studentFees', n)} onLoading={(v)=>onLoading('studentFees', v)} />}
            {tab==='arrears' && <Arrears showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('arrears', n)} onLoading={(v)=>onLoading('arrears', v)} />}
            {tab==='payments' && <PaymentHistory showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('payments', n)} onLoading={(v)=>onLoading('payments', v)} />}
            {tab==='methods' && <PaymentMethods showSuccess={showSuccess} showError={showError} onCount={(n)=>onCount('methods', n)} onLoading={(v)=>onLoading('methods', v)} />}
          </div>
        </div>
      </div>
  )
  return embed ? content : (
    <AdminLayout>
      {content}
    </AdminLayout>
  )
}

function StudentFees({ showSuccess, showError, onCount, onLoading }){
  const [items, setItems] = useState([])
  const [students, setStudents] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ student:'', fee_category:'', amount:'', due_date:'' })
  const [currentTerm, setCurrentTerm] = useState(null)
  const [currentYear, setCurrentYear] = useState(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [count, setCount] = useState(0)
  const [nextUrl, setNextUrl] = useState(null)
  const [prevUrl, setPrevUrl] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({ fee_category:'', amount:'', due_date:'' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentOpen, setStudentOpen] = useState(false)

  const filteredItems = useMemo(()=>{
    const q = query.trim().toLowerCase()
    if (!q) return items
    return (Array.isArray(items)?items:[]).filter(it =>
      String(it.student_name||'').toLowerCase().includes(q) ||
      String(it.fee_category_name||'').toLowerCase().includes(q) ||
      String(it.amount||'').includes(q)
    )
  }, [items, query])

  // Lookup maps for display names
  const studentsById = useMemo(()=>{
    const map = new Map()
    ;(Array.isArray(students)?students:[]).forEach(s=>map.set(String(s.id), s))
    return map
  }, [students])
  const categoriesById = useMemo(()=>{
    const map = new Map()
    ;(Array.isArray(categories)?categories:[]).forEach(c=>map.set(String(c.id), c))
    return map
  }, [categories])
  const displayItems = useMemo(()=>{
    return (Array.isArray(filteredItems)?filteredItems:[]).map(it=>{
      const s = studentsById.get(String(it.student)) || null
      const c = categoriesById.get(String(it.fee_category)) || null
      return {
        ...it,
        _student_name: it.student_name || (s ? (s.name || `${s.first_name||''} ${s.last_name||''}`) : it.student),
        _class_name: s ? (s.class || s.klass || '') : '',
        _category_name: it.fee_category_name || (c ? c.name : it.fee_category),
      }
    })
  }, [filteredItems, studentsById, categoriesById])

  const load = async (opts={}) => {
    setLoading(true)
    onLoading?.(true)
    try {
      const params = new URLSearchParams()
      const p = Number(opts.page || page)
      const ps = Number(opts.pageSize || pageSize)
      if (p && ps) { params.set('page', String(p)); params.set('page_size', String(ps)) }
      const [sf, st, cats, termRes, yearRes] = await Promise.allSettled([
        api.get('/finance/student-fees/' + (params.toString()?`?${params.toString()}`:'')),
        api.get('/academics/students/'),
        api.get('/finance/fee-categories/'),
        api.get('/academics/terms/current/'),
        api.get('/academics/academic_years/current/'),
      ])

      const toArr = (res) => Array.isArray(res?.value?.data) ? res.value.data : (Array.isArray(res?.value?.data?.results) ? res.value.data.results : [])

      const sfData = sf.status==='fulfilled' ? sf.value.data : []
      const sfArr = Array.isArray(sfData) ? sfData : (Array.isArray(sfData?.results) ? sfData.results : [])
      const sfCount = Array.isArray(sfData) ? sfArr.length : Number(sfData?.count||sfArr.length)
      setCount(sfCount||0)
      setNextUrl(sfData?.next||null)
      setPrevUrl(sfData?.previous||null)

      const stArr = st.status==='fulfilled' ? toArr(st) : []
      const catsArrAll = cats.status==='fulfilled' ? toArr(cats) : []
      const catsArr = catsArrAll.filter(c => !!c.is_special)

      setCurrentTerm(termRes.status==='fulfilled' ? (termRes.value?.data || null) : null)
      setCurrentYear(yearRes.status==='fulfilled' ? (yearRes.value?.data || null) : null)

      setItems(sfArr)
      setStudents(stArr)
      setCategories(catsArr)
      onCount?.(sfCount || sfArr.length)

      if (sf.status==='rejected' && sf.reason?.response?.status===404) {
        showError?.('Per-Student Fees Unavailable', 'Endpoint /finance/student-fees/ not found. Please enable it on the backend.')
      }

      if (st.status==='rejected' && st.reason?.response?.status===404) {
        showError?.('Students Endpoint Unavailable', 'Endpoint /academics/students/ not found.')
      }
      if (cats.status==='rejected' && cats.reason?.response?.status===404) {
        showError?.('Fee Categories Unavailable', 'Endpoint /finance/fee-categories/ not found.')
      }
      if (termRes.status==='rejected' && termRes.reason?.response?.status===404) {
        // optional: terms current endpoint missing
      }
      if (yearRes.status==='rejected' && yearRes.reason?.response?.status===404) {
        // optional: academic years current endpoint missing
      }
    } catch (err) {
      showError?.('Failed to Load Per-Student Fees', err?.message || 'Failed')
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ load() },[])

  const selectedStudent = useMemo(()=> (Array.isArray(students)?students:[]).find(s=>String(s.id)===String(form.student)), [students, form.student])
  const filteredStudentOptions = useMemo(()=>{
    const src = Array.isArray(students)?students:[]
    const q = (studentSearch||'').trim().toLowerCase()
    if (!q) return src.slice(0,50)
    return src.filter(s => {
      const name = String(s.name || `${s.first_name||''} ${s.last_name||''}`).toLowerCase()
      const adm = String(s.admission_no||'').toLowerCase()
      const klass = String(s.class||s.klass||'').toLowerCase()
      return name.includes(q) || adm.includes(q) || klass.includes(q)
    }).slice(0,50)
  }, [students, studentSearch])

  const create = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        student: form.student,
        fee_category: form.fee_category,
        amount: parseFloat(form.amount),
        due_date: form.due_date || null,
        // Backend expects these fields
        year: Number(currentYear?.label || currentYear?.year || new Date().getFullYear()),
        term: Number(currentTerm?.number || currentTerm?.term || 1),
      }
      await api.post('/finance/student-fees/', payload)
      showSuccess?.('Per-Student Fee Assigned', 'The fee has been assigned to the student.')
      setForm({ student:'', fee_category:'', amount:'', due_date:'' })
      load()
    } catch (err) {
      if (err?.response?.status===404) {
        showError?.('Per-Student Fees Unavailable', 'Cannot create per-student fee because the endpoint was not found.')
      } else if (err?.response?.status===400) {
        const data = err?.response?.data
        const dupMsg = data?.non_field_errors?.[0]
        if (dupMsg && dupMsg.toLowerCase().includes('unique')) {
          const s = studentsById.get(String(form.student))
          const c = categoriesById.get(String(form.fee_category))
          const sName = s ? (s.name || `${s.first_name||''} ${s.last_name||''}`) : 'Student'
          const cName = c ? c.name : 'Category'
          const t = Number(currentTerm?.number || 1)
          const y = Number(currentYear?.year || currentYear?.label || new Date().getFullYear())
          const msg = `${sName} already has ${cName} for Term ${t}, ${y}.`
          setError(msg)
          showError?.('Duplicate Assignment', msg)
        } else {
          setError(data ? JSON.stringify(data) : (err?.message || 'Failed'))
          showError?.('Failed to Assign', 'There was an error assigning the fee.')
        }
      } else {
        setError(err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
        showError?.('Failed to Assign', 'There was an error assigning the fee.')
      }
    }
  }

  const startEdit = (it) => {
    setEditItem(it)
    setEditForm({
      fee_category: it.fee_category || '',
      amount: it.amount || '',
      due_date: it.due_date || ''
    })
  }

  const saveEdit = async (e) => {
    e?.preventDefault?.()
    if (!editItem) return
    setSavingEdit(true)
    try {
      const payload = {
        fee_category: editForm.fee_category || editItem.fee_category,
        amount: parseFloat(editForm.amount),
        due_date: editForm.due_date || null,
        student: editItem.student, // keep same student
      }
      await api.put(`/finance/student-fees/${editItem.id}/`, payload)
      showSuccess?.('Updated', 'Per-student fee updated.')
      setEditItem(null)
      setSavingEdit(false)
      load({ page })
    } catch (err) {
      setSavingEdit(false)
      if (err?.response?.status===404) {
        showError?.('Update Failed', 'Endpoint not found.')
      } else {
        showError?.('Update Failed', err?.response?.data ? JSON.stringify(err.response.data) : (err?.message||'Failed'))
      }
    }
  }

  const deleteItem = async (it) => {
    if (!window.confirm('Delete this per-student fee assignment?')) return
    try {
      await api.delete(`/finance/student-fees/${it.id}/`)
      showSuccess?.('Deleted', 'Per-student fee removed.')
      load({ page })
    } catch (err) {
      if (err?.response?.status===404) showError?.('Delete Failed', 'Endpoint not found.')
      else showError?.('Delete Failed', err?.response?.data ? JSON.stringify(err.response.data) : (err?.message||'Failed'))
    }
  }

  const exportCSV = async () => {
    // Try server export first
    try {
      const { data } = await api.get('/finance/student-fees/export', { responseType: 'blob' })
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'student_fees.csv'
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url)
      return
    } catch (err) {
      if (err?.response?.status !== 404) {
        showError?.('Export Failed', err?.message || 'Failed')
      }
      // Fallback to client-side export of current page
      const rows = [
        ['id','student','category','amount','due_date']
      ]
      ;(Array.isArray(items)?items:[]).forEach(it=>{
        rows.push([
          it.id,
          (it.student_name||it.student||'').toString().replaceAll(',', ' '),
          (it.fee_category_name||it.fee_category||'').toString().replaceAll(',', ' '),
          it.amount,
          it.due_date||''
        ])
      })
      const csv = rows.map(r=>r.join(',')).join('\n')
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `student_fees_p${page}.csv`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      showSuccess?.('Exported', 'Downloaded CSV for current list.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Assign Per-Student Fee</h3>
          <div className="text-sm text-gray-500">{loading? 'Loading…' : `${items.length} assignments`}</div>
        </div>
        {error && (
          <div className="mb-4 p-3 text-sm bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
        )}
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Search name/admission/class"
                value={studentSearch || (selectedStudent ? (selectedStudent.name || `${selectedStudent.first_name||''} ${selectedStudent.last_name||''}`) : '')}
                onChange={e=>{ setStudentSearch(e.target.value); if (form.student) setForm({...form, student:''}) }}
                onFocus={()=>setStudentOpen(true)}
                onBlur={()=>setTimeout(()=>setStudentOpen(false), 150)}
                required={!form.student}
              />
              {studentOpen && (
                <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
                  {filteredStudentOptions.length===0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {filteredStudentOptions.map(s => (
                        <li key={s.id} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer" onMouseDown={()=>{ setForm({...form, student:String(s.id)}); setStudentSearch(''); setStudentOpen(false) }}>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            <span>{s.name || `${s.first_name||''} ${s.last_name||''}`}</span>
                            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">{s.class || s.klass || 'Class ?'}</span>
                          </div>
                          <div className="text-xs text-gray-500">{s.admission_no ? `ADM ${s.admission_no}`: ''}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {selectedStudent && (
              <div className="mt-1 text-xs text-gray-600">Selected: <span className="font-medium">{selectedStudent.name || `${selectedStudent.first_name||''} ${selectedStudent.last_name||''}`}</span> — <span className="text-gray-700">{selectedStudent.class || selectedStudent.klass || 'Class ?'}</span>{selectedStudent.admission_no ? ` • ADM ${selectedStudent.admission_no}` : ''}</div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category <span className="text-red-500">*</span></label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={form.fee_category} onChange={e=>setForm({...form, fee_category:e.target.value})} required>
              <option value="">Select special category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (KES) <span className="text-red-500">*</span></label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-md" type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-md" type="date" value={form.due_date} onChange={e=>setForm({...form, due_date:e.target.value})} />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Assign</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between gap-3">
          <h4 className="font-semibold text-gray-800">Existing Assignments</h4>
          <div className="flex items-center gap-2">
            <input placeholder="Search student/category/amount" className="px-3 py-2 border border-gray-300 rounded-md text-sm" value={query} onChange={e=>setQuery(e.target.value)} />
            <button onClick={exportCSV} className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Export CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading…</div>
          ) : displayItems.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No per-student fees found.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayItems.slice(0,200).map(it => (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">{it._student_name}{it._class_name ? ` – ${it._class_name}` : ''}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{it._category_name}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">KES {Number(it.amount||0).toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{it.due_date || '-'}</td>
                    <td className="px-6 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <button onClick={()=>startEdit(it)} className="text-blue-600 hover:underline font-medium">Edit</button>
                        <button onClick={()=>deleteItem(it)} className="text-red-600 hover:underline font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 text-sm text-gray-600">
          <div>Showing page {page} • {count} total</div>
          <div className="flex items-center gap-2">
            <button disabled={!prevUrl && page<=1} onClick={()=>{ setPage(p=>Math.max(1,p-1)); load({ page: Math.max(1,page-1) }) }} className={`px-3 py-1.5 border rounded-md ${(!prevUrl && page<=1)?'text-gray-400 bg-gray-100':'bg-white hover:bg-gray-50'}`}>Prev</button>
            <button disabled={!nextUrl && (count<=page*pageSize)} onClick={()=>{ setPage(p=>p+1); load({ page: page+1 }) }} className={`px-3 py-1.5 border rounded-md ${(!nextUrl && (count<=page*pageSize))?'text-gray-400 bg-gray-100':'bg-white hover:bg-gray-50'}`}>Next</button>
            <select className="ml-2 px-2 py-1 border rounded-md" value={pageSize} onChange={e=>{ const val=Number(e.target.value); setPageSize(val); setPage(1); load({ page:1, pageSize:val }) }}>
              {[10,20,50,100].map(n=>(<option key={n} value={n}>{n}/page</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <Modal open={!!editItem} onClose={()=>setEditItem(null)} title="Edit Per-Student Fee">
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={editForm.fee_category} onChange={e=>setEditForm({...editForm, fee_category:e.target.value})}>
                  {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (KES)</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-md" type="number" step="0.01" value={editForm.amount} onChange={e=>setEditForm({...editForm, amount:e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-md" type="date" value={editForm.due_date||''} onChange={e=>setEditForm({...editForm, due_date:e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={()=>setEditItem(null)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button disabled={savingEdit} className={`px-4 py-2 text-sm font-medium rounded-md ${savingEdit ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  )
}

function SpecialAssignments({ showSuccess, showError, onCount, onLoading }){
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [klass, setKlass] = useState('')
  const [form, setForm] = useState({ fee_category:'', amount:'', due_date:'' })
  const [selected, setSelected] = useState([])

  const filteredCategories = useMemo(()=> (Array.isArray(categories)?categories:[]).filter(c=>!!c.is_special), [categories])
  const filteredStudents = useMemo(()=>{
    const base = Array.isArray(students)?students:[]
    const byClass = klass ? base.filter(s => String(s.class_id||s.klass||'')===String(klass)) : base
    const q = query.trim().toLowerCase()
    if (!q) return byClass
    return byClass.filter(s => String(s.name || `${s.first_name||''} ${s.last_name||''}`).toLowerCase().includes(q) || String(s.admission_no||'').toLowerCase().includes(q))
  }, [students, klass, query])

  const load = async () => {
    setLoading(true)
    onLoading?.(true)
    try {
      const [st, cl, cats] = await Promise.allSettled([
        api.get('/academics/students/'),
        api.get('/academics/classes/'),
        api.get('/finance/fee-categories/'),
      ])
      const toArr = (res) => Array.isArray(res?.value?.data) ? res.value.data : (Array.isArray(res?.value?.data?.results) ? res.value.data.results : [])
      setStudents(st.status==='fulfilled' ? toArr(st) : [])
      setClasses(cl.status==='fulfilled' ? toArr(cl) : [])
      setCategories(cats.status==='fulfilled' ? toArr(cats) : [])
      onCount?.(0)
      if (st.status==='rejected' && st.reason?.response?.status===404) showError?.('Students Endpoint Unavailable', 'Endpoint /academics/students/ not found.')
      if (cl.status==='rejected' && cl.reason?.response?.status===404) showError?.('Classes Endpoint Unavailable', 'Endpoint /academics/classes/ not found.')
      if (cats.status==='rejected' && cats.reason?.response?.status===404) showError?.('Fee Categories Unavailable', 'Endpoint /finance/fee-categories/ not found.')
    } catch (err) {
      showError?.('Failed to Load Data', err?.message || 'Failed')
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ load() },[])

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  }

  const assignBulk = async () => {
    if (!form.fee_category || !form.amount || selected.length===0) return
    setLoading(true)
    try {
      const payloads = selected.map(sid => ({ student: sid, fee_category: form.fee_category, amount: parseFloat(form.amount), due_date: form.due_date || null }))
      const results = await Promise.allSettled(payloads.map(p => api.post('/finance/student-fees/', p)))
      const ok = results.filter(r=>r.status==='fulfilled').length
      const fail = results.length - ok
      showSuccess?.('Special Assignments', `Created ${ok} assignments${fail? `, ${fail} failed`:''}.`)
      setSelected([])
    } catch (err) {
      if (err?.response?.status===404) {
        showError?.('Special Assignments Unavailable', 'Endpoint /finance/student-fees/ not found for creating assignments.')
      } else {
        showError?.('Failed to Assign', err?.message || 'Failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Bulk Special Assignments</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={klass} onChange={e=>setKlass(e.target.value)}>
              <option value="">All classes</option>
              {classes.map(c => (<option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Search students" value={query} onChange={e=>setQuery(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category <span className="text-red-500">*</span></label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={form.fee_category} onChange={e=>setForm({...form, fee_category:e.target.value})} required>
              <option value="">Select special category</option>
              {filteredCategories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (KES) <span className="text-red-500">*</span></label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-md" type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-md" type="date" value={form.due_date} onChange={e=>setForm({...form, due_date:e.target.value})} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600"><span className="font-medium">{selected.length}</span> selected</div>
          <button disabled={!form.fee_category || !form.amount || selected.length===0 || loading} onClick={assignBulk} className={`px-5 py-2 rounded-md text-sm font-medium ${(!form.fee_category || !form.amount || selected.length===0 || loading) ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Assign to Selected</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <h4 className="font-semibold text-gray-800">Select Students</h4>
          <div className="text-sm text-gray-500">{loading? 'Loading…' : `${filteredStudents.length} shown`}</div>
        </div>
        <div className="overflow-y-auto max-h-[480px]">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading…</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No students match your filters.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredStudents.map(s => (
                <li key={s.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{s.name || `${s.first_name||''} ${s.last_name||''}`}</div>
                    <div className="text-xs text-gray-500 truncate">{s.class || s.klass || ''} {s.admission_no ? `• ADM ${s.admission_no}`:''}</div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggle(s.id)} />
                    <span className="text-gray-700">Select</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function PaymentMethods({ showSuccess, showError, onCount, onLoading }){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)

  const load = async () => {
    setLoading(true)
    onLoading?.(true)
    try {
      const { data } = await api.get('/finance/payment-methods/')
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setItems(arr)
      onCount?.(arr.length)
    } catch (err) {
      showError?.('Failed to Load Payment Methods', err?.message || 'Failed')
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ load() },[])

  const toggle = async (item) => {
    const id = item.id
    const next = !item.enabled
    setSavingId(id)
    try {
      await api.patch(`/finance/payment-methods/${id}/`, { enabled: next })
      setItems(prev => prev.map(it => it.id===id ? { ...it, enabled: next } : it))
      showSuccess?.('Payment Method Updated', `${String(item.key).toUpperCase()} ${next? 'enabled' : 'disabled'}.`)
    } catch (err) {
      showError?.('Failed to Update Method', err?.message || 'Failed')
    } finally {
      setSavingId(null)
    }
  }

  const label = (k) => {
    const map = { cash: 'Cash', mpesa: 'Mpesa', bank: 'Bank', cheque: 'Cheque' }
    return map[String(k).toLowerCase()] || k
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Payment Methods</h3>
          </div>
          <div className="text-sm text-gray-500">{loading? 'Loading…' : `${items.length} methods`}</div>
        </div>
        <div className="mt-4 divide-y">
          {loading ? (
            <div className="p-3 text-sm text-gray-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No methods found.</div>
          ) : (
            items.map(m => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{label(m.key)}</div>
                  <div className="text-xs text-gray-500">Key: {m.key}</div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!m.enabled} onChange={()=>toggle(m)} disabled={savingId===m.id} />
                  <span className="text-gray-700">Enabled</span>
                </label>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500">Disabled methods cannot be used when recording payments or initiating STK.</div>
    </div>
  )
}

function PaymentHistory({ showError, onCount, onLoading }){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [filters, setFilters] = useState({ q:'', startDate:'', endDate:'' })
  const [sortBy, setSortBy] = useState('date') // date | amount | invoice | method | recorder
  const [sortDir, setSortDir] = useState('desc') // asc | desc
  const load = async (params={}) => {
    setLoading(true)
    onLoading?.(true)
    try {
      const query = new URLSearchParams(params).toString()
      const url = '/finance/payments/' + (query? `?${query}`:'')
      const { data } = await api.get(url)
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setItems(arr)
      onCount?.(arr.length)
    } catch (err) {
      showError?.('Failed to Load Payments', err?.message || 'Failed')
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ load() },[])

  const applyFilters = (e) => {
    e?.preventDefault?.()
    const params = {}
    if (filters.startDate) params.start_date = filters.startDate
    if (filters.endDate) params.end_date = filters.endDate
    load(params)
  }

  const clearFilters = () => {
    setFilters({ q:'', startDate:'', endDate:'' })
    load({})
  }

  const filteredList = useMemo(()=>{
    const q = filters.q.trim().toLowerCase()
    const src = Array.isArray(items) ? items : []
    if (!q) return src
    return src.filter(p => {
      const invoice = String(p.invoice || p.invoice_id || '').toLowerCase()
      const method = String(p.method||'').toLowerCase()
      const ref = String(p.reference||'').toLowerCase()
      const rec = String(p.recorded_by_name || p.recorded_by || '').toLowerCase()
      const amount = String(p.amount||'')
      return invoice.includes(q) || method.includes(q) || ref.includes(q) || rec.includes(q) || amount.includes(q)
    })
  }, [items, filters.q])

  const displayed = useMemo(()=>{
    const base = Array.isArray(filteredList) ? filteredList : []
    const arr = [...base]
    const val = (p) => {
      switch (sortBy) {
        case 'amount': return Number(p.amount)||0
        case 'invoice': return Number(p.invoice || p.invoice_id) || 0
        case 'method': return String(p.method||'').toLowerCase()
        case 'recorder': return String(p.recorded_by_name || p.recorded_by || '').toLowerCase()
        case 'date':
        default: return new Date(p.created_at).getTime() || 0
      }
    }
    arr.sort((a,b)=>{
      const av = val(a); const bv = val(b)
      if (typeof av === 'number' && typeof bv === 'number') return av - bv
      return String(av).localeCompare(String(bv))
    })
    if (sortDir === 'desc') arr.reverse()
    return arr
  }, [filteredList, sortBy, sortDir])

  const printResults = async () => {
    try {
      const params = {}
      if (filters.startDate) params.start_date = filters.startDate
      if (filters.endDate) params.end_date = filters.endDate
      const { data } = await api.get('/finance/payments/export', { params, responseType: 'blob' })
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0,10)
      a.download = `payments_${filters.startDate||'all'}_${filters.endDate||date}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showError?.('Failed to Export Payments', err?.message || 'Failed')
    }
  }

  const viewReceipt = async (payment) => {
    setReceiptOpen(true)
    setReceiptLoading(true)
    setReceiptData(null)
    try {
      const { data } = await api.get(`/finance/payments/${payment.id}/receipt/`)
      setReceiptData(data)
    } catch (err) {
      showError?.('Failed to Load Receipt', err?.message || 'Failed')
      setReceiptOpen(false)
    } finally {
      setReceiptLoading(false)
    }
  }

  const printReceipt = () => {
    if (!receiptData) return
    const w = window.open('', '_blank', 'width=720,height=900')
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Receipt ${receiptData.receipt_no}</title>
      <style>
        :root{--bg:#0f172a;--primary:#2563eb;--muted:#6b7280;--border:#e5e7eb;--fg:#0b1220}
        *{box-sizing:border-box}
        body{margin:0;background:#f6f8fb;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:var(--fg)}
        .page{max-width:820px;margin:24px auto;padding:0 16px}
        .card{background:#fff;border-radius:14px;box-shadow:0 8px 28px rgba(2,6,23,.06),0 2px 6px rgba(2,6,23,.06);overflow:hidden}
        .brand{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:linear-gradient(135deg,#f0f6ff,#ffffff)}
        .brand-title{display:flex;align-items:center;gap:12px}
        .logo{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,var(--primary),#60a5fa);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700}
        .school{font-size:18px;font-weight:800;letter-spacing:.2px}
        .meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:var(--muted)}
        .badge{background:#eef2ff;color:#3730a3;border:1px solid #e0e7ff;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:700}
        .section{padding:18px 24px;border-top:1px solid var(--border)}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .label{font-size:12px;color:var(--muted);margin-bottom:6px}
        .value{font-weight:600}
        table{width:100%;border-collapse:separate;border-spacing:0 10px;margin-top:6px}
        .row{background:#f9fafb;border:1px solid var(--border);border-radius:10px}
        .row td{padding:12px 14px}
        .total{background:#0ea5e914;color:#0b4a6f;border-color:#bae6fd;font-weight:800}
        .right{text-align:right}
        .footer{padding:18px 24px;color:var(--muted);font-size:12px}
        @media print{body{background:#fff}.page{margin:0;max-width:none}.brand{background:#fff;border-bottom:1px solid var(--border)}.card{box-shadow:none;border:0;border-radius:0}}
      </style></head><body>
      <div class="page"><div class="card">
        <div class="brand">
          <div class="brand-title">
            <div class="logo">ET</div>
            <div>
              <div class="school">${receiptData.school?.name || 'Receipt'}</div>
              <div class="meta">${new Date(receiptData.date).toLocaleString()}</div>
            </div>
          </div>
          <div class="badge">${receiptData.receipt_no}</div>
        </div>
        <div class="section">
          <div class="grid">
            <div>
              <div class="label">Student</div>
              <div class="value">${receiptData.student?.name || ''}</div>
              <div class="meta">${receiptData.student?.class || ''} ${receiptData.student?.admission_no ? '• ADM '+receiptData.student.admission_no : ''}</div>
            </div>
            <div class="right">
              <div class="label">Invoice</div>
              <div class="value">#${receiptData.invoice}</div>
              <div class="meta">Invoice Amount • KES ${(receiptData.invoice_amount||0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <table>
            <tbody>
              <tr class="row"><td>Payment Method</td><td class="right">${receiptData.method}</td></tr>
              <tr class="row"><td>Reference</td><td class="right">${receiptData.reference || '-'}</td></tr>
              <tr class="row"><td>Invoice Paid (to date)</td><td class="right">KES ${(receiptData.invoice_paid||0).toLocaleString()}</td></tr>
              <tr class="row"><td>Invoice Balance</td><td class="right">KES ${(receiptData.invoice_balance||0).toLocaleString()}</td></tr>
              <tr class="row"><td>Student Balance</td><td class="right">KES ${(receiptData.student_balance||0).toLocaleString()}</td></tr>
              <tr class="row total"><td>Total Paid</td><td class="right">KES ${(receiptData.amount||0).toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="footer">This is a system generated receipt. Thank you for your payment.</div>
      </div></div>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Payment History</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="hidden sm:block px-2 py-1 text-sm border border-gray-300 rounded-md"
              value={sortBy}
              onChange={e=>setSortBy(e.target.value)}
            >
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
              <option value="invoice">Sort: Invoice</option>
              <option value="method">Sort: Method</option>
              <option value="recorder">Sort: Recorder</option>
            </select>
            <button onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')} className="hidden sm:inline-flex px-2 py-1 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50" title="Toggle sort direction">{sortDir==='asc'?'Asc':'Desc'}</button>
            <button onClick={printResults} className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Print Results</button>
            <div className="text-sm text-gray-500">
              {loading ? (
                <span className="inline-flex items-center gap-2"><div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin"></div> Loading...</span>
              ) : (
                <span className="inline-flex items-center gap-1"><span className="font-semibold text-gray-900">{(Array.isArray(filteredList)?filteredList:[]).length}</span> payments</span>
              )}
            </div>
          </div>
        </div>
        {/* Filters */}
        <form onSubmit={applyFilters} className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <input
              placeholder="Search (invoice, method, reference, recorder)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.q}
              onChange={e=>setFilters({...filters, q:e.target.value})}
            />
          </div>
          <div>
            <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={filters.startDate} onChange={e=>setFilters({...filters, startDate:e.target.value})} />
          </div>
          <div>
            <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={filters.endDate} onChange={e=>setFilters({...filters, endDate:e.target.value})} />
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">Apply Filters</button>
            <button type="button" onClick={clearFilters} className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Clear</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        {/* Mobile cards */}
        <div className="grid gap-2 md:hidden p-4">
          {loading ? (
            Array.from({length:3}).map((_,i)=>(
              <div key={`p-m-${i}`} className="p-3 rounded-xl border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No payments recorded.</div>
          ) : (
            items.slice(0,20).map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200">
                <div className="min-w-0">
                  <div className="font-medium truncate">KES {Number(p.amount).toLocaleString()} • {p.method}</div>
                  <div className="text-xs text-gray-500 truncate">Inv #{p.invoice || p.invoice_id} • {new Date(p.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => viewReceipt(p)} className="text-blue-600 text-xs font-medium hover:underline">Receipt</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                Array.from({length:4}).map((_,i)=> (
                  <tr key={`p-${i}`}>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">No payments found.</td>
                </tr>
              ) : (
                displayed.slice(0, 200).map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#{p.invoice || p.invoice_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.method}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.reference || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">KES {Number(p.amount).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.recorded_by_name || p.recorded_by || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button onClick={() => viewReceipt(p)} className="text-blue-600 hover:underline font-medium">Receipt</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={receiptOpen} onClose={()=>setReceiptOpen(false)} title={receiptData ? `Receipt ${receiptData.receipt_no}` : 'Receipt'}>
        {receiptLoading ? (
          <div className="p-4 text-sm text-gray-600">Loading receipt…</div>
        ) : !receiptData ? (
          <div className="p-4 text-sm text-red-600">Failed to load receipt.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-gray-500">Date</div>
                <div className="font-medium">{new Date(receiptData.date).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Receipt No</div>
                <div className="font-semibold">{receiptData.receipt_no}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Student</div>
                <div className="font-medium">{receiptData.student?.name}</div>
                <div className="text-sm text-gray-500">{receiptData.student?.class}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Invoice</div>
                <div className="font-medium">#{receiptData.invoice}</div>
                <div className="text-sm text-gray-500">Invoice Amount: KES {(receiptData.invoice_amount||0).toLocaleString()}</div>
              </div>
            </div>
            <div className="border rounded-md">
              <div className="flex justify-between p-3 border-b text-sm">
                <span>Method</span><span className="font-medium">{receiptData.method}</span>
              </div>
              <div className="flex justify-between p-3 border-b text-sm">
                <span>Reference</span><span className="font-medium">{receiptData.reference || '-'}</span>
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span>Total Paid</span><span className="font-semibold">KES {(receiptData.amount||0).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setReceiptOpen(false)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Close</button>
              <button onClick={printReceipt} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">Print</button>
            </div>
          </div>
        )
      }
      </Modal>

      </div>

  )
}

function FeeCategories({ showSuccess, showError, onCount, onLoading }){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name:'', description:'', is_special:false })
  const [error, setError] = useState('')
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({ name:'', description:'', is_special:false })
  const [savingEdit, setSavingEdit] = useState(false)
  const load = async () => {
    setLoading(true)
    onLoading?.(true)
    try {
      const { data } = await api.get('/finance/fee-categories/')
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setItems(arr)
      onCount?.(arr.length)
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ load() },[])
  const create = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/finance/fee-categories/', form)
      setForm({ name:'', description:'', is_special:false })
      load()
      showSuccess('Fee Category Created', `Fee category "${form.name}" has been successfully created.`)
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
      showError('Failed to Create Fee Category', 'There was an error creating the fee category. Please try again.')
    }
  }
  const startEdit = (item) => {
    setEditItem(item)
    setEditForm({ name: item.name || '', description: item.description || '', is_special: !!item.is_special })
  }
  const saveEdit = async (e) => {
    e?.preventDefault?.()
    if (!editItem) return
    setSavingEdit(true)
    try {
      await api.put(`/finance/fee-categories/${editItem.id}/`, editForm)
      showSuccess('Fee Category Updated', `"${editForm.name}" has been saved.`)
      setEditItem(null)
      setEditForm({ name:'', description:'', is_special:false })
      load()
    } catch (err) {
      showError('Failed to Update Fee Category', err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
    } finally {
      setSavingEdit(false)
    }
  }
  const deleteItem = async (item) => {
    if (!window.confirm(`Delete category "${item.name}"?`)) return
    try {
      await api.delete(`/finance/fee-categories/${item.id}/`)
      showSuccess('Category Deleted', `"${item.name}" removed.`)
      load()
    } catch (err) {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed')
      showError('Failed to Delete Category', msg)
    }
  }
  return (
    <div className="space-y-6">
      {/* Create Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Create Fee Category</h3>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-red-800">Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        <form onSubmit={create} className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              placeholder="e.g., Tuition Fee"
              value={form.name}
              onChange={e=>setForm({...form, name:e.target.value})}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              placeholder="Brief description of the fee category"
              value={form.description}
              onChange={e=>setForm({...form, description:e.target.value})}
            />
          </div>
          <div className="md:col-span-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.is_special} onChange={e=>setForm({...form, is_special:e.target.checked})} />
              <span className="text-gray-800">Is special (per-head)</span>
            </label>
            <div className="text-xs text-gray-500 mt-1">When checked, this category can be assigned per student via the Per-Student Fees tab and cannot be assigned to classes.</div>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Category
            </button>
          </div>
        </form>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Fee Categories</h3>
            </div>
            <div className="text-sm text-gray-500">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  Loading...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-gray-900">{items.length}</span>
                  {items.length === 1 ? 'category' : 'categories'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({length: 3}).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No fee categories</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first fee category above.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="grid gap-2 md:hidden p-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-xs text-gray-500 truncate">{item.description || 'No description'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => startEdit(item)} className="text-blue-600 text-xs font-medium hover:underline">Edit</button>
                      <button onClick={() => deleteItem(item)} className="text-red-600 text-xs font-medium hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-blue-600">{item.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {item.name}
                              {String(item.name||'').trim().toLowerCase()==='boarding fees' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">System</span>
                              )}
                              {!!item.is_special && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">Special</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500 max-w-xs truncate">{item.description || <span className="italic text-gray-400">No description</span>}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="inline-flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Recently
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-4">
                            <button onClick={() => startEdit(item)} className="text-blue-600 hover:underline font-medium">Edit</button>
                            {String(item.name||'').trim().toLowerCase()!== 'boarding fees' ? (
                              <button onClick={() => deleteItem(item)} className="text-red-600 hover:underline font-medium">Delete</button>
                            ) : (
                              <span className="text-gray-400 cursor-not-allowed" title="This category cannot be deleted">Delete</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {editItem && (
        <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Fee Category">
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category Name</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={editForm.name}
                onChange={e=>setEditForm({...editForm, name:e.target.value})}
                required
                disabled={String(editItem?.name||'').trim().toLowerCase()==='boarding fees'}
              />
              {String(editItem?.name||'').trim().toLowerCase()==='boarding fees' && (
                <div className="mt-1 text-xs text-gray-500">Name is system-protected. You can still edit fees under Assign Class Fees.</div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={editForm.description}
                onChange={e=>setEditForm({...editForm, description:e.target.value})}
              />
            </div>
            <div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editForm.is_special} onChange={e=>setEditForm({...editForm, is_special:e.target.checked})} />
                <span className="text-gray-800">Is special (per-head)</span>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button disabled={savingEdit} className={`px-4 py-2 text-sm font-medium rounded-md ${savingEdit ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function ClassFees({ showSuccess, showError, onCount, onLoading }){
  const [classFees, setClassFees] = useState([])
  const [classes, setClasses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ fee_category:'', klass:'', klasses:[], amount:'', year:new Date().getFullYear(), term:'', due_date:'' })
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [selectedClasses, setSelectedClasses] = useState([])
  const [assignmentMode, setAssignmentMode] = useState('single') // 'single' or 'multiple'
  const [moreOpen, setMoreOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editCF, setEditCF] = useState(null)
  const [editForm, setEditForm] = useState({ amount:'', due_date:'', year:'', term:'' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Filter classes based on search term
  const filteredClasses = useMemo(() => {
    if (!searchTerm) return classes
    return classes.filter(cls => cls.name.toLowerCase().includes(searchTerm.toLowerCase()) || cls.grade_level.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [classes, searchTerm])

  const load = async () => {
    setLoading(true)
    onLoading?.(true)
    try {
      const [cf, cl, cats] = await Promise.all([
        api.get('/finance/class-fees/'),
        api.get('/academics/classes/'),
        api.get('/finance/fee-categories/'),
      ])
      const cfArr = Array.isArray(cf.data) ? cf.data : (Array.isArray(cf.data?.results) ? cf.data.results : [])
      const clArr = Array.isArray(cl.data) ? cl.data : (Array.isArray(cl.data?.results) ? cl.data.results : [])
      const catsArr = Array.isArray(cats.data) ? cats.data : (Array.isArray(cats.data?.results) ? cats.data.results : [])
      setClassFees(cfArr)
      setClasses(clArr)
      setCategories(catsArr)
      onCount?.(cfArr.length)
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ load() },[])

  const create = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const hasMulti = Array.isArray(form.klasses) && form.klasses.length > 0
      const payload = {
        fee_category: form.fee_category,
        amount: parseFloat(form.amount),
        year: form.year,
        term: form.term,
        due_date: form.due_date || null,
        ...(hasMulti ? { klasses: form.klasses.map(Number) } : { klass: form.klass })
      }
      await api.post('/finance/class-fees/', payload)
      setForm(f => ({ ...f, amount:'', due_date:'', klass:'', klasses:[] }))
      setSelectedClasses([])
      load()
      const targetDesc = (Array.isArray(form.klasses) && form.klasses.length > 0)
        ? `${form.klasses.length} classes`
        : `class ID ${form.klass}`
      showSuccess('Class Fee Assigned', `Fee of KES ${form.amount} has been assigned to ${targetDesc} for ${form.year} Term ${form.term}.`)
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
      showError('Failed to Assign Class Fee', 'There was an error assigning the class fee. Please try again.')
    }
  }

  const resetForm = () => {
    setForm({ fee_category:'', klass:'', klasses:[], amount:'', year:new Date().getFullYear(), term:'', due_date:'' })
    setSelectedClasses([])
    setError('')
  }

  const getSelectedClassCount = () => {
    if (assignmentMode === 'single') return form.klass ? 1 : 0
    return form.klasses.length
  }

  const startEditCF = (cf) => {
    setEditCF(cf)
    setEditForm({
      amount: cf.amount || '',
      due_date: cf.due_date || '',
      year: cf.year || '',
      term: cf.term || '',
    })
  }

  const saveEditCF = async (e) => {
    e?.preventDefault?.()
    if (!editCF) return
    setSavingEdit(true)
    try {
      const payload = {
        amount: parseFloat(editForm.amount),
        year: editForm.year,
        term: editForm.term,
        due_date: editForm.due_date || null,
        fee_category: editCF.fee_category, // keep same category
        klass: editCF.klass, // keep same class
      }
      await api.put(`/finance/class-fees/${editCF.id}/`, payload)
      showSuccess?.('Fee Assignment Updated', 'The class fee assignment has been updated.')
      setEditCF(null)
      setSavingEdit(false)
      load()
    } catch (err) {
      setSavingEdit(false)
      showError?.('Failed to Update', err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
    }
  }

  const deleteCF = async (cf) => {
    if (!window.confirm('Delete this fee assignment? This cannot be undone.')) return
    try {
      await api.delete(`/finance/class-fees/${cf.id}/`)
      showSuccess?.('Deleted', 'Fee assignment deleted.')
      load()
    } catch (err) {
      showError?.('Failed to Delete', err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Assignment Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Fee Assignment Details</h3>
          <button
            type="button"
            onClick={()=>setShowForm(v=>!v)}
            className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {showForm ? 'Hide Form' : 'New Assignment'}
          </button>
        </div>

        {showForm && error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-red-800">Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        {showForm && (
        <form onSubmit={create} className="space-y-6">
          {/* Assignment Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Assignment Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`relative flex cursor-pointer rounded-lg border py-2.5 px-3 ${assignmentMode === 'single' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                  <input
                    type="radio"
                    name="assignmentMode"
                    value="single"
                    checked={assignmentMode === 'single'}
                    onChange={(e) => setAssignmentMode(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${assignmentMode === 'single' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {assignmentMode === 'single' && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
                    </div>
                    <span className="text-sm font-medium">Single Class</span>
                  </div>
                </label>
                <label className={`relative flex cursor-pointer rounded-lg border py-2.5 px-3 ${assignmentMode === 'multiple' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                  <input
                    type="radio"
                    name="assignmentMode"
                    value="multiple"
                    checked={assignmentMode === 'multiple'}
                    onChange={(e) => setAssignmentMode(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${assignmentMode === 'multiple' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {assignmentMode === 'multiple' && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
                    </div>
                    <span className="text-sm font-medium">Multiple Classes</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {getSelectedClassCount()} class{getSelectedClassCount() !== 1 ? 'es' : ''} selected
            </div>
          </div>

          {/* Fee Category Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fee Category <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={form.fee_category}
                onChange={e=>setForm({...form, fee_category:e.target.value})}
                required
              >
                <option value="">Select a fee category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (KES) <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e=>setForm({...form, amount:e.target.value})}
                required
              />
            </div>
          </div>

          {/* Academic Year and Term */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Academic Year <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                type="number"
                placeholder="2024"
                value={form.year}
                onChange={e=>setForm({...form, year:e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Term <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={form.term}
                onChange={e=>setForm({...form, term:e.target.value})}
                required
              >
                <option value="">Select term</option>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>
          </div>

          {/* Class Selection */}
          {assignmentMode === 'single' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={form.klass}
                onChange={e=>setForm({...form, klass:e.target.value, klasses:[]})}
              >
                <option value="">Choose a class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search & Select Classes
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    type="text"
                    placeholder="Search classes..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                <div className="p-3 space-y-2">
                  {filteredClasses.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No classes found</p>
                  ) : (
                    filteredClasses.map(cls => (
                      <label key={cls.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.klasses.includes(cls.id.toString())}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({...form, klasses: [...form.klasses, cls.id.toString()], klass: ''})
                            } else {
                              setForm({...form, klasses: form.klasses.filter(id => id !== cls.id.toString()), klass: ''})
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{cls.name}</div>
                          <div className="text-xs text-gray-500">{cls.grade_level}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {form.klasses.length > 0 && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{form.klasses.length}</span> class{form.klasses.length !== 1 ? 'es' : ''} selected
                </div>
              )}
            </div>
          )}

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date (Optional)
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              type="date"
              value={form.due_date}
              onChange={e=>setForm({...form, due_date:e.target.value})}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Reset Form
            </button>

            <div className="flex gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={()=>setMoreOpen(v=>!v)}
                className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
              >
                More ▾
              </button>
              {moreOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <button
                    type="button"
                    onClick={()=>{ setShowPreview(v=>!v); setMoreOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={()=>{ resetForm(); setMoreOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Reset Form
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>

              <button
                disabled={!form.fee_category || !form.amount || !form.year || !form.term || getSelectedClassCount() === 0}
                className={`px-6 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                  !form.fee_category || !form.amount || !form.year || !form.term || getSelectedClassCount() === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                Assign Fees ({getSelectedClassCount()} class{getSelectedClassCount() !== 1 ? 'es' : ''})
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
      {/* Preview Section */}
      {showPreview && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Assignment Preview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Fee Category:</span>
                <p className="text-sm text-gray-900">{categories.find(c => c.id === parseInt(form.fee_category))?.name || 'Not selected'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Amount:</span>
                <p className="text-sm text-gray-900">{form.amount ? `KES ${parseFloat(form.amount).toLocaleString()}` : 'Not set'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Academic Year:</span>
                <p className="text-sm text-gray-900">{form.year || 'Not set'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Term:</span>
                <p className="text-sm text-gray-900">{form.term ? `Term ${form.term}` : 'Not selected'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Classes:</span>
                {getSelectedClassCount() > 0 ? (
                  <div className="mt-1 space-y-1">
                    {assignmentMode === 'single' ? (
                      <p className="text-sm text-gray-900">{classes.find(c => c.id === parseInt(form.klass))?.name} - {classes.find(c => c.id === parseInt(form.klass))?.grade_level}</p>
                    ) : (
                      form.klasses.map(classId => {
                        const cls = classes.find(c => c.id === parseInt(classId))
                        return cls ? (
                          <p key={classId} className="text-sm text-gray-900">• {cls.name} - {cls.grade_level}</p>
                        ) : null
                      })
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No classes selected</p>
                )}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Due Date:</span>
                <p className="text-sm text-gray-900">{form.due_date || 'No due date set'}</p>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-500">Total Students:</span>
                <p className="text-sm text-gray-900">
                  {getSelectedClassCount() > 0 ? `Approximately ${getSelectedClassCount() * 25} students will receive invoices` : 'No students will receive invoices'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Assignments Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Recent Fee Assignments</h3>
            <div className="text-sm text-gray-500">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  Loading...
                </span>
              ) : (
                <span>{classFees.length} assignments</span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="grid gap-2 md:hidden">
          {loading ? (
            Array.from({length: 3}).map((_, i) => (
              <div key={`loading-m-${i}`} className="p-3 rounded-xl border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))
          ) : classFees.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No fee assignments found.</div>
          ) : (
            classFees.slice(0,10).map(cf => (
              <div key={cf.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200">
                <div className="min-w-0">
                  <div className="font-medium truncate">{cf.fee_category_detail?.name || cf.fee_category}</div>
                  <div className="text-xs text-gray-500 truncate">{cf.klass_detail || cf.klass} • {cf.year} • T{cf.term}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">KES {Number(cf.amount).toLocaleString()}</div>
                  <div className="text-[11px] text-gray-500">Due {cf.due_date || '-'}</div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <button onClick={()=>startEditCF(cf)} className="text-blue-600 hover:underline font-medium">Edit</button>
                    <button onClick={()=>deleteCF(cf)} className="text-red-600 hover:underline font-medium">Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                Array.from({length: 3}).map((_, i) => (
                  <tr key={`loading-${i}`}>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse"></div></td>
                  </tr>
                ))
              ) : classFees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">No fee assignments found. Create your first assignment above.</td>
                </tr>
              ) : (
                classFees.slice(0, 10).map(cf => (
                  <tr key={cf.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cf.fee_category_detail?.name || cf.fee_category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cf.klass_detail || cf.klass}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cf.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Term {cf.term}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">KES {Number(cf.amount).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cf.due_date || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-4">
                        <button onClick={()=>startEditCF(cf)} className="text-blue-600 hover:underline font-medium">Edit</button>
                        <button onClick={()=>deleteCF(cf)} className="text-red-600 hover:underline font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Edit Modal */}
        {editCF && (
          <Modal open={!!editCF} onClose={()=>setEditCF(null)} title="Edit Fee Assignment">
            <form onSubmit={saveEditCF} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editForm.amount}
                    onChange={e=>setEditForm({...editForm, amount:e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editForm.due_date || ''}
                    onChange={e=>setEditForm({...editForm, due_date:e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editForm.year}
                    onChange={e=>setEditForm({...editForm, year:e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editForm.term}
                    onChange={e=>setEditForm({...editForm, term:e.target.value})}
                    required
                  >
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={()=>setEditCF(null)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button disabled={savingEdit} className={`px-4 py-2 text-sm font-medium rounded-md ${savingEdit ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  )
}

function Arrears({ showSuccess, showError, onCount, onLoading }){
  const [classes, setClasses] = useState([])
  const [items, setItems] = useState([])
  const [klass, setKlass] = useState('')
  const [minBalance, setMinBalance] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState('Dear Parent/Guardian of {student_name} ({class}), your outstanding balance is {balance}. Kindly clear at the earliest. Thank you.')
  const [sendInApp, setSendInApp] = useState(true)
  const [sendSms, setSendSms] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [emailSubject, setEmailSubject] = useState('School Fees Arrears')
  const [sending, setSending] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payStudent, setPayStudent] = useState(null)
  const [payForm, setPayForm] = useState({ amount:'', method:'cash', reference:'' })

  const load = async (params={}) => {
    setLoading(true)
    onLoading?.(true)
    try {
      const query = new URLSearchParams(params).toString()
      const url = '/finance/invoices/arrears/' + (query? `?${query}`:'')
      const { data } = await api.get(url)
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setItems(arr)
      onCount?.(arr.length)
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }
  useEffect(()=>{ (async()=>{
    const { data } = await api.get('/academics/classes/')
    const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
    setClasses(arr)
    load({})
  })() },[])

  const filter = (e) => {
    e.preventDefault()
    const params = {}
    if (klass) params.klass = klass
    if (minBalance) params.min_balance = minBalance
    load(params)
  }

  const openPayForStudent = async (studentItem) => {
    setPayStudent(studentItem)
    setPayOpen(true)
    // No server fetch needed; default amount to student's balance
    setPayForm(f => ({ ...f, amount: studentItem.balance || '' }))
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    if (!payForm.amount || !payStudent?.student_id) return
    try {
      await api.post(`/finance/invoices/pay_student/`, {
        student: payStudent.student_id,
        amount: parseFloat(payForm.amount),
        method: payForm.method,
        reference: payForm.reference,
      })
      showSuccess?.('Payment Recorded', 'The payment has been recorded successfully.')
      setPayOpen(false)
      setPayForm({ amount:'', method:'cash', reference:'' })
      // refresh arrears
      filter(new Event('submit'))
    } catch (err) {
      showError?.('Failed to Record Payment', err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed'))
    }
  }

  const totalArrears = useMemo(()=> (Array.isArray(items)?items:[]).reduce((s, it) => s + (it.balance||0), 0), [items])
  const filteredItems = useMemo(()=>{
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(it =>
      String(it.student_name||'').toLowerCase().includes(q) ||
      String(it.class||'').toLowerCase().includes(q) ||
      String(it.balance||'').includes(q)
    )
  }, [items, query])

  const printArrears = async () => {
    try {
      const params = {}
      if (klass) params.klass = klass
      if (minBalance) params.min_balance = minBalance
      const { data } = await api.get('/finance/invoices/arrears/export', { params, responseType: 'blob' })
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'arrears.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showError?.('Failed to Export Arrears', err?.message || 'Failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Total Arrears</div>
              <div className="text-2xl font-bold text-red-600">
                {loading ? (
                  <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  `KES ${totalArrears.toLocaleString()}`
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Students with Arrears</div>
              <div className="text-2xl font-bold text-blue-600">
                {loading ? (
                  <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  items.length
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Ready to Notify</p>
              <button
                disabled={loading || items.length===0}
                onClick={() => { setNotifyOpen(true); setResultMsg('') }}
                className={`text-sm font-medium transition-colors ${
                  loading || items.length===0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-green-600 hover:text-green-700'
                }`}
              >
                {loading || items.length===0 ? 'No students to notify' : `${items.length} students`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
        </div>

        <form onSubmit={filter} className="grid gap-3 sm:gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class Filter
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
              value={klass}
              onChange={e=>setKlass(e.target.value)}
            >
              <option value="">All Classes</option>
              {(Array.isArray(classes)?classes:[]).map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.grade_level}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Balance (KES)
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={minBalance}
              onChange={e=>setMinBalance(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full md:w-auto px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-orange-100 to-orange-50 border border-orange-200">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">Students with Outstanding Balances</h3>
                <div className="sm:hidden text-xs text-gray-500">Track and notify guardians of unpaid balances</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:block">
                <input
                  placeholder="Search students or class"
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={query}
                  onChange={e=>setQuery(e.target.value)}
                />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
                Total: KES {loading? '…' : totalArrears.toLocaleString()}
              </span>
              <button
                disabled={loading || items.length===0}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors shadow-sm ${
                  loading || items.length===0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-600 text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2'
                }`}
                onClick={()=>{ setNotifyOpen(true); setResultMsg('') }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405M19 13V8a6 6 0 10-12 0v5l-2 2"/></svg>
                {loading || items.length===0 ? 'Notify' : `Notify ${items.length} Students`}
              </button>
              <button
                onClick={printArrears}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold bg-white border border-gray-300 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18h12v4H6zM6 14h12v2H6z"/></svg>
                Print
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-hidden">
          {loading ? (
            <div className="p-6">
              <div className="space-y-4">
                {Array.from({length: 5}).map((_, i) => (
                  <div key={`loading-${i}`} className="animate-pulse">
                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-12"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No students with arrears</h3>
              <p className="mt-1 text-sm text-gray-500">All students are up to date with their payments.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="grid gap-2 md:hidden p-4">
                {filteredItems.map((item) => (
                  <div key={item.student_id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
                        {item.student_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <button type="button" onClick={()=>openPayForStudent(item)} className="font-medium truncate text-blue-700 hover:underline">{item.student_name}</button>
                        <div className="text-xs text-gray-500 truncate">{item.class}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Balance</div>
                      <div className={`text-sm font-semibold ${item.balance>0?'text-red-600':'text-emerald-600'}`}>KES {Number(item.balance).toLocaleString()}</div>
                      <div className="text-[11px] text-gray-500">Billed {Number(item.total_billed).toLocaleString()} • Paid {Number(item.total_paid).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Billed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredItems.map((item, index) => (
                      <tr key={item.student_id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-blue-600">{item.student_name.charAt(0).toUpperCase()}</span>
                            </div>
                            <button type="button" onClick={()=>openPayForStudent(item)} className="text-sm font-medium text-blue-700 hover:underline text-left">{item.student_name}</button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.class}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">KES {Number(item.total_billed).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">KES {Number(item.total_paid).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.balance > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>KES {Number(item.balance).toLocaleString()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal open={payOpen} onClose={()=>setPayOpen(false)} title={payStudent ? `Record Payment — ${payStudent.student_name}` : 'Record Payment'}>
        {payLoading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : (
          <form onSubmit={submitPayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={payForm.amount}
                  onChange={e=>setPayForm({...payForm, amount:e.target.value})}
                  required
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={payForm.method}
                  onChange={e=>setPayForm({...payForm, method:e.target.value})}
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">Mpesa</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Receipt/Txn ref"
                  value={payForm.reference}
                  onChange={e=>setPayForm({...payForm, reference:e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={()=>setPayOpen(false)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">Record Payment</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Notification Modal */}
      <Modal open={notifyOpen} onClose={()=>setNotifyOpen(false)} title="Send Arrears Notifications" size="lg">
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-blue-900">Available Placeholders:</p>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{'{student_name}'}</code>
                    <span className="text-blue-700">Student's full name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{'{class}'}</code>
                    <span className="text-blue-700">Student's class</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{'{balance}'}</code>
                    <span className="text-blue-700">Outstanding balance amount</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={async (e)=>{
            e.preventDefault(); setSending(true); setResultMsg('')
            try {
              const payload = {
                message: notifyMsg,
                klass: klass ? Number(klass) : null,
                min_balance: minBalance ? Number(minBalance) : 0,
                send_in_app: sendInApp,
                send_sms: sendSms,
                send_email: sendEmail,
                email_subject: emailSubject,
              }
              const { data: created } = await api.post('/communications/arrears-campaigns/', payload)
              const { data: result } = await api.post(`/communications/arrears-campaigns/${created.id}/send/`)
              setResultMsg(`Notifications queued: ${result.sent_count}`)
              setNotifyOpen(false)
              showSuccess('Fee Arrears Notifications Sent', `Successfully queued ${result.sent_count} fee arrears notifications.`)
            } catch (err) {
              showError('Failed to Send Notifications', 'There was an error sending the fee arrears notifications. Please try again.')
            } finally {
              setSending(false)
            }
          }} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Message
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                rows={4}
                value={notifyMsg}
                onChange={e=>setNotifyMsg(e.target.value)}
                placeholder="Enter your notification message..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={sendInApp}
                  onChange={e=>setSendInApp(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">In-App</div>
                  <div className="text-sm text-gray-500">Send via app notifications</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={sendSms}
                  onChange={e=>setSendSms(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">SMS</div>
                  <div className="text-sm text-gray-500">Send text messages</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={e=>setSendEmail(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Email</div>
                  <div className="text-sm text-gray-500">Send email notifications</div>
                </div>
              </label>
            </div>

            {sendEmail && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Email subject line"
                  value={emailSubject}
                  onChange={e=>setEmailSubject(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={()=>setNotifyOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={sending}
                className={`px-6 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                  sending
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {sending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </div>
                ) : (
                  'Send Notifications'
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}
