import React, { useEffect, useMemo, useState } from 'react'
import AppLogo from '../components/AppLogo'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { 
  Check, 
  ChevronDown,
  Menu, 
  X, 
  Smartphone, 
  ShieldCheck, 
  Zap, 
  Users, 
  BookOpen, 
  GraduationCap, 
  MessageSquare, 
  Wallet, 
  BarChart3, 
  Database,
  ArrowRight,
  Mail,
  Phone,
  LayoutDashboard
} from 'lucide-react'

// Animation variants
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
}

const heroFlyInUp = {
  initial: { opacity: 0, y: 22 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }
  }
}

const heroFlyInRight = {
  initial: { opacity: 0, x: -18 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }
  }
}

const staggerContainer = {
  animate: {
    transition: {
      delayChildren: 0.06,
      staggerChildren: 0.16
    }
  }
}

// Lazy load wrapper using IntersectionObserver with Framer Motion
function LazySection({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}

function StarryBackground({ enabled }) {
  const STAR_TILE_1 = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="transparent"/>
      <circle cx="14" cy="28" r="1" fill="rgba(255,255,255,0.55)"/>
      <circle cx="54" cy="76" r="0.9" fill="rgba(255,255,255,0.35)"/>
      <circle cx="92" cy="44" r="1.1" fill="rgba(255,255,255,0.45)"/>
      <circle cx="128" cy="112" r="0.8" fill="rgba(255,255,255,0.28)"/>
      <circle cx="166" cy="60" r="1" fill="rgba(255,255,255,0.42)"/>
      <circle cx="204" cy="38" r="0.9" fill="rgba(255,255,255,0.25)"/>
      <circle cx="218" cy="144" r="1.1" fill="rgba(255,255,255,0.35)"/>
      <circle cx="72" cy="170" r="1" fill="rgba(255,255,255,0.30)"/>
      <circle cx="34" cy="212" r="1.1" fill="rgba(255,255,255,0.38)"/>
      <circle cx="146" cy="196" r="0.9" fill="rgba(255,255,255,0.25)"/>
      <circle cx="196" cy="206" r="1" fill="rgba(255,255,255,0.32)"/>
    </svg>`
  )}`

  const STAR_TILE_2 = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect width="320" height="320" fill="transparent"/>
      <circle cx="38" cy="58" r="1.2" fill="rgba(255,255,255,0.22)"/>
      <circle cx="112" cy="92" r="1.5" fill="rgba(255,255,255,0.18)"/>
      <circle cx="186" cy="64" r="1.1" fill="rgba(255,255,255,0.14)"/>
      <circle cx="264" cy="118" r="1.6" fill="rgba(255,255,255,0.16)"/>
      <circle cx="78" cy="202" r="1.4" fill="rgba(255,255,255,0.12)"/>
      <circle cx="210" cy="236" r="1.7" fill="rgba(255,255,255,0.14)"/>
      <circle cx="284" cy="270" r="1.2" fill="rgba(255,255,255,0.10)"/>
      <circle cx="30" cy="288" r="1.6" fill="rgba(255,255,255,0.12)"/>
    </svg>`
  )}`

  if (!enabled) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/[0.06] via-transparent to-slate-950/[0.08]" />
      <div className="star-layer star-layer-1" style={{ backgroundImage: `url('${STAR_TILE_1}')` }} />
      <div className="star-layer star-layer-2" style={{ backgroundImage: `url('${STAR_TILE_2}')` }} />
      <style>{`
        .star-layer{
          position:absolute;
          inset:-20%;
          background-repeat:repeat;
          opacity:0.55;
          transform:translateZ(0);
          will-change:transform,opacity;
          mix-blend-mode:screen;
        }
        .star-layer-1{
          background-size:240px 240px;
          animation:star-drift-1 42s linear infinite, star-twinkle 6s ease-in-out infinite;
        }
        .star-layer-2{
          background-size:320px 320px;
          opacity:0.35;
          filter:blur(0.1px);
          animation:star-drift-2 70s linear infinite, star-twinkle 8s ease-in-out infinite;
        }
        @keyframes star-drift-1{
          0%{transform:translate3d(0,0,0);}
          100%{transform:translate3d(-120px,80px,0);}
        }
        @keyframes star-drift-2{
          0%{transform:translate3d(0,0,0);}
          100%{transform:translate3d(90px,-110px,0);}
        }
        @keyframes star-twinkle{
          0%,100%{opacity:0.30;}
          50%{opacity:0.60;}
        }
        @media (prefers-reduced-motion: reduce){
          .star-layer-1,.star-layer-2{animation:none !important;}
        }
      `}</style>
    </div>
  )
}

function BackgroundVideo({ enabled }) {
  if (!enabled) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-25"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
    </div>
  )
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedFeature, setExpandedFeature] = useState(null)
  const prefersReducedMotion = useReducedMotion()
  const { scrollY } = useScroll()
  const heroParallaxY = useTransform(scrollY, [0, 700], [0, 18])
  const [heroSlide, setHeroSlide] = useState(0)
  const whatsappNumber = '+254796031071'
  const whatsappLink = `https://wa.me/${whatsappNumber.replace('+', '')}`

  const btnBase =
    'relative inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98]'

  const btnPrimary =
    `${btnBase} overflow-hidden text-white shadow-xl shadow-indigo-500/20 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-fuchsia-600 hover:shadow-2xl hover:shadow-indigo-500/25 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full`

  const btnSecondary =
    `${btnBase} bg-white/85 backdrop-blur-sm text-slate-800 ring-1 ring-slate-200/80 shadow-sm hover:bg-white hover:ring-slate-300 hover:-translate-y-0.5`

  const btnInverse =
    `${btnBase} bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-white/15 hover:-translate-y-0.5`

  const MotionLink = useMemo(() => motion.create(Link), [])

  const tokenVariant = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 }
  }

  const descriptorVariant = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 }
  }

  const features = [
    { 
      title: 'Role-based Dashboards', 
      desc: 'Tailored experiences for Admin, Teacher, Student, and Finance roles.', 
      details: 'Each user role gets a customized view. Admins manage the entire school, Teachers focus on class management and grading, Students track their progress and assignments, while Finance handles billing and fee collection with ease.',
      icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50' 
    },
    { 
      title: 'Academics & Timetable', 
      desc: 'Manage classes, subjects, calendars, and detailed time‑tables.', 
      details: 'Automate your school calendar. Manage subject allocation, teacher schedules, and student class assignments. Our intelligent timetable generator helps prevent scheduling conflicts and ensures optimal resource usage.',
      icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' 
    },
    { 
      title: 'Exams & Grading', 
      desc: 'Enter, analyze and share results with rich automated analytics.', 
      details: 'Streamline the entire examination process. From exam scheduling and mark entry to automatic grade calculation and report card generation. Teachers can analyze student performance with built-in data visualization tools.',
      icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50' 
    },
    { 
      title: 'Messaging Suite', 
      desc: 'In‑app messages and real‑time notifications keep everyone aligned.', 
      details: 'Foster better communication between parents, teachers, and school administration. Send broadcast announcements, private messages, and real-time alerts for attendance, fee updates, and academic events.',
      icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50' 
    },
    { 
      title: 'Finance Management', 
      desc: 'Invoices, payments, fee categories, expenses, and automated reports.', 
      details: 'Full-featured accounting for schools. Track fee payments, manage expenditure, generate professional invoices, and view comprehensive financial reports. Integrated with M-Pesa and other payment gateways for convenience.',
      icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' 
    },
    { 
      title: 'Pocket Money Wallet', 
      desc: 'Track student deposits, spending and balances with full transparency.', 
      details: 'A secure digital wallet system for students. Parents can deposit pocket money, and students can spend at the school canteen or bookshop using their digital IDs, reducing the risk of lost cash and providing spending oversight.',
      icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50' 
    },
    { 
      title: 'Deep Analytics', 
      desc: 'Operational and academic insights for data‑driven decisions.', 
      details: 'Gain actionable insights into school performance. Monitor academic trends across classes, track financial health over time, and identify areas for improvement with our powerful reporting and analytics engine.',
      icon: BarChart3, color: 'text-cyan-600', bg: 'bg-cyan-50' 
    },
    { 
      title: 'Enterprise Security', 
      desc: 'Role‑based access, audit trails and modern security best practices.', 
      details: 'Your data is safe with us. We use bank-grade encryption, multi-factor authentication, and granular role-based permissions. Every action is logged in an audit trail to ensure accountability and data integrity.',
      icon: ShieldCheck, color: 'text-teal-600', bg: 'bg-teal-50' 
    },
    { 
      title: 'Cloud Infrastructure', 
      desc: 'Built with React and Django for enterprise-grade reliability.', 
      details: 'Experience zero downtime with our cloud-hosted solution. Built on modern, scalable technology, EduTrack is fast, reliable, and accessible from anywhere in the world on any device.',
      icon: Database, color: 'text-slate-600', bg: 'bg-slate-50' 
    }
  ]

  const heroImages = useMemo(() => ([
    new URL('../../images/pexels-akelaphotography-448877.jpg', import.meta.url).href,
    new URL('../../images/pexels-gabby-k-6289065.jpg', import.meta.url).href,
    new URL('../../images/pexels-kwakugriffn-14554003.jpg', import.meta.url).href
  ]), [])

  const borderPalettes = [
    'border-blue-200',
    'border-indigo-200',
    'border-emerald-200',
    'border-amber-200',
    'border-rose-200',
    'border-purple-200',
    'border-cyan-200',
    'border-teal-200',
    'border-slate-300'
  ]

  useEffect(() => {
    if (prefersReducedMotion) return
    const id = window.setInterval(() => {
      setHeroSlide((s) => (s + 1) % heroImages.length)
    }, 4500)
    return () => window.clearInterval(id)
  }, [prefersReducedMotion, heroImages.length])

  return (
    <div className="min-h-screen bg-slate-50/30 selection:bg-indigo-100 selection:text-indigo-900">
      <BackgroundVideo enabled={!prefersReducedMotion} />
      <StarryBackground enabled={!prefersReducedMotion} />
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-indigo-600/95 md:border-slate-200/60 md:bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="#hero" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
                <AppLogo size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white md:text-slate-900">EduTrack</span>
            </a>
            
            <div className="hidden md:block">
              <div className="flex items-center gap-8">
                {['Features', 'Advantages', 'Pricing', 'Contact'].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-600"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>

            <div className="hidden items-center gap-4 md:flex">
              <Link 
                to="/login" 
                className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/app"
                className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-95"
              >
                Open App
              </Link>
            </div>

            <button 
              className="rounded-lg p-2 text-white bg-white/10 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-white/10 bg-indigo-600/95 md:hidden overflow-hidden"
            >
              <div className="space-y-1 px-4 pb-6 pt-2">
                {['Features', 'Advantages', 'Pricing', 'Contact'].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-3 py-3 text-base font-medium text-white/90 hover:bg-white/10"
                  >
                    {item}
                  </a>
                ))}
                <div className="mt-4 grid grid-cols-2 gap-3 px-3">
                  <Link
                    to="/login"
                    className="flex items-center justify-center rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/15"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/app"
                    className="flex items-center justify-center rounded-xl bg-white py-2.5 text-sm font-bold text-indigo-700 shadow-sm shadow-indigo-900/20"
                  >
                    Open App
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Mobile background carousel */}
        <div className="absolute inset-0 lg:hidden">
          {prefersReducedMotion ? (
            <div
              className="absolute inset-0 bg-center bg-cover"
              style={{ backgroundImage: `url('${heroImages[0]}')` }}
            />
          ) : (
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={heroSlide}
                className="absolute inset-0 bg-center bg-cover will-change-transform"
                style={{ backgroundImage: `url('${heroImages[heroSlide]}')` }}
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1.0 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ opacity: { duration: 0.9, ease: 'easeInOut' }, scale: { duration: 4.6, ease: 'easeOut' } }}
              />
            </AnimatePresence>
          )}
          <div className="absolute inset-0 bg-slate-950/45" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/25 to-white/70" />
        </div>

        {/* Desktop background carousel */}
        <div className="absolute inset-0 hidden lg:block">
          {prefersReducedMotion ? (
            <div
              className="absolute inset-0 bg-right bg-cover"
              style={{ backgroundImage: `url('${heroImages[0]}')` }}
            />
          ) : (
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={heroSlide}
                className="absolute inset-0 bg-right bg-cover will-change-transform"
                style={{ backgroundImage: `url('${heroImages[heroSlide]}')` }}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1.0 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ opacity: { duration: 0.9, ease: 'easeInOut' }, scale: { duration: 5.2, ease: 'easeOut' } }}
              />
            </AnimatePresence>
          )}
          <div className="absolute inset-0 bg-slate-950/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 to-white/40" />
        </div>

        {/* Abstract background elements */}
        <div className="absolute top-0 left-1/2 -z-10 h-[1000px] w-[1000px] -translate-x-1/2 [mask-image:radial-gradient(closest-side,white,transparent)]">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-100/40 to-purple-100/40 opacity-40" />
        </div>
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div 
              initial={prefersReducedMotion ? false : 'initial'}
              animate="animate"
              variants={staggerContainer}
              className="max-w-2xl relative z-10"
            >
              <div className="lg:rounded-none lg:bg-transparent lg:backdrop-blur-0 lg:ring-0 lg:shadow-none lg:p-0">
              <motion.div variants={heroFlyInRight} className="inline-flex items-center gap-2 rounded-full bg-indigo-50/90 px-4 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 mb-6">
                <Zap size={14} className="fill-indigo-700" />
                <span>All-in-one School Management</span>
              </motion.div>
              
              <motion.h1 variants={heroFlyInUp} className="text-4xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                Run your school <br />
                <span className="text-indigo-600">smarter</span> with EduTrack
              </motion.h1>
              
              <div className="mt-6 w-full rounded-2xl bg-white/55 backdrop-blur-sm ring-1 ring-white/30 p-4 sm:p-0 sm:bg-transparent sm:backdrop-blur-0 sm:ring-0 lg:bg-transparent lg:p-0">
                <motion.p variants={heroFlyInUp} className="text-base lg:text-lg leading-relaxed text-slate-700 sm:text-slate-600">
                  A modern, end-to-end platform for schools to manage{' '}
                  <motion.span
                    className="font-semibold text-slate-900 sm:text-slate-800"
                    variants={tokenVariant}
                    transition={{ duration: 0.45, delay: 0.05 }}
                  >
                    academics
                  </motion.span>
                  ,{' '}
                  <motion.span
                    className="font-semibold text-slate-900 sm:text-slate-800"
                    variants={tokenVariant}
                    transition={{ duration: 0.45, delay: 0.1 }}
                  >
                    finance
                  </motion.span>
                  ,{' '}
                  <motion.span
                    className="font-semibold text-slate-900 sm:text-slate-800"
                    variants={tokenVariant}
                    transition={{ duration: 0.45, delay: 0.15 }}
                  >
                    communication
                  </motion.span>
                  ,{' '}
                  <motion.span
                    className="font-semibold text-slate-900 sm:text-slate-800"
                    variants={tokenVariant}
                    transition={{ duration: 0.45, delay: 0.2 }}
                  >
                    timetables
                  </motion.span>
                  , and{' '}
                  <motion.span
                    className="font-semibold text-slate-900 sm:text-slate-800"
                    variants={tokenVariant}
                    transition={{ duration: 0.45, delay: 0.25 }}
                  >
                    performance
                  </motion.span>
                  —from one secure, intuitive dashboard.
                </motion.p>
              </div>
              
              <motion.div variants={heroFlyInUp} className="mt-10 flex flex-wrap gap-4">
                <MotionLink
                  to="/app"
                  whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  transition={prefersReducedMotion ? undefined : { type: 'spring', stiffness: 420, damping: 25 }}
                  className={`group px-5 py-3 text-sm sm:px-8 sm:py-4 sm:text-lg ${btnPrimary}`}
                >
                  Get Started
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1 sm:hidden" />
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 hidden sm:block" />
                </MotionLink>
                <motion.a
                  href="#pricing"
                  whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                  transition={prefersReducedMotion ? undefined : { type: 'spring', stiffness: 420, damping: 25 }}
                  className={`px-5 py-3 text-sm sm:px-8 sm:py-4 sm:text-lg ${btnSecondary}`}
                >
                  View Pricing
                </motion.a>
              </motion.div>
              
              <motion.div variants={heroFlyInUp} className="mt-10 sm:mt-12 flex flex-wrap items-center gap-x-4 sm:gap-x-8 gap-y-2 sm:gap-y-3 border-t border-slate-200 pt-6 sm:pt-8">
                {[
                  { label: 'Secure', color: 'bg-emerald-500', Icon: ShieldCheck, delay: 0 },
                  { label: 'Reliable', color: 'bg-indigo-500', Icon: Users, delay: 0.1 },
                  { label: 'Fast', color: 'bg-purple-500', Icon: Zap, delay: 0.2 }
                ].map(({ label, color, Icon, delay }) => (
                  <motion.div
                    key={label}
                    variants={descriptorVariant}
                    transition={{ duration: 0.5, delay }}
                    className="flex items-center gap-1.5 sm:gap-2"
                  >
                    <motion.div
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${color}`}
                      animate={
                        prefersReducedMotion
                          ? undefined
                          : { scale: [1, 1.35, 1], opacity: [0.9, 1, 0.9] }
                      }
                      transition={
                        prefersReducedMotion
                          ? undefined
                          : { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay }
                      }
                    />
                    <motion.span
                      aria-hidden="true"
                      animate={prefersReducedMotion ? undefined : { y: [0, -1.5, 0] }}
                      transition={
                        prefersReducedMotion
                          ? undefined
                          : { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.2 }
                      }
                      className="text-slate-500"
                    >
                      <Icon size={12} className="sm:hidden" />
                      <Icon size={14} className="hidden sm:block" />
                    </motion.span>
                    <span className="text-[11px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                  </motion.div>
                ))}
              </motion.div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative lg:ml-auto w-full max-w-md lg:max-w-lg hidden lg:block"
            >
              <div className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-xl shadow-slate-900/10 ring-1 ring-inset ring-white/30 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Uptime</div>
                    <div className="mt-2 text-3xl font-extrabold tracking-tight text-indigo-600">99%</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">Service availability</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Security</div>
                    <div className="mt-2 flex items-center gap-2 text-slate-900">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <ShieldCheck size={18} />
                      </span>
                      <div className="leading-tight">
                        <div className="text-sm font-extrabold">Enterprise Secure</div>
                        <div className="text-xs font-semibold text-slate-500">Bank-grade encryption</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-[1px]">
                  <div className="rounded-2xl bg-white/85 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-slate-900">Built for modern schools</div>
                      <div className="text-xs font-bold text-indigo-600">All-in-one</div>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">Academics, finance, communication, exams and more.</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats/Compare Section */}
      <section className="bg-white py-12 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8 items-center justify-between">
            <div className="text-center lg:text-left max-w-xs">
              <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Trusted Plans</h3>
              <p className="text-slate-600 text-sm">Transparent pricing designed to scale with your institution.</p>
            </div>
            <div className="flex-1 w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full table-fixed text-left">
                <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm w-[38%] sm:w-auto">Comparison</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm w-[31%] sm:w-auto">
                      <span className="sm:hidden">Subscr.</span>
                      <span className="hidden sm:inline">Subscription</span>
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm text-indigo-600 w-[31%] sm:w-auto">
                      <span className="sm:hidden">License</span>
                      <span className="hidden sm:inline">Full License</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-900 font-semibold text-xs sm:text-sm whitespace-normal break-words">Pricing Model</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-600 text-xs sm:text-sm whitespace-normal break-words">KSh 30 / student</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-600 text-xs sm:text-sm whitespace-normal break-words">KSh 500,000 once</td>
                  </tr>
                  <tr>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-900 font-semibold text-xs sm:text-sm whitespace-normal break-words">Startup Cost</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-600 text-xs sm:text-sm whitespace-normal break-words">Pay as you grow</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-emerald-600 font-semibold text-xs sm:text-sm whitespace-normal break-words">Free Training</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 lg:py-32 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] mb-4">Core Modules</h2>
            <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
              Everything you need to manage a modern school
            </h3>
            <p className="mt-6 text-lg text-slate-600">
              Powerful modules designed for Administrators, Teachers, Finance teams, Students, and Parents.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, idx) => {
              const isExpanded = expandedFeature === idx
              return (
                <LazySection key={f.title}>
                  <div className={`group relative h-full rounded-3xl border ${borderPalettes[idx % borderPalettes.length]} bg-white p-6 sm:p-8 shadow-lg shadow-slate-900/10 transition-all hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/20 flex flex-col`}>
                    <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${f.bg} ${f.color} transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                      <f.icon size={28} />
                    </div>
                    <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2.5 sm:mb-3">{f.title}</h4>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-4">{f.desc}</p>
                    
                    <div className="mt-auto">
                      <button 
                        onClick={() => setExpandedFeature(isExpanded ? null : idx)}
                        className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? 'Read Less' : 'Read More'}
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ChevronDown size={16} />
                        </motion.span>
                      </button>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <p className="pt-4 text-sm text-slate-500 leading-relaxed border-t border-slate-100 mt-4">
                              {f.details}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </LazySection>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section id="advantages" className="relative py-16 sm:py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-slate-900" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <LazySection>
              <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4">Why Us</h2>
              <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight lg:text-5xl mb-5 sm:mb-8">
                The EduTrack Advantage
              </h3>
              <div className="space-y-3 sm:space-y-6">
                {[
                  'Single source of truth for all student & academic data.',
                  'Automated billing and receipts reduce manual overhead.',
                  'Streamlined parent communication via digital statements.',
                  'Dynamic lesson planning and automated scheduling.',
                  'Real-time academic performance tracking with analytics.',
                  'Integrated school wallet for secure cashless transactions.'
                ].map((text, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="mt-1 flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <p className="text-sm sm:text-lg text-slate-300 font-medium leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
              
              <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:gap-4">
                <a href="#pricing" className={`px-6 py-3.5 text-base sm:px-8 sm:py-4 sm:text-lg ${btnSecondary} text-center`}>
                  View Plans
                </a>
                <a href={whatsappLink} target="_blank" rel="noreferrer" className={`px-6 py-3.5 text-base sm:px-8 sm:py-4 sm:text-lg ${btnInverse}`}>
                  <MessageSquare size={20} />
                  WhatsApp Us
                </a>
              </div>
            </LazySection>

            <LazySection>
              <div className="relative">
                <div className="aspect-[4/3] sm:aspect-square w-full max-w-sm sm:max-w-lg mx-auto rounded-[2.25rem] sm:rounded-[3rem] bg-indigo-500/10 border border-white/10 backdrop-blur-sm p-8 sm:p-12 flex flex-col items-center justify-center text-center">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-6xl sm:text-8xl font-black text-white mb-3 sm:mb-4"
                  >
                    99.9%
                  </motion.div>
                  <div className="text-xl sm:text-2xl font-bold text-indigo-300 mb-2 uppercase tracking-widest">Uptime</div>
                  <div className="text-sm sm:text-base text-slate-400 max-w-xs">Built on reliable cloud infrastructure for zero interruptions.</div>
                </div>
                {/* Decorative particles */}
                <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/20 blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-0 h-32 w-32 bg-purple-500/20 blur-3xl rounded-full" />
              </div>
            </LazySection>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 lg:py-32 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] mb-4">Pricing</h2>
            <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
              Simple, scalable billing
            </h3>
            <p className="mt-6 text-lg text-slate-600">
              Choose the plan that fits your school's current size and future goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Plan 1 */}
            <LazySection>
              <div className="relative flex flex-col h-full rounded-[2.25rem] sm:rounded-[2.5rem] bg-white p-6 sm:p-10 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/20">
                <div className="mb-5 sm:mb-8">
                  <h4 className="text-sm sm:text-lg font-bold text-slate-900">Per Student Monthly</h4>
                  <div className="mt-2.5 sm:mt-4 flex items-baseline gap-1">
                    <span className="text-2xl sm:text-4xl font-black text-slate-900">KSh 30</span>
                    <span className="text-[11px] sm:text-sm text-slate-500 font-medium">/ student / month</span>
                  </div>
                  <p className="mt-2.5 sm:mt-4 text-xs sm:text-base text-slate-600">Perfect for growing schools wanting minimal upfront cost.</p>
                </div>
                
                <ul className="space-y-2.5 sm:space-y-4 mb-7 sm:mb-10 flex-1">
                  {['Billed monthly by student count', 'Full platform access', 'Cloud hosting included', 'Standard Support', 'No long-term commitment'].map((f) => (
                    <li key={f} className="flex gap-3 text-slate-600">
                      <Check size={16} className="text-indigo-600 flex-shrink-0 mt-0.5 sm:hidden" />
                      <Check size={18} className="text-indigo-600 flex-shrink-0 mt-0.5 hidden sm:block" />
                      <span className="text-[11px] sm:text-sm font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/pricing/per-student-monthly" className={`w-full py-3 sm:py-4 text-sm sm:text-lg text-center ${btnSecondary}`}>
                  Learn More
                </Link>
              </div>
            </LazySection>

            {/* Plan 2 */}
            <LazySection>
              <div className="relative flex flex-col h-full rounded-[2.25rem] sm:rounded-[2.5rem] bg-indigo-600 p-6 sm:p-10 shadow-2xl shadow-indigo-900/40 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-900/50">
                <div className="absolute top-0 right-10 -translate-y-1/2 rounded-full bg-amber-400 px-4 py-1 text-xs font-black uppercase tracking-widest text-slate-900">
                  Best Value
                </div>
                
                <div className="mb-5 sm:mb-8 text-white">
                  <h4 className="text-sm sm:text-lg font-bold">Full License</h4>
                  <div className="mt-2.5 sm:mt-4 flex items-baseline gap-1">
                    <span className="text-2xl sm:text-4xl font-black">KSh 500,000</span>
                    <span className="text-[11px] sm:text-sm text-white/80 font-medium">one-time</span>
                  </div>
                  <p className="mt-2.5 sm:mt-4 text-xs sm:text-base text-white/80">Ideal for institutions that prefer a one-time investment.</p>
                </div>
                
                <ul className="space-y-2.5 sm:space-y-4 mb-7 sm:mb-10 flex-1">
                  {['Lifetime license usage', '1 year priority support', 'Free training & setup', 'Unlimited students', 'Local or cloud deployment'].map((f) => (
                    <li key={f} className="flex gap-3 text-white/90">
                      <Check size={16} className="text-indigo-200 flex-shrink-0 mt-0.5 sm:hidden" />
                      <Check size={18} className="text-indigo-200 flex-shrink-0 mt-0.5 hidden sm:block" />
                      <span className="text-[11px] sm:text-sm font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
                
                <a href="mailto:EduTrack46@gmail.com" className={`w-full py-3 sm:py-4 text-sm sm:text-lg text-center text-indigo-700 ${btnSecondary}`}>
                  Contact Sales
                </a>
              </div>
            </LazySection>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative py-24 lg:py-32 bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/50 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 items-center gap-10 lg:gap-0">
            <div className="py-12 lg:py-20">
                <h3 className="text-4xl font-extrabold text-white tracking-tight mb-6">
                  Ready to transform your school?
                </h3>
                <p className="text-lg text-slate-300 mb-10">
                  Book a free demo today and see how EduTrack can streamline your operations and improve learning outcomes.
                </p>
                
                <div className="space-y-6 mb-12">
                  <a href="mailto:EduTrack46@gmail.com" className="flex items-center gap-4 text-indigo-300 hover:text-white transition-colors">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/10">
                      <Mail size={20} />
                    </div>
                    <span className="font-semibold">EduTrack46@gmail.com</span>
                  </a>
                  <a href="tel:+254796031071" className="flex items-center gap-4 text-indigo-300 hover:text-white transition-colors">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/10">
                      <Phone size={20} />
                    </div>
                    <span className="font-semibold">0796 031 071</span>
                  </a>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  <Link to="/trial" className={`px-6 py-3.5 text-base sm:px-8 sm:py-4 sm:text-lg ${btnPrimary}`}>
                    Request Demo
                  </Link>
                  <Link to="/login" className={`px-6 py-3.5 text-base sm:px-8 sm:py-4 sm:text-lg ${btnInverse}`}>
                    Sign In
                  </Link>
                </div>
            </div>

            <div className="hidden lg:block h-full min-h-[520px] relative overflow-hidden rounded-[2.5rem]">
              <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-[2px]" />
              <img 
                src={new URL('../../images/pexels-gabby-k-6289065.jpg', import.meta.url).href} 
                className="w-full h-full object-cover" 
                alt="Contact background" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <AppLogo size={18} className="text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">EduTrack</span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
              {[
                { label: 'Features', href: '#features' },
                { label: 'Advantages', href: '#advantages' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'Contact us', href: '#contact' },
                { label: 'Privacy', href: '#' }
              ].map((item) => (
                <a key={item.label} href={item.href} className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                  {item.label}
                </a>
              ))}
            </div>
            
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} EduTrack. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

