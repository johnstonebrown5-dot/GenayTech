import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'

export default function AdminStaff(){
  const [users, setUsers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ username:'', password:'', first_name:'', last_name:'', email:'' })
  const [showAttach, setShowAttach] = useState(false)
  const [attachUserId, setAttachUserId] = useState('')
  const [savingAttach, setSavingAttach] = useState(false)
  const [attachForm, setAttachForm] = useState({ department:'', position:'', national_id:'', kra_pin:'', nhif_no:'', nssf_no:'', address:'', phone_number:'' })
  const [search, setSearch] = useState('')

  const { showSuccess, showError } = useNotification()
  const { user: me } = useAuth()

  const load = async () => {
    try{
      setLoading(true)
      const [u, p] = await Promise.all([
        api.get('/auth/users/?role=non_teaching'),
        api.get('/auth/non-teaching-staff/')
      ])
      const uArr = Array.isArray(u.data)? u.data : (Array.isArray(u.data?.results)? u.data.results: [])
      const pArr = Array.isArray(p.data)? p.data : (Array.isArray(p.data?.results)? p.data.results: [])
      setUsers(uArr)
      setProfiles(pArr)
    }catch(err){
      showError('Failed to Load Staff', 'Could not load non-teaching staff')
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() },[])

  const byUserId = useMemo(()=>{
    const m = new Map()
    for(const pr of profiles){ if(pr?.user?.id) m.set(pr.user.id, pr) }
    return m
  },[profiles])

  const directory = useMemo(()=>{
    const base = Array.isArray(users)? users: []
    return base.map(u => ({ user: u, profile: byUserId.get(u.id) || null }))
  },[users, byUserId])

  const filtered = useMemo(()=>{
    const q = search.trim().toLowerCase()
    if(!q) return directory
    return directory.filter(row => {
      const u = row.user || {}
      const name = `${u.username||''} ${u.first_name||''} ${u.last_name||''}`.toLowerCase()
      const pos = (row.profile?.position||'').toLowerCase()
      const dept = (row.profile?.department||'').toLowerCase()
      return name.includes(q) || pos.includes(q) || dept.includes(q)
    })
  },[directory, search])

  const createUser = async (e) => {
    e.preventDefault()
    try{
      setCreating(true)
      await api.post('/auth/users/create/', { ...newUser, role: 'non_teaching' })
      setNewUser({ username:'', password:'', first_name:'', last_name:'', email:'' })
      setShowCreateUser(false)
      await load()
      showSuccess('User Created', 'Non-teaching staff user created')
    }catch(err){
      showError('Failed', err?.response?.data?.detail || 'Could not create user')
    }finally{
      setCreating(false)
    }
  }

  const openAttach = (userId) => {
    setAttachUserId(String(userId||''))
    setAttachForm({ department:'', position:'', national_id:'', kra_pin:'', nhif_no:'', nssf_no:'', address:'', phone_number:'' })
    setShowAttach(true)
  }

  const saveAttach = async (e) => {
    e.preventDefault()
    if(!attachUserId) return
    try{
      setSavingAttach(true)
      await api.post('/auth/non-teaching-staff/', { user_id: Number(attachUserId), ...attachForm })
      setShowAttach(false)
      await load()
      showSuccess('Profile Linked', 'Profile created for this user')
    }catch(err){
      showError('Failed', err?.response?.data?.detail || 'Could not create profile')
    }finally{
      setSavingAttach(false)
    }
  }

  return (
    <React.Fragment>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Non-Teaching Staff</h1>
            <p className="text-sm text-gray-600">Create users and link HR profiles.</p>
          </div>
          <div className="w-full sm:w-auto flex justify-start sm:justify-end">
            <button
              onClick={()=>setShowCreateUser(true)}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm w-full sm:w-auto"
            >
              Create Staff User
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Directory</h2>
              <p className="text-xs text-gray-500">Search and manage non-teaching staff records.</p>
            </div>
            <input
              className="w-full md:w-64 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
              placeholder="Search name, department or position"
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/40">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600">
                <tr>
                  <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide">User</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide">Department</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide">Position</th>
                  <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr><td colSpan={4} className="py-6 text-center text-gray-500 text-sm">Loading staff directory...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-gray-500 text-sm">No staff found. Create a staff user to get started.</td></tr>
                ) : (
                  filtered.map(row => (
                    <tr key={row.user.id} className="hover:bg-gray-50/80">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-sm text-gray-900">{row.user.first_name} {row.user.last_name}</div>
                        <div className="text-xs text-gray-500">@{row.user.username}</div>
                      </td>
                      <td className="py-2.5 px-3 text-sm text-gray-700">{row.profile?.department || '-'}</td>
                      <td className="py-2.5 px-3 text-sm text-gray-700">{row.profile?.position || '-'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {!row.profile && (
                            <button onClick={()=>openAttach(row.user.id)} className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 bg-white shadow-sm">Create Profile</button>
                          )}
                          {row.profile && (
                            <>
                              <Link
                                to={`/admin/staff-payroll?staff=${row.profile.id}`}
                                className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 bg-white shadow-sm"
                                title="Manage Payroll"
                              >
                                Payroll
                              </Link>
                              <Link
                                to={`/admin/staff-payroll?staff=${row.profile.id}`}
                                className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 bg-white shadow-sm"
                                title="View Payslips"
                              >
                                Payslips
                              </Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={showCreateUser} onClose={()=>setShowCreateUser(false)} title="Create Staff User" size="lg">
          <form onSubmit={createUser} className="grid gap-3 md:grid-cols-3">
            <input className="border p-2 rounded" placeholder="Username" value={newUser.username} onChange={e=>setNewUser({...newUser, username:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Password" type="password" value={newUser.password} onChange={e=>setNewUser({...newUser, password:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Email" type="email" value={newUser.email} onChange={e=>setNewUser({...newUser, email:e.target.value})} />
            <input className="border p-2 rounded" placeholder="First name" value={newUser.first_name} onChange={e=>setNewUser({...newUser, first_name:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Last name" value={newUser.last_name} onChange={e=>setNewUser({...newUser, last_name:e.target.value})} />
            <div className="md:col-span-3 flex justify-end">
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow" disabled={creating}>
                {creating? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal open={showAttach} onClose={()=>!savingAttach && setShowAttach(false)} title="Create Staff Profile" size="lg">
          <form onSubmit={saveAttach} className="grid gap-3 md:grid-cols-2">
            <input className="border p-2 rounded" placeholder="Department" value={attachForm.department} onChange={e=>setAttachForm({...attachForm, department:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Position" value={attachForm.position} onChange={e=>setAttachForm({...attachForm, position:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Phone Number" value={attachForm.phone_number} onChange={e=>setAttachForm({...attachForm, phone_number:e.target.value})} />
            <input className="border p-2 rounded" placeholder="National ID" value={attachForm.national_id} onChange={e=>setAttachForm({...attachForm, national_id:e.target.value})} />
            <input className="border p-2 rounded" placeholder="KRA PIN" value={attachForm.kra_pin} onChange={e=>setAttachForm({...attachForm, kra_pin:e.target.value})} />
            <input className="border p-2 rounded" placeholder="NHIF No" value={attachForm.nhif_no} onChange={e=>setAttachForm({...attachForm, nhif_no:e.target.value})} />
            <input className="border p-2 rounded" placeholder="NSSF No" value={attachForm.nssf_no} onChange={e=>setAttachForm({...attachForm, nssf_no:e.target.value})} />
            <input className="border p-2 rounded md:col-span-2" placeholder="Address" value={attachForm.address} onChange={e=>setAttachForm({...attachForm, address:e.target.value})} />
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow" disabled={savingAttach}>
                {savingAttach? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </React.Fragment>
  )
}
