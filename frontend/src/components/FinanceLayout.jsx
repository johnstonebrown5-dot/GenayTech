import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useLock } from './LockProvider';
import api from '../api';
import FloatingDeliveryLog from './FloatingDeliveryLog';

const navItems = [
    { to: '/finance', label: 'Dashboard', icon: '📊' },
    { to: '/finance/payments', label: 'Payments', icon: '💳' },
    { to: '/finance/incoming', label: 'Incoming', icon: '📨' },
    { to: '/finance/expenses', label: 'Expenses', icon: '💸' },
    { to: '/finance/pocket-money', label: 'Pocket Money', icon: '💰' },
    { to: '/finance/fees', label: 'Fees', icon: '🏷️' },
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

    useEffect(() => { setIsMobileOpen(false); }, [pathname]);

    // Poll unread messages
    useEffect(() => {
        let mounted = true;
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
            try {
                const [inb, sys] = await Promise.allSettled([
                    api.get('/communications/messages/'),
                    api.get('/communications/messages/system/'),
                ]);
                const inboxList = inb.status === 'fulfilled' ? (Array.isArray(inb.value.data) ? inb.value.data : (inb.value.data?.results || [])) : [];
                const sysList = sys.status === 'fulfilled' ? (Array.isArray(sys.value.data) ? sys.value.data : (sys.value.data?.results || [])) : [];
                const total = computeUnread(inboxList) + computeUnread(sysList);
                if (mounted) {
                    setUnreadCount(total);
                    const bOnly = Array.isArray(sysList) ? sysList.filter(m => m.is_broadcast) : [];
                    const bCount = computeUnread(bOnly);
                    setBroadcastUnread(bCount);
                    const latest = Array.isArray(bOnly) && bOnly.length > 0 ? bOnly[0] : null;
                    setBroadcastBanner(latest || null);
                }
            } catch {
                if (mounted) { setUnreadCount(0); setBroadcastUnread(0); setBroadcastBanner(null); }
            }
        };
        load();
        const id = setInterval(load, 15000);
        return () => { mounted = false; clearInterval(id); };
    }, [user]);

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

    const sidebarBase = isOpen ? 'w-64' : 'w-16';

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
                        <span className="text-gray-900 font-extrabold tracking-tight">EDUTRACK</span>
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
                        <button onClick={logout} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 shadow-soft">Logout</button>
                    </div>
                </div>
            </header>

            <div className="relative">
                {isMobileOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setIsMobileOpen(false)} />}
                {/* Mobile sidebar drawer */}
                <aside className={`fixed z-40 top-16 left-0 bottom-0 md:hidden bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-700/30 w-72 transform transition-transform duration-200 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <nav className="p-3 space-y-1 overflow-y-auto h-full">
                        {navItems.map(i => {
                            const active = pathname === i.to;
                            return (
                                <Link key={i.to} to={i.to} className={`${active ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-300 hover:text-white'} flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300`} title={i.label}>
                                    <span className="text-lg w-5 text-center">{i.icon}</span>
                                    <span className="inline-flex items-center gap-2 text-sm font-medium truncate">
                                        {i.label}
                                        {i.label === 'Messages' && unreadCount > 0 && (
                                            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                <aside className={`fixed z-40 top-16 left-0 bottom-0 bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-700/30 transition-all duration-200 ${sidebarBase} hidden md:flex flex-col shadow-2xl`}>
                    <nav className="p-2 space-y-1 overflow-y-auto">
                        {navItems.map(i => {
                            const active = pathname === i.to;
                            return (
                                <Link key={i.to} to={i.to} className={`${active ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-300 hover:text-white'} flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group`} title={i.label}>
                                    <span className="text-lg w-5 text-center">{i.icon}</span>
                                    {isOpen && 
                                        <span className="relative inline-flex items-center gap-2 text-sm font-medium truncate">
                                            {i.label}
                                            {i.label === 'Messages' && unreadCount > 0 && (
                                                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] bg-red-600 text-white">
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </span>
                                            )}
                                        </span>
                                    }
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                <main className={`transition-all duration-200 px-4 md:px-6 py-4 md:py-6 ${isOpen ? 'md:ml-64' : 'md:ml-16'}`}>
                    {children}
                </main>
            </div>

            {/* Floating Delivery Log button/panel (finance only; component checks role) */}
            <FloatingDeliveryLog />
        </div>
    );
}
