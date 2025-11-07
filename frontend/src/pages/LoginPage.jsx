import React, { useEffect, useState } from 'react'
import AppLogo from '../components/AppLogo'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
// Carousel images
import img1 from '../../images/pexels-akelaphotography-448877.jpg'
import img2 from '../../images/pexels-gabby-k-6289065.jpg'
import img3 from '../../images/pexels-kwakugriffn-14554003.jpg'
import img4 from '../../images/pexels-pixabay-159213.jpg'
import img5 from '../../images/pexels-pixabay-301926.jpg'
import img6 from '../../images/pexels-roman-odintsov-11025021.jpg'

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
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

  // Carousel state
  const slides = [img1, img2, img3, img4, img5, img6]
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const id = setInterval(() => {
      setCurrent((i) => (i + 1) % slides.length)
    }, 5000) // 5s per slide
    return () => clearInterval(id)
  }, [slides.length])

  useEffect(() => {
    // trigger entrance animation once mounted
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
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
      setError('Please select a role to continue')
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
          setError('Your account is not Staff. Please choose Student or contact your school admin.')
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
          setError(`Your account role is '${me.role}'. Please choose Staff to continue.`)
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
        setError('Invalid credentials');
      } else if (e.request) {
        // The request was made but no response was received
        setError('Network error. Please check your connection or try again later.');
      } else {
        // Something happened in setting up the request that triggered an Error
        setError('An unexpected error occurred.');
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

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background carousel */}
      <div className="absolute inset-0">
        {slides.map((src, idx) => (
          <img
            key={src}
            src={src}
            alt="background slide"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              current === idx ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        {/* Optional: gradient at bottom for contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30 pointer-events-none" />
      </div>
      {/* Dark vignette overlay (non-interactive) */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute -top-10 -left-10 h-72 w-72 bg-gradient-to-br from-indigo-500/40 to-purple-500/40 blur-3xl rounded-full" />
      <div className="pointer-events-none absolute bottom-10 -right-10 h-72 w-72 bg-gradient-to-br from-fuchsia-500/30 to-indigo-500/30 blur-3xl rounded-full" />

      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrent(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full transition ${current===idx ? 'bg-white' : 'bg-white/50 hover:bg-white/70'}`}
          />
        ))}
      </div>

      {/* Header */}
      <header className="hidden sm:flex relative z-10 items-center justify-between px-6 md:px-10 py-5 text-white/95">
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

      {/* Mobile header */}
      <div className="sm:hidden relative z-10 flex items-center justify-between px-4 py-4 text-white">
        <div className="flex items-center gap-2">
          <AppLogo size={32} className="w-8 h-8 rounded-md bg-white/10 p-1" />
          <div className="text-xs font-semibold tracking-wider">EDU-TRACK</div>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <a href="/" className="underline hover:text-white/80 transition">Home</a>
          <a href="mailto:EduTrack46@gmail.com" className="underline hover:text-white/80 transition">Contact</a>
        </div>
      </div>

      {/* Desktop/Tablet Content */}
      <main className="hidden sm:flex relative z-10 min-h-[calc(100vh-96px)] items-center justify-center">
        <div className="mx-auto w-full px-6 py-10">
          <div className="flex items-center justify-center">
            {/* Left: Brand pitch */}
            <div className="hidden lg:flex flex-col justify-center text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold w-max">
                Role-based access • Secure • Fast
              </div>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight">Welcome back to EduTrack</h1>
              <p className="mt-3 text-white/80 max-w-md">Sign in to manage academics, finance, messages, and analytics—all in one place.</p>
              <ul className="mt-6 space-y-2 text-white/80 text-sm">
                <li className="flex gap-2"><span className="text-indigo-300">✓</span> Smart dashboards for Admin, Teachers, Students and Finance</li>
                <li className="flex gap-2"><span className="text-indigo-300">✓</span> Secure, reliable and fast</li>
                <li className="flex gap-2"><span className="text-indigo-300">✓</span> Real-time notifications and messaging</li>
              </ul>
            </div>

            {/* Right: Auth card */}
            <div className="relative max-w-xl w-full mx-auto z-20 pointer-events-auto">
              {/* Gradient border wrapper */}
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-pink-500/40 blur opacity-75 pointer-events-none" />
              <div className={`relative z-20 bg-white/85 backdrop-blur-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/60 p-6 md:p-8 transition-all duration-500 border-hairline ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2">
                    <AppLogo size={28} className="h-7 w-7 rounded-md" />
                    <span className="sr-only">EduTrack</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">{formStep === 'role' ? 'Select your role' : 'Log in'}</h2>
                  {formStep === 'credentials' && (
                    <button onClick={handleBackToRole} className="text-sm text-indigo-700 hover:underline">Change role</button>
                  )}
                </div>

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
                            className={`group relative rounded-xl border p-4 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${selected ? 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-indigo-200 text-indigo-700 shadow-[0_10px_30px_rgba(79,70,229,0.22)]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-indigo-100 hover:shadow-md'}`}
                          >
                            <span className={`text-2xl ${selected ? 'scale-105' : ''}`}>{r.icon}</span>
                            <span>{r.label}</span>
                            {/* corner check */}
                            <span className={`pointer-events-none absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-transparent border-gray-300'} transition`}>
                              ✓
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        onClick={() => { if(!role) return; setFormStep('credentials') }}
                        disabled={!role}
                        className="flex-1 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold disabled:opacity-60 transition-transform hover:translate-y-[-1px]"
                      >Proceed</button>
                      <span className="text-xs text-gray-500">{role ? `Selected: ${role}` : 'Choose a role'}</span>
                    </div>
                    <div className="mt-3 text-xs text-gray-600">Not sure of your role? Contact your school admin.</div>
                  </div>
                )}

                {formStep === 'credentials' && (
                  <div className="mt-5">
                    {error && (
                      <div className="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded-md px-3 py-2 animate-shake" role="alert">{error}</div>
                    )}
                    <form onSubmit={submit} className="space-y-5">
                      {/* Email-as-username floating */}
                      <div className="relative group">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 3.134-7 7h14c0-3.866-3.134-7-7-7z"/></svg>
                        </span>
                        {/* Subtle decorative glow (non-interactive) */}
                        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 opacity-0 group-focus-within:opacity-80 blur-sm transition pointer-events-none" />
                        <input
                          id="login-username"
                          type="text"
                          value={username}
                          onChange={(e)=>setUsername(e.target.value)}
                          placeholder=""
                          autoComplete="username"
                          inputMode="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          aria-label="Email (username)"
                          className="peer w-full rounded-xl border border-gray-300 bg-white px-10 py-3.5 text-[15px] shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition"
                          required
                        />
                        <label htmlFor="login-username" className={`pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-gray-500 transition-all duration-200 ${username ? '-translate-y-4 text-xs' : ''} peer-focus:-translate-y-4 peer-focus:text-xs`}>Email (username)</label>
                        <div className="mt-1 text-[11px] text-gray-500">Admins: use the email you signed up with.</div>
                      </div>
                      {/* Password floating */}
                      <div className="relative group">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17 8V7a5 5 0 10-10 0v1H5v12h14V8h-2zm-8 0V7a3 3 0 016 0v1H9z"/></svg>
                        </span>
                        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 opacity-0 group-focus-within:opacity-100 blur transition pointer-events-none" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e)=>setPassword(e.target.value)}
                          onKeyUp={(e)=> setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'))}
                          placeholder=""
                          autoComplete="current-password"
                          aria-label="Password"
                          className="peer w-full rounded-xl border border-gray-200 bg-white/95 px-10 py-3.5 pr-16 text-[15px] shadow-inner focus-soft focus:border-indigo-400 transition border-hairline"
                          required
                        />
                        <label htmlFor="login-password" className={`pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-gray-500 transition-all duration-200 ${password ? '-translate-y-4 text-xs' : ''} peer-focus:-translate-y-4 peer-focus:text-xs`}>Password</label>
                        <button type="button" aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800">{showPassword?'Hide':'Show'}</button>
                        {capsLockOn && <div className="mt-1 text-[11px] text-amber-700">Caps Lock is ON</div>}
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700 select-none">
                          <input type="checkbox" className="accent-indigo-600" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />
                          Remember me
                        </label>
                        <a href="mailto:EduTrack46@gmail.com?subject=Password%20help" className="text-xs text-indigo-700 hover:underline">Forgot password?</a>
                      </div>
                      <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 disabled:opacity-60 shadow-md transition-transform active:scale-[.99]">{isLoading?'Signing In…':'Sign In'}</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Verifying overlay */}
        {formStep === 'verifying' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
            <div className="relative bg-white/85 backdrop-blur-md rounded-2xl px-8 py-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/50 border-hairline flex flex-col items-center gap-4" role="status" aria-busy="true" aria-live="polite">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-2 border-black/10" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-indigo-400 animate-spin" style={{ animationDuration: '800ms', animationDirection: 'reverse' }} />
                <div className="absolute inset-[22px] rounded-full bg-indigo-600/20 animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-indigo-700 font-extrabold tracking-wide">VERIFYING</h3>
                <p className="text-black/70 text-sm">Please wait while we check your credentials</p>
              </div>
              <div className="flex gap-1.5 items-end h-3" aria-hidden>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/70 animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/60 animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>
              <div className="w-60 h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-600 animate-pulse rounded-full" style={{ width: '72%' }} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile-only content */}
      <div className="sm:hidden relative z-10 flex min-h-screen flex-col items-center px-4 py-8">
        <div className="w-full max-w-sm flex-1 mx-auto flex flex-col justify-center gap-8">
          {/* Brand */}
          <div className="text-center text-white space-y-1">
            <div className="font-extrabold tracking-[0.3em] text-xs">WELCOME</div>
            <div className="text-sm font-semibold">Sign in to continue</div>
            <p className="text-[11px] text-white/80">Tailored dashboards for every school role.</p>
          </div>

          {/* Card with gradient border */}
          <div className="relative">
            <div className="absolute -inset-[6px] rounded-[28px] bg-gradient-to-br from-indigo-500/60 via-purple-500/45 to-fuchsia-500/55 blur opacity-90" />
            <div className="relative rounded-[28px] bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.35)] ring-1 ring-white/70 border border-white/60 p-6">
              {formStep === 'role' && (
                <div className="space-y-5">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xl shadow-inner shadow-white/40">🎯</div>
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold text-indigo-700">Select Your Role</h2>
                    <p className="text-xs text-gray-500">Choose where you need to go today.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select role">
                    {roles.map(r => {
                      const selected = role === r.key;
                      return (
                        <button
                          key={r.key}
                          onClick={()=>handleRoleSelect(r.key)}
                          role="radio"
                          aria-checked={selected}
                          aria-label={r.label}
                          className={`group relative px-3 py-3 rounded-2xl text-sm font-semibold border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 flex flex-col items-center justify-center gap-1 active:scale-[0.99] ${selected ? 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-indigo-200 text-indigo-700 shadow-[0_10px_26px_rgba(79,70,229,0.25)]' : 'bg-white/95 border-neutral-200 text-gray-700 hover:bg-white hover:border-indigo-200 hover:text-indigo-700 hover:shadow-md'}`}
                        >
                          <span className={`absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full border transition-all ${selected ? 'bg-indigo-600 text-white border-indigo-600 shadow-[0_6px_14px_rgba(79,70,229,0.45)] scale-100' : 'bg-white/80 text-transparent border-gray-300 scale-90'}`}>✓</span>
                          <span className={`text-lg transition-transform ${selected ? 'scale-105' : 'group-hover:scale-105'}`}>{r.icon}</span>
                          <span>{r.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={()=>{ if(!role) return; setFormStep('credentials') }}
                    disabled={!role}
                    className="w-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 py-3 text-white text-sm font-semibold tracking-wide shadow-lg shadow-indigo-500/30 disabled:opacity-60 disabled:shadow-none transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                      Proceed
                    </span>
                  </button>
                  {installReady && (
                    <button onClick={onInstallClick} className="w-full rounded-full border border-white/70 bg-white/70 text-indigo-700 font-semibold py-3 shadow hover:bg-white">
                      Install App
                    </button>
                  )}
                  <div className="text-center text-[12px] text-gray-600">Need help choosing? Contact the school admin.</div>
                </div>
              )}

              {formStep === 'credentials' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-indigo-700">Log In</h2>
                    <button onClick={handleBackToRole} className="text-xs text-indigo-700 underline">Change role</button>
                  </div>
                  {role && (
                    <div className="mb-3 text-xs">
                      Signing in as: <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{role}</span>
                    </div>
                  )}
                  {error && <div className="mb-3 text-xs text-red-700 bg-red-100 border border-red-200 rounded px-2 py-1.5">{error}</div>}
                  <form onSubmit={submit} className="space-y-3">
                    <div>
                      <label htmlFor="m-login-username" className="block text-[12px] text-gray-700 mb-1">Email (username)</label>
                      <input
                        id="m-login-username"
                        type="text"
                        value={username}
                        onChange={e=>setUsername(e.target.value)}
                        autoComplete="username"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        aria-label="Email (username)"
                        className="w-full rounded-lg border border-black/10 bg-white/85 px-3 py-2 text-sm shadow-inner"
                        required
                      />
                      <div className="mt-1 text-[11px] text-gray-500">Admins: use the email you signed up with.</div>
                    </div>
                    <div>
                      <label htmlFor="m-login-password" className="block text-[12px] text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input
                          id="m-login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e=>setPassword(e.target.value)}
                          onKeyUp={(e)=> setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'))}
                          autoComplete="current-password"
                          aria-label="Password"
                          className="w-full rounded-lg border border-black/10 bg-white/85 px-3 py-2 text-sm pr-16 shadow-inner"
                          required
                        />
                        <button type="button" aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={()=>setShowPassword(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-600 font-semibold">{showPassword?'Hide':'Show'}</button>
                      </div>
                      {capsLockOn && <div className="mt-1 text-[11px] text-amber-700">Caps Lock is ON</div>}
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 text-[12px] text-gray-700 select-none">
                        <input type="checkbox" className="accent-indigo-600" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />
                        Remember me
                      </label>
                      <a href="mailto:EduTrack46@gmail.com?subject=Password%20help" className="text-[12px] text-indigo-700 underline">Forgot password?</a>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-semibold py-2.5 disabled:opacity-60 disabled:shadow-none shadow-lg shadow-indigo-500/30">{isLoading?'Signing In…':'Proceed'}</button>
                  </form>
                </div>
              )}
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
      </div>
    </div>
  )
}
