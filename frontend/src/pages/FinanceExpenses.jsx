import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';

export default function FinanceExpenses() {
    const todayStr = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
    };
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [school, setSchool] = useState(null);
    const [includePayslips, setIncludePayslips] = useState(false);
    const [payslips, setPayslips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        payee: '',
        category: '',
        amount: '',
        description: '',
        date: todayStr(),
    });

    useEffect(() => {
        (async () => {
            try {
                const [expRes, catRes, schRes, psRes] = await Promise.all([
                    api.get('/finance/expenses/'),
                    api.get('/finance/expense-categories/'),
                    api.get('/auth/school/info/').catch(()=>({ data:null })),
                    api.get('/finance/staff-payslips/').catch(()=>({ data:[] })),
                ]);
                const expArr = Array.isArray(expRes.data) ? expRes.data : (Array.isArray(expRes.data?.results) ? expRes.data.results : []);
                const catArr = Array.isArray(catRes.data) ? catRes.data : (Array.isArray(catRes.data?.results) ? catRes.data.results : []);
                setExpenses(expArr);
                setCategories(catArr);
                setSchool(schRes?.data || null);
                const psArr = Array.isArray(psRes.data) ? psRes.data : (Array.isArray(psRes.data?.results) ? psRes.data.results : []);
                setPayslips(psArr);
            } catch (e) {
                console.error("Failed to load expenses:", e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!String(formData.description||'').trim()){
            alert('Description is required');
            return;
        }
        if (!String(formData.payee||'').trim()){
            alert('Payee is required');
            return;
        }
        try {
            const payload = { ...formData };
            // Send null for optional category if blank
            if (!payload.category) payload.category = null;
            const { data } = await api.post('/finance/expenses/', payload);
            setExpenses(prev => [data, ...prev]);
            setShowForm(false);
            setFormData({
                payee: '',
                category: '',
                amount: '',
                description: '',
                date: todayStr(),
            });
        } catch (error) {
            console.error("Failed to create expense:", error);
        }
    };

    function printExpenseReceipt(exp){
        try{
            const catName = (Array.isArray(categories)?categories:[]).find(c=>c.id===exp.categoryId || c.id===exp.category)?.name || '';
            const payee = exp.payee || exp.payeeName || '';
            const logo = school?.logo_url || ''
            const schoolName = school?.name || 'EDU-TRACK'
            const now = new Date();
            const html = `<!doctype html><html><head><meta charset="utf-8" />
            <title>Expense Receipt ${exp.id||''}</title>
            <style>
              @page { size: A5 portrait; margin: 10mm; }
              body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827}
              .wrap{border:1px solid #e5e7eb;border-radius:8px;padding:12px}
              .hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px}
              .sch{display:flex;align-items:center;gap:10px}
              .sch img{width:48px;height:48px;object-fit:contain}
              .title{font-weight:800;font-size:18px}
              table{width:100%;border-collapse:collapse}
              th,td{padding:8px 10px;border-top:1px solid #e5e7eb;font-size:12px}
              thead th{background:#f3f4f6;text-align:left}
              .tot{font-weight:700;border-top:2px solid #9ca3af}
            </style></head><body>
              <div class="wrap">
                <div class="hdr">
                  <div class="sch">${logo? `<img src="${logo}" alt=""/>`: ''}<div><div class="title">${schoolName}</div><div style="font-size:12px;color:#4b5563">Expense Receipt</div></div></div>
                  <div style="font-size:12px;color:#334155;text-align:right">Date: ${String(exp.date||now).toString().slice(0,10)}<br/>Receipt: EXP-${exp.id||''}</div>
                </div>
                <table>
                  <thead><tr><th>Payee</th><th>Category</th><th>Description</th><th align="right">Amount (KES)</th></tr></thead>
                  <tbody>
                    <tr><td>${(payee||'').replaceAll('<','&lt;')}</td><td>${(catName||'').replaceAll('<','&lt;')}</td><td>${(exp.description||'').replaceAll('<','&lt;')}</td><td align="right">${Number(exp.amount||0).toLocaleString()}</td></tr>
                    <tr class="tot"><td colspan="3" align="right">Total</td><td align="right">${Number(exp.amount||0).toLocaleString()}</td></tr>
                  </tbody>
                </table>
                <div style="margin-top:18px;font-size:12px;color:#6b7280">Generated by EDU-TRACK</div>
              </div>
            </body></html>`
            const w = window.open('', '_blank'); if(!w) return; w.document.write(html); w.document.close(); w.focus(); w.print();
        }catch{}
    }

    const displayRows = useMemo(()=>{
        const base = (Array.isArray(expenses)?expenses:[]).map(e=>({
            kind:'expense',
            id:e.id,
            date:e.date,
            categoryId:e.category,
            categoryName:(Array.isArray(categories)?categories:[]).find(c=>c.id===e.category)?.name,
            payeeName: e.payee || '',
            amount:e.amount,
            description:e.description
        }))
        if (!includePayslips) return base
        const ps = (Array.isArray(payslips)?payslips:[]).map(p=>({
            kind:'payslip',
            id:p.id,
            date:p.created_at || `${p.year}-${String(p.month).padStart(2,'0')}-01`,
            categoryId:null,
            categoryName:`Payslip – ${p.staff_name||''}`,
            payeeName: p.staff_name || '',
            amount:p.net_pay ?? p.gross_pay ?? 0,
            description:`Payslip for ${String(p.month).padStart(2,'0')}/${p.year}`
        }))
        return [...base, ...ps].sort((a,b)=> String(a.date).localeCompare(String(b.date)))
    }, [expenses, categories, includePayslips, payslips])

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
                <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 shadow-soft w-full sm:w-auto">Add Expense</button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">New Expense</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="payee" className="block text-sm font-medium text-gray-700">Payee<span className="text-rose-600"> *</span></label>
                            <input type="text" id="payee" name="payee" value={formData.payee} onChange={handleInputChange} required placeholder="Name of the payee/vendor" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            <div className="text-xs text-gray-500 mt-1">Who is being paid (e.g., supplier, staff, landlord).</div>
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category (optional)</label>
                            <select id="category" name="category" value={formData.category} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a category</option>
                                {(Array.isArray(categories) ? categories : []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" id="amount" name="amount" value={formData.amount} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description<span className="text-rose-600"> *</span></label>
                            <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="3" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                        </div>
                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                            <input type="date" id="date" name="date" value={formData.date} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
                            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Save Expense</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Expense List</h2>
                <div className="mb-3 flex items-center gap-3 text-sm">
                    <label className="inline-flex items-center gap-2 select-none"><input type="checkbox" checked={includePayslips} onChange={e=>setIncludePayslips(e.target.checked)} /> Include Staff Payslips</label>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Payee</th>
                                <th scope="col" className="px-6 py-3">Category</th>
                                <th scope="col" className="px-6 py-3">Amount</th>
                                <th scope="col" className="px-6 py-3">Description</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.isArray(displayRows) && displayRows.length > 0 ? (
                                displayRows.map(e => (
                                    <tr key={e.id} className="bg-white border-b">
                                        <td className="px-6 py-4">{new Date(e.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">{e.payeeName || '-'}</td>
                                        <td className="px-6 py-4">{e.categoryName || (Array.isArray(categories)?categories:[]).find(c => c.id === e.categoryId)?.name || '-'}</td>
                                        <td className="px-6 py-4">KES {Number(e.amount || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4">{e.description}</td>
                                        <td className="px-6 py-4 text-right">
                                          {e.kind==='expense' && (
                                            <button onClick={()=>printExpenseReceipt(e)} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50">Print Receipt</button>
                                          )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="px-6 py-6 text-gray-500" colSpan={5}>{loading ? 'Loading…' : 'No expenses found.'}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
