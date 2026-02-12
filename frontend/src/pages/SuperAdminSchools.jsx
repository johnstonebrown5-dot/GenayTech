import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import Modal from '../components/Modal'

function jsonStringifySafe(obj){
  try { return JSON.stringify(obj ?? {}, null, 2) } catch { return '{}' }
}

function jsonParseObjectOrNull(str){
  try {
    const v = JSON.parse(str || '{}')
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
    return null
  } catch {
    return null
  }
}

export default function SuperAdminSchools(){
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [integrationsSchool, setIntegrationsSchool] = useState(null)
  const [integrationsLoading, setIntegrationsLoading] = useState(false)
  const [integrationsForm, setIntegrationsForm] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_use_tls: true,
    smtp_use_ssl: false,
    smtp_from_email: '',
    smtp_password_set: false,
    textwave_base_url: '',
    textwave_api_key: '',
    textwave_sender_id: '',
    textwave_api_key_set: false,
  })
  const [paymentMethods, setPaymentMethods] = useState({ cash: true, mpesa: true, bank: true, cheque: true })
  const [mpesaForm, setMpesaForm] = useState({
    exists: false,
    environment: 'sandbox',
    consumer_key: '',
    consumer_secret: '',
    short_code: '',
    passkey: '',
    callback_url: '',
    consumer_secret_set: false,
    passkey_set: false,
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    domain: '',
    is_trial: true,
    trial_student_limit: 100,
    feature_flags_text: '{}',
  })

  const [editOpen, setEditOpen] = useState(false)
  const [editSchool, setEditSchool] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    is_trial: true,
    trial_student_limit: 100,
    trial_expires_at: '',
    feature_flags_text: '{}',
    homepage_text: '{}',
  })

  const [domainsOpen, setDomainsOpen] = useState(false)
  const [domainSchool, setDomainSchool] = useState(null)
  const [newDomain, setNewDomain] = useState('')
  const [newDomainPrimary, setNewDomainPrimary] = useState(true)

  const filtered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase()
    if (!s) return schools
    return schools.filter(x => {
      const hay = `${x?.name || ''} ${x?.code || ''} ${x?.primary_domain || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [schools, q])

  const originForHost = (host) => {
    try {
      const proto = (typeof window !== 'undefined' && window.location && window.location.protocol) ? window.location.protocol : 'http:'
      const port = (typeof window !== 'undefined' && window.location && window.location.port) ? `:${window.location.port}` : ''
      let finalHost = host
      try {
        const currentHost = (window?.location?.hostname || '').toLowerCase()
        const isLocal = currentHost === 'localhost' || currentHost.endsWith('.localhost') || currentHost === '127.0.0.1' || currentHost.endsWith('.lvh.me')
        if (isLocal && typeof host === 'string') {
          const h = host.toLowerCase().trim()
          if (h.endsWith('.edutrack.local')) {
            const sub = h.split('.', 1)[0]
            const localBase = (currentHost.endsWith('.lvh.me') || currentHost === 'lvh.me') ? 'lvh.me' : 'localhost'
            if (sub) finalHost = `${sub}.${localBase}`
          }
        }
      } catch {
      }
      return `${proto}//${finalHost}${port}`
    } catch {
      return `http://${host}`
    }
  }

  const fetchSchools = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/auth/superadmin/schools/')
      const items = Array.isArray(res.data?.results) ? res.data.results : []
      setSchools(items)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSchools() }, [])

  const openEdit = (s) => {
    setEditSchool(s)
    setEditForm({
      name: s?.name || '',
      code: s?.code || '',
      is_trial: !!s?.is_trial,
      trial_student_limit: s?.trial_student_limit ?? 100,
      trial_expires_at: s?.trial_expires_at ? String(s.trial_expires_at).slice(0, 19) : '',
      feature_flags_text: jsonStringifySafe(s?.feature_flags || {}),
      homepage_text: jsonStringifySafe(s?.homepage || {}),
    })
    setEditOpen(true)
  }

  const openDomains = (s) => {
    setDomainSchool(s)
    setNewDomain('')
    setNewDomainPrimary(true)
    setDomainsOpen(true)
  }

  const openIntegrations = async (s) => {
    setError('')
    setIntegrationsSchool(s)
    setIntegrationsOpen(true)
    setIntegrationsLoading(true)
    try {
      const [integRes, payRes, mpRes] = await Promise.all([
        api.get(`/auth/superadmin/schools/${s.id}/integrations/`),
        api.get(`/auth/superadmin/schools/${s.id}/payment-methods/`),
        api.get(`/auth/superadmin/schools/${s.id}/mpesa-config/`),
      ])
      const integ = integRes?.data || {}
      setIntegrationsForm(f => ({
        ...f,
        smtp_host: integ.smtp_host || '',
        smtp_port: integ.smtp_port ?? 587,
        smtp_username: integ.smtp_username || '',
        smtp_password: '',
        smtp_use_tls: !!integ.smtp_use_tls,
        smtp_use_ssl: !!integ.smtp_use_ssl,
        smtp_from_email: integ.smtp_from_email || '',
        smtp_password_set: !!integ.smtp_password_set,
        textwave_base_url: integ.textwave_base_url || '',
        textwave_api_key: '',
        textwave_sender_id: integ.textwave_sender_id || '',
        textwave_api_key_set: !!integ.textwave_api_key_set,
      }))
      const methods = Array.isArray(payRes?.data?.results) ? payRes.data.results : []
      const pm = { cash: true, mpesa: true, bank: true, cheque: true }
      for (const row of methods) {
        const k = String(row?.key || '').toLowerCase()
        if (k in pm) pm[k] = !!row?.enabled
      }
      setPaymentMethods(pm)
      const mp = mpRes?.data || {}
      setMpesaForm(m => ({
        ...m,
        exists: !!mp.exists,
        environment: mp.environment || 'sandbox',
        consumer_key: mp.consumer_key || '',
        consumer_secret: '',
        short_code: mp.short_code || '',
        passkey: '',
        callback_url: mp.callback_url || '',
        consumer_secret_set: !!mp.consumer_secret_set,
        passkey_set: !!mp.passkey_set,
      }))
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load integrations')
    } finally {
      setIntegrationsLoading(false)
    }
  }

  const saveIntegrations = async () => {
    if (!integrationsSchool?.id) return
    setError('')
    try {
      const payload = {
        smtp_host: integrationsForm.smtp_host,
        smtp_port: integrationsForm.smtp_port,
        smtp_username: integrationsForm.smtp_username,
        smtp_use_tls: !!integrationsForm.smtp_use_tls,
        smtp_use_ssl: !!integrationsForm.smtp_use_ssl,
        smtp_from_email: integrationsForm.smtp_from_email,
        textwave_base_url: integrationsForm.textwave_base_url,
        textwave_sender_id: integrationsForm.textwave_sender_id,
      }
      if (integrationsForm.smtp_password && integrationsForm.smtp_password.trim()) payload.smtp_password = integrationsForm.smtp_password
      if (integrationsForm.textwave_api_key && integrationsForm.textwave_api_key.trim()) payload.textwave_api_key = integrationsForm.textwave_api_key

      await api.patch(`/auth/superadmin/schools/${integrationsSchool.id}/integrations/`, payload)
      await api.patch(`/auth/superadmin/schools/${integrationsSchool.id}/payment-methods/`, { methods: paymentMethods })

      const mpPayload = {
        environment: mpesaForm.environment,
        consumer_key: mpesaForm.consumer_key,
        short_code: mpesaForm.short_code,
        callback_url: mpesaForm.callback_url,
      }
      if (mpesaForm.consumer_secret && mpesaForm.consumer_secret.trim()) mpPayload.consumer_secret = mpesaForm.consumer_secret
      if (mpesaForm.passkey && mpesaForm.passkey.trim()) mpPayload.passkey = mpesaForm.passkey
      if (mpesaForm.exists === false) {
        if (!mpPayload.consumer_key || !mpPayload.consumer_secret || !mpPayload.short_code || !mpPayload.passkey) {
          setError('To create Mpesa config, provide consumer_key, consumer_secret, short_code and passkey.')
          return
        }
      }
      await api.patch(`/auth/superadmin/schools/${integrationsSchool.id}/mpesa-config/`, mpPayload)

      setIntegrationsOpen(false)
      setIntegrationsSchool(null)
      await fetchSchools()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save integrations')
    }
  }

  const submitCreate = async () => {
    setError('')
    if (!createForm.name.trim()) { setError('Name is required'); return }
    const ff = jsonParseObjectOrNull(createForm.feature_flags_text)
    if (ff == null) { setError('feature_flags must be valid JSON object'); return }

    try {
      await api.post('/auth/superadmin/schools/', {
        name: createForm.name,
        code: createForm.code || '',
        domain: createForm.domain,
        is_trial: !!createForm.is_trial,
        trial_student_limit: Number(createForm.trial_student_limit || 0) || 100,
        feature_flags: ff,
      })
      setCreateOpen(false)
      setCreateForm({ name: '', code: '', domain: '', is_trial: true, trial_student_limit: 100, feature_flags_text: '{}' })
      await fetchSchools()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create school')
    }
  }

  const submitEdit = async () => {
    if (!editSchool?.id) return
    setError('')
    if (!editForm.name.trim()) { setError('Name is required'); return }
    const ff = jsonParseObjectOrNull(editForm.feature_flags_text)
    if (ff == null) { setError('feature_flags must be valid JSON object'); return }
    const hp = jsonParseObjectOrNull(editForm.homepage_text)
    if (hp == null) { setError('homepage must be valid JSON object'); return }

    try {
      await api.patch(`/auth/superadmin/schools/${editSchool.id}/`, {
        name: editForm.name,
        code: editForm.code,
        is_trial: !!editForm.is_trial,
        trial_student_limit: Number(editForm.trial_student_limit || 0) || 0,
        trial_expires_at: editForm.trial_expires_at || null,
        feature_flags: ff,
        homepage: hp,
      })
      setEditOpen(false)
      setEditSchool(null)
      await fetchSchools()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to update school')
    }
  }

  const toggleActive = async (s) => {
    if (!s?.id) return
    const next = !s?.is_active
    const ok = window.confirm(`${next ? 'Activate' : 'Deactivate'} school "${s?.name || s.id}"?`)
    if (!ok) return
    setError('')
    try {
      await api.patch(`/auth/superadmin/schools/${s.id}/`, { is_active: next })
      await fetchSchools()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to update school status')
    }
  }

  const deleteSchool = async (s) => {
    if (!s?.id) return
    const ok = window.confirm(`Delete school "${s?.name || s.id}"?

This will move the school to the Recycle Bin.

The data is not deleted completely until you purge it from the Recycle Bin.`)
    if (!ok) return
    setError('')
    try {
      await api.delete(`/auth/superadmin/schools/${s.id}/`)
      await fetchSchools()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to delete school')
    }
  }

  const addDomain = async () => {
    if (!domainSchool?.id) return
    setError('')
    if (!newDomain.trim()) { setError('Domain is required'); return }
    try {
      await api.post(`/auth/superadmin/schools/${domainSchool.id}/domains/`, {
        domain: newDomain,
        is_primary: !!newDomainPrimary,
      })
      await fetchSchools()
      const updated = schools.find(s => s.id === domainSchool.id)
      setDomainSchool(updated || domainSchool)
      setNewDomain('')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to add domain')
    }
  }

  const setPrimary = async (domainId) => {
    setError('')
    try {
      await api.patch(`/auth/superadmin/domains/${domainId}/`, { is_primary: true })
      await fetchSchools()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to set primary')
    }
  }

  const deleteDomain = async (domainId) => {
    setError('')
    try {
      await api.delete(`/auth/superadmin/domains/${domainId}/`)
      await fetchSchools()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to delete domain')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Schools</h1>
          <div className="mt-1 text-sm text-gray-600">Manage schools, domains, and school environment settings.</div>
        </div>
        <button onClick={() => setCreateOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Add School</button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by name, code or domain" className="w-full md:w-96 rounded-lg border border-gray-300 px-3 py-2" />
        <button onClick={fetchSchools} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm">Refresh</button>
      </div>

      <div className="mt-4 rounded-2xl bg-white border overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">School</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Primary Domain</th>
                <th className="text-left px-4 py-3">Active</th>
                <th className="text-left px-4 py-3">Trial</th>
                <th className="text-left px-4 py-3">Limit</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6 text-gray-600" colSpan={8}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-4 py-6 text-gray-600" colSpan={8}>No schools found</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 text-gray-900">{s.id}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-700">{s.code}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.primary_domain ? (
                      <a href={originForHost(s.primary_domain) + '/'} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                        {s.primary_domain}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{s.is_active === false ? 'No' : 'Yes'}</td>
                  <td className="px-4 py-3 text-gray-700">{s.is_trial ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-gray-700">{s.trial_student_limit ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openDomains(s)} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">Domains</button>
                      <button onClick={() => openIntegrations(s)} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">Integrations</button>
                      <button onClick={() => toggleActive(s)} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">{s.is_active === false ? 'Activate' : 'Deactivate'}</button>
                      <button onClick={() => deleteSchool(s)} className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Delete</button>
                      <button onClick={() => openEdit(s)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add School" size="lg">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Name *</label>
            <input value={createForm.name} onChange={(e)=>setCreateForm(f=>({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Code (optional)</label>
            <input value={createForm.code} onChange={(e)=>setCreateForm(f=>({ ...f, code: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Domain (optional)</label>
            <input value={createForm.domain} onChange={(e)=>setCreateForm(f=>({ ...f, domain: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. school1.ac.ke" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Trial</label>
            <select value={createForm.is_trial ? 'yes' : 'no'} onChange={(e)=>setCreateForm(f=>({ ...f, is_trial: e.target.value === 'yes' }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Trial student limit</label>
            <input type="number" value={createForm.trial_student_limit} onChange={(e)=>setCreateForm(f=>({ ...f, trial_student_limit: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Feature flags (JSON)</label>
            <textarea value={createForm.feature_flags_text} onChange={(e)=>setCreateForm(f=>({ ...f, feature_flags_text: e.target.value }))} rows={8} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">Cancel</button>
          <button onClick={submitCreate} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Create</button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit School" size="xl">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Name *</label>
            <input value={editForm.name} onChange={(e)=>setEditForm(f=>({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Code</label>
            <input value={editForm.code} onChange={(e)=>setEditForm(f=>({ ...f, code: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Trial</label>
            <select value={editForm.is_trial ? 'yes' : 'no'} onChange={(e)=>setEditForm(f=>({ ...f, is_trial: e.target.value === 'yes' }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Trial student limit</label>
            <input type="number" value={editForm.trial_student_limit} onChange={(e)=>setEditForm(f=>({ ...f, trial_student_limit: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Trial expires at (optional)</label>
            <input value={editForm.trial_expires_at} onChange={(e)=>setEditForm(f=>({ ...f, trial_expires_at: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Feature flags (JSON)</label>
            <textarea value={editForm.feature_flags_text} onChange={(e)=>setEditForm(f=>({ ...f, feature_flags_text: e.target.value }))} rows={8} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Homepage config (JSON)</label>
            <textarea value={editForm.homepage_text} onChange={(e)=>setEditForm(f=>({ ...f, homepage_text: e.target.value }))} rows={10} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">Cancel</button>
          <button onClick={submitEdit} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
        </div>
      </Modal>

      <Modal open={domainsOpen} onClose={() => setDomainsOpen(false)} title="Manage Domains" size="lg">
        <div className="text-sm text-gray-700">{domainSchool?.name || ''}</div>
        <div className="mt-3 grid md:grid-cols-3 gap-2">
          <input value={newDomain} onChange={(e)=>setNewDomain(e.target.value)} className="md:col-span-2 rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. school1.ac.ke" />
          <div className="flex items-center gap-2">
            <input id="primary" type="checkbox" checked={newDomainPrimary} onChange={(e)=>setNewDomainPrimary(e.target.checked)} />
            <label htmlFor="primary" className="text-sm text-gray-700">Primary</label>
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <button onClick={addDomain} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm">Add domain</button>
        </div>

        <div className="mt-4 rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Domain</th>
                <th className="text-left px-3 py-2">Primary</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(domainSchool?.domains || []).length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-4 text-gray-600">No domains</td></tr>
              ) : (domainSchool?.domains || []).map(d => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 text-gray-900">{d.domain}</td>
                  <td className="px-3 py-2 text-gray-700">{d.is_primary ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      {!d.is_primary && (
                        <button onClick={() => setPrimary(d.id)} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">Set primary</button>
                      )}
                      <button onClick={() => deleteDomain(d.id)} className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={() => setDomainsOpen(false)} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">Close</button>
        </div>
      </Modal>

      <Modal open={integrationsOpen} onClose={() => setIntegrationsOpen(false)} title="School Integrations" size="xl">
        <div className="text-sm text-gray-700">{integrationsSchool?.name || ''}</div>
        {integrationsLoading ? (
          <div className="mt-4 text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="mt-4 grid lg:grid-cols-2 gap-6">
            <div className="rounded-xl border p-4 bg-white">
              <div className="font-semibold text-gray-900">Email (SMTP)</div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm text-gray-700">Host</label>
                  <input value={integrationsForm.smtp_host} onChange={(e)=>setIntegrationsForm(f=>({ ...f, smtp_host: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="smtp.gmail.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-700">Port</label>
                    <input type="number" value={integrationsForm.smtp_port} onChange={(e)=>setIntegrationsForm(f=>({ ...f, smtp_port: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">From email</label>
                    <input value={integrationsForm.smtp_from_email} onChange={(e)=>setIntegrationsForm(f=>({ ...f, smtp_from_email: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="no-reply@school.com" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Username</label>
                  <input value={integrationsForm.smtp_username} onChange={(e)=>setIntegrationsForm(f=>({ ...f, smtp_username: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Password {integrationsForm.smtp_password_set ? '(saved)' : ''}</label>
                  <input type="password" value={integrationsForm.smtp_password} onChange={(e)=>setIntegrationsForm(f=>({ ...f, smtp_password: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Leave blank to keep" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={!!integrationsForm.smtp_use_tls} onChange={(e)=>setIntegrationsForm(f=>({ ...f, smtp_use_tls: e.target.checked }))} />
                    TLS
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={!!integrationsForm.smtp_use_ssl} onChange={(e)=>setIntegrationsForm(f=>({ ...f, smtp_use_ssl: e.target.checked }))} />
                    SSL
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4 bg-white">
              <div className="font-semibold text-gray-900">SMS (TextWave)</div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm text-gray-700">TextWave Base URL</label>
                  <input value={integrationsForm.textwave_base_url} onChange={(e)=>setIntegrationsForm(f=>({ ...f, textwave_base_url: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="https://api.textwave.pro/v1" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">TextWave API Key {integrationsForm.textwave_api_key_set ? '(saved)' : ''}</label>
                  <input type="password" value={integrationsForm.textwave_api_key} onChange={(e)=>setIntegrationsForm(f=>({ ...f, textwave_api_key: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Leave blank to keep" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Sender ID</label>
                  <input value={integrationsForm.textwave_sender_id} onChange={(e)=>setIntegrationsForm(f=>({ ...f, textwave_sender_id: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="GENAYTECH" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4 bg-white">
              <div className="font-semibold text-gray-900">Payment methods</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-700">
                {['cash','mpesa','bank','cheque'].map(k => (
                  <label key={k} className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!paymentMethods[k]} onChange={(e)=>setPaymentMethods(m=>({ ...m, [k]: e.target.checked }))} />
                    {k.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-4 bg-white">
              <div className="font-semibold text-gray-900">M-Pesa (Daraja)</div>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-700">Environment</label>
                    <select value={mpesaForm.environment} onChange={(e)=>setMpesaForm(m=>({ ...m, environment: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                      <option value="sandbox">sandbox</option>
                      <option value="production">production</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Short code</label>
                    <input value={mpesaForm.short_code} onChange={(e)=>setMpesaForm(m=>({ ...m, short_code: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Consumer key</label>
                  <input value={mpesaForm.consumer_key} onChange={(e)=>setMpesaForm(m=>({ ...m, consumer_key: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Consumer secret {mpesaForm.consumer_secret_set ? '(saved)' : ''}</label>
                  <input type="password" value={mpesaForm.consumer_secret} onChange={(e)=>setMpesaForm(m=>({ ...m, consumer_secret: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Leave blank to keep" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Passkey {mpesaForm.passkey_set ? '(saved)' : ''}</label>
                  <input type="password" value={mpesaForm.passkey} onChange={(e)=>setMpesaForm(m=>({ ...m, passkey: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Leave blank to keep" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Callback URL</label>
                  <input value={mpesaForm.callback_url} onChange={(e)=>setMpesaForm(m=>({ ...m, callback_url: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="https://..." />
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setIntegrationsOpen(false)} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">Close</button>
          <button onClick={saveIntegrations} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
        </div>
      </Modal>
    </div>
  )
}
