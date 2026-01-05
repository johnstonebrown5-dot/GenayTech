import React, { useEffect, useState } from 'react'
import AppLogo from '../components/AppLogo'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useNotification } from '../components/NotificationContext'
 

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const { showError } = useNotification()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formStep, setFormStep] = useState('role') // 'role' | 'credentials' | 'verifying'
  const [rolling, setRolling] = useState(false) // circle roll animation
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [remember, setRemember] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [installReady, setInstallReady] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [showAppIntro, setShowAppIntro] = useState(false)

  const notifyError = (message, title = 'Login error') => {
    setError(message)
    try {
      showError(title, message)
    } catch {}
  }
  

  useEffect(() => {
    // trigger entrance animation once mounted
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
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
    { key: 'staff', label: 'Staff', icon: '👥' },
    { key: 'student', label: 'Student', icon: '🎓' },
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
        if (isAdminUser) { nav('/admin'); return }
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
        notifyError('Invalid credentials', 'Login failed');
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
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-sky-50">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-[500px] w-[500px] rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(56,189,248,0.35),transparent)]" />
        <div className="absolute top-1/2 -translate-y-1/2 -right-24 h-[560px] w-[560px] rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(99,102,241,0.30),transparent)]" />
        <div className="absolute bottom-[-120px] left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(2,132,199,0.25),transparent)]" />
      </div>
      {/* Header */}
      <header className="hidden sm:flex relative z-10 items-center justify-between px-6 md:px-10 py-5 text-slate-700">
        <div className="flex items-center gap-3">
          <AppLogo size={36} className="w-9 h-9 rounded-lg bg-white/10 p-1" />
          <a href="/" className="hidden sm:block text-sm hover:underline">Home</a>
        </div>
        <div className="text-center font-semibold tracking-widest drop-shadow">EDU-TRACK</div>
        <div className="flex items-center gap-3">
          {installReady && (
            <button onClick={onInstallClick} className="text-sm px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 border border-white/20 shadow-sm">
              Install App
            </button>
          )}
          <a href="mailto:EduTrack46@gmail.com" className="text-sm hover:underline">Contact Us</a>
        </div>
      </header>

      {/* Desktop/Tablet Content */}
      <main className="hidden sm:flex relative z-10 min-h-[calc(100vh-96px)] items-center justify-center">
        <div className="mx-auto w-full px-6 py-10">
          <div className="mx-auto w-full max-w-[980px]">
            <div className="relative overflow-hidden rounded-[28px] bg-white/75 backdrop-blur-2xl shadow-elevated border border-white/70 ring-1 ring-black/5 px-10 py-10 md:px-12 md:py-12">
              <div className="absolute inset-x-16 -top-24 h-40 bg-gradient-to-r from-sky-500/30 via-indigo-500/25 to-sky-400/30 blur-3xl pointer-events-none" />
              <div className="relative z-10 grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center">
                {/* Intro copy (minimal) */}
                <div className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                  <div className="flex items-center gap-3">
                    <AppLogo size={40} className="h-10 w-10 rounded-2xl bg-white/20 p-1.5 shadow-soft" />
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-sky-600">EduTrack</div>
                      <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Sign in</h1>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 max-w-sm">
                    Access your school dashboard in one place.
                  </p>
                  <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-[pulse_1.6s_ease-in-out_infinite]" />
                    <span>Secure connection enabled.</span>
                  </div>
                </div>

                {/* Form area */}
                <div className="relative rounded-2xl border border-slate-100 bg-white/80 shadow-soft px-6 py-7">
                  <div className="flex items-center justify-center">
                    <h2 className="text-xl font-semibold text-slate-900 text-center">{formStep === 'role' ? 'Select your role' : 'Log in'}</h2>
                  </div>
                  {formStep === 'role' && (
                    <p className="mt-1 text-center text-sm text-slate-500">Choose where you need to go today.</p>
                  )}
                  {formStep === 'credentials' && (
                    <div className="mt-1 text-center">
                      <button onClick={handleBackToRole} className="text-sm text-sky-700 hover:underline">Change role</button>
                    </div>
                  )}

                  {formStep === 'role' && (
                    <div className="mt-6">
                      <div className="grid grid-cols-2 gap-4" role="radiogroup" aria-label="Select role">
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
                              className={`group relative rounded-2xl ring-1 px-0 py-0 h-28 w-full overflow-hidden transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${selected ? 'bg-gradient-to-br from-sky-50 to-indigo-50 ring-sky-300 shadow-[0_10px_30px_rgba(2,132,199,0.18)]' : 'bg-white ring-slate-200 hover:bg-slate-50 hover:ring-sky-200 hover:shadow-md'}`}
                            >
                              <div className="flex h-full w-full items-center justify-center flex-col gap-2 px-5">
                                <span className={`inline-flex items-center justify-center h-9 w-9 rounded-full shadow-inner ${selected ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-600'}`}>{r.icon}</span>
                                <span className={`${selected ? 'text-sky-800' : 'text-slate-700'} text-sm font-semibold`}>{r.label}</span>
                              </div>
                              <span className={`pointer-events-none absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-transparent border-slate-300'} transition`}>✓</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-6">
                        <button
                          onClick={() => { if(!role) return; setFormStep('credentials') }}
                          disabled={!role}
                          className="w-full py-3 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-600 text-white font-semibold disabled:opacity-60 transition-transform hover:translate-y-[-1px] shadow-md"
                        >Proceed</button>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>{role ? `Selected: ${role}` : ''}</span>
                          <span>Choose a role</span>
                        </div>
                      </div>
                      <div className="mt-4 text-xs text-slate-600 text-center">Not sure of your role? Contact your school admin.</div>
                    </div>
                  )}

                  {formStep === 'credentials' && (
                    <div className="mt-8 space-y-4">
                      <div className={`flex items-center justify-center ${error ? 'animate-shake' : ''}`}>
                        <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full border text-sky-700 bg-sky-50/70 border-sky-100 shadow-soft ${isLoading ? 'animate-pulse' : ''}`} aria-hidden>
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
                      <form onSubmit={submit} className="space-y-5">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 3.134-7 7h14c0-3.866-3.134-7-7-7z"/></svg>
                          </span>
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
                            placeholder="Email (username)"
                            className="w-full rounded-xl border border-gray-300 bg-white px-10 py-3.5 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-500 transition"
                            required
                          />
                          <div className="mt-1 text-[11px] text-slate-500">Admins: use the email you signed up with.</div>
                        </div>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17 8V7a5 5 0 10-10 0v1H5v12h14V8h-2zm-8 0V7a3 3 0 016 0v1H9z"/></svg>
                          </span>
                          <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e)=>setPassword(e.target.value)}
                            onKeyUp={(e)=> setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'))}
                            autoComplete="current-password"
                            aria-label="Password"
                            placeholder="Password"
                            className="w-full rounded-xl border border-gray-200 bg-white px-10 py-3.5 pr-16 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-500 transition"
                            required
                          />
                          <button type="button" aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sky-700 hover:text-sky-900">{showPassword?'Hide':'Show'}</button>
                          {capsLockOn && <div className="mt-1 text-[11px] text-amber-700">Caps Lock is ON</div>}
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700 select-none">
                            <input type="checkbox" className="accent-sky-600" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />
                            Remember me
                          </label>
                          <a href="mailto:EduTrack46@gmail.com?subject=Password%20help" className="text-xs text-sky-700 hover:underline">Forgot password?</a>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-600 text-white font-semibold py-3 disabled:opacity-60 shadow-md transition-transform active:scale-[.99]">{isLoading?'Signing In…':'Sign In'}</button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verifying overlay */}
        {formStep === 'verifying' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
            <div className="relative bg-white/95 backdrop-blur-md rounded-2xl px-8 py-7 shadow-[0_20px_60px_rgba(0,0,0,0.25)] ring-1 ring-black/5 border border-white/60 flex flex-col items-center gap-4" role="status" aria-busy="true" aria-live="polite">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-2 border-black/10" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-600 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-sky-400 animate-spin" style={{ animationDuration: '800ms', animationDirection: 'reverse' }} />
                <div className="absolute inset-[22px] rounded-full bg-sky-600/20 animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-sky-700 font-extrabold tracking-wide">VERIFYING</h3>
                <p className="text-black/70 text-sm">Please wait while we check your credentials</p>
              </div>
              <div className="flex gap-1.5 items-end h-3" aria-hidden>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600/70 animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600/60 animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>
              <div className="w-60 h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 via-sky-400 to-sky-600 animate-pulse rounded-full" style={{ width: '72%' }} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile-only content */}
      <div className="sm:hidden relative z-10 flex min-h-screen flex-col items-stretch bg-sky-50">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-sky-600 via-sky-500 to-sky-600 opacity-90" />
        </div>
        {/* Global floating balloons background */}
        <div className="pointer-events-none absolute inset-x-6 top-16 bottom-8 z-0">
          <div className="absolute bottom-[-40px] left-2 h-9 w-9 rounded-full bg-gradient-to-b from-sky-300 to-sky-500 opacity-70 animate-float-up-slow" />
          <div className="absolute bottom-[-48px] right-4 h-11 w-11 rounded-full bg-gradient-to-b from-sky-300 to-sky-500 opacity-70 animate-float-up-medium" style={{ animationDelay: '2.2s' }} />
          <div className="absolute bottom-[-56px] left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 opacity-75 animate-float-up-fast" style={{ animationDelay: '4s' }} />
          <div className="absolute bottom-[-52px] left-1/4 h-7 w-7 rounded-full bg-gradient-to-b from-emerald-300 to-emerald-500 opacity-60 animate-float-up-medium" style={{ animationDelay: '6s' }} />
        </div>
        {/* Top brand area */}
        <div className="pt-6 pb-2 flex flex-col items-center justify-start text-white relative z-10">
          <div className="text-[11px] font-semibold tracking-[0.28em] uppercase">EDU-TRACK</div>
          <p className="mt-2 text-[11px] text-white/90">Login to access your school dashboards.</p>
        </div>

        {showAppIntro ? (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-12 text-center text-slate-800">
            <h2 className="text-base font-semibold tracking-wide text-sky-700 uppercase mb-2">Welcome to EduTrack</h2>
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
              className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-6 py-2.5 text-white text-sm font-semibold shadow-md"
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
                className="relative w-full overflow-hidden rounded-[32px] bg-white shadow-[0_20px_40px_rgba(15,23,42,0.25)] border border-sky-100 transition-all duration-500 ease-out will-change-transform"
                style={{ transform: mobileTiltTransform, opacity: mounted ? 1 : 0 }}
              >
              <div className="h-16 bg-gradient-to-r from-sky-600 to-sky-500 flex items-center justify-between px-5 text-white">
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
                    <div className="text-xs text-sky-600 font-semibold tracking-wide text-left">Choose your role</div>
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
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold py-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              selected
                                ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-sm'
                                : 'bg-white border-sky-100 text-gray-700 hover:bg-sky-50/60 hover:border-sky-200'
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
                      className="w-full rounded-full bg-gradient-to-r from-sky-600 to-sky-500 py-3 text-white text-sm font-semibold tracking-wide shadow-md disabled:opacity-60 disabled:shadow-none transition-all"
                    >
                      Continue
                    </button>
                    {installReady && (
                      <button
                        onClick={onInstallClick}
                        className="w-full rounded-full border border-sky-100 bg-sky-50 text-sky-700 text-xs font-medium py-2.5 mt-1"
                      >
                        Install App
                      </button>
                    )}
                    <div className="text-[11px] text-gray-500 text-center">Need help choosing? Contact the school admin.</div>
                  </div>
                )}

                {formStep === 'credentials' && (
                  <div className="space-y-4">
                    {role && (
                      <div className="text-[11px] text-gray-500">
                        Signing in as{' '}
                        <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">{role}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-center">
                      <div className={`inline-flex items-center justify-center h-9 w-9 rounded-full border text-sky-700 bg-sky-50/80 border-sky-100 shadow-soft ${isLoading ? 'animate-pulse' : ''} ${error ? 'animate-shake' : ''}`} aria-hidden>
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
                      <div className="space-y-1">
                        <label htmlFor="m-login-username" className="block text-[12px] text-gray-700">
                          Email (username)
                        </label>
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
                          className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-200"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="m-login-password" className="block text-[12px] text-gray-700">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id="m-login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyUp={e => setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'))}
                            autoComplete="current-password"
                            aria-label="Password"
                            className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm pr-16 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-200"
                            required
                          />
                          <button
                            type="button"
                            aria-pressed={showPassword}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-sky-700 font-semibold"
                          >
                            {showPassword ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        {capsLockOn && <div className="mt-1 text-[11px] text-amber-700">Caps Lock is ON</div>}
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-[11px] text-gray-700 select-none">
                          <input type="checkbox" className="accent-sky-600" checked={remember} onChange={e => setRemember(e.target.checked)} />
                          Remember me
                        </label>
                        <a
                          href="mailto:EduTrack46@gmail.com?subject=Password%20help"
                          className="text-[11px] text-sky-700 underline"
                        >
                          Forgot password?
                        </a>
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-full bg-gradient-to-r from-sky-600 to-sky-500 text-white font-semibold py-2.5 disabled:opacity-60 disabled:shadow-none shadow-md mt-1"
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
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-indigo-400 animate-spin" style={{ animationDuration: '800ms', animationDirection: 'reverse' }} />
                  <div className="absolute inset-[18px] rounded-full bg-indigo-600/20 animate-pulse" />
                </div>
                <div className="text-center">
                  <h3 className="text-indigo-700 text-sm font-extrabold tracking-wide">VERIFYING</h3>
                  <p className="text-black/70 text-xs">Please wait…</p>
                </div>
                <div className="flex gap-1 items-end h-2.5" aria-hidden>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/70 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/60 animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
                <div className="w-44 h-1.5 bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-600 animate-pulse rounded-full" style={{ width: '70%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 text-center text-[11px] text-white/80">© {new Date().getFullYear()} EDU-TRACK</div>
        </div>
        )}
      </div>
    </div>
  )
}
