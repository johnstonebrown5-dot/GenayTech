import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import Modal from '../components/Modal'

export default function SuperAdminDemoRequests(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('pending')

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectItem, setRejectItem] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchItems = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/auth/superadmin/demo-requests/', {
        params: {
          status: status || undefined,
          q: q || undefined,
        },
      })
      setItems(Array.isArray(res.data?.results) ? res.data.results : [])
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load demo requests')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [status])

  const filtered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase()
    if (!s) return items
    return items.filter(r => {
      const hay = `${r?.school_name || ''} ${r?.admin_email || ''} ${r?.domain || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [items, q])

  const approve = async (r) => {
    if (!r?.id) return
    const ok = window.confirm(`Approve demo request for "${r?.school_name || r.id}" (${r?.admin_email || ''})?`)
    if (!ok) return
    setError('')
    try {
      await api.post(`/auth/superadmin/demo-requests/${r.id}/approve/`, {})
      await fetchItems()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to approve')
    }
  }

  const openReject = (r) => {
    setRejectItem(r)
    setRejectReason('')
    setRejectOpen(true)
  }

  const reject = async () => {
    if (!rejectItem?.id) return
    setError('')
    try {
      await api.post(`/auth/superadmin/demo-requests/${rejectItem.id}/reject/`, { reason: rejectReason })
      setRejectOpen(false)
      setRejectItem(null)
      setRejectReason('')
      await fetchItems()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to reject')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Demo Requests</h1>
          <div className="mt-1 text-sm text-gray-600">Approve or reject pending demo requests. Approval sends a verification email.</div>
        </div>
        <button onClick={fetchItems} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm">Refresh</button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by school, email or domain" className="w-full md:w-96 rounded-lg border border-gray-300 px-3 py-2" />
        <select value={status} onChange={(e)=>setStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="">all</option>
        </select>
      </div>

      <div className="mt-4 rounded-2xl bg-white border overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">School</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Domain</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6 text-gray-600" colSpan={7}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-4 py-6 text-gray-600" colSpan={7}>No demo requests found</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 text-gray-900">{r.id}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{r.school_name}</td>
                  <td className="px-4 py-3 text-gray-700">{r.admin_email}</td>
                  <td className="px-4 py-3 text-gray-700">{r.domain || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.status}</td>
                  <td className="px-4 py-3 text-gray-700">{r.created_at ? String(r.created_at).slice(0, 19).replace('T',' ') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === 'pending' ? (
                        <>
                          <button onClick={() => approve(r)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Approve</button>
                          <button onClick={() => openReject(r)} className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Reject</button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject demo request" size="lg">
        <div className="text-sm text-gray-700">
          {rejectItem ? `${rejectItem.school_name} (${rejectItem.admin_email})` : ''}
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium text-gray-700">Reason (optional)</label>
          <textarea value={rejectReason} onChange={(e)=>setRejectReason(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setRejectOpen(false)} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">Cancel</button>
          <button onClick={reject} className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700">Reject</button>
        </div>
      </Modal>
    </div>
  )
}
