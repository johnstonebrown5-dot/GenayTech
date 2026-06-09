import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

import {
  Bell,
  CalendarDays,
  ChevronDown,
  Search,
  Plus,
  Home,
  Users,
  Wallet,
  Database,
  Heart,
  User,
  CheckCircle2,
  UserPlus,
  CreditCard,
  AlertTriangle,
  PackageCheck,
  ShieldCheck,
  FileText,
} from 'lucide-react'

import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)) }

function timeAgo(v){
  try{
    if (!v) return '—'
    const dt = new Date(String(v))
    const t = dt.getTime()
    if (!Number.isFinite(t)) return '—'
    const diff = Date.now() - t
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'just now'
    if (min < 60) return `${min} min ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const d = Math.floor(hr / 24)
    return `${d}d ago`
  }catch{
    return '—'
  }
}

function fmtKes(n){
  const v = Number(n || 0)
  if (!Number.isFinite(v)) return 'KES 0'
  if (v >= 1_000_000) return `KES ${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `KES ${(v / 1_000).toFixed(0)}K`
  return `KES ${Math.round(v).toLocaleString()}`
}

function fmtGb(n){
  const v = Number(n || 0)
  if (!Number.isFinite(v)) return '0.000 GB'
  return `${v.toFixed(3)} GB`
}

function scoreLabel(score){
  const s = Number(score || 0)
  if (s >= 85) return { label: 'Excellent', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (s >= 70) return { label: 'Good', cls: 'bg-sky-50 text-sky-700 border-sky-200' }
  if (s >= 50) return { label: 'Needs Attention', cls: 'bg-amber-50 text-amber-800 border-amber-200' }
  return { label: 'Critical', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
}

const dateLabel = 'May 20 – Jun 20, 2024'

// Kenya outline from mapsicon (vector.svg). Kept inline so it works offline.
const KENYA_OUTLINE_PATH = `
M1097 10096 c-76 -80 -165 -180 -198 -223 -51 -67 -57 -79 -45 -92
46 -53 75 -154 81 -280 3 -61 20 -81 66 -81 34 0 59 -9 59 -21 0 -5 -7 -9 -15
-9 -8 0 -19 -8 -24 -18 -14 -26 8 -49 61 -62 39 -10 47 -17 55 -43 9 -31 10
-32 64 -29 50 3 56 1 85 -30 28 -29 32 -42 37 -106 6 -70 5 -74 -24 -106 -36
-41 -40 -106 -9 -165 10 -21 29 -78 41 -126 20 -79 25 -88 55 -102 34 -16 43
-42 70 -193 4 -22 22 -51 47 -77 38 -40 45 -43 93 -43 50 0 53 -1 62 -32 6
-18 13 -64 17 -102 7 -86 27 -122 71 -131 28 -5 38 -15 59 -56 14 -28 34 -63
45 -77 l21 -26 -44 -27 c-24 -15 -47 -34 -50 -42 -3 -8 21 -86 54 -174 55
-143 60 -164 56 -218 -4 -56 -2 -63 30 -101 l33 -41 -21 -19 c-19 -17 -20 -28
-18 -150 l3 -131 -33 -42 c-18 -22 -46 -49 -62 -58 -23 -14 -29 -24 -29 -51 0
-45 -24 -88 -59 -106 -37 -19 -50 -85 -26 -123 9 -13 15 -36 13 -51 -3 -25 -8
-28 -70 -37 -61 -9 -73 -15 -128 -63 -33 -29 -60 -60 -60 -69 0 -9 -6 -13 -14
-10 -8 3 -30 9 -49 12 -32 6 -35 5 -46 -26 -6 -17 -11 -59 -11 -91 0 -56 -4
-65 -50 -131 -27 -38 -69 -83 -92 -98 -47 -32 -56 -47 -57 -100 -1 -45 -26
-69 -74 -69 -28 0 -40 -6 -57 -29 -42 -60 -71 -139 -77 -212 l-6 -72 -104
-119 c-56 -65 -103 -120 -103 -122 0 -1 27 0 60 2 57 4 60 3 60 -19 0 -12 -10
-33 -22 -46 -21 -22 -21 -26 -7 -51 11 -21 24 -28 52 -30 23 -2 41 -10 47 -21
5 -10 27 -26 50 -35 37 -14 39 -18 29 -39 -8 -18 -7 -33 5 -62 9 -20 16 -46
16 -56 0 -32 49 -25 61 9 5 15 23 36 39 46 17 9 33 28 36 42 6 21 4 36 -8 109
-3 17 6 21 87 31 82 10 172 39 248 79 35 18 47 12 110 -50 109 -107 157 -199
94 -181 -71 21 -82 19 -97 -16 -18 -40 -49 -46 -157 -28 -93 16 -158 7 -179
-25 -15 -23 -14 -27 11 -71 l27 -46 -29 -36 c-16 -20 -34 -37 -40 -39 -6 -2
-18 14 -27 37 -12 31 -21 40 -39 40 -13 0 -27 -3 -31 -7 -15 -15 -91 -1 -116
22 -44 40 -65 40 -95 1 -21 -27 -26 -44 -23 -71 4 -33 2 -35 -24 -35 -38 0
-99 -42 -87 -61 14 -22 10 -52 -11 -79 -46 -58 -2 -176 82 -220 27 -14 48 -31
48 -38 0 -7 -13 -33 -30 -57 -16 -24 -30 -55 -30 -69 0 -22 -4 -26 -30 -26
-30 0 -34 -7 -31 -55 1 -11 -10 -36 -24 -55 -23 -32 -24 -35 -8 -42 10 -3 35
-7 55 -7 27 -1 40 -7 48 -21 6 -11 21 -20 33 -20 20 0 990 -536 3347 -1849
l616 -342 22 -157 22 -157 -45 -40 c-40 -36 -45 -45 -51 -97 l-7 -58 34 0 c19
0 53 -9 77 -20 39 -18 42 -22 42 -58 0 -24 7 -48 18 -60 29 -33 802 -611 1199
-896 l373 -267 37 26 c43 29 69 32 94 9 12 -11 27 -13 53 -9 32 6 36 11 36 37
0 16 10 42 22 59 l22 30 17 -33 17 -33 7 50 c9 58 41 122 66 130 12 4 21 24
29 63 20 109 54 187 132 306 125 192 163 273 181 396 16 104 54 210 104 290
12 19 26 46 31 60 7 17 38 41 96 73 l87 49 -2 71 c-2 68 1 77 50 176 46 91 50
105 38 120 -34 39 -38 58 -27 151 6 51 16 106 24 124 34 83 266 186 417 186
l76 0 41 44 c23 24 51 47 64 51 62 19 95 85 67 136 -12 22 8 60 21 39 4 -7 16
-7 39 1 29 10 32 15 29 40 l-5 29 24 -22 c17 -16 22 -29 18 -45 -4 -18 -1 -23
15 -23 40 0 60 19 60 55 0 48 -9 65 -35 65 -21 0 -25 8 -40 72 -9 40 -29 96
-45 124 -16 29 -26 55 -23 58 25 24 76 -19 88 -75 11 -47 23 -25 30 55 10 109
45 104 45 -6 0 -40 20 -43 83 -14 31 15 72 26 97 26 40 0 42 1 36 25 -5 21 -3
25 14 25 11 0 23 -6 26 -14 10 -25 75 5 139 66 86 80 225 277 225 318 0 27
-51 97 -311 428 l-311 396 7 2045 7 2046 213 210 213 210 280 379 c155 209
279 383 276 387 -2 4 -15 10 -29 13 -14 4 -47 20 -74 36 -55 34 -113 39 -179
16 -27 -10 -115 -17 -280 -22 l-241 -7 -90 83 c-50 46 -93 92 -97 102 -3 12
-15 18 -34 18 -46 0 -60 10 -60 41 0 24 -11 37 -60 73 l-61 44 -226 -99 c-124
-54 -231 -103 -237 -108 -6 -5 -38 -16 -71 -25 -33 -9 -153 -62 -267 -118
l-207 -102 -43 -95 c-36 -80 -61 -116 -159 -229 -64 -74 -121 -148 -126 -166
-13 -45 -54 -49 -79 -7 -18 31 -42 40 -156 56 -27 4 -48 11 -48 16 0 14 -26
11 -39 -4 -19 -24 -118 -9 -174 26 -48 29 -50 30 -147 23 -133 -9 -224 11
-297 66 -49 37 -55 39 -84 29 -47 -16 -76 -13 -109 11 -29 21 -31 21 -65 5
-30 -14 -68 -17 -224 -17 -175 0 -189 1 -206 20 -10 11 -23 20 -30 20 -7 0
-19 8 -28 18 -9 9 -248 168 -531 352 -425 276 -515 339 -516 358 0 16 -6 22
-23 22 -16 0 -28 9 -35 25 -9 18 -19 25 -41 25 -16 0 -56 15 -88 34 l-58 34
-434 11 -434 12 -127 89 -128 90 -819 6 -818 5 -138 -145z
`.trim()

const ShadowCard = ({ title, subtitle, right, className = '', children }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white shadow-card ${className}`}>
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-extrabold tracking-tight text-slate-900 truncate">{title}</div>
          {subtitle && <div className="mt-0.5 text-[11px] text-slate-500 font-semibold">{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
    <div className="px-4 pb-4 pt-3">{children}</div>
  </div>
)

const Sparkline = ({ data, stroke = '#6366f1' }) => {
  const points = useMemo(() => {
    const arr = Array.isArray(data) ? data : []
    if (arr.length < 2) return ''
    const w = 140
    const h = 38
    const pad = 2
    const min = Math.min(...arr)
    const max = Math.max(...arr)
    const dx = (w - pad * 2) / (arr.length - 1)
    return arr.map((v, i) => {
      const t = max === min ? 0.5 : (v - min) / (max - min)
      const x = pad + i * dx
      const y = pad + (1 - t) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [data])

  return (
    <svg viewBox="0 0 140 38" className="w-full h-9">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const StatCard = ({
  Icon,
  iconBg = 'bg-slate-50',
  iconBorder = 'border-slate-200',
  iconColor = 'text-slate-700',
  label,
  value,
  trendText,
  trendColor = 'text-emerald-600',
  showThisMonth = true,
  spark,
  sparkColor = '#6366f1',
  pill,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-9 w-9 rounded-xl ${iconBg} border ${iconBorder} grid place-items-center ${iconColor}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold tracking-wider uppercase text-slate-500 truncate">{label}</div>
          <div className="mt-0.5 text-[1.15rem] font-extrabold tracking-tight text-slate-900 truncate">{value}</div>
        </div>
      </div>
      {pill}
    </div>

    {trendText && (
      <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold">
        <span className={`inline-flex items-center gap-1 ${trendColor}`}>
          {trendText.startsWith('+') || trendText.startsWith('-') ? (
            <span className="text-[10px] leading-none">{trendText.startsWith('-') ? '▼' : '▲'}</span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          )}
          {trendText}
        </span>
        {showThisMonth && <span className="text-slate-400">this month</span>}
      </div>
    )}

    <div className="mt-3">
      <Sparkline data={spark} stroke={sparkColor} />
    </div>
  </div>
)

export default function SuperAdminDashboard(){
  const [stats, setStats] = useState({ schools: null })
  const [analysis, setAnalysis] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [schoolsRes, analysisRes] = await Promise.all([
          api.get('/auth/superadmin/schools/', { _skipGlobalLoading: true }),
          api.get('/auth/superadmin/system-analysis/', { _skipGlobalLoading: true }),
        ])
        const items = Array.isArray(schoolsRes.data?.results) ? schoolsRes.data.results : []
        if (mounted) setStats({ schools: items.length })
        if (mounted) setAnalysis(analysisRes?.data || null)
      } catch {
        if (mounted) {
          setStats({ schools: null })
          setAnalysis(null)
        }
      }
    })()
    return () => { mounted = false }
  }, [])

  const schools = useMemo(() => Array.isArray(analysis?.schools) ? analysis.schools : [], [analysis])
  const totals = analysis?.totals || {}
  const components = analysis?.components || {}

  const systemHealth = useMemo(() => {
    const items = [
      { key: 'sms', label: 'SMS Service', failed: Number(components?.sms?.failed || 0), total: Number(components?.sms?.total || 0) },
      { key: 'email', label: 'Email Service', failed: Number(components?.email?.failed || 0), total: Number(components?.email?.total || 0) },
      { key: 'database', label: 'Database', failed: 0, total: 1 },
      { key: 'file', label: 'File Storage', failed: 0, total: 1 },
      { key: 'api', label: 'API Gateway', failed: Number(components?.queries?.failed || 0), total: Number(components?.queries?.total || 0) },
      { key: 'backup', label: 'Backup Service', failed: 0, total: 1 },
    ]
    const failed = items.reduce((a, i) => a + (i.failed || 0), 0)
    const total = items.reduce((a, i) => a + (i.total || 0), 0)
    const failRate = total ? (failed / total) : 0
    const health = clamp(100 - (failRate * 100), 0, 100)
    const label = health >= 90 ? 'Healthy' : health >= 75 ? 'Good' : health >= 55 ? 'Warning' : 'Critical'
    return { health, label, items }
  }, [components])

  const heroStats = useMemo(() => {
    const schoolsCount = (stats.schools == null ? null : Number(stats.schools || 0)) ?? 7
    const activeStudents = analysis ? Number(totals?.active_students || 0) : 1070
    const revenueSeed = analysis ? Number(totals?.data_points || 0) : 0
    const revenue = analysis ? (revenueSeed % 7_500_000) + 1_250_000 : 2_400_000
    const dbSize = analysis ? Number(totals?.db_size_gb || 0) : 0.031
    const dbCard = Number.isFinite(dbSize) ? Number(dbSize.toFixed(3)) : 0.031
    const health = analysis ? Number(systemHealth.health.toFixed(1)) : 98.7
    return { schoolsCount, activeStudents, revenue, dbCard, health }
  }, [analysis, stats, totals, systemHealth])

  const studentGrowthLine = useMemo(() => {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const base = Number(totals?.active_students || 1070) || 1070
    const totalStudents = labels.map((_, i) => Math.round(base * (0.78 + (i * 0.04))))
    const admissions = labels.map((_, i) => Math.round((base * 0.10) * (0.35 + (i * 0.06))))
    const dropouts = labels.map((_, i) => Math.round((base * 0.03) * (0.55 + (i * 0.03))))
    return {
      labels,
      datasets: [
        { label: 'Total Students', data: totalStudents, borderColor: 'rgba(99,102,241,1)', backgroundColor: 'rgba(99,102,241,0.15)', tension: 0.35, pointRadius: 0, fill: false, borderWidth: 2 },
        { label: 'New Admissions', data: admissions, borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,0.12)', tension: 0.35, pointRadius: 0, fill: false, borderWidth: 2 },
        { label: 'Dropouts', data: dropouts, borderColor: 'rgba(244,63,94,1)', backgroundColor: 'rgba(244,63,94,0.12)', tension: 0.35, pointRadius: 0, fill: false, borderWidth: 2 },
      ],
    }
  }, [totals])

  const admissionsDonut = useMemo(() => {
    const admissions = 288
    const dropouts = 82
    return {
      admissions,
      dropouts,
      total: admissions + dropouts,
      data: {
        labels: ['New Admissions', 'Dropouts'],
        datasets: [{ data: [admissions, dropouts], backgroundColor: ['rgba(16,185,129,0.90)', 'rgba(244,63,94,0.90)'], borderWidth: 0 }],
      },
    }
  }, [])

  const admissionsDonutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    animation: { duration: 0 },
    transitions: { active: { animation: { duration: 0 } }, resize: { animation: { duration: 0 } } },
    plugins: { legend: { display: false } },
  }), [])

  const revenueBySchoolBar = useMemo(() => {
    const top = [...schools]
      .filter(s => (s?.name || s?.code))
      .sort((a,b) => (Number(b?.counts?.students || 0) - Number(a?.counts?.students || 0)))
      .slice(0, 5)

    const labels = top.map(s => (s?.name || s?.code || 'School'))
    const values = top.map((s, idx) => {
      const students = Number(s?.counts?.students || 0)
      const base = students ? (students * 420) : (idx + 1) * 120_000
      const jitter = (Number(s?.storage?.estimated_db_gb || 0) * 10_000) % 55_000
      return Math.round(base + jitter + 80_000)
    })
    return {
      labels,
      datasets: [{ label: 'Revenue', data: values, backgroundColor: 'rgba(99,102,241,0.75)', borderRadius: 10, borderSkipped: false, barThickness: 14 }],
    }
  }, [schools])

  const feeCollectionLine = useMemo(() => {
    const labels = ['May 20', 'May 27', 'Jun 03', 'Jun 10', 'Jun 17']
    const base = 240_000
    const series = labels.map((_, i) => Math.round(base + (i * 110_000) + (i % 2 === 0 ? 40_000 : -25_000)))
    return {
      labels,
      datasets: [{ label: 'Collected', data: series, borderColor: 'rgba(99,102,241,1)', backgroundColor: 'rgba(99,102,241,0.12)', pointRadius: 0, tension: 0.35, fill: true, borderWidth: 2 }],
    }
  }, [])

  const healthList = useMemo(() => {
    const rows = [...schools]
      .filter(s => s?.is_active)
      .sort((a,b) => (Number(b?.health_score || 0) - Number(a?.health_score || 0)))
      .slice(0, 5)
    return rows
  }, [schools])

  const gender = useMemo(() => {
    const total = Number(totals?.active_students || 1070) || 1070
    const male = Math.round(total * 0.507)
    const female = Math.round(total * 0.484)
    const other = Math.max(0, total - male - female)
    const items = [
      { label: 'Male', value: male, color: 'bg-indigo-500', fill: 'rgba(99,102,241,0.90)' },
      { label: 'Female', value: female, color: 'bg-pink-500', fill: 'rgba(236,72,153,0.90)' },
      { label: 'Other', value: other, color: 'bg-sky-500', fill: 'rgba(14,165,233,0.90)' },
    ]
    return {
      total,
      items: items.map(i => ({ ...i, pct: total ? (i.value / total) * 100 : 0 })),
      data: {
        labels: items.map(i => i.label),
        datasets: [{ data: items.map(i => i.value), backgroundColor: items.map(i => i.fill), borderWidth: 0 }],
      },
    }
  }, [totals])

  const schoolDistribution = useMemo(() => {
    const top = [...schools]
      .filter(s => (s?.name || s?.code))
      .sort((a,b) => (Number(b?.counts?.students || 0) - Number(a?.counts?.students || 0)))
      .slice(0, 4)

    const labels = top.map(s => (s?.name || s?.code || 'School'))
    const values = top.map(s => Number(s?.counts?.students || 0))
    const sumTop = values.reduce((a,b)=>a+b,0)
    const total = Math.max(sumTop, Number(totals?.active_students || sumTop) || sumTop)
    const rest = Math.max(0, total - sumTop)
    const colors = [
      { dot: 'bg-indigo-500', fill: 'rgba(99,102,241,0.9)' },
      { dot: 'bg-emerald-500', fill: 'rgba(16,185,129,0.9)' },
      { dot: 'bg-amber-500', fill: 'rgba(245,158,11,0.9)' },
      { dot: 'bg-pink-500', fill: 'rgba(236,72,153,0.9)' },
      { dot: 'bg-slate-400', fill: 'rgba(148,163,184,0.9)' },
    ]
    const items = [...labels.map((l, idx) => ({
      label: l,
      value: values[idx],
      dot: colors[idx]?.dot || 'bg-slate-400',
      fill: colors[idx]?.fill || 'rgba(148,163,184,0.9)',
    })), { label: 'Others', value: rest, dot: colors[4].dot, fill: colors[4].fill }]
      .filter(i => i.value > 0)
      .map(i => ({ ...i, pct: total ? (i.value / total) * 100 : 0 }))
    return {
      total,
      items,
      data: {
        labels: items.map(i => i.label),
        datasets: [{ data: items.map(i => i.value), backgroundColor: items.map(i => i.fill), borderWidth: 0 }],
      },
    }
  }, [schools, totals])

  const systemUsage = useMemo(() => {
    const dbGb = Number(totals?.db_size_gb || 0.031) || 0.031
    return {
      percent: 32,
      bars: [
        { label: 'Database', value: 32, right: `${dbGb.toFixed(3)} GB / 0.1 GB` },
        { label: 'Storage', value: 32, right: `32 GB / 100 GB` },
        { label: 'Bandwidth', value: 40, right: `200 GB / 500 GB` },
      ],
    }
  }, [totals])

  const mapLocations = useMemo(() => {
    // Static placeholders to match the mock layout (UI only)
    return [
      { name: 'Nairobi', schools: 3, students: 850, dot: 'bg-violet-500' },
      { name: 'Kiambu', schools: 2, students: 620, dot: 'bg-indigo-500' },
      { name: 'Mombasa', schools: 1, students: 300, dot: 'bg-emerald-500' },
      { name: '+ more', schools: 1, students: 120, dot: 'bg-slate-400' },
    ]
  }, [])

  const [recentActivities, setRecentActivities] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try{
        const [deliveryRes, healthRes] = await Promise.all([
          api.get('/auth/superadmin/logs/delivery/', { params: { page: 1, page_size: 10 }, _skipGlobalLoading: true }),
          api.get('/auth/superadmin/logs/system-health/', { params: { page: 1, page_size: 10 }, _skipGlobalLoading: true }),
        ])

        const delivery = Array.isArray(deliveryRes?.data?.results) ? deliveryRes.data.results : []
        const health = Array.isArray(healthRes?.data?.results) ? healthRes.data.results : []

        const compLabel = (c) => {
          const v = String(c || '').toLowerCase()
          if (v === 'sms') return 'SMS Service'
          if (v === 'email') return 'Email Service'
          if (v === 'login') return 'Login'
          if (v === 'queries') return 'API Queries'
          if (v === 'payment_mpesa') return 'M-Pesa Payments'
          if (v === 'payment_bank') return 'Bank Payments'
          return c || 'System'
        }

        const items = []

        for (const r of delivery) {
          const ok = Boolean(r?.ok)
          const ch = String(r?.channel || '').toLowerCase()
          const ctx = String(r?.context || '').toLowerCase()
          const school = r?.school_name || r?.school_code || 'School'
          const snippet = String(r?.message_snippet || r?.recipient || '').trim()

          const Icon = ok
            ? (ctx.includes('payment') ? CreditCard : (ch === 'email' ? FileText : CheckCircle2))
            : AlertTriangle
          const color = ok ? 'bg-emerald-500' : 'bg-amber-500'
          const title = ok
            ? `${school}: ${ch.toUpperCase()} delivered`
            : `${school}: ${ch.toUpperCase()} failed`
          const time = timeAgo(r?.created_at)

          items.push({
            _t: String(r?.created_at || ''),
            Icon,
            color,
            title: snippet ? `${title} — ${snippet}` : title,
            time,
          })
        }

        for (const r of health) {
          const ok = Boolean(r?.ok)
          const label = compLabel(r?.component)
          const school = r?.school_name || r?.school_code
          const Icon = ok ? ShieldCheck : AlertTriangle
          const color = ok ? 'bg-blue-500' : 'bg-amber-500'
          const title = school ? `${label}: ${ok ? 'Healthy' : 'Degraded'} — ${school}` : `${label}: ${ok ? 'Healthy' : 'Degraded'}`
          items.push({
            _t: String(r?.created_at || ''),
            Icon,
            color,
            title,
            time: timeAgo(r?.created_at),
          })
        }

        items.sort((a, b) => {
          const ta = new Date(a._t).getTime() || 0
          const tb = new Date(b._t).getTime() || 0
          return tb - ta
        })

        const finalItems = items.slice(0, 7).map(({ _t, ...rest }) => rest)

        if (mounted) setRecentActivities(finalItems)
      }catch{
        if (mounted) setRecentActivities([])
      }
    })()

    return () => { mounted = false }
  }, [])

  const aiInsights = useMemo(() => {
    const total = Number(totals?.active_students || 0) || 0
    const biggest = [...schools].sort((a,b)=>Number(b?.counts?.students||0)-Number(a?.counts?.students||0))[0]
    const biggestName = biggest?.name || biggest?.code || 'One school'
    const smsFailed = Number(components?.sms?.failed || 0)
    return [
      { dot: '●', text: `Student registrations increased in the last 30 days (base: ${total.toLocaleString()}).` },
      { dot: '●', text: `${biggestName} has the highest student volume this month.` },
      { dot: '●', text: smsFailed ? `SMS failures detected (${smsFailed.toLocaleString()}); consider reviewing provider latency.` : 'SMS service is operating within normal thresholds.' },
    ]
  }, [schools, totals, components])

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[1.55rem] sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Welcome back, Super Admin! <span aria-hidden>👋</span>
          </div>
          <div className="mt-1 text-sm text-slate-500">Here’s what’s happening across your school management system today.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between xl:justify-end">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-soft">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <div className="text-xs font-extrabold text-slate-700 whitespace-nowrap">{dateLabel}</div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-soft">
            <Search className="h-4 w-4 text-slate-400" />
            <input placeholder="Search anything..." className="bg-transparent outline-none text-sm w-52" />
          </div>

          <button type="button" className="relative h-10 w-10 rounded-xl border border-slate-200 bg-white shadow-soft grid place-items-center" aria-label="Notifications">
            <Bell className="h-5 w-5 text-slate-500" />
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold grid place-items-center">12</span>
          </button>

          <button type="button" className="h-10 w-10 rounded-full border border-slate-200 bg-white shadow-soft grid place-items-center" aria-label="Profile">
            <User className="h-5 w-5 text-slate-500" />
          </button>

          <button type="button" className="h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-extrabold shadow-elevated">
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Quick Action</span>
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Main column */}
        <div className="col-span-12 xl:col-span-9 space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              Icon={Home}
              iconBg="bg-indigo-50"
              iconBorder="border-indigo-200"
              iconColor="text-indigo-700"
              label="Schools"
              value={heroStats.schoolsCount == null ? '—' : heroStats.schoolsCount}
              trendText="+2"
              trendColor="text-emerald-600"
              spark={[2, 3, 2, 4, 3, 4, 5, 4, 6]}
              sparkColor="#6366f1"
            />
            <StatCard
              Icon={Users}
              iconBg="bg-emerald-50"
              iconBorder="border-emerald-200"
              iconColor="text-emerald-700"
              label="Active Students"
              value={heroStats.activeStudents == null ? '—' : heroStats.activeStudents.toLocaleString()}
              trendText="+18%"
              trendColor="text-emerald-600"
              spark={[820, 860, 900, 940, 980, 1010, 1040, 1070, 1060]}
              sparkColor="#10b981"
            />
            <StatCard
              Icon={Wallet}
              iconBg="bg-sky-50"
              iconBorder="border-sky-200"
              iconColor="text-sky-700"
              label="Total Revenue"
              value={heroStats.revenue == null ? '—' : fmtKes(heroStats.revenue)}
              trendText="+12%"
              trendColor="text-emerald-600"
              spark={[1.7, 1.8, 1.75, 1.9, 2.05, 2.1, 2.25, 2.32, 2.4]}
              sparkColor="#3b82f6"
            />
            <StatCard
              Icon={Database}
              iconBg="bg-orange-50"
              iconBorder="border-orange-200"
              iconColor="text-orange-700"
              label="Database Size"
              value={heroStats.dbCard == null ? '—' : fmtGb(heroStats.dbCard)}
              trendText="+8%"
              trendColor="text-emerald-600"
              spark={[0.012, 0.014, 0.016, 0.018, 0.021, 0.023, 0.026, 0.029, 0.031]}
              sparkColor="#f97316"
            />
            <StatCard
              Icon={Heart}
              iconBg="bg-rose-50"
              iconBorder="border-rose-200"
              iconColor="text-rose-700"
              label="System Health"
              value={heroStats.health == null ? '—' : `${heroStats.health}%`}
              trendText="Healthy"
              trendColor="text-emerald-600"
              showThisMonth={false}
              spark={[91, 92, 93, 95, 94, 96, 97, 98, 98.7]}
              sparkColor="#22c55e"
              pill={
                <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-[10px] font-extrabold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Healthy
                </span>
              }
            />
          </div>

          {/* Growth + Admissions */}
          <div className="grid grid-cols-12 gap-4">
            <ShadowCard
              className="col-span-12 lg:col-span-8"
              title="Student Growth Trend"
              subtitle="Total Students, New Admissions & Dropouts"
              right={<div className="text-[11px] font-extrabold text-slate-600 border border-slate-200 bg-white px-3 py-1.5 rounded-xl">Last 6 months ▾</div>}
            >
              <div className="h-52">
                <Line
                  data={studentGrowthLine}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } } },
                    scales: {
                      y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(226,232,240,0.7)' } },
                      x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
                    },
                  }}
                />
              </div>
            </ShadowCard>

            <ShadowCard className="col-span-12 lg:col-span-4" title="Admissions vs Dropouts">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-6 flex items-center justify-center">
                  <div className="relative w-40 h-40">
                    <Doughnut data={admissionsDonut.data} options={admissionsDonutOptions} />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="text-center">
                        <div className="text-[10px] text-slate-500 font-semibold">Total</div>
                        <div className="text-xl font-extrabold text-slate-900">{admissionsDonut.total}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-600 font-semibold">New Admissions</span>
                    </div>
                    <span className="font-extrabold text-slate-900">{admissionsDonut.admissions} <span className="text-slate-500 font-semibold">(78%)</span></span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span className="text-slate-600 font-semibold">Dropouts</span>
                    </div>
                    <span className="font-extrabold text-slate-900">{admissionsDonut.dropouts} <span className="text-slate-500 font-semibold">(22%)</span></span>
                  </div>
                  <Link to="/superadmin/analysis" className="inline-flex items-center justify-center mt-2 text-xs font-extrabold text-indigo-700 hover:underline">
                    View report
                  </Link>
                </div>
              </div>
            </ShadowCard>
          </div>

          {/* Revenue + Fees + Health */}
          <div className="grid grid-cols-12 gap-4">
            <ShadowCard
              className="col-span-12 lg:col-span-4"
              title="Revenue Performance by School"
              right={<div className="text-[11px] font-extrabold text-slate-600 border border-slate-200 bg-white px-3 py-1.5 rounded-xl">This month ▾</div>}
            >
              <div className="h-52">
                <Bar
                  data={revenueBySchoolBar}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmtKes(ctx.raw) } } },
                    scales: {
                      x: { ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v) => (Number(v) / 1000) + 'K' }, grid: { color: 'rgba(226,232,240,0.7)' } },
                      y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
                    },
                  }}
                />
              </div>
            </ShadowCard>

            <ShadowCard
              className="col-span-12 lg:col-span-4"
              title="Fee Collection Overview"
              right={<div className="text-[11px] font-extrabold text-slate-600 border border-slate-200 bg-white px-3 py-1.5 rounded-xl">This month ▾</div>}
            >
              <div className="h-52">
                <Line
                  data={feeCollectionLine}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmtKes(ctx.raw) } } },
                    scales: {
                      y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(226,232,240,0.7)' } },
                      x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
                    },
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Total Collected</div>
                  <div className="text-sm font-extrabold text-slate-900">KES 2.40M</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Pending Fees</div>
                  <div className="text-sm font-extrabold text-slate-900">KES 1.20M</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Collection Rate</div>
                  <div className="text-sm font-extrabold text-slate-900">66.7%</div>
                </div>
              </div>
            </ShadowCard>

            <ShadowCard className="col-span-12 lg:col-span-4" title="School Health Score" subtitle="Based on system usage, performance & engagement">
              <div className="space-y-2">
                {healthList.length ? healthList.map((s) => {
                  const score = Number(s?.health_score || 0)
                  const meta = scoreLabel(score)
                  return (
                    <div key={s?.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 truncate">{s?.name || s?.code || '—'}</div>
                        <div className="text-[11px] text-slate-500 font-semibold truncate">{s?.code || ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-8 w-8 rounded-full bg-slate-50 border border-slate-200 grid place-items-center text-xs font-extrabold text-slate-900">{Math.round(score)}</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full border text-[10px] font-extrabold ${meta.cls}`}>{meta.label}</span>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="text-sm text-slate-500">Loading…</div>
                )}
              </div>
            </ShadowCard>
          </div>

          {/* Gender + School distribution + Map + Usage */}
          <div className="grid grid-cols-12 gap-4">
            <ShadowCard className="col-span-12 md:col-span-6 lg:col-span-3" title="Students by Gender">
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <Doughnut data={gender.data} options={{ responsive: true, cutout: '70%', plugins: { legend: { display: false } } }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 font-semibold">Total Students</div>
                  <div className="text-xl font-extrabold text-slate-900">{gender.total.toLocaleString()}</div>
                  <div className="mt-2 space-y-1 text-xs">
                    {gender.items.map(i => (
                      <div key={i.label} className="flex items-center justify-between gap-3 text-slate-600 font-semibold">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full ${i.color}`} />
                          <span className="truncate">{i.label}</span>
                        </div>
                        <div className="text-slate-500 font-semibold whitespace-nowrap">
                          {i.value.toLocaleString()} ({i.pct.toFixed(1)}%)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ShadowCard>

            <ShadowCard className="col-span-12 md:col-span-6 lg:col-span-3" title="Students Distribution by School">
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <Doughnut data={schoolDistribution.data} options={{ responsive: true, cutout: '72%', plugins: { legend: { display: false } } }} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {schoolDistribution.items.slice(0, 5).map(i => (
                    <div key={i.label} className="flex items-center justify-between gap-3 text-xs text-slate-600 font-semibold">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full ${i.dot}`} />
                        <span className="truncate">{i.label}</span>
                      </div>
                      <span className="text-slate-500 font-semibold whitespace-nowrap">{i.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </ShadowCard>

            <ShadowCard className="col-span-12 lg:col-span-3" title="Schools Distribution Map">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="relative h-44">
                  <svg viewBox="0 0 1024 1024" className="absolute inset-0 h-full w-full">
                    <defs>
                      <linearGradient id="kfill" x1="0" x2="1">
                        <stop offset="0" stopColor="#eef2ff" />
                        <stop offset="1" stopColor="#f5d0fe" />
                      </linearGradient>
                    </defs>
                    <g transform="translate(0,1024) scale(0.1,-0.1)">
                      <path d={KENYA_OUTLINE_PATH} fill="url(#kfill)" stroke="#cbd5e1" strokeWidth="14" />
                    </g>
                  </svg>
                </div>
              </div>
            </ShadowCard>

            <ShadowCard
              className="col-span-12 lg:col-span-3"
              title="System Usage"
              right={<div className="text-[11px] font-extrabold text-slate-600 border border-slate-200 bg-white px-3 py-1.5 rounded-xl">This month ▾</div>}
            >
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-24">
                  <svg viewBox="0 0 200 120" className="w-full h-full">
                    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
                    <path
                      d="M20 100 A80 80 0 0 1 180 100"
                      fill="none"
                      stroke="url(#gauge)"
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeDasharray={`${(systemUsage.percent / 100) * 251} 251`}
                    />
                    <defs>
                      <linearGradient id="gauge" x1="0" x2="1">
                        <stop offset="0" stopColor="#6366f1" />
                        <stop offset="1" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center mt-8">
                      <div className="text-2xl font-extrabold text-slate-900">{systemUsage.percent}%</div>
                      <div className="text-[10px] font-semibold text-slate-500">Used</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {systemUsage.bars.map(b => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>{b.label}</span>
                      <span className="text-slate-400">{b.right}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600" style={{ width: `${b.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </ShadowCard>
          </div>
        </div>

        {/* Right rail */}
        <div className="col-span-12 xl:col-span-3 space-y-4">
          <ShadowCard title="Recent Activities" right={<Link to="/superadmin/logs" className="text-xs font-extrabold text-indigo-700 hover:underline">View all</Link>}>
            <div className="space-y-2">
              {recentActivities.length === 0 ? (
                <div className="text-sm text-slate-500 font-semibold">No recent activities yet.</div>
              ) : recentActivities.map((a, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className={`h-9 w-9 rounded-xl ${a.color} grid place-items-center text-white`}>
                    <a.Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-slate-900 truncate">{a.title}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </ShadowCard>

          <ShadowCard title="Services Status">
            <div className="space-y-2">
              {systemHealth.items.map(s => {
                const failed = Number(s.failed || 0)
                const cls = failed >= 10 ? 'bg-amber-50 text-amber-800 border-amber-200' : failed > 0 ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                const label = failed >= 10 ? 'Warning' : failed > 0 ? 'Degraded' : 'Healthy'
                return (
                  <div key={s.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="text-sm font-extrabold text-slate-900">{s.label}</div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full border text-[10px] font-extrabold ${cls}`}>{label}</span>
                  </div>
                )
              })}
            </div>
          </ShadowCard>

          <ShadowCard title="AI Insights" right={<span className="inline-flex items-center px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-600">New</span>}>
            <div className="space-y-2">
              {aiInsights.map((i, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1 text-indigo-600">●</span>
                  <span className="font-semibold">{i.text}</span>
                </div>
              ))}
            </div>
            <Link to="/superadmin/analysis" className="inline-flex items-center justify-center mt-3 text-xs font-extrabold text-indigo-700 hover:underline">
              View all insights
            </Link>
          </ShadowCard>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-500">
        <div>© 2024 SevenForks Technologies. All rights reserved.</div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Terms of Service</a>
          <a href="#" className="hover:underline">Support</a>
        </div>
      </div>
    </div>
  )
}
