import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import api, { toAbsoluteUrl } from '../api'
import { uploadToCloudinary } from '../utils/cloudinary'
import { toast } from '../utils/toast'

export default function AdminWebsite(){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name:'', code:'', address:'', motto:'', aim:'', logoUrl:'', homepage:{ hero:{}, about:{}, stats:{}, admissions:{}, programs:[], featured:[], gallery:{ items:[] } } })
  const [headteacherFile, setHeadteacherFile] = useState(null)
  const [liveStats, setLiveStats] = useState({ students:null, teachers:null, satisfaction:null, ratio:null })
  const [pickerOpen, setPickerOpen] = useState(false)
  const mapRef = useRef(null)
  const leafletLoaded = useRef(false)
  // Upload indicators
  const [uploadingHero, setUploadingHero] = useState([false,false,false,false])
  const [uploadingPartner, setUploadingPartner] = useState({})
  const [uploadingSponsor, setUploadingSponsor] = useState({})
  const [uploadingGallery, setUploadingGallery] = useState({})
  const [uploadingTestimonials, setUploadingTestimonials] = useState({})

  const ensureLeaflet = async () => {
    if (leafletLoaded.current) return true
    return new Promise((resolve) => {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(css)
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      s.onload = () => { leafletLoaded.current = true; resolve(true) }
      document.body.appendChild(s)
    })
  }

  const load = async ()=>{
    setLoading(true)
    try{
      const { data } = await api.get('/auth/school/me/')
      setForm({
        name: data.name || '',
        code: data.code || '',
        address: data.address || '',
        motto: data.motto || '',
        aim: data.aim || '',
        logoUrl: data.logo_url || '',
        homepage: data.homepage || { hero:{}, about:{}, stats:{}, admissions:{}, programs:[] },
      })
      // Fetch public info for live stats using code if available
      try{
        const code = (data.code || '').trim()
        const { data:pub } = await api.get(`/auth/school/public/${code?`?code=${encodeURIComponent(code)}`:''}`)
        const st = pub?.homepage?.stats || {}
        setLiveStats({
          students: st.students ?? null,
          teachers: st.teachers ?? null,
          satisfaction: st.satisfaction ?? null,
          ratio: st.ratio ?? null,
        })
      }catch{ /* ignore */ }
    }catch(e){ setError('Failed to load site content') }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  const submit = async (e)=>{
    e?.preventDefault?.()
    setSaving(true); setOk(''); setError('')
    try{
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('code', form.code)
      fd.append('address', form.address)
      fd.append('motto', form.motto)
      fd.append('aim', form.aim)
      // Flatten headteacher simple fields for convenience on backend
      const ht = (form.homepage && form.homepage.headteacher) || {}
      if (ht.name != null) fd.append('headteacher_name', ht.name)
      if (ht.title != null) fd.append('headteacher_title', ht.title)
      if (ht.message != null) fd.append('headteacher_message', ht.message)
      if (headteacherFile) fd.append('headteacher_photo', headteacherFile)
      fd.append('homepage', JSON.stringify(form.homepage || {}))
      await api.put('/auth/school/me/', fd, { headers:{ 'Content-Type':'multipart/form-data' } })
      setOk('Saved successfully')
      await load()
    }catch(e){
      const resp = e?.response?.data
      const msg = typeof resp === 'string' ? resp : (resp?.detail || 'Failed to save')
      setError(msg)
    }finally{ setSaving(false) }
  }

  const hero = form.homepage?.hero || {}
  const about = form.homepage?.about || {}
  const stats = form.homepage?.stats || {}
  const admissions = form.homepage?.admissions || {}
  const headteacher = form.homepage?.headteacher || {}
  const programs = Array.isArray(form.homepage?.programs) ? form.homepage.programs : []
  const featured = Array.isArray(form.homepage?.featured) ? form.homepage.featured : []
  const galleryItems = Array.isArray(form.homepage?.gallery?.items) ? form.homepage.gallery.items : []
  const partners = Array.isArray(form.homepage?.partners) ? form.homepage.partners : []
  const sponsors = Array.isArray(form.homepage?.sponsors) ? form.homepage.sponsors : []
  const testimonials = Array.isArray(form.homepage?.testimonials) ? form.homepage.testimonials : []
  const testimonialsInterval = Number(form.homepage?.testimonialsInterval) || 6000

  useEffect(() => {
    if (!pickerOpen) return
    let map
    ;(async () => {
      await ensureLeaflet()
      const L = window.L
      if (!L) return
      // Init only once per open
      if (mapRef.current && mapRef.current.childElementCount === 0) {
        const div = document.createElement('div')
        div.style.height = '320px'
        div.style.width = '100%'
        mapRef.current.appendChild(div)
        const lat = parseFloat(admissions.mapLat || '-1.286389')
        const lng = parseFloat(admissions.mapLng || '36.817223')
        map = L.map(div).setView([lat, lng], 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map)
        let marker
        if (!isNaN(lat) && !isNaN(lng) && admissions.mapLat && admissions.mapLng) {
          marker = L.marker([lat, lng]).addTo(map)
        }
        map.on('click', (e) => {
          const { lat, lng } = e.latlng
          if (marker) { marker.setLatLng([lat, lng]) } else { marker = L.marker([lat, lng]).addTo(map) }
          setForm(f => ({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, mapLat: lat.toFixed(6), mapLng: lng.toFixed(6), mapUrl: `https://www.google.com/maps?q=${lat},${lng}&output=embed` } } }))
        })
      }
    })()
    return () => {}
  }, [pickerOpen])

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="hidden md:block">
            <h1 className="text-xl font-semibold">Website Editor</h1>
            <p className="text-gray-600 text-sm">Edit the homepage exactly as it appears.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/" target="_blank" rel="noreferrer" className="px-3 py-2 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">Open Public Site</a>
            <button onClick={submit} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>

        {error && <div className="mx-6 bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
        {ok && <div className="mx-6 bg-green-50 text-green-700 p-2 rounded text-sm">{ok}</div>}

        {loading ? (
          <div className="h-40 mx-6 mt-4 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
        ) : (
          <div className="mx-6 my-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {/* Hero */}
            <section className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 w-full sm:w-auto">
                  <input className="bg-transparent outline-none w-full sm:w-64 min-w-0" value={hero.badge || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...hero, badge:e.target.value } } }))} placeholder="Hero badge" />
                </div>
                <div className="mt-4">
                  <input className="w-full text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 bg-transparent outline-none" value={hero.title || `Welcome to ${form.name}`} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...hero, title:e.target.value } } }))} />
                  <textarea rows={3} className="w-full mt-3 text-gray-600 bg-transparent outline-none" value={hero.subtitle || 'A nurturing, diverse and high-achieving community empowering students to thrive in academics, character, and service.'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...hero, subtitle:e.target.value } } }))} />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <input className="px-5 py-3 rounded-lg border bg-indigo-600/10 text-indigo-800 font-medium outline-none min-w-[160px] flex-1" value={hero.ctaPrimaryText || 'Start Your Application'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...hero, ctaPrimaryText:e.target.value } } }))} />
                  <input className="px-5 py-3 rounded-lg border text-gray-700 font-medium outline-none min-w-[160px] flex-1" value={hero.ctaSecondaryText || 'Learn More'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...hero, ctaSecondaryText:e.target.value } } }))} />
                </div>
              </div>
              <div className="relative">
                <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white ring-1 ring-gray-100">
                  {(() => {
                    const imgs = hero.images || []
                    const main = imgs[0] ? toAbsoluteUrl(imgs[0]) : ''
                    return (
                      <div>
                        <div className="relative">
                          <div className="absolute top-3 left-3 right-3 sm:left-auto sm:right-3 z-10 bg-white/90 rounded shadow p-2 grid gap-2 max-w-full">
                            {Array.from({length:4}).map((_,idx)=> (
                              <div key={idx} className="flex items-center gap-2">
                                <input className="border p-1 rounded text-xs w-full sm:w-56" placeholder={idx===0?'Main image URL':'Thumbnail URL'} value={(imgs[idx]||'')} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.hero?.images||[])]; arr[idx]=e.target.value; return { ...f, homepage:{ ...f.homepage, hero:{ ...hero, images:arr } } } })} />
                                <label className={`text-xs px-2 py-1 rounded ${uploadingHero[idx] ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer`}>
                                  {uploadingHero[idx] ? 'Uploading…' : 'Upload'}
                                  <input type="file" accept="image/*" className="hidden" onChange={async ev=>{
                                    const file = ev.target.files?.[0]
                                    if(!file) return
                                    try{
                                      setUploadingHero(arr=>{ const a=[...arr]; a[idx]=true; return a })
                                      const { url } = await uploadToCloudinary(file, { folder: 'edu-track/site' })
                                      setForm(f=>{ const arr=[...(f.homepage?.hero?.images||[])]; arr[idx]=url; return { ...f, homepage:{ ...f.homepage, hero:{ ...hero, images:arr } } } })
                                    }catch(e){ toast(e?.message || 'Failed to upload to Cloudinary', 'error') }
                                    finally{ setUploadingHero(arr=>{ const a=[...arr]; a[idx]=false; return a }); ev.target.value = '' }
                                  }} />
                                </label>
                              </div>
                            ))}
                          </div>
                          <div className="w-full h-60 sm:h-80 bg-gray-100 grid place-items-center text-gray-400 text-sm">
                            {main ? (<img src={main} alt="Hero" className="w-full h-60 sm:h-80 object-cover" />) : 'Main image preview'}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-gray-100">
                          {Array.from({length:3}).map((_,i)=>{
                            const src = imgs[i+1] ? toAbsoluteUrl(imgs[i+1]) : ''
                            return <div key={i} className="h-20 sm:h-28 w-full bg-gray-100">{src ? <img src={src} className="h-20 sm:h-28 w-full object-cover"/> : null}</div>
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </section>

            {/* Testimonials */}
            <section className="mt-16" id="testimonials">
              <h3 className="text-lg font-semibold text-gray-900">Testimonials</h3>
              <p className="text-sm text-gray-600 mt-1">These appear in a carousel on the public homepage.</p>
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm">Autoplay interval (ms)
                  <input type="number" min={3000} step={500} className="ml-2 border p-2 rounded w-32" value={testimonialsInterval} onChange={e=> setForm(f=> ({ ...f, homepage:{ ...f.homepage, testimonialsInterval:Number(e.target.value)||6000 } }))} />
                </label>
              </div>
              <div className="mt-4 grid gap-3">
                {(testimonials.length ? testimonials : [{ name:'Parent', quote:'Safe, welcoming environment.', avatar:'' }]).map((t, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 grid md:grid-cols-4 gap-3 items-start bg-white">
                    <label className="text-sm">
                      <div>Name</div>
                      <input className="border p-2 rounded w-full mt-1" value={t.name || ''} onChange={e=> setForm(f=>{ const arr=[...(f.homepage?.testimonials||[])]; arr[idx] = { ...(arr[idx]||{}), name:e.target.value }; return { ...f, homepage:{ ...f.homepage, testimonials:arr } } })} />
                    </label>
                    <label className="text-sm md:col-span-2">
                      <div>Quote</div>
                      <textarea rows={3} className="border p-2 rounded w-full mt-1" value={t.quote || ''} onChange={e=> setForm(f=>{ const arr=[...(f.homepage?.testimonials||[])]; arr[idx] = { ...(arr[idx]||{}), quote:e.target.value }; return { ...f, homepage:{ ...f.homepage, testimonials:arr } } })} />
                    </label>
                    <div className="text-sm">
                      <div>Avatar</div>
                      <div className="mt-1 flex items-center gap-2">
                        <input className="border p-2 rounded w-full" placeholder="Avatar URL" value={t.avatar || ''} onChange={e=> setForm(f=>{ const arr=[...(f.homepage?.testimonials||[])]; arr[idx] = { ...(arr[idx]||{}), avatar:e.target.value }; return { ...f, homepage:{ ...f.homepage, testimonials:arr } } })} />
                        <label className={`px-2 py-1 rounded ${uploadingTestimonials[idx] ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer text-xs`}>
                          {uploadingTestimonials[idx] ? 'Uploading…' : 'Upload'}
                          <input type="file" accept="image/*" className="hidden" onChange={async ev=>{
                            const file = ev.target.files?.[0]
                            if(!file) return
                            try{
                              setUploadingTestimonials(s=>({ ...s, [idx]:true }))
                              const { url } = await uploadToCloudinary(file, { folder: 'edu-track/testimonials' })
                              setForm(f=>{ const arr=[...(f.homepage?.testimonials||[])]; arr[idx] = { ...(arr[idx]||{}), avatar:url }; return { ...f, homepage:{ ...f.homepage, testimonials:arr } } })
                            }catch(e){ toast(e?.message || 'Failed to upload to Cloudinary', 'error') }
                            finally{ setUploadingTestimonials(s=>({ ...s, [idx]:false })); ev.target.value = '' }
                          }} />
                        </label>
                      </div>
                      <div className="mt-2 h-16 bg-gray-50 rounded grid place-items-center">
                        {t.avatar ? <img src={toAbsoluteUrl(t.avatar)} alt="avatar" className="h-16 w-16 object-cover rounded-full"/> : <span className="text-xs text-gray-500">No avatar</span>}
                      </div>
                    </div>
                    <div className="md:col-span-4 text-right">
                      <button type="button" className="text-sm text-red-600" onClick={()=> setForm(f=>{ const arr=[...(f.homepage?.testimonials||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, testimonials:arr } } })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200 w-fit" onClick={()=> setForm(f=>{ const arr=[...(f.homepage?.testimonials||[])]; if(arr.length<8) arr.push({ name:'', quote:'', avatar:'' }); return { ...f, homepage:{ ...f.homepage, testimonials:arr } } })}>Add Testimonial</button>
              </div>
            </section>

            {/* Partners */}
            <section className="mt-16">
              <h3 className="text-lg font-semibold text-gray-900">Our Partners</h3>
              <p className="text-sm text-gray-600 mt-1">Logos with links to partner websites.</p>
              <div className="mt-4 grid gap-3">
                {(partners || []).map((p, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 grid md:grid-cols-4 gap-3 items-start">
                    <label className="text-sm">
                      <div>Name</div>
                      <input className="border p-2 rounded w-full mt-1" value={p.name || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.partners||[])]; arr[idx] = { ...(arr[idx]||{}), name:e.target.value }; return { ...f, homepage:{ ...f.homepage, partners:arr } } })} />
                    </label>
                    <label className="text-sm">
                      <div>Website URL</div>
                      <input className="border p-2 rounded w-full mt-1" value={p.url || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.partners||[])]; arr[idx] = { ...(arr[idx]||{}), url:e.target.value }; return { ...f, homepage:{ ...f.homepage, partners:arr } } })} />
                    </label>
                    <div className="text-sm md:col-span-2">
                      <div>Logo</div>
                      <div className="mt-1 flex items-center gap-2">
                        <input className="border p-2 rounded w-full" placeholder="Logo URL" value={p.logo || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.partners||[])]; arr[idx] = { ...(arr[idx]||{}), logo:e.target.value }; return { ...f, homepage:{ ...f.homepage, partners:arr } } })} />
                        <label className={`px-2 py-1 rounded ${uploadingPartner[idx] ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer text-xs`}> {uploadingPartner[idx] ? 'Uploading…' : 'Upload'}
                          <input type="file" accept="image/*" className="hidden" onChange={async ev=>{
                            const file = ev.target.files?.[0]
                            if(!file) return
                            try{
                              setUploadingPartner(s=>({ ...s, [idx]:true }))
                              const { url } = await uploadToCloudinary(file, { folder: 'edu-track/partners' })
                              setForm(f=>{ const arr=[...(f.homepage?.partners||[])]; arr[idx] = { ...(arr[idx]||{}), logo:url }; return { ...f, homepage:{ ...f.homepage, partners:arr } } })
                            }catch(e){ toast(e?.message || 'Failed to upload to Cloudinary', 'error') }
                            finally{ setUploadingPartner(s=>({ ...s, [idx]:false })); ev.target.value = '' }
                          }} />
                        </label>
                      </div>
                      <div className="mt-2 h-16 bg-gray-50 rounded grid place-items-center">
                        {p.logo ? <img src={toAbsoluteUrl(p.logo)} alt="logo" className="max-h-14 object-contain"/> : <span className="text-xs text-gray-500">No logo</span>}
                      </div>
                    </div>
                    <div className="md:col-span-4 text-right">
                      <button type="button" className="text-sm text-red-600" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.partners||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, partners:arr } } })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200 w-fit" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.partners||[])]; if(arr.length<24) arr.push({ name:'', url:'', logo:'' }); return { ...f, homepage:{ ...f.homepage, partners:arr } } })}>Add Partner</button>
              </div>
            </section>

            {/* Sponsors */}
            <section className="mt-16">
              <h3 className="text-lg font-semibold text-gray-900">Our Sponsors</h3>
              <p className="text-sm text-gray-600 mt-1">Logos with links to sponsor websites.</p>
              <div className="mt-4 grid gap-3">
                {(sponsors || []).map((p, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 grid md:grid-cols-4 gap-3 items-start">
                    <label className="text-sm">
                      <div>Name</div>
                      <input className="border p-2 rounded w-full mt-1" value={p.name || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.sponsors||[])]; arr[idx] = { ...(arr[idx]||{}), name:e.target.value }; return { ...f, homepage:{ ...f.homepage, sponsors:arr } } })} />
                    </label>
                    <label className="text-sm">
                      <div>Website URL</div>
                      <input className="border p-2 rounded w-full mt-1" value={p.url || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.sponsors||[])]; arr[idx] = { ...(arr[idx]||{}), url:e.target.value }; return { ...f, homepage:{ ...f.homepage, sponsors:arr } } })} />
                    </label>
                    <div className="text-sm md:col-span-2">
                      <div>Logo</div>
                      <div className="mt-1 flex items-center gap-2">
                        <input className="border p-2 rounded w-full" placeholder="Logo URL" value={p.logo || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.sponsors||[])]; arr[idx] = { ...(arr[idx]||{}), logo:e.target.value }; return { ...f, homepage:{ ...f.homepage, sponsors:arr } } })} />
                        <label className={`px-2 py-1 rounded ${uploadingSponsor[idx] ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer text-xs`}> {uploadingSponsor[idx] ? 'Uploading…' : 'Upload'}
                          <input type="file" accept="image/*" className="hidden" onChange={async ev=>{
                            const file = ev.target.files?.[0]
                            if(!file) return
                            try{
                              setUploadingSponsor(s=>({ ...s, [idx]:true }))
                              const { url } = await uploadToCloudinary(file, { folder: 'edu-track/sponsors' })
                              setForm(f=>{ const arr=[...(f.homepage?.sponsors||[])]; arr[idx] = { ...(arr[idx]||{}), logo:url }; return { ...f, homepage:{ ...f.homepage, sponsors:arr } } })
                            }catch(e){ toast(e?.message || 'Failed to upload to Cloudinary', 'error') }
                            finally{ setUploadingSponsor(s=>({ ...s, [idx]:false })); ev.target.value = '' }
                          }} />
                        </label>
                      </div>
                      <div className="mt-2 h-16 bg-gray-50 rounded grid place-items-center">
                        {p.logo ? <img src={toAbsoluteUrl(p.logo)} alt="logo" className="max-h-14 object-contain"/> : <span className="text-xs text-gray-500">No logo</span>}
                      </div>
                    </div>
                    <div className="md:col-span-4 text-right">
                      <button type="button" className="text-sm text-red-600" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.sponsors||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, sponsors:arr } } })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200 w-fit" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.sponsors||[])]; if(arr.length<24) arr.push({ name:'', url:'', logo:'' }); return { ...f, homepage:{ ...f.homepage, sponsors:arr } } })}>Add Sponsor</button>
              </div>
            </section>

            {/* Featured */}
            <section className="mt-16">
              <h3 className="text-lg font-semibold text-gray-900">Featured</h3>
              <p className="text-sm text-gray-600 mt-1">Cards that appear in the Featured section. You can add multiple images per card.</p>
              <div className="mt-4 grid gap-3">
                {(featured || []).map((it, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 grid md:grid-cols-5 gap-3 items-start">
                    <label className="text-sm md:col-span-2">
                      <div>Title</div>
                      <input className="border p-2 rounded w-full mt-1" value={it.title || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; arr[idx]={...arr[idx], title:e.target.value}; return { ...f, homepage:{ ...f.homepage, featured:arr } } })} />
                    </label>
                    <label className="text-sm">
                      <div>Slug (optional)</div>
                      <input className="border p-2 rounded w-full mt-1" placeholder="e.g. modern-science-labs" value={it.slug || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; arr[idx]={...arr[idx], slug:e.target.value}; return { ...f, homepage:{ ...f.homepage, featured:arr } } })} />
                    </label>
                    <label className="text-sm md:col-span-3">
                      <div>Description</div>
                      <textarea rows={3} className="border p-2 rounded w-full mt-1" value={it.desc || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; arr[idx]={...arr[idx], desc:e.target.value}; return { ...f, homepage:{ ...f.homepage, featured:arr } } })} />
                    </label>
                    <label className="text-sm md:col-span-5">
                      <div>Content</div>
                      <textarea rows={6} className="border p-2 rounded w-full mt-1" placeholder="Write the full post content here..." value={it.content || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; arr[idx]={...arr[idx], content:e.target.value}; return { ...f, homepage:{ ...f.homepage, featured:arr } } })} />
                    </label>
                    <label className="text-sm">
                      <div>Tag</div>
                      <input className="border p-2 rounded w-full mt-1" value={it.tag || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; arr[idx]={...arr[idx], tag:e.target.value}; return { ...f, homepage:{ ...f.homepage, featured:arr } } })} />
                    </label>
                    <label className="text-sm md:col-span-2">
                      <div>Link</div>
                      <input className="border p-2 rounded w-full mt-1" value={it.link || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; arr[idx]={...arr[idx], link:e.target.value}; return { ...f, homepage:{ ...f.homepage, featured:arr } } })} />
                    </label>
                    <div className="text-sm md:col-span-5">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Images</div>
                        <button type="button" className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; const imgs = Array.isArray(arr[idx]?.images)? arr[idx].images : (arr[idx]?.image?[arr[idx].image]:[]); imgs.push(''); arr[idx] = { ...(arr[idx]||{}), images:imgs }; return { ...f, homepage:{ ...f.homepage, featured:arr } } })}>Add image</button>
                      </div>
                      <div className="mt-2 grid md:grid-cols-3 gap-2">
                        {(Array.isArray(it.images) ? it.images : (it.image ? [it.image] : [])).map((u, i2) => (
                          <div key={i2} className="rounded border p-2">
                            <div className="text-xs">Image {i2+1}</div>
                            <div className="mt-1 flex items-center gap-2">
                              <input className="border p-2 rounded w-full" placeholder="Image URL" value={u || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; const imgs = Array.isArray(arr[idx]?.images)? [...arr[idx].images] : (arr[idx]?.image?[arr[idx].image]:[]); imgs[i2] = e.target.value; arr[idx] = { ...(arr[idx]||{}), images:imgs }; return { ...f, homepage:{ ...f.homepage, featured:arr } } })} />
                              <label className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs">Upload
                                <input type="file" accept="image/*" className="hidden" onChange={async ev=>{
                                  const file = ev.target.files?.[0]
                                  if(!file) return
                                  try{
                                    const { url } = await uploadToCloudinary(file, { folder: 'edu-track/site' })
                                    setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; const imgs = Array.isArray(arr[idx]?.images)? [...arr[idx].images] : (arr[idx]?.image?[arr[idx].image]:[]); imgs[i2] = url; arr[idx] = { ...(arr[idx]||{}), images:imgs }; return { ...f, homepage:{ ...f.homepage, featured:arr } } })
                                  }catch(e){ toast(e?.message || 'Failed to upload to Cloudinary', 'error') }
                                  finally{ ev.target.value = '' }
                                }} />
                              </label>
                              <button type="button" className="text-xs text-red-600" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; const imgs = Array.isArray(arr[idx]?.images)? [...arr[idx].images] : []; imgs.splice(i2,1); arr[idx] = { ...(arr[idx]||{}), images:imgs }; return { ...f, homepage:{ ...f.homepage, featured:arr } } })}>Remove</button>
                            </div>
                            <div className="mt-2 h-24 bg-gray-50 rounded grid place-items-center">
                              {u ? <img src={toAbsoluteUrl(u)} alt="preview" className="h-24 w-full object-cover rounded"/> : <span className="text-xs text-gray-500">No image</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-5 text-right">
                      <button type="button" className="text-sm text-red-600" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, featured:arr } } })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200 w-fit" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.featured||[])]; if(arr.length<9) arr.push({ title:'', desc:'', images:[] }); return { ...f, homepage:{ ...f.homepage, featured:arr } } })}>Add Featured Item</button>
              </div>
            </section>

            {/* Gallery */}
            <section className="mt-16">
              <h3 className="text-lg font-semibold text-gray-900">Gallery</h3>
              <p className="text-sm text-gray-600 mt-1">Add images to the homepage gallery. You can set a title and category for filtering.</p>
              <div className="mt-4 grid gap-3">
                {(galleryItems || []).map((g, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 grid md:grid-cols-4 gap-3 items-start">
                    <label className="text-sm">
                      <div>Title</div>
                      <input className="border p-2 rounded w-full mt-1" value={g.title || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.gallery?.items||[])]; arr[idx] = { ...(arr[idx]||{}), title:e.target.value }; return { ...f, homepage:{ ...f.homepage, gallery:{ items:arr } } } })} />
                    </label>
                    <label className="text-sm">
                      <div>Category</div>
                      <input className="border p-2 rounded w-full mt-1" value={g.category || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.gallery?.items||[])]; arr[idx] = { ...(arr[idx]||{}), category:e.target.value }; return { ...f, homepage:{ ...f.homepage, gallery:{ items:arr } } } })} />
                    </label>
                    <div className="text-sm md:col-span-2">
                      <div>Image</div>
                      <div className="mt-1 flex items-center gap-2">
                        <input className="border p-2 rounded w-full" placeholder="Image URL" value={g.url || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.gallery?.items||[])]; arr[idx] = { ...(arr[idx]||{}), url:e.target.value }; return { ...f, homepage:{ ...f.homepage, gallery:{ items:arr } } } })} />
                        <label className={`px-2 py-1 rounded ${uploadingGallery[idx] ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer text-xs`}> {uploadingGallery[idx] ? 'Uploading…' : 'Upload'}
                          <input type="file" accept="image/*" className="hidden" onChange={async ev=>{
                            const file = ev.target.files?.[0]
                            if(!file) return
                            try{
                              setUploadingGallery(s=>({ ...s, [idx]:true }))
                              const { url } = await uploadToCloudinary(file, { folder: 'edu-track/gallery' })
                              setForm(f=>{ const arr=[...(f.homepage?.gallery?.items||[])]; arr[idx] = { ...(arr[idx]||{}), url }; return { ...f, homepage:{ ...f.homepage, gallery:{ items:arr } } } })
                            }catch(e){ toast(e?.message || 'Failed to upload to Cloudinary', 'error') }
                            finally{ setUploadingGallery(s=>({ ...s, [idx]:false })); ev.target.value = '' }
                          }} />
                        </label>
                      </div>
                      <div className="mt-2 h-24 bg-gray-50 rounded grid place-items-center">
                        {g.url ? <img src={toAbsoluteUrl(g.url)} alt="preview" className="h-24 w-full object-cover rounded"/> : <span className="text-xs text-gray-500">No image</span>}
                      </div>
                    </div>
                    <div className="md:col-span-4 text-right">
                      <button type="button" className="text-sm text-red-600" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.gallery?.items||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, gallery:{ items:arr } } } })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200 w-fit" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.gallery?.items||[])]; if(arr.length<24) arr.push({ url:'', title:'', category:'' }); return { ...f, homepage:{ ...f.homepage, gallery:{ items:arr } } } })}>Add Gallery Image</button>
              </div>
            </section>

            {/* About */}
            <section className="mt-16 grid lg:grid-cols-2 gap-10 items-start">
              <div>
                <input className="text-3xl font-bold text-gray-900 bg-transparent outline-none w-full" value={about.title || `About ${form.name}`} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, about:{ ...about, title:e.target.value } } }))} />
                <textarea rows={3} className="mt-3 text-gray-600 bg-transparent outline-none w-full" value={about.text || `Founded on excellence and integrity, ${form.name} offers a rich curriculum, vibrant co-curricular life and a caring environment that inspires students to reach their full potential.`} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, about:{ ...about, text:e.target.value } } }))} />
                <div className="mt-4 grid gap-2">
                  {((about.bullets && about.bullets.length) ? about.bullets : ['Experienced and caring teachers','Strong STEM and Humanities programs','Sports, arts, clubs and community service','Safe, inclusive and diverse community']).map((b, idx)=> (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-indigo-600">•</span>
                      <input className="border p-2 rounded w-full" value={b} onChange={e=>setForm(f=>{ const arr=[...((f.homepage?.about?.bullets)||[])]; arr[idx]=e.target.value; return { ...f, homepage:{ ...f.homepage, about:{ ...about, bullets:arr } } } })} />
                      <button type="button" className="text-sm text-red-600" onClick={()=>setForm(f=>{ const arr=[...((f.homepage?.about?.bullets)||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, about:{ ...about, bullets:arr } } } })}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200 w-fit" onClick={()=>setForm(f=>{ const arr=[...((f.homepage?.about?.bullets)||[])]; arr.push(''); return { ...f, homepage:{ ...f.homepage, about:{ ...about, bullets:arr } } } })}>Add bullet</button>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-700 min-w-0">
                  <label className="rounded-lg bg-gray-50 p-4 overflow-hidden">
                    <div className="text-xs text-gray-500">Students (live)</div>
                    <div className="mt-1 font-semibold text-indigo-700 truncate">{liveStats.students ?? '—'}</div>
                  </label>
                  <label className="rounded-lg bg-gray-50 p-4 overflow-hidden">
                    <div className="text-xs text-gray-500">Teachers (live)</div>
                    <div className="mt-1 font-semibold text-indigo-700 truncate">{liveStats.teachers ?? '—'}</div>
                  </label>
                  <label className="rounded-lg bg-gray-50 p-4 overflow-hidden">
                    <div className="text-xs text-gray-500">Parent Satisfaction (auto)</div>
                    <div className="mt-1 font-semibold text-indigo-700 truncate">{liveStats.satisfaction || '98%'}</div>
                  </label>
                  <label className="rounded-lg bg-gray-50 p-4 overflow-hidden">
                    <div className="text-xs text-gray-500">Student-Teacher Ratio</div>
                    <input className="mt-1 font-semibold text-indigo-700 bg-transparent outline-none w-full min-w-0" value={stats.ratio || liveStats.ratio || '15:1'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, stats:{ ...stats, ratio:e.target.value } } }))} />
                  </label>
                  <label className="rounded-lg bg-gray-50 p-4 overflow-hidden">
                    <div className="text-xs text-gray-500">Co-curricular Clubs</div>
                    <input className="mt-1 font-semibold text-indigo-700 bg-transparent outline-none w-full min-w-0" value={stats.clubs || '40+'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, stats:{ ...stats, clubs:e.target.value } } }))} />
                  </label>
                  <label className="rounded-lg bg-gray-50 p-4 overflow-hidden">
                    <div className="text-xs text-gray-500">Years of Excellence</div>
                    <input className="mt-1 font-semibold text-indigo-700 bg-transparent outline-none w-full min-w-0" value={stats.years || '25+'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, stats:{ ...stats, years:e.target.value } } }))} />
                  </label>
                </div>
              </div>
            </section>

            {/* Headteacher */}
            <section className="mt-16 grid lg:grid-cols-3 gap-10 items-start">
              <div className="lg:col-span-1">
                <h3 className="text-lg font-semibold text-gray-900">Headteacher</h3>
                <p className="text-sm text-gray-600 mt-1">Name, title, portrait photo and welcome message.</p>
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
                  <div className="mx-auto h-36 w-36 rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 grid place-items-center">
                    {headteacher.photo ? (
                      <img src={toAbsoluteUrl(headteacher.photo)} alt="Headteacher" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-3xl text-gray-400">👩‍🏫</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <label className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs">Upload Photo
                      <input type="file" accept="image/*" className="hidden" onChange={ev=>{
                        const file = ev.target.files?.[0]
                        if(!file) return
                        setHeadteacherFile(file)
                        // Optimistic preview via object URL
                        const url = URL.createObjectURL(file)
                        setForm(f=>({ ...f, homepage:{ ...f.homepage, headteacher:{ ...headteacher, photo:url } } }))
                      }} />
                    </label>
                    {headteacher.photo ? (
                      <button type="button" className="text-xs text-red-600" onClick={()=>{ setHeadteacherFile(null); setForm(f=>({ ...f, homepage:{ ...f.homepage, headteacher:{ ...headteacher, photo:'' } } })) }}>Remove</button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 grid gap-4">
                <label className="text-sm">
                  <div>Name</div>
                  <input className="border p-2 rounded w-full mt-1" value={headteacher.name || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, headteacher:{ ...headteacher, name:e.target.value } } }))} />
                </label>
                <label className="text-sm">
                  <div>Title</div>
                  <input className="border p-2 rounded w-full mt-1" placeholder="Headteacher" value={headteacher.title || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, headteacher:{ ...headteacher, title:e.target.value } } }))} />
                </label>
                <label className="text-sm">
                  <div>Message</div>
                  <textarea rows={6} className="border p-2 rounded w-full mt-1" value={headteacher.message || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, headteacher:{ ...headteacher, message:e.target.value } } }))} />
                </label>
              </div>
            </section>

            {/* Programs */}
            <section id="programs" className="mt-16">
              <h3 className="text-lg font-semibold text-gray-900">Academic Programs</h3>
              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(programs.length? programs : [
                  { title: 'Junior Secondary', desc: 'Strong foundations in literacy, numeracy, sciences and arts.' },
                  { title: 'Senior School', desc: 'KCSE-aligned subjects with personalized mentorship.' },
                  { title: 'STEM', desc: 'Labs, coding, robotics and competitions to spark innovation.' },
                ]).map((p, idx)=> (
                  <div key={idx} className="rounded-xl border border-gray-200 p-4 bg-white">
                    <input className="font-semibold text-gray-900 bg-transparent outline-none w-full" value={p.title || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.programs||[])]; arr[idx] = { ...(arr[idx]||{}), title:e.target.value }; return { ...f, homepage:{ ...f.homepage, programs:arr } } })} />
                    <textarea rows={3} className="mt-2 text-sm text-gray-600 bg-transparent outline-none w-full" value={p.desc || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.programs||[])]; arr[idx] = { ...(arr[idx]||{}), desc:e.target.value }; return { ...f, homepage:{ ...f.homepage, programs:arr } } })} />
                    <div className="mt-2 text-right">
                      <button type="button" className="text-sm text-red-600" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.programs||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, programs:arr } } })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.programs||[])]; if(arr.length<6) arr.push({ title:'', desc:'' }); return { ...f, homepage:{ ...f.homepage, programs:arr } } })}>Add Program</button>
              </div>
            </section>

            {/* Admissions */}
            <section className="mt-16">
              <h3 className="text-lg font-semibold text-gray-900">Admissions</h3>
              <div className="mt-3 grid md:grid-cols-2 gap-4">
                <div>
                  <textarea rows={3} className="w-full border p-2 rounded" placeholder="Admissions blurb" value={admissions.text || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, text:e.target.value } } }))} />
                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                    <input className="border p-2 rounded" placeholder="Primary CTA Text" value={admissions.primaryText || 'Apply / Inquire'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, primaryText:e.target.value } } }))} />
                    <input className="border p-2 rounded" placeholder="Primary CTA Link" value={admissions.applicationLink || '/admissions'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, applicationLink:e.target.value } } }))} />
                    <input className="border p-2 rounded" placeholder="Secondary CTA Text" value={admissions.secondaryText || 'Call Admissions'} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, secondaryText:e.target.value } } }))} />
                    <input className="border p-2 rounded" placeholder="Secondary CTA Link" value={admissions.secondaryLink || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, secondaryLink:e.target.value } } }))} />
                  </div>
                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                    <input className="border p-2 rounded" placeholder="School Address (used for map)" value={form.address || ''} onChange={e=>setForm(f=>({ ...f, address:e.target.value }))} />
                    <button type="button" className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={()=>{
                      const addr = (form.address||'').trim()
                      if(!addr) return
                      const embed = `https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`
                      setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, mapUrl:embed } } }))
                    }}>Use address for map</button>
                  </div>
                  <div className="mt-3">
                    <input className="border p-2 rounded w-full" placeholder="Grades open (comma-separated)" value={(admissions.grades||[]).join(', ')} onChange={e=>{ const arr = e.target.value.split(',').map(s=>s.trim()).filter(Boolean); setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, grades:arr } } })) }} />
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="text-sm">
                    <div>Admission Letter URL</div>
                    <input className="mt-1 border p-2 rounded w-full" value={admissions.letterUrl || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, letterUrl:e.target.value } } }))} placeholder="https://.../admission-letter.pdf" />
                    {admissions.letterUrl && (
                      <div className="mt-2 text-xs">Current: <a className="text-indigo-700 hover:underline" href={toAbsoluteUrl(admissions.letterUrl)} target="_blank" rel="noreferrer">Download</a></div>
                    )}
                    <div className="mt-4">Map Embed URL</div>
                    <input className="mt-1 border p-2 rounded w-full" value={admissions.mapUrl || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...admissions, mapUrl:e.target.value } } }))} placeholder="https://www.google.com/maps/embed?..." />
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" className="px-3 py-2 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700" onClick={()=>setPickerOpen(true)}>Pick on live map</button>
                      {(admissions.mapLat && admissions.mapLng) && (
                        <span className="text-xs text-gray-600">{admissions.mapLat}, {admissions.mapLng}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* News / Highlights */}
            <section className="mt-16">
              <h3 className="text-lg font-semibold text-gray-900">News & Highlights</h3>
              <p className="text-sm text-gray-600 mt-1">Add up to 6 recent items to appear on the homepage.</p>
              <div className="mt-4 grid gap-3">
                {(Array.isArray(form.homepage?.news) ? form.homepage.news : []).map((n, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 grid md:grid-cols-4 gap-3 items-start">
                    <label className="text-sm">
                      <div>Title</div>
                      <input className="border p-2 rounded w-full mt-1" value={n.title || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.news||[])]; arr[idx]={...arr[idx], title:e.target.value}; return { ...f, homepage:{ ...f.homepage, news:arr } } })} />
                    </label>
                    <label className="text-sm">
                      <div>Date</div>
                      <input type="date" className="border p-2 rounded w-full mt-1" value={(n.date && /^\d{4}-\d{2}-\d{2}$/.test(n.date)? n.date : '')} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.news||[])]; arr[idx]={...arr[idx], date:e.target.value}; return { ...f, homepage:{ ...f.homepage, news:arr } } })} />
                    </label>
                    <label className="text-sm">
                      <div>Link URL</div>
                      <input className="border p-2 rounded w-full mt-1" value={n.url || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.news||[])]; arr[idx]={...arr[idx], url:e.target.value}; return { ...f, homepage:{ ...f.homepage, news:arr } } })} />
                    </label>
                    <div className="text-sm">
                      <div>Image</div>
                      <div className="mt-1 flex items-center gap-2">
                        <input className="border p-2 rounded w-full" placeholder="Image URL" value={n.image || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.news||[])]; arr[idx]={...arr[idx], image:e.target.value}; return { ...f, homepage:{ ...f.homepage, news:arr } } })} />
                        <label className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-xs">Upload
                          <input type="file" accept="image/*" className="hidden" onChange={async ev=>{
                            const file = ev.target.files?.[0]
                            if(!file) return
                            const fd = new FormData()
                            fd.append('file', file)
                            try{
                              const { data } = await api.post('/communications/upload-admission-letter/', fd, { headers:{'Content-Type':'multipart/form-data'} })
                              const url = data?.url || ''
                              setForm(f=>{ const arr=[...(f.homepage?.news||[])]; arr[idx]={...arr[idx], image:url}; return { ...f, homepage:{ ...f.homepage, news:arr } } })
                              ev.target.value = ''
                            }catch(e){ /* ignore */ }
                          }} />
                        </label>
                      </div>
                    </div>
                    <label className="text-sm md:col-span-4">
                      <div>Content</div>
                      <textarea rows={6} className="border p-2 rounded w-full mt-1" placeholder="Write the full story here…" value={n.content || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.news||[])]; arr[idx]={...arr[idx], content:e.target.value}; return { ...f, homepage:{ ...f.homepage, news:arr } } })} />
                      <div className="text-xs text-gray-500 mt-1">Tip: You can paste plain text; line breaks become paragraphs on the site.</div>
                    </label>
                    <div className="md:col-span-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {n.image ? <img alt="preview" src={toAbsoluteUrl(n.image)} className="h-10 w-16 object-cover rounded border"/> : <div className="h-10 w-16 bg-gray-100 rounded border" />}
                        <span>Preview</span>
                      </div>
                      <button type="button" className="text-sm text-red-600" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.news||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, news:arr } } })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200 w-fit" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.news||[])]; if(arr.length<6) arr.push({ title:'', date:'', url:'', image:'' }); return { ...f, homepage:{ ...f.homepage, news:arr } } })}>Add News Item</button>
              </div>
            </section>

            {/* Map Picker Modal */}
            {pickerOpen && (
              <div className="fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/40" onClick={()=>setPickerOpen(false)} />
                <div className="absolute inset-0 grid place-items-center p-4">
                  <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-200">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div className="text-base font-semibold text-gray-900">Pick School Location</div>
                      <button className="p-2 rounded hover:bg-gray-50" onClick={()=>setPickerOpen(false)} aria-label="Close">✕</button>
                    </div>
                    <div className="p-4">
                      <div ref={mapRef} />
                      <div className="mt-3 text-xs text-gray-600">Click on the map to set the marker. Coordinates will be saved automatically.</div>
                    </div>
                    <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                      <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={()=>setPickerOpen(false)}>Done</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sticky Save */}
            <div className="sticky bottom-0 -mx-6 mt-6 border-t border-gray-200 bg-white/90 backdrop-blur px-6 py-3 flex items-center justify-end gap-2 rounded-b-2xl">
              <button className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={load} disabled={saving}>Reset</button>
              <button className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60" onClick={submit} disabled={saving}>{saving? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
