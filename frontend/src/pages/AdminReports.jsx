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

        {/* Keep other tabs as-is (basic fallback) */}
        {activeTab !== 'overview' && (
          <div className="text-sm text-gray-500 font-semibold">
            This section is being updated to match the new reports design.
          </div>
        )}
      </div>
    </React.Fragment>
  )
}
