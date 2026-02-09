import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function DashboardShowcase(){
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/auth/dashboard-showcase/', { _skipGlobalLoading: true })
        const rows = Array.isArray(data?.results) ? data.results : []
        if (mounted) {
          setItems(rows)
          setActive(0)
        }
      } catch {
        if (mounted) setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const current = items[active] || null

  const canPrev = active > 0
  const canNext = active < items.length - 1

  const dots = useMemo(() => {
    return items.map((x, idx) => ({ id: x.id, idx }))
  }, [items])

  if (loading) return <div className="p-6">Loading…</div>

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard Tour</h1>
          <p className="mt-1 text-sm text-slate-600">Explore key dashboards and what you can do with them.</p>
        </div>
        <Link to="/" className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Back</Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No dashboard showcase items have been published yet.
        </div>
      ) : (
        <div className="mt-6 grid lg:grid-cols-2 gap-6 items-start">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 overflow-hidden">
            <div className="aspect-[16/10] bg-slate-50">
              {current?.image_url ? (
                <img src={current.image_url} alt={current.title || 'Dashboard screenshot'} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-4 sm:p-5 border-t border-slate-200">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => setActive((i) => Math.max(0, i - 1))}
                  className={`px-3 py-2 rounded-xl text-sm font-bold ${canPrev ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  Prev
                </button>
                <div className="flex items-center gap-1.5">
                  {dots.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setActive(d.idx)}
                      className={`h-2 w-2 rounded-full ${d.idx === active ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
                      aria-label={`Go to slide ${d.idx + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setActive((i) => Math.min(items.length - 1, i + 1))}
                  className={`px-3 py-2 rounded-xl text-sm font-bold ${canNext ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 p-6">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Feature</div>
            <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{current?.title || ''}</h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-600 whitespace-pre-line">{current?.description || ''}</p>

            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-500">All items</div>
              <div className="mt-2 grid gap-2">
                {items.map((x, idx) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setActive(idx)}
                    className={`text-left rounded-2xl border px-4 py-3 transition-all ${idx === active ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="text-sm font-bold text-slate-900">{x.title}</div>
                    <div className="text-xs text-slate-600 line-clamp-2">{x.description || ''}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
