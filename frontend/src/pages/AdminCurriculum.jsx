import React, { useEffect, useState } from 'react'
import api from '../api'
import Modal from '../components/Modal'

export default function AdminCurriculum(){
  const [list, setList] = useState([])
  const [form, setForm] = useState({ code:'', title:'', description:'', level_scale:'Emerging,Developing,Proficient,Mastered' })
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    const { data } = await api.get('/academics/competencies/')
    setList(data)
  }
  useEffect(()=>{ load() },[])

  const create = async (e) => {
    e.preventDefault()
    const level_scale = form.level_scale.split(',').map(s=>s.trim()).filter(Boolean)
    await api.post('/academics/competencies/', { ...form, level_scale })
    setForm({ code:'', title:'', description:'', level_scale:'Emerging,Developing,Proficient,Mastered' })
    load()
  }

  return (
    <React.Fragment>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Manage Curriculum (CBC Competencies)</h1>
        <div className="bg-white rounded shadow p-4 flex items-center justify-between">
          <div className="font-medium">CBC Competencies</div>
          <button onClick={()=>{ setForm({ code:'', title:'', description:'', level_scale:'Emerging,Developing,Proficient,Mastered' }); setShowModal(true) }} className="bg-blue-600 text-white px-4 py-2 rounded">Add Competency</button>
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-medium mb-2">Competencies</h2>
          <table className="w-full text-left text-sm">
            <thead><tr><th>Code</th><th>Title</th><th>Levels</th></tr></thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} className="border-t">
                  <td>{c.code}</td>
                  <td>{c.title}</td>
                  <td>{Array.isArray(c.level_scale) ? c.level_scale.join(', ') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={showModal} onClose={()=>setShowModal(false)} title="Add Competency" size="md">
        <form onSubmit={(e)=>{ create(e); setShowModal(false) }} className="grid gap-3 md:grid-cols-2">
          <input className="border p-2 rounded" placeholder="Code (e.g., ENG-1)" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} required />
          <input className="border p-2 rounded" placeholder="Title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} required />
          <textarea className="border p-2 rounded md:col-span-2" placeholder="Description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
          <input className="border p-2 rounded md:col-span-2" placeholder="Levels CSV (Emerging,Developing,Proficient,Mastered)" value={form.level_scale} onChange={e=>setForm({...form, level_scale:e.target.value})} />
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 rounded border">Cancel</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Add Competency</button>
          </div>
        </form>
      </Modal>
    </React.Fragment>
  )
}
