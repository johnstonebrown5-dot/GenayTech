import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

function fmtDt(v){
  try{
    if (!v) return '—'
    return String(v).replace('T', ' ').slice(0, 19)
  }catch{
    return '—'
  }
}

export default function SuperAdminRecycleBin(){
  const [tab, setTab] = useState('schools')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  const endpoint = tab === 'exams'
    ? '/auth/superadmin/recycle-bin/exams/'
    : tab === 'academic-years'
      ? '/auth/superadmin/recycle-bin/academic-years/'
      : tab === 'terms'
        ? '/auth/superadmin/recycle-bin/terms/'
        : '/auth/superadmin/recycle-bin/schools/'

  const fetchItems = async () => {
    setLoading(true)
    setError('')
    try{
      const res = await api.get(endpoint)
      setItems(Array.isArray(res.data?.results) ? res.data.results : [])
    }catch(e){
      setItems([])
      setError(e?.response?.data?.detail || 'Failed to load recycle bin')
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [tab])

  const filtered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase()
    if (!s) return items
    return items.filter(r => {
      const hay = `${r?.name || ''} ${r?.code || ''} ${r?.primary_domain || ''} ${r?.deleted_by || ''} ${r?.school_name || ''} ${r?.label || ''} ${r?.academic_year_label || ''} ${r?.klass_name || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [items, q])

  const restore = async (row) => {
    if (!row?.id) return
    const label = row?.name || row?.label || row?.academic_year_label || row?.id
    const ok = window.confirm(`Restore "${label}"?`)
    if (!ok) return
    setError('')
    try{
      const url = tab === 'exams'
        ? `/auth/superadmin/recycle-bin/exams/${row.id}/restore/`
        : tab === 'academic-years'
          ? `/auth/superadmin/recycle-bin/academic-years/${row.id}/restore/`
          : tab === 'terms'
            ? `/auth/superadmin/recycle-bin/terms/${row.id}/restore/`
            : `/auth/superadmin/recycle-bin/schools/${row.id}/restore/`
      await api.post(url, {})
      await fetchItems()
    }catch(e){
      setError(e?.response?.data?.detail || 'Failed to restore')
    }
  }

  const purge = async (row) => {
    if (!row?.id) return
    const label = row?.name || row?.label || row?.academic_year_label || row?.id
    const ok = window.confirm(`Permanently delete "${label}"?

This will permanently remove it from the database.

This cannot be undone.`)
    if (!ok) return
    setError('')
    try{
      const url = tab === 'exams'
        ? `/auth/superadmin/recycle-bin/exams/${row.id}/purge/`
        : tab === 'academic-years'
          ? `/auth/superadmin/recycle-bin/academic-years/${row.id}/purge/`
          : tab === 'terms'
            ? `/auth/superadmin/recycle-bin/terms/${row.id}/purge/`
            : `/auth/superadmin/recycle-bin/schools/${row.id}/purge/`
      await api.delete(url)
      await fetchItems()
    }catch(e){
      setError(e?.response?.data?.detail || 'Failed to purge')
    }
  }

  const clearAll = async () => {
    const ok = window.confirm(`Clear Recycle Bin?

This will permanently delete ALL deleted items.

This cannot be undone.`)
    if (!ok) return
    setError('')
    try{
      await api.post('/auth/superadmin/recycle-bin/clear/', {})
      await fetchItems()
    }catch(e){
      setError(e?.response?.data?.detail || 'Failed to clear recycle bin')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Recycle Bin</h1>
          <div className="mt-1 text-sm text-gray-600">Deleted items are kept here until you restore them or permanently delete them.</div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <button onClick={fetchItems} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm w-full sm:w-auto">Refresh</button>
          <button onClick={clearAll} className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm w-full sm:w-auto">Clear Recycle Bin</button>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
        <button onClick={() => setTab('schools')} className={`px-3 py-2 rounded-xl text-sm font-semibold border ${tab==='schools' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Schools</button>
        <button onClick={() => setTab('exams')} className={`px-3 py-2 rounded-xl text-sm font-semibold border ${tab==='exams' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Exams</button>
        <button onClick={() => setTab('academic-years')} className={`px-3 py-2 rounded-xl text-sm font-semibold border ${tab==='academic-years' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Academic Years</button>
        <button onClick={() => setTab('terms')} className={`px-3 py-2 rounded-xl text-sm font-semibold border ${tab==='terms' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Terms</button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by name, code, domain or deleted-by" className="w-full sm:flex-1 md:w-96 rounded-lg border border-gray-300 px-3 py-2" />
      </div>

      <div className="mt-4 rounded-2xl bg-white border overflow-hidden">
        <div className="overflow-auto">
          {tab === 'schools' ? (
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">School</th>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Primary Domain</th>
                  <th className="text-left px-4 py-3">Deleted At</th>
                  <th className="text-left px-4 py-3">Deleted By</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={7}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={7}>Recycle bin is empty</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3 text-gray-900">{s.id}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-700">{s.code}</td>
                    <td className="px-4 py-3 text-gray-700">{s.primary_domain || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDt(s.deleted_at)}</td>
                    <td className="px-4 py-3 text-gray-700">{s.deleted_by || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button onClick={() => restore(s)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Restore</button>
                        <button onClick={() => purge(s)} className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Purge</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'exams' ? (
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">School</th>
                  <th className="text-left px-4 py-3">Exam</th>
                  <th className="text-left px-4 py-3">Class</th>
                  <th className="text-left px-4 py-3">Year/Term</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Deleted At</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={8}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={8}>Recycle bin is empty</td></tr>
                ) : filtered.map(e => (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-3 text-gray-900">{e.id}</td>
                    <td className="px-4 py-3 text-gray-900">{e.school_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{e.name}</td>
                    <td className="px-4 py-3 text-gray-700">{e.klass_name || e.klass_id || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{e.year} / T{e.term}</td>
                    <td className="px-4 py-3 text-gray-700">{String(e.date || '').slice(0,10) || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDt(e.deleted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button onClick={() => restore(e)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Restore</button>
                        <button onClick={() => purge(e)} className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Purge</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'academic-years' ? (
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">School</th>
                  <th className="text-left px-4 py-3">Label</th>
                  <th className="text-left px-4 py-3">Start</th>
                  <th className="text-left px-4 py-3">End</th>
                  <th className="text-left px-4 py-3">Deleted At</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={7}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={7}>Recycle bin is empty</td></tr>
                ) : filtered.map(ay => (
                  <tr key={ay.id} className="border-t">
                    <td className="px-4 py-3 text-gray-900">{ay.id}</td>
                    <td className="px-4 py-3 text-gray-900">{ay.school_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{ay.label}</td>
                    <td className="px-4 py-3 text-gray-700">{String(ay.start_date || '').slice(0,10) || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{String(ay.end_date || '').slice(0,10) || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDt(ay.deleted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button onClick={() => restore(ay)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Restore</button>
                        <button onClick={() => purge(ay)} className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Purge</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-[1050px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">School</th>
                  <th className="text-left px-4 py-3">Academic Year</th>
                  <th className="text-left px-4 py-3">Term</th>
                  <th className="text-left px-4 py-3">Start</th>
                  <th className="text-left px-4 py-3">End</th>
                  <th className="text-left px-4 py-3">Deleted At</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={8}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td className="px-4 py-6 text-gray-600" colSpan={8}>Recycle bin is empty</td></tr>
                ) : filtered.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-3 text-gray-900">{t.id}</td>
                    <td className="px-4 py-3 text-gray-900">{t.school_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{t.academic_year_label || t.academic_year_id || '—'}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">T{t.number}{t.name ? ` (${t.name})` : ''}</td>
                    <td className="px-4 py-3 text-gray-700">{String(t.start_date || '').slice(0,10) || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{String(t.end_date || '').slice(0,10) || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDt(t.deleted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button onClick={() => restore(t)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Restore</button>
                        <button onClick={() => purge(t)} className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Purge</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
