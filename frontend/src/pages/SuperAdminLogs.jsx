import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

function fmtDt(v){
  try{
    if (!v) return '—'
    const s = String(v)
    return s.replace('T', ' ').slice(0, 19)
  }catch{
    return '—'
  }
}

export default function SuperAdminLogs(){
  const [tab, setTab] = useState('delivery') // delivery | health
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [okFilter, setOkFilter] = useState('') // '' | 'true' | 'false'
  const [schoolId, setSchoolId] = useState('')

  const [channel, setChannel] = useState('') // sms|email
  const [component, setComponent] = useState('')

  const [page, setPage] = useState(1)
  const pageSize = 50

  const endpoint = tab === 'health'
    ? '/auth/superadmin/logs/system-health/'
    : '/auth/superadmin/logs/delivery/'

  const fetchRows = async () => {
    setLoading(true)
    setError('')
    try{
      const params = {
        page,
        page_size: pageSize,
        q: q || undefined,
        ok: okFilter || undefined,
        school_id: schoolId || undefined,
      }
      if (tab === 'delivery') {
        params.channel = channel || undefined
      } else {
        params.component = component || undefined
      }
      const res = await api.get(endpoint, { params })
      const data = res?.data || {}
      setRows(Array.isArray(data?.results) ? data.results : [])
      setCount(Number(data?.count || 0))
    }catch(e){
      setRows([])
      setCount(0)
      setError(e?.response?.data?.detail || 'Failed to load logs')
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [tab])

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page])

  const canPrev = page > 1
  const canNext = useMemo(() => {
    return page * pageSize < count
  }, [page, pageSize, count])

  const applyFilters = () => {
    setPage(1)
    fetchRows()
  }

  const title = tab === 'health' ? 'System Health Events' : 'Delivery Logs'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">System Logs</h1>
          <div className="mt-1 text-sm text-gray-600">View system-wide logs across all schools.</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRows} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm">Refresh</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
        <button
          onClick={() => setTab('delivery')}
          className={`px-3 py-2 rounded-xl text-sm font-semibold border ${tab === 'delivery' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
        >
          Delivery Logs
        </button>
        <button
          onClick={() => setTab('health')}
          className={`px-3 py-2 rounded-xl text-sm font-semibold border ${tab === 'health' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
        >
          System Health
        </button>
        <div className="sm:ml-auto text-sm text-gray-600">{title}</div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
      )}

      <div className="rounded-2xl bg-white border border-gray-200 p-4">
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label className="text-xs font-semibold text-gray-700">Search</label>
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="recipient, message, context, school..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-700">OK</label>
            <select value={okFilter} onChange={(e)=>setOkFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">all</option>
              <option value="true">ok</option>
              <option value="false">failed</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-700">School ID</label>
            <input
              value={schoolId}
              onChange={(e)=>setSchoolId(e.target.value)}
              placeholder="e.g. 12"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {tab === 'delivery' ? (
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-700">Channel</label>
              <select value={channel} onChange={(e)=>setChannel(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">all</option>
                <option value="sms">sms</option>
                <option value="email">email</option>
              </select>
            </div>
          ) : (
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-700">Component</label>
              <select value={component} onChange={(e)=>setComponent(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">all</option>
                <option value="login">login</option>
                <option value="sms">sms</option>
                <option value="email">email</option>
                <option value="queries">queries</option>
                <option value="payment_mpesa">payment_mpesa</option>
                <option value="payment_bank">payment_bank</option>
              </select>
            </div>
          )}

          <div className="md:col-span-2 flex items-end justify-end gap-2">
            <button onClick={applyFilters} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Apply</button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <div className="overflow-auto">
          {tab === 'delivery' ? (
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">School</th>
                  <th className="text-left px-4 py-3">Channel</th>
                  <th className="text-left px-4 py-3">Recipient</th>
                  <th className="text-left px-4 py-3">OK</th>
                  <th className="text-left px-4 py-3">Message</th>
                  <th className="text-left px-4 py-3">Context</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={7}>Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={7}>No logs found</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDt(r.created_at)}</td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium">{r.school_name || '—'}</div>
                      <div className="text-[11px] text-gray-500">{r.school_code ? `${r.school_code} · ` : ''}{r.school_id ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.channel}</td>
                    <td className="px-4 py-3 text-gray-700">{r.recipient}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${r.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{r.ok ? 'OK' : 'FAIL'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[360px] truncate" title={r.message_snippet || ''}>{r.message_snippet || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate" title={r.context || ''}>{r.context || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">School</th>
                  <th className="text-left px-4 py-3">Component</th>
                  <th className="text-left px-4 py-3">OK</th>
                  <th className="text-left px-4 py-3">Context</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={5}>Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={5}>No events found</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDt(r.created_at)}</td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium">{r.school_name || '—'}</div>
                      <div className="text-[11px] text-gray-500">{r.school_code ? `${r.school_code} · ` : ''}{r.school_id ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.component}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${r.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{r.ok ? 'OK' : 'FAIL'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[520px] truncate" title={r.context || ''}>{r.context || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-xs text-gray-600">{count ? `${count.toLocaleString()} total` : '—'}</div>
          <div className="flex items-center gap-2">
            <button
              disabled={!canPrev || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <div className="text-sm text-gray-700">Page {page}</div>
            <button
              disabled={!canNext || loading}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
