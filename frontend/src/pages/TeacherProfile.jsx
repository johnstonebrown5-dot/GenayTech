import React, { useEffect, useState } from 'react'
import api from '../api'
import ProgressiveImage from '../components/ProgressiveImage'

export default function TeacherProfile(){
  const [me, setMe] = useState(null)
  const [teacherProfile, setTeacherProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pw, setPw] = useState({ old_password: '', new_password: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const [meRes, tpRes] = await Promise.all([
          api.get('/auth/me/'),
          api.get('/academics/teachers/mine/').catch(()=>({ data: null }))
        ])
        if (!mounted) return
        setMe(meRes.data)
        setTeacherProfile(tpRes?.data || null)
        setForm({
          first_name: meRes.data?.first_name || '',
          last_name: meRes.data?.last_name || '',
          email: meRes.data?.email || '',
          phone: meRes.data?.phone || meRes.data?.mobile || meRes.data?.telephone || meRes.data?.profile?.phone || '',
        })
        // Set avatar preview if backend provides any common url field
        const avatarUrl = meRes.data?.avatar_url || meRes.data?.photo_url || meRes.data?.profile_picture_url || meRes.data?.profile?.avatar_url || ''
        if (avatarUrl) setAvatarPreview(avatarUrl)
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
      finally{ if(mounted) setLoading(false) }
    })()
    return ()=>{ mounted = false }
  },[])

  const changePassword = async (e) => {
    e.preventDefault()
    setPwSaving(true)
    setPwErr('')
    setPwMsg('')
    try{
      await api.post('/auth/users/change_password/', pw)
      setPwMsg('Password changed successfully. You may need to log in again on next refresh.')
      setPw({ old_password: '', new_password: '' })
    }catch(err){
      setPwErr(err?.response?.data?.detail || err?.message || 'Failed to change password')
    }finally{ setPwSaving(false) }
  }

  const onPickAvatar = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
  }

  const saveAvatar = async () => {
    if (!avatarFile) return
    setAvatarSaving(true)
    try{
      const tryKeys = ['avatar','photo','profile_picture']
      let ok = false
      for (const key of tryKeys){
        const fd = new FormData()
        fd.append(key, avatarFile)
        try{
          const res = await api.patch('/auth/me/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          setMe(res.data || me)
          ok = true
          break
        }catch(err){ /* try next key */ }
      }
      if (!ok) throw new Error('Upload failed')
      setSaveMsg('Profile photo updated.')
    }catch(err){
      setSaveErr(err?.response?.data?.detail || err?.message || 'Failed to upload photo')
    }finally{
      setAvatarSaving(false)
    }
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveErr('')
    setSaveMsg('')
    try{
      // Only send editable, non-critical fields
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
      }
      if (form.phone !== undefined) payload.phone = form.phone
      const { data } = await api.patch('/auth/me/', payload)
      setMe(data || { ...me, ...payload })
      setSaveMsg('Profile updated successfully.')
    }catch(err){
      setSaveErr(err?.response?.data?.detail || err?.message || 'Failed to update profile')
    }finally{ setSaving(false) }
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-gray-50 pb-10">
      {/* Cover */}
      <div className="h-28 md:h-36 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
      <div className="-mt-10 md:-mt-12 px-4 md:px-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="text-white/90 text-sm md:text-base font-medium drop-shadow-sm">My Profile</div>
          {loading && <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">Loading...</div>}
          {error && <div className="bg-red-50 text-red-700 p-3 rounded-2xl border border-red-100">{error}</div>}

      {me && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 ring-1 ring-indigo-50">
          <div className="border-b px-4 py-3">
            <div className="text-base md:text-lg font-semibold text-gray-800">Profile</div>
            <div className="text-xs text-gray-500">Manage your personal information</div>
          </div>
          <div className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="relative">
              <div className="h-20 w-20 md:h-24 md:w-24 rounded-full overflow-hidden ring-4 ring-white shadow bg-indigo-50 text-indigo-700 flex items-center justify-center text-2xl">
                {avatarPreview ? (
                  <ProgressiveImage src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span>{(me.first_name?.[0] || me.username?.[0] || 'U').toUpperCase()}</span>
                )}
              </div>
            </div>
            <div className="min-w-0 sm:text-left text-center">
              <div className="text-lg md:text-2xl font-semibold truncate text-gray-900">{me.first_name} {me.last_name}</div>
              <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm text-gray-600">
                <span className={`px-2 py-0.5 rounded-full border capitalize ${
                  (me.role||'').toLowerCase()==='admin' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  (me.role||'').toLowerCase()==='teacher' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  (me.role||'').toLowerCase()==='finance' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>{me.role}</span>
                <span className="truncate max-w-[14rem] sm:max-w-none">{me.email}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <label className="px-3 py-2 text-xs rounded-lg border cursor-pointer bg-white hover:bg-gray-50 shadow-sm transition-colors duration-200">
                  Change Photo
                  <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                </label>
                <button type="button" onClick={saveAvatar} disabled={!avatarFile || avatarSaving} className="px-3 py-2 text-xs rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-60 shadow-sm transition-colors duration-200">{avatarSaving? 'Saving…' : 'Save Photo'}</button>
              </div>
            </div>
          </div>
          <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
            {saveErr && <div className="md:col-span-2 bg-red-50 text-red-700 p-2 rounded text-sm">{saveErr}</div>}
            {saveMsg && <div className="md:col-span-2 bg-green-50 text-green-700 p-2 rounded text-sm">{saveMsg}</div>}
            <label className="grid gap-1">
              <span className="text-xs text-gray-600 font-medium">Username (read-only)</span>
              <input className="w-full border border-gray-200 p-2.5 rounded-lg bg-gray-50 text-gray-700" value={me.username||''} readOnly />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600 font-medium">Role (read-only)</span>
              <input className="w-full border border-gray-200 p-2.5 rounded-lg bg-gray-50 capitalize text-gray-700" value={me.role||''} readOnly />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600 font-medium">First name</span>
              <input className="w-full border border-gray-200 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-colors duration-200" value={form.first_name} onChange={e=>setForm(f=>({...f, first_name:e.target.value}))} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600 font-medium">Last name</span>
              <input className="w-full border border-gray-200 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-colors duration-200" value={form.last_name} onChange={e=>setForm(f=>({...f, last_name:e.target.value}))} />
            </label>
            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs text-gray-600 font-medium">Email</span>
              <input type="email" className="w-full border border-gray-200 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-colors duration-200" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} />
            </label>
            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs text-gray-600 font-medium">Phone</span>
              <input type="tel" className="w-full border border-gray-200 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-colors duration-200" value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm shadow-sm disabled:opacity-60 transition-colors duration-200" disabled={saving}>{saving? 'Saving...' : 'Save Profile'}</button>
            </div>
          </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md border border-gray-100 mt-5 max-w-3xl mx-auto ring-1 ring-fuchsia-50">
        <div className="border-b px-4 py-3">
          <div className="text-base md:text-lg font-semibold text-gray-800">Change Password</div>
          <div className="text-xs text-gray-500">Keep your account secure</div>
        </div>
        <form onSubmit={changePassword} className="p-4 md:p-6 grid gap-3 max-w-md mx-auto">
          {/* Hidden username field improves password manager UX */}
          <input type="text" name="username" autoComplete="username" value={me?.username||''} readOnly className="sr-only opacity-0 h-0 pointer-events-none" aria-hidden />
          {pwErr && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{pwErr}</div>}
          {pwMsg && <div className="bg-green-50 text-green-700 p-2 rounded text-sm">{pwMsg}</div>}
          <input className="w-full border border-gray-200 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-colors duration-200" type="password" placeholder="Old Password" autoComplete="current-password" value={pw.old_password} onChange={e=>setPw({...pw, old_password:e.target.value})} required />
          <input className="w-full border border-gray-200 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-colors duration-200" type="password" placeholder="New Password (min 6 chars)" autoComplete="new-password" value={pw.new_password} onChange={e=>setPw({...pw, new_password:e.target.value})} required />
          <div className="flex justify-end">
            <button className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-sm disabled:opacity-60 transition-colors duration-200" disabled={pwSaving}>{pwSaving?'Saving...':'Change Password'}</button>
          </div>
        </form>
      </div>
        </div>
      </div>
    </div>
  )
}
