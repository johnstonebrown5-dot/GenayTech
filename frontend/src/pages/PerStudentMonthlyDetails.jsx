import React from 'react'
import { Link } from 'react-router-dom'

export default function PerStudentMonthlyDetails() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <Link to="/#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to pricing
          </Link>
          <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Hot
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Per Student Monthly</h1>
              <div className="mt-2 text-slate-700">KSh 30 / student / month</div>
            </div>
            <a
              href="mailto:EduTrack46@gmail.com?subject=EduTrack%20Per%20Student%20Monthly%20Plan%20Inquiry"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Talk to Sales
            </a>
          </div>

          <div className="mt-8 grid gap-6">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">Subscription rights</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>Standard subscription rights while your account is active and paid.</li>
                <li>Platform access and updates during subscription period.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Billing terms</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>Monthly billing rate is KSh 30 per active student per month.</li>
                <li>Invoice amount is calculated from the number of active students in your system for that billing period.</li>
                <li>Invoices can be settled by bank, M-Pesa, or card.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Account setup requirements</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>Domain (System Domain) must be configured in account settings.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Support</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>Support is available while subscribed.</li>
                <li>Onboarding and training can be arranged during setup.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Terms & conditions (summary)</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>This plan renews monthly unless canceled.</li>
                <li>If the subscription expires due to non-payment, access may be paused until the account is renewed.</li>
                <li>Any custom integrations or special requirements may require separate scoping and pricing.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
