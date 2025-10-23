import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'

export default function PublicNewsDetail(){
  const { id } = useParams()
  const index = Number.isFinite(Number(id)) ? Number(id) : -1
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [item, setItem] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await api.get('/auth/school/public/')
        const list = Array.isArray(data?.homepage?.news) ? data.homepage.news : []
        const it = list[index]
        if (!mounted) return
        if (!it) {
          setError('News item not found')
        } else {
          setItem(it)
        }
      } catch {
        setError('Failed to load news item')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [index])

  if (loading) return <div className="min-h-screen grid place-items-center text-gray-600">Loading…</div>
  if (error) return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <div className="text-gray-700 mb-3">{error}</div>
        <Link to="/" className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Back to Home</Link>
      </div>
    </div>
  )

  const title = item?.title || 'News'
  const date = item?.date || ''
  const image = item?.image ? toAbsoluteUrl(item.image) : ''
  const url = item?.url || ''
  const content = (item?.content || '').trim()
  const paras = content ? content.split(/\n\s*\n|\r\n\r\n/).map(s=>s.trim()).filter(Boolean) : []

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-tight text-gray-900">News</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/" className="hover:text-gray-900">Home</Link>
            <a href="#" className="hover:text-gray-900">All News</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <article className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {image ? (
            <img src={image} alt="Cover" className="w-full h-64 object-cover" />
          ) : (
            <div className="w-full h-48 bg-gray-100" />
          )}
          <div className="p-6">
            {date && <div className="text-xs text-gray-500">{date}</div>}
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{title}</h1>
            {paras.length ? (
              <div className="prose max-w-none prose-p:leading-7 prose-p:text-gray-700">
                {paras.map((p,i)=>(<p key={i} className="mt-4">{p}</p>))}
              </div>
            ) : null}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1 text-indigo-700 hover:underline">Open full story →</a>
            )}
          </div>
        </article>
        <div className="mt-8 text-center">
          <Link to="/" className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Back to Home</Link>
        </div>
      </main>
    </div>
  )
}
