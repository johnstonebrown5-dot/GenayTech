import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useLock } from './LockProvider';
import api from '../api';
import { canRunAuthenticatedPoll, handlePollAuthError } from '../utils/authPoll';
import FloatingDeliveryLog from './FloatingDeliveryLog';

const navItems = [
    { to: '/finance', label: 'Dashboard', icon: '📊' },
    { to: '/finance/payments', label: 'Payments', icon: '💳' },
    { to: '/finance/mpesa-logs', label: 'M-Pesa Logs', icon: '📱' },
    { to: '/finance/incoming', label: 'Bank', icon: '🏦' },
    { to: '/finance/expenses', label: 'Expenses', icon: '💸' },
    { to: '/finance/pocket-money', label: 'Pocket Money', icon: '💰' },
    { to: '/finance/fees', label: 'Fees', icon: '🏷️' },
    { to: '/finance/staff-payroll', label: 'Support Staff', icon: '🧑‍🔧' },
    { to: '/finance/reports', label: 'Reports', icon: '📈' },
    { to: '/finance/messages', label: 'Messages', icon: '✉️' },
    { to: '/finance/settings', label: 'Settings', icon: '⚙️' },
];

export default function FinanceLayout({ children }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { lock } = useLock();
    const [isOpen, setIsOpen] = useState(true);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [schoolName, setSchoolName] = useState('');
    const [schoolLogo, setSchoolLogo] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [broadcastUnread, setBroadcastUnread] = useState(0);
    const [broadcastBanner, setBroadcastBanner] = useState(null);
    const [bannerExpanded, setBannerExpanded] = useState(false);
    const [dismissedIds, setDismissedIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem('dismissed_broadcast_ids') || '[]') } catch { return [] }
    });

    const dismissBanner = (id) => {
        if (!id) return;
        const next = Array.from(new Set([...(Array.isArray(dismissedIds)? dismissedIds:[]), id]));
        setDismissedIds(next);
        try { localStorage.setItem('dismissed_broadcast_ids', JSON.stringify(next)) } catch {}
        if (broadcastBanner?.id === id) setBroadcastBanner(null);
    }

    useEffect(() => { setIsMobileOpen(false); }, [pathname]);

    // Poll unread messages
    useEffect(() => {
        if (!canRunAuthenticatedPoll(user, false)) return;
        let mounted = true;
        let intervalId = null;
        const stop = () => {
            mounted = false;
            if (intervalId) clearInterval(intervalId);
        };
        const computeUnread = (arr) => {
            const myId = user?.id;
            if (!Array.isArray(arr) || !myId) return 0;
            return arr.reduce((acc, m) => {
                const rec = Array.isArray(m.recipients) ? m.recipients : [];
                const mine = rec.find(r => r.user === myId);
                return acc + (mine && !mine.read ? 1 : 0);
            }, 0);
        };
        const load = async () => {
            if (!mounted || !canRunAuthenticatedPoll(user, false)) return;
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
            try {
                const [inb, sys] = await Promise.allSettled([
                    api.get('/communications/messages/', { _skipGlobalLoading: true }),
                    api.get('/communications/messages/system/', { _skipGlobalLoading: true }),
                ]);
                if (inb.status === 'rejected' && handlePollAuthError(inb.reason, stop)) return;
                if (sys.status === 'rejected' && handlePollAuthError(sys.reason, stop)) return;
                const inboxList = inb.status === 'fulfilled' ? (Array.isArray(inb.value.data) ? inb.value.data : (inb.value.data?.results || [])) : [];
                const sysList = sys.status === 'fulfilled' ? (Array.isArray(sys.value.data) ? sys.value.data : (sys.value.data?.results || [])) : [];
                const total = computeUnread(inboxList) + computeUnread(sysList);
                if (mounted) {
                    setUnreadCount(total);
                    const bOnly = Array.isArray(sysList) ? sysList.filter(m => m.is_broadcast) : [];
                    const bCount = computeUnread(bOnly);
                    setBroadcastUnread(bCount);
                    const latest = Array.isArray(bOnly) && bOnly.length > 0 ? bOnly[0] : null;
                    const latestBody = String(latest?.body || '').trim();
                    const candidate = latest && latestBody && !dismissedIds.includes(latest.id) ? latest : null;
                    setBroadcastBanner(candidate);
                }
            } catch (err) {
                if (handlePollAuthError(err, stop)) return;
                if (mounted) { setUnreadCount(0); setBroadcastUnread(0); setBroadcastBanner(null); }
            }
        };
        const onSessionExpired = () => stop();
        try { window.addEventListener('auth:session-expired', onSessionExpired); } catch {}
        load();
        intervalId = setInterval(load, 20000);
        return () => {
            stop();
            try { window.removeEventListener('auth:session-expired', onSessionExpired); } catch {}
        };
    }, [user, dismissedIds]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { data } = await api.get('/auth/school/info/');
                if (mounted) {
                    setSchoolName(data?.name || '');
                    setSchoolLogo(data?.logo_url || data?.logo || '');
                }
            } catch (e) {
                if (mounted) { setSchoolName(''); setSchoolLogo(''); }
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Keep browser tab title in sync with active school
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.title = schoolName ? schoolName : 'Genay Technologies';
        }
    }, [schoolName]);

    // Sidebar width: comfortable with labels when open, compact icons-only when collapsed
    const sidebarBase = isOpen ? 'w-56' : 'w-20';

    return (
        <div className="min-h-screen bg-gray-50">
            {broadcastBanner && (
                <div className="sticky top-0 z-40 w-full bg-red-600 text-white">
                    <div className="px-4 md:px-6 py-2 flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.48 14.7A1 1 0 002.62 20h18.76a1 1 0 00.86-1.5l-8.48-14.64a1 1 0 00-1.73 0z" /></svg>
                        <a href="/finance/messages?tab=system" className="flex-1 min-w-0">
                            <div className="text-sm font-semibold tracking-wide uppercase opacity-90">{broadcastBanner.system_tag || 'Alert'}</div>
                            <div className="text-sm leading-snug" style={{ maxHeight: bannerExpanded ? 'none' : 40, overflow: bannerExpanded ? 'visible' : 'hidden' }}>{String(broadcastBanner.body||'')}</div>
                        </a>
                        <button onClick={()=>setBannerExpanded(v=>!v)} className="sm:hidden text-xs underline decoration-white/70 underline-offset-2 px-2 py-1">
                            {bannerExpanded ? 'Show less' : 'Read more'}
                        </button>
                        <button
                            onClick={() => dismissBanner(broadcastBanner?.id)}
                            aria-label="Hide alert"
                            title="Hide this alert"
                            className="ml-1 inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 px-4 md:px-6 h-16 flex items-center gap-2 md:gap-4 shadow-soft">
                <button className="p-2.5 rounded-lg hover:bg-gray-100/80 transition-all duration-200 md:hidden" aria-label="Toggle sidebar" onClick={() => setIsMobileOpen(v => !v)}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-600"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                </button>
                <button className="p-2.5 rounded-lg hover:bg-gray-100/80 transition-all duration-200 hidden md:inline-flex" aria-label="Collapse sidebar" onClick={() => setIsOpen(v => !v)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-600"><path fillRule="evenodd" d="M19.5 3.75a.75.75 0 01.75.75v14.25a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75V4.5a.75.75 0 01.75-.75h15zm-9.53 3.22a.75.75 0 10-1.06 1.06l2.72 2.72-2.72 2.72a.75.75 0 101.06 1.06l3.25-3.25a.75.75 0 000-1.06l-3.25-3.25z" clipRule="evenodd" /></svg>
                </button>
                <div className="hidden md:flex items-center gap-1 ml-1">
                    <button className="p-2 rounded-lg hover:bg-gray-100/80 transition-all duration-200" aria-label="Go back" onClick={() => navigate(-1)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700"><path fillRule="evenodd" d="M9.53 4.47a.75.75 0 010 1.06L5.56 9.5H20.25a.75.75 0 010 1.5H5.56l3.97 3.97a.75.75 0 11-1.06 1.06l-5.25-5.25a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clipRule="evenodd"/></svg>
                    </button>
                    <button className="p-2 rounded-lg hover:bg-gray-100/80 transition-all duration-200" aria-label="Go forward" onClick={() => navigate(1)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700"><path fillRule="evenodd" d="M14.47 4.47a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06l3.97-3.97H3.75a.75.75 0 010-1.5h14.69l-3.97-3.97a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
                    </button>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                    <img src={schoolLogo || '/logo.jpg'} alt="School Logo" className="w-8 h-8 rounded object-contain" />
                    <div className="flex items-baseline gap-2 truncate">
                        <span className="text-gray-900 font-extrabold tracking-tight">GENAY TECHNOLOGIES</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-bold text-xl text-gray-900 tracking-tight truncate">{(schoolName || 'School')} Finance</span>
                    </div>
                </div>
                <div className="flex-1"></div>
                <Link
                    to="/finance/messages?tab=system"
                    className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
                    aria-label="Notifications"
                    title="System messages"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-700">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9a6 6 0 10-12 0v.75a8.967 8.967 0 01-2.311 6.022c1.733.64 3.56 1.085 5.455 1.31m5.713 0a24.255 24.255 0 01-5.713 0m5.713 0a3 3 0 11-5.713 0" />
                    </svg>
                    {broadcastUnread > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                            {broadcastUnread > 99 ? '99+' : broadcastUnread}
                        </span>
                    )}
                </Link>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/finance/settings')} className="flex items-center gap-2 group">
                        { (user?.avatar_url || user?.photo_url || user?.profile_picture_url) ? (
                            <img src={user?.avatar_url || user?.photo_url || user?.profile_picture_url} alt="Profile" className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 text-xs flex items-center justify-center font-semibold ring-1 ring-gray-200">
                                {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                            </div>
                        ) }
                        <span className="text-sm text-gray-700 font-medium group-hover:underline">
                            {user?.first_name || user?.username || 'User'}
                        </span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={lock} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-900 transition-all duration-200 shadow-soft">Lock</button>
                        <button onClick={() => navigate('/sessions')} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 shadow-soft">Logout</button>
                    </div>
                </div>
            </header>

            <div className="relative">
                {isMobileOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setIsMobileOpen(false)} />}
                {/* Mobile sidebar drawer */}
                <aside className={`fixed z-40 top-16 left-0 bottom-0 md:hidden bg-gradient-to-b from-emerald-700 via-emerald-600 to-teal-500 border-r border-emerald-800/40 w-72 transform transition-transform duration-200 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <nav className="p-3 space-y-1.5 overflow-y-auto h-full">
                        {navItems.map(i => {
                            const active = pathname === i.to;
                            return (
                                <Link
                                    key={i.to}
                                    to={i.to}
                                    className={`${active ? 'bg-white/10 text-white shadow-soft' : 'hover:bg-emerald-600/40 text-emerald-50 hover:text-white'} flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-300`}
                                    title={i.label}
                                >
                                    <span className="text-lg w-6 text-center">{i.icon}</span>
                                    <span className="inline-flex items-center gap-2 text-sm font-medium truncate">
                                        {i.label}
                                        {i.label === 'Messages' && unreadCount > 0 && (
                                            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-500 text-white">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Desktop sidebar - curved, collapsible */}
                <aside className={`fixed z-40 top-16 left-0 bottom-0 hidden md:flex items-stretch transition-all duration-200 ${sidebarBase}`}>
                    <div className="flex-1 flex">
                        <div className="relative flex flex-col justify-between w-full max-w-xs bg-gradient-to-b from-emerald-700 via-emerald-600 to-teal-500 rounded-r-3xl shadow-2xl py-4">
                            {/* Top logo / brand mark */}
                            <div className={`flex ${isOpen ? 'flex-row items-start px-3 gap-3' : 'flex-col items-center gap-4'}`}>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-white/10 border border-white/30 shadow-soft text-white text-lg shrink-0"
                                    aria-label="Finance home"
                                    onClick={() => navigate('/finance')}
                                >
                                    📊
                                </button>
                                {isOpen && (
                                    <div className="flex flex-col text-white/90 text-xs mt-0.5 min-w-0">
                                        <span className="font-semibold tracking-wide uppercase opacity-90">Finance</span>
                                        <span className="text-[11px] truncate">{schoolName || 'Genay Technologies'}</span>
                                    </div>
                                )}
                            </div>

                            <nav className={`mt-4 flex-1 flex flex-col ${isOpen ? 'items-stretch px-3 gap-1.5' : 'items-center gap-2'}`}>
                                {navItems.map(i => {
                                    const active = pathname === i.to;
                                    const isMessages = i.label === 'Messages';
                                    const baseActive = active ? 'bg-white text-emerald-600 shadow-soft' : 'bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/30 hover:text-white';
                                    return (
                                        <Link
                                            key={i.to}
                                            to={i.to}
                                            className={`relative flex items-center rounded-2xl text-[18px] transition-all duration-200 ${baseActive} ${isOpen ? 'justify-start px-2.5 py-1.5 gap-2' : 'justify-center w-9 h-9'}`}
                                            title={i.label}
                                        >
                                            <span className="shrink-0 flex items-center justify-center w-6 h-6">{i.icon}</span>
                                            {isOpen && (
                                                <span className={`text-xs font-medium truncate pr-2 ${active ? 'text-emerald-800' : 'text-emerald-50'}`}>
                                                    {i.label}
                                                </span>
                                            )}
                                            {isMessages && unreadCount > 0 && (
                                                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full text-[9px] bg-red-500 text-white">
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </span>
                                            )}
                                            <span className="sr-only">{i.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            {/* Bottom collapse control */}
                            <div className={`flex ${isOpen ? 'justify-end pr-3' : 'justify-center'} mt-2`}>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(v => !v)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-2xl bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/35 text-xs font-medium"
                                    title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                                >
                                    {isOpen ? '◀' : '▶'}
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                <main className={`transition-all duration-200 px-4 md:px-6 py-4 md:py-6 ${isOpen ? 'md:ml-56' : 'md:ml-20'}`}>
                    {children}
                </main>
            </div>

            {/* Floating Delivery Log button/panel (finance only; component checks role) */}
            <FloatingDeliveryLog />
        </div>
    );
}
