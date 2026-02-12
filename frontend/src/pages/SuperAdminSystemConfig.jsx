import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

export default function SuperAdminSystemConfig(){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [server, setServer] = useState({ default_domain: '', updated_at: null })
  const [form, setForm] = useState({ default_domain: '' })

  const canSave = useMemo(() => true, [])

  const fetchConfig = async () => {
    setLoading(true)
    setError('')
    try{
      const res = await api.get('/auth/superadmin/system-config/', { _skipGlobalLoading: true })
      const data = res?.data || {}
      setServer({ default_domain: data.default_domain || '', updated_at: data.updated_at || null })
      setForm({ default_domain: data.default_domain || '' })
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to load system config')
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try{
      const payload = { default_domain: form.default_domain || '' }
      const res = await api.patch('/auth/superadmin/system-config/', payload)
      const data = res?.data || {}
      setServer({ default_domain: data.default_domain || '', updated_at: data.updated_at || null })
      setForm({ default_domain: data.default_domain || '' })
    }catch(e){
      setError(e?.response?.data?.detail || e?.message || 'Failed to save system config')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-700">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              System Domain
            </div>
            <div className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">Default domain settings</div>
            <div className="mt-1 text-sm text-gray-600">Set the main domain that should always show the Genay Technologies landing page (not a school website).</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <button type="button" onClick={fetchConfig} className="px-4 py-2 rounded-2xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Refresh
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

      <div className="rounded-3xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="font-semibold text-gray-900">Default domain</div>
        <div className="mt-1 text-sm text-gray-600">
          Example: <span className="font-semibold">edu-track-15m3.onrender.com</span> (no https:// and no path)
        </div>
        <input
          value={form.default_domain}
          onChange={e => setForm(f => ({ ...f, default_domain: e.target.value }))}
          placeholder="your-domain.com"
          className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <div className="mt-3 text-xs text-gray-600">
          {server?.updated_at ? `Last updated: ${String(server.updated_at).slice(0, 19).replace('T', ' ')}` : ''}
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-600">Loading…</div>
      )}
    </div>
  )
}
