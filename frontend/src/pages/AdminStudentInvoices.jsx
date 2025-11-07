import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import api from '../api'

export default function AdminStudentInvoices(){
  const { id } = useParams()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const tableRef = useRef(null)

  useEffect(()=>{
    let alive = true
    async function load(){
      try{
        setLoading(true)
        setError('')
        const { data } = await api.get(`/finance/invoices/?student=${id}`)
        if (!alive) return
        const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
        setInvoices(list)
      }catch(e){
        if (!alive) return
        const msg = e?.response?.data?.detail || e?.message || 'Failed to load invoices'
        setError(msg)
        setInvoices([])
      }finally{
        alive && setLoading(false)
      }
    }
    load()
    return ()=>{ alive = false }
  }, [id])

  function money(n){
    try { return new Intl.NumberFormat('en-KE', { style:'currency', currency:'KES' }).format(Number(n||0)) } catch { return `Ksh. ${n}` }
  }

  function onPrint(){
    try{
      const html = tableRef.current ? tableRef.current.outerHTML : ''
      const w = window.open('', '_blank', 'noopener,noreferrer')
      if (!w) return
      w.document.write(`<!doctype html><html><head><title>Student Invoices</title><meta charset="utf-8"/><style>
        body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,\"Helvetica Neue\",Arial,\"Noto Sans\",sans-serif;padding:24px;color:#0f172a}
        h1{font-size:20px;margin:0 0 12px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px}
        thead{background:#f8fafc}
      </style></head><body>
        <h1>Student Invoices</h1>
        ${html}
      </body></html>`)
      w.document.close()
      w.focus()
      w.print()
      w.close()
    }catch{}
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="text-sm text-gray-500"><Link to="/admin" className="hover:underline">Admin</Link> / <Link to="/admin/students" className="hover:underline">Students</Link> / <Link to={`/admin/students/${id}`} className="hover:underline">Dashboard</Link> / <span className="text-gray-700">Invoices</span></div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Student Invoices</h1>
          <div className="flex items-center gap-3">
            <button onClick={onPrint} className="text-sm px-3 py-1.5 rounded border bg-white hover:bg-gray-50">Print</button>
            <Link to={`/admin/students/${id}`} className="text-sm text-blue-600 hover:underline">Back to Dashboard</Link>
          </div>
        </div>
        {loading && (<div className="bg-white rounded shadow p-4">Loading...</div>)}
        {error && (<div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>)}
        <div className="bg-white rounded shadow p-4" ref={tableRef}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(invoices)?invoices:[]).map(inv => (
                <tr key={inv.id} className="border-t">
                  <td>{inv.id}</td>
                  <td>{money(inv.amount)}</td>
                  <td className="capitalize">{inv.status}</td>
                  <td>{inv.due_date || '-'}</td>
                  <td>{inv.created_at?.slice(0,10)}</td>
                </tr>
              ))}
              {(Array.isArray(invoices) ? invoices.length===0 : true) && !loading && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-6">No invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
