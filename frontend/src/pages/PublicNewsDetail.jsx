import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'

export default function PublicNewsDetail(){
  const { id } = useParams()
  const index = Number.isFinite(Number(id)) ? Number(id) : -1
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [item, setItem] = useState(null)
  const readingTime = useMemo(() => {
    const text = (item?.content || '').trim()
    const words = text ? text.split(/\s+/).length : 0
    const mins = Math.max(1, Math.round(words / 200))
    return `${mins} min read`
  }, [item])

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

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-gray-50 to-white text-gray-600">
      <div className="flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-6 w-6 animate-spin text-indigo-600"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" fill="currentColor" className="opacity-75"/></svg>
        <span>Loading…</span>
      </div>
    </div>
  )
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
  function linkify(text){
    const parts = text.split(/(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi)
    return parts.map((p, i) => {
      const href = /^https?:\/\//i.test(p) ? p : (p.startsWith('www.') ? `https://${p}` : null)
      return href ? <a key={i} href={href} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline break-words">{p}</a> : <React.Fragment key={i}>{p}</React.Fragment>
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50/30 text-gray-800">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Link to="/" className="hover:text-gray-900">Home</Link>
            <span>›</span>
            <span className="text-gray-900 font-medium">News</span>
          </div>
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <a href="#" className="text-gray-600 hover:text-gray-900">All News</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <article className="rounded-3xl overflow-hidden border border-gray-200 bg-white shadow-xl">
          <div className="relative">
            {image ? (
              <img src={image} alt="Cover" className="w-full aspect-[16/7] object-cover" />
            ) : (
              <div className="w-full aspect-[16/7] bg-gradient-to-br from-indigo-50 to-purple-50" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/10" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur border border-gray-200 px-3 py-1 text-xs text-gray-700">
                {date && <span>{date}</span>}
                <span>•</span>
                <span>{readingTime}</span>
              </div>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="text-xs text-indigo-700 hover:underline">Open source</a>
              ) : null}
            </div>
          </div>

          <div className="p-6 md:p-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">{title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1">
                <span>Share:</span>
                <button onClick={()=>{ const u = window.location.href; window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(title)}`,'_blank') }} className="hover:text-indigo-700">X</button>
                <button onClick={()=>{ const u = window.location.href; window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,'_blank') }} className="hover:text-indigo-700">Facebook</button>
                <button onClick={()=>{ navigator.clipboard?.writeText(window.location.href) }} className="hover:text-indigo-700">Copy link</button>
              </div>
            </div>

            {paras.length ? (
              <div className="prose prose-indigo max-w-none mt-6">
                {paras.map((p,i)=>(
                  <p key={i} className="leading-7 text-gray-800">{linkify(p)}</p>
                ))}
              </div>
            ) : null}

            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-1 text-indigo-700 hover:underline">Open full story →</a>
            )}
          </div>
        </article>

        <div className="mt-10 flex items-center justify-between">
          <Link to="/" className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Back to Home</Link>
          <a href="#top" onClick={(e)=>{e.preventDefault(); window.scrollTo({ top:0, behavior:'smooth' })}} className="text-sm text-gray-600 hover:text-gray-900">Back to top</a>
        </div>
      </main>
    </div>
  )
}
