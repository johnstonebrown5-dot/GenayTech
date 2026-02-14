import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

import { Doughnut, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

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
  const components = analysis?.components || null

  const buckets = useMemo(() => {
    const out = { healthy: 0, attention: 0, warning: 0, critical: 0, inactive: 0 }
    for (const r of schools) {
      const active = !!r?.is_active
      const score = Number(r?.health_score || 0)
      if (!active) { out.inactive++; continue }
      if (score >= 85) out.healthy++
      else if (score >= 70) out.attention++
      else if (score >= 50) out.warning++
      else out.critical++
    }
    return out
  }, [schools])

  const componentSummary = useMemo(() => {
    const c = components || {}
    const windowDays = Number(c?.window_days || 30)
    const items = [
      { key: 'sms', label: 'SMS', failed: Number(c?.sms?.failed || 0), total: Number(c?.sms?.total || 0) },
      { key: 'email', label: 'Email', failed: Number(c?.email?.failed || 0), total: Number(c?.email?.total || 0) },
      { key: 'login', label: 'Login', failed: Number(c?.login?.failed || 0), total: Number(c?.login?.total || 0) },
      { key: 'queries', label: 'Queries', failed: Number(c?.queries?.failed || 0), total: Number(c?.queries?.total || 0) },
      { key: 'payment_mpesa', label: 'M-Pesa', failed: Number(c?.payment_mpesa?.failed || 0), total: Number(c?.payment_mpesa?.total || 0) },
      { key: 'payment_bank', label: 'Bank', failed: Number(c?.payment_bank?.failed || 0), total: Number(c?.payment_bank?.total || 0) },
    ]
    const top = [...items].sort((a,b)=> (b.failed - a.failed) || (b.total - a.total))[0] || null
    return { windowDays, items, top }
  }, [components])

  const componentFailuresBar = useMemo(() => {
    const labels = componentSummary.items.map(i => i.label)
    const values = componentSummary.items.map(i => i.failed)
    const colors = labels.map((_, idx) => {
      const v = values[idx] || 0
      if (v >= 20) return 'rgba(244,63,94,0.75)'
      if (v >= 5) return 'rgba(245,158,11,0.75)'
      return 'rgba(79,70,229,0.75)'
    })
    return {
      labels,
      datasets: [
        {
          label: 'Failed',
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    }
  }, [componentSummary])

  const healthDonut = useMemo(() => {
    return {
      labels: ['Healthy', 'Needs attention', 'Warning', 'Critical', 'Inactive'],
      datasets: [
        {
          data: [buckets.healthy, buckets.attention, buckets.warning, buckets.critical, buckets.inactive],
          backgroundColor: [
            'rgba(16,185,129,0.85)',
            'rgba(14,165,233,0.85)',
            'rgba(245,158,11,0.85)',
            'rgba(244,63,94,0.85)',
            'rgba(148,163,184,0.85)',
          ],
          borderWidth: 0,
        },
      ],
    }
  }, [buckets])

  const topByStorage = useMemo(() => {
    const arr = [...schools]
    arr.sort((a,b) => (Number(b?.storage?.estimated_db_gb || 0) - Number(a?.storage?.estimated_db_gb || 0)))
    return arr.slice(0, 6)
  }, [schools])

  const storageBar = useMemo(() => {
    const labels = topByStorage.map(s => s?.code || s?.name || String(s?.id))
    const values = topByStorage.map(s => Number(s?.storage?.estimated_db_gb || 0))
    return {
      labels,
      datasets: [
        {
          label: 'Estimated DB (GB)',
          data: values,
          backgroundColor: 'rgba(79,70,229,0.75)',
        },
      ],
    }
  }, [topByStorage])

  const latencyBar = useMemo(() => {
    const arr = [...schools]
    arr.sort((a,b) => (Number(b?.performance?.avg_latency_ms || 0) - Number(a?.performance?.avg_latency_ms || 0)))
    const top = arr.slice(0, 6)
    const labels = top.map(s => s?.code || s?.name || String(s?.id))
    const values = top.map(s => Number(s?.performance?.avg_latency_ms || 0))
    return {
      labels,
      datasets: [
        {
          label: 'Avg latency (ms)',
          data: values,
          backgroundColor: values.map(v => v >= 25 ? 'rgba(244,63,94,0.75)' : v >= 10 ? 'rgba(245,158,11,0.75)' : 'rgba(16,185,129,0.75)'),
        },
      ],
    }
  }, [schools])

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-700">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              Super Admin
            </div>
            <div className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">System overview</div>
            <div className="mt-1 text-sm text-gray-600">Quick glance across tenant health, storage and performance.</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/superadmin/analysis" className="px-4 py-2 rounded-2xl border border-gray-200 bg-white text-sm hover:bg-gray-50">System Analysis</Link>
            <Link to="/superadmin/schools" className="px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm hover:bg-indigo-700 shadow-sm">Manage Schools</Link>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
          <div className="p-4">
            <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Schools</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">{stats.schools == null ? '—' : stats.schools}</div>
            <div className="mt-1 text-[11px] text-gray-600">All tenants in the system</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="p-4">
            <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Active students</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">{analysis ? Number(totals?.active_students || 0).toLocaleString() : '—'}</div>
            <div className="mt-1 text-[11px] text-gray-600">Across all schools</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-600" />
          <div className="p-4">
            <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Database size</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">{analysis ? `${Number(totals?.db_size_gb || 0).toFixed(3)} GB` : '—'}</div>
            <div className="mt-1 text-[11px] text-gray-600">Total DB (all schools)</div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-600" />
          <div className="p-4">
            <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Total records</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">{analysis ? Number(totals?.data_points || 0).toLocaleString() : '—'}</div>
            <div className="mt-1 text-[11px] text-gray-600">Approximate volume</div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <div className="p-4">
            <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Avg latency</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">{analysis ? `${Number(totals?.avg_latency_ms || 0).toFixed(1)} ms` : '—'}</div>
            <div className="mt-1 text-[11px] text-gray-600">Across sampled queries</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-fuchsia-600" />
          <div className="p-4">
            <div className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Most failing</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">
              {analysis ? (componentSummary?.top?.label || '—') : '—'}
            </div>
            <div className="mt-1 text-[11px] text-gray-600">
              {analysis ? (`${Number(componentSummary?.top?.failed || 0).toLocaleString()} failures (last ${componentSummary?.windowDays || 30}d)`) : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-900">Health distribution</div>
            <Link to="/superadmin/analysis" className="text-xs text-indigo-700 hover:underline">View details</Link>
          </div>
          <div className="mt-1 text-xs text-gray-600">All schools</div>
          <div className="mt-4 h-56 flex items-center justify-center">
            <div className="w-56">
              <Doughnut data={healthDonut} options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, cutout: '70%' }} />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm lg:col-span-2">
          <div className="font-semibold text-gray-900">Top schools by estimated DB size</div>
          <div className="mt-1 text-xs text-gray-600">Largest tenants (GB)</div>
          <div className="mt-3 h-64">
            <Bar data={storageBar} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: '#6b7280', font: { size: 10 } } }, x: { ticks: { color: '#6b7280', font: { size: 10 } } } } }} />
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm lg:col-span-3">
          <div className="font-semibold text-gray-900">Latency by school</div>
          <div className="mt-1 text-xs text-gray-600">Slowest schools by sampled query latency (ms)</div>
          <div className="mt-3 h-64">
            <Bar data={latencyBar} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: '#6b7280', font: { size: 10 } } }, x: { ticks: { color: '#6b7280', font: { size: 10 } } } } }} />
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-900">Component failures</div>
            <Link to="/superadmin/analysis" className="text-xs text-indigo-700 hover:underline">View details</Link>
          </div>
          <div className="mt-1 text-xs text-gray-600">Failures by subsystem (last {componentSummary?.windowDays || 30} days)</div>
          <div className="mt-3 h-64">
            <Bar
              data={componentFailuresBar}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const idx = ctx.dataIndex
                        const item = componentSummary.items[idx]
                        const failed = Number(item?.failed || 0)
                        const total = Number(item?.total || 0)
                        const rate = total ? ((failed / total) * 100).toFixed(1) : '0.0'
                        return `Failed: ${failed.toLocaleString()} / ${total.toLocaleString()} (${rate}%)`
                      },
                    },
                  },
                },
                scales: {
                  y: { beginAtZero: true, ticks: { color: '#6b7280', font: { size: 10 } } },
                  x: { ticks: { color: '#6b7280', font: { size: 10 } } },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-white border p-5">
        <div className="text-gray-900 font-semibold">Quick actions</div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/superadmin/schools" className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm">Schools</Link>
          <Link to="/superadmin/analysis" className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm">System Analysis</Link>
        </div>
      </div>
    </div>
  )
}
