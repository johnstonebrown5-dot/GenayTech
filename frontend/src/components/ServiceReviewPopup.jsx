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

  useEffect(() => {
    const key = 'service_review_status'
    const status = JSON.parse(localStorage.getItem(key) || 'null')
    const now = Date.now()
    // Don't show if already submitted or dismissed in last 7 days
    if (status && status.until && now < status.until) return

    const id = setTimeout(() => setOpen(true), 30_000)
    return () => clearTimeout(id)
  }, [])

  const stars = useMemo(() => [1,2,3,4,5], [])

  function remember(status){
    const days = status === 'submitted' ? 365 : 7
    localStorage.setItem('service_review_status', JSON.stringify({ status, until: Date.now() + days*24*60*60*1000 }))
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
