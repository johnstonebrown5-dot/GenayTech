import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function TrialOnboarding() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    school_name: '',
    domain: '',
    admin_email: '',
    admin_password: '',
    admin_first_name: '',
    admin_last_name: '',
    phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [honeypot, setHoneypot] = useState('') // should remain empty

  const emailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passwordStrength = (pwd) => {
    if (!pwd) return { score: 0, ok: false }
    const lengthOK = pwd.length >= 8
    const upperOK = /[A-Z]/.test(pwd)
    const numberOK = /\d/.test(pwd)
    const ok = lengthOK && upperOK && numberOK
    const score = [lengthOK, upperOK, numberOK].filter(Boolean).length
    return { score, ok }
  }

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(false); setFieldErrors({})
    if (honeypot) { setError('Invalid submission.'); return }
    const fe = {}
    if (!form.school_name) fe.school_name = 'School name is required'
    if (!form.admin_email) fe.admin_email = 'Email is required'
    else if (!emailValid(form.admin_email)) fe.admin_email = 'Enter a valid email'
    if (!form.admin_password) fe.admin_password = 'Password is required'
    else if (!passwordStrength(form.admin_password).ok) fe.admin_password = 'Min 8 chars, include uppercase and a number'
    if (Object.keys(fe).length) { setFieldErrors(fe); return }
    try {
      setLoading(true)
      const payload = { ...form, website: honeypot }
      await api.post('/auth/request-demo/', payload)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 900)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to submit demo request. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div className="text-xl font-semibold">Genay Technologies Trial</div>
          <nav className="text-sm text-gray-600">
            <a href="/" className="hover:text-gray-900">Back to site</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900">Request a demo</h1>
          <p className="mt-3 text-gray-600">Submit your details and we will review your request. Once approved, you will receive an email with a verification link to activate your account.</p>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 p-6 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">What happens next</h2>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• Your request is reviewed by a super admin</li>
              <li>• After approval, you receive a verification email</li>
              <li>• After verifying, you can log in with your email and password</li>
              <li>• Your school is provisioned as a 14‑day trial</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 p-6 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">Request demo</h2>
            {error && (<div className="mt-3 rounded-md bg-rose-50 text-rose-700 text-sm px-3 py-2 border border-rose-200">{error}</div>)}
            {success && (<div className="mt-3 rounded-md bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-200">Request submitted! You will receive an email after approval.</div>)}
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700">School name *</label>
                <input name="school_name" value={form.school_name} onChange={onChange} className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${fieldErrors.school_name ? 'border-rose-300 focus:ring-rose-500' : 'border-gray-300 focus:ring-indigo-600'}`} placeholder="e.g., Greenfield Academy" />
                {fieldErrors.school_name && <div className="mt-1 text-xs text-rose-600">{fieldErrors.school_name}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Domain (optional)</label>
                <input name="domain" value={form.domain} onChange={onChange} className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${fieldErrors.domain ? 'border-rose-300 focus:ring-rose-500' : 'border-gray-300 focus:ring-indigo-600'}`} placeholder="e.g., greenfieldacademy.ac.ke" />
                {fieldErrors.domain && <div className="mt-1 text-xs text-rose-600">{fieldErrors.domain}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First name</label>
                  <input name="admin_first_name" value={form.admin_first_name} onChange={onChange} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last name</label>
                  <input name="admin_last_name" value={form.admin_last_name} onChange={onChange} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input type="email" name="admin_email" value={form.admin_email} onChange={onChange} className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${fieldErrors.admin_email ? 'border-rose-300 focus:ring-rose-500' : 'border-gray-300 focus:ring-indigo-600'}`} placeholder="you@school.com" />
                {fieldErrors.admin_email && <div className="mt-1 text-xs text-rose-600">{fieldErrors.admin_email}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password *</label>
                <input type="password" name="admin_password" value={form.admin_password} onChange={onChange} className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${fieldErrors.admin_password ? 'border-rose-300 focus:ring-rose-500' : 'border-gray-300 focus:ring-indigo-600'}`} />
                <div className="mt-1 text-xs text-gray-600">Use at least 8 characters, with an uppercase letter and a number.</div>
                {fieldErrors.admin_password && <div className="mt-1 text-xs text-rose-600">{fieldErrors.admin_password}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input name="phone" value={form.phone} onChange={onChange} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              {/* Honeypot field (hidden) */}
              <div className="hidden">
                <label>Website</label>
                <input name="website" value={honeypot} onChange={(e)=>setHoneypot(e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className={`w-full inline-flex justify-center items-center h-10 px-4 rounded-lg font-medium text-white ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {loading ? 'Submitting…' : 'Submit request'}
              </button>
            </form>
            <div className="mt-4 text-sm text-gray-600">Already have an account? <Link className="text-indigo-700 hover:underline" to="/login">Sign in</Link></div>
            <div className="mt-2">
              <a href="mailto:EduTrack46@gmail.com?subject=Genay%20Technologies%20Trial%20Assistance" className="text-sm text-gray-700 hover:underline">Need help?</a>
            </div>
          </div>
        </div>

        <div className="mt-10 text-sm text-gray-500">By starting a trial, you agree to our standard terms and privacy policy.</div>
      </main>
    </div>
  )
}
