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
    <div className="space-y-5">
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-700">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              Admin Management
            </div>
            <div className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">Manage School Admins</div>
            <div className="mt-1 text-sm text-gray-600">Create or assign School Admins to schools. Superuser only.</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <button
              className={`px-4 py-2 rounded-2xl border border-gray-200 text-sm font-semibold shadow-sm ${loading ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={load}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{success}</div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Admin */}
        <form onSubmit={onCreate} className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-gray-900">Create School Admin</div>
              <div className="mt-1 text-xs text-gray-600">Creates a new user and assigns them as Admin for the selected school.</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-gray-700">Username</span>
              <input value={cUsername} onChange={(e)=>setCUsername(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" required />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-gray-700">Password (optional)</span>
              <input value={cPassword} onChange={(e)=>setCPassword(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" type="password" placeholder="Auto-generate if empty" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-gray-700">First Name</span>
              <input value={cFirst} onChange={(e)=>setCFirst(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-gray-700">Last Name</span>
              <input value={cLast} onChange={(e)=>setCLast(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-gray-700">Email</span>
              <input value={cEmail} onChange={(e)=>setCEmail(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" type="email" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-gray-700">Phone</span>
              <input value={cPhone} onChange={(e)=>setCPhone(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
            </label>

            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs font-semibold text-gray-700">School</span>
              <select value={cSchool} onChange={(e)=>setCSchool(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" required>
                <option value="">Select school…</option>
                {(Array.isArray(schools)?schools:[]).map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button disabled={creating} className={`px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-sm ${creating ? 'bg-gray-200 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:cursor-not-allowed`}>{creating ? 'Creating…' : 'Create Admin'}</button>
          </div>
        </form>

        {/* Assign Admin */}
        <form onSubmit={onAssign} className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-gray-900">Assign Existing User as Admin</div>
              <div className="mt-1 text-xs text-gray-600">Use this when the user already exists and you want to link them to a school as Admin.</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-gray-700">User ID</span>
              <input value={aUserId} onChange={(e)=>setAUserId(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Enter existing user ID" />
            </label>
            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs font-semibold text-gray-700">School</span>
              <select value={aSchool} onChange={(e)=>setASchool(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200">
                <option value="">Select school…</option>
                {(Array.isArray(schools)?schools:[]).map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-2 text-xs text-gray-500">Tip: You can find a user's ID from the Users page or API.</div>

          <div className="mt-4 flex justify-end">
            <button disabled={assigning} className={`px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-sm ${assigning ? 'bg-gray-200 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:cursor-not-allowed`}>{assigning ? 'Assigning…' : 'Assign Admin'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
