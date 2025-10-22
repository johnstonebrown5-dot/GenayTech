import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'

export default function SchoolHome() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactChannel, setContactChannel] = useState('email') // 'email' | 'whatsapp'
  const [contactForm, setContactForm] = useState({ name:'', from:'', message:'' })
  const [school, setSchool] = useState({
    name: 'Sunrise High School',
    motto: 'Learning for a Brighter Tomorrow',
    email: 'info@sunrisehigh.example',
    phone: '+254 700 000 000',
    address: 'Sunrise Avenue, Nairobi, Kenya',
    logo_url: '',
    homepage: {}
  })
  const [heroTilt, setHeroTilt] = useState({ rx: 0, ry: 0 })
  const [heroIndex, setHeroIndex] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)

  // Simple scroll-reveal helper
  function Reveal({ className = '', children }){
    const ref = useRef(null)
    const [on, setOn] = useState(false)
    useEffect(()=>{
      const el = ref.current
      if(!el) return
      const io = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{ if(e.isIntersecting) setOn(true) })
      }, { threshold: 0.12 })
      io.observe(el)
      return ()=> io.disconnect()
    },[])
    return (
      <div ref={ref} className={`${className} transition-all duration-700 will-change-transform ${on? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        {children}
      </div>
    )
  }

  function Wave({ className = '', flip = false }) {
    return (
      <svg className={className} viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" style={flip ? { transform: 'scaleY(-1)' } : undefined}>
        <path fill="currentColor" d="M0,64L60,80C120,96,240,128,360,138.7C480,149,600,139,720,133.3C840,128,960,128,1080,122.7C1200,117,1320,107,1380,101.3L1440,96L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z" />
      </svg>
    )
  }

  function CountUp({ value, className = '' }) {
    const str = (value ?? '').toString()
    const m = str.match(/^\s*(\d+(?:\.\d+)?)\s*([^0-9]*)$/)
    const [display, setDisplay] = useState(m ? '0' + (m[2] || '') : str)
    const ref = useRef(null)
    const done = useRef(false)
    useEffect(() => {
      if (!m) { setDisplay(str); return }
      const target = parseFloat(m[1])
      const suffix = m[2] || ''
      const node = ref.current
      if (!node || done.current) return
      let mounted = true
      const duration = 1200
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !done.current) {
          const t0 = performance.now()
          function tick(now){
            if (!mounted) return
            const p = Math.min(1, (now - t0)/duration)
            const val = Math.round(target * p)
            setDisplay(val.toLocaleString() + suffix)
            if (p < 1) requestAnimationFrame(tick); else done.current = true
          }
          requestAnimationFrame(tick)
          obs.disconnect()
        }
      }, { threshold: 0.2 })
      obs.observe(node)
      return () => { mounted = false; try { obs.disconnect() } catch {} }
    }, [str])
    return <span ref={ref} className={className}>{display}</span>
  }

  function onHeroMouseMove(e){
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    const ry = x * 10
    const rx = -y * 8
    setHeroTilt({ rx, ry })
  }
  function onHeroMouseLeave(){ setHeroTilt({ rx: 0, ry: 0 }) }

  function handleCardTilt(e){
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    const ry = x * 8
    const rx = -y * 6
    e.currentTarget.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`
    e.currentTarget.style.transition = 'transform 80ms ease-out'
  }
  function resetCardTilt(e){
    e.currentTarget.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'
    e.currentTarget.style.transition = 'transform 180ms ease-out'
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/school/public/?code=sfk')
        if (!mounted) return
        const merged = {
          name: data?.name || school.name,
          motto: data?.motto || school.motto,
          email: data?.social_links?.email || school.email,
          phone: data?.social_links?.phone || school.phone,
          address: data?.address || school.address,
          logo_url: data?.logo_url || '',
          homepage: data?.homepage || {}
        }
        setSchool(merged)
      } catch {
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const raw = Array.isArray(school?.homepage?.hero?.images) ? school.homepage.hero.images : []
    const len = raw.length || 4
    if (len <= 1) return
    const id = setInterval(() => setHeroIndex(i => (i + 1) % len), 5000)
    return () => clearInterval(id)
  }, [school?.homepage?.hero?.images])

  useEffect(() => {
    function onScroll(){
      const st = window.scrollY
      const h = document.documentElement.scrollHeight - window.innerHeight
      const p = h > 0 ? st / h : 0
      setScrollProgress(p)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Show a loading screen while fetching school data
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-white text-gray-600">
        <div className="flex flex-col items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-8 w-8 animate-spin text-indigo-600" aria-hidden="true" role="status">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
          </svg>
          <div>Loading school…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0px); }
        }
        @keyframes float2 {
          0% { transform: translateY(0px); }
          50% { transform: translateY(10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes panZoom {
          0% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.04) translateY(-4px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes pulseBadge {
          0%,100% { box-shadow: 0 0 0 0 rgba(79,70,229,0.25); }
          50% { box-shadow: 0 0 0 8px rgba(79,70,229,0.0); }
        }
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        @keyframes bounceY { 0%,100% { transform: translateY(0) } 50% { transform: translateY(6px) } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: scale(1.01); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 md:h-1 pointer-events-none">
        <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 transform-gpu origin-left" style={{ transform: `scaleX(${scrollProgress})` }} />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-transparent shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <img src={toAbsoluteUrl(school.logo_url)} alt="School logo" className="h-9 w-9 rounded-xl object-cover border border-gray-200" />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white grid place-items-center font-bold shadow-sm">S</div>
            )}
            <span className="text-xl font-semibold tracking-tight text-gray-900">{school.name}</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#about" className="hover:text-gray-900">About</a>
            <a href="#academics" className="hover:text-gray-900">Academics</a>
            <Link to="/teachers" className="hover:text-gray-900">Teachers</Link>
            <a href="#admissions" className="hover:text-gray-900">Admissions</a>
            <a href="#news" className="hover:text-gray-900">News</a>
            <a href="#contact" className="hover:text-gray-900">Contact</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-md hover:bg-gray-50">Portal Login</Link>
            <Link to="/app" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow hover:opacity-95">Open App</Link>
          </div>
          <button
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              {mobileOpen ? (
                <path fillRule="evenodd" d="M6.225 4.811a1 1 0 0 1 1.414 0L12 9.172l4.361-4.361a1 1 0 1 1 1.414 1.414L13.414 10.586l4.361 4.361a1 1 0 0 1-1.414 1.414L12 12l-4.361 4.361a1 1 0 0 1-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 0 1 0-1.414Z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M4 6.75A.75.75 0 0 1 4.75 6h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 6.75ZM4 12a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 12Zm.75 4.5a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H4.75Z" clipRule="evenodd" />
              )}
            </svg>
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-6 py-4 flex flex-col gap-3 text-gray-700">
              <a href="#about" onClick={() => setMobileOpen(false)} className="py-2">About</a>
              <a href="#academics" onClick={() => setMobileOpen(false)} className="py-2">Academics</a>
              <Link to="/teachers" onClick={() => setMobileOpen(false)} className="py-2">Teachers</Link>
              <a href="#admissions" onClick={() => setMobileOpen(false)} className="py-2">Admissions</a>
              <a href="#news" onClick={() => setMobileOpen(false)} className="py-2">News</a>
              <a href="#contact" onClick={() => setMobileOpen(false)} className="py-2">Contact</a>
              <div className="flex gap-3 pt-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg text-center">Portal Login</Link>
                <Link to="/app" onClick={() => setMobileOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg text-center">Open App</Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(79,70,229,0.12),transparent_60%),radial-gradient(1200px_600px_at_110%_30%,rgba(147,51,234,0.12),transparent_60%),linear-gradient(to_bottom,white,rgba(248,250,252,0.6))]" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-300/30 blur-3xl" style={{ animation: 'float 10s ease-in-out infinite' }} />
        <div aria-hidden className="pointer-events-none absolute bottom-0 -left-24 h-80 w-80 rounded-full bg-purple-300/30 blur-3xl" style={{ animation: 'float2 12s ease-in-out infinite' }} />
        <div aria-hidden className="pointer-events-none absolute top-10 left-10 h-6 w-6 rounded-full bg-indigo-400/40" style={{ animation: 'float 8s ease-in-out infinite' }} />
        <div aria-hidden className="pointer-events-none absolute bottom-12 right-16 h-10 w-10 rounded-full border border-purple-300/60" style={{ animation: 'spinSlow 18s linear infinite' }} />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-semibold mb-4 shadow-sm" style={{ animation: 'pulseBadge 2.8s ease-out infinite' }}>
                <span>{school.homepage?.hero?.badge || school.motto}</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 via-gray-900 to-indigo-800 bg-clip-text text-transparent">
                {school.homepage?.hero?.title || `Welcome to ${school.name}`}
              </h1>
              <div className="mt-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
              <p className="mt-4 text-xl text-gray-600">
                {school.homepage?.hero?.subtitle || 'A nurturing, diverse and high-achieving community empowering students to thrive in academics, character, and service.'}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={school.homepage?.hero?.ctaPrimaryLink || '#admissions'} className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl hover:opacity-95 transition" style={{ backgroundSize: '200% 100%', animation: 'shimmer 6s linear infinite' }}>
                  {school.homepage?.hero?.ctaPrimaryText || 'Start Your Application'}
                </a>
                <a href={school.homepage?.hero?.ctaSecondaryLink || '#about'} className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
                  {school.homepage?.hero?.ctaSecondaryText || 'Learn More'}
                </a>
              </div>
              <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500"/>Safe Environment</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-500"/>Dedicated Staff</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-purple-500"/>Holistic Learning</div>
              </div>
            </div>
            <div className="relative">
              <div onMouseMove={onHeroMouseMove} onMouseLeave={onHeroMouseLeave} style={{ transform: `perspective(1000px) rotateX(${heroTilt.rx}deg) rotateY(${heroTilt.ry}deg)`, transformStyle: 'preserve-3d', transition: 'transform 180ms ease-out' }}>
                <div className="rounded-3xl border border-gray-200 shadow-2xl overflow-hidden bg-white ring-1 ring-gray-100 transform transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)]" style={{ animation: 'panZoom 16s ease-in-out infinite' }}>
                  {(() => {
                    const imgs = school?.homepage?.hero?.images || []
                    const main = imgs[0] ? toAbsoluteUrl(imgs[0]) : new URL('../../images/pexels-kwakugriffn-14554003.jpg', import.meta.url).href
                    const t1 = imgs[1] ? toAbsoluteUrl(imgs[1]) : new URL('../../images/pexels-gabby-k-6289065.jpg', import.meta.url).href
                    const t2 = imgs[2] ? toAbsoluteUrl(imgs[2]) : new URL('../../images/pexels-akelaphotography-448877.jpg', import.meta.url).href
                    const t3 = imgs[3] ? toAbsoluteUrl(imgs[3]) : new URL('../../images/pexels-kwakugriffn-14554003.jpg', import.meta.url).href
                    return (
                      <>
                        <img
                          src={main}
                          alt="Hero"
                          width="1280"
                          height="640"
                          loading="eager"
                          decoding="async"
                          className="w-full h-80 object-cover"
                        />
                        <div className="grid grid-cols-3 divide-x divide-gray-100">
                          <img loading="lazy" decoding="async" width="400" height="160" src={t1} alt="Students" className="h-28 w-full object-cover"/>
                          <img loading="lazy" decoding="async" width="400" height="160" src={t2} alt="Learning" className="h-28 w-full object-cover"/>
                          <img loading="lazy" decoding="async" width="400" height="160" src={t3} alt="Community" className="h-28 w-full object-cover"/>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
              {(() => {
                const st = school?.homepage?.stats || {}
                const students = st?.students ?? '—'
                const teachers = st?.teachers ?? '—'
                const satisfaction = st?.satisfaction || '98%'
                return (
                  <div className="pointer-events-none absolute -bottom-5 left-4 right-4 md:left-6 md:right-auto z-10">
                    <div className="rounded-xl border border-gray-200 bg-white/80 backdrop-blur px-3 py-2 shadow-md flex gap-4 text-sm">
                      <div className="flex items-baseline gap-1"><CountUp value={students} className="text-indigo-700 font-semibold" /><span className="text-gray-600">Students</span></div>
                      <div className="flex items-baseline gap-1"><CountUp value={teachers} className="text-indigo-700 font-semibold" /><span className="text-gray-600">Teachers</span></div>
                      <div className="flex items-baseline gap-1"><CountUp value={satisfaction} className="text-indigo-700 font-semibold" /><span className="text-gray-600">Satisfaction</span></div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2 bottom-6 text-gray-500/80">
          <span className="text-xs tracking-wider uppercase">Scroll</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" style={{ animation: 'bounceY 1.2s infinite' }}>
            <path d="M12 16.5a1 1 0 0 1-.7-.29l-5-5a1 1 0 1 1 1.4-1.42l4.3 4.3 4.3-4.3a1 1 0 0 1 1.4 1.42l-5 5a1 1 0 0 1-.7.29Z" />
          </svg>
        </div>
        <Wave className="absolute -bottom-px left-0 right-0 h-16 w-full text-purple-50" />
      </section>

      {/* About */}
      <section id="about" className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-sky-50 to-emerald-50/30">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-25 [background:radial-gradient(rgba(99,102,241,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
          <Reveal>
            <h2 className="text-3xl font-bold text-gray-900">{school.homepage?.about?.title || `About ${school.name}`}</h2>
            <p className="mt-4 text-lg text-gray-600">{school.homepage?.about?.text || `Founded on excellence and integrity, ${school.name} offers a rich curriculum, vibrant co-curricular life and a caring environment that inspires students to reach their full potential.`}</p>
            <ul className="mt-6 space-y-3 text-gray-700">
              {(school.homepage?.about?.bullets && school.homepage.about.bullets.length ? school.homepage.about.bullets : [
                'Experienced and caring teachers',
                'Strong STEM and Humanities programs',
                'Sports, arts, clubs and community service',
                'Safe, inclusive and diverse community'
              ]).map((b)=> (
                <li key={b} className="flex gap-2"><span className="text-indigo-600">•</span> {b}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">At a Glance</h3>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-700">
              <div className="rounded-lg bg-gray-50 p-4">
                <CountUp value={school.homepage?.stats?.students ?? '—'} className="text-2xl font-bold text-indigo-700" />
                <div className="mt-1">Students</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <CountUp value={school.homepage?.stats?.teachers ?? '—'} className="text-2xl font-bold text-indigo-700" />
                <div className="mt-1">Teachers</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <CountUp value={school.homepage?.stats?.satisfaction || '98%'} className="text-2xl font-bold text-indigo-700" />
                <div className="mt-1">Parent Satisfaction</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-2xl font-bold text-indigo-700">{school.homepage?.stats?.ratio || '15:1'}</div>
                <div className="mt-1">Student-Teacher Ratio</div>
              </div>
              {school.homepage?.stats?.completion ? (
                <div className="rounded-lg bg-gray-50 p-4">
                  <CountUp value={school.homepage.stats.completion} className="text-2xl font-bold text-indigo-700" />
                  <div className="mt-1">KCSE Completion</div>
                </div>
              ) : null}
              <div className="rounded-lg bg-gray-50 p-4">
                <CountUp value={school.homepage?.stats?.clubs || '40+'} className="text-2xl font-bold text-indigo-700" />
                <div className="mt-1">Co-curricular Clubs</div>
              </div>
            </div>
          </Reveal>
          </div>
        </div>
        <Wave className="absolute -bottom-px left-0 right-0 h-16 w-full text-emerald-50" />
      </section>

      {/* Academics */}
      <section id="academics" className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-indigo-50 to-purple-50/40">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-20 [background:radial-gradient(rgba(16,185,129,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />
        <Wave className="absolute -top-px left-0 right-0 h-16 w-full text-emerald-50" flip />
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-gray-900">Academic Programs</h2>
            <p className="mt-3 text-lg text-gray-600">Engaging, rigorous and future‑ready curriculum from junior secondary through senior school.</p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(school.homepage?.programs && school.homepage.programs.length ? school.homepage.programs : [
              { title: 'Junior Secondary', desc: 'Strong foundations in literacy, numeracy, sciences and arts.' },
              { title: 'Senior School', desc: 'KCSE-aligned subjects with personalized mentorship.' },
              { title: 'STEM', desc: 'Labs, coding, robotics and competitions to spark innovation.' },
              { title: 'Humanities', desc: 'History, Geography, Languages and Social Sciences.' },
              { title: 'Sports & Arts', desc: 'Football, athletics, music, drama and visual arts.' },
              { title: 'Clubs & Societies', desc: 'Debate, wildlife, Red Cross, Scouts and more.' },
            ]).map((f, idx) => (
              <Reveal key={f.title}>
                <div className={`rounded-xl border border-gray-200 p-6 hover:shadow-lg transition bg-gradient-to-br ${['from-indigo-50 to-indigo-100','from-emerald-50 to-emerald-100','from-violet-50 to-violet-100','from-rose-50 to-rose-100','from-amber-50 to-amber-100','from-sky-50 to-sky-100'][idx % 6]}`} onMouseMove={handleCardTilt} onMouseLeave={resetCardTilt} style={{ transformStyle: 'preserve-3d', transition: 'transform 120ms ease-out' }}>
                  <div className="h-10 w-10 rounded-lg grid place-items-center mb-4 bg-indigo-600/10 text-indigo-700">★</div>
                  <h3 className="font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Wave className="absolute -bottom-px left-0 right-0 h-16 w-full text-indigo-50" />
      </section>

      {/* Admissions CTA */}
      <section id="admissions" className="relative overflow-hidden bg-gradient-to-b from-purple-50 via-pink-50 to-rose-50/30">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-20 [background:radial-gradient(rgba(244,114,182,0.16)_1px,transparent_1px)] [background-size:22px_22px]" />
        <Wave className="absolute -top-px left-0 right-0 h-16 w-full text-purple-50" flip />
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <h2 className="text-3xl font-bold text-gray-900">Admissions</h2>
            <p className="mt-3 text-gray-600">{school.homepage?.admissions?.text || 'Applications are open for the upcoming term. We welcome prospective families to visit our campus and meet our community.'}</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {(school.homepage?.admissions?.bullets || [
                'Day and Boarding options',
                'Scholarships and financial aid available',
                'Rolling admissions (space permitting)'
              ]).map((b) => (
                <li key={b} className="flex gap-2"><span className="text-green-600">✓</span> {b}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={school.homepage?.admissions?.applicationLink || '/admissions'} className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow hover:shadow-md hover:opacity-95">{school.homepage?.admissions?.primaryText || 'Apply / Inquire'}</a>
              <a href={school.homepage?.admissions?.secondaryLink || `tel:${(school.phone||'').replace(/\s/g,'')}`} className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">{school.homepage?.admissions?.secondaryText || 'Call Admissions'}</a>
              {school.homepage?.admissions?.letterUrl && (
                <a href={toAbsoluteUrl(school.homepage.admissions.letterUrl)} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-lg border border-indigo-200 text-indigo-700 font-medium hover:bg-indigo-50">Download Admission Letter</a>
              )}
            </div>
          </Reveal>
          <Reveal className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Visit Us</h3>
            <p className="mt-2 text-sm text-gray-600">School tours are available by appointment. We look forward to welcoming you.</p>
            <div className="mt-4 text-sm text-gray-700">
              <div className="font-medium">Address</div>
              <div>{school.address}</div>
            </div>
            {(() => {
              const url = school.homepage?.admissions?.mapUrl
              const safe = url && typeof url === 'string' && url.includes('http') ? url : null
              const embed = safe ? safe : (school.address ? `https://www.google.com/maps?q=${encodeURIComponent(school.address)}&output=embed` : '')
              return embed ? (
                <div className="mt-4 overflow-hidden rounded-lg border">
                  <iframe title="School Map" src={embed} width="100%" height="220" style={{border:0}} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
              ) : null
            })()}
          </Reveal>
          </div>
        </div>
        <Wave className="absolute -bottom-px left-0 right-0 h-16 w-full text-rose-50" />
      </section>

      {/* News / Highlights */}
      <section id="news" className="relative overflow-hidden bg-gradient-to-b from-rose-50 via-violet-50 to-indigo-50/40">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-15 [background:radial-gradient(rgba(147,51,234,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />
        <Wave className="absolute -top-px left-0 right-0 h-16 w-full text-rose-50" flip />
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">News & Highlights</h2>
              <p className="mt-3 text-gray-600">What’s happening around the school.</p>
            </div>
            <a href="#" className="hidden sm:inline text-sm text-indigo-700 hover:underline">View all</a>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {(school.homepage?.news || [
              { title: 'National Science Fair Winners', date: 'Sep 12, 2025', url: '' },
              { title: 'Inter-County Football Champions', date: 'Aug 30, 2025', url: '' },
              { title: 'New ICT Lab Commissioned', date: 'Aug 05, 2025', url: '' },
            ]).map((n, idx) => (
              <Reveal key={n.title || idx}>
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg" onMouseMove={handleCardTilt} onMouseLeave={resetCardTilt} style={{ transformStyle: 'preserve-3d', transition: 'transform 120ms ease-out' }}>
                  {n.image ? (
                    <img src={toAbsoluteUrl(n.image)} alt={n.title || 'News image'} className="w-full aspect-[16/9] object-cover" loading="lazy" />
                  ) : (
                    <div className="aspect-[16/9] bg-gray-100" />
                  )}
                  <div className="p-4">
                    <div className="text-xs text-gray-500">{n.date}</div>
                    <h3 className="mt-1 font-semibold text-gray-900">{n.title}</h3>
                    {(/^https?:\/\//i.test(n.url || '')
                      ? <a href={n.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">Read more →</a>
                      : <Link to={`/news/${idx}`} className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">Read more →</Link>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-blue-50 to-white">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-15 [background:radial-gradient(rgba(59,130,246,0.16)_1px,transparent_1px)] [background-size:22px_22px]" />
        <Wave className="absolute -top-px left-0 right-0 h-16 w-full text-indigo-50" flip />
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Contact Us</h2>
            <p className="mt-3 text-gray-600">We are here to help. Reach out with any questions or to schedule a visit.</p>
            <div className="mt-6 space-y-3 text-gray-700">
              <div><span className="font-medium">Email:</span> <a className="text-indigo-700 hover:underline" href={`mailto:${school.email}`}>{school.email}</a></div>
              <div><span className="font-medium">Phone:</span> <a className="text-indigo-700 hover:underline" href={`tel:${(school.phone||'').replace(/\s/g,'')}`}>{school.phone}</a></div>
              <div><span className="font-medium">Address:</span> <span>{school.address}</span></div>
            </div>
            <div className="mt-8 flex gap-3">
              <a href={`mailto:${school.email}?subject=General%20Inquiry`} className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Send Email</a>
              <Link to="/login" className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">Parent/Student Portal</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Office Hours</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              <li className="flex justify-between border-b border-gray-100 pb-2"><span>Mon - Fri</span><span>8:00 AM - 5:00 PM</span></li>
              <li className="flex justify-between"><span>Sat</span><span>9:00 AM - 1:00 PM</span></li>
            </ul>
          </div>
          </div>
        </div>
        <Wave className="absolute -bottom-px left-0 right-0 h-16 w-full text-white" />
      </section>

      {/* Footer */}
      <footer className="relative border-t border-indigo-100 bg-indigo-50">
        <div aria-hidden className="pointer-events-none absolute -top-6 left-0 right-0 h-6 bg-gradient-to-r from-indigo-200/50 via-purple-200/50 to-indigo-200/50" />
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {school.logo_url ? (
                  <img src={toAbsoluteUrl(school.logo_url)} alt="School logo" className="h-10 w-10 rounded-xl object-cover border border-gray-200" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white grid place-items-center font-bold shadow-sm">S</div>
                )}
                <div>
                  <div className="font-semibold text-gray-900">{school.name}</div>
                  <div className="text-sm text-gray-500 truncate">{school.motto || 'Shaping bright futures'}</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {school.homepage?.about?.text || `We are a caring, high‑achieving school focused on academics, character and service.`}
              </p>
              <div className="flex gap-3">
                {school?.social_links?.facebook && (
                  <a aria-label="Facebook" href={school.social_links.facebook} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 text-gray-600 hover:text-indigo-700 hover:border-indigo-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M13.5 9H15V6h-1.5C11.57 6 10 7.57 10 9.5V11H8v3h2v7h3v-7h2.06l.44-3H13v-1.5c0-.28.22-.5.5-.5Z"/></svg>
                  </a>
                )}
                {school?.social_links?.twitter && (
                  <a aria-label="Twitter" href={school.social_links.twitter} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 text-gray-600 hover:text-indigo-700 hover:border-indigo-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M22 5.8c-.7.3-1.4.5-2.2.6.8-.5 1.3-1.1 1.6-2-.8.5-1.7.9-2.6 1.1C18 4.7 17 4.2 15.9 4.2c-2.1 0-3.8 1.8-3.8 3.9 0 .3 0 .6.1.9-3.2-.2-6-1.8-7.9-4.2-.3.6-.5 1.2-.5 1.9 0 1.3.6 2.4 1.6 3.1-.6 0-1.1-.2-1.6-.4 0 2 1.4 3.6 3.2 4-.3.1-.7.1-1 .1-.2 0-.5 0-.7-.1.5 1.6 2 2.8 3.8 2.9-1.4 1.1-3.2 1.7-5.1 1.7H2c1.8 1.2 4 1.9 6.3 1.9 7.5 0 11.7-6.4 11.7-12 0-.2 0-.4 0-.6.8-.6 1.4-1.2 2-2Z"/></svg>
                  </a>
                )}
                {school?.social_links?.instagram && (
                  <a aria-label="Instagram" href={school.social_links.instagram} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 text-gray-600 hover:text-indigo-700 hover:border-indigo-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5a5 5 0 1 0 .001 10.001A5 5 0 0 0 12 7Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM18 6.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>
                  </a>
                )}
                {school?.social_links?.youtube && (
                  <a aria-label="YouTube" href={school.social_links.youtube} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 text-gray-600 hover:text-indigo-700 hover:border-indigo-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M23 8.2a4 4 0 0 0-2.8-2.9C18.3 5 12 5 12 5s-6.3 0-8.2.3A4 4 0 0 0 1 8.2 41.3 41.3 0 0 0 1 12c0 3.8.3 3.8.8 5.8A4 4 0 0 0 4.6 20C6.5 20.3 12 20.3 12 20.3s6.3 0 8.2-.3a4 4 0 0 0 2.8-2.9c.5-2 .8-2 .8-5.8s-.3-3.8-.8-5.8ZM9.8 15.5V8.5l6 3.5-6 3.5Z"/></svg>
                  </a>
                )}
                {school?.social_links?.website && (
                  <a aria-label="Website" href={school.social_links.website} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 text-gray-600 hover:text-indigo-700 hover:border-indigo-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm6.93 9h-3.09a14.59 14.59 0 0 0-1.17-5 8.022 8.022 0 0 1 4.26 5ZM12 4a12.86 12.86 0 0 1 1.79 7H10.2A12.86 12.86 0 0 1 12 4ZM4.81 16A8.027 8.027 0 0 1 4 12a8.027 8.027 0 0 1 .81-4h3.09a14.59 14.59 0 0 0-1.17 4 14.59 14.59 0 0 0 1.17 4H4.81ZM12 20a12.86 12.86 0 0 1-1.79-7h3.58A12.86 12.86 0 0 1 12 20Zm3.35-4a14.59 14.59 0 0 0 1.17-4 14.59 14.59 0 0 0-1.17-4h3.09a8.027 8.027 0 0 1 .81 4 8.027 8.027 0 0 1-.81 4Z"/></svg>
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 md:gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Quick Links</div>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li><a href="#about" className="hover:text-gray-900">About</a></li>
                  <li><a href="#academics" className="hover:text-gray-900">Academics</a></li>
                  <li><a href="#admissions" className="hover:text-gray-900">Admissions</a></li>
                  <li><a href="#news" className="hover:text-gray-900">News</a></li>
                  <li><a href="#contact" className="hover:text-gray-900">Contact</a></li>
                  <li><Link to="/login" className="hover:text-gray-900">Portal Login</Link></li>
                </ul>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Contact</div>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li><span className="text-gray-500">Email:</span> <a href={`mailto:${school.email}`} className="hover:text-indigo-700">{school.email}</a></li>
                  <li><span className="text-gray-500">Phone:</span> <a href={`tel:${(school.phone||'').replace(/\s/g,'')}`} className="hover:text-indigo-700">{school.phone}</a></li>
                  <li><span className="text-gray-500">Address:</span> <span>{school.address}</span></li>
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-5 bg-gradient-to-br from-white to-indigo-50/30">
              <div className="text-sm font-semibold text-gray-900">Stay in touch</div>
              <p className="mt-2 text-sm text-gray-600">Questions about admissions or visits? We’re happy to help.</p>
              <div className="mt-4 flex gap-3">
                <a href={`mailto:${school.email}?subject=General%20Inquiry`} className="inline-flex items-center px-4 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium shadow hover:opacity-95">Email Us</a>
                <a href={`tel:${(school.phone||'').replace(/\s/g,'')}`} className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Call</a>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-3 border-t border-gray-100 pt-6 text-sm text-gray-600">
            <div>© {new Date().getFullYear()} {school.name}. All rights reserved.</div>
            <div className="flex items-center gap-2 text-gray-600">
              <span>Powered by</span>
              <button type="button" onClick={()=>{ setContactChannel('email'); setContactOpen(true) }} className="font-medium text-indigo-700 hover:underline">EduTrack</button>
              <span className="hidden md:inline">·</span>
              <button type="button" onClick={()=>{ setContactChannel('email'); setContactOpen(true) }} className="hover:text-gray-900">Email</button>
              <span>·</span>
              <button type="button" onClick={()=>{ setContactChannel('whatsapp'); setContactOpen(true) }} className="hover:text-gray-900">WhatsApp</button>
            </div>
            <div className="flex items-center gap-4">
              <a href={`mailto:${school.email}`} className="hover:text-gray-900">Email</a>
              <a href={`tel:${(school.phone||'').replace(/\s/g,'')}`} className="hover:text-gray-900">Call</a>
              <Link to="/login" className="hover:text-gray-900">Portal Login</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      {contactOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setContactOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="text-base font-semibold text-gray-900">Contact EduTrack</div>
                <button className="p-2 rounded-md hover:bg-gray-50" onClick={()=>setContactOpen(false)} aria-label="Close">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M6.225 4.811a1 1 0 0 1 1.414 0L12 9.172l4.361-4.361a1 1 0 1 1 1.414 1.414L13.414 10.586l4.361 4.361a1 1 0 0 1-1.414 1.414L12 12l-4.361 4.361a1 1 0 0 1-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 0 1 0-1.414Z" clipRule="evenodd"/></svg>
                </button>
              </div>
              <div className="px-5 py-4">
                <div className="text-sm text-gray-600">Send an inquiry via Email or WhatsApp. We’ll get back to you promptly.</div>
                <div className="mt-4 grid gap-3">
                  <label className="text-sm">Your Name
                    <input className="mt-1 w-full border rounded-md p-2" value={contactForm.name} onChange={e=>setContactForm(f=>({ ...f, name:e.target.value }))} placeholder="Jane Doe" />
                  </label>
                  <label className="text-sm">Your Email or Phone
                    <input className="mt-1 w-full border rounded-md p-2" value={contactForm.from} onChange={e=>setContactForm(f=>({ ...f, from:e.target.value }))} placeholder="jane@example.com or +2547xxxxxxx" />
                  </label>
                  <label className="text-sm">Message
                    <textarea rows={4} className="mt-1 w-full border rounded-md p-2" value={contactForm.message} onChange={e=>setContactForm(f=>({ ...f, message:e.target.value }))} placeholder="Write your inquiry..." />
                  </label>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Channel:</span>
                  <div className="inline-flex rounded-md border border-gray-200 p-1">
                    <button type="button" className={`px-3 py-1 rounded ${contactChannel==='email' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setContactChannel('email')}>Email</button>
                    <button type="button" className={`ml-1 px-3 py-1 rounded ${contactChannel==='whatsapp' ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`} onClick={()=>setContactChannel('whatsapp')}>WhatsApp</button>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={()=>setContactOpen(false)}>Cancel</button>
                  <button className="px-4 py-2 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white" onClick={async ()=>{
                    const subject = encodeURIComponent('EduTrack Inquiry')
                    const body = encodeURIComponent(`Name: ${contactForm.name}\nFrom: ${contactForm.from}\n\n${contactForm.message}`)
                    try {
                      await api.post('/communications/contact-inquiry/', {
                        name: contactForm.name,
                        sender: contactForm.from,
                        message: contactForm.message,
                        channel: contactChannel,
                        origin: window.location.href,
                      })
                    } catch (e) { /* best-effort; continue to client app */ }
                    if (contactChannel==='email') {
                      window.location.href = `mailto:edutrack46@gmail.com?subject=${subject}&body=${body}`
                    } else {
                      const plain = `EduTrack Inquiry\nName: ${contactForm.name}\nFrom: ${contactForm.from}\n\n${contactForm.message}`
                      const text = encodeURIComponent(plain)
                      const url = `https://api.whatsapp.com/send?phone=254796031071&text=${text}`
                      window.open(url,'_blank')
                    }
                  }}>Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
