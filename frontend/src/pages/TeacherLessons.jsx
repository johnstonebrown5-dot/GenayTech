import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api'
import { Editor } from '@tinymce/tinymce-react'
import FeatureUnavailable from '../components/FeatureUnavailable'
import { disabledPaths, disabledMessages, helpCenterPath } from '../featureFlags'

export default function TeacherLessons(){
  const { pathname } = useLocation()
  const isDisabled = (() => {
    try { return disabledPaths.some(p => pathname === p || (p.endsWith('*') && pathname.startsWith(p.slice(0, -1)))) } catch { return false }
  })()
  if (isDisabled) {
    return <FeatureUnavailable inline message={disabledMessages[pathname] || disabledMessages['*']} helpPath={helpCenterPath} />
  }
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [plans, setPlans] = useState([])
  const [terms, setTerms] = useState([])
  const [form, setForm] = useState({
    klass: '',
    subject: '',
    term: '',
    week: '',
    date: new Date().toISOString().slice(0,10),
    topic: '', objectives: '', activities: '', resources: '', assessment: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        setLoading(true)
        const [cls, lp, tr] = await Promise.all([
          api.get('/academics/classes/mine/'),
          api.get('/academics/lesson_plans/'),
          api.get('/academics/terms/of-current-year/').catch(()=>({ data: [] })),
        ])
        if (!mounted) return
        const clsArr = Array.isArray(cls.data) ? cls.data : (cls.data?.results || [])
        const plansArr = Array.isArray(lp.data) ? lp.data : (lp.data?.results || [])
        const termsArr = Array.isArray(tr.data?.results) ? tr.data.results : (Array.isArray(tr.data)? tr.data : [])
        setClasses(clsArr)
        setPlans(plansArr)
        setTerms(termsArr)
        if (clsArr && clsArr.length>0) {
          setSelected(String(clsArr[0].id))
          const firstSubj = (clsArr[0].subjects||[])[0]
          setForm(f => ({...f, klass: clsArr[0].id, subject: firstSubj? String(firstSubj.id): '', term: '', week: ''}))
        }
      }catch(e){ setError(e?.response?.data?.detail || e?.message) }
      finally{ if(mounted) setLoading(false) }
    })()
    return ()=>{ mounted = false }
  },[])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try{
      const payload = {
        ...form,
        klass: Number(form.klass||selected),
        subject: form.subject ? Number(form.subject) : null,
        term: form.term ? Number(form.term) : null,
        week: form.week ? Number(form.week) : null,
      }
      const res = await api.post('/academics/lesson_plans/', payload)
      setPlans(p => [res.data, ...p])
      setForm(f => ({ ...f, topic:'', objectives:'', activities:'', resources:'', assessment:'' }))
    }catch(e){ setError(e?.response?.data?.detail || e?.message || 'Failed to save plan') }
    finally{ setSaving(false) }
  }

  const selectedClass = useMemo(()=> classes.find(c=> String(c.id)===String(form.klass||selected)), [classes, form.klass, selected])
  const classSubjects = useMemo(()=> Array.isArray(selectedClass?.subjects)? selectedClass.subjects : [], [selectedClass])

  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">Lesson Plans</div>
      {loading && <div className="bg-white p-4 rounded shadow">Loading...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      <div className="bg-white rounded shadow">
        <div className="border-b px-4 py-3 font-medium text-base md:text-sm">Create Lesson Plan</div>
        <form onSubmit={submit} className="p-4 grid gap-4 md:gap-3">
          {/* Top controls: Class / Subject / Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col">
              <label className="text-base md:text-sm text-gray-700 mb-1">Class</label>
              <select className="border p-3 md:p-2 text-base md:text-sm rounded w-full h-12 md:h-10" value={form.klass||selected} onChange={e=>{
                const clsId = e.target.value
                const cls = classes.find(c=> String(c.id)===String(clsId))
                const firstSubj = (cls?.subjects||[])[0]
                setForm({...form, klass: clsId, subject: firstSubj? String(firstSubj.id) : ''})
              }}>
                {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-base md:text-sm text-gray-700 mb-1">Subject</label>
              <select className="border p-3 md:p-2 text-base md:text-sm rounded w-full h-12 md:h-10" value={form.subject} onChange={e=>setForm({...form, subject:e.target.value})}>
                <option value="">Select subject</option>
                {classSubjects.map(s=> <option key={s.id} value={s.id}>{s.code || s.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-base md:text-sm text-gray-700 mb-1">Date</label>
              <input type="date" className="border p-3 md:p-2 text-base md:text-sm rounded w-full h-12 md:h-10" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
            </div>
          </div>

          {/* Second row: Term / Week */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-base md:text-sm text-gray-700 mb-1">Term</label>
              <select className="border p-3 md:p-2 text-base md:text-sm rounded w-full h-12 md:h-10" value={form.term} onChange={e=>setForm({...form, term:e.target.value})}>
                <option value="">Select term</option>
                {terms.map(t=> <option key={t.id} value={t.id}>{t.name ? `${t.name} (T${t.number})` : `Term ${t.number}`}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-base md:text-sm text-gray-700 mb-1">Week</label>
              <select className="border p-3 md:p-2 text-base md:text-sm rounded w-full h-12 md:h-10" value={form.week} onChange={e=>setForm({...form, week:e.target.value})}>
                <option value="">Select week</option>
                {Array.from({length:13}, (_,i)=> i+1).map(w=> <option key={w} value={w}>Week {w}</option>)}
              </select>
            </div>
          </div>
          <input className="border p-3 md:p-2 text-base md:text-sm rounded h-12 md:h-10" placeholder="Topic" value={form.topic} onChange={e=>setForm({...form, topic:e.target.value})} required />
          <div className="min-w-0">
            <label className="block text-base md:text-sm text-gray-700 mb-1">Objectives</label>
            <Editor
              apiKey={import.meta.env.VITE_TINYMCE_API_KEY || 'no-api-key'}
              value={form.objectives}
              init={{
                height: 320,
                menubar: true,
                toolbar_mode: 'wrap',
                plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
                toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table | link image media | removeformat | preview',
                content_style: 'img,table{max-width:100%;height:auto;} body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-size:16px; line-height:1.7;}',
                branding: false,
              }}
              onEditorChange={(content)=> setForm({...form, objectives: content})}
            />
          </div>
          <div className="min-w-0">
            <label className="block text-base md:text-sm text-gray-700 mb-1">Activities</label>
            <Editor
              apiKey={import.meta.env.VITE_TINYMCE_API_KEY || 'no-api-key'}
              value={form.activities}
              init={{
                height: 320,
                menubar: true,
                toolbar_mode: 'wrap',
                plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
                toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table | link image media | removeformat | preview',
                content_style: 'img,table{max-width:100%;height:auto;} body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-size:16px; line-height:1.7;}',
                branding: false,
              }}
              onEditorChange={(content)=> setForm({...form, activities: content})}
            />
          </div>
          <div className="min-w-0">
            <label className="block text-base md:text-sm text-gray-700 mb-1">Resources</label>
            <Editor
              apiKey={import.meta.env.VITE_TINYMCE_API_KEY || 'no-api-key'}
              value={form.resources}
              init={{
                height: 300,
                menubar: true,
                toolbar_mode: 'wrap',
                plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
                toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table | link image media | removeformat | preview',
                content_style: 'img,table{max-width:100%;height:auto;} body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-size:16px; line-height:1.7;}',
                branding: false,
              }}
              onEditorChange={(content)=> setForm({...form, resources: content})}
            />
          </div>
          <div className="min-w-0">
            <label className="block text-base md:text-sm text-gray-700 mb-1">Assessment</label>
            <Editor
              apiKey={import.meta.env.VITE_TINYMCE_API_KEY || 'no-api-key'}
              value={form.assessment}
              init={{
                height: 300,
                menubar: true,
                toolbar_mode: 'wrap',
                plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
                toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table | link image media | removeformat | preview',
                content_style: 'img,table{max-width:100%;height:auto;} body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-size:16px; line-height:1.7;}',
                branding: false,
              }}
              onEditorChange={(content)=> setForm({...form, assessment: content})}
            />
          </div>
          <div className="flex justify-end md:justify-end">
            <button className="w-full md:w-auto px-4 md:px-3 py-3 md:py-2 rounded text-white text-base md:text-sm bg-blue-600 disabled:opacity-60" disabled={saving}>{saving ? 'Saving...' : 'Save Plan'}</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded shadow">
        <div className="border-b px-4 py-2 font-medium">My Plans</div>
        <div className="p-4">
          {plans.length===0 ? (
            <div className="text-sm text-gray-500">No lesson plans yet.</div>
          ) : (
            <ul className="grid md:grid-cols-2 gap-3">
              {plans.map(p => (
                <li key={p.id} className="border rounded p-3">
                  <div className="text-sm text-gray-600">{p.date}</div>
                  <div className="font-medium">{p.topic}</div>
                  <div className="text-xs text-gray-600 mt-1">Class #{p.klass} {p.subject ? `• Subject #${p.subject}` : ''}</div>
                  {(p.term_detail || p.term || p.week) && (
                    <div className="text-xs text-gray-600 mt-1">{p.term_detail ? (p.term_detail.name ? `${p.term_detail.name} (T${p.term_detail.number})` : `Term ${p.term_detail.number}`) : (p.term ? `Term ${p.term}` : '')} {p.week ? `• Week ${p.week}` : ''}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
