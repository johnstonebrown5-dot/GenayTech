import React, { useEffect, useState } from 'react'
import api from '../api'

export default function SuperAdminAdmins(){
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Create Admin form
  const [cUsername, setCUsername] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cFirst, setCFirst] = useState('')
  const [cLast, setCLast] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cSchool, setCSchool] = useState('')
  const [creating, setCreating] = useState(false)

  // Assign Admin form
  const [aUserId, setAUserId] = useState('')
  const [aSchool, setASchool] = useState('')
  const [assigning, setAssigning] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try{
      const res = await api.get('/auth/superadmin/schools/', { params: { page_size: 1000 } })
      const arr = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : [])
      setSchools(arr)
    }catch(e){
      setError(e?.response?.data?.detail || 'Failed to load schools')
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [])

  const onCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!cUsername || !cSchool){
      setError('Username and School are required')
      return
    }
    setCreating(true)
    try{
      const payload = {
        username: cUsername,
        password: cPassword || undefined,
        email: cEmail || undefined,
        first_name: cFirst || undefined,
        last_name: cLast || undefined,
        phone: cPhone || undefined,
        school_id: Number(cSchool)
      }
      const { data } = await api.post('/auth/superadmin/users/create-school-admin/', payload)
      setSuccess(`Created admin ${data?.username || ''} for school #${cSchool}`)
      setCUsername(''); setCPassword(''); setCEmail(''); setCFirst(''); setCLast(''); setCPhone('')
    }catch(e){
      setError(e?.response?.data?.detail || 'Failed to create school admin')
    }finally{
      setCreating(false)
    }
  }

  const onAssign = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!aUserId || !aSchool){
      setError('User ID and School are required')
      return
    }
    setAssigning(true)
    try{
      const payload = { user_id: Number(aUserId), school_id: Number(aSchool) }
      const { data } = await api.post('/auth/superadmin/users/assign-school-admin/', payload)
      setSuccess(`Assigned user ${data?.username || aUserId} as admin for school #${aSchool}`)
      setAUserId('')
    }catch(e){
      setError(e?.response?.data?.detail || 'Failed to assign school admin')
    }finally{
      setAssigning(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Manage School Admins</h1>
          <div className="mt-1 text-sm text-gray-600">Create or assign School Admins to schools. Superuser only.</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm" onClick={load}>Refresh</button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{success}</div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Admin */}
        <form onSubmit={onCreate} className="rounded-2xl bg-white border p-4">
          <div className="text-lg font-semibold text-gray-900">Create School Admin</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-gray-700 mb-1">Username</div>
              <input value={cUsername} onChange={(e)=>setCUsername(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" required />
            </div>
            <div>
              <div className="text-sm text-gray-700 mb-1">Password (optional)</div>
              <input value={cPassword} onChange={(e)=>setCPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" type="password" placeholder="Auto-generate if empty" />
            </div>
            <div>
              <div className="text-sm text-gray-700 mb-1">First Name</div>
              <input value={cFirst} onChange={(e)=>setCFirst(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <div className="text-sm text-gray-700 mb-1">Last Name</div>
              <input value={cLast} onChange={(e)=>setCLast(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <div className="text-sm text-gray-700 mb-1">Email</div>
              <input value={cEmail} onChange={(e)=>setCEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" type="email" />
            </div>
            <div>
              <div className="text-sm text-gray-700 mb-1">Phone</div>
              <input value={cPhone} onChange={(e)=>setCPhone(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-700 mb-1">School</div>
              <select value={cSchool} onChange={(e)=>setCSchool(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" required>
                <option value="">Select school…</option>
                {(Array.isArray(schools)?schools:[]).map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button disabled={creating} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{creating ? 'Creating…' : 'Create Admin'}</button>
          </div>
        </form>

        {/* Assign Admin */}
        <form onSubmit={onAssign} className="rounded-2xl bg-white border p-4">
          <div className="text-lg font-semibold text-gray-900">Assign Existing User as Admin</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-gray-700 mb-1">User ID</div>
              <input value={aUserId} onChange={(e)=>setAUserId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Enter existing user ID" />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-700 mb-1">School</div>
              <select value={aSchool} onChange={(e)=>setASchool(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="">Select school…</option>
                {(Array.isArray(schools)?schools:[]).map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button disabled={assigning} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{assigning ? 'Assigning…' : 'Assign Admin'}</button>
          </div>
          <div className="mt-2 text-xs text-gray-500">Tip: You can find a user's ID from the Users page or API.</div>
        </form>
      </div>
    </div>
  )
}
