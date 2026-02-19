import React, { useState, useEffect } from 'react'
import api from '../api'
import { CheckCircle, XCircle, Settings, Plus, Trash2, Building2, CreditCard } from 'lucide-react'

export default function SuperAdminPaymentMethods() {
  const [schools, setSchools] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [editingConfig, setEditingConfig] = useState(null)
  const [mpesaConfigs, setMpesaConfigs] = useState([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    try {
      setLoading(true)
      const [schRes, pmRes, mcRes] = await Promise.all([
        api.get('/schools/'),
        api.get('/finance/payment-methods/'),
        api.get('/finance/mpesa-configs/')
      ])
      setSchools(schRes.data.results || schRes.data || [])
      setPaymentMethods(pmRes.data.results || pmRes.data || [])
      setMpesaConfigs(mcRes.data.results || mcRes.data || [])
    } catch (err) {
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig(e) {
    e.preventDefault()
    try {
      if (editingConfig.id) {
        await api.patch(`/finance/mpesa-configs/${editingConfig.id}/`, editingConfig)
      } else {
        await api.post('/finance/mpesa-configs/', editingConfig)
      }
      setSuccess('Configuration saved successfully')
      setEditingConfig(null)
      fetchInitialData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save configuration')
    }
  }

  async function toggleMethod(method) {
    try {
      const updated = { ...method, enabled: !method.enabled }
      await api.patch(`/finance/payment-methods/${method.id}/`, { enabled: updated.enabled })
      setPaymentMethods(prev => prev.map(m => m.id === method.id ? updated : m))
      setSuccess(`Method ${method.key} ${updated.enabled ? 'enabled' : 'disabled'}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Update failed')
    }
  }

  async function seedMethods() {
    if (!selectedSchool) {
      setError('Please select a school first')
      return
    }
    try {
      // The backend .list() auto-seeds if empty. 
      // We can trigger a GET with school filter to invoke that logic if needed, 
      // or implement a bulk create here.
      setLoading(true)
      await api.get(`/finance/payment-methods/?school=${selectedSchool}`)
      // Re-fetch all
      const res = await api.get('/finance/payment-methods/')
      setPaymentMethods(res.data.results || res.data || [])
      setSuccess('Methods seeded/refreshed for school')
    } catch (err) {
      setError('Seeding failed')
    } finally {
      setLoading(false)
    }
  }

  const groupedMethods = paymentMethods.reduce((acc, curr) => {
    const sId = curr.school
    if (!acc[sId]) acc[sId] = []
    acc[sId].push(curr)
    return acc
  }, {})

  if (loading && schools.length === 0) return <div className="p-8">Loading...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-blue-600" />
          Global Payment Methods Configuration
        </h1>
        <div className="flex gap-2">
          <select 
            className="border p-2 rounded text-sm"
            value={selectedSchool}
            onChange={e => setSelectedSchool(e.target.value)}
          >
            <option value="">Select School to Seed</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button 
            onClick={seedMethods}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Seed Methods
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex items-center gap-2">
          <XCircle className="w-5 h-5" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded flex items-center gap-2">
          <CheckCircle className="w-5 h-5" /> {success}
        </div>
      )}

      <div className="grid gap-6">
        {schools.map(school => {
          const methods = groupedMethods[school.id] || []
          if (methods.length === 0) return null

          return (
            <div key={school.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <div className="flex items-center gap-2 font-semibold text-gray-800">
                  <Building2 className="w-5 h-5 text-gray-500" />
                  {school.name}
                </div>
                <span className="text-xs text-gray-500">ID: {school.id}</span>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {['mpesa', 'coop', 'bank', 'cash', 'cheque'].map(key => {
                  const m = methods.find(x => x.key === key)
                  if (!m) return (
                    <div key={key} className="border p-3 rounded bg-gray-50 flex flex-col items-center justify-center opacity-50">
                      <span className="text-xs font-bold uppercase">{key}</span>
                      <span className="text-[10px] text-gray-400">Not Seeded</span>
                    </div>
                  )

                  return (
                    <button
                      key={key}
                      onClick={() => toggleMethod(m)}
                      className={`border p-3 rounded flex flex-col items-center justify-center transition-all ${
                        m.enabled 
                          ? 'border-green-200 bg-green-50 text-green-800 shadow-sm' 
                          : 'border-gray-200 bg-white text-gray-400 grayscale'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase mb-1">{key === 'coop' ? 'Co-op M-Pesa' : key}</span>
                      {m.enabled ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300" />
                      )}
                      <span className="text-[10px] mt-1">{m.enabled ? 'Enabled' : 'Disabled'}</span>
                    </button>
                  )
                })}
              </div>
              
              <div className="px-4 py-3 bg-gray-50 border-t flex justify-end">
                <button 
                  onClick={() => {
                    const existing = mpesaConfigs.find(c => c.school === school.id)
                    setEditingConfig(existing || { school: school.id, short_code: '', passkey: '', consumer_key: '', consumer_secret: '' })
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                >
                  <Settings className="w-4 h-4" />
                  Configure STK/Co-op
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editingConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">Configure Payment Gateway</h2>
              <button onClick={() => setEditingConfig(null)} className="text-gray-400 hover:text-gray-600">✖</button>
            </div>
            <form onSubmit={saveConfig} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Short Code</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editingConfig.short_code || ''}
                  onChange={e => setEditingConfig({...editingConfig, short_code: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passkey</label>
                <input 
                  type="password" 
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editingConfig.passkey || ''}
                  onChange={e => setEditingConfig({...editingConfig, passkey: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consumer Key / Client ID</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editingConfig.consumer_key || ''}
                  onChange={e => setEditingConfig({...editingConfig, consumer_key: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consumer Secret / Client Secret</label>
                <input 
                  type="password" 
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editingConfig.consumer_secret || ''}
                  onChange={e => setEditingConfig({...editingConfig, consumer_secret: e.target.value})}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded italic">
                Note: Use these fields for both Daraja and Co-op STK configuration for this school.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setEditingConfig(null)}
                  className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold shadow-sm"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {schools.length > 0 && Object.keys(groupedMethods).length === 0 && (
        <div className="text-center py-12 bg-gray-50 border-2 border-dashed rounded-xl">
          <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No payment methods found. Select a school above to seed default methods.</p>
        </div>
      )}
    </div>
  )
}
