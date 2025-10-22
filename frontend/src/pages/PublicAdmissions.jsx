import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function PublicAdmissions(){
  const [form, setForm] = useState({ name:'', contact:'', grade:'', message:'' })
  const [sending, setSending] = useState(false)
  const [ok, setOk] = useState('')
  const [error, setError] = useState('')
  const [grades, setGrades] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/school/public/')
        const arr = data?.homepage?.admissions?.grades
        if (mounted && Array.isArray(arr)) setGrades(arr)
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setSending(true); setOk(''); setError('')
    try{
      await api.post('/communications/contact-inquiry/', {
        name: form.name,
        sender: form.contact,
        message: `Admissions Application\nPreferred Grade: ${form.grade || '-'}\n\n${form.message}`,
        channel: 'email',
        origin: window.location.href,
      })
      setOk('Application sent. We will contact you shortly.')
      setForm({ name:'', contact:'', grade:'', message:'' })
    }catch(e){
      setError('Failed to send application')
    }finally{ setSending(false) }
  }

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-tight text-gray-900">Admissions</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/" className="hover:text-gray-900">Home</Link>
            <Link to="/teachers" className="hover:text-gray-900">Teachers</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Apply for Admission</h1>
          <p className="mt-2 text-gray-600">Fill out the form and our admissions team will get back to you.</p>

          {ok && <div className="mt-4 bg-green-50 text-green-700 p-3 rounded text-sm">{ok}</div>}
          {error && <div className="mt-4 bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>}

          <form onSubmit={submit} className="mt-6 grid gap-3">
            <label className="text-sm">Full Name
              <input className="border p-2 rounded w-full mt-1" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
            </label>
            <label className="text-sm">Email or Phone
              <input className="border p-2 rounded w-full mt-1" value={form.contact} onChange={e=>setForm({...form, contact:e.target.value})} required />
            </label>
            <label className="text-sm">Preferred Grade (optional)
              {grades.length ? (
                <select className="border p-2 rounded w-full mt-1" value={form.grade} onChange={e=>setForm({...form, grade:e.target.value})}>
                  <option value="">Select a grade…</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="Other">Other</option>
                </select>
              ) : (
                <input className="border p-2 rounded w-full mt-1" value={form.grade} onChange={e=>setForm({...form, grade:e.target.value})} placeholder="e.g., Grade 7" />
              )}
            </label>
            <label className="text-sm">Message
              <textarea className="border p-2 rounded w-full mt-1" rows={4} value={form.message} onChange={e=>setForm({...form, message:e.target.value})} placeholder="Tell us anything you'd like us to know" />
            </label>
            <div className="mt-2 flex items-center gap-2">
              <button className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60" disabled={sending}>{sending? 'Sending…' : 'Submit Application'}</button>
              <Link to="/" className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Back Home</Link>
            </div>
          </form>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          By submitting, you agree that we may contact you about this application.
        </div>
      </main>
    </div>
  )
}
