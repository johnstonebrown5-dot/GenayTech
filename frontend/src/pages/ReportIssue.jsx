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
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Report an Issue</h1>
        <p className="text-sm text-gray-600 mt-1">Found a bug or something confusing? Tell the developers. We appreciate detailed steps and screenshots.</p>
      </div>

      {done && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 text-green-800 p-3 text-sm">
          Thank you! Your report has been sent to the developers.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 p-3 text-sm">
          {String(error)}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            placeholder="Short summary (e.g., Cannot save fees settings)"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            rows={6}
            value={description}
            onChange={(e)=>setDescription(e.target.value)}
            placeholder="What happened? Steps to reproduce, what you expected, any error messages, etc."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Severity</label>
            <select
              value={severity}
              onChange={(e)=>setSeverity(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Current Page URL</label>
            <input
              type="url"
              value={pageUrl}
              onChange={(e)=>setPageUrl(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Screenshot (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e)=>setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Or Screenshot URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={screenshotUrl}
              onChange={(e)=>setScreenshotUrl(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className={`px-4 py-2 rounded-md text-white font-medium ${(!canSubmit||submitting)?'bg-blue-300 cursor-not-allowed':'bg-blue-600 hover:bg-blue-700'}`}
          >
            {submitting ? 'Sending…' : 'Send to Developers'}
          </button>
          <button type="button" onClick={()=>navigate(-1)} className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  )
}
