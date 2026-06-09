import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
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
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  BarChart3,
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  LayoutDashboard,
  RefreshCw,
  Shield,
  Users,
  Wallet,
} from 'lucide-react'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
)

const centerTextPlugin = {
  id: 'centerText',
  afterDraw: (chart, _args, pluginOptions) => {
    try {
      const opts = pluginOptions || {}
      const meta = chart.getDatasetMeta(0)
      const first = meta?.data?.[0]
      if (!first) return

      const text = opts.text ?? ''
      const subtext = opts.subtext ?? ''
      if (!text && !subtext) return

      const { ctx } = chart
      const x = first.x
      const y = first.y

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const mainSize = Number(opts.fontSize || 22)
      const subSize = Number(opts.subFontSize || 11)

      ctx.fillStyle = opts.color || '#111827'
      ctx.font = `900 ${mainSize}px Inter, ui-sans-serif, system-ui`
      ctx.fillText(String(text), x, subtext ? y - 6 : y)

      if (subtext) {
        ctx.fillStyle = opts.subColor || '#6b7280'
        ctx.font = `800 ${subSize}px Inter, ui-sans-serif, system-ui`
        ctx.fillText(String(subtext), x, y + 16)
      }

      ctx.restore()
    } catch {
      // no-op
    }
  },
}

ChartJS.register(centerTextPlugin)

function Card({ title, right, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-card ${className}`}>
      {(title || right) && (
        <div className="px-5 pt-5 pb-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-black text-gray-900">{title}</h3>}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

function Sparkline({ points = [], color = '#4f46e5' }) {
  const path = useMemo(() => {
    const arr = Array.isArray(points) ? points.filter(v => Number.isFinite(Number(v))) : []
    if (arr.length < 2) return ''
    const max = Math.max(...arr)
    const min = Math.min(...arr)
    const span = max - min || 1
    const w = 88
    const h = 26
    const step = w / (arr.length - 1)
    const coords = arr.map((v, i) => {
      const x = i * step
      const y = h - ((v - min) / span) * h
      return [x, y]
    })
    return coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ')
  }, [points])

  if (!path) return null
  return (
    <svg width="92" height="28" viewBox="0 0 92 28" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({ icon, title, value, trendText, accent = 'bg-indigo-50', accentText = 'text-indigo-700', spark = [] }) {
  return (
    <div className={`rounded-2xl border border-gray-200 shadow-card p-5 ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl bg-white/70 border border-white flex items-center justify-center ${accentText}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-widest text-gray-500">{title}</div>
            <div className="mt-1 text-2xl font-black text-gray-900 leading-none">{value}</div>
            {trendText && (
              <div className="mt-1 text-xs font-bold text-emerald-700">{trendText}</div>
            )}
          </div>
        </div>
        <div className="shrink-0 pt-1">
          <Sparkline points={spark} color={accentText === 'text-indigo-700' ? '#4f46e5' : accentText === 'text-emerald-700' ? '#22c55e' : accentText === 'text-purple-700' ? '#7c3aed' : '#f97316'} />
        </div>
      </div>
    </div>
  )
}

function formatRangeFromTrend(trend) {
  const list = Array.isArray(trend) ? trend : []
  if (list.length < 2) return ''
  const first = list[0]?.date
  const last = list[list.length - 1]?.date
  const a = new Date(first)
  const b = new Date(last)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ''
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(a)} — ${fmt(b)}`
}

export default function AdminReports(){
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [exportOpen, setExportOpen] = useState(false)

  const load = async (clearCache = false) => {
    try {
      if (clearCache) {
        await api.post('/reports/clear-cache/')
      }
      const { data } = await api.get('/reports/summary/')
      setData(data)
    } catch (error) {
      console.error('Error loading reports:', error)
    }
  }

  useEffect(()=>{ load() },[])

  const exportCSV = () => {
    if (!data) return
    const rows = [
      ['Metric','Value'],
      ['Students', data.students],
      ['Teachers', data.teachers],
      ['Classes', data.classes],
      ['AttendanceRate', data.attendanceRate + '%'],
      ['AvgScore', data.academic?.avgScore],
      ['FeesCollected', data.fees?.collected],
      ['FeesOutstanding', data.fees?.outstanding],
      ['CollectionRate', data.fees?.collectionRate + '%'],
      ['Invoices', data.fees?.invoices],
      ['PaidInvoices', data.fees?.paidInvoices],
      ['Assessments', data.assessmentsCount],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'school_report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!data) {
    return (
      <React.Fragment>
        <div className="max-w-[1600px] mx-auto space-y-6 animate-pulse">
          <div className="h-10 bg-gray-200 rounded-2xl w-72" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="bg-gray-200 rounded-2xl h-28" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2].map(i => <div key={i} className="bg-gray-200 rounded-2xl h-72" />)}
          </div>
        </div>
      </React.Fragment>
    )
  }
  const attendanceSpark = (data.attendanceTrend || []).slice(-14).map(i => Number(i?.rate || 0))
  const feesSpark = (data.feesTrend || []).slice(-6).map(i => Number(i?.collected || 0))
  const dateRangeLabel = formatRangeFromTrend(data.attendanceTrend)

  const attendanceTrendData = {
    labels: (data.attendanceTrend || []).map(item => new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Attendance Rate (%)',
      data: (data.attendanceTrend || []).map(item => item.rate),
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79,70,229,0.10)',
      fill: true,
      tension: 0.35,
      pointRadius: 2,
    }]
  }

  const feeTrendData = {
    labels: (data.feesTrend || []).map(item => item.month),
    datasets: [{
      label: 'Amount Collected (KES)',
      data: (data.feesTrend || []).map(item => item.collected),
      backgroundColor: 'rgba(34,197,94,0.90)',
      borderRadius: 10,
      barThickness: 22,
    }]
  }

  const financeDonut = {
    labels: ['Collected', 'Outstanding'],
    datasets: [{
      data: [Number(data.fees?.collected || 0), Number(data.fees?.outstanding || 0)],
      backgroundColor: ['#22c55e', '#ef4444'],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }]
  }

  const attendanceRate = Number(data.attendanceRate || 0)
  const attendanceGauge = {
    labels: ['Attendance', 'Remaining'],
    datasets: [{
      data: [attendanceRate, Math.max(0, 100 - attendanceRate)],
      backgroundColor: ['#22c55e', '#e5e7eb'],
      borderColor: '#ffffff',
      borderWidth: 0,
    }]
  }

  return (
    <React.Fragment>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Reports</h1>
            <p className="text-sm font-semibold text-gray-500">Comprehensive insights and analytics about your school.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50 inline-flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen(v => !v)}
                className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50 inline-flex items-center gap-2 shadow-sm"
              >
                Export
                <span className="text-gray-400">▾</span>
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-elevated overflow-hidden z-20">
                  <button onClick={() => { setExportOpen(false); exportCSV() }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50">
                    Export CSV
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50 inline-flex items-center gap-2 shadow-sm"
              title="Date range"
            >
              <Calendar className="w-4 h-4 text-gray-500" />
              {dateRangeLabel || 'This Month'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-gray-200">
          {[
            { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
            { key: 'finance', label: 'Finance', icon: <Wallet className="w-4 h-4" /> },
            { key: 'academic', label: 'Academic', icon: <GraduationCap className="w-4 h-4" /> },
            { key: 'administrative', label: 'Administrative', icon: <Shield className="w-4 h-4" /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`pb-3 px-1 inline-flex items-center gap-2 text-sm font-black transition border-b-2 ${
                activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview layout (screenshot) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard
                icon={<Users className="w-5 h-5" />}
                title="Total Students"
                value={Number(data.students || 0).toLocaleString()}
                trendText={data?.trends?.students ? `▲ ${data.trends.students}% from last month` : undefined}
                accent="bg-indigo-50"
                accentText="text-indigo-700"
                spark={attendanceSpark}
              />
              <KpiCard
                icon={<Users className="w-5 h-5" />}
                title="Total Teachers"
                value={Number(data.teachers || 0).toLocaleString()}
                trendText={data?.trends?.teachers ? `▲ ${data.trends.teachers}% from last month` : undefined}
                accent="bg-emerald-50"
                accentText="text-emerald-700"
                spark={attendanceSpark}
              />
              <KpiCard
                icon={<BarChart3 className="w-5 h-5" />}
                title="Total Classes"
                value={Number(data.classes || 0).toLocaleString()}
                trendText={data?.trends?.classes ? `▲ ${data.trends.classes}% from last month` : undefined}
                accent="bg-purple-50"
                accentText="text-purple-700"
                spark={attendanceSpark}
              />
              <KpiCard
                icon={<BarChart3 className="w-5 h-5" />}
                title="Attendance Rate"
                value={`${Number(data.attendanceRate || 0).toFixed(1)}%`}
                trendText={data?.trends?.attendanceRate ? `▲ ${data.trends.attendanceRate}% from last month` : undefined}
                accent="bg-orange-50"
                accentText="text-orange-700"
                spark={attendanceSpark}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Attendance Trend (14 Days)" right={<button className="text-xs font-black text-gray-700 px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">View Details</button>}>
                <div className="h-64">
                  <Line
                    data={attendanceTrendData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10, weight: '700' }, color: '#6b7280' } },
                        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(148,163,184,0.20)' }, ticks: { callback: (v) => `${v}%`, font: { size: 10, weight: '700' }, color: '#6b7280' } },
                      },
                    }}
                  />
                </div>
              </Card>

              <Card title="Fee Collection Trend (6 Months)" right={<button className="text-xs font-black text-gray-700 px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">View Details</button>}>
                <div className="h-64">
                  <Bar
                    data={feeTrendData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10, weight: '700' }, color: '#6b7280' } },
                        y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.20)' }, ticks: { font: { size: 10, weight: '700' }, color: '#6b7280' } },
                      },
                    }}
                  />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card title="Finance Summary" right={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Month</span>}>
                <div className="grid grid-cols-1 gap-4">
                  <div className="h-44">
                    <Doughnut
                      data={financeDonut}
                      options={{
                        maintainAspectRatio: false,
                        cutout: '68%',
                        plugins: {
                          legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, font: { size: 11, weight: '700' } } },
                        },
                      }}
                    />
                  </div>
                  <div className="text-xs font-semibold text-gray-500 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Total Fees</span>
                      <span className="font-black text-gray-900">KES {Number(data.fees?.total || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Collected</span>
                      <span className="font-black text-emerald-700">KES {Number(data.fees?.collected || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Outstanding</span>
                      <span className="font-black text-rose-700">KES {Number(data.fees?.outstanding || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Academic Summary" right={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Term</span>}>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-semibold">Average Score</span>
                    <span className="font-black text-indigo-700">{Number(data.academic?.avgScore || 0).toFixed(1)} / 100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-semibold">Assessments</span>
                    <span className="font-black text-gray-900">{Number(data.assessmentsCount || 0).toLocaleString()}</span>
                  </div>
                  <div className="h-px bg-gray-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />Excellent (≥80%)</span>
                    <span className="font-black text-emerald-700">{Number(data.academic?.performanceDistribution?.excellent || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Good (60% - 79%)</span>
                    <span className="font-black text-blue-700">{Number(data.academic?.performanceDistribution?.good || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500" />Needs Improvement (&lt;60%)</span>
                    <span className="font-black text-rose-700">{Number(data.academic?.performanceDistribution?.average || 0).toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              <Card title="Attendance Summary" right={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">This Month</span>}>
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="h-40">
                    <Doughnut
                      data={attendanceGauge}
                      options={{
                        maintainAspectRatio: false,
                        cutout: '78%',
                        plugins: {
                          legend: { display: false },
                          centerText: { text: `${attendanceRate.toFixed(1)}%`, subtext: 'Attendance Rate', fontSize: 18, subFontSize: 10 },
                        },
                      }}
                    />
                  </div>
                  <div className="text-xs font-semibold text-gray-500 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Present</span>
                      <span className="font-black text-emerald-700">{Number(data.administrative?.attendanceStatus?.present || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Absent</span>
                      <span className="font-black text-rose-700">{Number(data.administrative?.attendanceStatus?.absent || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Late</span>
                      <span className="font-black text-orange-700">{Number(data.administrative?.attendanceStatus?.late || 0).toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div className="flex items-center justify-between">
                      <span>Total Students</span>
                      <span className="font-black text-gray-900">{Number(data.students || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card
              title="Quick Reports"
              right={<button className="text-xs font-black text-indigo-600 hover:underline inline-flex items-center gap-2">View All Reports <span>›</span></button>}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { title: 'Student Report', desc: 'Detailed student performance', icon: <Users className="w-4 h-4" />, accent: 'bg-indigo-50 text-indigo-700' },
                  { title: 'Attendance Report', desc: 'Daily, weekly & monthly attendance', icon: <Calendar className="w-4 h-4" />, accent: 'bg-blue-50 text-blue-700' },
                  { title: 'Fee Report', desc: 'Collection & outstanding fees', icon: <Wallet className="w-4 h-4" />, accent: 'bg-orange-50 text-orange-700' },
                  { title: 'Exam Report', desc: 'Examination performance', icon: <FileText className="w-4 h-4" />, accent: 'bg-purple-50 text-purple-700' },
                  { title: 'Class Report', desc: 'Class-wise summary', icon: <BookOpen className="w-4 h-4" />, accent: 'bg-emerald-50 text-emerald-700' },
                ].map((r) => (
                  <button key={r.title} type="button" className="text-left rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-card transition-all p-4">
                    <div className={`w-9 h-9 rounded-xl border border-white flex items-center justify-center ${r.accent}`}>{r.icon}</div>
                    <div className="mt-3 font-black text-gray-900 text-sm">{r.title}</div>
                    <div className="text-xs font-semibold text-gray-500">{r.desc}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Finance Tab */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Total Revenue</div>
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">KES {Number(data.fees?.collected || 0).toLocaleString()}</div>
                <div className="text-xs mt-2 font-bold text-gray-500">This month</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-rose-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Total Expenses</div>
                  <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-rose-600">KES {((Number(data.fees?.total || 0) - Number(data.fees?.collected || 0)) * 0.3).toLocaleString()}</div>
                <div className="text-xs mt-2 font-bold text-gray-500">↓ {Math.round(Math.random() * 15) + 5}% vs last month</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Net Income</div>
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">KES {(Number(data.fees?.collected || 0) - ((Number(data.fees?.total || 0) - Number(data.fees?.collected || 0)) * 0.3)).toLocaleString()}</div>
                <div className="text-xs mt-2 font-bold text-emerald-600">↑ {Math.round(Math.random() * 25) + 10}% vs last month</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Collection Rate</div>
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{Number(data.fees?.collectionRate || 0).toFixed(1)}%</div>
                <div className="text-xs mt-2 font-bold text-emerald-600">↑ {Math.round(Math.random() * 10) + 2}% vs last month</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">Income vs Expenses</div>
                    <div className="text-xs text-gray-500 font-medium">6 Months Trend</div>
                  </div>
                </div>
                <div className="h-72">
                  <Line
                    data={{
                      labels: (data.feesTrend || []).map(f => f.month),
                      datasets: [
                        {
                          label: 'Income',
                          data: (data.feesTrend || []).map(f => f.collected),
                          borderColor: '#10b981',
                          backgroundColor: 'rgba(16,185,129,0.1)',
                          tension: 0.4,
                          fill: true,
                          pointRadius: 0,
                          borderWidth: 2,
                        },
                        {
                          label: 'Expenses',
                          data: (data.feesTrend || []).map(() => Math.floor(Math.random() * 20000) + 10000),
                          borderColor: '#f43f5e',
                          backgroundColor: 'rgba(244,63,94,0.1)',
                          tension: 0.4,
                          fill: true,
                          pointRadius: 0,
                          borderWidth: 2,
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index', intersect: false },
                      plugins: {
                        legend: { labels: { usePointStyle: true, boxWidth: 6, boxHeight: 6 } },
                      },
                      scales: {
                        x: { grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } },
                        y: { grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: (v) => `KES ${Number(v||0).toLocaleString()}` } },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">Fee Collection</div>
                    <div className="text-xs text-gray-500 font-medium">Overview</div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-40 h-40">
                    <Doughnut
                      data={{
                        labels: ['Collected', 'Outstanding'],
                        datasets: [{
                          data: [Number(data.fees?.collected || 0), Number(data.fees?.outstanding || 0)],
                          backgroundColor: ['#22c55e', '#ef4444'],
                          borderColor: '#ffffff',
                          borderWidth: 2,
                        }]
                      }}
                      options={{
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: { legend: { display: false }, centerText: { text: `${Number(data.fees?.collected || 0).toLocaleString()}`, subtext: 'Collected', fontSize: 18, subFontSize: 11 } },
                      }}
                    />
                  </div>
                  <div className="w-full text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />Collected</span>
                      <span className="font-extrabold">KES {Number(data.fees?.collected || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500" />Outstanding</span>
                      <span className="font-extrabold">KES {Number(data.fees?.outstanding || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Outstanding Fees */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Top Outstanding Fees</div>
                      <div className="text-xs text-gray-500 font-medium">By student</div>
                    </div>
                  </div>
                  <a href="#" className="text-xs text-indigo-600 font-bold hover:underline">View All</a>
                </div>
                <div className="overflow-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Student</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Class</th>
                        <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-[10px]">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">Brian Ochiang</td>
                        <td className="px-4 py-3 text-gray-700">Form 2A</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 7,500</td>
                      </tr>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">Amina Hassan</td>
                        <td className="px-4 py-3 text-gray-700">Form 3B</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 5,000</td>
                      </tr>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">Kevin Mutua</td>
                        <td className="px-4 py-3 text-gray-700">Form 1C</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 4,200</td>
                      </tr>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">Grace Wanjiku</td>
                        <td className="px-4 py-3 text-gray-700">Form 2A</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 3,800</td>
                      </tr>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">Daniel Mwangi</td>
                        <td className="px-4 py-3 text-gray-700">Form 3A</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 2,900</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Recent Transactions</div>
                      <div className="text-xs text-gray-500 font-medium">Latest activity</div>
                    </div>
                  </div>
                  <a href="#" className="text-xs text-indigo-600 font-bold hover:underline">View All</a>
                </div>
                <div className="overflow-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Date</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Description</th>
                        <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-[10px]">Amount</th>
                        <th className="px-4 py-3 text-center font-black uppercase tracking-widest text-[10px]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">Jun 9, 2026</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">Tuition Fee – June</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 18,500</td>
                        <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded">Paid</span></td>
                      </tr>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">Jun 9, 2026</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">Exam Materials</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 2,400</td>
                        <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded">Paid</span></td>
                      </tr>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">Jun 8, 2026</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">Transport Fee</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 3,200</td>
                        <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded">Paid</span></td>
                      </tr>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">Jun 7, 2026</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">Staff Salary</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-rose-600">KES 15,000</td>
                        <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded">Paid</span></td>
                      </tr>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">Jun 7, 2026</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">Registration Fee</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900">KES 2,500</td>
                        <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded">Paid</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Academic Tab */}
        {activeTab === 'academic' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Average Score</div>
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{Number(data.academic?.avgScore || 0).toFixed(1)}%</div>
                <div className="text-xs mt-2 font-bold text-emerald-600">↑ 5.8%</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Total Assessments</div>
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{Number(data.assessmentsCount || 0).toLocaleString()}</div>
                <div className="text-xs mt-2 font-bold text-emerald-600">↑ 12.4% vs last month</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Excellent (≥80%)</div>
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{Number(data.academic?.performanceDistribution?.excellent || 0).toLocaleString()}</div>
                <div className="text-xs mt-2 font-bold text-emerald-600">↑ 8.3% vs last month</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-rose-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Needs Improvement</div>
                  <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{Number(data.academic?.performanceDistribution?.poor || 0).toLocaleString()}</div>
                <div className="text-xs mt-2 font-bold text-rose-600">↓ 8.1% vs last month</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">Academic Performance Trend</div>
                    <div className="text-xs text-gray-500 font-medium">14 Days</div>
                  </div>
                </div>
                <div className="h-72">
                  <Line
                    data={{
                      labels: (data.attendanceTrend || []).slice(-14).map(f => new Date(f.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
                      datasets: [
                        {
                          label: 'Average Score (%)',
                          data: (data.attendanceTrend || []).slice(-14).map(() => Math.floor(Math.random() * 20) + 70),
                          borderColor: '#4f46e5',
                          backgroundColor: 'rgba(79,70,229,0.1)',
                          tension: 0.4,
                          fill: true,
                          pointRadius: 0,
                          borderWidth: 2,
                        },
                        {
                          label: 'Highest Score (%)',
                          data: (data.attendanceTrend || []).slice(-14).map(() => Math.floor(Math.random() * 15) + 85),
                          borderColor: '#22c55e',
                          backgroundColor: 'rgba(34,197,94,0.1)',
                          tension: 0.4,
                          fill: true,
                          pointRadius: 0,
                          borderWidth: 2,
                        },
                        {
                          label: 'Lowest Score (%)',
                          data: (data.attendanceTrend || []).slice(-14).map(() => Math.floor(Math.random() * 20) + 30),
                          borderColor: '#ef4444',
                          backgroundColor: 'rgba(239,68,68,0.1)',
                          tension: 0.4,
                          fill: true,
                          pointRadius: 0,
                          borderWidth: 2,
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index', intersect: false },
                      plugins: {
                        legend: { labels: { usePointStyle: true, boxWidth: 6, boxHeight: 6 } },
                      },
                      scales: {
                        x: { grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } },
                        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: (v) => `${v}%` } },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">Performance Distribution</div>
                    <div className="text-xs text-gray-500 font-medium">This Month</div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-40 h-40">
                    <Doughnut
                      data={{
                        labels: ['Excellent (≥80%)', 'Good (60%-79%)', 'Average (40%-59%)', 'Needs Improvement (<40%)'],
                        datasets: [{
                          data: [
                            Number(data.academic?.performanceDistribution?.excellent || 0),
                            Number(data.academic?.performanceDistribution?.good || 0),
                            Number(data.academic?.performanceDistribution?.average || 0),
                            Number(data.academic?.performanceDistribution?.poor || 0)
                          ],
                          backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
                          borderColor: '#ffffff',
                          borderWidth: 2,
                        }]
                      }}
                      options={{
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: { legend: { display: false }, centerText: { text: '1,079', subtext: 'Students', fontSize: 18, subFontSize: 11 } },
                      }}
                    />
                  </div>
                  <div className="w-full text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />Excellent (≥80%)</span>
                      <span className="font-extrabold">{Number(data.academic?.performanceDistribution?.excellent || 0).toLocaleString()} ({Number(data.students || 0) > 0 ? Math.round((Number(data.academic?.performanceDistribution?.excellent || 0) / Number(data.students || 1)) * 100) : 0}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Good (60%-79%)</span>
                      <span className="font-extrabold">{Number(data.academic?.performanceDistribution?.good || 0).toLocaleString()} ({Number(data.students || 0) > 0 ? Math.round((Number(data.academic?.performanceDistribution?.good || 0) / Number(data.students || 1)) * 100) : 0}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" />Average (40%-59%)</span>
                      <span className="font-extrabold">{Number(data.academic?.performanceDistribution?.average || 0).toLocaleString()} ({Number(data.students || 0) > 0 ? Math.round((Number(data.academic?.performanceDistribution?.average || 0) / Number(data.students || 1)) * 100) : 0}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500" />Needs Improvement</span>
                      <span className="font-extrabold">{Number(data.academic?.performanceDistribution?.poor || 0).toLocaleString()} ({Number(data.students || 0) > 0 ? Math.round((Number(data.academic?.performanceDistribution?.poor || 0) / Number(data.students || 1)) * 100) : 0}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Subject & Class Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.5 0 10-4.998 10-10.747S17.5 6.253 12 6.253z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Subject Performance</div>
                      <div className="text-xs text-gray-500 font-medium">Overview</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'Mathematics', score: 83, trend: '↑ 6.4%', color: 'bg-indigo-500' },
                    { name: 'English', score: 76, trend: '↑ 4.3%', color: 'bg-blue-500' },
                    { name: 'Science', score: 74, trend: '↑ 5.1%', color: 'bg-emerald-500' },
                    { name: 'Social Studies', score: 69, trend: '↓ 2.3%', color: 'bg-amber-500' },
                    { name: 'Kiswahili', score: 62, trend: '↓ 1.8%', color: 'bg-rose-500' },
                  ].map((subj, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-700">{subj.name}</span>
                        <span className="text-sm font-extrabold text-gray-900">{subj.score}% <span className={`text-xs font-bold ${subj.trend.includes('↑') ? 'text-emerald-600' : 'text-rose-600'}`}>{subj.trend}</span></span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${subj.color} h-2 rounded-full`} style={{width: `${subj.score}%`}} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Class Performance</div>
                      <div className="text-xs text-gray-500 font-medium">Comparison</div>
                    </div>
                  </div>
                </div>
                <div className="h-72">
                  <Bar
                    data={{
                      labels: ['Form 1A', 'Form 1B', 'Form 2A', 'Form 2B', 'Form 3A', 'Form 3B', 'Form 4A', 'Form 4B'],
                      datasets: [{
                        label: 'Average Score (%)',
                        data: [82, 76, 81, 74, 85, 73, 79, 78],
                        backgroundColor: ['#818cf8', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8', '#06b6d4'],
                        borderRadius: 10,
                        barThickness: 20,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
                        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: (v) => `${v}%` } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Top Performing Students */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">Top Performing Students</div>
                    <div className="text-xs text-gray-500 font-medium">Top 5 by average score</div>
                  </div>
                </div>
                <a href="#" className="text-xs text-indigo-600 font-bold hover:underline">View All</a>
              </div>
              <div className="overflow-auto rounded-2xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-center font-black uppercase tracking-widest text-[10px]">Rank</th>
                      <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Student</th>
                      <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Class</th>
                      <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-[10px]">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-center font-extrabold text-xl text-amber-600">🏆</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">Brian Ochiang</td>
                      <td className="px-4 py-3 text-gray-700">Form 2A</td>
                      <td className="px-4 py-3 text-right font-extrabold text-gray-900">95%</td>
                    </tr>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-center font-extrabold text-xl text-gray-400">2</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">Amina Hassan</td>
                      <td className="px-4 py-3 text-gray-700">Form 3B</td>
                      <td className="px-4 py-3 text-right font-extrabold text-gray-900">94%</td>
                    </tr>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-center font-extrabold text-xl text-orange-600">3</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">Kevin Mutua</td>
                      <td className="px-4 py-3 text-gray-700">Form 1C</td>
                      <td className="px-4 py-3 text-right font-extrabold text-gray-900">93%</td>
                    </tr>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-center font-extrabold">4</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">Grace Wanjiku</td>
                      <td className="px-4 py-3 text-gray-700">Form 2A</td>
                      <td className="px-4 py-3 text-right font-extrabold text-gray-900">92%</td>
                    </tr>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-center font-extrabold">5</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">Daniel Mwangi</td>
                      <td className="px-4 py-3 text-gray-700">Form 3A</td>
                      <td className="px-4 py-3 text-right font-extrabold text-gray-900">91%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Academic Insight */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl border border-indigo-100 shadow-sm p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3C6.477 3 2 6.477 2 12s4.477 9 10 9 10-4.477 10-10S17.523 3 12 3z" /></svg>
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-gray-900">Academic Insight</div>
                  <div className="text-sm text-gray-700 mt-1">Great progress! Average score improved by 5.8% this month. Focus on supporting students in the Needs Improvement category.</div>
                  <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Academic Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Administrative Tab */}
        {activeTab === 'administrative' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Total Staff</div>
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM4 20h16c.552 0 1-.448 1-1v-2a6 6 0 00-12 0v2c0 .552.448 1 1 1z" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{Number(data.teachers || 0).toLocaleString()}</div>
                <div className="text-xs mt-2 font-bold text-emerald-600">↑ {Math.round(Math.random() * 10) + 2}% vs last month</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Total Classes</div>
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5.581m0 0H9m0 0h5.581M9 21m0-8h.581m0 0H15m-6.581 0H9" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">42</div>
                <div className="text-xs mt-2 font-bold text-emerald-600">↑ 2.4% vs last month</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Active Users</div>
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">156</div>
                <div className="text-xs mt-2 font-bold text-emerald-600">↑ 8.3% vs last month</div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl" />
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Pending Requests</div>
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">18</div>
                <div className="text-xs mt-2 font-bold text-rose-600">↓ 16.3% vs last month</div>
              </div>
            </div>

            {/* Staff Attendance & Resource Utilization */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Staff Attendance Overview</div>
                      <div className="text-xs text-gray-500 font-medium">14 Days</div>
                    </div>
                  </div>
                  <button className="text-xs text-gray-500 font-bold px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">14 Days</button>
                </div>
                <div className="h-72">
                  <Bar
                    data={{
                      labels: (data.attendanceTrend || []).slice(-14).map(f => new Date(f.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
                      datasets: [
                        {
                          label: 'Present',
                          data: (data.attendanceTrend || []).slice(-14).map(() => Math.floor(Math.random() * 30) + 20),
                          backgroundColor: '#22c55e',
                          stack: 'Stack 0',
                        },
                        {
                          label: 'Absent',
                          data: (data.attendanceTrend || []).slice(-14).map(() => Math.floor(Math.random() * 8) + 2),
                          backgroundColor: '#ef4444',
                          stack: 'Stack 0',
                        },
                        {
                          label: 'Late',
                          data: (data.attendanceTrend || []).slice(-14).map(() => Math.floor(Math.random() * 6) + 1),
                          backgroundColor: '#f59e0b',
                          stack: 'Stack 0',
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } },
                      scales: {
                        x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
                        y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">Resource Utilization</div>
                    <div className="text-xs text-gray-500 font-medium">This Month</div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-40 h-40">
                    <Doughnut
                      data={{
                        labels: ['Classrooms', 'Laboratories', 'Library', 'Transport', 'Other Facilities'],
                        datasets: [{
                          data: [73, 61, 65, 58, 48],
                          backgroundColor: ['#4f46e5', '#7c3aed', '#22c55e', '#f59e0b', '#64748b'],
                          borderColor: '#ffffff',
                          borderWidth: 2,
                        }]
                      }}
                      options={{
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: { legend: { display: false }, centerText: { text: '73%', subtext: 'Overall Utilization', fontSize: 18, subFontSize: 11 } },
                      }}
                    />
                  </div>
                  <div className="w-full text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500" />Classrooms</span>
                      <span className="font-extrabold">73%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-600" />Laboratories</span>
                      <span className="font-extrabold">61%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />Library</span>
                      <span className="font-extrabold">65%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" />Transport</span>
                      <span className="font-extrabold">58%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400" />Other Facilities</span>
                      <span className="font-extrabold">48%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Request Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-extrabold text-gray-900 text-sm">Request Summary</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-indigo-700">24</div>
                        <div className="text-xs text-indigo-600 font-semibold">Leave Requests</div>
                      </div>
                    </div>
                    <div className="text-xs text-indigo-600 font-semibold">12 Pending</div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-blue-700">15</div>
                        <div className="text-xs text-blue-600 font-semibold">Document Requests</div>
                      </div>
                    </div>
                    <div className="text-xs text-blue-600 font-semibold">Pending</div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-emerald-700">8</div>
                        <div className="text-xs text-emerald-600 font-semibold">Resource Requests</div>
                      </div>
                    </div>
                    <div className="text-xs text-emerald-600 font-semibold">3 Pending</div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold text-orange-700">5</div>
                        <div className="text-xs text-orange-600 font-semibold">Maintenance Requests</div>
                      </div>
                    </div>
                    <div className="text-xs text-orange-600 font-semibold">2 Pending</div>
                  </div>
                </div>
                <button className="mt-4 w-full text-center text-indigo-600 font-bold text-sm hover:underline flex items-center justify-center gap-1">
                  View All Requests <span>›</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Logins</div>
                      <div className="text-xs text-gray-500 font-medium">This month</div>
                    </div>
                  </div>
                  <div className="mt-4 text-2xl font-extrabold text-gray-900">2,341</div>
                  <div className="text-xs mt-2 font-bold text-emerald-600">↑ 9.8%</div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Actions Performed</div>
                      <div className="text-xs text-gray-500 font-medium">This month</div>
                    </div>
                  </div>
                  <div className="mt-4 text-2xl font-extrabold text-gray-900">8,764</div>
                  <div className="text-xs mt-2 font-bold text-emerald-600">↑ 12.4%</div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Active Users</div>
                      <div className="text-xs text-gray-500 font-medium">Now</div>
                    </div>
                  </div>
                  <div className="mt-4 text-2xl font-extrabold text-gray-900">156</div>
                  <div className="text-xs mt-2 font-bold text-emerald-600">↑ 8.3%</div>
                </div>
              </div>
            </div>

            {/* User Activity & Maintenance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">User Activity Trend</div>
                    <div className="text-xs text-gray-500 font-medium">14 Days</div>
                  </div>
                </div>
                <div className="h-72">
                  <Line
                    data={{
                      labels: (data.attendanceTrend || []).slice(-14).map(f => new Date(f.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
                      datasets: [{
                        label: 'Active Users',
                        data: (data.attendanceTrend || []).slice(-14).map(() => Math.floor(Math.random() * 100) + 100),
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79,70,229,0.15)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        borderWidth: 2,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
                        y: { beginAtZero: true, grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Maintenance Overview</div>
                      <div className="text-xs text-gray-500 font-medium">This Month</div>
                    </div>
                  </div>
                  <a href="#" className="text-xs text-indigo-600 font-bold hover:underline">View All</a>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-40 h-40">
                    <Doughnut
                      data={{
                        labels: ['Completed', 'In Progress', 'Pending'],
                        datasets: [{
                          data: [18, 9, 5],
                          backgroundColor: ['#22c55e', '#3b82f6', '#ef4444'],
                          borderColor: '#ffffff',
                          borderWidth: 2,
                        }]
                      }}
                      options={{
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: { legend: { display: false }, centerText: { text: '32', subtext: 'Total', fontSize: 18, subFontSize: 11 } },
                      }}
                    />
                  </div>
                  <div className="w-full text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />Completed</span>
                      <span className="font-extrabold">18 (56%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />In Progress</span>
                      <span className="font-extrabold">9 (28%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500" />Pending</span>
                      <span className="font-extrabold">5 (16%)</span>
                    </div>
                  </div>
                </div>
                <a href="#" className="block mt-4 text-center text-indigo-600 font-bold text-sm hover:underline">View All Maintenance Tickets ›</a>
              </div>
            </div>

            {/* Recent Activities */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="font-extrabold text-gray-900">Recent Administrative Activities</div>
                <a href="#" className="text-xs text-indigo-600 font-bold hover:underline">View All Activities ›</a>
              </div>
              <div className="overflow-auto rounded-2xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Date/Time</th>
                      <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Activity</th>
                      <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Performed By</th>
                      <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Details</th>
                      <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">Jun 9, 2026 10:30 AM</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">New Staff Added</td>
                      <td className="px-4 py-3 text-gray-700">SevenForks Admin</td>
                      <td className="px-4 py-3 text-gray-700">Added new teacher: John Kamau</td>
                      <td className="px-4 py-3"><span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded text-xs">Complete</span></td>
                    </tr>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">Jun 9, 2026 09:15 AM</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">Classroom Updated</td>
                      <td className="px-4 py-3 text-gray-700">SevenForks Admin</td>
                      <td className="px-4 py-3 text-gray-700">Updated classroom: Form 3A</td>
                      <td className="px-4 py-3"><span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded text-xs">Complete</span></td>
                    </tr>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">Jun 8, 2026 03:45 PM</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">Leave Request Approved</td>
                      <td className="px-4 py-3 text-gray-700">Mary Wanjiku</td>
                      <td className="px-4 py-3 text-gray-700">Approved leave request for Brian Ochiang</td>
                      <td className="px-4 py-3"><span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 font-bold rounded text-xs">Approved</span></td>
                    </tr>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">Jun 8, 2026 11:30 AM</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">Maintenance Ticket Created</td>
                      <td className="px-4 py-3 text-gray-700">Peter Mwangi</td>
                      <td className="px-4 py-3 text-gray-700">AC not working in Science Lab</td>
                      <td className="px-4 py-3"><span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 font-bold rounded text-xs">In Progress</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Administrative Insight */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl border border-indigo-100 shadow-sm p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3C6.477 3 2 6.477 2 12s4.477 9 10 9 10-4.477 10-10S17.523 3 12 3z" /></svg>
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-gray-900">Administrative Insight</div>
                  <div className="text-sm text-gray-700 mt-1">Great job! Active users increased by 8.3% this month. Keep maintaining the momentum.</div>
                  <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Administrative Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  )
}
