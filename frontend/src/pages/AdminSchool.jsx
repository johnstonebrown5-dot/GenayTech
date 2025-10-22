import React, { useEffect, useState } from 'react'
import api, { toAbsoluteUrl } from '../api'
import AdminLayout from '../components/AdminLayout'

export default function AdminSchool(){
  const [form, setForm] = useState({ name:'', code:'', address:'', motto:'', aim:'', social_links:{ facebook:'', twitter:'', instagram:'', youtube:'', website:'' }, homepage:{ hero:{}, about:{}, stats:{}, admissions:{}, programs:[] }, logo:null, logoUrl:'' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const load = async () => {
    setLoading(true)
    setError(''); setOk('')
    try {
      const { data } = await api.get('/auth/school/me/')
      setForm({
        name: data.name || '',
        code: data.code || '',
        address: data.address || '',
        motto: data.motto || '',
        aim: data.aim || '',
        social_links: {
          facebook: data.social_links?.facebook || '',
          twitter: data.social_links?.twitter || '',
          instagram: data.social_links?.instagram || '',
          youtube: data.social_links?.youtube || '',
          website: data.social_links?.website || '',
        },
        homepage: data.homepage || {},
        logo: null,
        logoUrl: toAbsoluteUrl(data.logo_url || data.logo || '')
      })
    } catch (e) {
      setError(e?.response?.data?.detail || 'No school linked to this admin. Create a School in Django Admin and link it to your user.')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() },[])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setOk('')
    try {
      // Submit as multipart with JSON string for social_links
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('code', form.code)
      fd.append('address', form.address)
      fd.append('motto', form.motto || '')
      fd.append('aim', form.aim || '')
      fd.append('social_links', JSON.stringify(form.social_links || {}))
      fd.append('homepage', JSON.stringify(form.homepage || {}))
      if (form.logo instanceof File) fd.append('logo', form.logo)
      const { data } = await api.put('/auth/school/me/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setOk('Saved successfully')
      setForm({
        name: data.name || '',
        code: data.code || '',
        address: data.address || '',
        motto: data.motto || '',
        aim: data.aim || '',
        social_links: {
          facebook: data.social_links?.facebook || '',
          twitter: data.social_links?.twitter || '',
          instagram: data.social_links?.instagram || '',
          youtube: data.social_links?.youtube || '',
          website: data.social_links?.website || '',
        },
        logo: null,
        logoUrl: toAbsoluteUrl(data.logo_url || data.logo || '')
      })
    } catch (e) {
      const resp = e?.response?.data
      const msg = typeof resp === 'string' ? resp : (resp?.detail || JSON.stringify(resp) || e.message || 'Failed to save')
      setError(msg)
    } finally { setSaving(false) }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold">School Settings</h1>
        <div className="sticky top-16 z-10 bg-white/85 backdrop-blur rounded-lg border border-gray-200">
          <nav className="flex flex-wrap gap-2 px-3 py-2 text-sm text-gray-600">
            <a href="#profile" className="px-3 py-1.5 rounded hover:bg-gray-50">Profile</a>
            <a href="#social" className="px-3 py-1.5 rounded hover:bg-gray-50">Social</a>
            <a href="#homepage" className="px-3 py-1.5 rounded hover:bg-gray-50">Homepage</a>
            <a href="#admissions" className="px-3 py-1.5 rounded hover:bg-gray-50">Admissions</a>
            <a href="#programs" className="px-3 py-1.5 rounded hover:bg-gray-50">Programs</a>
            <a href="#branding" className="px-3 py-1.5 rounded hover:bg-gray-50">Branding</a>
          </nav>
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 grid gap-4">
            {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
            {ok && <div className="bg-green-50 text-green-700 p-2 rounded text-sm">{ok}</div>}
            <div id="profile" className="-mt-4 pt-4" />
            <h2 className="text-base font-semibold">Profile</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">School Name
                <input className="border p-2 rounded w-full mt-1" placeholder="e.g., Sunrise Primary & Junior Secondary" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
              </label>
              <label className="text-sm">School Code
                <input className="border p-2 rounded w-full mt-1" placeholder="e.g., SUNRISE" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} required />
              </label>
            </div>
            <label className="text-sm">Address
              <textarea className="border p-2 rounded w-full mt-1" rows={3} placeholder="e.g., P.O. Box 1234, Town, Country" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
            </label>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">Motto
                <input className="border p-2 rounded w-full mt-1" placeholder="Your inspiring motto" value={form.motto} onChange={e=>setForm({...form, motto:e.target.value})} />
              </label>
              <label className="text-sm">Aim
                <textarea className="border p-2 rounded w-full mt-1" rows={2} placeholder="Brief aim/mission statement" value={form.aim} onChange={e=>setForm({...form, aim:e.target.value})} />
              </label>
            </div>

            <div id="social" className="pt-6" />
            <h2 className="text-base font-semibold">Social Links</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">Email
                <input className="border p-2 rounded w-full mt-1" placeholder="info@yourschool.ac.ke" value={form.social_links.email || ''} onChange={e=>setForm({...form, social_links:{...form.social_links, email:e.target.value}})} />
              </label>
              <label className="text-sm">Phone
                <input className="border p-2 rounded w-full mt-1" placeholder="+254 700 000 000" value={form.social_links.phone || ''} onChange={e=>setForm({...form, social_links:{...form.social_links, phone:e.target.value}})} />
              </label>
              <label className="text-sm">Facebook
                <input className="border p-2 rounded w-full mt-1" placeholder="https://facebook.com/yourpage" value={form.social_links.facebook} onChange={e=>setForm({...form, social_links:{...form.social_links, facebook:e.target.value}})} />
              </label>
              <label className="text-sm">Twitter / X
                <input className="border p-2 rounded w-full mt-1" placeholder="https://x.com/yourhandle" value={form.social_links.twitter} onChange={e=>setForm({...form, social_links:{...form.social_links, twitter:e.target.value}})} />
              </label>
              <label className="text-sm">Instagram
                <input className="border p-2 rounded w-full mt-1" placeholder="https://instagram.com/yourhandle" value={form.social_links.instagram} onChange={e=>setForm({...form, social_links:{...form.social_links, instagram:e.target.value}})} />
              </label>
              <label className="text-sm">YouTube
                <input className="border p-2 rounded w-full mt-1" placeholder="https://youtube.com/@yourchannel" value={form.social_links.youtube} onChange={e=>setForm({...form, social_links:{...form.social_links, youtube:e.target.value}})} />
              </label>
              <label className="text-sm md:col-span-2">Website
                <input className="border p-2 rounded w-full mt-1" placeholder="https://www.yourschool.ac.ke" value={form.social_links.website} onChange={e=>setForm({...form, social_links:{...form.social_links, website:e.target.value}})} />
              </label>
            </div>

            <div id="branding" className="pt-6" />
            <h2 className="text-base font-semibold">Branding</h2>
            <div className="grid md:grid-cols-2 gap-3 items-start">
              <label className="text-sm">Logo
                <input type="file" accept="image/*" className="border p-2 rounded w-full mt-1" onChange={e=>{
                  const file = e.target.files?.[0] || null
                  setForm(prev=>({ ...prev, logo:file, logoUrl: file ? URL.createObjectURL(file) : prev.logoUrl }))
                }} />
              </label>
              {form.logoUrl && (
                <div className="text-sm">
                  <div className="text-gray-600 mb-1">Preview</div>
                  <img src={form.logoUrl} alt="Logo preview" className="h-16 object-contain border rounded" />
                </div>
              )}
            </div>

            <hr className="my-2 border-gray-200" />
            <h2 className="text-base font-semibold">Homepage Content</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">Hero Badge
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.hero?.badge || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...f.homepage?.hero, badge:e.target.value } } }))} />
              </label>
              <label className="text-sm">Hero Title
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.hero?.title || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...f.homepage?.hero, title:e.target.value } } }))} />
              </label>
              <label className="text-sm md:col-span-2">Hero Subtitle
                <textarea className="border p-2 rounded w-full mt-1" rows={2} value={form.homepage?.hero?.subtitle || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...f.homepage?.hero, subtitle:e.target.value } } }))} />
              </label>
              <label className="text-sm">Primary CTA Text
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.hero?.ctaPrimaryText || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...f.homepage?.hero, ctaPrimaryText:e.target.value } } }))} />
              </label>
              <label className="text-sm">Primary CTA Link
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.hero?.ctaPrimaryLink || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...f.homepage?.hero, ctaPrimaryLink:e.target.value } } }))} />
              </label>
              <label className="text-sm">Secondary CTA Text
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.hero?.ctaSecondaryText || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...f.homepage?.hero, ctaSecondaryText:e.target.value } } }))} />
              </label>
              <label className="text-sm">Secondary CTA Link
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.hero?.ctaSecondaryLink || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, hero:{ ...f.homepage?.hero, ctaSecondaryLink:e.target.value } } }))} />
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm md:col-span-2">Hero Images (URLs)
                <div className="mt-1 grid md:grid-cols-2 gap-2">
                  {Array.from({length:4}).map((_,idx)=> (
                    <input key={idx} className="border p-2 rounded w-full" placeholder={idx===0? 'Main image URL':'Thumbnail URL'} value={(form.homepage?.hero?.images || [])[idx] || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.hero?.images||[])]; arr[idx]=e.target.value; return { ...f, homepage:{ ...f.homepage, hero:{ ...f.homepage?.hero, images:arr } } } })} />
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-1">Paste full image URLs (e.g., https://.../image.jpg). You can upload to your hosting or use media URLs from your backend.</div>
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">About Title
                <input className="border p-2 rounded w-full mt-1" placeholder={`About ${form.name || 'Our School'}`} value={form.homepage?.about?.title || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, about:{ ...f.homepage?.about, title:e.target.value } } }))} />
              </label>
              <label className="text-sm md:col-span-2">About Text
                <textarea className="border p-2 rounded w-full mt-1" rows={3} value={form.homepage?.about?.text || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, about:{ ...f.homepage?.about, text:e.target.value } } }))} />
              </label>
              <label className="text-sm md:col-span-2">About Bullets (comma-separated)
                <input className="border p-2 rounded w-full mt-1" value={(form.homepage?.about?.bullets || []).join(', ')} onChange={e=>{
                  const parts = e.target.value.split(',').map(s=>s.trim()).filter(Boolean)
                  setForm(f=>({ ...f, homepage:{ ...f.homepage, about:{ ...f.homepage?.about, bullets:parts } } }))
                }} />
              </label>
              <label className="text-sm">Stat: Ratio
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.stats?.ratio || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, stats:{ ...f.homepage?.stats, ratio:e.target.value } } }))} />
              </label>
              <label className="text-sm">Stat: Completion
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.stats?.completion || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, stats:{ ...f.homepage?.stats, completion:e.target.value } } }))} />
              </label>
              <label className="text-sm">Stat: Clubs
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.stats?.clubs || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, stats:{ ...f.homepage?.stats, clubs:e.target.value } } }))} />
              </label>
              <label className="text-sm">Stat: Years
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.stats?.years || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, stats:{ ...f.homepage?.stats, years:e.target.value } } }))} />
              </label>
            </div>

            <div id="admissions" className="pt-6" />
            <h2 className="text-base font-semibold">Admissions</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm md:col-span-2">Admissions Text
                <textarea className="border p-2 rounded w-full mt-1" rows={3} value={form.homepage?.admissions?.text || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, text:e.target.value } } }))} />
              </label>
              <label className="text-sm md:col-span-2">Admissions Bullets (comma-separated)
                <input className="border p-2 rounded w-full mt-1" value={(form.homepage?.admissions?.bullets || []).join(', ')} onChange={e=>{
                  const parts = e.target.value.split(',').map(s=>s.trim()).filter(Boolean)
                  setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, bullets:parts } } }))
                }} />
              </label>
              <label className="text-sm">Admissions Primary Text
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.admissions?.primaryText || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, primaryText:e.target.value } } }))} />
              </label>
              <label className="text-sm">Admissions Primary Link
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.admissions?.primaryLink || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, primaryLink:e.target.value } } }))} />
              </label>
              <label className="text-sm">Admissions Secondary Text
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.admissions?.secondaryText || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, secondaryText:e.target.value } } }))} />
              </label>
              <label className="text-sm">Admissions Secondary Link
                <input className="border p-2 rounded w-full mt-1" value={form.homepage?.admissions?.secondaryLink || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, secondaryLink:e.target.value } } }))} />
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-3 items-start">
              <label className="text-sm">Application Link (opens form)
                <input className="border p-2 rounded w-full mt-1" placeholder="/admissions or https://..." value={form.homepage?.admissions?.applicationLink || ''} onChange={e=>setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, applicationLink:e.target.value } } }))} />
              </label>
              <label className="text-sm">Grades Open (comma-separated)
                <input className="border p-2 rounded w-full mt-1" placeholder="e.g., PP1, Grade 1, Grade 7, Form 1" value={(form.homepage?.admissions?.grades || []).join(', ')} onChange={e=>{
                  const parts = e.target.value.split(',').map(s=>s.trim()).filter(Boolean)
                  setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, grades:parts } } }))
                }} />
              </label>
              <div className="text-sm">
                <div>Admission Letter (PDF/Image)</div>
                <div className="mt-1 flex gap-2">
                  <input type="file" accept=".pdf,image/*" className="border p-2 rounded w-full" onChange={async e=>{
                    const file = e.target.files?.[0]
                    if (!file) return
                    const fd = new FormData()
                    fd.append('file', file)
                    try{
                      const { data } = await api.post('/communications/upload-admission-letter/', fd, { headers:{'Content-Type':'multipart/form-data'} })
                      const url = data?.url || ''
                      setForm(f=>({ ...f, homepage:{ ...f.homepage, admissions:{ ...f.homepage?.admissions, letterUrl:url } } }))
                      setOk('Admission letter uploaded')
                    }catch(err){ setError('Upload failed') }
                  }} />
                </div>
                {form.homepage?.admissions?.letterUrl && (
                  <div className="mt-2 text-xs">
                    Current: <a href={form.homepage.admissions.letterUrl} className="text-indigo-700 hover:underline" target="_blank" rel="noreferrer">Download</a>
                  </div>
                )}
              </div>
            </div>

            <div id="programs" className="pt-6" />
            <div className="mt-2">
              <h2 className="text-base font-semibold">Academic Programs</h2>
              <p className="text-sm text-gray-600">Add up to 6 items that will appear under the Academics section on the homepage.</p>
              <div className="mt-3 grid gap-3">
                {(form.homepage?.programs || []).map((p, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-3 grid md:grid-cols-2 gap-3">
                    <label className="text-sm">Title
                      <input className="border p-2 rounded w-full mt-1" value={p.title || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.programs||[])]; arr[idx]={...arr[idx], title:e.target.value}; return { ...f, homepage:{ ...f.homepage, programs:arr } } })} />
                    </label>
                    <label className="text-sm">Description
                      <input className="border p-2 rounded w-full mt-1" value={p.desc || ''} onChange={e=>setForm(f=>{ const arr=[...(f.homepage?.programs||[])]; arr[idx]={...arr[idx], desc:e.target.value}; return { ...f, homepage:{ ...f.homepage, programs:arr } } })} />
                    </label>
                    <div className="md:col-span-2 flex justify-end">
                      <button type="button" className="text-sm text-red-600 hover:underline" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.programs||[])]; arr.splice(idx,1); return { ...f, homepage:{ ...f.homepage, programs:arr } } })}>Remove</button>
                    </div>
                  </div>
                ))}
                <div>
                  <button type="button" className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200" onClick={()=>setForm(f=>{ const arr=[...(f.homepage?.programs||[])]; if(arr.length<6) arr.push({ title:'', desc:'' }); return { ...f, homepage:{ ...f.homepage, programs:arr } } })}>Add Program</button>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 -mx-4 md:-mx-5 mt-2 border-t border-gray-200 bg-white/90 backdrop-blur px-4 md:px-5 py-3 flex items-center justify-end gap-2 rounded-b-xl">
              <button type="button" className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={load} disabled={saving}>Reset</button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60" disabled={saving}>{saving? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  )
}
