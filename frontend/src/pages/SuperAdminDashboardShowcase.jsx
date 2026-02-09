import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { uploadToCloudinarySigned } from '../utils/cloudinary'
import { toast } from '../utils/toast'

export default function SuperAdminDashboardShowcase(){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState([])
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ title: '', description: '' })

  const canSubmit = useMemo(() => {
    return !!String(form.title || '').trim() && !!file && !saving
  }, [form.title, file, saving])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/auth/superadmin/dashboard-showcase/', { _skipGlobalLoading: true })
      const rows = Array.isArray(data?.results) ? data.results : []
      setItems(rows)
    } catch (e) {
      toast(e?.response?.data?.detail || 'Failed to load showcase', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const uploadAndCreate = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const sigRes = await api.post('/auth/superadmin/cloudinary/signature/', {
        folder: 'edu-track/dashboard-showcase',
        resource_type: 'image',
      })
      const payload = sigRes?.data
      const { url, public_id } = await uploadToCloudinarySigned(file, payload)

      const { data: created } = await api.post('/auth/superadmin/dashboard-showcase/', {
        title: String(form.title || '').trim(),
        description: String(form.description || '').trim(),
        image_url: url,
        public_id,
      })

      setItems((prev) => [...prev, created].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.id ?? 0) - (b.id ?? 0)))
      setForm({ title: '', description: '' })
      setFile(null)
      toast('Showcase item added', 'success')
    } catch (e) {
      toast(e?.response?.data?.detail || e?.message || 'Failed to add item', 'error')
    } finally {
      setSaving(false)
    }
  }

  const patchItem = async (id, patch) => {
    try {
      const { data } = await api.patch(`/auth/superadmin/dashboard-showcase/${id}/`, patch)
      setItems((prev) => prev.map((x) => (x.id === id ? data : x)))
      toast('Saved', 'success')
    } catch (e) {
      toast(e?.response?.data?.detail || 'Failed to save', 'error')
    }
  }

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this showcase item?')) return
    try {
      await api.delete(`/auth/superadmin/dashboard-showcase/${id}/`)
      setItems((prev) => prev.filter((x) => x.id !== id))
      toast('Deleted', 'success')
    } catch (e) {
      toast(e?.response?.data?.detail || 'Failed to delete', 'error')
    }
  }

  const reorder = async (next) => {
    setItems(next)
    try {
      const { data } = await api.post('/auth/superadmin/dashboard-showcase/reorder/', {
        order: next.map((x) => x.id),
      })
      const rows = Array.isArray(data?.results) ? data.results : []
      setItems(rows)
      toast('Reordered', 'success')
    } catch (e) {
      toast(e?.response?.data?.detail || 'Failed to reorder', 'error')
    }
  }

  const move = (idx, dir) => {
    const j = idx + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    const tmp = next[idx]
    next[idx] = next[j]
    next[j] = tmp
    reorder(next)
  }

  if (loading) return <div className="p-6">Loading…</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard Showcase</h1>
          <p className="text-sm text-slate-600 mt-1">Upload and manage dashboard screenshots shown in the app tour.</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm">
            <div className="font-semibold text-slate-700">Title</div>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g., Admin Dashboard"
            />
          </label>
          <label className="text-sm">
            <div className="font-semibold text-slate-700">Image</div>
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 bg-white"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <label className="text-sm md:col-span-2">
            <div className="font-semibold text-slate-700">Description</div>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[90px]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Explain what this dashboard helps users do…"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={uploadAndCreate}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${canSubmit ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            {saving ? 'Uploading…' : 'Add Item'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No showcase items yet.</div>
        ) : (
          items.map((x, idx) => (
            <div key={x.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="md:w-56">
                  <div className="aspect-[16/10] w-full rounded-xl bg-slate-50 overflow-hidden ring-1 ring-slate-200">
                    {x.image_url ? <img src={x.image_url} alt={x.title} className="h-full w-full object-cover" /> : null}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="text-sm">
                      <div className="font-semibold text-slate-700">Title</div>
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        value={x.title || ''}
                        onChange={(e) => setItems((prev) => prev.map((r) => (r.id === x.id ? { ...r, title: e.target.value } : r)))}
                      />
                    </label>
                    <div className="text-sm flex items-end gap-2">
                      <button type="button" onClick={() => move(idx, -1)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">↑</button>
                      <button type="button" onClick={() => move(idx, 1)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">↓</button>
                      <button type="button" onClick={() => patchItem(x.id, { title: x.title, description: x.description })} className="ml-auto px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold">Save</button>
                      <button type="button" onClick={() => deleteItem(x.id)} className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold">Delete</button>
                    </div>
                    <label className="text-sm md:col-span-2">
                      <div className="font-semibold text-slate-700">Description</div>
                      <textarea
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[90px]"
                        value={x.description || ''}
                        onChange={(e) => setItems((prev) => prev.map((r) => (r.id === x.id ? { ...r, description: e.target.value } : r)))}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
