import React, { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import api from '../api'
import ProgressiveImage from '../components/ProgressiveImage'
import { uploadToCloudinary } from '../utils/cloudinary'
import { toast } from '../utils/toast'

export default function AdminProfile(){
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const { data } = await api.get('/auth/me/')
        if (!mounted) return
        setMe(data)
        setForm({
          first_name: data?.first_name || '',
          last_name: data?.last_name || '',
          email: data?.email || '',
          phone: data?.phone || data?.mobile || data?.telephone || ''
        })
        const avatarUrl = data?.avatar_url || data?.profile_picture_url || ''
        if (avatarUrl) setAvatarPreview(avatarUrl)
      }catch(e){ setError(e?.response?.data?.detail || e?.message || 'Failed to load profile') }
      finally{ if(mounted) setLoading(false) }
    })()
    return ()=>{ mounted = false }
  },[])

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try { setAvatarPreview(URL.createObjectURL(file)) } catch {}
    setAvatarSaving(true)
    try{
      const { url } = await uploadToCloudinary(file, { folder: 'edu-track/avatars' })
      const res = await api.patch('/auth/me/', { avatar_url: url })
      setMe(res.data || me)
      setAvatarPreview(url)
      setSaveMsg('Profile photo updated.')
      try { window.dispatchEvent(new CustomEvent('profile:updated', { detail: { avatar_url: url } })) } catch {}
    }catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Failed to upload photo'
      setSaveErr(msg)
      toast(msg, 'error')
    }finally{
      setAvatarSaving(false)
      try { e.target.value = '' } catch {}
    }
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
      try { window.dispatchEvent(new CustomEvent('profile:updated')) } catch {}
    }catch(err){ setSaveErr(err?.response?.data?.detail || err?.message || 'Failed to update profile') }
    finally{ setSaving(false) }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <h1 className="text-xl font-semibold">My Profile</h1>
        {loading && <div className="bg-white p-4 rounded border">Loading...</div>}
        {error && <div className="bg-red-50 text-red-700 p-2 rounded border border-red-200">{error}</div>}

        {me && (
          <div className="bg-white rounded border p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white shadow bg-indigo-50 text-indigo-700 flex items-center justify-center text-2xl">
                {avatarPreview ? (
                  <ProgressiveImage src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span>{(me.first_name?.[0] || me.username?.[0] || 'U').toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 sm:text-left text-center">
                <div className="text-lg md:text-2xl font-semibold truncate">{me.first_name} {me.last_name}</div>
                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <label className={`px-3 py-2 text-xs rounded border cursor-pointer bg-white hover:bg-gray-50 ${avatarSaving ? 'opacity-60 pointer-events-none' : ''}`}>
                    {avatarSaving ? 'Uploading…' : 'Change Photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                  </label>
                </div>
              </div>
            </div>

            <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
              {saveErr && <div className="md:col-span-2 bg-red-50 text-red-700 p-2 rounded text-sm">{saveErr}</div>}
              {saveMsg && <div className="md:col-span-2 bg-green-50 text-green-700 p-2 rounded text-sm">{saveMsg}</div>}
              <label className="grid gap-1">
                <span className="text-xs text-gray-600">First name</span>
                <input className="w-full border p-2 rounded" value={form.first_name} onChange={e=>setForm(f=>({...f, first_name:e.target.value}))} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-gray-600">Last name</span>
                <input className="w-full border p-2 rounded" value={form.last_name} onChange={e=>setForm(f=>({...f, last_name:e.target.value}))} />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <span className="text-xs text-gray-600">Email</span>
                <input type="email" className="w-full border p-2 rounded" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <span className="text-xs text-gray-600">Phone</span>
                <input type="tel" className="w-full border p-2 rounded" value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60" disabled={saving}>{saving? 'Saving...' : 'Save Profile'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
