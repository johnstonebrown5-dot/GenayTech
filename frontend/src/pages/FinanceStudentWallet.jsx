import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  PlusCircle, 
  MinusCircle, 
  History, 
  Download, 
  User, 
  Wallet,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import api from '../api';

export default function FinanceStudentWallet() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true); // overall first paint
  const [headerLoading, setHeaderLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [transactionType, setTransactionType] = useState('deposit');
  const [formData, setFormData] = useState({ amount: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  // Filters
  const [filterType, setFilterType] = useState(''); // '', 'deposit', 'withdrawal'
  const [dateFrom, setDateFrom] = useState(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState('');

  // Search modal state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStudents, setSearchStudents] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setHeaderLoading(true);
      try {
        // Fetch student and wallet in parallel
        const [sres, wres0] = await Promise.all([
          api.get(`/academics/students/${studentId}/`),
          api.get(`/finance/pocket-money-wallets/?student=${studentId}`),
        ]);
        setStudent(sres.data);
        let w = Array.isArray(wres0.data) ? (wres0.data[0] || null) : ((wres0.data.results && wres0.data.results[0]) || null);
        if (!w) {
          await api.post('/finance/pocket-money-wallets/', { student: Number(studentId), balance: 0 });
          const wres1 = await api.get(`/finance/pocket-money-wallets/?student=${studentId}`);
          w = Array.isArray(wres1.data) ? (wres1.data[0] || null) : ((wres1.data.results && wres1.data.results[0]) || null);
        }
        setWallet(w);
        // Start table load but don't block header render
        fetchTransactions(1, pageSize, w?.id);
      } catch (e) {
        console.error('Failed to load student wallet:', e);
      } finally {
        setHeaderLoading(false);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const fetchAbortRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchTransactions = async (p = 1, ps = 20, walletId = null) => {
    if (!walletId && !wallet?.id) return;
    const wid = walletId || wallet.id;
    try {
      // cancel any in-flight
      if (fetchAbortRef.current) {
        try { fetchAbortRef.current.abort(); } catch (_) {}
      }
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      setTableLoading(true);
      // Use server-side type filter when provided
      const typeParam = filterType ? `&transaction_type=${filterType}` : '';
      const res = await api.get(`/finance/pocket-money-transactions/?wallet=${wid}&page=${p}&page_size=${ps}&ordering=-created_at${typeParam}`, { signal: controller.signal });
      const payload = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      // Total from server or current page size if not paginated
      const total = typeof res.data?.count === 'number' ? res.data.count : payload.length;
      // Apply client-side date filtering
      const fromTs = dateFrom ? Date.parse(dateFrom + 'T00:00:00') : null;
      const toTs = dateTo ? Date.parse(dateTo + 'T23:59:59') : null;
      const filtered = payload.filter(tx => {
        const t = Date.parse(tx.created_at);
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
        return true;
      });
      filtered.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setTotalCount(total);
      setTransactions(filtered);
      setPage(p);
    } catch (e) {
      if (e?.name !== 'CanceledError' && e?.name !== 'AbortError') {
        console.error('Failed to load transactions:', e);
      }
    } finally {
      setTableLoading(false);
    }
  };

  const openForm = (type) => {
    setTransactionType(type);
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wallet?.id) return;
    if (!formData.amount || Number(formData.amount) <= 0) {
      setAlert({ type: 'error', message: 'Enter a valid amount greater than 0' });
      return;
    }
    if (transactionType === 'withdrawal' && Number(formData.amount) > Number(wallet.balance)) {
      setAlert({ type: 'error', message: `Insufficient balance. Current balance is KES ${Number(wallet.balance).toLocaleString()}` });
      return;
    }
    try {
      setIsSaving(true);
      await api.post('/finance/pocket-money-transactions/', {
        wallet: wallet.id,
        transaction_type: transactionType,
        ...formData,
      });
      // Refresh wallet and transactions
      const wref = await api.get(`/finance/pocket-money-wallets/?student=${studentId}`);
      const w = Array.isArray(wref.data) ? (wref.data[0] || null) : ((wref.data.results && wref.data.results[0]) || null);
      if (w) setWallet(w);
      await fetchTransactions(1, pageSize, w?.id || wallet.id);
      setAlert({ type: 'success', message: `${transactionType === 'deposit' ? 'Deposit' : 'Withdrawal'} successful` });
      setShowForm(false);
      setFormData({ amount: '', description: '' });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.amount?.[0] || 'Failed to save transaction' });
    } finally {
      setIsSaving(false);
    }
  };

  // CSV export of current (filtered) transactions
  const handleExportCsv = () => {
    try {
      const headers = ['Date','Type','Amount','Description'];
      const rows = [headers];
      for (const tx of transactions) {
        rows.push([
          new Date(tx.created_at).toLocaleString(),
          tx.transaction_type,
          String(tx.amount),
          (tx.description || '').replaceAll('\n',' ').replaceAll('\r',' '),
        ]);
      }
      const csv = rows.map(r => r.map(v => {
        const val = String(v ?? '');
        const needsWrap = /[",\n]/.test(val);
        const escaped = val.replaceAll('"','""');
        return needsWrap ? `"${escaped}"` : escaped;
      }).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const d = new Date();
      const pad = (n) => String(n).padStart(2,'0');
      a.download = `wallet_${studentId}_transactions_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-24 rounded-2xl bg-gray-100" />
        <div className="h-64 rounded-2xl bg-gray-100" />
      </div>
    );
  }
  if (!student || !wallet) return <div className="p-6">Not found</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Toast Notification */}
      {alert && (
        <div className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
          alert.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {alert.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{alert.message}</span>
          <button onClick={() => setAlert(null)} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{student.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white/20 text-white/90 text-xs font-medium uppercase tracking-wider">
                    {student.admission_no}
                  </span>
                  <span className="text-white/60 text-sm">•</span>
                  <span className="text-white/80 text-sm font-medium">Pocket Money Wallet</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col items-end">
              <div className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">Current Balance</div>
              <div className="text-3xl font-black text-white tabular-nums">
                {new Intl.NumberFormat(undefined, { 
                  style: 'currency', 
                  currency: 'KES', 
                  minimumFractionDigits: 0 
                }).format(Number(wallet.balance))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-3">
          <button 
            onClick={() => openForm('deposit')} 
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-200"
          >
            <PlusCircle className="w-4 h-4" />
            Deposit
          </button>
          <button 
            onClick={() => openForm('withdrawal')} 
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-200"
          >
            <MinusCircle className="w-4 h-4" />
            Withdraw
          </button>
          <div className="flex-1" />
          <button 
            onClick={async () => {
              setSearchOpen(true);
              if (searchStudents.length === 0) {
                try {
                  setSearchLoading(true);
                  const res = await api.get('/academics/students/?page_size=10000');
                  const payload = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                  setSearchStudents(payload);
                } catch (e) { console.error('Failed to load students', e); }
                finally { setSearchLoading(false); }
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 transition-all"
          >
            <Search className="w-4 h-4" />
            Find Student
          </button>
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 animate-in zoom-in-95 duration-200 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              transactionType === 'deposit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}>
              {transactionType === 'deposit' ? <PlusCircle className="w-6 h-6" /> : <MinusCircle className="w-6 h-6" />}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {transactionType === 'deposit' ? 'New Deposit' : 'New Withdrawal'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-bold text-gray-700 ml-1">Amount (KES)</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">KES</div>
                <input 
                  disabled={isSaving} 
                  type="number" 
                  id="amount" 
                  name="amount" 
                  placeholder="0.00"
                  value={formData.amount} 
                  onChange={handleInputChange} 
                  className="block w-full bg-gray-50 border-0 rounded-2xl py-4 pl-14 pr-4 text-xl font-bold focus:ring-2 focus:ring-gray-900 transition-all disabled:opacity-50" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-bold text-gray-700 ml-1">Description (Optional)</label>
              <textarea 
                disabled={isSaving} 
                id="description" 
                name="description" 
                value={formData.description} 
                onChange={handleInputChange} 
                rows="3" 
                placeholder="Add a note about this transaction..."
                className="block w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all disabled:opacity-50"
              ></textarea>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                disabled={isSaving} 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="flex-1 py-3 rounded-2xl text-sm font-bold bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                disabled={isSaving} 
                type="submit" 
                className="flex-[2] py-3 rounded-2xl text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Transaction
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
              <History className="w-5 h-5 text-gray-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Transaction History</h2>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3">
            <div className="relative group col-span-2 sm:col-span-1 sm:min-w-[140px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={filterType} 
                onChange={(e)=>{ setFilterType(e.target.value); fetchTransactions(1, pageSize); }} 
                className="w-full bg-gray-50 border-0 rounded-xl py-2 pl-9 pr-4 text-sm font-semibold focus:ring-2 focus:ring-gray-900"
              >
                <option value="">All Types</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
            </div>
            <div className="sm:min-w-[140px]">
              <input 
                type="date" 
                value={dateFrom} 
                onChange={(e)=>{ setDateFrom(e.target.value); fetchTransactions(1, pageSize); }} 
                className="w-full bg-gray-50 border-0 rounded-xl py-2 px-3 text-sm font-semibold focus:ring-2 focus:ring-gray-900" 
              />
            </div>
            <div className="sm:min-w-[140px]">
              <input 
                type="date" 
                value={dateTo} 
                onChange={(e)=>{ setDateTo(e.target.value); fetchTransactions(1, pageSize); }} 
                className="w-full bg-gray-50 border-0 rounded-xl py-2 px-3 text-sm font-semibold focus:ring-2 focus:ring-gray-900" 
              />
            </div>
            <div className="sm:min-w-[100px]">
              <select 
                value={pageSize} 
                onChange={(e)=>{ setPageSize(Number(e.target.value)); fetchTransactions(1, Number(e.target.value)); }} 
                className="w-full bg-gray-50 border-0 rounded-xl py-2 px-3 text-sm font-semibold focus:ring-2 focus:ring-gray-900"
              >
                {[10,20,50,100].map(n => <option key={n} value={n}>{n} rows</option>)}
              </select>
            </div>
            <button 
              type="button" 
              onClick={handleExportCsv} 
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gray-50 text-gray-900 hover:bg-gray-100 transition-all border border-gray-100"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400">Date & Time</th>
                <th className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400">Type</th>
                <th className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Amount</th>
                <th className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tableLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-8 py-5"><div className="h-4 bg-gray-100 rounded-full w-40"/></td>
                    <td className="px-8 py-5"><div className="h-6 bg-gray-100 rounded-lg w-20"/></td>
                    <td className="px-8 py-5 flex justify-end"><div className="h-4 bg-gray-100 rounded-full w-24"/></td>
                    <td className="px-8 py-5"><div className="h-4 bg-gray-100 rounded-full w-64"/></td>
                  </tr>
                ))
              )}
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {new Date(tx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      tx.transaction_type === 'deposit' 
                      ? 'bg-emerald-50 text-emerald-600' 
                      : 'bg-rose-50 text-rose-600'
                    }`}>
                      {tx.transaction_type === 'deposit' ? <PlusCircle className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                      {tx.transaction_type}
                    </span>
                  </td>
                  <td className={`px-8 py-4 text-right tabular-nums font-black ${
                    tx.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {tx.transaction_type === 'deposit' ? '+' : '-'}
                    {Number(tx.amount).toLocaleString()}
                  </td>
                  <td className="px-8 py-4">
                    <div className="text-sm text-gray-600 max-w-xs truncate group-hover:max-w-none group-hover:whitespace-normal transition-all">
                      {tx.description || <span className="text-gray-300 italic">No description</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {(!tableLoading && transactions.length === 0) && (
                <tr>
                  <td className="px-8 py-12 text-center" colSpan={4}>
                    <div className="flex flex-col items-center justify-center grayscale opacity-20">
                      <History className="w-12 h-12 mb-2" />
                      <p className="text-sm font-bold tracking-tight">No transactions yet</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row items-center sm:justify-between gap-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))} <span className="mx-2 opacity-30">|</span> {totalCount} total entries
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={page <= 1} 
              onClick={()=> fetchTransactions(page-1, pageSize)} 
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              disabled={page >= Math.ceil(totalCount / pageSize)} 
              onClick={()=> fetchTransactions(page+1, pageSize)} 
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSearchOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Search className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Find Student</h3>
                </div>
                <button onClick={() => setSearchOpen(false)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-gray-900 transition-colors" />
                <input
                  type="text"
                  placeholder="Admission No. or Name..."
                  value={searchQuery}
                  onChange={(e)=> setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-gray-900 font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900 transition-all"
                  autoFocus
                />
              </div>

              <div className="mt-6 max-h-[400px] overflow-auto rounded-2xl border border-gray-100 bg-gray-50/50 divide-y divide-gray-100">
                {searchLoading && (
                  <div className="p-8 text-center">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-400">Searching students...</p>
                  </div>
                )}
                {!searchLoading && searchStudents
                  .filter(s => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (s.admission_no || '').toLowerCase().includes(q) ||
                      (s.name || '').toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 50)
                  .map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSearchOpen(false); navigate(`/finance/pocket-money/wallet/${s.id}`); }}
                      className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-white transition-all group"
                    >
                      <div>
                        <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{s.name}</div>
                        <div className="text-xs font-bold text-gray-400 tracking-wider uppercase mt-0.5">{s.admission_no}</div>
                      </div>
                      <div className="text-right">
                        <div className="px-2 py-1 rounded-md bg-gray-100 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                          {s?.klass_detail?.name || '—'}
                        </div>
                      </div>
                    </button>
                  ))}
                {!searchLoading && searchStudents.length === 0 && (
                  <div className="p-12 text-center">
                    <User className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm font-bold text-gray-400">No students found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
