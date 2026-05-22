import React, { useMemo, useState } from 'react'
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
  LayoutDashboard,
  FileText,
  Receipt,
  CalendarDays,
  School,
  UserRoundCheck,
  Send
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
        preload="none"
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
      details: 'Experience zero downtime with our cloud-hosted solution. Built on modern, scalable technology, Genay Technologies is fast, reliable, and accessible from anywhere in the world on any device.',
      icon: Database, color: 'text-slate-600', bg: 'bg-slate-50' 
    }
  ]

  const audience = [
    'School owners',
    'Admins',
    'Teachers',
    'Finance offices',
    'Parents',
    'Students'
  ]

  const proofStats = [
    { value: 'One', label: 'secure dashboard' },
    { value: '5+', label: 'school workflows' },
    { value: '24/7', label: 'cloud access' },
    { value: '99%', label: 'service availability' }
  ]

  const workflows = [
    {
      title: 'Enter marks and generate report cards',
      desc: 'Teachers capture scores while admins review, publish, and print reports.',
      icon: FileText,
      color: 'text-indigo-700',
      bg: 'bg-indigo-50'
    },
    {
      title: 'Track fees, balances, and receipts',
      desc: 'Finance teams see invoices, payments, arrears, and class fee status clearly.',
      icon: Receipt,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50'
    },
    {
      title: 'Send parent messages fast',
      desc: 'Reach parents with fee updates, announcements, and school communication.',
      icon: Send,
      color: 'text-amber-700',
      bg: 'bg-amber-50'
    },
    {
      title: 'Manage classes, subjects, and timetables',
      desc: 'Keep teachers, students, lessons, and schedules organized in one place.',
      icon: CalendarDays,
      color: 'text-sky-700',
      bg: 'bg-sky-50'
    }
  ]

  const DashboardPreview = ({ compact = false }) => (
    <div className={`rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 overflow-hidden ${compact ? '' : 'ring-1 ring-white/60'}`}>
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="text-[11px] font-bold text-slate-500">Genay School Dashboard</div>
      </div>
      <div className="grid grid-cols-[72px_1fr] min-h-[340px] bg-slate-50">
        <div className="bg-slate-950 px-3 py-4">
          <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <School size={18} />
          </div>
          <div className="space-y-3">
            {['bg-indigo-400', 'bg-slate-700', 'bg-slate-700', 'bg-slate-700', 'bg-slate-700'].map((c, i) => (
              <div key={i} className={`h-8 rounded-xl ${c}`} />
            ))}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-600">Today</div>
              <div className="mt-1 text-xl font-black text-slate-900">School overview</div>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Live</div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ['Students', '842'],
              ['Fees paid', '76%'],
              ['Reports', 'Ready']
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                <div className="mt-2 text-lg font-black text-slate-900">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-black text-slate-900">Marks entry</div>
                <div className="text-[11px] font-bold text-indigo-600">Term 2</div>
              </div>
              <div className="space-y-2">
                {[
                  ['Mathematics', '88%'],
                  ['English', '74%'],
                  ['Science', '81%']
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[1fr_48px] items-center gap-3">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-indigo-500" style={{ width: value }} />
                    </div>
                    <div className="text-right text-xs font-bold text-slate-600">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="mb-3 text-sm font-black text-slate-900">Recent actions</div>
              <div className="space-y-2">
                {[
                  ['Fee receipt sent', Receipt],
                  ['Report cards ready', FileText],
                  ['Parent SMS queued', MessageSquare]
                ].map(([label, Icon]) => (
                  <div key={label} className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-indigo-600">
                      <Icon size={14} />
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

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

  const featureCardStyles = [
    {
      shell: 'bg-gradient-to-br from-white via-blue-50/70 to-white',
      glow: 'bg-blue-500/15',
      pill: 'border-blue-100 bg-blue-50 text-blue-700'
    },
    {
      shell: 'bg-gradient-to-br from-white via-indigo-50/70 to-white',
      glow: 'bg-indigo-500/15',
      pill: 'border-indigo-100 bg-indigo-50 text-indigo-700'
    },
    {
      shell: 'bg-gradient-to-br from-white via-emerald-50/70 to-white',
      glow: 'bg-emerald-500/15',
      pill: 'border-emerald-100 bg-emerald-50 text-emerald-700'
    },
    {
      shell: 'bg-gradient-to-br from-white via-amber-50/70 to-white',
      glow: 'bg-amber-500/15',
      pill: 'border-amber-100 bg-amber-50 text-amber-700'
    },
    {
      shell: 'bg-gradient-to-br from-white via-rose-50/70 to-white',
      glow: 'bg-rose-500/15',
      pill: 'border-rose-100 bg-rose-50 text-rose-700'
    },
    {
      shell: 'bg-gradient-to-br from-white via-purple-50/70 to-white',
      glow: 'bg-purple-500/15',
      pill: 'border-purple-100 bg-purple-50 text-purple-700'
    },
    {
      shell: 'bg-gradient-to-br from-white via-cyan-50/70 to-white',
      glow: 'bg-cyan-500/15',
      pill: 'border-cyan-100 bg-cyan-50 text-cyan-700'
    },
    {
      shell: 'bg-gradient-to-br from-white via-teal-50/70 to-white',
      glow: 'bg-teal-500/15',
      pill: 'border-teal-100 bg-teal-50 text-teal-700'
    },
    {
      shell: 'bg-gradient-to-br from-white via-slate-50 to-white',
      glow: 'bg-slate-500/15',
      pill: 'border-slate-200 bg-slate-50 text-slate-700'
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50/30 selection:bg-indigo-100 selection:text-indigo-900">
      <BackgroundVideo enabled={false} />
      <StarryBackground enabled={!prefersReducedMotion} />
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-indigo-600/95 md:border-slate-200/60 md:bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="#hero" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
                <AppLogo size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white md:text-slate-900">Genay Technologies</span>
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
      <section id="hero" className="relative pt-24 pb-14 sm:pt-32 sm:pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Squared background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-indigo-50/80 to-sky-50" />
        <div aria-hidden="true" className="absolute inset-0 bg-tech-grid opacity-100" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,rgba(79,70,229,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(79,70,229,0.18)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(79,70,229,0.16),transparent_28%),radial-gradient(circle_at_82%_28%,rgba(14,165,233,0.14),transparent_30%),radial-gradient(circle_at_72%_82%,rgba(16,185,129,0.12),transparent_28%)]" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/40 to-white/90" />

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
              <div className="rounded-[1.75rem] bg-white/60 p-4 shadow-xl shadow-indigo-950/5 ring-1 ring-white/70 backdrop-blur-sm sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none sm:ring-0 sm:backdrop-blur-0 lg:rounded-none lg:bg-transparent lg:backdrop-blur-0 lg:ring-0 lg:shadow-none lg:p-0">
              <motion.div variants={heroFlyInRight} className="inline-flex max-w-full items-center gap-2 rounded-full bg-indigo-50/90 px-3 py-1.5 text-[11px] sm:px-4 sm:text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 mb-5 sm:mb-6">
                <Zap size={14} className="fill-indigo-700" />
                <span className="truncate">All-in-one School Management</span>
              </motion.div>
              
              <motion.h1 variants={heroFlyInUp} className="text-[2.35rem] sm:text-4xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.02] sm:leading-[1.1]">
                Run your school <br />
                <span className="text-indigo-600">smarter</span> with Genay Technologies
              </motion.h1>
              
              <div className="mt-5 sm:mt-6 w-full rounded-2xl bg-white/50 backdrop-blur-sm ring-1 ring-white/40 p-3.5 sm:p-0 sm:bg-transparent sm:backdrop-blur-0 sm:ring-0 lg:bg-transparent lg:p-0">
                <motion.p variants={heroFlyInUp} className="text-[13px] sm:text-base lg:text-lg leading-relaxed text-slate-700 sm:text-slate-600">
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
              
              <motion.div variants={heroFlyInUp} className="mt-7 sm:mt-10 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
                <MotionLink
                  to="/app"
                  whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  transition={prefersReducedMotion ? undefined : { type: 'spring', stiffness: 420, damping: 25 }}
                  className={`group px-4 py-3 text-xs sm:px-8 sm:py-4 sm:text-lg ${btnPrimary}`}
                >
                  Request Demo
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1 sm:hidden" />
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 hidden sm:block" />
                </MotionLink>
                <motion.a
                  href="#pricing"
                  whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                  transition={prefersReducedMotion ? undefined : { type: 'spring', stiffness: 420, damping: 25 }}
                  className={`px-4 py-3 text-xs sm:px-8 sm:py-4 sm:text-lg ${btnSecondary}`}
                >
                  View Pricing
                </motion.a>
              </motion.div>
              
              <motion.div variants={heroFlyInUp} className="mt-7 sm:mt-12 grid grid-cols-3 gap-2 border-t border-slate-200/80 pt-5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-3 sm:pt-8">
                {[
                  { label: 'Secure', color: 'bg-emerald-500', Icon: ShieldCheck, delay: 0 },
                  { label: 'Reliable', color: 'bg-indigo-500', Icon: Users, delay: 0.1 },
                  { label: 'Fast', color: 'bg-purple-500', Icon: Zap, delay: 0.2 }
                ].map(({ label, color, Icon, delay }) => (
                  <motion.div
                    key={label}
                    variants={descriptorVariant}
                    transition={{ duration: 0.5, delay }}
                    className="justify-center rounded-full bg-white/60 px-2 py-1.5 ring-1 ring-slate-200/70 flex items-center gap-1.5 sm:bg-transparent sm:px-0 sm:py-0 sm:ring-0 sm:gap-2"
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
                    <span className="text-[9px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
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

      {/* Product Evidence Section */}
      <section className="bg-white py-12 sm:py-20 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <LazySection>
              <div className="max-w-xl">
                <h2 className="text-[11px] sm:text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] mb-3 sm:mb-4">Product Preview</h2>
                <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  See the school operating system behind the promise
                </h3>
                <p className="mt-4 sm:mt-5 text-sm sm:text-base leading-relaxed text-slate-600">
                  Genay Technologies brings academics, fees, exams, messages, students, and reports into one practical workspace for daily school operations.
                </p>
                <div className="mt-5 sm:mt-6 flex flex-wrap gap-2">
                  {audience.map((item) => (
                    <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {proofStats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
                      <div className="text-xl sm:text-2xl font-black text-slate-900">{stat.value}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </LazySection>
            <LazySection>
              <div className="max-h-[520px] overflow-hidden rounded-[1.75rem] sm:max-h-none sm:overflow-visible">
              <DashboardPreview />
              </div>
            </LazySection>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="bg-slate-50 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] mb-4">Daily Workflows</h2>
              <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Built around the work schools repeat every week
              </h3>
            </div>
            <Link to="/trial" className={`px-5 py-3 text-sm sm:px-6 sm:py-3.5 sm:text-base ${btnPrimary}`}>
              Book Demo
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {workflows.map((item) => (
              <LazySection key={item.title}>
                <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${item.bg} ${item.color}`}>
                    <item.icon size={24} />
                  </div>
                  <h4 className="text-base font-black text-slate-900">{item.title}</h4>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                </div>
              </LazySection>
            ))}
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
      <section id="features" className="relative overflow-hidden py-24 lg:py-32 bg-gradient-to-b from-slate-50 via-white to-slate-50">
        <div aria-hidden="true" className="absolute inset-0 bg-tech-grid opacity-70" />
        <div aria-hidden="true" className="absolute left-1/2 top-10 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-100/50 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative text-center max-w-3xl mx-auto mb-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-600 shadow-sm">
              <Zap size={14} />
              Core Modules
            </div>
            <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
              Everything you need to manage a modern school
            </h3>
            <p className="mt-6 text-lg text-slate-600">
              Powerful modules designed for Administrators, Teachers, Finance teams, Students, and Parents.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['Academics', 'Finance', 'Messaging', 'Analytics'].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
          
          <div className="relative grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, idx) => {
              const isExpanded = expandedFeature === idx
              const cardStyle = featureCardStyles[idx % featureCardStyles.length]
              return (
                <LazySection key={f.title}>
                  <div className={`group relative h-full overflow-hidden rounded-3xl border ${borderPalettes[idx % borderPalettes.length]} ${cardStyle.shell} p-6 sm:p-8 shadow-lg shadow-slate-900/10 transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/20 flex flex-col`}>
                    <div aria-hidden="true" className={`absolute -right-12 -top-12 h-36 w-36 rounded-full ${cardStyle.glow} blur-3xl transition-transform duration-500 group-hover:scale-125`} />
                    <div aria-hidden="true" className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="relative flex h-full flex-col">
                      <div className="mb-6 flex items-start justify-between gap-4">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${f.bg} ${f.color} ring-1 ring-white/80 shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                          <f.icon size={28} />
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${cardStyle.pill}`}>
                          Module {idx + 1}
                        </span>
                      </div>
                    <h4 className="text-lg sm:text-xl font-black text-slate-900 mb-2.5 sm:mb-3">{f.title}</h4>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-5">{f.desc}</p>
                    <div className="mb-5 flex flex-wrap gap-2">
                      {['Fast setup', 'Role access', 'Reports'].slice(0, idx % 3 + 1).map((tag) => (
                        <span key={tag} className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <div className="mt-auto">
                      <button 
                        onClick={() => setExpandedFeature(isExpanded ? null : idx)}
                        className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-bold text-indigo-600 ring-1 ring-indigo-100 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
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
                  </div>
                </LazySection>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section id="advantages" className="relative py-16 sm:py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[#171143]" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.075)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.075)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_18%_28%,rgba(99,102,241,0.34),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(168,85,247,0.24),transparent_30%)]" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/40" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <LazySection>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-200 backdrop-blur">
                <ShieldCheck size={15} />
                Why Us
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight lg:text-5xl mb-4">
                The Genay Technologies Advantage
              </h3>
              <p className="mb-7 max-w-xl text-sm sm:text-base leading-relaxed text-indigo-100/80">
                A focused operating system for schools that need fewer spreadsheets, faster decisions, and cleaner communication between departments.
              </p>
              <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-white shadow-2xl shadow-indigo-950/30">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">Advantage Overview</div>
                </div>
                <div className="grid gap-3 p-4 sm:p-5">
                {[
                  ['Student data', 'Single source of truth for all student and academic records.'],
                  ['Finance', 'Automated billing and receipts reduce manual overhead.'],
                  ['Parents', 'Streamlined parent communication via digital statements.'],
                  ['Timetable', 'Dynamic lesson planning and automated scheduling.'],
                  ['Performance', 'Real-time academic performance tracking with analytics.'],
                  ['Wallet', 'Integrated school wallet for secure cashless transactions.']
                ].map(([label, text], i) => (
                  <div key={label} className="group grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 transition hover:border-indigo-100 hover:bg-indigo-50/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                      <span className="text-xs font-black">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-widest text-indigo-600">{label}</div>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{text}</p>
                    </div>
                    <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 sm:flex">
                      <Check size={15} strokeWidth={3} />
                    </div>
                  </div>
                ))}
                </div>
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
              <div className="relative mx-auto max-w-lg">
                <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-white shadow-2xl shadow-indigo-950/30">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-rose-400" />
                      <span className="h-3 w-3 rounded-full bg-amber-400" />
                      <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-500">System Status</div>
                  </div>
                  <div className="grid gap-3 p-4 sm:p-5">
                      {[
                        ['Uptime', '99.9% service availability for daily school operations.'],
                        ['Security', 'Enterprise secure access with role-based permissions.'],
                        ['Reports', 'Fast report cards and performance views for school teams.'],
                        ['Live data', 'Current records across academics, finance, and communication.']
                      ].map(([label, text], i) => (
                        <div key={label} className="group grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 transition hover:border-indigo-100 hover:bg-indigo-50/50">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                            <span className="text-xs font-black">{String(i + 1).padStart(2, '0')}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-black uppercase tracking-widest text-indigo-600">{label}</div>
                            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{text}</p>
                          </div>
                          <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 sm:flex">
                            <Check size={15} strokeWidth={3} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
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

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Plan 1 */}
            <LazySection>
              <div className="relative flex flex-col h-full rounded-[2.25rem] sm:rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/20">
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
              <div className="relative flex flex-col h-full rounded-[2.25rem] sm:rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-500/20">
                <div className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-emerald-100 px-4 py-1 text-xs font-black uppercase tracking-widest text-emerald-800">
                  Popular
                </div>
                <div className="mb-5 sm:mb-8">
                  <h4 className="text-sm sm:text-lg font-bold text-slate-900">Termly School Plan</h4>
                  <div className="mt-2.5 sm:mt-4 flex items-baseline gap-1">
                    <span className="text-2xl sm:text-4xl font-black text-slate-900">KSh 80</span>
                    <span className="text-[11px] sm:text-sm text-slate-500 font-medium">/ student / term</span>
                  </div>
                  <p className="mt-2.5 sm:mt-4 text-xs sm:text-base text-slate-600">Best for schools that prefer billing around academic terms.</p>
                </div>
                
                <ul className="space-y-2.5 sm:space-y-4 mb-7 sm:mb-10 flex-1">
                  {['Term-based invoicing', 'Exam and report card tools', 'Parent communication', 'Finance summaries', 'Teacher access included'].map((f) => (
                    <li key={f} className="flex gap-3 text-slate-600">
                      <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5 sm:hidden" />
                      <Check size={18} className="text-emerald-600 flex-shrink-0 mt-0.5 hidden sm:block" />
                      <span className="text-[11px] sm:text-sm font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
                
                <a href={whatsappLink} target="_blank" rel="noreferrer" className={`w-full py-3 sm:py-4 text-sm sm:text-lg text-center ${btnSecondary}`}>
                  Discuss Plan
                </a>
              </div>
            </LazySection>

            {/* Plan 3 */}
            <LazySection>
              <div className="relative flex flex-col h-full rounded-[2.25rem] sm:rounded-[2.5rem] bg-slate-950 p-6 sm:p-8 shadow-2xl shadow-slate-900/30 ring-1 ring-slate-800 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-900/50">
                <div className="mb-5 sm:mb-8 text-white">
                  <h4 className="text-sm sm:text-lg font-bold">Enterprise Monthly</h4>
                  <div className="mt-2.5 sm:mt-4 flex items-baseline gap-1">
                    <span className="text-2xl sm:text-4xl font-black">Custom</span>
                  </div>
                  <p className="mt-2.5 sm:mt-4 text-xs sm:text-base text-white/75">For multi-branch schools or institutions needing tailored support.</p>
                </div>
                
                <ul className="space-y-2.5 sm:space-y-4 mb-7 sm:mb-10 flex-1">
                  {['Multi-school setup', 'Advanced user permissions', 'Priority onboarding', 'Custom reports', 'Dedicated support channel'].map((f) => (
                    <li key={f} className="flex gap-3 text-white/85">
                      <Check size={16} className="text-sky-300 flex-shrink-0 mt-0.5 sm:hidden" />
                      <Check size={18} className="text-sky-300 flex-shrink-0 mt-0.5 hidden sm:block" />
                      <span className="text-[11px] sm:text-sm font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
                
                <a href="mailto:EduTrack46@gmail.com" className={`w-full py-3 sm:py-4 text-sm sm:text-lg text-center ${btnInverse}`}>
                  Contact Sales
                </a>
              </div>
            </LazySection>

            {/* Plan 4 */}
            <LazySection>
              <div className="relative flex flex-col h-full rounded-[2.25rem] sm:rounded-[2.5rem] bg-indigo-600 p-6 sm:p-8 shadow-2xl shadow-indigo-900/40 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-900/50">
                <div className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-amber-400 px-4 py-1 text-xs font-black uppercase tracking-widest text-slate-900">
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
      <section id="contact" className="relative py-24 lg:py-32 bg-slate-950 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_18%_28%,rgba(79,70,229,0.34),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(14,165,233,0.20),transparent_28%),radial-gradient(circle_at_70%_86%,rgba(168,85,247,0.24),transparent_32%)]" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/45 to-slate-950" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr] items-center gap-10 lg:gap-16">
            <div className="py-6 lg:py-12">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-200 backdrop-blur">
                <MessageSquare size={15} />
                Book a Demo
              </div>
              <h3 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
                Ready to transform your school?
              </h3>
              <p className="text-lg leading-relaxed text-slate-300 mb-8 max-w-xl">
                See how Genay Technologies can streamline marks, fees, messages, reports, and daily school operations from one secure workspace.
              </p>

              <div className="mb-9 grid gap-3 sm:grid-cols-2">
                <a href="mailto:EduTrack46@gmail.com" className="group rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur transition hover:bg-white/[0.12] hover:border-indigo-300/30">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 flex items-center justify-center rounded-2xl bg-white/10 text-indigo-200 ring-1 ring-white/10">
                      <Mail size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-widest text-indigo-200/80">Email</div>
                      <div className="truncate text-sm font-bold text-white group-hover:text-indigo-100">EduTrack46@gmail.com</div>
                    </div>
                  </div>
                </a>
                <a href="tel:+254796031071" className="group rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur transition hover:bg-white/[0.12] hover:border-indigo-300/30">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 flex items-center justify-center rounded-2xl bg-white/10 text-indigo-200 ring-1 ring-white/10">
                      <Phone size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-widest text-indigo-200/80">Phone</div>
                      <div className="truncate text-sm font-bold text-white group-hover:text-indigo-100">0796 031 071</div>
                    </div>
                  </div>
                </a>
              </div>

              <div className="mb-10 grid grid-cols-3 gap-3">
                {[
                  ['Demo', 'Free'],
                  ['Setup', 'Guided'],
                  ['Support', 'Direct']
                ].map(([top, bottom]) => (
                  <div key={top} className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 text-center backdrop-blur">
                    <div className="text-sm font-black text-white">{top}</div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-indigo-200/70">{bottom}</div>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-4">
                <Link to="/trial" className={`px-6 py-3.5 text-base sm:px-8 sm:py-4 sm:text-lg ${btnPrimary}`}>
                  Request Demo
                  <ArrowRight size={20} />
                </Link>
                <a href={whatsappLink} target="_blank" rel="noreferrer" className={`px-6 py-3.5 text-base sm:px-8 sm:py-4 sm:text-lg ${btnInverse}`}>
                  <MessageSquare size={20} />
                  WhatsApp
                </a>
              </div>
            </div>

            <div className="relative">
              <div aria-hidden="true" className="absolute -inset-4 rounded-[3rem] bg-indigo-500/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white shadow-2xl shadow-indigo-950/40">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">Demo Request</div>
                </div>
                <div className="p-5 sm:p-7">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Implementation path</div>
                      <div className="mt-1 text-2xl font-black text-slate-900">From demo to launch</div>
                    </div>
                    <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Ready</div>
                  </div>
                  <div className="grid gap-3">
                    {[
                      ['01', 'Book demo', 'Share your school size, modules, and current workflow.'],
                      ['02', 'Configure setup', 'Classes, users, subjects, fees, and permissions are prepared.'],
                      ['03', 'Train teams', 'Admins, teachers, and finance users learn the daily workflows.'],
                      ['04', 'Go live', 'Start managing marks, payments, messages, and reports.']
                    ].map(([num, title, desc]) => (
                      <div key={title} className="grid grid-cols-[42px_1fr] gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                          <span className="text-xs font-black">{num}</span>
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900">{title}</div>
                          <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
              <span className="text-lg font-bold tracking-tight text-slate-900">Genay Technologies</span>
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
              © {new Date().getFullYear()} Genay Technologies. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
