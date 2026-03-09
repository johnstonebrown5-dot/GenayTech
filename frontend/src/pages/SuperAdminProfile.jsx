import React, { useEffect, useState } from 'react'
import api from '../api'
import { uploadToCloudinary } from '../utils/cloudinary'
import { toast } from '../utils/toast'

export default function SuperAdminProfile(){
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)

  const [pwd, setPwd] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdErr, setPwdErr] = useState('')

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
          phone: data?.phone || data?.mobile || data?.telephone || '',
        })
        const avatarUrl = data?.avatar_url || data?.profile_picture_url || ''
        if (avatarUrl) setAvatarPreview(avatarUrl)
      }catch(e){
        setError(e?.response?.data?.detail || e?.message || 'Failed to load profile')
      }finally{
        if (mounted) setLoading(false)
      }
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
    }catch(err){
      setSaveErr(err?.response?.data?.detail || err?.message || 'Failed to update profile')
    }finally{
      setSaving(false)
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwdSaving) return
    setPwdErr('')
    setPwdMsg('')

    const oldPassword = String(pwd.old_password || '')
    const newPassword = String(pwd.new_password || '')
    const confirm = String(pwd.confirm || '')

    if (!oldPassword || !newPassword) {
      setPwdErr('Old password and new password are required.')
      return
    }
    if (newPassword.length < 6) {
      setPwdErr('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirm) {
      setPwdErr('Passwords do not match.')
      return
    }

    setPwdSaving(true)
    try{
      await api.post('/auth/users/change_password/', { old_password: oldPassword, new_password: newPassword })
      setPwdMsg('Password updated successfully.')
      setPwd({ old_password: '', new_password: '', confirm: '' })
      try { toast('Password updated successfully.', 'success') } catch {}
    }catch(err){
      const msg = err?.response?.data?.detail || err?.message || 'Failed to change password'
      setPwdErr(msg)
      try { toast(msg, 'error') } catch {}
    }finally{
      setPwdSaving(false)
    }
  }

  return (
    <React.Fragment>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-600 mt-1">Update your personal details and profile photo.</p>
          </div>
        </div>
        {loading && <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-600">Loading profile...</div>}
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-2xl border border-red-100 text-sm">{error}</div>}

        {me && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-5 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 mb-6">
                <div className="h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden ring-4 ring-white shadow-md bg-indigo-50 text-indigo-700 flex items-center justify-center text-2xl md:text-3xl">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span>{(me.first_name?.[0] || me.username?.[0] || 'U').toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 sm:text-left text-center">
                  <div className="text-lg md:text-2xl font-semibold text-gray-900 truncate">{me.first_name} {me.last_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{me.email}</div>
                  <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <label className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 cursor-pointer bg-white hover:bg-gray-50 shadow-sm ${avatarSaving ? 'opacity-60 pointer-events-none' : ''}`}>
                      {avatarSaving ? 'Uploading…' : 'Change Photo'}
                      <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                    </label>
                  </div>
                </div>
              </div>

              <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
                {saveErr && <div className="md:col-span-2 bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100">{saveErr}</div>}
                {saveMsg && <div className="md:col-span-2 bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm border border-emerald-100">{saveMsg}</div>}
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-700">First name</span>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    value={form.first_name}
                    onChange={e=>setForm(f=>({...f, first_name:e.target.value}))}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-700">Last name</span>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    value={form.last_name}
                    onChange={e=>setForm(f=>({...f, last_name:e.target.value}))}
                  />
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-medium text-gray-700">Email</span>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    value={form.email}
                    onChange={e=>setForm(f=>({...f, email:e.target.value}))}
                  />
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-medium text-gray-700">Phone</span>
                  <input
                    type="tel"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    value={form.phone}
                    onChange={e=>setForm(f=>({...f, phone:e.target.value}))}
                  />
                </label>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${saving ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-5 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-gray-900">Change Password</div>
                  <div className="text-sm text-gray-600 mt-1">Update your password for this account.</div>
                </div>
              </div>

              <form onSubmit={changePassword} className="mt-4 grid gap-4 md:grid-cols-2">
                {pwdErr && <div className="md:col-span-2 bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100">{pwdErr}</div>}
                {pwdMsg && <div className="md:col-span-2 bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm border border-emerald-100">{pwdMsg}</div>}

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-medium text-gray-700">Old password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    value={pwd.old_password}
                    onChange={e=>setPwd(p=>({ ...p, old_password: e.target.value }))}
                    required
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-700">New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    value={pwd.new_password}
                    onChange={e=>setPwd(p=>({ ...p, new_password: e.target.value }))}
                    required
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-700">Confirm new password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    value={pwd.confirm}
                    onChange={e=>setPwd(p=>({ ...p, confirm: e.target.value }))}
                    required
                  />
                </label>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={pwdSaving}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${pwdSaving ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {pwdSaving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  )
}
