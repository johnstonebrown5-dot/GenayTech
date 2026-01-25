import React, { useEffect, useState } from 'react'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'
import { useAuth } from '../auth'

const roles = ['admin','teacher','student','finance']

export default function AdminUsers(){
  const [users, setUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [filterRole, setFilterRole] = useState('')
  const [form, setForm] = useState({ username:'', password:'', role:'teacher', first_name:'', last_name:'', email:'', phone:'' })
  const [reset, setReset] = useState({ user_id:'', new_password:'' })
  const [roleCounts, setRoleCounts] = useState({ admin:0, teacher:0, student:0, finance:0 })
  const [showCreate, setShowCreate] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [edit, setEdit] = useState({ user_id:'', username:'', first_name:'', last_name:'', email:'', phone:'', role:'', new_password:'' })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const { showSuccess, showError } = useNotification()
  const [selected, setSelected] = useState(new Set())
  const { user: authUser } = useAuth()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(undefined)
  const [showDeleteOtp, setShowDeleteOtp] = useState(false)
  const [deleteIds, setDeleteIds] = useState([])
  const [deleteCode, setDeleteCode] = useState('')
  const [deleteSendingOtp, setDeleteSendingOtp] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)

  const load = async () => {
    setLoading(true)
    // Fetch users filtered by search text from backend and compute role counts locally
    const params = {}
    if (search && search.trim()) params.q = search.trim()
    if (page) params.page = page
    if (pageSize) params.page_size = pageSize
    const { data } = await api.get('/auth/users/', { params })
    const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
    if (typeof data?.count === 'number') setTotalCount(data.count)
    setRoleCounts({
      admin: list.filter(u=>u.role==='admin' || u.is_superuser || u.is_staff).length,
      teacher: list.filter(u=>u.role==='teacher').length,
      student: list.filter(u=>u.role==='student').length,
      finance: list.filter(u=>u.role==='finance').length,
    })
    // Apply current filter to table display
    setUsers(filterRole ? list.filter(u=> (filterRole==='admin'
      ? (u.role==='admin' || u.is_superuser || u.is_staff)
      : u.role===filterRole)) : list)
    setAllUsers(list)
    setLoading(false)
  }

  const isAllSelected = users.length > 0 && users.every(u => selected.has(u.id))
  const isNoneSelected = selected.size === 0
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const clearSelected = () => setSelected(new Set())
  const selectAllVisible = () => setSelected(new Set(users.map(u=>u.id)))
  const toggleSelectAllVisible = () => { isAllSelected ? clearSelected() : selectAllVisible() }

  const bulkSetActive = async (value) => {
    if (selected.size === 0) return
    setLoading(true)
    try {
      const ids = users.filter(u => selected.has(u.id)).map(u=>u.id)
      await Promise.all(ids.map(id => api.post('/auth/users/status/', { user_id: id, is_active: value })))
      clearSelected()
      await load()
      showSuccess('Bulk update', `Updated ${ids.length} user${ids.length!==1?'s':''}.`)
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Bulk update failed.'
      showError('Bulk update failed', msg)
    } finally {
      setLoading(false)
    }
  }

  const beginDelete = async (ids) => {
    const clean = Array.from(new Set((Array.isArray(ids) ? ids : []).map(x => Number(x)).filter(x => !Number.isNaN(x))))
    if (clean.length === 0) return
    setDeleteIds(clean)
    setDeleteCode('')
    setShowDeleteOtp(true)
    setDeleteSendingOtp(true)
    try {
      await api.post('/auth/users/delete/otp/request/', { user_ids: clean })
      showSuccess('OTP Sent', 'A verification code has been sent to your email. Enter it to confirm deletion.')
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to request OTP.'
      showError('Failed to request OTP', msg)
      setShowDeleteOtp(false)
    } finally {
      setDeleteSendingOtp(false)
    }
  }

  const confirmDelete = async (e) => {
    e?.preventDefault?.()
    if (!deleteCode || deleteCode.trim().length === 0) return
    setDeleteConfirming(true)
    try {
      const { data } = await api.post('/auth/users/delete/otp/confirm/', { user_ids: deleteIds, code: deleteCode.trim() })
      const deleted = data?.deleted
      showSuccess('Users Deleted', `Deleted ${typeof deleted === 'number' ? deleted : deleteIds.length} user(s).`)
      setShowDeleteOtp(false)
      setDeleteIds([])
      setDeleteCode('')
      clearSelected()
      await load()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to delete user(s).'
      showError('Delete failed', msg)
    } finally {
      setDeleteConfirming(false)
    }
  }
  // Debounce search + react to role changes
  useEffect(()=>{
    const t = setTimeout(()=>{ load() }, 300)
    return ()=>clearTimeout(t)
  }, [search, filterRole, page, pageSize])

  const create = async (e) => {
    e.preventDefault()
    await api.post('/auth/users/create/', form)
    setForm({ username:'', password:'', role:'teacher', first_name:'', last_name:'', email:'', phone:'' })
    setShowCreate(false)
    load()
  }

  const toggleActive = async (u) => {
    await api.post('/auth/users/status/', { user_id: u.id, is_active: !u.is_active })
    load()
  }

  const openEdit = (u) => {
    setEdit({
      user_id: u.id,
      username: u.username || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || (u.is_superuser ? 'admin' : ''),
      new_password: ''
    })
    setShowEdit(true)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    // Backend allows PATCH with: user_id, first_name, last_name, email, phone, username
    setSavingEdit(true)
    try {
      const { user_id, username, first_name, last_name, email, phone, role, new_password } = edit
      const payload = { user_id, username, first_name, last_name, email, phone }
      if (role) payload.role = role
      await api.patch('/auth/users/update/', payload)
      if (new_password && new_password.trim().length > 0) {
        await api.post('/auth/users/reset_password/', { user_id, new_password })
      }
      setShowEdit(false)
      showSuccess('User updated', 'Changes were saved successfully.')
      load()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to save changes.'
      showError('Update failed', msg)
    } finally {
      setSavingEdit(false)
    }
  }

  const doReset = async (e) => {
    e.preventDefault()
    await api.post('/auth/users/reset_password/', reset)
    setReset({ user_id:'', new_password:'' })
    setShowReset(false)
  }

  return (
    <React.Fragment>
      <div className="space-y-6">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold">User Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">Create, update and manage platform users and access.</p>
            </div>
            {(() => {
              const me = allUsers.find(x => x.id === (authUser?.id))
              const active = me?.is_active ?? authUser?.is_active
              if (typeof active !== 'boolean') return null
              return (
                <span className={`inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border ${active? 'bg-green-50 text-green-700 border-green-200':'bg-red-50 text-red-700 border-red-200'}`}>
                  <span className={`inline-block w-2 h-2 rounded-full ${active? 'bg-green-500':'bg-red-500'}`}></span>
                  Your portal: <strong className="ml-1">{active? 'Active':'Inactive'}</strong>
                </span>
              )
            })()}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card border-hairline p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="font-medium inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-500"><path d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/><path fillRule="evenodd" d="M2.25 20.25a8.25 8.25 0 0116.5 0v.75a.75.75 0 01-.75.75H3a.75.75 0 01-.75-.75v-.75z" clipRule="evenodd"/></svg>
              Create User
            </div>
            <button onClick={()=>setShowCreate(true)} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition">New User</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card border-hairline p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="font-medium inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-500"><path d="M12 6a9 9 0 100 12 9 9 0 000-12zm.75 3a.75.75 0 00-1.5 0v3.19l-1.22.7a.75.75 0 10.76 1.3l1.71-.98A.75.75 0 0012.75 12V9z"/></svg>
              Reset Password
            </div>
            <button onClick={()=>setShowReset(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">Reset Password</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card border-hairline p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4 mb-3">
            <h2 className="font-medium inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 10-3.741-.479zM15 10.5a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5.25 12 5.25c4.478 0 8.268 2.692 9.542 6.75-1.274 4.057-5.064 6.75-9.542 6.75-4.477 0-8.268-2.692-9.542-6.75z"/></svg>
              Users
            </h2>
            <div className="order-3 md:order-none md:ml-auto flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-full border-hairline bg-gray-50">Admin: <strong>{roleCounts.admin}</strong></span>
              <span className="px-2 py-1 rounded-full border-hairline bg-gray-50">Teachers: <strong>{roleCounts.teacher}</strong></span>
              <span className="px-2 py-1 rounded-full border-hairline bg-gray-50">Students: <strong>{roleCounts.student}</strong></span>
              <span className="px-2 py-1 rounded-full border-hairline bg-gray-50">Finance: <strong>{roleCounts.finance}</strong></span>
              {(() => { 
                const cur = allUsers.find(x => x.id === (authUser?.id))
                const status = cur?.is_active ?? authUser?.is_active
                if (typeof status !== 'boolean') return null
                return (
                  <span className={`px-2 py-1 rounded-full border ${status? 'bg-green-50 text-green-700 border-green-200':'bg-red-50 text-red-700 border-red-200'}`}>
                    You: <strong>{status? 'Active':'Inactive'}</strong>
                  </span>
                )
              })()}
            </div>
            <div className="flex gap-2 w-full md:w-auto order-2 md:order-none">
              <div className="relative flex-1 md:w-56">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                <input
                  className="border pl-9 pr-3 py-2 rounded-lg w-full focus-soft"
                  placeholder="Search users..."
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                />
              </div>
              <select className="border p-2 rounded-lg w-36 focus-soft" value={filterRole} onChange={e=>{setFilterRole(e.target.value); setPage(1)}}>
                <option value="">All Roles</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={load} disabled={loading} className={`px-3 py-1.5 rounded-lg border-hairline bg-gray-50 hover:bg-gray-100 transition ${loading? 'opacity-60 cursor-not-allowed':''}`}>{loading? 'Loading...':'Refresh'}</button>
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs text-gray-600">Page size</span>
                <select className="border p-1.5 rounded focus-soft text-sm" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); setPage(1)}}>
                  {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="hidden md:flex items-center gap-2 ml-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4" checked={isAllSelected} onChange={toggleSelectAllVisible} />
                  Select All
                </label>
                {!isNoneSelected && (
                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{selected.size} selected</span>
                )}
              </div>
            </div>
            {/* Bulk actions on mobile */}
            <div className="flex md:hidden items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="w-4 h-4" checked={isAllSelected} onChange={toggleSelectAllVisible} />
                Select All
              </label>
              {!isNoneSelected && (
                <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{selected.size} selected</span>
              )}
            </div>
          </div>
          <div className="relative overflow-x-auto">
            {loading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-700 rounded-full" />
                <span className="ml-2 text-sm text-gray-700">Loading users...</span>
              </div>
            )}
            {/* Mobile list */}
            {!loading && (
              <div className="md:hidden grid gap-3">
                {users.map(u => (
                  <div key={u.id} className={`rounded-xl border-hairline px-3 py-3 shadow-card hover:bg-gray-50 transition ${authUser?.id===u.id ? 'ring-1 ring-indigo-200/70 bg-indigo-50/30':''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input aria-label={`Select ${u.username}`} type="checkbox" className="mt-1 w-4 h-4" checked={selected.has(u.id)} onChange={()=>toggleSelect(u.id)} />
                        <div>
                          <button className="text-indigo-600 font-medium" onClick={()=>openEdit(u)} title="Edit user">{u.username}</button>
                          {authUser?.id===u.id && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 align-middle">You</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">{u.role || (u.is_superuser ? 'superuser' : '')}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="mt-2 text-sm">
                      <button className="text-indigo-600" onClick={()=>openEdit(u)} title="Edit user">{u.first_name} {u.last_name}</button>
                      <div className="text-gray-600 text-xs">{u.email}</div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <div className="flex gap-2">
                        <button onClick={(e)=>{ e.stopPropagation(); toggleActive(u) }} className={`px-3 py-1 rounded-lg border-hairline ${u.is_active? 'text-red-700 bg-red-50 hover:bg-red-100':'text-green-700 bg-green-50 hover:bg-green-100'} transition`}>
                          {u.is_active? 'Deactivate':'Activate'}
                        </button>
                        <button onClick={(e)=>{ e.stopPropagation(); beginDelete([u.id]) }} className="px-3 py-1 rounded-lg border-hairline bg-red-600 text-white hover:bg-red-700 transition">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!loading && users.length===0 && (
                  <div className="text-center text-gray-500 py-6">No users found</div>
                )}
              </div>
            )}

            {/* Desktop table */}
            <table className="hidden md:table w-full text-left text-sm min-w-[900px]">
              <thead className="sticky top-0 bg-white z-10 border-b">
                <tr>
                  <th className="w-10 py-2">
                    <input aria-label="Select all" type="checkbox" className="w-4 h-4" checked={isAllSelected} onChange={toggleSelectAllVisible} />
                  </th>
                  <th className="w-16 py-2">ID</th>
                  <th className="py-2">Username</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Name</th>
                  <th className="hidden lg:table-cell py-2">Email</th>
                  <th className="py-2">
                    <div className="flex items-center gap-2">
                      <span>Status</span>
                      {(() => {
                        const cur = allUsers.find(x => x.id === (authUser?.id))
                        const status = cur?.is_active ?? authUser?.is_active
                        if (typeof status !== 'boolean') return null
                        return (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${status? 'bg-green-50 text-green-700 border-green-200':'bg-red-50 text-red-700 border-red-200'}`}>
                            You: {status? 'Active':'Inactive'}
                          </span>
                        )
                      })()}
                    </div>
                  </th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-gray-50/40">
                {users.map(u => (
                  <tr key={u.id} className={`border-t hover:bg-gray-50 ${authUser?.id===u.id ? 'bg-indigo-50/30':''}`}>
                    <td><input aria-label={`Select ${u.username}`} type="checkbox" className="w-4 h-4" checked={selected.has(u.id)} onChange={()=>toggleSelect(u.id)} /></td>
                    <td>{u.id}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <button className="text-indigo-600 hover:underline" onClick={()=>openEdit(u)} title="Edit user">{u.username}</button>
                        {authUser?.id===u.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">You</span>
                        )}
                      </span>
                    </td>
                    <td className="capitalize">{u.role || (u.is_superuser ? 'superuser' : '')}</td>
                    <td>
                      <button className="text-indigo-600 hover:underline" onClick={()=>openEdit(u)} title="Edit user">
                        {u.first_name} {u.last_name}
                      </button>
                    </td>
                    <td className="hidden lg:table-cell">{u.email}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={(e)=>{ e.stopPropagation(); toggleActive(u) }} className={`px-3 py-1 rounded-lg border-hairline ${u.is_active? 'text-red-700 bg-red-50 hover:bg-red-100':'text-green-700 bg-green-50 hover:bg-green-100'} transition`}>
                          {u.is_active? 'Deactivate':'Activate'}
                        </button>
                        <button onClick={(e)=>{ e.stopPropagation(); beginDelete([u.id]) }} className="px-3 py-1 rounded-lg border-hairline bg-red-600 text-white hover:bg-red-700 transition">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length===0 && (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-6">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Bulk actions bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!isNoneSelected && (
              <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{selected.size} selected</span>
            )}
            <button disabled={isNoneSelected || loading} onClick={()=>bulkSetActive(false)} className={`px-3 py-1.5 rounded-lg border-hairline bg-red-50 text-red-700 hover:bg-red-100 transition ${isNoneSelected||loading? 'opacity-50 cursor-not-allowed':''}`}>Deactivate Selected</button>
            <button disabled={isNoneSelected || loading} onClick={()=>bulkSetActive(true)} className={`px-3 py-1.5 rounded-lg border-hairline bg-green-50 text-green-700 hover:bg-green-100 transition ${isNoneSelected||loading? 'opacity-50 cursor-not-allowed':''}`}>Activate Selected</button>
            <button disabled={isNoneSelected || loading} onClick={()=>beginDelete(users.filter(u => selected.has(u.id)).map(u=>u.id))} className={`px-3 py-1.5 rounded-lg border-hairline bg-red-600 text-white hover:bg-red-700 transition ${isNoneSelected||loading? 'opacity-50 cursor-not-allowed':''}`}>Delete Selected</button>
            {!isNoneSelected && (
              <button onClick={clearSelected} className="px-3 py-1.5 rounded-lg border-hairline bg-gray-50 hover:bg-gray-100 transition">Clear</button>
            )}
          </div>
        </div>
        {/* Pagination controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
          <div>
            {typeof totalCount === 'number' ? (
              <span>
                Showing <strong>{users.length ? (page-1)*pageSize + 1 : 0}</strong>–<strong>{(page-1)*pageSize + users.length}</strong>
                {' '}of <strong>{totalCount}</strong>
              </span>
            ) : (
              <span>Showing <strong>{users.length}</strong> users</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg border-hairline bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
              disabled={page<=1 || loading}
              onClick={()=>setPage(p=>Math.max(1, p-1))}
            >Previous</button>
            <span className="text-xs">Page {page}</span>
            <button
              className="px-3 py-1.5 rounded-lg border-hairline bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
              disabled={loading || (typeof totalCount==='number' ? (page*pageSize)>=totalCount : users.length < pageSize)}
              onClick={()=>setPage(p=>p+1)}
            >Next</button>
          </div>
        </div>
      </div>
      <Modal open={showCreate} onClose={()=>setShowCreate(false)} title="Create User" size="md">
        <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
          <input className="border p-2 rounded" placeholder="Username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} required />
          <input className="border p-2 rounded" placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
          <select className="border p-2 rounded" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
            {roles.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="border p-2 rounded md:col-span-3" placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
          <input className="border p-2 rounded md:col-span-3" placeholder="Phone" type="tel" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
          <input className="border p-2 rounded" placeholder="First name" value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Last name" value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} />
          <div className="md:col-span-3 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowCreate(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-green-600 text-white px-4 py-2 rounded">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={showReset} onClose={()=>setShowReset(false)} title="Reset Password" size="sm">
        <form onSubmit={doReset} className="grid gap-3">
          <input className="border p-2 rounded" placeholder="User ID" value={reset.user_id} onChange={e=>setReset({...reset, user_id:e.target.value})} required />
          <input className="border p-2 rounded" placeholder="New Password" type="password" value={reset.new_password} onChange={e=>setReset({...reset, new_password:e.target.value})} required />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowReset(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Reset</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title="Edit User" size="md">
        <form onSubmit={saveEdit} className="grid gap-3 md:grid-cols-3">
          <input className="border p-2 rounded" placeholder="Username" value={edit.username} onChange={e=>setEdit({...edit, username:e.target.value})} />
          <input className="border p-2 rounded md:col-span-2" placeholder="Email" type="email" value={edit.email} onChange={e=>setEdit({...edit, email:e.target.value})} />
          <input className="border p-2 rounded" placeholder="First name" value={edit.first_name} onChange={e=>setEdit({...edit, first_name:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Last name" value={edit.last_name} onChange={e=>setEdit({...edit, last_name:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Phone" value={edit.phone} onChange={e=>setEdit({...edit, phone:e.target.value})} />
          <select className="border p-2 rounded" value={edit.role} onChange={e=>setEdit({...edit, role:e.target.value})}>
            <option value="">Select role</option>
            {roles.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="border p-2 rounded md:col-span-2" placeholder="New Password (optional)" type="password" value={edit.new_password} onChange={e=>setEdit({...edit, new_password:e.target.value})} />
          <div className="md:col-span-3 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowEdit(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button disabled={savingEdit} className={`bg-indigo-600 text-white px-4 py-2 rounded flex items-center gap-2 ${savingEdit? 'opacity-60 cursor-not-allowed':''}`}>
              {savingEdit && (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showDeleteOtp} onClose={()=>{ if (!deleteSendingOtp && !deleteConfirming) { setShowDeleteOtp(false); setDeleteIds([]); setDeleteCode('') } }} title="Delete User(s)" size="sm">
        <form onSubmit={confirmDelete} className="grid gap-3">
          <div className="text-sm text-gray-700">
            {deleteIds.length === 1 ? (
              <span>Deleting 1 user account requires OTP verification.</span>
            ) : (
              <span>Deleting {deleteIds.length} user accounts requires OTP verification.</span>
            )}
          </div>
          <input
            className="border p-2 rounded"
            placeholder="Enter 6-digit OTP"
            value={deleteCode}
            onChange={e=>setDeleteCode(e.target.value)}
            disabled={deleteSendingOtp || deleteConfirming}
            required
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={()=>{ if (!deleteSendingOtp && !deleteConfirming) { setShowDeleteOtp(false); setDeleteIds([]); setDeleteCode('') } }}
              className="px-4 py-2 rounded border"
              disabled={deleteSendingOtp || deleteConfirming}
            >Cancel</button>
            <button
              type="submit"
              disabled={deleteSendingOtp || deleteConfirming || !deleteCode.trim()}
              className={`bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 ${(deleteSendingOtp || deleteConfirming || !deleteCode.trim())? 'opacity-60 cursor-not-allowed':''}`}
            >
              {(deleteSendingOtp || deleteConfirming) && (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {deleteSendingOtp ? 'Sending OTP...' : deleteConfirming ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </form>
      </Modal>
    </React.Fragment>
  )
}
