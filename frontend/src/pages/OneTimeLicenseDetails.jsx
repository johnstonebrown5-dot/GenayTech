import React from 'react'
import { Link } from 'react-router-dom'

export default function OneTimeLicenseDetails() {
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
              <div className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                One-time License
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">One-time License</h1>
              <div className="mt-2 text-slate-700">KSh 500,000</div>
            </div>
            <a
              href="mailto:EduTrack46@gmail.com?subject=Genay%20Technologies%20One-time%20License%20Inquiry"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Talk to Sales
            </a>
          </div>

          <div className="mt-8 grid gap-6">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">Rights & permissions</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>All rights & permissions for your institution to use Genay Technologies.</li>
                <li>Unlimited students (no student cap).</li>
                <li>All modules included (academics, finance, communication, timetables, reports).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Support, training & startup</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>1 year support included.</li>
                <li>Free training & startup assistance (onboarding and initial setup).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Account setup requirements</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>Domain (System Domain) must be configured in account settings.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Terms & conditions (summary)</h2>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
                <li>Payment is a one-time license fee of KSh 500,000.</li>
                <li>Support is included for 12 months from the start date agreed during onboarding.</li>
                <li>After 12 months, support can be renewed separately upon request.</li>
                <li>Training covers standard system usage for your staff during onboarding.</li>
                <li>Any custom integrations or special requirements may require separate scoping and pricing.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
