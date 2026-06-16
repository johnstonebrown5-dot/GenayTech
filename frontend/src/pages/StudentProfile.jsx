import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import api from '../api'
import StudentMobileHeader from '../components/studentMobile/StudentMobileHeader'

export default function StudentProfile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [student, setStudent] = useState(null)
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordErr, setPasswordErr] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [form, setForm] = useState({ email: '', guardian_id: '', address: '' })
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [showPasswordCard, setShowPasswordCard] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [meRes, studentRes] = await Promise.all([
          api.get('/auth/me/'),
          api.get('/academics/students/my/'),
        ])
        if (!mounted) return
        setMe(meRes.data)
        setStudent(studentRes.data)
        setForm({
          email: meRes.data?.email || '',
          guardian_id: studentRes.data?.guardian_id || studentRes.data?.phone || '',
          address: studentRes.data?.address || '',
        })
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load profile')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const displayName = useMemo(() => {
    const first = String(student?.name || me?.first_name || '').trim()
    const last = String(me?.last_name || '').trim()
    const full = student?.name || `${first} ${last}`.trim()
    return full || me?.username || 'Student'
  }, [student, me])

  const profileImage = me?.avatar_url || me?.photo_url || student?.photo_url || ''
  const studentId = student?.admission_no || student?.id || '-'
  const currentTerm = student?.term || student?.current_term || 'Unknown Term'
  const studentClass = student?.klass_detail?.name || student?.klass || student?.class || 'Unknown Class'
  const studentGrade = student?.klass_detail?.grade_level || student?.grade_level || student?.grade || 'Unknown Grade'

  const saveProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaveErr('')
    setSaveMsg('')
    try {
      const updates = []
      if (student?.id) {
        updates.push(api.patch(`/academics/students/${student.id}/`, {
          guardian_id: form.guardian_id,
          address: form.address,
        }))
      }
      if (me?.id) {
        updates.push(api.patch('/auth/me/', { email: form.email }))
      }
      const responses = await Promise.all(updates)
      const studentResp = responses.find(r => r.config.url?.includes('/academics/students/'))
      const meResp = responses.find(r => r.config.url?.includes('/auth/me/'))
      if (studentResp?.data) setStudent(studentResp.data)
      if (meResp?.data) setMe(meResp.data)
      setSaveMsg('Profile updated successfully.')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveErr(err?.response?.data?.detail || err?.message || 'Failed to update profile')
      setTimeout(() => setSaveErr(''), 4000)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setPasswordErr('')
    setPasswordMsg('')
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordErr('New passwords do not match.')
      return
    }
    if (!passwordForm.current || !passwordForm.new) {
      setPasswordErr('Current and new passwords are required.')
      return
    }
    setChangingPassword(true)
    try {
      await api.post('/auth/change-password/', {
        current_password: passwordForm.current,
        new_password: passwordForm.new,
      })
      setPasswordMsg('Password changed successfully.')
      setPasswordForm({ current: '', new: '', confirm: '' })
      setTimeout(() => setPasswordMsg(''), 3000)
    } catch (err) {
      setPasswordErr(err?.response?.data?.detail || err?.message || 'Failed to change password')
      setTimeout(() => setPasswordErr(''), 4000)
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="sm:hidden bg-slate-50 min-h-full flex items-center justify-center p-6">
        <div className="text-slate-700 text-sm">Loading profile...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="sm:hidden bg-slate-50 min-h-full p-4">
        <StudentMobileHeader theme="blue" title="Profile" showBack onBack={() => navigate('/student')} />
        <div className="mt-4 rounded-[32px] bg-white p-4 shadow-sm text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="sm:hidden bg-slate-50 min-h-full pb-28">
      <StudentMobileHeader theme="blue" title="Profile" showBack onBack={() => navigate('/student')} />

      <div className="px-4 py-4 space-y-4">
        <div className="rounded-[32px] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="h-24 w-24 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center text-3xl font-semibold text-slate-700">
              {profileImage ? (
                <img src={profileImage} alt="Student" className="h-full w-full object-cover" />
              ) : (
                <span>{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-slate-900">{displayName}</h1>
              <p className="text-sm text-slate-500 mt-1">{me?.email || student?.email || 'No email available'}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[20px] bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Student ID</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{studentId}</div>
                </div>
                <div className="rounded-[20px] bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Term</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{currentTerm}</div>
                </div>
                <div className="rounded-[20px] bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Class</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{studentClass}</div>
                </div>
                <div className="rounded-[20px] bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Grade</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{studentGrade}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={saveProfile} className="rounded-[32px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Account details</h2>
              <p className="text-[11px] text-slate-500 mt-1">Update your email and contact information.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">Email address</label>
              <div className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-slate-900 focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">Parent / guardian phone</label>
              <div className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 00.948.684l1.498 4.493a1 1 0 00.502.756l2.048 1.029a2 2 0 002.063-.383l3.165-3.165a2 2 0 012.828 0l2.828 2.828a2 2 0 010 2.828l-3.165 3.165a2 2 0 00-.383 2.063l1.029 2.048a1 1 0 00.756.502l4.493 1.498a1 1 0 00.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <input
                  type="text"
                  value={form.guardian_id}
                  onChange={(e) => setForm({ ...form, guardian_id: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-slate-900 focus:outline-none"
                  placeholder="0796031071"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">Postal address</label>
              <div className="flex gap-2 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="flex-1 bg-transparent text-sm text-slate-900 focus:outline-none resize-none"
                  placeholder="801 Gabriel Oval&#10;Lewisfurt, MH 08186"
                />
              </div>
            </div>
          </div>

          {(saveErr || saveMsg) && (
            <div className="mt-4 text-sm">
              {saveErr && <div className="text-rose-600 font-medium">{saveErr}</div>}
              {saveMsg && <div className="text-emerald-600 font-medium">{saveMsg}</div>}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-6 w-full rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>

        <div className="rounded-[32px] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Change password
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">Update your account password</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordCard((value) => !value)}
              className="text-slate-600 hover:text-slate-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {showPasswordCard && (
            <form onSubmit={changePassword} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">Current password</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Current password"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">New password</label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="New password"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">Confirm password</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Confirm password"
                />
              </div>

              {(passwordErr || passwordMsg) && (
                <div className="text-sm">
                  {passwordErr && <div className="text-rose-600 font-medium">{passwordErr}</div>}
                  {passwordMsg && <div className="text-emerald-600 font-medium">{passwordMsg}</div>}
                </div>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="mt-2 w-full rounded-[24px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {changingPassword ? 'Updating...' : 'Change password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
