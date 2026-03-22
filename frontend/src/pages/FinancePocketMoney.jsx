import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Search,
    PlusCircle,
    MinusCircle,
    History,
    Download,
    User,
    AlertCircle,
    CheckCircle2,
    X,
    ChevronLeft,
    ChevronRight,
    Filter,
} from 'lucide-react';
import api from '../api';

export default function FinancePocketMoney() {
    const navigate = useNavigate();
    const [wallets, setWallets] = useState([]);
    const [students, setStudents] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [transactionType, setTransactionType] = useState('deposit');
    const [formData, setFormData] = useState({ amount: '', description: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }
    // New: allow selecting student when opening a global transaction form
    const [studentQuery, setStudentQuery] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const todayLabel = new Date().toLocaleDateString();

    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => setAlert(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [alert]);

    // Filters and pagination for transactions list
    const [filterStudentId, setFilterStudentId] = useState(''); // '' means all
    const [filterType, setFilterType] = useState(''); // '', 'deposit', 'withdrawal'
    const [dateFrom, setDateFrom] = useState(''); // YYYY-MM-DD
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Search modal state (navigate to a student's wallet)
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQueryGlobal, setSearchQueryGlobal] = useState('');

    // Wallet modal state
    const [walletModalOpen, setWalletModalOpen] = useState(false);
    const [walletModalWallet, setWalletModalWallet] = useState(null);
    const [walletModalStudent, setWalletModalStudent] = useState(null);
    const [walletModalTx, setWalletModalTx] = useState([]);
    const [walletModalLoading, setWalletModalLoading] = useState(false);
    const [studentsLoading, setStudentsLoading] = useState(false);

    const normaliseList = (data) => {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.results)) return data.results;
        return [];
    };

    // helper to ensure students are loaded
    const ensureStudents = async (pageSize=20000) => {
        if (studentsLoading) return;
        setStudentsLoading(true);
        try{
            const res = await api.get(`/academics/students/?page_size=${pageSize}`);
            const payload = normaliseList(res.data);
            setStudents(payload);
            // Also ensure wallets exist
            try{
                const currentWallets = Array.isArray(wallets) ? wallets : normaliseList(wallets);
                const have = new Set((currentWallets||[]).map(w=>w.student))
                const missing = payload.filter(s=> !have.has(s.id))
                for (const s of missing){ try { await api.post('/finance/pocket-money-wallets/', { student: s.id, balance: 0 }) } catch(_) {} }
                if (missing.length){ const refreshed = await api.get('/finance/pocket-money-wallets/'); setWallets(normaliseList(refreshed.data)) }
            }catch(_){ }
        }catch(e){ /* ignore */ }
        finally{ setStudentsLoading(false) }
    }

    useEffect(() => {
        (async () => {
            try {
                const [walletRes, studentRes] = await Promise.all([
                    api.get('/finance/pocket-money-wallets/'),
                    api.get('/academics/students/?page_size=10000'),
                ]);
                const walletsPayload = normaliseList(walletRes.data);
                const studentsPayload = normaliseList(studentRes.data);
                setWallets(walletsPayload);
                setStudents(studentsPayload);
                // Ensure every student has a wallet in the background
                try {
                    const have = new Set((walletsPayload||[]).map(w=>w.student))
                    const missing = studentsPayload.filter(s=> !have.has(s.id))
                    if (missing.length){
                        for (const s of missing){
                            try { await api.post('/finance/pocket-money-wallets/', { student: s.id, balance: 0 }) } catch(_) {}
                        }
                        const refreshed = await api.get('/finance/pocket-money-wallets/')
                        setWallets(normaliseList(refreshed.data))
                    }
                } catch(_) {}
                // Kick off transactions fetch but don't block first paint
                fetchTransactions(1, pageSize, filterStudentId, filterType, dateFrom, dateTo);
            } catch (e) {
                console.error("Failed to load data:", e);
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When opening the search modal, ensure students are loaded
    useEffect(()=>{
        if (!searchOpen) return;
        if (students && students.length > 0) return;
        ensureStudents(20000);
    }, [searchOpen]);

    // If user starts typing in inline selector and students haven't loaded, fetch them
    useEffect(()=>{
        if (studentQuery && (!students || students.length===0)) {
            ensureStudents(20000);
        }
    }, [studentQuery]);

    // When filters or pagination change, reload transactions (debounced)
    const debounceRef = useRef(null);
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchTransactions(page, pageSize, filterStudentId, filterType, dateFrom, dateTo);
        }, 250);
        return () => debounceRef.current && clearTimeout(debounceRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, filterStudentId, filterType, dateFrom, dateTo]);

    const buildTxQuery = (p, ps, studentId, type) => {
        const params = new URLSearchParams();
        if (p) params.set('page', String(p));
        if (ps) params.set('page_size', String(ps));
        // Prefer backend ordering if available
        params.set('ordering', '-created_at');
        if (type) params.set('transaction_type', type);
        if (studentId) {
            // One wallet per student; map to wallet id if available
            const w = wallets.find(x => x.student === Number(studentId));
            if (w) params.set('wallet', String(w.id));
        }
        return params.toString();
    };

    // Export current (filtered) transactions to CSV
    const handleExportCsv = () => {
        try {
            const headers = ['Date','Student','Admission No','Type','Amount','Description'];
            const rows = [headers];
            for (const tx of transactions) {
                const wallet = wallets.find(w => w.id === tx.wallet);
                const s = wallet ? students.find(st => st.id === wallet.student) : null;
                rows.push([
                    new Date(tx.created_at).toLocaleString(),
                    s ? s.name : '',
                    s ? (s.admission_no || '') : '',
                    tx.transaction_type,
                    String(tx.amount),
                    (tx.description || '').replaceAll('\n',' ').replaceAll('\r',' '),
                ]);
            }
            const csv = rows.map(r => r.map(v => {
                const val = String(v ?? '');
                // Escape double quotes and wrap if needed
                const needsWrap = /[",\n]/.test(val);
                const escaped = val.replaceAll('"','""');
                return needsWrap ? `"${escaped}"` : escaped;
            }).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const d = new Date();
            const pad = (n) => String(n).padStart(2,'0');
            a.download = `pocket_transactions_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
            a.href = url;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    // Open wallet modal for a given wallet
    const openWalletModal = async (wallet) => {
        try {
            const student = students.find(st => st.id === wallet.student);
            setWalletModalStudent(student || null);
            setWalletModalWallet(wallet);
            setWalletModalOpen(true);
            setWalletModalLoading(true);
            const res = await api.get(`/finance/pocket-money-transactions/?wallet=${wallet.id}&page_size=50&ordering=-created_at`);
            const payload = normaliseList(res.data);
            payload.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            setWalletModalTx(payload);
        } catch (e) {
            console.error('Failed to load wallet transactions:', e);
        } finally {
            setWalletModalLoading(false);
        }
    };

    const closeWalletModal = () => {
        setWalletModalOpen(false);
        setWalletModalWallet(null);
        setWalletModalStudent(null);
        setWalletModalTx([]);
    };

    const applyClientDateFilter = (items) => {
        if (!dateFrom && !dateTo) return items;
        const fromTs = dateFrom ? Date.parse(dateFrom + 'T00:00:00') : null;
        const toTs = dateTo ? Date.parse(dateTo + 'T23:59:59') : null;
        return items.filter(tx => {
            const t = Date.parse(tx.created_at);
            if (fromTs && t < fromTs) return false;
            if (toTs && t > toTs) return false;
            return true;
        });
    };

    const fetchAbortRef = useRef(null);
    const fetchTransactions = async (p = 1, ps = 20, studentId = '', type = '', from = '', to = '', ws = null, sts = null) => {
        try {
            // cancel in-flight
            if (fetchAbortRef.current) {
                try { fetchAbortRef.current.abort(); } catch (_) {}
            }
            const controller = new AbortController();
            fetchAbortRef.current = controller;
            setTableLoading(true);
            const query = buildTxQuery(p, ps, studentId, type);
            const res = await api.get(`/finance/pocket-money-transactions/?${query}`, { signal: controller.signal });
            const payload = normaliseList(res.data);
            setTotalCount(typeof res.data?.count === 'number' ? res.data.count : payload.length);
            payload.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            const filtered = applyClientDateFilter(payload);
            setTransactions(filtered);
        } catch (e) {
            if (e?.name !== 'CanceledError' && e?.name !== 'AbortError') {
                console.error('Failed to fetch transactions:', e);
            }
        } finally {
            setTableLoading(false);
        }
    };

    // O(1) lookups for rendering
    const studentById = useMemo(() => {
        const map = new Map();
        for (const s of students) map.set(s.id, s);
        return map;
    }, [students]);
    const walletById = useMemo(() => {
        const map = new Map();
        for (const w of wallets) map.set(w.id, w);
        return map;
    }, [wallets]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Resolve wallet either from a selected row or from selected student
            let walletId = selectedWallet?.id;
            let w = selectedWallet || null;
            if (!walletId) {
                if (!selectedStudentId) {
                    alert('Select a student first.');
                    return;
                }
                const sid = Number(selectedStudentId);
                w = wallets.find(w => Number(w.student) === sid);
                if (!w) {
                    // First try a targeted fetch; it's smaller and avoids paging issues
                    try {
                        const wres0 = await api.get(`/finance/pocket-money-wallets/?student=${sid}`);
                        const list0 = normaliseList(wres0.data);
                        w = list0[0] || null;
                        if (w) setWallets(prev => {
                            const existing = Array.isArray(prev) ? prev : [];
                            return existing.some(x => x.id === w.id) ? existing : [w, ...existing];
                        });
                    } catch (_) {}
                }
                if (!w) {
                    // Try to auto-create wallet; if it already exists (OneToOne), fall back to refetch
                    try {
                        await api.post('/finance/pocket-money-wallets/', { student: sid, balance: 0 });
                    } catch (_) {}
                    try {
                        const wres1 = await api.get(`/finance/pocket-money-wallets/?student=${sid}`);
                        const list1 = normaliseList(wres1.data);
                        w = list1[0] || null;
                        if (w) setWallets(prev => {
                            const existing = Array.isArray(prev) ? prev : [];
                            return existing.some(x => x.id === w.id) ? existing : [w, ...existing];
                        });
                    } catch (_) {}
                }
                if (!w) {
                    alert('No wallet found for the selected student.');
                    return;
                }
                walletId = w.id;
            }

            if (!formData.amount || Number(formData.amount) <= 0) {
                setAlert({ type: 'error', message: 'Enter a valid amount greater than 0' });
                return;
            }

            if (transactionType === 'withdrawal' && w && Number(formData.amount) > Number(w.balance)) {
                setAlert({ type: 'error', message: `Insufficient balance. Current balance is KES ${Number(w.balance).toLocaleString()}` });
                return;
            }

            setIsSaving(true);
            await api.post('/finance/pocket-money-transactions/', {
                wallet: walletId,
                transaction_type: transactionType,
                ...formData,
            });
            // Refresh wallets to show updated balance
            const [resWallets, resTx] = await Promise.all([
                api.get('/finance/pocket-money-wallets/'),
                api.get(`/finance/pocket-money-transactions/?${buildTxQuery(page, pageSize, filterStudentId, filterType)}`),
            ]);
            const walletsPayload = normaliseList(resWallets.data);
            setWallets(walletsPayload);
            const txPayload2 = normaliseList(resTx.data);
            txPayload2.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            const filtered = applyClientDateFilter(txPayload2);
            setTransactions(filtered);
            // If wallet modal is open, refresh its balance and transactions
            if (walletModalOpen && walletModalWallet) {
                const updatedWallet = walletsPayload.find(w => w.id === walletId);
                if (updatedWallet) {
                    setWalletModalWallet(updatedWallet);
                }
                try {
                    const modalRes = await api.get(`/finance/pocket-money-transactions/?wallet=${walletId}&page_size=50&ordering=-created_at`);
                    const modalPayload = normaliseList(modalRes.data);
                    modalPayload.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                    setWalletModalTx(modalPayload);
                } catch (e) {
                    // ignore modal refresh error
                }
            }
            setShowForm(false);
            setSelectedWallet(null);
            setFormData({ amount: '', description: '' });
            setSelectedStudentId(null);
            setStudentQuery('');
        } catch (error) {
            setAlert({ type: 'error', message: error?.response?.data?.amount?.[0] || 'Failed to save transaction' });
        } finally {
            setIsSaving(false);
        }
    };

    const openTransactionForm = (wallet, type) => {
        setSelectedWallet(wallet);
        setTransactionType(type);
        // If opened from a specific wallet row, lock to that student; otherwise require selection
        if (wallet) {
            setSelectedStudentId(wallet.student);
        } else {
            setSelectedStudentId(null);
        }
        setShowForm(true);
    };

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
                                <History className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white tracking-tight">Pocket Money</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-white/80 text-sm font-medium">Recent transactions</span>
                                    <span className="text-white/40">•</span>
                                    <span className="text-white/60 text-sm">{todayLabel}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => openTransactionForm(null, 'deposit')}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-200"
                            >
                                <PlusCircle className="w-4 h-4" />
                                Deposit
                            </button>
                            <button
                                onClick={() => openTransactionForm(null, 'withdrawal')}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-200"
                            >
                                <MinusCircle className="w-4 h-4" />
                                Withdraw
                            </button>
                            <button
                                onClick={() => { setSearchOpen(true); setSearchQueryGlobal(''); }}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-gray-900 border border-white/10 hover:bg-gray-50 transition-all"
                            >
                                <Search className="w-4 h-4" />
                                Find Student
                            </button>
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/10 text-white border border-white/10 hover:bg-white/15 transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-gray-100">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                                    <History className="w-5 h-5 text-gray-700" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Recent Transactions</h2>
                                    <p className="text-sm text-gray-500">Browse deposits and withdrawals across all wallets</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={handleExportCsv}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                        <div className="xl:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Student</label>
                            <div className="mt-2 relative">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    value={filterStudentId}
                                    onChange={(e)=>{ setFilterStudentId(e.target.value); setPage(1); }}
                                    className="w-full bg-gray-50 border-0 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all"
                                >
                                    <option value="">All students</option>
                                    {students.map(s => (
                                        <option key={s.id} value={s.id}>{s.admission_no} - {s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Type</label>
                            <select
                                value={filterType}
                                onChange={(e)=>{ setFilterType(e.target.value); setPage(1); }}
                                className="mt-2 w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all"
                            >
                                <option value="">All</option>
                                <option value="deposit">Deposit</option>
                                <option value="withdrawal">Withdrawal</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400">From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e)=>{ setDateFrom(e.target.value); setPage(1); }}
                                className="mt-2 w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400">To</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e)=>{ setDateTo(e.target.value); setPage(1); }}
                                className="mt-2 w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                        <div className="text-sm text-gray-500 font-medium">
                            {tableLoading ? 'Loading transactions…' : `Showing ${transactions.length} of ${totalCount}`}
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Page size</label>
                            <select
                                value={pageSize}
                                onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }}
                                className="mt-2 bg-gray-50 border-0 rounded-2xl py-2.5 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all"
                            >
                                {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-[11px] text-gray-500 uppercase tracking-widest bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-4">Date</th>
                                <th scope="col" className="px-6 py-4">Student</th>
                                <th scope="col" className="px-6 py-4">Type</th>
                                <th scope="col" className="px-6 py-4">Amount</th>
                                <th scope="col" className="px-6 py-4">Description</th>
                                <th scope="col" className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tableLoading && (
                                Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                                    <tr key={`skeleton-${i}`} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-44"/></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-60"/></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-24"/></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-24"/></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-64"/></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-28"/></td>
                                    </tr>
                                ))
                            )}

                            {!tableLoading && transactions.map(tx => {
                                const wallet = walletById.get(tx.wallet);
                                const s = wallet ? studentById.get(wallet.student) : null;
                                return (
                                    <tr key={tx.id} className="bg-white hover:bg-gray-50/60 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{new Date(tx.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {s ? (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/finance/pocket-money/wallet/${wallet.student}`)}
                                                    className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                                >
                                                    {s.name} ({s.admission_no})
                                                </button>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black tracking-widest uppercase ${tx.transaction_type === 'deposit' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                                {tx.transaction_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900">KES {Number(tx.amount).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-gray-600">{tx.description || ''}</td>
                                        <td className="px-6 py-4">
                                            {s ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openTransactionForm(wallet, 'deposit')}
                                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                                                    >
                                                        <PlusCircle className="w-4 h-4" />
                                                        Deposit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openTransactionForm(wallet, 'withdrawal')}
                                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100"
                                                    >
                                                        <MinusCircle className="w-4 h-4" />
                                                        Withdraw
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {!tableLoading && (!transactions || transactions.length === 0) && (
                                <tr>
                                    <td className="px-6 py-12 text-center" colSpan={6}>
                                        <div className="text-sm font-bold text-gray-500">No transactions found</div>
                                        <div className="text-xs text-gray-400 mt-1">Try changing filters or date range</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 sm:p-8 border-t border-gray-100 flex flex-col sm:flex-row items-center sm:justify-between gap-4 text-sm">
                    <div className="text-gray-500 font-medium">
                        Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
                        <span className="text-gray-300"> • </span>
                        {totalCount} total
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={()=> setPage(p=> Math.max(1, p-1))}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${page <= 1 ? 'text-gray-400 border-gray-200 bg-gray-50' : 'text-gray-900 border-gray-200 hover:bg-gray-50'}`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Prev
                        </button>
                        <button
                            type="button"
                            disabled={page >= Math.ceil(totalCount / pageSize)}
                            onClick={()=> setPage(p=> Math.min(Math.ceil(totalCount / pageSize), p+1))}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${page >= Math.ceil(totalCount / pageSize) ? 'text-gray-400 border-gray-200 bg-gray-50' : 'text-gray-900 border-gray-200 hover:bg-gray-50'}`}
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
            {/* Global Search modal */}
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
                                    value={searchQueryGlobal}
                                    onChange={(e)=> setSearchQueryGlobal(e.target.value)}
                                    className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-gray-900 font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900 transition-all"
                                    autoFocus
                                />
                            </div>

                            <div className="mt-6 max-h-[400px] overflow-auto rounded-2xl border border-gray-100 bg-gray-50/50 divide-y divide-gray-100">
                                {studentsLoading && (
                                    <div className="p-8 text-center">
                                        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                                        <p className="text-sm font-bold text-gray-400">Loading students...</p>
                                    </div>
                                )}
                                {!studentsLoading && students
                                    .filter(s => {
                                        const q = searchQueryGlobal.trim().toLowerCase();
                                        if (!q) return true;
                                        const parts = [
                                            s.admission_no,
                                            s.name,
                                            s.full_name,
                                            s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : undefined,
                                            s.first_name,
                                            s.last_name,
                                            s.klass_detail?.name,
                                        ].filter(Boolean).join(' ').toLowerCase();
                                        return parts.includes(q);
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
                                {(!studentsLoading && students.length === 0) && (
                                    <div className="p-12 text-center">
                                        <User className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-gray-400">No students loaded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 animate-in zoom-in-95 duration-200 max-w-2xl mx-auto">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        {transactionType === 'deposit' ? 'New Deposit' : 'New Withdrawal'}
                        {(() => {
                            const sid = selectedWallet ? selectedWallet.student : selectedStudentId;
                            const s = students.find(st => st.id === sid);
                            return s ? ` for ${s.name} (${s.admission_no})` : '';
                        })()}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Student selection (only when not launched from a specific wallet) */}
                        {!selectedWallet && (
                            <div>
                                <label htmlFor="student" className="block text-sm font-medium text-gray-700">Student (search by Admission No. or Name)</label>
                                <input
                                    disabled={isSaving}
                                    type="text"
                                    id="student"
                                    placeholder="Type to search..."
                                    value={studentQuery}
                                    onChange={(e) => setStudentQuery(e.target.value)}
                                    className="mt-1 block w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all disabled:opacity-50"
                                />
                                <div className="mt-2 max-h-40 overflow-auto border border-gray-200 rounded-md divide-y">
                                    {studentsLoading && (
                                        <div className="px-3 py-2 text-xs text-gray-500">Loading students...</div>
                                    )}
                                    {students
                                        .filter(s => {
                                            const q = studentQuery.trim().toLowerCase();
                                            if (!q) return true;
                                            const parts = [
                                                s.admission_no,
                                                s.name,
                                                s.full_name,
                                                s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : undefined,
                                                s.first_name,
                                                s.last_name,
                                                s.klass_detail?.name,
                                            ].filter(Boolean).join(' ').toLowerCase();
                                            return parts.includes(q);
                                        })
                                        .map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => { setSelectedStudentId(s.id); setStudentQuery(`${s.admission_no} - ${s.name}`); }}
                                                className={`w-full text-left px-3 py-2 text-sm ${selectedStudentId === s.id ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}
                                            >
                                                {s.admission_no} - {s.name}
                                            </button>
                                        ))}
                                    {students && students.length>0 && students.filter(s=>{
                                        const q = studentQuery.trim().toLowerCase();
                                        if (!q) return false; return ![
                                            s.admission_no,
                                            s.name,
                                            s.full_name,
                                            s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : undefined,
                                            s.first_name,
                                            s.last_name,
                                            s.klass_detail?.name,
                                        ].filter(Boolean).join(' ').toLowerCase().includes(q)
                                    }).length===students.length && (
                                        <div className="px-3 py-2 text-xs text-gray-500">No matches. Try admission no or full name.</div>
                                    )}
                                </div>
                                {selectedStudentId && (
                                    <p className="text-xs text-gray-500 mt-1">Selected student ID: {selectedStudentId}</p>
                                )}
                            </div>
                        )}

                        {/* Date display (backend uses created_at automatically) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date</label>
                            <input value={todayLabel} readOnly className="mt-1 block w-full bg-gray-50 border border-gray-200 rounded-md py-2 px-3 text-sm text-gray-700" />
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                            <input
                                disabled={isSaving}
                                type="number"
                                id="amount"
                                name="amount"
                                value={formData.amount}
                                onChange={handleInputChange}
                                className="mt-1 block w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                disabled={isSaving}
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="3"
                                className="mt-1 block w-full bg-gray-50 border-0 rounded-2xl py-3 px-4 text-gray-900 focus:ring-2 focus:ring-gray-900 transition-all disabled:opacity-50"
                            ></textarea>
                            <div className="flex gap-3 pt-2">
                                <button disabled={isSaving} type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-2xl text-sm font-bold bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all disabled:opacity-50">
                                    Cancel
                                </button>
                                <button disabled={isSaving} type="submit" className="flex-[2] py-3 rounded-2xl text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isSaving ? (
                                        <div>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving...
                                        </div>
                                    ) : (
                                        <div>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Complete Transaction
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Wallet modal */}
            {walletModalOpen && walletModalWallet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={closeWalletModal}></div>
                    <div className="relative bg-white w-full max-w-2xl mx-4 rounded-2xl shadow-card border border-gray-200 p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">Wallet Details</h3>
                                <p className="text-sm text-gray-600">{walletModalStudent ? `${walletModalStudent.name} (${walletModalStudent.admission_no})` : ''}</p>
                            </div>
                            <button onClick={closeWalletModal} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-gray-700">Current Balance</div>
                            <div className="text-lg font-semibold">KES {Number(walletModalWallet.balance).toLocaleString()}</div>
                        </div>
                        <div className="flex gap-3 mb-4">
                            <button onClick={() => { setShowForm(true); setTransactionType('deposit'); setSelectedWallet(walletModalWallet); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700">Deposit</button>
                            <button onClick={() => { setShowForm(true); setTransactionType('withdrawal'); setSelectedWallet(walletModalWallet); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700">Withdraw</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Amount</th>
                                        <th className="px-4 py-2">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {walletModalLoading && (
                                        <tr><td colSpan={4} className="px-4 py-4 text-gray-500">Loading...</td></tr>
                                    )}
                                    {!walletModalLoading && walletModalTx.map(tx => (
                                        <tr key={tx.id} className="border-b">
                                            <td className="px-4 py-2 whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                                            <td className="px-4 py-2 capitalize">{tx.transaction_type}</td>
                                            <td className="px-4 py-2">KES {Number(tx.amount).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-gray-600">{tx.description || ''}</td>
                                        </tr>
                                    ))}
                                    {!walletModalLoading && walletModalTx.length === 0 && (
                                        <tr><td colSpan={4} className="px-4 py-4 text-gray-500">No transactions</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

 
