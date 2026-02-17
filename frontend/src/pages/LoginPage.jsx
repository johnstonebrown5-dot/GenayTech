import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  const [formStep, setFormStep] = useState('role') // 'role' | 'credentials' | 'verifying' | 'reset'
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
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-slate-700">
          <path d="M16 11c1.66 0 2.99-1.57 2.99-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11Zm-8 0c1.66 0 2.99-1.57 2.99-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h7v-3.5c0-2.33-4.67-3.5-7-3.5Z" />
        </svg>
      ),
    },
    {
      key: 'student',
      label: 'Student',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-slate-700">
          <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3Zm0 14L5.21 13.2 3 14.4 12 19l9-4.6-2.21-1.2L12 17Z" />
        </svg>
      ),
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
        <div className="relative w-full max-w-lg flex flex-col">
          <div className="relative flex-1 overflow-hidden bg-white/10 backdrop-blur-3xl shadow-[-20px_0_80px_rgba(0,0,0,0.15)] border-l border-white/10 flex flex-col justify-center">
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 100%)' }} />
            <div className="relative px-10 py-12">
              <div className="text-center">
                {formStep === 'credentials' && (
                  <div className="absolute top-8 left-10">
                      <button 
                        onClick={handleBackToRole} 
                        className="flex items-center gap-2 text-sm font-bold text-sky-400 hover:text-cyan-400 transition-colors group bg-transparent border-none"
                      >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 transition-transform group-hover:-translate-x-1">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                      </svg>
                      BACK
                    </button>
                  </div>
                )}
                <h2 className="text-3xl font-bold text-sky-400 tracking-tight mb-1">Sign in</h2>
                {formStep === 'role' && (
                  <p className="text-sm text-white/50 font-medium">Choose your account type to continue.</p>
                )}
                {formStep === 'credentials' && (
                  <div className="mt-2 text-sm text-white/50 flex items-center justify-center gap-3">
                    <span>Enter your school email and password.</span>
                  </div>
                )}
              </div>

              {formStep === 'role' && (
                <div className="mt-10 space-y-6">
                  <div className="grid grid-cols-2 gap-6" role="radiogroup" aria-label="Select role">
                    {roles.map((r) => {
                      const selected = role === r.key
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => handleRoleSelect(r.key)}
                          role="radio"
                          aria-checked={selected}
                          aria-label={r.label}
                          className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border transition-all duration-300 ${selected ? 'bg-white/95 border-white shadow-lg' : 'bg-white/5 border-white/10 hover:bg-white/10 shadow-sm'}`}
                        >
                          <div className={`p-3 rounded-xl ${selected ? 'bg-slate-50' : 'bg-white/5'}`}>
                            {React.cloneElement(r.icon, { className: `h-8 w-8 ${selected ? 'text-slate-700' : 'text-white/60'}` })}
                          </div>
                          <span className={`text-sm font-bold tracking-tight ${selected ? 'text-slate-900' : 'text-white/60'}`}>{r.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => { if (!role) return; setFormStep('credentials') }}
                    disabled={!role}
                    className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 py-4 text-white text-base font-bold shadow-lg hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[0px] transition-all disabled:opacity-30"
                  >
                    Continue
                  </button>
                  <div className="text-[12px] font-medium text-white/40 text-center opacity-80">
                    Not sure which to pick? Ask your school administrator.
                  </div>
                </div>
              )}

              {formStep === 'credentials' && (
                <div className="mt-6 space-y-4">
                  <div className={`flex items-center justify-center ${error ? 'animate-shake' : ''}`}>
                    <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full border text-indigo-700 bg-indigo-50/70 border-indigo-100 shadow-soft ${isLoading ? 'animate-pulse' : ''}`} aria-hidden>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="w-5 h-5"
                      >
                        <path
                          d="M8.5 10V8.75a3.5 3.5 0 1 1 7 0V10"
                          className="stroke-current"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <rect
                          x="6.75"
                          y="10"
                          width="10.5"
                          height="8"
                          rx="2"
                          className="stroke-current"
                          strokeWidth="1.6"
                        />
                        <circle cx="12" cy="14" r="1" className="fill-current" />
                      </svg>
                    </div>
                  </div>
                  {error && (
                    <div className="text-center text-[11px] text-red-700">Check your email and password, then try again.</div>
                  )}
                  <form onSubmit={submit} className="space-y-8">
                    <div className="space-y-6">
                      <fieldset className="rounded-2xl border border-white/20 bg-white/95 px-4 pb-2 pt-3 shadow-inner">
                        <legend className="px-2 text-[11px] font-extrabold tracking-widest text-slate-600">USERNAME</legend>
                        <input
                          id="login-username"
                          type="text"
                          value={username}
                          onChange={(e)=>setUsername(e.target.value)}
                          autoComplete="username"
                          inputMode="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          aria-label="Email (username)"
                          placeholder="Email / Username"
                          className="w-full bg-transparent px-1 py-2 text-[15px] text-emerald-600 font-bold placeholder:text-black placeholder:opacity-60 focus:outline-none"
                          required
                        />
                        <div className="mt-1 px-1 text-[11px] text-slate-500">Admins: use your registered email.</div>
                      </fieldset>

                      <fieldset className="rounded-2xl border border-white/20 bg-white/95 px-4 pb-2 pt-3 shadow-inner">
                        <legend className="px-2 text-[11px] font-extrabold tracking-widest text-slate-600">PASSWORD</legend>
                        <div className="relative">
                          <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e)=>setPassword(e.target.value)}
                            onKeyUp={(e)=> setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'))}
                            autoComplete="current-password"
                            aria-label="Password"
                            placeholder="Password"
                            className="w-full bg-transparent px-1 py-2 pr-14 text-[15px] text-emerald-600 font-bold placeholder:text-black placeholder:opacity-60 focus:outline-none"
                            required
                          />
                          <button
                            type="button"
                            aria-pressed={showPassword}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={()=>setShowPassword(v=>!v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-extrabold text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            {showPassword ? 'HIDE' : 'SHOW'}
                          </button>
                        </div>
                        {capsLockOn && (
                          <div className="mt-1 px-1 text-[10px] font-bold text-amber-700 uppercase tracking-tighter">Caps Lock ON</div>
                        )}
                      </fieldset>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <label className="inline-flex items-center gap-2.5 text-[12px] font-semibold text-white/40 select-none cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                          <input type="checkbox" className="peer sr-only" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />
                          <div className="h-5 w-5 rounded-lg border-2 border-white/10 bg-white/5 transition-all peer-checked:bg-sky-400 peer-checked:border-sky-400" />
                          <svg className="absolute h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <span className="group-hover:text-white/60 transition-colors">Keep me signed in</span>
                      </label>
                      <button type="button" onClick={openReset} className="text-[12px] font-bold text-rose-500 hover:text-rose-400 hover:underline underline-offset-4 transition-all tracking-tight bg-transparent border-none">FORGOT PASSWORD?</button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-8 py-5 text-[16px] font-black tracking-widest text-white shadow-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                    >
                      <span className="relative z-10">{isLoading ? 'VERIFYING...' : 'SIGN IN'}</span>
                    </button>
                  </form>
                </div>
              )}

              {formStep === 'reset' && (
                <div className="mt-6 space-y-6">
                  <div className="absolute top-8 left-10">
                    <button 
                      onClick={closeReset} 
                      className="flex items-center gap-2 text-sm font-bold text-sky-400 hover:text-cyan-400 transition-colors group bg-transparent border-none"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 transition-transform group-hover:-translate-x-1">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                      </svg>
                      BACK
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-sky-400 tracking-tight">Reset password</h2>
                  </div>
                  <p className="text-sm text-white/60 font-medium">
                    {resetStep === 'confirm' 
                      ? <>Enter a new password for <span className="text-white font-bold">{resetEmail}</span>.</>
                      : 'Enter your email and we will send you a 6 digit code to create a new password.'}
                  </p>

                  {resetStep !== 'confirm' && (
                    <form onSubmit={resetStep === 'request' ? submitResetRequest : (e) => { e.preventDefault(); handleConfirmResetCode() }} className="space-y-6">
                      <div className="relative group">
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e)=>setResetEmail(e.target.value)}
                          required
                          placeholder=" "
                          className="peer w-full rounded-2xl border border-white/10 bg-white/5 px-5 pt-6 pb-2 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-white/30 transition-all placeholder:opacity-0"
                        />
                        <label className="absolute left-5 top-4 text-[13px] font-medium text-white/60 uppercase tracking-[0.1em] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-white/80 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-white/80 pointer-events-none">
                          Email address
                        </label>
                      </div>
                      
                      {resetStep === 'verify' && (
                        <div className="relative group">
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
                            required
                            placeholder=" "
                            className="peer w-full rounded-2xl border border-white/10 bg-white/5 px-5 pt-6 pb-2 text-[15px] text-white text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-1 focus:ring-white/30 transition-all placeholder:opacity-0"
                          />
                          <label className="absolute left-1/2 -translate-x-1/2 top-4 text-[13px] font-medium text-white/60 uppercase tracking-[0.1em] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-white/80 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-white/80 pointer-events-none">
                            6 Digit Code
                          </label>
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={handleResendCode}
                              disabled={resetResendIn > 0 || resetResending}
                              className="text-[11px] font-bold text-sky-400 disabled:text-white/20 uppercase tracking-tight bg-transparent"
                            >
                              {resetResendIn > 0 ? `Resend in ${Math.floor(resetResendIn/60)}:${(resetResendIn%60).toString().padStart(2,'0')}` : (resetResending ? 'Sending...' : 'Resend code')}
                            </button>
                          </div>
                        </div>
                      )}

                      {resetError && <div className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{resetError}</div>}
                      {resetMessage && <div className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3">{resetMessage}</div>}
                      
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-8 py-5 text-[16px] font-black tracking-widest text-white shadow-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                      >
                        {resetStep === 'request' ? (resetLoading ? 'SENDING...' : 'SEND RESET CODE') : (resetLoading ? 'VERIFYING...' : 'VERIFY CODE')}
                      </button>
                    </form>
                  )}

                  {resetStep === 'confirm' && (
                    <form onSubmit={submitResetConfirm} className="space-y-6">
                      <div className="relative group">
                        <input
                          type="password"
                          value={resetNewPassword}
                          onChange={(e)=>setResetNewPassword(e.target.value)}
                          minLength={6}
                          required
                          placeholder=" "
                          className="peer w-full rounded-2xl border border-white/10 bg-white/5 px-5 pt-6 pb-2 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-white/30 transition-all placeholder:opacity-0"
                        />
                        <label className="absolute left-5 top-4 text-[13px] font-medium text-white/60 uppercase tracking-[0.1em] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-white/80 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-white/80 pointer-events-none">
                          New Password
                        </label>
                      </div>
                      
                      {resetError && <div className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{resetError}</div>}
                      
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-8 py-5 text-[16px] font-black tracking-widest text-white shadow-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                      >
                        {resetLoading ? 'UPDATING...' : 'SAVE NEW PASSWORD'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              <div className="mt-10 relative">
                <div className="flex items-center justify-center">
                  <div className="px-6 py-3 rounded-full bg-white/5 border border-white/10 shadow-sm flex items-center gap-3 transition-all hover:bg-white/10">
                    <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-[11px] text-white font-bold">G</div>
                    <span className="text-[14px] font-bold text-white/60">www.GenayTech.com</span>
                  </div>
                </div>
              </div>

              {formStep === 'verifying' && (
                <>
                  <div className="mt-6 text-center">
                    <h3 className="text-sky-700 font-extrabold tracking-wide">VERIFYING</h3>
                    <p className="text-black/70 text-sm">Please wait while we check your credentials</p>
                  </div>
                  <div className="mt-3 flex items-center justify-center">
                    <div className="flex gap-1.5 items-end h-3" aria-hidden>
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-600/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-600/70 animate-bounce" style={{ animationDelay: '120ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-600/60 animate-bounce" style={{ animationDelay: '240ms' }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="absolute bottom-8 left-12 flex items-center gap-6 text-[12px] font-medium text-white/80">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Secure connection
            </div>
            <span>•</span>
            <span>© {new Date().getFullYear()} Genay Technologies</span>
          </div>
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
          <div className="w-full flex-1 flex flex-col justify-end">
            {/* Phone-like card with 3D tilt */}
            <div
              className="relative z-10 [perspective:1200px] w-full"
              onMouseMove={handleCardMove}
              onMouseLeave={resetTilt}
              onTouchMove={handleCardMove}
              onTouchEnd={resetTilt}
            >
              <div
                className="relative w-full overflow-hidden rounded-[32px] bg-white shadow-[0_20px_40px_rgba(15,23,42,0.25)] border border-indigo-100 transition-all duration-500 ease-out will-change-transform"
                style={{ transform: mobileTiltTransform, opacity: mounted ? 1 : 0 }}
              >
              <div className="h-16 bg-gradient-to-r from-sky-400 to-cyan-400 flex items-center justify-between px-5 text-white">
                <span className="text-sm font-semibold">Login</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] opacity-80">{role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Select role'}</span>
                  <button
                    type="button"
                    onClick={() => nav('/')}
                    aria-label="Close login and go to homepage"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white text-xs border border-white/30"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="px-5 pt-4 pb-6 space-y-4">
                {formStep === 'role' && (
                  <div className="space-y-4">
                    <div className="text-xs text-indigo-600 font-semibold tracking-wide text-left">Choose your role</div>
                    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select role">
                      {roles.map(r => {
                        const selected = role === r.key;
                        return (
                          <button
                            key={r.key}
                            onClick={() => handleRoleSelect(r.key)}
                            role="radio"
                            aria-checked={selected}
                            aria-label={r.label}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold py-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                              selected
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                                : 'bg-white border-indigo-100 text-gray-700 hover:bg-indigo-50/60 hover:border-indigo-200'
                            }`}
                          >
                            <span className="text-lg">{r.icon}</span>
                            <span>{r.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => {
                        if (!role) return;
                        setFormStep('credentials');
                      }}
                      disabled={!role}
                      className="w-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 py-3 text-white text-sm font-semibold tracking-wide shadow-md disabled:opacity-60 disabled:shadow-none transition-all"
                    >
                      Continue
                    </button>
                    {installReady && (
                      <button
                        onClick={onInstallClick}
                        className="w-full rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 text-xs font-medium py-2.5 mt-1"
                      >
                        Install App
                      </button>
                    )}
                    <div className="text-[11px] text-gray-500 text-center">Need help choosing? Contact the school admin.</div>
                    {/* Mobile Footer inside card */}
                    <div className="pt-2 text-center text-[10px] text-gray-400">© {new Date().getFullYear()} Genay Technologies</div>
                  </div>
                )}

                {formStep === 'credentials' && (
                  <div className="space-y-4">
                    {role && (
                      <div className="text-[11px] text-gray-500">
                        Signing in as{' '}
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{role}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-center">
                      <div className={`inline-flex items-center justify-center h-9 w-9 rounded-full border text-indigo-700 bg-indigo-50/80 border-indigo-100 shadow-soft ${isLoading ? 'animate-pulse' : ''} ${error ? 'animate-shake' : ''}`} aria-hidden>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="w-4 h-4"
                        >
                          <path
                            d="M8.5 10V8.75a3.5 3.5 0 1 1 7 0V10"
                            className="stroke-current"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <rect
                            x="6.75"
                            y="10"
                            width="10.5"
                            height="8"
                            rx="2"
                            className="stroke-current"
                            strokeWidth="1.6"
                          />
                          <circle cx="12" cy="14" r="1" className="fill-current" />
                        </svg>
                      </div>
                    </div>
                    {error && (
                      <div className="text-[11px] text-red-700 text-center">Check your details and try again.</div>
                    )}
                    <form onSubmit={submit} className="space-y-3">
                      <fieldset className="rounded-xl border border-indigo-100 bg-white px-3 pb-2 pt-2 shadow-inner">
                        <legend className="px-2 text-[10px] font-extrabold tracking-widest text-slate-500">USERNAME</legend>
                        <input
                          id="m-login-username"
                          type="text"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          autoComplete="username"
                          inputMode="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          aria-label="Email (username)"
                          placeholder="Email / Username"
                          className="w-full bg-transparent px-1 py-2 text-sm text-emerald-600 font-bold focus:outline-none placeholder:text-black placeholder:opacity-60"
                          required
                        />
                      </fieldset>
                      <fieldset className="rounded-xl border border-indigo-100 bg-white px-3 pb-2 pt-2 shadow-inner">
                        <legend className="px-2 text-[10px] font-extrabold tracking-widest text-slate-500">PASSWORD</legend>
                        <div className="relative">
                          <input
                            id="m-login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyUp={e => setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'))}
                            autoComplete="current-password"
                            aria-label="Password"
                            placeholder="Password"
                            className="w-full bg-transparent px-1 py-2 pr-16 text-sm text-emerald-600 font-bold focus:outline-none placeholder:text-black placeholder:opacity-60"
                            required
                          />
                          <button
                            type="button"
                            aria-pressed={showPassword}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-indigo-700 font-semibold"
                          >
                            {showPassword ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        {capsLockOn && <div className="mt-1 text-[11px] text-amber-700">Caps Lock is ON</div>}
                      </fieldset>
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-[11px] text-gray-700 select-none">
                          <input type="checkbox" className="accent-indigo-600" checked={remember} onChange={e => setRemember(e.target.checked)} />
                          Remember me
                        </label>
                        <button
                          type="button"
                          onClick={openReset}
                          className="text-[11px] text-indigo-700 underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 text-white font-semibold py-2.5 disabled:opacity-60 disabled:shadow-none shadow-md mt-1"
                      >
                        {isLoading ? 'Signing In…' : 'Login'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={handleBackToRole}
                      className="w-full text-[11px] text-gray-500 underline mt-1"
                    >
                      Change role
                    </button>
                  </div>
                )}

                {formStep === 'reset' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-900">Reset password</h2>
                      <button
                        type="button"
                        onClick={closeReset}
                        className="text-[11px] text-slate-500 hover:text-slate-700"
                      >
                        Back to login
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {resetStep === 'confirm'
                        ? <>Enter a new password for <span className="font-medium">{resetEmail}</span>.</>
                        : 'Enter your email and we will send you a 6 digit code to create a new password.'}
                    </p>

                    {resetStep !== 'confirm' && (
                      <form
                        onSubmit={resetStep === 'request'
                          ? submitResetRequest
                          : (e) => {
                              e.preventDefault()
                              handleConfirmResetCode()
                            }
                        }
                        className="space-y-3"
                      >
                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-slate-700">Email</label>
                          <input
                            type="email"
                            value={resetEmail}
                            onChange={(e)=>setResetEmail(e.target.value)}
                            required
                            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${resetError && resetStep === 'request' ? 'border-red-300 bg-red-50/60' : 'border-slate-200'}`}
                          />
                        </div>
                        {resetStep === 'verify' && (
                          <>
                            <div className="space-y-1">
                              <label className="block text-[11px] font-medium text-slate-700">6 digit code</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={resetCode}
                                onChange={(e)=>{
                                  const value = e.target.value.replace(/[^0-9]/g,'')
                                  setResetCode(value)
                                  setResetCodeConfirmed(false)
                                  if (value.length === 6) {
                                    handleConfirmResetCode(value)
                                  }
                                }}
                                required
                                className={`w-full rounded-md border px-3 py-2 text-sm tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-indigo-300 ${resetError ? 'border-red-300 bg-red-50/60' : 'border-slate-200'}`}
                              />
                              <div className="mt-1 flex items-center justify-end text-[11px] text-slate-500">
                                <button
                                  type="button"
                                  onClick={handleResendCode}
                                  disabled={resetResendIn > 0 || resetResending}
                                  className="text-[11px] font-medium text-indigo-600 disabled:text-slate-400 disabled:cursor-not-allowed hover:underline tabular-nums"
                                >
                                  {resetResendIn > 0
                                    ? `Resend in ${Math.floor(resetResendIn / 60)}:${(resetResendIn % 60).toString().padStart(2,'0')}`
                                    : (resetResending ? 'Resending…' : 'Resend code')}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                        {resetError && (
                          <div className="flex items-start gap-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                            <span className="mt-[2px] h-3 w-3 rounded-full border border-red-400 flex items-center justify-center text-[9px] font-bold">!</span>
                            <span>{resetError}</span>
                          </div>
                        )}
                        {resetMessage && (
                          <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">{resetMessage}</div>
                        )}
                        <button
                          type="submit"
                          disabled={resetLoading}
                          className="w-full mt-1 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 text-white text-sm font-semibold py-2.5 disabled:opacity-60"
                        >
                          {resetStep === 'request'
                            ? (resetLoading ? 'Sending code…' : 'Send code')
                            : (resetLoading ? 'Checking…' : 'Check code')}
                        </button>
                      </form>
                    )}

                    {resetStep === 'confirm' && (
                      <form onSubmit={submitResetConfirm} className="space-y-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-slate-700">New password</label>
                          <input
                            type="password"
                            value={resetNewPassword}
                            onChange={(e)=>setResetNewPassword(e.target.value)}
                            minLength={6}
                            required
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                        {resetError && (
                          <div className="flex items-start gap-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                            <span className="mt-[2px] h-3 w-3 rounded-full border border-red-400 flex items-center justify-center text-[9px] font-bold">!</span>
                            <span>{resetError}</span>
                          </div>
                        )}
                        {resetMessage && (
                          <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">{resetMessage}</div>
                        )}
                        <button
                          type="submit"
                          disabled={resetLoading}
                          className="w-full mt-1 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 text-white text-sm font-semibold py-2.5 disabled:opacity-60"
                        >
                          {resetLoading ? 'Updating…' : 'Save new password'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Verifying overlay - mobile */}
          {formStep === 'verifying' && (
            <div className="fixed inset-0 z-50 sm:hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
              <div className="relative bg-white/90 backdrop-blur-md rounded-2xl px-6 py-6 shadow-[0_16px_48px_rgba(0,0,0,0.3)] ring-1 ring-white/50 border-hairline flex flex-col items-center gap-3" role="status" aria-busy="true" aria-live="polite">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-black/10" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-400 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-sky-300 animate-spin" style={{ animationDuration: '800ms', animationDirection: 'reverse' }} />
                  <div className="absolute inset-[18px] rounded-full bg-sky-400/20 animate-pulse" />
                </div>
                <div className="text-center">
                  <h3 className="text-sky-400 text-sm font-extrabold tracking-wide">VERIFYING</h3>
                  <p className="text-black/70 text-xs">Please wait…</p>
                </div>
                <div className="flex gap-1 items-end h-2.5" aria-hidden>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400/70 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
                <div className="w-44 h-1.5 bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 animate-pulse rounded-full" style={{ width: '70%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Footer removed from here and moved inside card */}
        </div>
        )}
      </div>

      {/* Inline reset flow now handled in main layout; overlay dialogs removed */}
    </div>
  )
}
