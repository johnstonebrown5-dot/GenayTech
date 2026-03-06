import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'

export default function TeacherClassLogs(){
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const classId = sp.get('classId')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])

  const [category, setCategory] = useState('all')
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('all')

  const load = async ({ background = false } = {}) => {
    if (!classId) return
    if (background) setRefreshing(true)
    else setLoading(true)
    setError('')
    try{
      const { data } = await api.get(`/academics/classes/${classId}/class-logs/?limit=25`)
      setItems(Array.isArray(data?.items) ? data.items : [])
    }catch(err){
      setItems([])
      setError(err?.response?.data?.detail || 'Failed to load logs')
    }finally{
      if (background) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [classId])

  const filtered = useMemo(() => {
    return (items || []).filter(it => {
      if (category !== 'all' && String(it?.category || '') !== category) return false
      if (channel !== 'all' && String(it?.channel || '') !== channel) return false
      if (status !== 'all'){
        const st = String(it?.status || '').toLowerCase()
        if (status === 'sending' && !(st === 'queued' || st === 'pending')) return false
        if (status === 'sent' && st !== 'sent') return false
        if (status === 'failed' && st !== 'failed') return false
      }
      return true
    })
  }, [items, category, channel, status])

  const statusLabel = (it) => {
    const st = String(it?.status || '').toLowerCase()
    if (st === 'queued' || st === 'pending') return 'Sending'
    if (st) return st
    if (it?.ok === true) return 'Sent'
    if (it?.ok === false) return 'Failed'
    return ''
  }

  if (!classId){
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-lg font-semibold text-gray-900">Class logs</div>
          <div className="mt-2 text-sm text-gray-600">No class selected. Open this page from Manage My Class.</div>
          <div className="mt-4">
            <button onClick={() => nav('/teacher/manage-class')} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Back</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-gray-900">Class Logs</div>
          <div className="text-xs text-gray-500">Latest 25 logs for this class</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load({ background: true })}
            className="px-3 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50"
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={() => nav(`/teacher/manage-class?classId=${encodeURIComponent(String(classId))}`)}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Back
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm">
            <div className="text-xs text-gray-600">Category</div>
            <select value={category} onChange={(e)=>setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="class">Class</option>
              <option value="fees">Fees</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="text-xs text-gray-600">Channel</div>
            <select value={channel} onChange={(e)=>setChannel(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="in_app">In-app</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="text-xs text-gray-600">Status</div>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border-b border-red-200">{String(error)}</div>
        )}

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left font-semibold px-4 py-3">When</th>
                <th className="text-left font-semibold px-4 py-3">Category</th>
                <th className="text-left font-semibold px-4 py-3">Channel</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Recipient</th>
                <th className="text-left font-semibold px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(loading && filtered.length === 0) ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4" colSpan={6}><div className="h-4 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>No logs found</td>
                </tr>
              ) : (
                filtered.slice(0,25).map(it => (
                  <tr key={String(it?.id || Math.random())}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{it?.created_at ? new Date(it.created_at).toLocaleString() : ''}</td>
                    <td className="px-4 py-3 capitalize">{String(it?.category || '')}</td>
                    <td className="px-4 py-3 uppercase">{String(it?.channel || '')}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize">{statusLabel(it)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{String(it?.recipient || '')}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[520px]">
                      <div className="truncate" title={String(it?.message || '')}>{String(it?.message || '')}</div>
                      {it?.error ? (
                        <div className="text-xs text-red-600 truncate mt-1" title={String(it?.error || '')}>{String(it?.error || '')}</div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
