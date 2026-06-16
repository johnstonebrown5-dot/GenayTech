import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StudentMobileHeader from './StudentMobileHeader'
import StudentMobileTabs from './StudentMobileTabs'

function moneyPlain(n) {
  try {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0))
  } catch {
    return String(n ?? '0.00')
  }
}

export default function StudentMobileFinance({
  summary = {},
  feeStatement = [],
  paymentRows = [],
  isLoading = false,
  onRefresh,
  onPrint,
  refreshing = false,
}) {
  const navigate = useNavigate()
  const [subTab, setSubTab] = useState('overview')

  const headerTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'statement', label: 'Statement' },
    { id: 'payments', label: 'Payments' },
    { id: 'reports', label: 'Reports' },
  ]

  const recentTransactions = feeStatement.slice(0, 5)

  return (
    <div className="sm:hidden bg-slate-50 min-h-full">
      <div className="bg-emerald-500 rounded-b-3xl shadow-md pb-1">
        <StudentMobileHeader
          theme="green"
          embedded
          title="Finance"
          showBack
          onBack={() => navigate('/student')}
          rightIcon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
          }
          onRightClick={onPrint}
        />
        <StudentMobileTabs tabs={headerTabs} active={subTab} onChange={setSubTab} />
      </div>

      <div className="px-4 py-4 space-y-4">
        {(subTab === 'overview' || subTab === 'statement') && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Total Billed</div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {isLoading ? '...' : `Ksh ${moneyPlain(summary.total_billed)}`}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Total Paid</div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {isLoading ? '...' : `Ksh ${moneyPlain(summary.total_paid)}`}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">Balance</div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {isLoading ? '...' : `Ksh ${moneyPlain(summary.balance)}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === 'overview' && (
          <>
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/student/finance/pay')}
                  className="flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-2xl p-4 font-semibold text-sm shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Pay Fees
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/student/finance/verify')}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-2xl p-4 font-semibold text-sm"
                >
                  Verify Payment
                </button>
                <button
                  type="button"
                  onClick={onPrint}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-2xl p-4 font-semibold text-sm"
                >
                  Print Statement
                </button>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-2xl p-4 font-semibold text-sm disabled:opacity-60"
                >
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">Recent Transactions</h3>
              {recentTransactions.length > 0 ? (
                <div className="space-y-2">
                  {recentTransactions.map((r, i) => (
                    <div key={i} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">{r.description}</div>
                          <div className="text-[11px] text-slate-500">{r.date ? String(r.date).slice(0, 10) : ''}</div>
                        </div>
                        <div className={`text-sm font-bold shrink-0 ${r.type === 'payment' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {r.credit ? `+Ksh ${moneyPlain(r.credit)}` : r.debit ? `Ksh ${moneyPlain(r.debit)}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-sky-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-sky-300">
                      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">No transactions yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Your transactions will appear here.</p>
                </div>
              )}
            </div>
          </>
        )}

        {subTab === 'statement' && (
          <div className="space-y-2">
            {feeStatement.length > 0 ? feeStatement.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{r.description}</div>
                    <div className="text-[11px] text-slate-500">{r.ref}</div>
                    <div className="text-[11px] text-slate-400">{r.date ? String(r.date).slice(0, 10) : ''}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    r.type === 'payment' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {r.type === 'payment' ? 'PAYMENT' : 'INVOICE'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-slate-500">Debit</div>
                    <div className="font-bold">{r.debit ? moneyPlain(r.debit) : '-'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-slate-500">Credit</div>
                    <div className="font-bold">{r.credit ? moneyPlain(r.credit) : '-'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-slate-500">Balance</div>
                    <div className="font-bold">{moneyPlain(r.balance)}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">No statement entries</div>
            )}
          </div>
        )}

        {subTab === 'payments' && (
          <div className="space-y-2">
            {paymentRows.length > 0 ? paymentRows.map((p, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{p.reference}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.date ? new Date(p.date).toLocaleDateString() : ''} · {String(p.method || '').toUpperCase()}
                  </div>
                </div>
                <div className="text-sm font-bold text-emerald-600">Ksh {moneyPlain(p.amount)}</div>
              </div>
            )) : (
              <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">No payments recorded</div>
            )}
          </div>
        )}

        {subTab === 'reports' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white">
              <div className="text-xs opacity-80 uppercase font-bold mb-1">Utilization</div>
              <div className="text-3xl font-black">
                {summary?.total_billed > 0
                  ? ((summary.total_paid / summary.total_billed) * 100).toFixed(1)
                  : '0.0'}%
              </div>
              <div className="text-[11px] mt-2 opacity-90">Percentage of total fees paid</div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Last Payment</div>
              <div className="text-2xl font-black text-slate-900">
                {paymentRows?.[0] ? `Ksh ${moneyPlain(paymentRows[0].amount)}` : 'Ksh 0.00'}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {paymentRows?.[0]
                  ? `Received on ${new Date(paymentRows[0].date).toLocaleDateString()}`
                  : 'No payments recorded yet'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
