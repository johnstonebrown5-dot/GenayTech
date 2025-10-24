import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api, { toAbsoluteUrl } from '../api'

export default function FeaturedPost(){
  const { slug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [school, setSchool] = useState({ name:'', code:'', homepage:{ featured:[] } })
  const [idx, setIdx] = useState(0)

  function slugify(s){
    return (s||'').toString().toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$|_/g,'').trim()
  }

  useEffect(()=>{
    let mounted = true
    ;(async () => {
      try{
        const { data } = await api.get('/auth/school/public/')
        if(!mounted) return
        setSchool({ name:data?.name||'', code:data?.code||'', homepage:data?.homepage||{} })
      }catch{ setError('Failed to load') }
      finally{ setLoading(false) }
    })()
    return () => { mounted = false }
  },[])

  const item = useMemo(()=>{
    const arr = Array.isArray(school?.homepage?.featured) ? school.homepage.featured : []
    const found = arr.find(it => slugify(it?.slug || it?.title) === slug)
    return found || null
  }, [school, slug])

  const images = useMemo(()=>{
    const arr = Array.isArray(item?.images) ? item.images : (item?.image ? [item.image] : [])
    return arr.map(u => (/^https?:/i.test(u) ? u : toAbsoluteUrl(u)))
  }, [item])

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-16"><div className="h-40 rounded-xl border border-gray-200 bg-gray-50 animate-pulse"/></div>
  if (error) return <div className="max-w-5xl mx-auto px-4 py-16 text-red-600">{error}</div>
  if (!item) return <div className="max-w-5xl mx-auto px-4 py-16">Not found</div>

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-sm text-indigo-700">← Back</Link>
          {item.tag ? <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700">{item.tag}</span> : null}
        </div>
        <h1 className="mt-3 text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900">{item.title}</h1>
        <p className="mt-3 text-lg text-gray-600 max-w-3xl">{item.desc}</p>

        <div className="mt-6 rounded-2xl overflow-hidden border border-gray-200 bg-white p-3">
          {images.length ? (
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-1 grid gap-3">
                {images.slice(1).map((src,i)=> {
                  const sizes = ['h-28','h-40','h-32','h-44']
                  const h = sizes[i % sizes.length]
                  return (
                    <img key={i} src={src} loading="lazy" alt={`${item.title} ${i+2}`} className={`w-full ${h} object-cover rounded-lg`} />
                  )
                })}
              </div>
              <div className="md:col-span-2">
                <img src={images[0]} alt={`${item.title} hero`} className="w-full md:h-full min-h-[260px] object-cover rounded-lg"/>
              </div>
            </div>
          ) : (
            <div className="h-40 bg-gray-50 rounded"/>
          )}
        </div>

        <div className="mt-10">
          <article className="prose prose-slate max-w-none">
            <h2>About these photos</h2>
            <p>{item.photosDesc || item.content || item.desc}</p>
          </article>
        </div>

        {/* Related */}
        {(() => {
          function slugify(s){
            return (s||'').toString().toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$|_/g,'').trim()
          }
          const all = Array.isArray(school?.homepage?.featured) ? school.homepage.featured : []
          const selected = Array.isArray(item?.related) && item.related.length
            ? all.filter(it => item.related.some(r => {
                const rs = slugify(r)
                return slugify(it?.slug || it?.title) === rs || slugify(it?.title) === rs
              }))
            : all.filter(it => (it?.title !== item.title)).slice(0,3)
          if (!selected.length) return null
          return (
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-gray-900">Related</h2>
              <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {selected.map((rel, idx)=>{
                  const href = `/featured/${slugify(rel?.slug || rel?.title)}`
                  const pic = Array.isArray(rel?.images) && rel.images[0] ? (/^https?:/i.test(rel.images[0])? rel.images[0] : toAbsoluteUrl(rel.images[0])) : null
                  return (
                    <Link to={href} key={idx} className="group rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow">
                      {pic ? <img src={pic} alt={rel.title} className="w-full aspect-[16/9] object-cover"/> : <div className="aspect-[16/9] bg-gray-100"/>}
                      <div className="p-4">
                        <div className="font-semibold text-gray-900 group-hover:underline">{rel.title}</div>
                        {rel.desc ? <div className="text-sm text-gray-600 mt-1 line-clamp-2">{rel.desc}</div> : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
