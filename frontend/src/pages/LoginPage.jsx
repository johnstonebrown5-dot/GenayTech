import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Building2, Check, Eye, EyeOff, Globe2, GraduationCap, LockKeyhole, Mail, Phone, User, Users } from 'lucide-react'
import { useAuth } from '../auth'
import { useNotification } from '../components/NotificationContext'
import api from '../api'
import loginDesktopBg from '../../LOGIN.png'
import loginMobileBg from '../../MOBILE LOGIN.png'


export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const { showError } = useNotification()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formStep, setFormStep] = useState('role') // 'role' | 'credentials' | 'verifying' | 'reset' | 'demo'
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [remember, setRemember] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [installReady, setInstallReady] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [showAppIntro, setShowAppIntro] = useState(false)
  const [school, setSchool] = useState({ homepage: { hero: {} } })
  const [resetOpen, setResetOpen] = useState(false)
  const [resetStep, setResetStep] = useState('request') // 'request' | 'verify' | 'confirm'
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetResendIn, setResetResendIn] = useState(0) // seconds until user can resend code
  const [resetResending, setResetResending] = useState(false)
  const [resetCodeConfirmed, setResetCodeConfirmed] = useState(false)
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false)
  const [demoForm, setDemoForm] = useState({
    school_name: '',
    domain: '',
    admin_email: '',
    admin_password: '',
    admin_first_name: '',
    admin_last_name: '',
    phone: '',
  })
  const [demoHoneypot, setDemoHoneypot] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState('')
  const [demoSuccess, setDemoSuccess] = useState('')
  const [demoFieldErrors, setDemoFieldErrors] = useState({})

  const superMode = (() => {
    try { return new URLSearchParams(location.search).get('super') === '1' } catch { return false }
  })()

  useEffect(() => {
    if (!superMode) return
    setRole('staff')
    setFormStep('credentials')
  }, [superMode])

  const notifyError = (message, title = 'Login error') => {
    setError(message)
    try {
      showError(title, message)
    } catch {}
  }

  const openReset = () => {
    setFormStep('reset')
    setResetOpen(true)
    setResetStep('request')
    setResetMessage('')
    setResetError('')
    setResetCode('')
    setResetNewPassword('')
    setResetResendIn(0)
    setResetCodeConfirmed(false)
    setResetPasswordModalOpen(false)
  }

  const closeReset = () => {
    if (resetLoading) return
    setResetOpen(false)
    setFormStep('credentials')
  }

  const openDemoRequest = () => {
    setFormStep('demo')
    setDemoError('')
    setDemoSuccess('')
    setDemoFieldErrors({})
  }

  const closeDemoRequest = () => {
    if (demoLoading) return
    setFormStep(role ? 'credentials' : 'role')
    setDemoError('')
    setDemoFieldErrors({})
  }

  const emailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passwordStrongEnough = (pwd) => Boolean(pwd && pwd.length >= 8 && /[A-Z]/.test(pwd) && /\d/.test(pwd))

  const onDemoChange = (e) => {
    const { name, value } = e.target
    setDemoForm((current) => ({ ...current, [name]: value }))
    setDemoFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const submitDemoRequest = async (e) => {
    e.preventDefault()
    setDemoError('')
    setDemoSuccess('')
    setDemoFieldErrors({})
    if (demoHoneypot) {
      setDemoError('Invalid submission.')
      return
    }

    const fieldErrors = {}
    if (!demoForm.school_name.trim()) fieldErrors.school_name = 'School name is required'
    if (!demoForm.admin_email.trim()) fieldErrors.admin_email = 'Email is required'
    else if (!emailValid(demoForm.admin_email.trim())) fieldErrors.admin_email = 'Enter a valid email'
    if (!demoForm.admin_password) fieldErrors.admin_password = 'Password is required'
    else if (!passwordStrongEnough(demoForm.admin_password)) fieldErrors.admin_password = 'Use 8+ chars, uppercase and a number'
    if (Object.keys(fieldErrors).length) {
      setDemoFieldErrors(fieldErrors)
      return
    }

    setDemoLoading(true)
    try {
      await api.post('/auth/request-demo/', { ...demoForm, website: demoHoneypot })
      setDemoSuccess('Demo request submitted. You will receive an email after approval.')
      setDemoForm({
        school_name: '',
        domain: '',
        admin_email: '',
        admin_password: '',
        admin_first_name: '',
        admin_last_name: '',
        phone: '',
      })
    } catch (err) {
      setDemoError(err?.response?.data?.detail || 'Failed to submit demo request. Please try again.')
    } finally {
      setDemoLoading(false)
    }
  }

  const submitResetRequest = async (e) => {
    e?.preventDefault?.()
    if (!resetEmail) return
    setResetLoading(true)
    setResetError('')
    setResetMessage('')
    try {
      await api.post('/auth/password-reset/request/', { email: resetEmail })
      setResetStep('verify')
      setResetMessage('We have sent a 6 digit code to your email if it exists in our system.')
      setResetResendIn(90)
      setResetCodeConfirmed(false)
    } catch (err) {
      setResetError('Could not start reset. Please try again in a moment.')
    } finally {
      setResetLoading(false)
    }
  }

  const handleConfirmResetCode = (codeOverride) => {
    const codeToUse = (codeOverride || resetCode || '').trim()
    if (!codeToUse || codeToUse.length !== 6) {
      setResetError('Enter the full 6 digit code to confirm.')
      return
    }
    setResetLoading(true)
    setResetError('')
    setResetMessage('')
    api.post('/auth/password-reset/verify/', {
      email: resetEmail,
      code: codeToUse,
    }).then(() => {
      setResetCodeConfirmed(true)
      setResetStep('confirm')
    }).catch((err) => {
      const msg = err?.response?.data?.detail || 'Invalid code or email. Please check and try again.'
      setResetError(msg)
    }).finally(() => {
      setResetLoading(false)
    })
  }

  const handleResendCode = async () => {
    if (resetResendIn > 0 || !resetEmail) return
    setResetResending(true)
    setResetError('')
    setResetMessage('')
    try {
      await api.post('/auth/password-reset/request/', { email: resetEmail })
      setResetMessage('We have sent a new 6 digit code to your email if it exists in our system.')
      setResetResendIn(90)
      setResetCode('')
      setResetCodeConfirmed(false)
    } catch (err) {
      setResetError('Could not resend code. Please try again in a moment.')
    } finally {
      setResetResending(false)
    }
  }

  const submitResetConfirm = async (e) => {
    e?.preventDefault?.()
    if (!resetEmail || !resetCode || !resetNewPassword) return
    setResetLoading(true)
    setResetError('')
    setResetMessage('')
    try {
      await api.post('/auth/password-reset/confirm/', {
        email: resetEmail,
        code: resetCode,
        new_password: resetNewPassword,
      })
      setResetMessage('Your password has been reset. You can now log in with the new password.')
      setTimeout(() => {
        setResetPasswordModalOpen(false)
      }, 900)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Invalid code or email. Please check and try again.'
      setResetError(msg)
    } finally {
      setResetLoading(false)
    }
  }
  

  useEffect(() => {
    // trigger entrance animation once mounted
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/school/public/?code=sfk')
        if (!mounted) return
        setSchool(data || {})
      } catch {
        // Ignore – fallback hero images will be used
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    try {
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone)
      const dismissed = typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('eduTrackAppIntroDismissed') === '1'
      if (isStandalone && !dismissed) {
        setShowAppIntro(true)
      }
    } catch {}
  }, [])

  // Listen for global PWA readiness and installed events
  useEffect(() => {
    function update() {
      try { setInstallReady(Boolean(window.__pwaInstallEvent)) } catch { setInstallReady(false) }
    }
    update()
    window.addEventListener('pwa:ready', update)
    window.addEventListener('pwa:installed', update)
    return () => {
      window.removeEventListener('pwa:ready', update)
      window.removeEventListener('pwa:installed', update)
    }
  }, [])

  const onInstallClick = async (e) => {
    e?.preventDefault?.()
    try {
      if (typeof window.requestPWAInstall === 'function') {
        const choice = await window.requestPWAInstall()
        if (choice && choice.outcome === 'accepted') {
          // Optional: navigate after install
        }
      }
    } catch (err) {
      // If install not available, no-op; user can use the omnibox install icon
    }
  }

  const roles = [
    {
      key: 'staff',
      label: 'Staff',
      icon: Users,
    },
    {
      key: 'student',
      label: 'Student',
      icon: GraduationCap,
    },
  ]

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (!role) {
      notifyError('Please select a role to continue', 'Login')
      return
    }

    setFormStep('verifying')
    setIsLoading(true)

    try {
      const me = await login(username, password)
      const normalizedRole = role.toLowerCase()

      const actualRole = (me?.role || '').toLowerCase()
      const isAdminUser = me?.is_superuser || me?.is_staff || actualRole === 'admin'
      const isFinance = actualRole === 'finance' || actualRole === 'finance officer'
      const isTeacher = actualRole === 'teacher'

      if (normalizedRole === 'staff') {
        const isStaff = isAdminUser || isTeacher || isFinance
        if (!isStaff) {
          notifyError('Your account is not Staff. Please choose Student or contact your school admin.', 'Login')
          setFormStep('credentials')
          setIsLoading(false)
          return
        }
        // Route staff to their dashboard by actual role
        if (isAdminUser) {
          if (me?.is_superuser) { nav('/superadmin'); return }
          nav('/admin')
          return
        }
        if (isTeacher) { nav('/teacher'); return }
        if (isFinance) { nav('/finance'); return }
        // Fallback to role-based path
        nav(`/${me.role}`)
        return
      }

      if (normalizedRole === 'student') {
        if (actualRole !== 'student') {
          notifyError(`Your account role is '${me.role}'. Please choose Staff to continue.`, 'Login')
          setFormStep('credentials')
          setIsLoading(false)
          return
        }
        nav('/student')
        return
      }
    } catch (e) {
      if (e.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const msg = e?.response?.data?.detail || 'Invalid credentials'
        notifyError(msg, 'Login failed');
      } else if (e.request) {
        // The request was made but no response was received
        notifyError('Network error. Please check your connection or try again later.', 'Network issue');
      } else {
        // Something happened in setting up the request that triggered an Error
        notifyError('An unexpected error occurred.', 'Login error');
      }
      setFormStep('credentials')
      setIsLoading(false)
    }
  }

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole)
  }

  const handleBackToRole = () => {
    setFormStep('role')
    setUsername('')
    setPassword('')
    setError('')
  }

  const handleCardMove = (e) => {
    const point = e.touches && e.touches[0] ? e.touches[0] : e
    if (!point) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = point.clientX - rect.left
    const y = point.clientY - rect.top
    const midX = rect.width / 2
    const midY = rect.height / 2
    const rotateY = ((x - midX) / midX) * 10
    const rotateX = ((midY - y) / midY) * 10
    setTilt({ x: rotateX, y: rotateY })
  }

  const resetTilt = () => {
    setTilt({ x: 0, y: 0 })
  }

  const mobileTiltTransform = `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0) translateY(${mounted ? 0 : 14}px) scale(${mounted ? 1 : 0.96})`

  const cardTitle = formStep === 'demo' ? 'Request demo' : (resetStep === 'request' ? 'Reset password' : 'Sign in')
  const codeDigits = resetCode.padEnd(6, ' ').slice(0, 6).split('')

  const LoginFooter = () => (
    <div className="mt-8 flex items-center justify-between gap-4 text-[11px] font-medium text-white/55">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>Secure connection</span>
      </div>
      <span className="whitespace-nowrap">© {new Date().getFullYear()} Genay Technologies</span>
    </div>
  )

  const BackButton = ({ onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 bg-transparent text-[11px] font-bold uppercase tracking-wide text-cyan-300 transition-colors hover:text-white"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back
    </button>
  )

  const SsoButton = ({ className = '' }) => (
    <button
      type="button"
      className={`flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/[0.07] ${className}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">G</span>
      Continue with Genay ID
    </button>
  )

  const LoginDivider = () => (
    <div className="flex items-center gap-5 text-[11px] font-semibold uppercase text-white/35">
      <span className="h-px flex-1 bg-white/10" />
      Or
      <span className="h-px flex-1 bg-white/10" />
    </div>
  )

  const renderRoleStep = () => (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-5" role="radiogroup" aria-label="Select role">
        {roles.map((r) => {
          const selected = role === r.key
          const Icon = r.icon
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => handleRoleSelect(r.key)}
              role="radio"
              aria-checked={selected}
              aria-label={r.label}
              className={`group flex min-h-[98px] flex-col items-center justify-center gap-3 rounded-lg border transition-all ${
                selected
                  ? 'border-cyan-300/70 bg-sky-500/25 shadow-[0_0_28px_rgba(14,165,233,0.18)]'
                  : 'border-white/10 bg-white/[0.045] hover:border-cyan-300/35 hover:bg-white/[0.07]'
              }`}
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${selected ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-white/40'}`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className={`text-[12px] font-bold ${selected ? 'text-white' : 'text-white/55'}`}>{r.label}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => { if (!role) return; setFormStep('credentials') }}
        disabled={!role}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-300 to-blue-600 px-6 py-4 text-[13px] font-black tracking-wide text-white shadow-[0_14px_30px_rgba(37,99,235,0.25)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
      >
        Continue
      </button>
      <p className="text-center text-[12px] font-medium text-white/38">Not sure which to pick? Ask your school administrator.</p>
      <SsoButton className="max-w-[260px] mx-auto rounded-full py-2.5" />
      <p className="text-center text-[12px] text-white/45">
        Don&apos;t have an account?{' '}
        <button type="button" onClick={openDemoRequest} className="bg-transparent font-bold text-cyan-300 hover:text-white">
          Request demo
        </button>
      </p>
    </div>
  )

  const renderCredentialsStep = () => (
    <div className="mt-6 space-y-5">
      <div className={`flex items-center justify-center ${error ? 'animate-shake' : ''}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-white/65 ${isLoading ? 'animate-pulse' : ''}`} aria-hidden>
          <LockKeyhole className="h-4.5 w-4.5" />
        </div>
      </div>
      {error && <div className="text-center text-[11px] font-semibold text-rose-300">Check your email and password, then try again.</div>}
      <form onSubmit={submit} className="space-y-5">
        <label className="login-dark-field flex items-center gap-3 rounded-lg border border-white/15 bg-slate-950/30 px-4 py-3.5 text-white/80">
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="Email or username"
            placeholder="Email / Username"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/45 focus:outline-none"
            required
          />
          <Mail className="h-4.5 w-4.5 shrink-0 text-white/60" />
        </label>

        <label className="login-dark-field flex items-center gap-3 rounded-lg border border-white/15 bg-slate-950/30 px-4 py-3.5 text-white/80">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            onKeyUp={(e)=> setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'))}
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Password"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/45 focus:outline-none"
            required
          />
          <button
            type="button"
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={()=>setShowPassword(v=>!v)}
            className="bg-transparent text-white/65 transition-colors hover:text-white"
          >
            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
        </label>
        {capsLockOn && <div className="-mt-2 text-[10px] font-bold uppercase tracking-wide text-amber-300">Caps Lock ON</div>}

        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2.5 text-[12px] font-medium text-white/50 select-none">
            <span className="relative flex h-4 w-4 items-center justify-center">
              <input type="checkbox" className="peer sr-only" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />
              <span className="absolute inset-0 rounded bg-cyan-400 peer-checked:bg-cyan-400 peer-not-checked:bg-white/10" />
              <Check className="relative h-3 w-3 text-white opacity-0 peer-checked:opacity-100" />
            </span>
            Keep me signed in
          </label>
          <button type="button" onClick={openReset} className="bg-transparent text-[11px] font-black uppercase text-rose-400 transition-colors hover:text-rose-300">Forgot password?</button>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-gradient-to-r from-cyan-300 to-blue-600 px-6 py-4 text-[13px] font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(37,99,235,0.25)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
        >
          {isLoading ? 'Verifying...' : 'Sign in'}
        </button>
      </form>
      <LoginDivider />
      <SsoButton />
      <p className="text-center text-[12px] text-white/45">
        Don&apos;t have an account?{' '}
        <button type="button" onClick={openDemoRequest} className="bg-transparent font-bold text-cyan-300 hover:text-white">
          Request demo
        </button>
      </p>
    </div>
  )

  const DemoField = ({ name, value, onChange, placeholder, type = 'text', icon: Icon, error, required = false, autoComplete }) => (
    <div>
      <label className={`login-dark-field flex items-center gap-3 rounded-lg border px-4 py-3 text-white/80 ${error ? 'border-rose-400/60 bg-rose-500/10' : 'border-white/15 bg-slate-950/30'}`}>
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/45 focus:outline-none"
        />
        {Icon && <Icon className="h-4.5 w-4.5 shrink-0 text-white/60" />}
      </label>
      {error && <div className="mt-1.5 text-[10px] font-bold text-rose-300">{error}</div>}
    </div>
  )

  const renderDemoStep = () => (
    <div className="mt-6 space-y-5 text-left">
      <div className="text-center">
        <p className="text-[12px] leading-relaxed text-white/52">
          Submit your school details. After approval, you will receive an email to activate your demo account.
        </p>
      </div>
      {demoError && <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-300">{demoError}</div>}
      {demoSuccess && <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300">{demoSuccess}</div>}
      <form onSubmit={submitDemoRequest} className="space-y-3.5">
        <DemoField
          name="school_name"
          value={demoForm.school_name}
          onChange={onDemoChange}
          placeholder="School name"
          icon={Building2}
          error={demoFieldErrors.school_name}
          required
          autoComplete="organization"
        />
        <DemoField
          name="domain"
          value={demoForm.domain}
          onChange={onDemoChange}
          placeholder="School domain (optional)"
          icon={Globe2}
          autoComplete="url"
        />
        <div className="grid grid-cols-2 gap-3">
          <DemoField
            name="admin_first_name"
            value={demoForm.admin_first_name}
            onChange={onDemoChange}
            placeholder="First name"
            icon={User}
            autoComplete="given-name"
          />
          <DemoField
            name="admin_last_name"
            value={demoForm.admin_last_name}
            onChange={onDemoChange}
            placeholder="Last name"
            icon={User}
            autoComplete="family-name"
          />
        </div>
        <DemoField
          name="admin_email"
          value={demoForm.admin_email}
          onChange={onDemoChange}
          placeholder="Email"
          type="email"
          icon={Mail}
          error={demoFieldErrors.admin_email}
          required
          autoComplete="email"
        />
        <DemoField
          name="admin_password"
          value={demoForm.admin_password}
          onChange={onDemoChange}
          placeholder="Password"
          type="password"
          icon={LockKeyhole}
          error={demoFieldErrors.admin_password}
          required
          autoComplete="new-password"
        />
        <p className="-mt-1 text-[10px] font-medium text-white/38">Use at least 8 characters, with an uppercase letter and a number.</p>
        <DemoField
          name="phone"
          value={demoForm.phone}
          onChange={onDemoChange}
          placeholder="Phone (optional)"
          icon={Phone}
          autoComplete="tel"
        />
        <div className="hidden">
          <label>Website</label>
          <input name="website" value={demoHoneypot} onChange={(e) => setDemoHoneypot(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={demoLoading}
          className="w-full rounded-lg bg-gradient-to-r from-cyan-300 to-blue-600 px-6 py-4 text-[13px] font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_rgba(37,99,235,0.25)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
        >
          {demoLoading ? 'Submitting...' : 'Submit request'}
        </button>
      </form>
      <p className="text-center text-[12px] text-white/45">
        Already have an account?{' '}
        <button type="button" onClick={closeDemoRequest} className="bg-transparent font-bold text-cyan-300 hover:text-white">
          Sign in
        </button>
      </p>
    </div>
  )

  const renderResetStep = () => (
    <div className="mt-7 space-y-6 text-left">
      {resetStep === 'request' && (
        <>
          <div>
            <h3 className="text-[15px] font-black text-cyan-300">Reset password</h3>
            <p className="mt-4 text-[11px] leading-relaxed text-white/50">Enter your email and we will send you a 6 digit code to create a new password.</p>
          </div>
          <form onSubmit={submitResetRequest} className="space-y-5">
            <label className="login-dark-field flex items-center gap-3 rounded-lg border border-white/15 bg-slate-950/30 px-4 py-3.5 text-white/80">
              <input
                type="email"
                value={resetEmail}
                onChange={(e)=>setResetEmail(e.target.value)}
                required
                placeholder="Email / Username"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/45 focus:outline-none"
              />
              <Mail className="h-4.5 w-4.5 shrink-0 text-white/60" />
            </label>
            {resetError && <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-300">{resetError}</div>}
            {resetMessage && <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300">{resetMessage}</div>}
            <button
              type="submit"
              disabled={resetLoading}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-300 to-blue-600 px-6 py-4 text-[13px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-40"
            >
              {resetLoading ? 'Sending...' : 'Send reset code'}
            </button>
          </form>
          <LoginDivider />
          <SsoButton />
        </>
      )}

      {resetStep === 'verify' && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleConfirmResetCode() }}
          className="space-y-7 text-center"
        >
          <p className="text-[12px] leading-relaxed text-white/55">
            Enter the 6 digit code we sent to<br />
            <span className="font-bold text-cyan-300">{resetEmail}</span>
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={resetCode}
            onChange={(e)=>{
              const val = e.target.value.replace(/[^0-9]/g,'')
              setResetCode(val)
              setResetCodeConfirmed(false)
              if(val.length === 6) handleConfirmResetCode(val)
            }}
            className="login-code-input sr-only"
            aria-label="6 digit code"
            autoFocus
          />
          <div className="grid grid-cols-6 gap-2">
            {codeDigits.map((digit, index) => (
              <button
                key={index}
                type="button"
                onClick={() => document.querySelector('.login-code-input')?.focus()}
                className="h-11 rounded-md border border-white/15 bg-white/[0.045] text-center font-mono text-lg font-bold text-white"
              >
                {digit.trim()}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-white/45">
            Didn't receive the code?{' '}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resetResendIn > 0 || resetResending}
              className="bg-transparent font-semibold text-cyan-300 underline disabled:text-white/25"
            >
              {resetResendIn > 0 ? `Resend in ${Math.floor(resetResendIn/60)}:${(resetResendIn%60).toString().padStart(2,'0')}` : (resetResending ? 'Sending...' : 'Resend')}
            </button>
          </p>
          {resetError && <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-left text-[11px] font-bold text-rose-300">{resetError}</div>}
          {resetMessage && <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-left text-[11px] font-bold text-emerald-300">{resetMessage}</div>}
          <button
            type="submit"
            disabled={resetLoading}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-300 to-blue-600 px-6 py-4 text-[13px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-40"
          >
            {resetLoading ? 'Verifying...' : 'Verify code'}
          </button>
          <p className="text-[12px] text-white/45">
            Wrong email?{' '}
            <button type="button" onClick={() => setResetStep('request')} className="bg-transparent font-semibold text-cyan-300">Change email</button>
          </p>
        </form>
      )}

      {resetStep === 'confirm' && (
        <form onSubmit={submitResetConfirm} className="space-y-5">
          <p className="text-center text-[12px] leading-relaxed text-white/55">
            Enter a new password for<br />
            <span className="font-bold text-cyan-300">{resetEmail}</span>
          </p>
          <label className="login-dark-field flex items-center gap-3 rounded-lg border border-white/15 bg-slate-950/30 px-4 py-3.5 text-white/80">
            <input
              type="password"
              value={resetNewPassword}
              onChange={(e)=>setResetNewPassword(e.target.value)}
              minLength={6}
              required
              placeholder="New password"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/45 focus:outline-none"
            />
            <LockKeyhole className="h-4.5 w-4.5 shrink-0 text-white/60" />
          </label>
          {resetError && <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-300">{resetError}</div>}
          {resetMessage && <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300">{resetMessage}</div>}
          <button
            type="submit"
            disabled={resetLoading}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-300 to-blue-600 px-6 py-4 text-[13px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-40"
          >
            {resetLoading ? 'Updating...' : 'Save new password'}
          </button>
        </form>
      )}
    </div>
  )

  const renderCardContent = () => (
    <>
      <div className="mb-3">
        {(formStep === 'credentials' || formStep === 'reset' || formStep === 'demo') && (
          <BackButton onClick={formStep === 'reset' ? closeReset : (formStep === 'demo' ? closeDemoRequest : handleBackToRole)} />
        )}
      </div>
      <div className="text-center">
        <h2 className="text-[22px] font-black tracking-tight text-cyan-300">{formStep === 'reset' || formStep === 'demo' ? cardTitle : 'Sign in'}</h2>
        {formStep === 'role' && <p className="mt-3 text-[12px] font-medium text-white/52">Choose your account type to continue.</p>}
        {formStep === 'credentials' && <p className="mt-3 text-[12px] font-medium text-white/52">Enter your email and password.</p>}
      </div>
      {formStep === 'role' && renderRoleStep()}
      {formStep === 'credentials' && renderCredentialsStep()}
      {formStep === 'reset' && renderResetStep()}
      {formStep === 'demo' && renderDemoStep()}
      {formStep === 'verifying' && (
        <div className="mt-8 text-center">
          <h3 className="text-sm font-black uppercase tracking-wide text-cyan-300">Verifying</h3>
          <p className="mt-2 text-[12px] text-white/55">Please wait while we check your credentials</p>
          <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 rounded-full bg-cyan-300/80 animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="h-2 w-2 rounded-full bg-cyan-300/60 animate-bounce" style={{ animationDelay: '240ms' }} />
          </div>
        </div>
      )}
      <LoginFooter />
    </>
  )

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-black"
    >
      <a href="/login?super=1" className="sr-only">Super admin login</a>
      {/* Desktop Content */}
      <main
        className="hidden sm:flex relative z-10 min-h-screen items-stretch justify-end"
        style={{
          backgroundImage: `url(${loginDesktopBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="flex min-h-screen w-full items-center justify-end px-[3.2vw] py-8">
          <section className="login-card max-h-[calc(100vh-4rem)] w-full max-w-[405px] overflow-y-auto rounded-2xl border border-white/18 bg-[#121629]/86 px-8 py-7 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            {renderCardContent()}
          </section>
        </div>
      </main>

      {/* Mobile-only content with background */}
      <div 
        className="sm:hidden relative z-10 flex min-h-screen flex-col items-stretch"
        style={{
          backgroundImage: `url(${loginMobileBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* No overlay, pure background */}
        {/* Top brand area removed */}

        {showAppIntro ? (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-12 text-center text-slate-800">
            <h2 className="text-base font-semibold tracking-wide text-indigo-700 uppercase mb-2">Welcome to Genay Technologies</h2>
            <p className="text-sm text-slate-600 max-w-xs mb-4">Keep your school attendance, results, finance and messaging in one lightweight app.</p>
            <ul className="text-[11px] text-slate-500 space-y-1 mb-6 max-w-xs text-left">
              <li>• Fast access to your dashboards from this device.</li>
              <li>• Works offline for recent data in supported areas.</li>
              <li>• Get instant alerts for important updates.</li>
            </ul>
            <button
              type="button"
              onClick={() => {
                try { window.localStorage && window.localStorage.setItem('eduTrackAppIntroDismissed', '1') } catch {}
                setShowAppIntro(false)
              }}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-indigo-500 to-sky-500 px-6 py-2.5 text-white text-sm font-semibold shadow-md"
            >
              Get started
            </button>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col justify-end px-4 pb-5">
            <div
              className="relative z-10 [perspective:1200px] w-full"
              onMouseMove={handleCardMove}
              onMouseLeave={resetTilt}
              onTouchMove={handleCardMove}
              onTouchEnd={resetTilt}
            >
              <div
                className="login-card relative mx-auto max-h-[calc(100vh-2.5rem)] w-full max-w-[405px] overflow-y-auto rounded-2xl border border-white/18 bg-[#121629]/88 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-500 ease-out will-change-transform"
                style={{ transform: mobileTiltTransform, opacity: mounted ? 1 : 0 }}
              >
                {renderCardContent()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inline reset flow now handled in main layout; overlay dialogs removed */}
    </div>
  )
}
