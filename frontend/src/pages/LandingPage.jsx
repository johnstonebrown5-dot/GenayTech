import React, { useState, useEffect, useRef } from 'react'
import AppLogo from '../components/AppLogo'
import { Link } from 'react-router-dom'

// Lazy load wrapper using IntersectionObserver
function LazySection({ children, rootMargin = '0px 0px -10% 0px' }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        io.disconnect()
      }
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {children}
    </div>
  )
}

// Reusable check icon for feature lists
function Check({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-5 w-5 text-green-600 ${className}`}
      aria-hidden="true"
    >
      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.43.01L3.29 10.82a1 1 0 1 1 1.42-1.41l3.03 3.05 6.79-6.883a1 1 0 0 1 1.174-.287Z" clipRule="evenodd" />
    </svg>
  )
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const whatsappNumber = '+254796031071'
  const whatsappLink = `https://wa.me/${whatsappNumber.replace('+', '')}`
  // Color palettes for feature cards
  const palettes = [
    { bg: 'bg-indigo-600/10', text: 'text-indigo-700' },
    { bg: 'bg-emerald-600/10', text: 'text-emerald-700' },
    { bg: 'bg-rose-600/10', text: 'text-rose-700' },
    { bg: 'bg-amber-500/10', text: 'text-amber-700' },
    { bg: 'bg-sky-600/10', text: 'text-sky-700' },
    { bg: 'bg-violet-600/10', text: 'text-violet-700' },
    { bg: 'bg-fuchsia-600/10', text: 'text-fuchsia-700' },
    { bg: 'bg-lime-600/10', text: 'text-lime-700' },
    { bg: 'bg-teal-600/10', text: 'text-teal-700' },
  ]
  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} className="h-9 w-9 rounded-lg" />
            <span className="text-xl font-semibold tracking-tight">EduTrack</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#advantages" className="hover:text-gray-900">Advantages</a>
            <a href="#pricing" className="hover:text-gray-900">Pricing</a>
            <a href="#contact" className="hover:text-gray-900">Contact</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">Sign in</Link>
            <Link to="/app" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Open App</Link>
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
              <a href="#features" onClick={() => setMobileOpen(false)} className="py-2">Features</a>
              <a href="#advantages" onClick={() => setMobileOpen(false)} className="py-2">Advantages</a>
              <a href="#pricing" onClick={() => setMobileOpen(false)} className="py-2">Pricing</a>
              <a href="#contact" onClick={() => setMobileOpen(false)} className="py-2">Contact</a>
              <div className="flex gap-3 pt-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg text-center">Sign in</Link>
                <Link to="/app" onClick={() => setMobileOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg text-center">Open App</Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-semibold mb-4">
                <span>All-in-one School Management</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
                Run your school smarter with EduTrack
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                A modern, end-to-end platform for schools to manage academics, finance, communication, timetables, and performance—from one secure dashboard.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/app" className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">
                  Get Started
                </Link>
                <a href="#pricing" className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
                  View Pricing
                </a>
              </div>
              <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500"/>Secure</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-500"/>Reliable</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-purple-500"/>Fast</div>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-gray-200 shadow-xl overflow-hidden bg-white">
                <img
                  src={new URL('../../images/pexels-kwakugriffn-14554003.jpg', import.meta.url).href}
                  alt="EduTrack preview"
                  width="1280"
                  height="640"
                  fetchPriority="high"
                  decoding="async"
                  loading="eager"
                  className="w-full h-80 object-cover"
                />
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                  <img loading="lazy" decoding="async" width="400" height="160" src={new URL('../../images/pexels-gabby-k-6289065.jpg', import.meta.url).href} alt="Students" className="h-28 w-full object-cover"/>
                  <img loading="lazy" decoding="async" width="400" height="160" src={new URL('../../images/pexels-akelaphotography-448877.jpg', import.meta.url).href} alt="Campus" className="h-28 w-full object-cover"/>
                  <img loading="lazy" decoding="async" width="400" height="160" src={new URL('../../images/pexels-kwakugriffn-14554003.jpg', import.meta.url).href} alt="Education" className="h-28 w-full object-cover"/>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Compare plans */}
        <div className="mt-14 overflow-x-auto">
          <table className="w-full text-sm text-left border border-gray-200 rounded-lg overflow-hidden bg-white">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Per Student Monthly</th>
                <th className="px-4 py-3">One-time License</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-gray-700">Pricing</td>
                <td className="px-4 py-3">KSh 30 / student / month</td>
                <td className="px-4 py-3">KSh 500,000 one-time</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">Rights & permissions</td>
                <td className="px-4 py-3">Standard subscription rights</td>
                <td className="px-4 py-3">All rights & permissions</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">Support</td>
                <td className="px-4 py-3">Available while subscribed</td>
                <td className="px-4 py-3">1 year support included</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">Training & startup</td>
                <td className="px-4 py-3">Optional</td>
                <td className="px-4 py-3">Free training & startup</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      

      {/* Features */}
      <LazySection>
        <section id="features" className="mx-auto max-w-7xl px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900">Everything you need to manage a modern school</h2>
            <p className="mt-3 text-gray-600">Powerful modules designed for Administrators, Teachers, Finance teams, Students, and Parents.</p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Role‑based Dashboards', desc: 'Tailored experiences for Admin, Teacher, Student, and Finance roles.' },
              { title: 'Academics & Timetable', desc: 'Manage classes, subjects, calendars, and detailed time‑tables.' },
              { title: 'Exams, Grades & Results', desc: 'Enter, analyze and share results with rich analytics.' },
              { title: 'Messaging & Notifications', desc: 'In‑app messages and real‑time notifications keep everyone aligned.' },
              { title: 'Finance Suite', desc: 'Invoices, payments, fee categories, class fees, expenses, and reports.' },
              { title: 'Student Wallet & Pocket Money', desc: 'Track deposits, spending and balances with transparency.' },
              { title: 'Reports & Analytics', desc: 'Operational and academic insights for data‑driven decisions.' },
              { title: 'Secure & Private', desc: 'Role‑based access, audit trails and modern security best practices.' },
              { title: 'Scalable Architecture', desc: 'Built with React and Django for reliability and speed.' }
            ].map((f, idx) => (
              <div key={f.title} className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition bg-white">
                <div className={`h-10 w-10 rounded-lg grid place-items-center mb-4 ${palettes[idx % palettes.length].bg} ${palettes[idx % palettes.length].text}`}>★</div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </LazySection>

      {/* Advantages */}
      <LazySection>
      <section id="advantages" className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Why schools choose EduTrack</h2>
              <ul className="mt-6 space-y-4 text-gray-700">
                <li className="flex gap-3"><span className="text-green-600">✓</span><span>Single source of truth for student, staff and academic data.</span></li>
                <li className="flex gap-3"><span className="text-green-600">✓</span><span>Automated billing, invoicing and receipts reduce manual work.</span></li>
                <li className="flex gap-3"><span className="text-green-600">✓</span><span>Improved parent communication via messages and statements.</span></li>
                <li className="flex gap-3"><span className="text-green-600">✓</span><span>Time‑table and lesson planning streamline daily operations.</span></li>
                <li className="flex gap-3"><span className="text-green-600">✓</span><span>Clear performance tracking with grades, exams and reports.</span></li>
                <li className="flex gap-3"><span className="text-green-600">✓</span><span>Faster decision‑making with integrated analytics dashboards.</span></li>
              </ul>
              <div className="mt-8 flex gap-3">
                <a href="#pricing" className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">See Plans</a>
                <a href={whatsappLink} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">WhatsApp Us</a>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-2xl grid place-items-center text-white">
                <div className="text-center px-8">
                  <div className="text-5xl font-extrabold">99.9%</div>
                  <div className="mt-2 text-indigo-100">Uptime & Reliability</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      </LazySection>

      {/* Pricing */}
      <LazySection>
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900">Simple, transparent billing</h2>
          <p className="mt-3 text-gray-600">Choose a one-time license or a per-student monthly plan.</p>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-2 gap-6">
          {[
            {
              slug: 'one-time',
              name: 'One-time License',
              priceText: 'KSh 500,000',
              highlight: true,
              ribbon: 'One-time',
              detailsPath: '/pricing/one-time-license',
              features: ['All rights & permissions', '1 year support', 'Free training & startup', 'All modules included']
            },
            {
              slug: 'per-student',
              name: 'Per Student Monthly',
              priceText: 'KSh 30 / student / month',
              highlight: false,
              ribbon: 'Hot',
              detailsPath: '/pricing/per-student-monthly',
              features: ['Billed monthly based on active students', 'Platform access & updates', 'Ideal for growing schools', 'Support available while subscribed']
            }
          ].map((p) => {
            const priceText = p.priceText
            return (
            <div
              id={`plan-${p.slug || p.name.toLowerCase()}`}
              key={p.name}
              className={`relative rounded-2xl border p-6 bg-white hover:shadow-lg transition duration-200 flex flex-col dark:bg-gray-900 ${p.highlight ? 'border-indigo-600 shadow-xl ring-1 ring-indigo-100 bg-gradient-to-b from-white to-indigo-50/30 dark:from-gray-900 dark:to-indigo-950/20 hover:-translate-y-1 hover:scale-[1.01]' : 'border-gray-200 dark:border-gray-800'}`}
            >
              {/* Ribbon */}
              {(p.ribbon || p.highlight) && (
                <span className={`pointer-events-none absolute -right-10 top-6 rotate-45 text-white text-xs font-semibold px-10 py-1 shadow-sm ${p.ribbon === 'Hot' ? 'bg-amber-500' : 'bg-indigo-600'}`}>{p.ribbon || 'Recommended'}</span>
              )}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
                {p.highlight && <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full">{p.ribbon || 'Most popular'}</span>}
              </div>
              <div className="mt-4 text-3xl font-extrabold text-gray-900 tracking-tight">
                <span className="inline-block transition-all duration-300 will-change-transform" key={priceText}>{priceText}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-gray-700 flex-1 dark:text-gray-300">
                {p.features.map((f) => {
                  const tooltip = ''
                  return (
                    <li key={f} className="flex gap-2" title={tooltip}>
                      <Check />
                      <span>{f}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-6 flex gap-3">
                <a href={`mailto:EduTrack46@gmail.com?subject=EduTrack%20Pricing%20-%20${p.name}`} className={`flex-1 inline-flex justify-center items-center h-10 px-4 rounded-lg font-medium ${p.highlight ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
                  Talk to Sales
                </a>
                <Link to={p.detailsPath} className="inline-flex justify-center items-center h-10 px-4 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400">
                  Learn more
                </Link>
              </div>
            </div>
          )})}
        </div>
      </section>
      </LazySection>

      {/* Contact */}
      <LazySection>
      <section id="contact" className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Get in touch</h2>
              <p className="mt-3 text-gray-600">We'd love to show you EduTrack in action or answer any questions.</p>
              <div className="mt-6 space-y-3 text-gray-700">
                <div><span className="font-medium">Email:</span> <a className="text-indigo-700 hover:underline" href="mailto:EduTrack46@gmail.com">EduTrack46@gmail.com</a></div>
                <div><span className="font-medium">Phone (Calls & WhatsApp):</span> <a className="text-indigo-700 hover:underline" href="tel:+254796031071">0796 031 071</a></div>
                <div><span className="font-medium">WhatsApp:</span> <a className="text-indigo-700 hover:underline" href={whatsappLink} target="_blank" rel="noreferrer">Chat on WhatsApp</a></div>
              </div>
              <div className="mt-8 flex gap-3">
                <a href="mailto:EduTrack46@gmail.com?subject=EduTrack%20Demo%20Request" className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Request a Demo</a>
                <Link to="/login" className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">Sign in</Link>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Billing information</h3>
              <p className="mt-2 text-sm text-gray-600">We offer a one-time license (KSh 500,000) with all rights & permissions, 1 year support, and free training & startup—plus a per-student monthly plan (KSh 30 per student per month). Invoices can be settled by bank, M-Pesa, or card.</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li className="flex gap-2"><span className="text-indigo-600">•</span> One-time license available</li>
                <li className="flex gap-2"><span className="text-indigo-600">•</span> Per-student monthly billing available</li>
                <li className="flex gap-2"><span className="text-indigo-600">•</span> Free training & startup included with one-time license</li>
              </ul>
              <div className="mt-6">
                <a href="mailto:EduTrack46@gmail.com?subject=EduTrack%20Billing%20Inquiry" className="inline-flex items-center gap-2 text-indigo-700 hover:underline">Contact billing →</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      </LazySection>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">© {new Date().getFullYear()} EduTrack. All rights reserved.</div>
          <div className="flex items-center gap-4 text-sm">
            <a href="mailto:EduTrack46@gmail.com" className="text-gray-700 hover:text-gray-900">Email</a>
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="text-gray-700 hover:text-gray-900">WhatsApp</a>
            <Link to="/login" className="text-gray-700 hover:text-gray-900">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
