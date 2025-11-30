import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import Modal from './Modal'

export default function ServiceReviewPopup(){
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const STORAGE_KEY = 'service_review_status'
  const FIRST_DELAY_MS = 5 * 60 * 1000
  const REPEAT_DELAY_MS = 60 * 60 * 1000

  useEffect(() => {
    if (typeof window === 'undefined') return
    let stored = null
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    } catch (err) {
      stored = null
    }

    const now = Date.now()

    if (stored?.status === 'submitted' && stored?.nextAt == null) {
      return
    }

    let nextAt = stored?.nextAt ?? null

    if (!nextAt && stored?.until && now < stored.until) {
      nextAt = stored.until
    }

    if (!nextAt) {
      nextAt = now + FIRST_DELAY_MS
      const updated = { ...(stored || {}), status: stored?.status || 'pending', nextAt }
      delete updated.until
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }

    const delay = Math.max(nextAt - now, 0)
    if (delay === 0) {
      setOpen(true)
      return
    }

    const id = setTimeout(() => setOpen(true), delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    let stored = null
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    } catch (err) {
      stored = null
    }
    if (stored?.status === 'submitted') return
    const nextAt = Date.now() + REPEAT_DELAY_MS
    const updated = { ...(stored || {}), status: stored?.status || 'prompted', nextAt }
    delete updated.until
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [open])

  const stars = useMemo(() => [1,2,3,4,5], [])

  function remember(status){
    if (typeof window === 'undefined') return
    const now = Date.now()
    if (status === 'submitted') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, nextAt: null, until: now + 365*24*60*60*1000 }))
      return
    }
    const nextAt = now + REPEAT_DELAY_MS
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, nextAt }))
  }

  async function onSubmit(e){
    e?.preventDefault?.()
    if (!rating || submitting) return
    setSubmitting(true)
    setError('')
    try{
      const pageUrl = (typeof window !== 'undefined') ? window.location.href : ''
      await api.post('/communications/service-reviews/', { rating, comment, name, email, page_url: pageUrl })
      remember('submitted')
      setDone(true)
      setTimeout(() => setOpen(false), 1500)
    }catch(err){
      setError(err?.response?.data?.detail || 'Failed to submit. Please try again.')
    }finally{
      setSubmitting(false)
    }
  }

  function onDismiss(){
    remember('dismissed')
    setOpen(false)
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={onDismiss} title={done ? 'Thank you!' : 'Rate your experience'} size="sm">
      {done ? (
        <div className="text-sm text-gray-700">We appreciate your feedback.</div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center gap-1">
            {stars.map(s => (
              <button
                type="button"
                key={s}
                aria-label={`Rate ${s}`}
                onClick={()=>setRating(s)}
                className={`text-2xl ${rating >= s ? 'text-yellow-400' : 'text-gray-300'}`}
              >★</button>
            ))}
          </div>
          <textarea
            rows={3}
            value={comment}
            onChange={(e)=>setComment(e.target.value)}
            placeholder="Tell us more (optional)"
            className="w-full rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={name}
              onChange={(e)=>setName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              placeholder="Email (optional)"
              className="w-full rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {error && (<div className="text-sm text-red-600">{error}</div>)}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onDismiss} className="px-3 py-1.5 rounded-md text-sm border bg-white text-gray-700 hover:bg-gray-50">Maybe later</button>
            <button type="submit" disabled={!rating||submitting} className={`px-3 py-1.5 rounded-md text-sm text-white ${(!rating||submitting)?'bg-blue-300 cursor-not-allowed':'bg-blue-600 hover:bg-blue-700'}`}>{submitting? 'Submitting…':'Submit'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
