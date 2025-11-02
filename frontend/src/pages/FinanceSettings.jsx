import React, { useEffect, useState } from 'react'
import api from '../api'
import { uploadToCloudinary } from '../utils/cloudinary'
import { toast } from '../utils/toast'

export default function FinanceSettings(){
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [pw, setPw] = useState({ old_password: '', new_password: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        setLoading(true)
        const res = await api.get('/auth/me/')
        if (!alive) return
        setMe(res.data)
        setForm({
          first_name: res.data?.first_name || '',
          last_name: res.data?.last_name || '',
          email: res.data?.email || '',
          phone: res.data?.phone || res.data?.mobile || res.data?.profile?.phone || '',
        })
        const avatarUrl = res.data?.avatar_url || res.data?.photo_url || res.data?.profile_picture_url || ''
        if (avatarUrl) setAvatarPreview(avatarUrl)
      }catch(e){ setError(e?.response?.data?.detail || e?.message || 'Failed to load profile') }
      finally{ if (alive) setLoading(false) }
    })()
    return ()=>{ alive = false }
  }, [])

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
      const { url } = await uploadToCloudinary(avatarFile, { folder: 'edu-track/avatars' })
      const res = await api.patch('/auth/me/', { avatar_url: url })
      setMe(res.data || me)
      setSaveMsg('Profile photo updated.')
    }catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Failed to upload photo'
      setSaveErr(msg)
      toast(msg, 'error')
    }finally{ setAvatarSaving(false) }
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveErr('')
    setSaveMsg('')
    try{
      const payload = { first_name: form.first_name, last_name: form.last_name, email: form.email }
      if (form.phone !== undefined) payload.phone = form.phone
      const { data } = await api.patch('/auth/me/', payload)
      setMe(data || { ...me, ...payload })
      setSaveMsg('Profile updated successfully.')
    }catch(err){ setSaveErr(err?.response?.data?.detail || err?.message || 'Failed to update profile') }
    finally{ setSaving(false) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setPwSaving(true)
    setPwErr('')
    setPwMsg('')
    try{
      await api.post('/auth/users/change_password/', pw)
      setPwMsg('Password changed successfully.')
      setPw({ old_password: '', new_password: '' })
    }catch(err){ setPwErr(err?.response?.data?.detail || err?.message || 'Failed to change password') }
    finally{ setPwSaving(false) }
  }

  return (
    <div className="min-h-[calc(100vh-6rem)]">
      {/* Cover / Header */}
      <div className="h-28 md:h-36 bg-gradient-to-r from-brand-500 via-indigo-500 to-fuchsia-500" />
      <div className="-mt-10 md:-mt-12 px-4 md:px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {/* Left: Profile card */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 ring-1 ring-indigo-50">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden ring-4 ring-white shadow bg-indigo-50 text-indigo-700 flex items-center justify-center text-2xl">
                  {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" /> : <span>{(me?.first_name?.[0] || me?.username?.[0] || 'U').toUpperCase()}</span>}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold truncate text-gray-900">{me?.first_name} {me?.last_name}</div>
                  <div className="text-sm text-gray-600 truncate">{me?.email}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="px-2.5 py-1.5 text-xs rounded-lg border cursor-pointer bg-white hover:bg-gray-50 shadow-sm">
                      Change Photo
                      <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                    </label>
                    <button type="button" onClick={saveAvatar} disabled={!avatarFile || avatarSaving} className="px-2.5 py-1.5 text-xs rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-60 shadow-sm">{avatarSaving ? 'Saving…' : 'Save Photo'}</button>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="bg-gray-50 rounded-lg p-2 border"><div className="text-[10px] uppercase text-gray-500">Username</div><div className="font-medium truncate">{me?.username}</div></div>
                <div className="bg-gray-50 rounded-lg p-2 border"><div className="text-[10px] uppercase text-gray-500">Role</div><div className="font-medium capitalize">{me?.role}</div></div>
              </div>
            </div>
          </div>

          {/* Right: Forms */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 ring-1 ring-emerald-50">
              <div className="mb-3 font-medium text-gray-800">General Profile</div>
              {loading && <div className="text-sm text-gray-500">Loading…</div>}
              {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded p-2 mb-2">{error}</div>}
              <form onSubmit={saveProfile} className="grid gap-3 md:grid-cols-2">
                {saveErr && <div className="md:col-span-2 bg-rose-50 text-rose-700 border border-rose-100 p-2 rounded text-sm">{saveErr}</div>}
                {saveMsg && <div className="md:col-span-2 bg-emerald-50 text-emerald-700 border border-emerald-100 p-2 rounded text-sm">{saveMsg}</div>}
                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">First name</span>
                  <input className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-200" value={form.first_name} onChange={e=>setForm(f=>({...f, first_name:e.target.value}))} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-gray-600">Last name</span>
                  <input className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-200" value={form.last_name} onChange={e=>setForm(f=>({...f, last_name:e.target.value}))} />
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-gray-600">Email</span>
                  <input type="email" className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-200" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} />
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-gray-600">Phone</span>
                  <input type="tel" className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-200" value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} />
                </label>
                <div className="md:col-span-2 flex justify-end">
                  <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm shadow-sm disabled:opacity-60" disabled={saving}>{saving? 'Saving…' : 'Save Profile'}</button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 ring-1 ring-fuchsia-50">
              <div className="mb-3 font-medium text-gray-800">Change Password</div>
              <form onSubmit={changePassword} className="grid gap-3 max-w-md">
                {/* improve password manager */}
                <input type="text" name="username" autoComplete="username" value={me?.username||''} readOnly className="sr-only opacity-0 h-0 pointer-events-none" aria-hidden />
                {pwErr && <div className="bg-rose-50 text-rose-700 border border-rose-100 p-2 rounded text-sm">{pwErr}</div>}
                {pwMsg && <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 p-2 rounded text-sm">{pwMsg}</div>}
                <input className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-200" type="password" placeholder="Old Password" autoComplete="current-password" value={pw.old_password} onChange={e=>setPw({...pw, old_password:e.target.value})} required />
                <input className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-200" type="password" placeholder="New Password (min 6 chars)" autoComplete="new-password" value={pw.new_password} onChange={e=>setPw({...pw, new_password:e.target.value})} required />
                <div className="flex justify-end">
                  <button className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-sm disabled:opacity-60" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Change Password'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
