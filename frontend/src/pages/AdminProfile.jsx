import React, { useEffect, useState, useMemo } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import api from '../api'
import { uploadToCloudinary } from '../utils/cloudinary'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

// Mobile-optimized AdminProfile component  
export default function AdminProfile(){
  const [me, setMe] = useState(null)
  const [stats, setStats] = useState({ students: 128, teachers: 24, classes: 16, attendance: 98 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('personal')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: '', department: '', date_joined: '' })
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [sessions, setSessions] = useState([])
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [preferences, setPreferences] = useState({ theme: 'light', language: 'en', emailUpdates: true, marketingEmails: false })
  const [notifications, setNotifications] = useState({ loginAlerts: true, updateAlerts: true, weeklyReport: true, monthlyReport: false, securityAlerts: true })
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordErr, setPasswordErr] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const { data } = await api.get('/auth/me/')
        if (!mounted) return
        setMe(data)
        const avatarUrl = data?.avatar_url || data?.profile_picture_url || ''
        if (avatarUrl) setAvatarPreview(avatarUrl)
        setForm({
          first_name: data?.first_name || '',
          last_name: data?.last_name || '',
          email: data?.email || '',
          phone: data?.phone || data?.mobile || data?.telephone || '',
          role: data?.role || data?.user_type || 'Administrator',
          department: data?.department || 'Administration',
          date_joined: data?.date_joined ? new Date(data.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '15th January 2024'
        })

        // Fetch stats from API
        try {
          const [studentsRes, teachersRes, classesRes] = await Promise.all([
            api.get('/academics/students/').catch(() => ({ data: [] })),
            api.get('/academics/teachers/').catch(() => ({ data: [] })),
            api.get('/academics/classes/').catch(() => ({ data: [] }))
          ])
          const students = Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data?.results || []
          const teachers = Array.isArray(teachersRes.data) ? teachersRes.data : teachersRes.data?.results || []
          const classes = Array.isArray(classesRes.data) ? classesRes.data : classesRes.data?.results || []
          setStats({ students: students.length, teachers: teachers.length, classes: classes.length, attendance: 98 })
        } catch (e) {
          console.error('Failed to fetch stats:', e)
        }

        // Simulate active sessions
        setSessions([
          { id: 1, device: 'Windows • Chrome', location: 'Nairobi, Kenya', ip: '192.168.1.101', status: 'Current Session', time: 'now', browser: 'Chrome 128', os: 'Windows 11' },
          { id: 2, device: 'Android • Chrome', location: 'Nairobi, Kenya', ip: '203.45.78.91', status: 'Active', time: '2 hours ago', browser: 'Chrome Mobile', os: 'Android 14' },
          { id: 3, device: 'iPhone • Safari', location: 'Nairobi, Kenya', ip: '156.32.98.145', status: 'Active', time: '1 day ago', browser: 'Safari', os: 'iOS 18' }
        ])
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
      setTimeout(() => setSaveMsg(''), 3000)
    }catch(err){
      setSaveErr(err?.response?.data?.detail || err?.message || 'Failed to upload photo')
      setTimeout(() => setSaveErr(''), 3000)
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
      const payload = { first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone }
      const { data } = await api.patch('/auth/me/', payload)
      setMe(data || { ...me, ...payload })
      setSaveMsg('Profile updated successfully.')
      setTimeout(() => setSaveMsg(''), 3000)
    }catch(err){ 
      setSaveErr(err?.response?.data?.detail || err?.message || 'Failed to update profile')
      setTimeout(() => setSaveErr(''), 3000)
    }
    finally{ setSaving(false) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordErr('New passwords do not match')
      setTimeout(() => setPasswordErr(''), 3000)
      return
    }
    setChangingPassword(true)
    setPasswordErr('')
    setPasswordMsg('')
    try{
      await api.post('/auth/change-password/', { 
        current_password: passwordForm.current, 
        new_password: passwordForm.new 
      })
      setPasswordMsg('Password changed successfully.')
      setPasswordForm({ current: '', new: '', confirm: '' })
      setTimeout(() => setPasswordMsg(''), 3000)
    }catch(err){ 
      setPasswordErr(err?.response?.data?.detail || 'Failed to change password')
      setTimeout(() => setPasswordErr(''), 3000)
    }
    finally{ setChangingPassword(false) }
  }

  const savePreferences = async () => {
    try{
      await api.patch('/auth/me/', { preferences })
      setSaveMsg('Preferences saved successfully.')
      setTimeout(() => setSaveMsg(''), 3000)
    }catch(err){ 
      setSaveErr('Failed to save preferences')
      setTimeout(() => setSaveErr(''), 3000)
    }
  }

  const saveNotifications = async () => {
    try{
      await api.patch('/auth/me/', { notification_settings: notifications })
      setSaveMsg('Notification settings saved successfully.')
      setTimeout(() => setSaveMsg(''), 3000)
    }catch(err){ 
      setSaveErr('Failed to save notification settings')
      setTimeout(() => setSaveErr(''), 3000)
    }
  }

  const logoutDevice = async (sessionId) => {
    if (window.confirm('Are you sure you want to log out from this device?')) {
      setSessions(s => s.filter(sess => sess.id !== sessionId))
    }
  }

  const downloadData = () => {
    const data = {
      profile: me,
      stats: stats,
      exportDate: new Date().toISOString()
    }
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2)))
    element.setAttribute('download', 'my-data.json')
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  // Login history data for security chart
  const loginHistory = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map(day => ({
      day,
      logins: Math.floor(Math.random() * 8) + 2,
      failedAttempts: Math.floor(Math.random() * 2)
    }))
  }, [])

  // Device breakdown data
  const deviceData = useMemo(() => {
    return [
      { name: 'Windows', value: sessions.filter(s => s.device.includes('Windows')).length || 1 },
      { name: 'Android', value: sessions.filter(s => s.device.includes('Android')).length || 1 },
      { name: 'iOS', value: sessions.filter(s => s.device.includes('iPhone')).length || 1 }
    ]
  }, [sessions])

  if (loading) return <div className="p-6 text-center text-gray-600">Loading profile...</div>
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-xs md:text-sm text-gray-500">Manage your personal information, security settings and account preferences.</p>
      </div>

      {me && (
        <>
          {/* Profile Card with Stats */}
          <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-3 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 mb-4 md:mb-6">
              <div className="h-20 w-20 md:h-28 md:w-28 rounded-full overflow-hidden ring-2 md:ring-4 ring-white shadow-md bg-indigo-50 text-indigo-700 flex items-center justify-center text-2xl md:text-4xl flex-shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span>{(me.first_name?.[0] || me.username?.[0] || 'E').toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2">
                  <h2 className="text-lg md:text-2xl font-bold text-gray-900">{me.first_name} {me.last_name}</h2>
                  <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 w-fit">Administrator</span>
                </div>
                <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">{me.email}</p>
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <div className="text-center">
                    <div className="text-lg md:text-2xl font-bold text-gray-900">{stats.students}</div>
                    <div className="text-xs text-gray-500">Students</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg md:text-2xl font-bold text-gray-900">{stats.teachers}</div>
                    <div className="text-xs text-gray-500">Teachers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg md:text-2xl font-bold text-gray-900">{stats.classes}</div>
                    <div className="text-xs text-gray-500">Classes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg md:text-2xl font-bold text-gray-900">{stats.attendance}%</div>
                    <div className="text-xs text-gray-500">Attendance</div>
                  </div>
                </div>
              </div>
              <label className={`px-3 md:px-4 py-2 md:py-2 rounded-full text-xs md:text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer whitespace-nowrap ${avatarSaving ? 'opacity-60 pointer-events-none' : ''}`}>
                {avatarSaving ? 'Uploading…' : 'Change Photo'}
                <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
              </label>
            </div>

            {/* Tabs - Scrollable on mobile */}
            <div className="border-b border-gray-100 flex gap-0 overflow-x-auto overflow-y-hidden -mx-3 md:mx-0 px-3 md:px-0">
              {[
                { id: 'personal', label: 'Personal', icon: '👤' },
                { id: 'security', label: 'Security', icon: '🔒' },
                { id: 'preferences', label: 'Prefs', icon: '⚙️' },
                { id: 'sessions', label: 'Sessions', icon: '📱' },
                { id: 'notifications', label: 'Notify', icon: '🔔' },
                { id: 'privacy', label: 'Privacy', icon: '🔐' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.icon} <span className="hidden md:inline"> {tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
            {/* Left Column - Form */}
            <div className="lg:col-span-2">
              {activeTab === 'personal' && (
                <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-3 md:p-6">
                  <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3 md:mb-4">Personal Information</h3>
                  <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">Update your personal details and contact information.</p>

                  <form onSubmit={saveProfile} className="grid gap-3 md:gap-4">
                    {saveErr && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100">{saveErr}</div>}
                    {saveMsg && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm border border-emerald-100">{saveMsg}</div>}

                    <div className="grid grid-cols-2 gap-4">
                      <label className="grid gap-2 text-sm text-gray-700">
                        First Name
                        <input
                          type="text"
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                          value={form.first_name}
                          onChange={e=>setForm(f=>({...f, first_name:e.target.value}))}
                        />
                      </label>
                      <label className="grid gap-2 text-sm text-gray-700">
                        Last Name
                        <input
                          type="text"
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                          value={form.last_name}
                          onChange={e=>setForm(f=>({...f, last_name:e.target.value}))}
                        />
                      </label>
                    </div>

                    <label className="grid gap-2 text-sm text-gray-700">
                      Email (username)
                      <input
                        type="email"
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                        value={form.email}
                        onChange={e=>setForm(f=>({...f, email:e.target.value}))}
                      />
                      <span className="text-xs text-gray-500 mt-1">Admins: use your registered email.</span>
                    </label>

                    <label className="grid gap-2 text-sm text-gray-700">
                      Phone Number
                      <input
                        type="tel"
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                        value={form.phone}
                        onChange={e=>setForm(f=>({...f, phone:e.target.value}))}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="grid gap-2 text-sm text-gray-700">
                        Role
                        <select
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                          value={form.role}
                          onChange={e=>setForm(f=>({...f, role:e.target.value}))}
                        >
                          <option value="Administrator">Administrator</option>
                          <option value="Teacher">Teacher</option>
                          <option value="Finance Officer">Finance Officer</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm text-gray-700">
                        Department
                        <select
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                          value={form.department}
                          onChange={e=>setForm(f=>({...f, department:e.target.value}))}
                        >
                          <option value="Administration">Administration</option>
                          <option value="Academic">Academic</option>
                          <option value="Finance">Finance</option>
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-col-reverse md:flex-row justify-end gap-2 md:gap-3 pt-3 md:pt-4">
                      <button
                        type="button"
                        className="w-full md:w-auto px-3 md:px-4 py-2.5 md:py-2 rounded-full border border-gray-200 bg-white text-xs md:text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[44px] md:min-h-auto"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full md:w-auto px-3 md:px-4 py-2.5 md:py-2 rounded-full bg-emerald-600 text-white text-xs md:text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 min-h-[44px] md:min-h-auto"
                      >
                        {saving ? 'Saving Changes...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Security Settings</h3>
                    <p className="text-sm text-gray-500">Manage your password and security options.</p>
                  </div>

                  {/* Login Activity Chart */}
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4">Login Activity (Last 7 Days)</h4>
                    <div style={{ height: '250px' }}>
                      <Line
                        data={{
                          labels: loginHistory.map(d => d.day),
                          datasets: [
                            {
                              label: 'Successful Logins',
                              data: loginHistory.map(d => d.logins),
                              borderColor: '#10b981',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              borderWidth: 2,
                              tension: 0.4,
                              fill: true
                            },
                            {
                              label: 'Failed Attempts',
                              data: loginHistory.map(d => d.failedAttempts),
                              borderColor: '#ef4444',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              borderWidth: 2,
                              tension: 0.4,
                              fill: true
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: 'top' } },
                          scales: { y: { beginAtZero: true } }
                        }}
                      />
                    </div>
                  </div>

                  {/* Change Password Form */}
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4">Change Password</h4>
                    <form onSubmit={changePassword} className="grid gap-4">
                      {passwordErr && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100">{passwordErr}</div>}
                      {passwordMsg && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm border border-emerald-100">{passwordMsg}</div>}
                      
                      <label className="grid gap-2 text-sm text-gray-700">
                        Current Password
                        <input
                          type="password"
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                          value={passwordForm.current}
                          onChange={e=>setPasswordForm(p=>({...p, current:e.target.value}))}
                          required
                        />
                      </label>

                      <label className="grid gap-2 text-sm text-gray-700">
                        New Password
                        <input
                          type="password"
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                          value={passwordForm.new}
                          onChange={e=>setPasswordForm(p=>({...p, new:e.target.value}))}
                          required
                        />
                      </label>

                      <label className="grid gap-2 text-sm text-gray-700">
                        Confirm New Password
                        <input
                          type="password"
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                          value={passwordForm.confirm}
                          onChange={e=>setPasswordForm(p=>({...p, confirm:e.target.value}))}
                          required
                        />
                      </label>

                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          onClick={() => setPasswordForm({ current: '', new: '', confirm: '' })}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={changingPassword}
                          className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {changingPassword ? 'Changing...' : 'Change Password'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* 2FA Info */}
                  <div className="pt-4 border-t border-gray-100 p-4 bg-blue-50 rounded-xl">
                    <div className="flex gap-3">
                      <div className="text-xl">🔐</div>
                      <div>
                        <h5 className="font-semibold text-blue-900 text-sm">Two-Factor Authentication</h5>
                        <p className="text-xs text-blue-700 mt-1">Enable 2FA to add an extra layer of security to your account.</p>
                        <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 mt-2">Enable 2FA →</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Preferences</h3>
                    <p className="text-sm text-gray-500">Customize your user experience and settings.</p>
                  </div>

                  <div className="grid gap-4">
                    <label className="grid gap-2 text-sm text-gray-700">
                      Theme
                      <select
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                        value={preferences.theme}
                        onChange={e=>setPreferences(p=>({...p, theme:e.target.value}))}
                      >
                        <option value="light">Light Theme</option>
                        <option value="dark">Dark Theme</option>
                        <option value="auto">Auto (System)</option>
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm text-gray-700">
                      Language
                      <select
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                        value={preferences.language}
                        onChange={e=>setPreferences(p=>({...p, language:e.target.value}))}
                      >
                        <option value="en">English</option>
                        <option value="sw">Swahili</option>
                        <option value="fr">French</option>
                      </select>
                    </label>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">Email Updates</div>
                        <div className="text-xs text-gray-500 mt-1">Receive emails about important updates and changes</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={preferences.emailUpdates} onChange={e=>setPreferences(p=>({...p, emailUpdates:e.target.checked}))} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">Marketing Emails</div>
                        <div className="text-xs text-gray-500 mt-1">Receive promotional offers and feature announcements</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={preferences.marketingEmails} onChange={e=>setPreferences(p=>({...p, marketingEmails:e.target.checked}))} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={savePreferences}
                        className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                      >
                        Save Preferences
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sessions' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Active Sessions</h3>
                    <p className="text-sm text-gray-500">Manage and monitor your active sessions across devices.</p>
                  </div>

                  {/* Device Breakdown Chart */}
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4">Device Breakdown</h4>
                    <div style={{ height: '250px' }}>
                      <Bar
                        data={{
                          labels: deviceData.map(d => d.name),
                          datasets: [
                            {
                              label: 'Active Devices',
                              data: deviceData.map(d => d.value),
                              backgroundColor: '#6366f1',
                              borderRadius: 8,
                              borderSkipped: false
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: 'top' } },
                          scales: { y: { beginAtZero: true } }
                        }}
                      />
                    </div>
                  </div>

                  {/* Sessions List */}
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4">Current Sessions</h4>
                    <div className="space-y-3">
                      {sessions.map(session => (
                        <div key={session.id} className="flex items-start justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">
                                {session.device.includes('Windows') && '🖥️'}
                                {session.device.includes('Android') && '📱'}
                                {session.device.includes('iPhone') && '📱'}
                              </span>
                              <div>
                                <div className="font-semibold text-gray-900">{session.device}</div>
                                <div className="text-xs text-gray-500">Browser: {session.browser} • OS: {session.os}</div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              <div>Location: {session.location}</div>
                              <div>IP: {session.ip}</div>
                              <div>Last active: {session.time}</div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            {session.id === 1 && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Current</span>}
                            <button
                              onClick={() => logoutDevice(session.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                session.id === 1
                                  ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-not-allowed'
                                  : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                              }`}
                              disabled={session.id === 1}
                            >
                              {session.id === 1 ? 'Current Session' : 'Logout'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Notification Preferences</h3>
                    <p className="text-sm text-gray-500">Choose how and when you want to be notified.</p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">🔔 Login Alerts</div>
                        <div className="text-xs text-gray-500 mt-1">Get notified when your account is accessed</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={notifications.loginAlerts} onChange={e=>setNotifications(n=>({...n, loginAlerts:e.target.checked}))} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">⚡ System Updates</div>
                        <div className="text-xs text-gray-500 mt-1">Notifications about school system updates</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={notifications.updateAlerts} onChange={e=>setNotifications(n=>({...n, updateAlerts:e.target.checked}))} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">📊 Weekly Reports</div>
                        <div className="text-xs text-gray-500 mt-1">Receive weekly school performance reports</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={notifications.weeklyReport} onChange={e=>setNotifications(n=>({...n, weeklyReport:e.target.checked}))} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">📈 Monthly Reports</div>
                        <div className="text-xs text-gray-500 mt-1">Receive monthly summary reports</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={notifications.monthlyReport} onChange={e=>setNotifications(n=>({...n, monthlyReport:e.target.checked}))} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
                      <div>
                        <div className="font-semibold text-red-900 text-sm flex items-center gap-2">🚨 Security Alerts</div>
                        <div className="text-xs text-red-700 mt-1">Critical security notifications (always on)</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={notifications.securityAlerts} disabled className="sr-only peer" />
                        <div className="w-11 h-6 bg-green-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Reset to Default
                    </button>
                    <button
                      type="button"
                      onClick={saveNotifications}
                      className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Privacy & Data</h3>
                    <p className="text-sm text-gray-500">Manage your data and privacy settings.</p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    {/* Data Download */}
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-semibold text-blue-900 text-sm">Download My Data</h5>
                          <p className="text-xs text-blue-700 mt-1">Download a copy of your personal data in JSON format.</p>
                        </div>
                        <button
                          onClick={downloadData}
                          className="px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 whitespace-nowrap"
                        >
                          📥 Download
                        </button>
                      </div>
                    </div>

                    {/* Data Retention */}
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <h5 className="font-semibold text-amber-900 text-sm">Data Retention</h5>
                      <p className="text-xs text-amber-700 mt-1">Your data is retained for 90 days after account deletion unless you request immediate deletion.</p>
                      <button className="text-xs font-semibold text-amber-600 hover:text-amber-700 mt-3">Learn more →</button>
                    </div>

                    {/* Privacy Policy */}
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                      <h5 className="font-semibold text-purple-900 text-sm">Privacy Policy</h5>
                      <p className="text-xs text-purple-700 mt-1">Read our complete privacy policy to understand how we handle your data.</p>
                      <button className="text-xs font-semibold text-purple-600 hover:text-purple-700 mt-3">View Policy →</button>
                    </div>

                    {/* Delete Account */}
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-semibold text-red-900 text-sm">Delete Account</h5>
                          <p className="text-xs text-red-700 mt-1">Permanently delete your account and all associated data. This action cannot be undone.</p>
                        </div>
                        <button className="px-4 py-2 rounded-full border border-red-300 bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 whitespace-nowrap">
                          Delete Account
                        </button>
                      </div>
                    </div>

                    {/* GDPR Compliance */}
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                      <h5 className="font-semibold text-green-900 text-sm">✓ GDPR Compliant</h5>
                      <p className="text-xs text-green-700 mt-1">We are fully compliant with GDPR regulations. Your data is your right.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab !== 'personal' && activeTab !== 'security' && activeTab !== 'preferences' && activeTab !== 'sessions' && activeTab !== 'notifications' && activeTab !== 'privacy' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                  <p className="text-gray-500">This section is coming soon</p>
                </div>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-3 md:space-y-6">
              {/* Account Status */}
              <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-3 md:p-6">
                <h3 className="font-bold text-gray-900 mb-3 md:mb-4 text-sm md:text-base">Account Status</h3>
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <span className="text-xs md:text-sm text-gray-600">Status</span>
                  <span className="px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Active</span>
                </div>
                <p className="text-xs text-gray-500">Your account is active and in good standing.</p>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Member since</span>
                    <span className="text-xs md:text-sm font-semibold text-gray-900">January 15, 2024</span>
                  </div>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-3 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="font-bold text-gray-900 text-sm md:text-base">Active Sessions</h3>
                  <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View All</button>
                </div>
                <div className="space-y-3">
                  {sessions.map((session, idx) => (
                    <div key={idx} className="flex items-start justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{session.device}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{session.location}</div>
                        <div className="text-xs text-gray-400 mt-1">{session.time}</div>
                      </div>
                      {idx === 0 && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Current Session</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-3 md:p-6">
                <h3 className="font-bold text-gray-900 mb-3 md:mb-4 text-sm md:text-base">Quick Actions</h3>
                <div className="space-y-2 md:space-y-3">
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 text-left transition-colors">
                    <div className="text-xl">📥</div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Download My Data</div>
                      <div className="text-xs text-gray-500">Export your personal data</div>
                    </div>
                    <span className="ml-auto text-gray-400">→</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 text-left transition-colors">
                    <div className="text-xl">🔐</div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Privacy Settings</div>
                      <div className="text-xs text-gray-500">Manage your privacy preferences</div>
                    </div>
                    <span className="ml-auto text-gray-400">→</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 text-left transition-colors">
                    <div className="text-xl">🔔</div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Notification Preferences</div>
                      <div className="text-xs text-gray-500">Configure your notification settings</div>
                    </div>
                    <span className="ml-auto text-gray-400">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
