import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { 
    Plus, 
    Search, 
    Filter, 
    FileText, 
    Printer, 
    Calendar, 
    Users, 
    Tag, 
    DollarSign, 
    X,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    ArrowUpDown,
    Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Modal from '../components/Modal';

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

    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

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
            toast.error('Description is required');
            return;
        }
        if (!String(formData.payee||'').trim()){
            toast.error('Payee is required');
            return;
        }
        if (!formData.amount || Number(formData.amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setSubmitting(true);
        try {
            const payload = { ...formData };
            if (!payload.category) payload.category = null;
            const { data } = await api.post('/finance/expenses/', payload);
            setExpenses(prev => [data, ...prev]);
            toast.success('Expense recorded successfully');
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
            toast.error(error.response?.data?.detail || 'Failed to record expense');
        } finally {
            setSubmitting(false);
        }
    };

    function printExpenseReceipt(exp){
        try{
            const catName = (Array.isArray(categories)?categories:[]).find(c=>c.id===exp.categoryId || c.id===exp.category)?.name || '';
            const payee = exp.payee || exp.payeeName || '';
            const logo = school?.logo_url || ''
            const schoolName = school?.name || 'Genay Technologies'
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
                <div style="margin-top:18px;font-size:12px;color:#6b7280">Generated by Genay Technologies</div>
              </div>
            </body></html>`
            const w = window.open('', '_blank'); if(!w) return; w.document.write(html); w.document.close(); w.focus(); w.print();
        }catch{}
    }

    const filteredRows = useMemo(() => {
        let rows = displayRows;
        
        if (selectedCategory !== 'all') {
            rows = rows.filter(r => String(r.categoryId) === selectedCategory);
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            rows = rows.filter(r => 
                r.payeeName.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q) ||
                (r.categoryName && r.categoryName.toLowerCase().includes(q))
            );
        }

        return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [displayRows, searchTerm, selectedCategory]);

    const stats = useMemo(() => {
        const total = displayRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const count = displayRows.length;
        const categoriesCount = new Set(displayRows.map(r => r.categoryId).filter(Boolean)).size;
        return { total, count, categoriesCount };
    }, [displayRows]);

    return (
        <div className="space-y-6 pb-10">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-2xl">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                                <DollarSign className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h1 className="text-3xl font-extrabold tracking-tight">Expenses</h1>
                        </div>
                        <p className="text-slate-400 text-sm max-w-md">
                            Track and manage school expenditures, vendor payments, and staff disbursements.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button 
                            onClick={() => {
                                const csv = [
                                    ['Date', 'Payee', 'Category', 'Amount', 'Description'],
                                    ...filteredRows.map(r => [r.date, r.payeeName, r.categoryName, r.amount, r.description])
                                ].map(e => e.join(",")).join("\n");
                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.setAttribute("href", url);
                                link.setAttribute("download", `expenses_${new Date().toISOString().split('T')[0]}.csv`);
                                link.click();
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-sm font-semibold transition-all border border-white/10"
                        >
                            <Download className="w-4 h-4 text-slate-300" />
                            Export CSV
                        </button>
                        <button 
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            Record Expense
                        </button>
                    </div>
                </div>

                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -u-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -u-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Expenditure</p>
                            <h3 className="text-2xl font-bold text-slate-900">KES {stats.total.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Transactions</p>
                            <h3 className="text-2xl font-bold text-slate-900">{stats.count}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                            <Tag className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Categories Used</p>
                            <h3 className="text-2xl font-bold text-slate-900">{stats.categoriesCount}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search payee, description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="flex-1 md:w-48 pl-4 pr-10 py-2.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                    >
                        <option value="all">All Categories</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-2xl text-sm text-slate-600 cursor-pointer hover:bg-slate-100 transition-all select-none whitespace-nowrap">
                        <input 
                            type="checkbox" 
                            checked={includePayslips} 
                            onChange={e=>setIncludePayslips(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/20"
                        />
                        Staff Payslips
                    </label>
                </div>
            </div>

            {/* Main Content Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payee / Entity</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                                            <p className="text-slate-500 text-sm">Loading expenses...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRows.length > 0 ? (
                                filteredRows.map((e) => (
                                    <tr key={`${e.kind}-${e.id}`} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-900">
                                                    {new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                                </span>
                                                <span className="text-[10px] text-slate-400 uppercase">
                                                    {new Date(e.date).getFullYear()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${e.kind === 'payslip' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'}`}>
                                                    {e.kind === 'payslip' ? <Users className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                                                </div>
                                                <span className="text-sm font-medium text-slate-700">{e.payeeName || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                e.kind === 'payslip' 
                                                ? 'bg-blue-100 text-blue-700' 
                                                : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {e.categoryName || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-900">
                                                KES {Number(e.amount || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-slate-500 max-w-xs truncate" title={e.description}>
                                                {e.description}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {e.kind === 'expense' && (
                                                <button 
                                                    onClick={() => printExpenseReceipt(e)}
                                                    className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                    title="Print Receipt"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle className="w-10 h-10 text-slate-200" />
                                            <p className="text-slate-400 text-sm">No expenses found matching your filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Recording Expense */}
            <Modal
                isOpen={showForm}
                onClose={() => !submitting && setShowForm(false)}
                title="Record New Expense"
                maxWidth="max-w-xl"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="date" 
                                    name="date" 
                                    value={formData.date} 
                                    onChange={handleInputChange}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Amount (KES)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="number" 
                                    name="amount" 
                                    value={formData.amount} 
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Payee / Vendor</label>
                        <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                name="payee" 
                                value={formData.payee} 
                                onChange={handleInputChange}
                                placeholder="Enter name of payee"
                                required
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Category</label>
                        <select 
                            name="category" 
                            value={formData.category} 
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select a category (optional)</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Description</label>
                        <textarea 
                            name="description" 
                            value={formData.description} 
                            onChange={handleInputChange}
                            rows="3"
                            placeholder="Provide details about this expenditure..."
                            required
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                        ></textarea>
                    </div>

                    <div className="flex items-center gap-3 pt-4">
                        <button 
                            type="button" 
                            onClick={() => setShowForm(false)}
                            disabled={submitting}
                            className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-[2] flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Recording...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Save Expense
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
