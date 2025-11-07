import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'

export default function ReportIssue(){
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('normal')
  const [pageUrl, setPageUrl] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try { setPageUrl(window.location.href) } catch {}
  }, [pathname])

  const canSubmit = useMemo(() => {
    return (title.trim().length > 0 || description.trim().length > 0)
  }, [title, description])

  async function onSubmit(e){
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError('')
    try{
      // Prefer multipart if file present
      if (file) {
        const form = new FormData()
        if (title) form.append('title', title)
        if (description) form.append('description', description)
        if (severity) form.append('severity', severity)
        if (pageUrl) form.append('page_url', pageUrl)
        if (screenshotUrl) form.append('screenshot_url', screenshotUrl)
        form.append('screenshot', file)
        await api.post('/communications/report-issue/', form, { headers: { 'Content-Type': 'multipart/form-data' }})
      } else {
        await api.post('/communications/report-issue/', {
          title,
          description,
          severity,
          page_url: pageUrl,
          screenshot_url: screenshotUrl,
        })
      }
      setDone(true)
      setTitle('')
      setDescription('')
      setSeverity('normal')
      setScreenshotUrl('')
      setFile(null)
      // keep pageUrl as-is
    } catch (e){
      setError(e?.response?.data?.detail || 'Failed to send. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-lg sm:max-w-2xl mx-auto px-4 sm:px-0 pb-8">
      <div className="relative">
        <div className="absolute -inset-[6px] rounded-2xl bg-gradient-to-br from-indigo-500/50 via-purple-500/40 to-fuchsia-500/50 blur opacity-90" />
        <div className="relative rounded-2xl bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.35)] ring-1 ring-white/70 border border-white/60 p-5 sm:p-6">
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-semibold">Feedback • Support</div>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Report an Issue</h1>
            <p className="text-sm text-gray-600 mt-1">Found a bug or something confusing? Tell the developers. We appreciate detailed steps and screenshots.</p>
          </div>

      {done && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50/90 text-green-800 p-3 text-sm shadow-sm">
          Thank you! Your report has been sent to the developers.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/90 text-red-800 p-3 text-sm shadow-sm">
          {String(error)}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-800">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            placeholder="Short summary (e.g., Cannot save fees settings)"
            className="mt-1 block w-full rounded-xl border border-gray-300 bg-white/90 px-3 py-2 shadow-inner focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-800">Description</label>
          <textarea
            rows={6}
            value={description}
            onChange={(e)=>setDescription(e.target.value)}
            placeholder="What happened? Steps to reproduce, what you expected, any error messages, etc."
            className="mt-1 block w-full rounded-xl border border-gray-300 bg-white/90 px-3 py-2 shadow-inner focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-800">Severity</label>
            <select
              value={severity}
              onChange={(e)=>setSeverity(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white/90 px-3 py-2 shadow-inner focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800">Current Page URL</label>
            <input
              type="url"
              value={pageUrl}
              onChange={(e)=>setPageUrl(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white/90 px-3 py-2 shadow-inner focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-800">Screenshot (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e)=>setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white/90 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800">Or Screenshot URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={screenshotUrl}
              onChange={(e)=>setScreenshotUrl(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white/90 px-3 py-2 shadow-inner focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className={`${(!canSubmit||submitting)?'opacity-60 cursor-not-allowed':''} inline-flex items-center justify-center px-4 py-2 rounded-full text-white font-semibold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30`}
          >
            {submitting ? 'Sending…' : 'Send to Developers'}
          </button>
          <button type="button" onClick={()=>navigate(-1)} className="px-4 py-2 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancel</button>
        </div>
      </form>
        </div>
      </div>
    </div>
  )
}
