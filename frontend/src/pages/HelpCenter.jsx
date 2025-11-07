import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import content from '../content/helpContent.json'
import { useAssistant } from '../components/Assistant/AssistantContext'

export default function HelpCenter(){
  const { user } = useAuth()
  const navigate = useNavigate()
  const { openPanel } = useAssistant()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => { if (user?.role) setRole(pretty(user.role)) }, [user?.role])

  const items = useMemo(() => {
    const all = role && content[role] ? content[role] : []
    const term = q.trim().toLowerCase()
    if (!term) return all
    const tokens = term.split(/\s+/).filter(Boolean)
    const norm = (s)=> String(s||'').toLowerCase()
    const sim = (a,b)=>{
      a = norm(a); b = norm(b); if(!a||!b) return 0
      const m = Array.from(new Set(a.split(/\s+/))).filter(Boolean)
      const n = Array.from(new Set(b.split(/\s+/))).filter(Boolean)
      const inter = m.filter(t => n.includes(t)).length
      const jacc = inter / Math.max(1, new Set([...m, ...n]).size)
      const substr = b.includes(a) ? 0.2 : 0
      return Math.min(1, jacc + substr)
    }
    const scored = all.map(it => {
      const hay = [it.title, it.description, Array.isArray(it.tags)? it.tags.join(' '): ''].join(' ')
      const s1 = sim(term, hay)
      const s2 = Math.max(...tokens.map(t => sim(t, hay)))
      const score = Math.max(s1, s2)
      return { it, score }
    }).sort((a,b)=> b.score - a.score)
    // Show top results even if low score; hide only if all zero
    if (scored.every(x => x.score === 0)) return []
    return scored.slice(0, 10).map(x => x.it)
  }, [q, role])

  const askAssistant = () => {
    const query = q.trim()
    if (!query) return
    try { openPanel() } catch {}
    try { window.dispatchEvent(new CustomEvent('assistant:ask', { detail: { q: query } })) } catch {}
  }
  const onKeyDown = (e) => { if (e.key === 'Enter') askAssistant() }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {!role && (
          <div className="text-slate-600">Loading your role...</div>
        )}
        {role && (
        <>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={()=> navigate(-1)} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10.53 4.47a.75.75 0 010 1.06L5.81 10.25H20a.75.75 0 010 1.5H5.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z" clipRule="evenodd"/></svg>
              <span>Back</span>
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Help Center</h1>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch gap-3 mb-6">
          <div className="flex-1">
            <div className="relative">
              <input
                value={q}
                onChange={e=> setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search tasks, e.g. fees, attendance, report card"
                className="w-full h-11 px-4 pr-10 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={askAssistant} title="Ask Assistant" className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-slate-600"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            </div>
          </div>
          <div className="flex items-center">
            <span className="inline-flex items-center gap-2 h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              {role}
            </span>
          </div>
        </div>

        <div className="grid gap-3">
          {items.map(it => (
            <details key={it.id} className="group bg-white border border-slate-200 rounded-lg overflow-hidden">
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{it.title}</div>
                  <div className="text-sm text-slate-600 truncate">{it.description}</div>
                </div>
                <svg className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
              </summary>
              <div className="px-4 pb-4">
                <ol className="list-decimal pl-5 space-y-1 text-slate-700">
                  {(it.steps||[]).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ol>
                {it.deepLink && (
                  <div className="mt-3">
                    <a href={it.deepLink} className="inline-flex items-center gap-2 text-blue-600 hover:underline">
                      Open page
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3.75 12a.75.75 0 01.75-.75h12.69l-3.97-3.97a.75.75 0 111.06-1.06l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06l3.97-3.97H4.5a.75.75 0 01-.75-.75z" clipRule="evenodd"/></svg>
                    </a>
                  </div>
                )}
              </div>
            </details>
          ))}

          {items.length === 0 && (
            <div className="text-slate-600">No results. Try a different search or role.</div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

function pretty(r){
  if (!r) return r
  const m = { admin: 'Admin', teacher: 'Teacher', student: 'Student', finance: 'Finance' }
  return m[r] || (r.charAt(0).toUpperCase() + r.slice(1))
}
