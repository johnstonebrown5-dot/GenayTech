import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { toAbsoluteUrl, imageCandidates } from '../api'
import ProgressiveImage from '../components/ProgressiveImage'

export default function SchoolHome() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [slowLoading, setSlowLoading] = useState(false)
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
  const [showStickyCta, setShowStickyCta] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const navigate = useNavigate()

  // Reveal now renders content immediately (lazy/scroll animation disabled site-section wide)
  function Reveal({ className = '', children }){
    return <div className={className}>{children}</div>
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

  function FeaturedCard({ item }) {
    function slugify(s){
      return (s||'').toString().toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$|_/g,'').trim()
    }
    const imgs = Array.isArray(item?.images) && item.images.length
      ? item.images
      : (item?.image ? [item.image] : [])
    const sources = imgs.map((u)=> (/^https?:/i.test(u) ? u : toAbsoluteUrl(u)))
    const [ix, setIx] = useState(0)
    const hasMulti = sources.length > 1
    const current = sources[ix] || ''
    const defaultSlug = slugify(item?.slug || item?.title)
    const defaultHref = `/featured/${defaultSlug}`
    const href = item?.link || defaultHref
    const isExternal = /^https?:\/\//i.test(href)
    function prev(){ setIx(i => (i - 1 + sources.length) % sources.length) }
    function next(){ setIx(i => (i + 1) % sources.length) }
    return (
      <Reveal className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg">
        {(() => {
          const ImgBlock = (
            current ? (
              <div className="relative">
                <img src={current} alt={item?.title || 'Featured'} className="w-full aspect-[16/9] object-cover" loading="lazy"/>
                {hasMulti && (
                  <>
                    <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1">
                      {sources.map((_, di)=> (
                        <span key={`dot-${di}`} className={`h-1.5 w-1.5 rounded-full ${di===ix? 'bg-white' : 'bg-white/60'}`} />
                      ))}
                    </div>
                    <button type="button" aria-label="Previous" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/35 text-white hover:bg-black/50">‹</button>
                    <button type="button" aria-label="Next" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/35 text-white hover:bg-black/50">›</button>
                  </>
                )}
              </div>
            ) : (
              <div className="aspect-[16/9] bg-gray-100" />
            )
          )
          return isExternal ? (
            <a href={href} target="_blank" rel="noreferrer">{ImgBlock}</a>
          ) : (
            <Link to={href}>{ImgBlock}</Link>
          )
        })()}
        <div className="p-4">
          {item?.tag ? <div className="text-xs inline-flex px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">{item.tag}</div> : null}
          {isExternal ? (
            <a href={href} target="_blank" rel="noreferrer" className="mt-1 font-semibold text-gray-900 hover:underline block">{item?.title}</a>
          ) : (
            <Link to={href} className="mt-1 font-semibold text-gray-900 hover:underline block">{item?.title}</Link>
          )}
          {item?.desc ? <p className="mt-1 text-sm text-gray-600">{item.desc}</p> : null}
          <div className="mt-2">
            {isExternal ? (
              <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">Read more →</a>
            ) : (
              <Link to={href} className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">Read more →</Link>
            )}
          </div>
        </div>
      </Reveal>
    )
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

  // If loading takes too long, prompt user to refresh
  useEffect(() => {
    if (!loading) { setSlowLoading(false); return }
    const timeoutMs = 12000
    const id = setTimeout(() => setSlowLoading(true), timeoutMs)
    return () => clearTimeout(id)
  }, [loading])

  useEffect(() => {
    function onBIP(e){
      try { e.preventDefault() } catch {}
      setInstallPrompt(e)
    }
    function onInstalled(){
      setInstallPrompt(null)
      try { navigate('/app', { replace: true }) } catch {}
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [navigate])

  const onOpenApp = async (e) => {
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
    const isiOSStandalone = typeof window !== 'undefined' && 'standalone' in window.navigator && window.navigator.standalone
    if (isStandalone || isiOSStandalone) {
      return
    }
    if (installPrompt) {
      try {
        e?.preventDefault && e.preventDefault()
      } catch {}
      try {
        await installPrompt.prompt()
        const choice = await installPrompt.userChoice
        setInstallPrompt(null)
        if (choice && choice.outcome === 'accepted') {
          try { navigate('/app') } catch {}
          return
        }
      } catch {}
    }
    try { navigate('/app') } catch {}
  }

  // Keep browser tab title in sync with public school
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = school?.name ? school.name : 'EDU-TRACK'
    }
  }, [school?.name])

  // Show a sticky CTA on small screens after a short scroll
  useEffect(() => {
    const onScroll = () => {
      try { setShowStickyCta(window.scrollY > 240) } catch {}
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const heroImages = (() => {
    const imgs = school?.homepage?.hero?.images || []
    const fallbacks = [
      new URL('../../images/pexels-kwakugriffn-14554003.jpg', import.meta.url).href,
      new URL('../../images/pexels-gabby-k-6289065.jpg', import.meta.url).href,
      new URL('../../images/pexels-akelaphotography-448877.jpg', import.meta.url).href,
    ]
    return (imgs.length ? imgs.map(toAbsoluteUrl) : fallbacks).slice(0, 5)
  })()

  const animationVariant = 'fade'
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroColor, setHeroColor] = useState('rgba(79,70,229,0.12)')
  const [galleryCat, setGalleryCat] = useState('All')

  // Typewriter animation for school name
  const typingText = school?.name || 'Our School'
  const [typed, setTyped] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [typeIdx, setTypeIdx] = useState(0)
  useEffect(() => {
    const baseSpeed = 90
    const speed = isDeleting ? baseSpeed / 2 : baseSpeed
    const t = setTimeout(() => {
      const full = typingText
      if (!isDeleting) {
        const next = full.slice(0, typeIdx + 1)
        setTyped(next)
        setTypeIdx(typeIdx + 1)
        if (next === full) setIsDeleting(true)
      } else {
        const next = full.slice(0, Math.max(0, typeIdx - 1))
        setTyped(next)
        setTypeIdx(Math.max(0, typeIdx - 1))
        if (next.length === 0) setIsDeleting(false)
      }
    }, typeIdx === 0 && !isDeleting ? 500 : speed)
    return () => clearTimeout(t)
  }, [typeIdx, isDeleting, typingText])

  function extractDominantColor(src) {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          const w = (canvas.width = 32)
          const h = (canvas.height = 32)
          ctx.drawImage(img, 0, 0, w, h)
          const { data } = ctx.getImageData(0, 0, w, h)
          let r = 0, g = 0, b = 0, n = 0
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3]
            if (a < 128) continue
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            n++
          }
          if (!n) throw new Error('no-opaque-pixels')
          r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n)
          resolve(`rgba(${r},${g},${b},0.18)`) 
        } catch {
          resolve('rgba(79,70,229,0.12)')
        }
      }
      img.onerror = () => resolve('rgba(79,70,229,0.12)')
      img.src = src
    })
  }

  useEffect(() => {
    let t
    // Disable hero image index autoplay; background now scrolls continuously instead
    const autoplay = false
    if (!autoplay) return
    const intervalMs = Math.max(3500, Number(school?.homepage?.hero?.interval) || 5500)
    function tick(){ setHeroIndex((i) => (i + 1) % heroImages.length) }
    t = setInterval(tick, intervalMs)
    return () => clearInterval(t)
  }, [school?.homepage?.hero?.interval, school?.homepage?.hero?.autoplay, heroImages.length])

  useEffect(() => {
    let mounted = true
    const src = heroImages[heroIndex]
    if (!src) return
    ;(async () => {
      const col = await extractDominantColor(src)
      if (mounted) setHeroColor(col)
    })()
    return () => { mounted = false }
  }, [heroIndex, heroImages])

  // Testimonials data and component
  const testimonialsList = (school.homepage?.testimonials && school.homepage.testimonials.length ? school.homepage.testimonials : [
    { name: 'Parent of Form 2', quote: 'Teachers here truly care. My child has grown in confidence and academics.', avatar: '' },
    { name: 'Alumnus 2024', quote: 'Great balance of academics and co‑curriculars. I felt prepared for KCSE.', avatar: '' },
    { name: 'Parent', quote: 'Safe, welcoming environment with excellent communication from staff.', avatar: '' },
  ])
  const testimonialsInterval = Math.max(4000, Number(school?.homepage?.testimonialsInterval) || 6000)

  function TestimonialsCarousel({ items, interval }){
    const [ti, setTi] = useState(0)
    useEffect(() => {
      if (!items.length) return
      const id = setInterval(() => setTi(i => (i + 1) % items.length), interval)
      return () => clearInterval(id)
    }, [items.length, interval])
    return (
      <div className="mt-8 relative">
        <div className="relative overflow-hidden">
          {items.map((t, idx) => (
            <figure key={`t-${idx}`} className={`absolute inset-0 transition-all duration-500 ${idx===ti? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6 pointer-events-none'}`}>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
                <div className="flex items-center gap-3">
                  {t.avatar ? (
                    <img src={/^https?:/.test(t.avatar)? t.avatar : toAbsoluteUrl(t.avatar)} alt={t.name || 'Avatar'} className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-sm">★</div>
                  )}
                  <div className="font-medium text-gray-900">{t.name}</div>
                </div>
                <blockquote className="mt-3 text-base leading-relaxed text-gray-700">“{t.quote}”</blockquote>
              </div>
            </figure>
          ))}
          {/* spacer to lock height */}
          <div className="opacity-0"> 
            <div className="rounded-2xl border p-6"><div className="h-16" /></div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button type="button" aria-label="Prev" className="px-3 py-2 rounded-lg border text-gray-700 hover:bg-gray-50" onClick={() => setTi(i => (i - 1 + items.length) % items.length)}>Prev</button>
          <div className="flex items-center gap-2">
            {items.map((_, d) => (
              <span key={`dot-${d}`} className={`h-2 w-2 rounded-full ${d===ti? 'bg-indigo-600' : 'bg-gray-300'}`} />
            ))}
          </div>
          <button type="button" aria-label="Next" className="px-3 py-2 rounded-lg border text-gray-700 hover:bg-gray-50" onClick={() => setTi(i => (i + 1) % items.length)}>Next</button>
        </div>
      </div>
    )
  }

  // Show a loading screen while fetching school data
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-white text-gray-600">
        <div className="flex flex-col items-center gap-3">
          {!slowLoading ? (
            <div className="text-center">
              <div className="text-xl font-semibold text-gray-900">Welcome</div>
              <p className="mt-1 text-sm text-gray-600">Website powered by EduTrack</p>
            </div>
          ) : (
            <div className="text-center max-w-sm">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-amber-100 text-amber-700 grid place-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M12 2a10 10 0 1 0 9.39 6.59 1 1 0 1 0-1.88.68A8 8 0 1 1 12 4a1 1 0 0 0 0-2Zm-.75 6.5a.75.75 0 0 1 1.5 0v5a.75.75 0 0 1-1.5 0v-5ZM12 17a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="font-semibold text-gray-900">This is taking longer than usual</div>
              <p className="mt-1 text-sm text-gray-600">Please check your connection and try refreshing the page.</p>
              <button type="button" onClick={() => { try { window.location.reload() } catch {} }} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                Refresh Page
              </button>
            </div>
          )}
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
        @keyframes heroScroll {
          0% { background-position: center 100%; }
          100% { background-position: center 0%; }
        }
        .hero-bg-scroll {
          animation: heroScroll 120s linear infinite;
          background-repeat: repeat-y;
        }
        /* Hero fly-in animations */
        @keyframes heroFlyDown {
          0% { opacity: 0; transform: translateY(-30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroFlyUp {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroFlyLeft {
          0% { opacity: 0; transform: translateX(40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes heroFlyRight {
          0% { opacity: 0; transform: translateX(-40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .hero-fly-down   { animation: heroFlyDown 700ms ease-out forwards; }
        .hero-fly-up     { animation: heroFlyUp 800ms ease-out forwards; animation-delay: 80ms; }
        .hero-fly-left   { animation: heroFlyLeft 850ms ease-out forwards; animation-delay: 140ms; }
        .hero-fly-right  { animation: heroFlyRight 900ms ease-out forwards; animation-delay: 200ms; }
        .hero-fly-badges { animation: heroFlyUp 950ms ease-out forwards; animation-delay: 260ms; }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-transparent shadow-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <ProgressiveImage
                src={toAbsoluteUrl(school.logo_url)}
                candidates={imageCandidates(school.logo_url)}
                alt="School logo"
                className="h-9 w-9 rounded-xl border border-gray-200 overflow-hidden"
                style={{ width: 36, height: 36 }}
              />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white grid place-items-center font-bold shadow-sm">S</div>
            )}
            <span className="text-xl font-semibold tracking-tight text-gray-900">{school.name}</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#about" className="hover:text-gray-900">About</a>
            <a href="#headteacher" className="hover:text-gray-900">Headteacher</a>
            <a href="#academics" className="hover:text-gray-900">Academics</a>
            <Link to="/teachers" className="hover:text-gray-900">Teachers</Link>
            <a href="#admissions" className="hover:text-gray-900">Admissions</a>
            <a href="#news" className="hover:text-gray-900">News</a>
            <a href="#contact" className="hover:text-gray-900">Contact</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-md hover:bg-gray-50">Portal Login</Link>
            <Link to="/app" onClick={onOpenApp} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow hover:opacity-95">Open App</Link>
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
              <a href="#headteacher" onClick={() => setMobileOpen(false)} className="py-2">Headteacher</a>
              <a href="#academics" onClick={() => setMobileOpen(false)} className="py-2">Academics</a>
              <Link to="/teachers" onClick={() => setMobileOpen(false)} className="py-2">Teachers</Link>
              <a href="#admissions" onClick={() => setMobileOpen(false)} className="py-2">Admissions</a>
              <a href="#news" onClick={() => setMobileOpen(false)} className="py-2">News</a>
              <a href="#contact" onClick={() => setMobileOpen(false)} className="py-2">Contact</a>
              <div className="flex gap-3 pt-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg text-center">Portal Login</Link>
                <Link to="/app" onClick={(e) => { setMobileOpen(false); onOpenApp(e) }} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg text-center">Open App</Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center hero-bg-scroll"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(249,250,251,0.65), rgba(255,255,255,0.82)), radial-gradient(1100px 520px at -10% -20%, ${heroColor}, transparent 65%), radial-gradient(900px 520px at 110% 10%, rgba(129,140,248,0.18), transparent 65%), url(${heroImages[heroIndex] || ''})`
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 pt-10 md:pt-14 pb-12 md:pb-20">
          <div className="grid lg:grid-cols-1 gap-12 items-center justify-items-center text-center">
            <div className="max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100 hero-fly-down">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">★</span>
                <span>{school.homepage?.hero?.badge || school.motto}</span>
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-slate-900 hero-fly-up">
                {school.homepage?.hero?.title ? (
                  school.homepage?.hero?.title
                ) : (
                  <>
                    <span className="block text-slate-800">Welcome to</span>
                    <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-sky-500 bg-clip-text text-transparent">
                      {typed || school.name}
                    </span>
                  </>
                )}
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl mx-auto hero-fly-left">
                {school.homepage?.hero?.subtitle || 'A nurturing, diverse and high-achieving community empowering students to thrive in academics, character, and service.'}
              </p>
              <div className="mt-7 flex flex-wrap gap-3 justify-center hero-fly-right">
                <a
                  href={school.homepage?.hero?.ctaPrimaryLink || '#admissions'}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 hover:shadow-md transition"
                >
                  {school.homepage?.hero?.ctaPrimaryText || 'Start Your Application'}
                </a>
                <a
                  href={school.homepage?.hero?.ctaSecondaryLink || '#about'}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  {school.homepage?.hero?.ctaSecondaryText || 'Learn More'}
                </a>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/90 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Login
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 justify-center text-[11px] text-slate-600 hero-fly-badges">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Safe environment
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Dedicated staff
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  Holistic learning
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2 bottom-6 text-gray-500/80">
          <span className="text-xs tracking-wider uppercase">Scroll</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12 16.5a1 1 0 0 1-.7-.29l-5-5a1 1 0 1 1 1.4-1.42l4.3 4.3 4.3-4.3a1 1 0 0 1 1.4 1.42l-5 5a1 1 0 0 1-.7.29Z" />
          </svg>
        </div>
        
      </section>

      {/* About */}
      <section id="about" className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-indigo-50/25 to-white">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(99,102,241,0.14)_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-indigo-500/80">
                Our community
              </p>
              <h2 className="mt-2 text-3xl md:text-4xl font-semibold md:font-bold tracking-tight text-slate-900">
                {school.homepage?.about?.title || `About ${school.name}`}
              </h2>
              <p className="mt-4 text-base md:text-lg leading-relaxed text-slate-600 max-w-xl">
                {school.homepage?.about?.text || `Founded on excellence and integrity, ${school.name} offers a rich curriculum, vibrant co-curricular life and a caring environment that inspires students to reach their full potential.`}
              </p>
              <ul className="mt-6 space-y-3 text-sm md:text-base text-slate-700">
                {(school.homepage?.about?.bullets && school.homepage.about.bullets.length
                  ? school.homepage.about.bullets
                  : [
                      'Experienced and caring teachers',
                      'Strong STEM and Humanities programs',
                      'Sports, arts, clubs and community service',
                      'Safe, inclusive and diverse community',
                    ]
                ).map((b, idx) => (
                  <li
                    key={`${idx}-${b}`}
                    className="flex items-start gap-3 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                  >
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 -z-10 bg-gradient-to-tr from-indigo-500/10 via-fuchsia-500/5 to-sky-500/10 blur-2xl" />
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-sm p-6 sm:p-7 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold tracking-wide text-slate-900">At a Glance</h3>
                    <p className="mt-1 text-xs text-slate-500">Key highlights of our school community</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-medium text-indigo-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Growing every term
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-slate-700">
                  <div className="group rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Students</div>
                    <CountUp
                      value={school.homepage?.stats?.students ?? '—'}
                      className="mt-1 text-2xl font-semibold text-slate-900 group-hover:text-indigo-700"
                    />
                    <p className="mt-1 text-xs text-slate-500">Active learners</p>
                  </div>
                  <div className="group rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-purple-50/40 p-4 shadow-sm hover:shadow-md hover:border-purple-100 transition-all">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Teachers</div>
                    <CountUp
                      value={school.homepage?.stats?.teachers ?? '—'}
                      className="mt-1 text-2xl font-semibold text-slate-900 group-hover:text-indigo-700"
                    />
                    <p className="mt-1 text-xs text-slate-500">Dedicated educators</p>
                  </div>
                  <div className="group rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-emerald-50/60 p-4 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Parent satisfaction</div>
                    <CountUp
                      value={school.homepage?.stats?.satisfaction || '98%'}
                      className="mt-1 text-2xl font-semibold text-slate-900 group-hover:text-emerald-700"
                    />
                    <p className="mt-1 text-xs text-slate-500">Based on feedback</p>
                  </div>
                  <div className="group rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-sky-50/60 p-4 shadow-sm hover:shadow-md hover:border-sky-100 transition-all">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Student–teacher ratio</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900 group-hover:text-indigo-700">
                      {school.homepage?.stats?.ratio || '15:1'}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Personalized attention</p>
                  </div>
                  {school.homepage?.stats?.completion ? (
                    <div className="group rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-amber-50/60 p-4 shadow-sm hover:shadow-md hover:border-amber-100 transition-all">
                      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">KCSE completion</div>
                      <CountUp
                        value={school.homepage.stats.completion}
                        className="mt-1 text-2xl font-semibold text-slate-900 group-hover:text-amber-700"
                      />
                      <p className="mt-1 text-xs text-slate-500">Graduation success</p>
                    </div>
                  ) : null}
                  <div className="group rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-pink-50/60 p-4 shadow-sm hover:shadow-md hover:border-pink-100 transition-all">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Clubs & activities</div>
                    <CountUp
                      value={school.homepage?.stats?.clubs || '40+'}
                      className="mt-1 text-2xl font-semibold text-slate-900 group-hover:text-pink-700"
                    />
                    <p className="mt-1 text-xs text-slate-500">Co-curricular options</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      <section id="headteacher" className="relative overflow-hidden bg-gradient-to-b from-white via-amber-50/20 to-white">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(245,158,11,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
          {(() => {
            const ht = school?.homepage?.headteacher || {}
            const name = ht.name || 'Headteacher'
            const title = ht.title || 'Headteacher'
            const photo = ht.photo ? toAbsoluteUrl(ht.photo) : ''
            const message = ht.message || 'Welcome to our school. We are committed to academic excellence, character formation, and holistic growth of every learner entrusted to us.'
            return (
              <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg text-center">
                    {photo ? (
                      <ProgressiveImage src={photo} candidates={imageCandidates(photo)} alt={name} className="mx-auto h-36 w-36 rounded-2xl border border-gray-200 overflow-hidden" />
                    ) : (
                      <div className="mx-auto h-36 w-36 rounded-2xl bg-gray-100 grid place-items-center text-3xl text-gray-400">👩‍🏫</div>
                    )}
                    <div className="mt-4 font-semibold text-gray-900">{name}</div>
                    <div className="text-sm text-gray-600">{title}</div>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
                    <h2 className="text-3xl font-bold text-gray-900">Message from the Headteacher</h2>
                    <p className="mt-4 text-lg leading-relaxed text-gray-700 whitespace-pre-line">{message}</p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* Academics */}
      <section id="academics" className="relative overflow-hidden bg-gradient-to-b from-white via-sky-50 to-indigo-50/20">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(16,185,129,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
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
              <Reveal key={`${idx}-${f.title || 'program'}`} className={`rounded-xl border border-gray-200 p-6 hover:shadow-lg transition bg-gradient-to-br ${['from-indigo-50 to-indigo-100','from-emerald-50 to-emerald-100','from-violet-50 to-violet-100','from-rose-50 to-rose-100','from-amber-50 to-amber-100','from-sky-50 to-sky-100'][idx % 6]}`}>
                <div className="h-10 w-10 rounded-lg grid place-items-center mb-4 bg-indigo-600/10 text-indigo-700">★</div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
        
      </section>

      {/* Admissions CTA */}
      <section id="admissions" className="relative overflow-hidden bg-gradient-to-b from-white via-rose-50/20 to-white">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(244,114,182,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-16 md:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <h2 className="text-3xl font-bold text-gray-900">Admissions</h2>
            <p className="mt-3 text-gray-600">{school.homepage?.admissions?.text || 'Applications are open for the upcoming term. We welcome prospective families to visit our campus and meet our community.'}</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {(school.homepage?.admissions?.bullets || [
                'Day and Boarding options',
                'Scholarships and financial aid available',
                'Rolling admissions (space permitting)'
              ]).map((b, idx) => (
                <li key={`${idx}-${b}`} className="flex gap-2"><span className="text-green-600">✓</span> {b}</li>
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
        
      </section>

      {/* News / Highlights */}
      <section id="news" className="relative overflow-hidden bg-gradient-to-b from-white via-violet-50/20 to-white">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(147,51,234,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
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
              <Reveal key={`${idx}-${n.title || 'news'}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg">
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section id="featured" className="relative overflow-hidden bg-gradient-to-b from-white via-indigo-50/20 to-white">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(99,102,241,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900">Featured</h2>
            <p className="mt-3 text-lg text-gray-600">Highlights, programs and achievements.</p>
          </div>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(school.homepage?.featured && school.homepage.featured.length ? school.homepage.featured : [
              { title: 'Modern Science Labs', desc: 'Hands-on experiments in fully equipped labs.', images: [new URL('../../images/pexels-akelaphotography-448877.jpg', import.meta.url).href] },
              { title: 'Championship Team', desc: 'Regional football champions for two consecutive years.', images: [new URL('../../images/pexels-gabby-k-6289065.jpg', import.meta.url).href] },
              { title: 'Arts & Culture', desc: 'Vibrant music and drama productions.', images: [new URL('../../images/pexels-kwakugriffn-14554003.jpg', import.meta.url).href] },
            ]).map((f, idx) => (
              <FeaturedCard key={`${idx}-${f.title || 'featured'}`} item={f} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(99,102,241,0.12)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900">What Parents Say</h2>
            <p className="mt-2 text-gray-600">Real stories from our community.</p>
          </div>
          <TestimonialsCarousel items={testimonialsList} interval={testimonialsInterval} />
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="relative overflow-hidden bg-gradient-to-b from-white via-amber-50/20 to-white">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(251,191,36,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
          {(() => {
            const items = (school.homepage?.gallery?.items && school.homepage.gallery.items.length ? school.homepage.gallery.items : [
              { url: new URL('../../images/pexels-kwakugriffn-14554003.jpg', import.meta.url).href, title: 'Campus Life', category: 'Campus' },
              { url: new URL('../../images/pexels-gabby-k-6289065.jpg', import.meta.url).href, title: 'Sports', category: 'Sports' },
              { url: new URL('../../images/pexels-akelaphotography-448877.jpg', import.meta.url).href, title: 'Science', category: 'Academics' },
              { url: new URL('../../images/pexels-gabby-k-6289065.jpg', import.meta.url).href, title: 'Arts', category: 'Arts' },
            ])
            const cats = ['All', ...Array.from(new Set(items.map(i => (i.category || 'Other'))))]
            const filtered = galleryCat === 'All' ? items : items.filter(i => (i.category || 'Other') === galleryCat)
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Gallery</h2>
                    <p className="mt-1 text-gray-600">Explore moments from around the school.</p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 p-1 bg-white">
                    {cats.map(c => (
                      <button key={`cat-${c}`} type="button" onClick={() => setGalleryCat(c)} className={`px-3 py-1.5 rounded-md text-sm ${galleryCat===c ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filtered.map((g, idx) => (
                    <Reveal key={`${idx}-${g.url}`} className="group rounded-xl overflow-hidden border border-gray-200 bg-white">
                      <div className="relative">
                        <img src={/^https?:/.test(g.url)? g.url : toAbsoluteUrl(g.url)} alt={g.title || 'Gallery'} className="w-full aspect-square object-cover" loading="lazy"/>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
                        {g.title ? <div className="absolute bottom-2 left-2 text-white text-sm font-medium drop-shadow">{g.title}</div> : null}
                      </div>
                    </Reveal>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
        
      </section>

      {/* Partners */}
      {Array.isArray(school.homepage?.partners) && school.homepage.partners.length ? (
        <section id="partners" className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/20 to-white">
          <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(99,102,241,0.12)_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900">Our Partners</h2>
              <p className="mt-2 text-gray-600">Organizations we collaborate with.</p>
            </div>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 items-center">
              {school.homepage.partners.map((p, idx) => {
                const href = (p?.url || '').trim()
                const logo = p?.logo ? (/^https?:\/\//i.test(p.logo) ? p.logo : toAbsoluteUrl(p.logo)) : ''
                const content = logo ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow transition">
                    <div className="grid place-items-center">
                      <img src={logo} alt={p?.name || 'Partner'} className="h-12 w-full object-contain" loading="lazy" />
                    </div>
                    {p?.name ? <div className="mt-2 text-sm font-medium text-gray-700 text-center truncate">{p.name}</div> : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-700 grid place-items-center font-medium">{p?.name || 'Partner'}</div>
                )
                return href && /^https?:\/\//i.test(href) ? (
                  <a key={idx} href={href} target="_blank" rel="noreferrer">{content}</a>
                ) : (
                  <div key={idx}>{content}</div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* Sponsors */}
      {Array.isArray(school.homepage?.sponsors) && school.homepage.sponsors.length ? (
        <section id="sponsors" className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/20 to-white">
          <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(99,102,241,0.12)_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900">Our Sponsors</h2>
              <p className="mt-2 text-gray-600">We are grateful for the support of these sponsors.</p>
            </div>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 items-center">
              {school.homepage.sponsors.map((p, idx) => {
                const href = (p?.url || '').trim()
                const logo = p?.logo ? (/^https?:\/\//i.test(p.logo) ? p.logo : toAbsoluteUrl(p.logo)) : ''
                const content = logo ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-3 hover:shadow transition">
                    <div className="grid place-items-center">
                      <img src={logo} alt={p?.name || 'Sponsor'} className="h-10 w-full object-contain" loading="lazy" />
                    </div>
                    {p?.name ? <div className="mt-2 text-sm font-medium text-gray-700 text-center truncate">{p.name}</div> : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700 grid place-items-center font-medium">{p?.name || 'Sponsor'}</div>
                )
                return href && /^https?:\/\//i.test(href) ? (
                  <a key={idx} href={href} target="_blank" rel="noreferrer">{content}</a>
                ) : (
                  <div key={idx}>{content}</div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* Contact */}
      <section id="contact" className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/20 to-white">
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-10 [background:radial-gradient(rgba(59,130,246,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-14 md:py-16">
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

      {/* Sticky mobile CTA */}
      <div className={`md:hidden fixed inset-x-3 bottom-4 z-40 transition-all duration-300 ${showStickyCta ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-2 shadow-elevated flex items-center gap-2">
          <a href={school.homepage?.hero?.ctaPrimaryLink || '#admissions'} className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold text-center">Apply</a>
          <a href={`tel:${(school.phone||'').replace(/\s/g,'')}`} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium bg-white">Call</a>
        </div>
      </div>

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
