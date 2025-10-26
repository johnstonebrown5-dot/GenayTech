import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
      alert('Enter a valid amount greater than 0');
      return;
    }
    try {
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
      setShowForm(false);
      setFormData({ amount: '', description: '' });
    } catch (err) {
      console.error('Failed to save transaction:', err);
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{student.name} ({student.admission_no})</h1>
          <p className="text-sm text-gray-600">Pocket Money Wallet</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-700">Current Balance</div>
          <div className="text-2xl font-bold">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(Number(wallet.balance))}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => openForm('deposit')} className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 w-full sm:w-auto">Deposit</button>
        <button onClick={() => openForm('withdrawal')} className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 w-full sm:w-auto">Withdraw</button>
        <div className="sm:flex-1" />
        <button onClick={async () => {
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
          className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 w-full sm:w-auto">
          Search Student
        </button>
        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 w-full sm:w-auto">Back</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{transactionType === 'deposit' ? 'New Deposit' : 'New Withdrawal'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
              <input type="number" id="amount" name="amount" value={formData.amount} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="3" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
            </div>
            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Save</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
          <div className="flex flex-wrap items-end gap-3 text-sm w-full sm:w-auto">
            <div className="min-w-[140px]">
              <label className="block text-xs text-gray-500">Type</label>
              <select value={filterType} onChange={(e)=>{ setFilterType(e.target.value); fetchTransactions(1, pageSize); }} className="mt-1 border border-gray-300 rounded-md py-1 px-2 w-full">
                <option value="">All</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs text-gray-500">From</label>
              <input type="date" value={dateFrom} onChange={(e)=>{ setDateFrom(e.target.value); fetchTransactions(1, pageSize); }} className="mt-1 border border-gray-300 rounded-md py-1 px-2 w-full" />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs text-gray-500">To</label>
              <input type="date" value={dateTo} onChange={(e)=>{ setDateTo(e.target.value); fetchTransactions(1, pageSize); }} className="mt-1 border border-gray-300 rounded-md py-1 px-2 w-full" />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs text-gray-500">Page size</label>
              <select value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); fetchTransactions(1, Number(e.target.value)); }} className="mt-1 border border-gray-300 rounded-md py-1 px-2 w-full">
                {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button type="button" onClick={handleExportCsv} className="sm:ml-2 w-full sm:w-auto px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Export CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {tableLoading && (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b animate-pulse">
                    <td className="px-6 py-3"><div className="h-4 bg-gray-100 rounded w-40"/></td>
                    <td className="px-6 py-3"><div className="h-4 bg-gray-100 rounded w-24"/></td>
                    <td className="px-6 py-3"><div className="h-4 bg-gray-100 rounded w-24"/></td>
                    <td className="px-6 py-3"><div className="h-4 bg-gray-100 rounded w-56"/></td>
                  </tr>
                ))
              )}
              {transactions.map(tx => (
                <tr key={tx.id} className="bg-white border-b">
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 capitalize">{tx.transaction_type}</td>
                  <td className="px-6 py-4">KES {Number(tx.amount).toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-600">{tx.description || ''}</td>
                </tr>
              ))}
              {(!tableLoading && transactions.length === 0) && (
                <tr>
                  <td className="px-6 py-6 text-gray-500" colSpan={4}>No transactions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 mt-4 text-sm text-gray-700">
          <div>
            Showing page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))} ({totalCount} total)
          </div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={()=> fetchTransactions(page-1, pageSize)} className={`px-3 py-1 rounded border ${page<=1 ? 'text-gray-400 border-gray-200' : 'text-gray-800 border-gray-300 hover:bg-gray-50'}`}>Prev</button>
            <button disabled={page >= Math.ceil(totalCount / pageSize)} onClick={()=> fetchTransactions(page+1, pageSize)} className={`px-3 py-1 rounded border ${page >= Math.ceil(totalCount / pageSize) ? 'text-gray-400 border-gray-200' : 'text-gray-800 border-gray-300 hover:bg-gray-50'}`}>Next</button>
          </div>
        </div>
      </div>

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSearchOpen(false)}></div>
          <div className="relative bg-white w-full max-w-xl mx-4 rounded-2xl shadow-card border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Find Student</h3>
              <button onClick={() => setSearchOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <input
              type="text"
              placeholder="Search by Admission No. or Name"
              value={searchQuery}
              onChange={(e)=> setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="mt-3 max-h-80 overflow-auto border border-gray-200 rounded-md divide-y">
              {searchLoading && <div className="p-3 text-sm text-gray-500">Loading students...</div>}
              {!searchLoading && searchStudents
                .filter(s => {
                  const q = searchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (s.admission_no || '').toLowerCase().includes(q) ||
                    (s.name || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 100)
                .map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSearchOpen(false); navigate(`/finance/pocket-money/wallet/${s.id}`); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{s.admission_no} - {s.name}</div>
                    <div className="text-xs text-gray-500">Class: {s?.klass_detail?.name || '—'}</div>
                  </button>
                ))}
              {!searchLoading && searchStudents.length === 0 && (
                <div className="p-3 text-sm text-gray-500">No students found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
