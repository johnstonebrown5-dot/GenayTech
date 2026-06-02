import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Camera,
  ChevronRight,
  CircleHelp,
  KeyRound,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import api from '../api'
import ProgressiveImage from '../components/ProgressiveImage'
import Modal from '../components/Modal'
import { useAuth } from '../auth'
import { uploadToCloudinary } from '../utils/cloudinary'

export default function TeacherProfile(){
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [me, setMe] = useState(null)
  const [teacherProfile, setTeacherProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [infoOpen, setInfoOpen] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  // Change password
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')

  // Reset password (email + code)
  const [resetStep, setResetStep] = useState('request') // request | verify | confirm | done
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNew, setResetNew] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [resetErr, setResetErr] = useState('')

  // Profile photo
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')
  const [avatarErr, setAvatarErr] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try{
        const [meRes, profileRes] = await Promise.all([
          api.get('/auth/me/'),
          api.get('/academics/teachers/mine/').catch(() => ({ data: null })),
        ])
        if (!mounted) return
        setMe(meRes?.data || null)
        setTeacherProfile(profileRes?.data || null)
      }catch(e){
        if (mounted) setError(e?.response?.data?.detail || e?.message || 'Failed to load profile')
      }finally{
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const email = (me?.email || '').trim()
    if (email && !resetEmail) setResetEmail(email)
  }, [me?.email, resetEmail])

  const fullName = useMemo(() => {
    return [me?.first_name, me?.last_name].filter(Boolean).join(' ') || me?.username || 'Teacher'
  }, [me])
  const avatarUrl = me?.avatar_url || me?.photo_url || me?.profile_picture_url || me?.profile?.avatar_url || ''
  const teacherId = teacherProfile?.id ? `TCHR-${teacherProfile.id}` : `TCHR-${me?.id || '1024'}`

  useEffect(() => {
    if (avatarUrl) setAvatarPreview(avatarUrl)
    else setAvatarPreview('')
  }, [avatarUrl])

  const doLogout = () => {
    try { logout() } catch {}
    try { navigate('/login') } catch {}
  }

  const submitChangePassword = async (e) => {
    e?.preventDefault?.()
    setPwErr(''); setPwMsg('')
    const oldP = String(oldPassword || '')
    const newP = String(newPassword || '')
    if (!oldP || !newP) { setPwErr('Old password and new password are required.'); return }
    if (newP.length < 6) { setPwErr('New password must be at least 6 characters.'); return }
    if (newP !== String(confirmPassword || '')) { setPwErr('Passwords do not match.'); return }
    setPwBusy(true)
    try{
      await api.post('/auth/users/change_password/', { old_password: oldP, new_password: newP })
      setPwMsg('Password changed. Please login again.')
      setOldPassword(''); setNewPassword(''); setConfirmPassword('')
      // Force re-login for safety
      setTimeout(() => doLogout(), 600)
    }catch(err){
      setPwErr(err?.response?.data?.detail || 'Failed to change password')
    }finally{
      setPwBusy(false)
    }
  }

  const resetStart = () => {
    setResetStep('request')
    setResetCode('')
    setResetNew('')
    setResetConfirm('')
    setResetMsg('')
    setResetErr('')
    setResetOpen(true)
  }

  const requestResetCode = async (e) => {
    e?.preventDefault?.()
    setResetErr(''); setResetMsg('')
    const email = String(resetEmail || '').trim().toLowerCase()
    if (!email) { setResetErr('Email is required.'); return }
    setResetBusy(true)
    try{
      const { data } = await api.post('/auth/password-reset/request/', { email })
      setResetMsg(data?.detail || 'If this email exists, a code has been sent.')
      setResetStep('verify')
    }catch(err){
      setResetErr(err?.response?.data?.detail || 'Failed to request reset code')
    }finally{
      setResetBusy(false)
    }
  }

  const verifyResetCode = async (e) => {
    e?.preventDefault?.()
    setResetErr(''); setResetMsg('')
    const email = String(resetEmail || '').trim().toLowerCase()
    const code = String(resetCode || '').trim()
    if (!email || !code) { setResetErr('Email and code are required.'); return }
    setResetBusy(true)
    try{
      const { data } = await api.post('/auth/password-reset/verify/', { email, code })
      setResetMsg(data?.detail || 'Code verified.')
      setResetStep('confirm')
    }catch(err){
      setResetErr(err?.response?.data?.detail || 'Invalid code')
    }finally{
      setResetBusy(false)
    }
  }

  const confirmResetPassword = async (e) => {
    e?.preventDefault?.()
    setResetErr(''); setResetMsg('')
    const email = String(resetEmail || '').trim().toLowerCase()
    const code = String(resetCode || '').trim()
    const np = String(resetNew || '')
    if (!email || !code || !np) { setResetErr('Email, code and new password are required.'); return }
    if (np.length < 6) { setResetErr('New password must be at least 6 characters.'); return }
    if (np !== String(resetConfirm || '')) { setResetErr('Passwords do not match.'); return }
    setResetBusy(true)
    try{
      const { data } = await api.post('/auth/password-reset/confirm/', { email, code, new_password: np })
      setResetMsg(data?.detail || 'Password reset. Please login again.')
      setResetStep('done')
      setTimeout(() => doLogout(), 600)
    }catch(err){
      setResetErr(err?.response?.data?.detail || 'Failed to reset password')
    }finally{
      setResetBusy(false)
    }
  }

  const onPickAvatar = async (e) => {
    const file = e?.target?.files?.[0]
    if (!file) return
    setAvatarErr('')
    setAvatarMsg('')
    try { setAvatarPreview(URL.createObjectURL(file)) } catch {}
    setAvatarBusy(true)
    try{
      const { url } = await uploadToCloudinary(file, { folder: 'edu-track/avatars' })
      const res = await api.patch('/auth/me/', { avatar_url: url })
      setMe(res.data || me)
      setAvatarPreview(url)
      setAvatarMsg('Profile photo updated.')
      try { window.dispatchEvent(new CustomEvent('profile:updated')) } catch {}
      setPhotoOpen(false)
    }catch(err){
      setAvatarErr(err?.response?.data?.detail || err?.message || 'Failed to upload photo')
    }finally{
      setAvatarBusy(false)
      try { e.target.value = '' } catch {}
    }
  }

  const deleteAvatar = async () => {
    setAvatarErr('')
    setAvatarMsg('')
    setAvatarBusy(true)
    try{
      const res = await api.patch('/auth/me/', { delete_avatar: true })
      setMe(res.data || me)
      setAvatarPreview('')
      setAvatarMsg('Profile photo removed.')
      try { window.dispatchEvent(new CustomEvent('profile:updated')) } catch {}
      setPhotoOpen(false)
    }catch(err){
      setAvatarErr(err?.response?.data?.detail || err?.message || 'Failed to remove photo')
    }finally{
      setAvatarBusy(false)
    }
  }

  return (
    <div className="teacher-profile-reference">
      <section className="teacher-profile-hero">
        <div className="teacher-profile-head">
          <button
            type="button"
            className="teacher-profile-avatar built-avatar"
            onClick={()=>{ setAvatarErr(''); setAvatarMsg(''); setPhotoOpen(true) }}
            aria-label="Change profile photo"
            title="Change profile photo"
          >
            {avatarPreview ? (
              <ProgressiveImage src={avatarPreview} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              <GeneratedTeacherAvatar name={fullName} />
            )}
            <span className="teacher-profile-camera">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <h1>{loading ? 'Loading...' : fullName}</h1>
          <p>{teacherProfile?.title || 'Senior Teacher'}</p>
          <small>Teacher ID: {teacherId}</small>
          <div className="teacher-profile-badges">
            <span><ShieldCheck className="h-3.5 w-3.5" /> Verified</span>
            <span>Active</span>
          </div>
        </div>
      </section>

      <section className="teacher-profile-sheet">
        {error && <div className="teacher-reference-error mb-3">{error}</div>}
        <div className="teacher-profile-menu">
          <ProfileActionRow icon={<UserRound />} label="Personal Information" onClick={()=>setInfoOpen(true)} />
          <ProfileRow icon={<Settings />} label="Account Settings" to="/sessions" />
          <ProfileActionRow icon={<KeyRound />} label="Change Password" onClick={()=>{ setPwErr(''); setPwMsg(''); setChangeOpen(true) }} />
          <ProfileActionRow icon={<RefreshCw />} label="Reset Password" onClick={resetStart} />
          <ProfileRow icon={<Bell />} label="Notification Settings" to="/teacher/messages?tab=system" />
          <ProfileRow icon={<CircleHelp />} label="Help & Support" to="/help" />
          <ProfileActionRow icon={<LogOut />} label="Log Out" onClick={()=>setLogoutOpen(true)} danger />
        </div>
      </section>

      <Modal open={photoOpen} onClose={()=>setPhotoOpen(false)} title="Profile Photo" size="sm">
        <div className="grid gap-3">
          {avatarErr && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{avatarErr}</div>}
          {avatarMsg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">{avatarMsg}</div>}

          <div className="flex items-center justify-center">
            <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white shadow-md bg-indigo-50 text-indigo-700 flex items-center justify-center text-2xl">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile photo preview" className="h-full w-full object-cover" />
              ) : (
                <span>{(fullName?.[0] || 'T').toUpperCase()}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className={`inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold cursor-pointer ${avatarBusy ? 'opacity-60 pointer-events-none' : ''}`}>
              {avatarBusy ? 'Please wait...' : 'Change Photo'}
              <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
            </label>

            <button
              type="button"
              onClick={deleteAvatar}
              disabled={avatarBusy || !avatarUrl}
              className="px-4 py-2 rounded-lg border border-red-200 bg-white text-red-700 font-semibold disabled:opacity-60"
            >
              Remove Photo
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={infoOpen} onClose={()=>setInfoOpen(false)} title="Personal Information" size="sm">
        <div className="grid gap-3 text-sm">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Name</div>
            <div className="font-semibold text-gray-900">{fullName}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Username</div>
            <div className="font-semibold text-gray-900">{me?.username || '-'}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Email</div>
            <div className="font-semibold text-gray-900">{me?.email || '-'}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Phone</div>
            <div className="font-semibold text-gray-900">{me?.phone || '-'}</div>
          </div>
          <div className="flex justify-end">
            <button type="button" className="px-4 py-2 rounded-lg border bg-white" onClick={()=>setInfoOpen(false)}>Close</button>
          </div>
        </div>
      </Modal>

      <Modal open={changeOpen} onClose={()=>setChangeOpen(false)} title="Change Password" size="sm">
        <form onSubmit={submitChangePassword} className="grid gap-3">
          {pwErr && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{pwErr}</div>}
          {pwMsg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">{pwMsg}</div>}
          <label className="grid gap-1 text-sm">
            <span className="text-gray-700">Old password</span>
            <input type="password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)} className="px-3 py-2 border rounded-lg" autoComplete="current-password" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-gray-700">New password</span>
            <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="px-3 py-2 border rounded-lg" autoComplete="new-password" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-gray-700">Confirm new password</span>
            <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="px-3 py-2 border rounded-lg" autoComplete="new-password" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-lg border bg-white" onClick={()=>setChangeOpen(false)}>Cancel</button>
            <button type="submit" disabled={pwBusy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60">
              {pwBusy ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={resetOpen} onClose={()=>setResetOpen(false)} title="Reset Password" size="sm">
        <div className="grid gap-3">
          {resetErr && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{resetErr}</div>}
          {resetMsg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">{resetMsg}</div>}

          {resetStep === 'request' && (
            <form onSubmit={requestResetCode} className="grid gap-3">
              <div className="text-sm text-gray-600">We will send a 6-digit code to your email.</div>
              <label className="grid gap-1 text-sm">
                <span className="text-gray-700">Email</span>
                <input value={resetEmail} onChange={e=>setResetEmail(e.target.value)} className="px-3 py-2 border rounded-lg" type="email" placeholder="you@example.com" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 rounded-lg border bg-white" onClick={()=>setResetOpen(false)}>Cancel</button>
                <button type="submit" disabled={resetBusy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60">
                  {resetBusy ? 'Sending...' : 'Send Code'}
                </button>
              </div>
            </form>
          )}

          {resetStep === 'verify' && (
            <form onSubmit={verifyResetCode} className="grid gap-3">
              <div className="text-sm text-gray-600">Enter the code sent to <span className="font-medium">{resetEmail || 'your email'}</span>.</div>
              <label className="grid gap-1 text-sm">
                <span className="text-gray-700">Code</span>
                <input value={resetCode} onChange={e=>setResetCode(e.target.value)} className="px-3 py-2 border rounded-lg" inputMode="numeric" placeholder="123456" />
              </label>
              <div className="flex justify-between gap-2">
                <button type="button" className="px-3 py-2 rounded-lg border bg-white" onClick={()=>setResetStep('request')}>Back</button>
                <div className="flex gap-2">
                  <button type="button" className="px-3 py-2 rounded-lg border bg-white" onClick={requestResetCode} disabled={resetBusy}>Resend</button>
                  <button type="submit" disabled={resetBusy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60">
                    {resetBusy ? 'Verifying...' : 'Verify Code'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {resetStep === 'confirm' && (
            <form onSubmit={confirmResetPassword} className="grid gap-3">
              <div className="text-sm text-gray-600">Set your new password.</div>
              <label className="grid gap-1 text-sm">
                <span className="text-gray-700">New password</span>
                <input type="password" value={resetNew} onChange={e=>setResetNew(e.target.value)} className="px-3 py-2 border rounded-lg" autoComplete="new-password" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-gray-700">Confirm new password</span>
                <input type="password" value={resetConfirm} onChange={e=>setResetConfirm(e.target.value)} className="px-3 py-2 border rounded-lg" autoComplete="new-password" />
              </label>
              <div className="flex justify-between gap-2">
                <button type="button" className="px-3 py-2 rounded-lg border bg-white" onClick={()=>setResetStep('verify')}>Back</button>
                <button type="submit" disabled={resetBusy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60">
                  {resetBusy ? 'Saving...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

          {resetStep === 'done' && (
            <div className="grid gap-3">
              <div className="text-sm text-gray-700">Password updated. You will be redirected to login.</div>
              <div className="flex justify-end">
                <button type="button" className="px-4 py-2 rounded-lg bg-indigo-600 text-white" onClick={doLogout}>Go to login</button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={logoutOpen} onClose={()=>setLogoutOpen(false)} title="Confirm logout" size="sm">
        <div className="grid gap-3">
          <div className="text-sm text-gray-700">Are you sure you want to logout?</div>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-lg border bg-white" onClick={()=>setLogoutOpen(false)}>Cancel</button>
            <button type="button" className="px-4 py-2 rounded-lg bg-red-600 text-white" onClick={doLogout}>Logout</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ProfileRow({ icon, label, to, danger=false }){
  return (
    <Link to={to} className={danger ? 'danger' : ''}>
      {React.cloneElement(icon, { className: 'h-5 w-5' })}
      <span>{label}</span>
      {!danger && <ChevronRight className="h-4 w-4" />}
    </Link>
  )
}

function ProfileActionRow({ icon, label, onClick, danger=false }){
  return (
    <button type="button" onClick={onClick} className={danger ? 'danger' : ''}>
      {React.cloneElement(icon, { className: 'h-5 w-5' })}
      <span>{label}</span>
      {!danger && <ChevronRight className="h-4 w-4" />}
    </button>
  )
}

function GeneratedTeacherAvatar({ name }){
  const initials = String(name || 'Teacher')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'T'

  return (
    <div className="generated-teacher-avatar" aria-label={`${name} avatar`}>
      <div className="avatar-hair" />
      <div className="avatar-face">
        <span className="avatar-eye left" />
        <span className="avatar-eye right" />
        <span className="avatar-smile" />
      </div>
      <div className="avatar-jacket" />
      <strong>{initials}</strong>
    </div>
  )
}
