import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api'
import FinanceLayout from '../components/FinanceLayout'
import Modal from '../components/Modal'
import { useNotification } from '../components/NotificationContext'

export function FinanceStaffPayrollContent(){
  const [staff, setStaff] = useState([])
  const [payrolls, setPayrolls] = useState([])
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading] = useState(true)
  const { search } = useLocation()
  const staffParam = useMemo(()=>{
    try { return new URLSearchParams(search).get('staff') || '' } catch { return '' }
  },[search])

  const [showCreatePayroll, setShowCreatePayroll] = useState(false)
  const [cpForm, setCpForm] = useState({ staff:'', base_salary:'' })
  const [savingCP, setSavingCP] = useState(false)

  const [showCreatePayslip, setShowCreatePayslip] = useState(false)
  const [slipForm, setSlipForm] = useState({ staff:'', year:'', month:'', basic:'', allowances:'[]', deductions:'[]', notes:'' })
  const [savingSlip, setSavingSlip] = useState(false)

  const { showSuccess, showError } = useNotification()

  const load = async () => {
    try{
      setLoading(true)
      const [s, p, slips] = await Promise.all([
        api.get('/auth/non-teaching-staff/'),
        api.get('/finance/staff-payroll/'),
        api.get('/finance/staff-payslips/')
      ])
      const sArr = Array.isArray(s.data)? s.data : (Array.isArray(s.data?.results)? s.data.results: [])
      const pArr = Array.isArray(p.data)? p.data : (Array.isArray(p.data?.results)? p.data.results: [])
      const psArr = Array.isArray(slips.data)? slips.data : (Array.isArray(slips.data?.results)? slips.data.results: [])
      setStaff(sArr)
      setPayrolls(pArr)
      setPayslips(psArr)
    }catch(err){
      showError('Failed to Load', 'Could not load staff payroll data')
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() },[])

  const staffOptions = useMemo(()=> (Array.isArray(staff)?staff:[]).map(s=>({ id:s.id, label:`${s?.user?.first_name||''} ${s?.user?.last_name||''}`.trim()||s?.user?.username||`#${s.id}` })), [staff])
  const staffLabel = (id) => staffOptions.find(o=>String(o.id)===String(id))?.label || `#${id}`

  useEffect(()=>{
    if (staffParam) {
      setCpForm(f=> ({ ...f, staff: String(staffParam) }))
      setSlipForm(f=> ({ ...f, staff: String(staffParam) }))
    }
  },[staffParam])

  const filteredPayrolls = useMemo(()=>{
    const arr = Array.isArray(payrolls)? payrolls: []
    if (!staffParam) return arr
    return arr.filter(p => String(p.staff)===String(staffParam))
  },[payrolls, staffParam])

  const filteredPayslips = useMemo(()=>{
    const arr = Array.isArray(payslips)? payslips: []
    if (!staffParam) return arr
    return arr.filter(slip => String(slip.staff)===String(staffParam))
  },[payslips, staffParam])

  const createPayroll = async (e) => {
    e.preventDefault()
    try{
      setSavingCP(true)
      await api.post('/finance/staff-payroll/', { staff: Number(cpForm.staff), base_salary: Number(cpForm.base_salary||0), allowances: [], deductions: [] })
      setShowCreatePayroll(false)
      setCpForm({ staff:'', base_salary:'' })
      await load()
      showSuccess('Saved', 'Staff payroll created')
    }catch(err){
      showError('Failed', err?.response?.data?.detail || 'Could not create payroll')
    }finally{
      setSavingCP(false)
    }
  }

  const createPayslip = async (e) => {
    e.preventDefault()
    try{
      setSavingSlip(true)
      let allowances = []
      let deductions = []
      try{ allowances = JSON.parse(slipForm.allowances||'[]') }catch{}
      try{ deductions = JSON.parse(slipForm.deductions||'[]') }catch{}
      await api.post('/finance/staff-payslips/', {
        staff: Number(slipForm.staff),
        year: Number(slipForm.year),
        month: Number(slipForm.month),
        basic: Number(slipForm.basic||0),
        allowances,
        deductions,
        notes: slipForm.notes||''
      })
      setShowCreatePayslip(false)
      setSlipForm({ staff:'', year:'', month:'', basic:'', allowances:'[]', deductions:'[]', notes:'' })
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Staff Payroll</h1>
            <p className="text-sm text-gray-600">Manage non-teaching staff payroll configurations and payslips.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowCreatePayroll(true)} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white">New Payroll</button>
            <button onClick={()=>setShowCreatePayslip(true)} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white">New Payslip</button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-4 md:p-5">
            <h2 className="text-base font-semibold mb-3">Payroll Config</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-3">Staff</th>
                    <th className="py-2 px-3">Base Salary</th>
                    <th className="py-2 px-3">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="py-6 text-center text-gray-500">Loading...</td></tr>
                  ) : (Array.isArray(filteredPayrolls)?filteredPayrolls:[]).length===0 ? (
                    <tr><td colSpan={3} className="py-6 text-center text-gray-500">No payroll configs.</td></tr>
                  ) : (
                    (filteredPayrolls||[]).map(p => (
                      <tr key={p.id} className="border-t">
                        <td className="py-2 px-3">{staffLabel(p.staff)}</td>
                        <td className="py-2 px-3">{Number(p.base_salary||0).toLocaleString()}</td>
                        <td className="py-2 px-3">{p.is_active? 'Yes':'No'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-4 md:p-5">
            <h2 className="text-base font-semibold mb-3">Payslips</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-3">Staff</th>
                    <th className="py-2 px-3">Period</th>
                    <th className="py-2 px-3">Gross</th>
                    <th className="py-2 px-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-500">Loading...</td></tr>
                  ) : (Array.isArray(filteredPayslips)?filteredPayslips:[]).length===0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-500">No payslips.</td></tr>
                  ) : (
                    (filteredPayslips||[]).map(slip => (
                      <tr key={slip.id} className="border-t">
                        <td className="py-2 px-3">{staffLabel(slip.staff)}</td>
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

        <Modal open={showCreatePayroll} onClose={()=>!savingCP && setShowCreatePayroll(false)} title="New Payroll" size="lg">
          <form onSubmit={createPayroll} className="grid gap-3 md:grid-cols-2">
            <select className="border p-2 rounded" value={cpForm.staff} onChange={e=>setCpForm({...cpForm, staff:e.target.value})}>
              <option value="">Select Staff</option>
              {staffOptions.map(o=> <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <input className="border p-2 rounded" placeholder="Base Salary" type="number" value={cpForm.base_salary} onChange={e=>setCpForm({...cpForm, base_salary:e.target.value})} />
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow" disabled={savingCP || !cpForm.staff}>
                {savingCP? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal open={showCreatePayslip} onClose={()=>!savingSlip && setShowCreatePayslip(false)} title="New Payslip" size="lg">
          <form onSubmit={createPayslip} className="grid gap-3 md:grid-cols-2">
            <select className="border p-2 rounded" value={slipForm.staff} onChange={e=>setSlipForm({...slipForm, staff:e.target.value})}>
              <option value="">Select Staff</option>
              {staffOptions.map(o=> <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <input className="border p-2 rounded" placeholder="Year (e.g., 2025)" type="number" value={slipForm.year} onChange={e=>setSlipForm({...slipForm, year:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Month (1-12)" type="number" value={slipForm.month} onChange={e=>setSlipForm({...slipForm, month:e.target.value})} />
            <input className="border p-2 rounded" placeholder="Basic" type="number" value={slipForm.basic} onChange={e=>setSlipForm({...slipForm, basic:e.target.value})} />
            <textarea className="border p-2 rounded md:col-span-2" rows={3} placeholder='Allowances JSON array, e.g., [{"name":"Transport","amount":2000}]' value={slipForm.allowances} onChange={e=>setSlipForm({...slipForm, allowances:e.target.value})} />
            <textarea className="border p-2 rounded md:col-span-2" rows={3} placeholder='Deductions JSON array, e.g., [{"name":"NHIF","amount":500}]' value={slipForm.deductions} onChange={e=>setSlipForm({...slipForm, deductions:e.target.value})} />
            <input className="border p-2 rounded md:col-span-2" placeholder="Notes" value={slipForm.notes} onChange={e=>setSlipForm({...slipForm, notes:e.target.value})} />
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow" disabled={savingSlip || !slipForm.staff || !slipForm.year || !slipForm.month}>
                {savingSlip? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
  )
}

export default function FinanceStaffPayroll(){
  return (
    <FinanceLayout>
      <FinanceStaffPayrollContent />
    </FinanceLayout>
  )
}
