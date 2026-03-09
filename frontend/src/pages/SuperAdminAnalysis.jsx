import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)) }

function truncateLabel(v, max){
  try{
    const s = String(v ?? '')
    if (!max || s.length <= max) return s
    return s.slice(0, Math.max(0, max - 1)) + '…'
  }catch{
    return ''
  }
}

function fmtGb(n){
  const v = Number(n || 0)
  if (!Number.isFinite(v)) return '0 GB'
  return `${v.toFixed(v >= 10 ? 1 : 3)} GB`
}

function fmtDate(d){
  try{
    if (!d) return '—'
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return '—'
    return dt.toISOString().slice(0, 10)
  }catch{ return '—' }
}

function statusPillClass({ active, score }){
  if (!active) return 'bg-gray-100 text-gray-700 border-gray-200'
  if (score >= 85) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (score >= 70) return 'bg-sky-50 text-sky-800 border-sky-200'
  if (score >= 50) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-rose-50 text-rose-800 border-rose-200'
}

export default function SuperAdminAnalysis(){
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'health_score', dir: 'desc' })
  const [filter, setFilter] = useState('all')

  const isMobile = useMemo(() => {
    try{
      if (typeof window === 'undefined') return false
      return window.matchMedia('(max-width: 640px)').matches
    }catch{
      return false
    }
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try{
      const res = await api.get('/auth/superadmin/system-analysis/', { _skipGlobalLoading: true })
      setData(res?.data || null)
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to load system analysis')
      setData(null)
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const schoolsRaw = useMemo(() => Array.isArray(data?.schools) ? data.schools : [], [data])

  const schoolsFiltered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase()
    const base = !s ? schoolsRaw : schoolsRaw.filter(x => {
      const hay = `${x?.name || ''} ${x?.code || ''}`.toLowerCase()
      return hay.includes(s)
    })
    return base.filter((x) => {
      if (filter === 'all') return true
      const active = !!x?.is_active
      const score = Number(x?.health_score || 0)
      if (filter === 'inactive') return !active
      if (!active) return false
      if (filter === 'healthy') return score >= 85
      if (filter === 'attention') return score >= 70 && score < 85
      if (filter === 'warning') return score >= 50 && score < 70
      if (filter === 'critical') return score < 50
      return true
    })
  }, [schoolsRaw, q, filter])

  const schoolsSorted = useMemo(() => {
    const dir = sort?.dir === 'asc' ? 1 : -1
    const key = sort?.key || 'health_score'
    const get = (row) => {
      if (key === 'data_points') return Number(row?.storage?.data_points || 0)
      if (key === 'storage_gb') return Number(row?.storage?.estimated_db_gb || 0)
      if (key === 'students') return Number(row?.counts?.students || 0)
      if (key === 'teachers') return Number(row?.counts?.teachers || 0)
      if (key === 'classes') return Number(row?.counts?.classes || 0)
      if (key === 'invoices') return Number(row?.counts?.invoices || 0)
      if (key === 'payments') return Number(row?.counts?.payments || 0)
      if (key === 'events') return Number(row?.counts?.events || 0)
      if (key === 'fail_rate') return Number(row?.delivery?.fail_rate_pct || 0)
      if (key === 'days_since') return Number.isFinite(Number(row?.activity?.days_since_activity)) ? Number(row.activity.days_since_activity) : 999999
      if (key === 'latency') return Number(row?.performance?.avg_latency_ms || 0)
      if (key === 'health_score') return Number(row?.health_score || 0)
      if (key === 'active') return row?.is_active ? 1 : 0
      return String(row?.[key] ?? '')
    }
    const arr = [...schoolsFiltered]
    arr.sort((a,b)=>{
      const av = get(a)
      const bv = get(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
    return arr
  }, [schoolsFiltered, sort])

  const topForCharts = useMemo(() => {
    const arr = [...schoolsSorted]
    arr.sort((a,b)=>(Number(b?.storage?.estimated_db_gb||0)-Number(a?.storage?.estimated_db_gb||0)))
    return arr.slice(0, isMobile ? 8 : 12)
  }, [schoolsSorted, isMobile])

  const chartLabels = useMemo(() => topForCharts.map(s => s?.code || s?.name || String(s?.id)), [topForCharts])

  const healthScoreBar = useMemo(() => {
    const values = topForCharts.map(s => clamp(Number(s?.health_score || 0), 0, 100))
    return {
      labels: chartLabels,
      datasets: [
        {
          label: 'Health score',
          data: values,
          backgroundColor: values.map(v => v >= 85 ? 'rgba(16,185,129,0.75)' : v >= 70 ? 'rgba(14,165,233,0.75)' : v >= 50 ? 'rgba(245,158,11,0.75)' : 'rgba(244,63,94,0.75)')
        }
      ]
    }
  }, [chartLabels, topForCharts])

  const storageGbBar = useMemo(() => {
    const values = topForCharts.map(s => Number(s?.storage?.estimated_db_gb || 0))
    return {
      labels: chartLabels,
      datasets: [
        {
          label: 'Estimated DB (GB)',
          data: values,
          backgroundColor: 'rgba(79,70,229,0.75)'
        }
      ]
    }
  }, [chartLabels, topForCharts])

  const deliveryDonut = useMemo(() => {
    const total = schoolsSorted.reduce((acc, s) => acc + (Number(s?.delivery?.total || 0) || 0), 0)
    const failed = schoolsSorted.reduce((acc, s) => acc + (Number(s?.delivery?.failed || 0) || 0), 0)
    return {
      labels: ['Delivered', 'Failed'],
      datasets: [
        {
          data: [Math.max(0, total - failed), Math.max(0, failed)],
          backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(244,63,94,0.8)'],
          borderWidth: 0,
        }
      ]
    }
  }, [schoolsSorted])

  const totals = data?.totals || {}

  const countsByBucket = useMemo(() => {
    const rows = Array.isArray(schoolsRaw) ? schoolsRaw : []
    const out = { all: rows.length, healthy: 0, attention: 0, warning: 0, critical: 0, inactive: 0 }
    for (const r of rows) {
      const active = !!r?.is_active
      const score = Number(r?.health_score || 0)
      if (!active) { out.inactive++; continue }
      if (score >= 85) out.healthy++
      else if (score >= 70) out.attention++
      else if (score >= 50) out.warning++
      else out.critical++
    }
    return out
  }, [schoolsRaw])

  const StatCard = ({ label, value, hint, accent = 'from-indigo-500 to-purple-600' }) => {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
        <div className="p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">{label}</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">{value}</div>
          <div className="mt-1 text-[11px] text-gray-600">{hint}</div>
        </div>
      </div>
    )
  }

  const sortTh = (label, key) => {
    const active = sort?.key === key
    const dir = active ? sort?.dir : 'desc'
    const arrow = active ? (dir === 'asc' ? '↑' : '↓') : ''
    return (
      <button
        type="button"
        onClick={() => setSort(s => ({ key, dir: (s?.key === key && s?.dir === 'desc') ? 'asc' : 'desc' }))}
        className={`inline-flex items-center gap-1 ${active ? 'text-gray-900' : 'text-gray-600'} hover:text-gray-900`}
      >
        <span>{label}</span>
        <span className="text-[10px]">{arrow}</span>
      </button>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-700">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              System Analysis
            </div>
            <div className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">School health overview</div>
            <div className="mt-1 text-sm text-gray-600">Storage estimate, activity recency, delivery reliability and query latency.</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-3 py-2 shadow-sm">
              <span className="text-gray-400 text-sm">🔎</span>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search school name or code" className="bg-transparent outline-none text-sm w-56" />
            </div>
            <button type="button" onClick={fetchData} className="px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm hover:bg-indigo-700 shadow-sm">Refresh</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { k:'all', label:'All', cls:'border-gray-200 text-gray-700', count: countsByBucket.all },
            { k:'healthy', label:'Healthy', cls:'border-emerald-200 text-emerald-800 bg-emerald-50', count: countsByBucket.healthy },
            { k:'attention', label:'Needs attention', cls:'border-sky-200 text-sky-800 bg-sky-50', count: countsByBucket.attention },
            { k:'warning', label:'Warning', cls:'border-amber-200 text-amber-800 bg-amber-50', count: countsByBucket.warning },
            { k:'critical', label:'Critical', cls:'border-rose-200 text-rose-800 bg-rose-50', count: countsByBucket.critical },
            { k:'inactive', label:'Inactive', cls:'border-gray-200 text-gray-700 bg-gray-100', count: countsByBucket.inactive },
          ].map(b => (
            <button
              key={b.k}
              type="button"
              onClick={() => setFilter(b.k)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${b.cls} ${filter===b.k ? 'ring-2 ring-indigo-200' : 'hover:bg-white'} transition`}
            >
              <span>{b.label}</span>
              <span className="inline-flex items-center justify-center min-w-6 h-5 px-2 rounded-full bg-white/70 border border-black/5 text-[11px] font-bold">{b.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">{error}</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Schools" value={loading ? '—' : (totals?.schools ?? schoolsRaw.length ?? '—')} hint="Tenants in system" accent="from-indigo-500 to-purple-600" />
        <StatCard label="Total records" value={loading ? '—' : Number(totals?.data_points || 0).toLocaleString()} hint="Approximate record volume" accent="from-sky-500 to-indigo-600" />
        <StatCard label="Database size" value={loading ? '—' : fmtGb(totals?.db_size_gb || 0)} hint="Total DB (all schools)" accent="from-violet-500 to-fuchsia-600" />
        <StatCard label="Avg latency" value={loading ? '—' : `${Number(totals?.avg_latency_ms || 0).toFixed(1)} ms`} hint="Across sampled queries" accent="from-amber-500 to-orange-600" />
        <StatCard label="Generated" value={loading ? '—' : fmtDate(data?.generated_at)} hint="Server time" accent="from-emerald-500 to-teal-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-900">Top schools by data volume</div>
            <div className="text-xs text-gray-600">Health score</div>
          </div>
          <div className="mt-3 h-56 sm:h-64">
            <Bar
              data={healthScoreBar}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#6b7280', font: { size: isMobile ? 9 : 10 }, maxTicksLimit: isMobile ? 5 : 8 },
                  },
                  x: {
                    ticks: {
                      color: '#6b7280',
                      font: { size: isMobile ? 9 : 10 },
                      maxRotation: 0,
                      minRotation: 0,
                      autoSkip: true,
                      maxTicksLimit: isMobile ? 4 : 12,
                      callback: function(value){
                        try{
                          const label = this.getLabelForValue(value)
                          return truncateLabel(label, isMobile ? 6 : 10)
                        }catch{
                          return ''
                        }
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="font-semibold text-gray-900">Delivery health</div>
          <div className="mt-1 text-xs text-gray-600">All schools combined</div>
          <div className="mt-4 h-56 flex items-center justify-center">
            <div className="w-56">
              <Doughnut
                data={deliveryDonut}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom' } },
                  cutout: '70%',
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm lg:col-span-3">
          <div className="font-semibold text-gray-900">Estimated DB size per school (GB)</div>
          <div className="mt-3 h-56 sm:h-64">
            <Bar
              data={storageGbBar}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { color: '#6b7280', font: { size: isMobile ? 9 : 10 }, maxTicksLimit: isMobile ? 5 : 8 },
                  },
                  x: {
                    ticks: {
                      color: '#6b7280',
                      font: { size: isMobile ? 9 : 10 },
                      maxRotation: 0,
                      minRotation: 0,
                      autoSkip: true,
                      maxTicksLimit: isMobile ? 4 : 12,
                      callback: function(value){
                        try{
                          const label = this.getLabelForValue(value)
                          return truncateLabel(label, isMobile ? 6 : 10)
                        }catch{
                          return ''
                        }
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <div className="font-semibold text-gray-900">Per-school health</div>
            <div className="text-xs text-gray-600">Sort columns to find schools with data or performance issues</div>
          </div>
          <div className="text-xs text-gray-600">Rows: {schoolsSorted.length}</div>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="bg-white/70 backdrop-blur sticky top-0 z-10 text-gray-600 text-xs border-b">
              <tr>
                <th className="px-3 py-2 text-left">School</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">{sortTh('Active', 'active')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Health', 'health_score')}</th>
                <th className="px-3 py-2 text-left">{sortTh('DB (GB)', 'storage_gb')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Data points', 'data_points')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Students', 'students')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Teachers', 'teachers')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Invoices', 'invoices')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Payments', 'payments')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Fail %', 'fail_rate')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Days since', 'days_since')}</th>
                <th className="px-3 py-2 text-left">{sortTh('Latency', 'latency')}</th>
              </tr>
            </thead>
            <tbody>
              {schoolsSorted.map(s => {
                const score = Number(s?.health_score || 0)
                const active = !!s?.is_active
                const pill = statusPillClass({ active, score })
                return (
                  <tr key={s.id} className="border-t hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{s?.name || '—'}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{s?.code || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{active ? 'Yes' : 'No'}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${pill}`}>{active ? `${score.toFixed(1)}` : '0.0'}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{fmtGb(s?.storage?.estimated_db_gb || 0)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{Number(s?.storage?.data_points || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{Number(s?.counts?.students || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{Number(s?.counts?.teachers || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{Number(s?.counts?.invoices || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{Number(s?.counts?.payments || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-xs ${Number(s?.delivery?.fail_rate_pct || 0) >= 10 ? 'text-rose-700' : Number(s?.delivery?.fail_rate_pct || 0) >= 3 ? 'text-amber-700' : 'text-emerald-700'}`}>{Number(s?.delivery?.fail_rate_pct || 0).toFixed(2)}%</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{Number.isFinite(Number(s?.activity?.days_since_activity)) ? Number(s.activity.days_since_activity) : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{Number(s?.performance?.avg_latency_ms || 0).toFixed(1)} ms</td>
                  </tr>
                )
              })}
              {!loading && schoolsSorted.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-10 text-center text-gray-600">No schools found.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={13} className="px-3 py-10 text-center text-gray-600">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
