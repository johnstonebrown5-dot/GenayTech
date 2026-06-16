import React from 'react'

export function DonutChart({ percent, size = 120, label, sublabel }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const offset = c - (p / 100) * c

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2563eb"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{Math.round(p)}%</span>
        {sublabel && <span className="text-[10px] text-slate-500 font-medium">{sublabel}</span>}
      </div>
      </div>
      {label && <span className="mt-2 text-xs font-semibold text-slate-600">{label}</span>}
    </div>
  )
}

export function ProgressBar({ percent, color = 'bg-blue-500' }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${p}%` }} />
    </div>
  )
}

export function MiniLineChart({ data, height = 100, width = 280 }) {
  if (!data || data.length === 0) return null
  const padding = { top: 10, right: 10, bottom: 24, left: 10 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const ys = data.map(d => Number(d.avg || d.value || 0))
  const yMax = Math.max(100, Math.ceil(Math.max(...ys, 0) / 10) * 10)
  const xMax = Math.max(1, data.length - 1)
  const xScale = i => padding.left + (innerW * i / xMax)
  const yScale = v => padding.top + innerH - (innerH * v / yMax)
  const points = data.map((d, i) => `${xScale(i)},${yScale(Number(d.avg || d.value || 0))}`).join(' ')

  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={points} />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(Number(d.avg || d.value || 0))}
          r="3"
          fill="#2563eb"
        />
      ))}
      {data.map((d, i) => (
        <text key={`l-${i}`} x={xScale(i)} y={height - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {String(d.label || '').slice(0, 3)}
        </text>
      ))}
    </svg>
  )
}
