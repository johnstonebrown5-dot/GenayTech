import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'

export default function PublicTeacherProfile(){
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teacher, setTeacher] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get(`/auth/school/teachers/${id}/`)
        if (mounted) setTeacher(data)
      } catch (e) {
        if (mounted) setError('Teacher not found')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  if (loading) return <div className="min-h-screen grid place-items-center text-gray-600">Loading…</div>
  if (error) return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <div className="text-gray-700 mb-3">{error}</div>
        <Link to="/teachers" className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Back to Teachers</Link>
      </div>
    </div>
  )

  const name = [teacher?.first_name, teacher?.last_name].filter(Boolean).join(' ') || 'Teacher'

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link to="/teachers" className="text-xl font-semibold tracking-tight text-gray-900">Teacher Profile</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/" className="hover:text-gray-900">Home</Link>
            <Link to="/teachers" className="hover:text-gray-900">All Teachers</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-5">
            {teacher?.avatar_url ? (
              <img src={toAbsoluteUrl(teacher.avatar_url)} alt="Avatar" className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-indigo-600 text-white grid place-items-center text-2xl font-bold shadow">
                {(teacher?.first_name || teacher?.last_name || 'T')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900 truncate">{name}</div>
              <div className="text-sm text-gray-500 truncate">{teacher?.email}</div>
              {teacher?.is_class_teacher && (
                <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Class Teacher</span>
              )}
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">About</div>
              <p className="mt-2 text-sm text-gray-600">Dedicated educator focused on student success.</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">Classes</div>
              <ul className="mt-2 text-sm text-gray-700 list-disc ml-5">
                {(teacher?.classes || []).length ? (
                  teacher.classes.map(c => <li key={c.id}>{c.label}</li>)
                ) : (
                  <li>—</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/teachers" className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Back to Teachers</Link>
        </div>
      </main>
    </div>
  )
}
