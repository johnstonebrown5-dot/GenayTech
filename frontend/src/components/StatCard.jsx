import React, { useEffect, useMemo, useState } from 'react'

const iconMap = {
  'Students': '👥',
  'Teachers': '👨‍🏫',
  'Classes': '🏫',
  'Attendance Rate': '📊',
  'Collected': '💰',
  'Outstanding': '⚠️',
  'CBC Assessments': '📝'
}

// Accent gradient presets for different metrics
const accentMap = {
  'Students': 'from-brand-500 to-brand-600',
  'Teachers': 'from-purple-500 to-purple-600',
  'Classes': 'from-emerald-500 to-emerald-600',
  'Attendance Rate': 'from-amber-500 to-orange-600',
  'Collected': 'from-emerald-500 to-emerald-600',
  'Outstanding': 'from-rose-500 to-rose-600',
}

export default function StatCard({ title, value, icon, accent, animate = false, format, trend }) {
  const displayIcon = icon || iconMap[title] || '📈'
  const accentClasses = accent || accentMap[title] || 'from-brand-500 to-brand-600'
  const isNumber = typeof value === 'number' && Number.isFinite(value)

  const [displayValue, setDisplayValue] = useState(value)

  // number formatting callback
  const formatter = useMemo(() => {
    if (typeof format === 'function') return format
    return (v) => v
  }, [format])

  // simple count-up animation for numeric values
  useEffect(() => {
    if (!animate || !isNumber) { setDisplayValue(value); return }
    const duration = 700 // ms
    const frames = Math.max(24, Math.floor(duration / 16))
    const start = 0
    const end = value
    let frame = 0
    const step = () => {
      frame += 1
      const progress = Math.min(1, frame / frames)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const current = Math.round(start + (end - start) * eased)
      setDisplayValue(current)
      if (frame < frames) requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [value, animate, isNumber])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 shadow-card hover:shadow-elevated transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.995]">
      {/* Decorative gradient blob */}
      <div className={`pointer-events-none absolute -right-6 -bottom-8 w-28 h-28 rounded-full blur-2 opacity-10 bg-gradient-to-br ${accentClasses}`} />

      {/* Trend badge */}
      <div className="absolute top-3 right-3">
        {(() => {
          const t = typeof trend === 'number' && Number.isFinite(trend) ? trend : 0
          const positive = t > 0
          const negative = t < 0
          const cls = positive
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : negative
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-gray-50 text-gray-600 border-gray-200'
          const arrow = positive ? '▲' : negative ? '▼' : '▲'
          const label = `${Math.abs(Math.round(t))}%`
          return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`} title={`Change vs previous period`}>
              <span className="text-[10px] leading-none">{arrow}</span>
              {label}
            </span>
          )
        })()}
      </div>

      <div className="p-5">
        <div className="flex items-center gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${accentClasses} text-white flex items-center justify-center text-2xl shadow-soft ring-1 ring-white/30`}>
            <span className="leading-none">{displayIcon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-500">{title}</div>
            <div className="mt-0.5 text-[1.55rem] sm:text-2xl md:text-[1.6rem] font-extrabold tracking-tight text-gray-900 truncate whitespace-nowrap">{formatter(displayValue)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
