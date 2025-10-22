import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'

export default function PublicTeachers(){
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teachers, setTeachers] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/school/teachers/')
        if (!mounted) return
        const list = Array.isArray(data?.results) ? data.results : []
        setTeachers(list)
      } catch (e) {
        setError('Failed to load teachers')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-tight text-gray-900">Our Teachers</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/" className="hover:text-gray-900">Home</Link>
            <a href="#contact" className="hover:text-gray-900">Contact</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">Meet Our Teachers</h1>
          <p className="mt-3 text-gray-600">Dedicated educators committed to academic excellence and character development.</p>
        </div>

        {error && <div className="mt-6 max-w-3xl mx-auto bg-red-50 text-red-700 p-3 rounded">{error}</div>}
        {loading ? (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({length:6}).map((_,i)=> (
              <div key={i} className="h-44 rounded-2xl border border-gray-200 bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map(t => {
              const name = [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Teacher'
              const initial = (t.first_name||t.last_name||'T')[0].toUpperCase()
              return (
                <Link to={`/teachers/${t.id}`} key={t.id} className="group relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all block">
                  {/* Badge */}
                  {t.is_class_teacher && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Class Teacher</span>
                  )}
                  <div className="flex items-center gap-3">
                    {t.avatar_url ? (
                      <img src={toAbsoluteUrl(t.avatar_url)} alt="Avatar" className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-indigo-600 text-white grid place-items-center font-bold shadow">{initial}</div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{name}</div>
                      <div className="text-xs text-gray-500 truncate">{t.email}</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    Passionate about student growth and learning.
                  </div>
                </Link>
              )
            })}
            {teachers.length === 0 && (
              <div className="text-center text-gray-600 col-span-full">No teachers to show yet.</div>
            )}
          </div>
        )}

        <div id="contact" className="mt-14 text-center">
          <Link to="/" className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Back to Home</Link>
        </div>
      </main>
    </div>
  )
}
