import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

export default function SuperAdminMaintenance(){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({ enabled: false, message: '' })
  const [server, setServer] = useState({ enabled: false, message: '', updated_at: null })

  const canSave = useMemo(() => true, [])

  const fetchNotice = async () => {
    setLoading(true)
    setError('')
    try{
      const res = await api.get('/auth/superadmin/maintenance/', { _skipGlobalLoading: true })
      const data = res?.data || {}
      setServer({ enabled: !!data.enabled, message: data.message || '', updated_at: data.updated_at || null })
      setForm({ enabled: !!data.enabled, message: data.message || '' })
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to load maintenance notice')
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotice() }, [])

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try{
      const payload = { enabled: !!form.enabled, message: form.message || '' }
      const res = await api.patch('/auth/superadmin/maintenance/', payload)
      const data = res?.data || {}
      setServer({ enabled: !!data.enabled, message: data.message || '', updated_at: data.updated_at || null })
      setForm({ enabled: !!data.enabled, message: data.message || '' })
      try { window.dispatchEvent(new Event('alerts:refresh')) } catch {}
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to save maintenance notice')
    }finally{
      setSaving(false)
    }
  }

  const stopAlert = async () => {
    setSaving(true)
    setError('')
    try{
      const res = await api.patch('/auth/superadmin/maintenance/', { enabled: false }, { _skipGlobalLoading: true })
      const data = res?.data || {}
      setServer({ enabled: !!data.enabled, message: data.message || '', updated_at: data.updated_at || null })
      setForm((f) => ({ ...f, enabled: !!data.enabled, message: data.message || '' }))
      try { window.dispatchEvent(new Event('alerts:refresh')) } catch {}
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to stop alert')
    }finally{
      setSaving(false)
    }
  }

  const copyMessage = async () => {
    try{
      const text = String(form.message || '').trim()
      if (!text) return
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }catch{
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-700">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              Maintenance Notice
            </div>
            <div className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">Maintenance message</div>
            <div className="mt-1 text-sm text-gray-600">Publish a system-wide notice shown to users when maintenance is enabled.</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <button type="button" onClick={fetchNotice} className="px-4 py-2 rounded-2xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Refresh
            </button>
            <button
              type="button"
              onClick={stopAlert}
              disabled={saving || loading}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold border ${saving || loading ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'}`}
            >
              Stop Alert
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading || !canSave}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold shadow-sm ${saving || loading || !canSave ? 'bg-gray-200 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">{error}</div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-gray-900">Message</div>
            <button
              type="button"
              onClick={copyMessage}
              disabled={!String(form.message || '').trim()}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${String(form.message || '').trim() ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-gray-200 text-gray-400'}`}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            rows={8}
            placeholder="Write the message users will see during maintenance…"
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={!!form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              Enable maintenance mode
            </label>
            <div className="text-xs text-gray-600">
              {server?.updated_at ? `Last updated: ${String(server.updated_at).slice(0, 19).replace('T', ' ')}` : ''}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="font-semibold text-gray-900">Status</div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${form.enabled ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
              {form.enabled ? 'Maintenance ON' : 'Maintenance OFF'}
            </span>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            When enabled, non-superadmin users will see the maintenance screen with this message.
          </div>
          <div className="mt-4 space-y-2">
            <a href="/" className="block text-sm font-semibold text-indigo-700 hover:underline">Open public site</a>
            <a href="/help" className="block text-sm font-semibold text-indigo-700 hover:underline">Open Help Center</a>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-600">Loading…</div>
      )}
    </div>
  )
}
