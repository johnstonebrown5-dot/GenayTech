import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'

export default function FinanceStaffPayrollDetail(){
  const { id } = useParams()
  const navigate = useNavigate()
  const { showError, showSuccess } = useNotification()
  const [loading, setLoading] = useState(true)
  const [payroll, setPayroll] = useState(null)
  const [payslips, setPayslips] = useState([])
  const [staffName, setStaffName] = useState('')

  const [showCreatePayslip, setShowCreatePayslip] = useState(false)
  const [slipForm, setSlipForm] = useState({ year:'', month:'', basic:'', allowancesText:'', deductionsText:'', notes:'' })
  const [savingSlip, setSavingSlip] = useState(false)
  const [showEditPayroll, setShowEditPayroll] = useState(false)
  const [editForm, setEditForm] = useState({ base_salary:'' })
  const [deleting, setDeleting] = useState(false)
  const [viewSlip, setViewSlip] = useState(null)

  const load = async () => {
    try{
      setLoading(true)
      const p = await api.get(`/finance/staff-payroll/${id}/`)
      const pr = p.data
      setPayroll(pr)
      setStaffName(pr?.staff_name || '')
      setEditForm({ base_salary: String(pr?.base_salary || '') })
      const slips = await api.get(`/finance/staff-payslips/?staff=${pr.staff}`)
      const psArr = Array.isArray(slips.data)? slips.data : (Array.isArray(slips.data?.results)? slips.data.results: [])
      setPayslips(psArr)
      setSlipForm(f => ({ ...f, basic: String(pr?.base_salary || '') }))
    }catch(err){
      showError('Failed', 'Could not load payroll detail')
    }finally{
      setLoading(false)
    }

  const updatePayroll = async (e) => {
    e.preventDefault()
    try{
      await api.patch(`/finance/staff-payroll/${id}/`, { base_salary: Number(editForm.base_salary||0) })
      showSuccess('Saved', 'Payroll updated')
      setShowEditPayroll(false)
      await load()
    }catch(err){
      showError('Failed', err?.response?.data?.detail || 'Could not update payroll')
    }
  }

  const deletePayroll = async () => {
    if (!window.confirm('Delete this payroll? This will not delete existing payslips.')) return
    try{
      setDeleting(true)
      await api.delete(`/finance/staff-payroll/${id}/`)
      showSuccess('Deleted', 'Payroll removed')
      navigate(-1)
    }catch(err){
      showError('Failed', err?.response?.data?.detail || 'Could not delete payroll')
    }finally{
      setDeleting(false)
    }
  }

  const deletePayslip = async (slipId) => {
    if (!window.confirm('Delete this payslip?')) return
    try{
      await api.delete(`/finance/staff-payslips/${slipId}/`)
      showSuccess('Deleted', 'Payslip removed')
      setViewSlip(null)
      await load()
    }catch(err){
      showError('Failed', err?.response?.data?.detail || 'Could not delete payslip')
    }
  }

  const printSlip = (slip) => {
    try{
      const w = window.open('', '_blank')
      if (!w) return
      const html = `<!doctype html><html><head><title>Payslip ${slip.year}-${String(slip.month).padStart(2,'0')}</title>
        <style>body{font-family:Arial;padding:24px} h1{font-size:18px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ddd;padding:6px;text-align:left}</style>
      </head><body>
      <h1>Payslip - ${staffName}</h1>
      <p>Period: ${slip.year}-${String(slip.month).padStart(2,'0')}</p>
      <table>
        <tr><th>Basic</th><td>${Number(slip.basic||0).toLocaleString()}</td></tr>
        <tr><th>Gross</th><td>${Number(slip.gross_pay||0).toLocaleString()}</td></tr>
        <tr><th>Net</th><td>${Number(slip.net_pay||0).toLocaleString()}</td></tr>
      </table>
      <p style="margin-top:16px;white-space:pre-wrap">${slip.notes||''}</p>
      </body></html>`
      w.document.write(html)
      w.document.close(); w.focus(); w.print();
    }catch{}
  }

  const parseForTotals = React.useCallback((text) => {
    return String(text||'')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(item => {
        const amountPart = (item.split(/[:\-]/)[1]||'').replace(/[,\s]/g,'').trim()
        const amount = Number(amountPart||0)
        return isNaN(amount)?0:amount
      })
      .reduce((a,b)=>a+b,0)
  },[])

  const grossPreview = useMemo(()=>{
    const basic = Number(slipForm.basic||0)
    const alw = parseForTotals(slipForm.allowancesText)
    return basic + alw
  },[slipForm.basic, slipForm.allowancesText, parseForTotals])

  const netPreview = useMemo(()=>{
    const ded = parseForTotals(slipForm.deductionsText)
    return grossPreview - ded
  },[grossPreview, slipForm.deductionsText, parseForTotals])

  const duplicateExists = useMemo(()=>{
    if (!slipForm.year || !slipForm.month) return false
    return (Array.isArray(payslips)?payslips:[]).some(s => String(s.year)===String(slipForm.year) && String(s.month)===String(slipForm.month))
  },[payslips, slipForm.year, slipForm.month])
  }

  useEffect(()=>{ load() },[id])

  const activate = async () => {
    try{
      await api.patch(`/finance/staff-payroll/${id}/`, { is_active: true })
      showSuccess('Updated', 'Payroll activated')
      await load()
    }catch(err){
      showError('Failed', err?.response?.data?.detail || 'Could not activate payroll')
    }
  }

  const createPayslip = async (e) => {
    e.preventDefault()
    try{
      setSavingSlip(true)
      const parseList = (text) => {
        return String(text||'')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(item => {
            const [namePart, amountPart] = item.split(/[:\-]/)
            const name = String(namePart||'').trim()
            const amount = Number(String(amountPart||'').replace(/[,\s]/g,'').trim()||0)
            return name ? { name, amount:isNaN(amount)?0:amount } : null
          })
          .filter(Boolean)
      }
      const allowances = parseList(slipForm.allowancesText)
      const deductions = parseList(slipForm.deductionsText)
      // Prevent duplicate payslip for same year+month
      const exists = (Array.isArray(payslips)?payslips:[]).some(s => String(s.year)===String(slipForm.year) && String(s.month)===String(slipForm.month))
      if (exists) { showError('Already exists', 'A payslip for this month already exists'); setSavingSlip(false); return }
      await api.post('/finance/staff-payslips/', {
        staff: Number(payroll.staff),
        year: Number(slipForm.year),
        month: Number(slipForm.month),
        basic: Number(slipForm.basic||0),
        allowances,
        deductions,
        notes: slipForm.notes||''
      })
      setShowCreatePayslip(false)
      setSlipForm({ year:'', month:'', basic:String(payroll?.base_salary||''), allowancesText:'', deductionsText:'', notes:'' })
      await load()
      showSuccess('Saved', 'Payslip created')
    }catch(err){
      showError('Failed', err?.response?.data?.detail || 'Could not create payslip')
    }finally{
      setSavingSlip(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Payroll Details</h1>
          <p className="text-sm text-gray-600">{staffName ? `For ${staffName}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link to={-1} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">Back</Link>
          {!payroll?.is_active && (
            <button onClick={activate} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">Activate</button>
          )}
          <button onClick={()=>setShowEditPayroll(true)} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">Edit</button>
          <button onClick={deletePayroll} disabled={deleting} className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700">{deleting? 'Deleting...' : 'Delete'}</button>
          <button onClick={()=>setShowCreatePayslip(true)} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white">New Payslip</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-4 md:p-5">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Staff</dt>
                <dd className="font-medium">{staffName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Base Salary</dt>
                <dd className="font-medium">{Number(payroll?.base_salary||0).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Active</dt>
                <dd className="font-medium">{payroll?.is_active? 'Yes':'No'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Updated</dt>
                <dd className="font-medium">{new Date(payroll?.updated_at||Date.now()).toLocaleString()}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-4 md:p-5">
          <h2 className="text-base font-semibold mb-3">Payslips</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-2 px-3">Period</th>
                  <th className="py-2 px-3">Gross</th>
                  <th className="py-2 px-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="py-6 text-center text-gray-500">Loading...</td></tr>
                ) : (Array.isArray(payslips)?payslips:[]).length===0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-gray-500">No payslips.</td></tr>
                ) : (
                  (payslips||[]).map(slip => (
                    <tr key={slip.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={()=>setViewSlip(slip)}>
                      <td className="py-2 px-3">{slip.year}-{String(slip.month).padStart(2,'0')}</td>
                      <td className="py-2 px-3">{Number(slip.gross_pay||0).toLocaleString()}</td>
                      <td className="py-2 px-3">{Number(slip.net_pay||0).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showCreatePayslip} onClose={()=>!savingSlip && setShowCreatePayslip(false)} title="New Payslip" size="lg">
        <form onSubmit={createPayslip} className="grid gap-3 md:grid-cols-2">
          <input className="border p-2 rounded" placeholder="Year" type="number" value={slipForm.year} onChange={e=>setSlipForm({...slipForm, year:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Month (1-12)" type="number" value={slipForm.month} onChange={e=>setSlipForm({...slipForm, month:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Basic Salary" type="number" value={slipForm.basic} onChange={e=>setSlipForm({...slipForm, basic:e.target.value})} />
          <textarea className="border p-2 rounded md:col-span-2" rows={2} placeholder="Allowances (e.g., Transport:2000, Airtime:500)" value={slipForm.allowancesText} onChange={e=>setSlipForm({...slipForm, allowancesText:e.target.value})} />
          <textarea className="border p-2 rounded md:col-span-2" rows={2} placeholder="Deductions (e.g., NHIF:500, Loan:1200)" value={slipForm.deductionsText} onChange={e=>setSlipForm({...slipForm, deductionsText:e.target.value})} />
          <input className="border p-2 rounded md:col-span-2" placeholder="Notes (optional)" value={slipForm.notes} onChange={e=>setSlipForm({...slipForm, notes:e.target.value})} />
          <div className="md:col-span-2 text-sm text-gray-700">
            <div>Gross (preview): <span className="font-semibold">{Number(grossPreview||0).toLocaleString()}</span></div>
            <div>Net (preview): <span className="font-semibold">{Number(netPreview||0).toLocaleString()}</span></div>
            {duplicateExists && <div className="mt-1 text-red-600">A payslip for this month already exists.</div>}
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow" disabled={savingSlip || !slipForm.year || !slipForm.month || duplicateExists}>
              {savingSlip? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditPayroll} onClose={()=>setShowEditPayroll(false)} title="Edit Payroll" size="sm">
        <form onSubmit={updatePayroll} className="grid gap-3">
          <input className="border p-2 rounded" placeholder="Base Salary" type="number" value={editForm.base_salary} onChange={e=>setEditForm({...editForm, base_salary:e.target.value})} />
          <div className="flex justify-end">
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewSlip} onClose={()=>setViewSlip(null)} title="Payslip" size="sm">
        {viewSlip && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Period</span><span>{viewSlip.year}-{String(viewSlip.month).padStart(2,'0')}</span></div>
            <div className="flex justify-between"><span>Basic</span><span>{Number(viewSlip.basic||0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Gross</span><span>{Number(viewSlip.gross_pay||0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Net</span><span>{Number(viewSlip.net_pay||0).toLocaleString()}</span></div>
            {viewSlip.notes && <div><div className="text-gray-500">Notes</div><div className="whitespace-pre-wrap">{viewSlip.notes}</div></div>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={()=>printSlip(viewSlip)} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">Print</button>
              <button onClick={()=>deletePayslip(viewSlip.id)} className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
