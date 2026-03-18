import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'

function safeJsonParse(value, fallback) {
  try { return JSON.parse(value) } catch { return fallback }
}

function normalizeLabel(label) {
  return String(label || '').toLowerCase().replace(/\s+/g, '-').trim()
}

function getTourStorageKey(userId) {
  return userId ? `teacher_onboarding_completed:${String(userId)}` : 'teacher_onboarding_completed'
}

export default function TeacherOnboardingTour({ userId, isClassTeacher }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const lastLocationRef = useRef('')

  const steps = useMemo(() => {
    const base = [
      {
        id: 'dashboard',
        title: 'Welcome to your dashboard',
        body: 'Start here to see quick actions and an overview of your classes and tasks.',
        targetTourId: 'teacher-nav:dashboard',
        route: '/teacher',
      },
      {
        id: 'grades',
        title: 'Grade entry',
        body: 'Enter marks and update grades for your subjects here.',
        targetTourId: 'teacher-nav:grades',
        route: '/teacher/grades',
      },
      {
        id: 'results',
        title: 'Results',
        body: 'View generated results and performance summaries.',
        targetTourId: 'teacher-nav:results',
        route: '/teacher/results',
      },
      {
        id: 'analytics',
        title: 'Analytics',
        body: 'Use analytics to understand class and subject performance trends.',
        targetTourId: 'teacher-nav:analytics',
        route: '/teacher/analytics',
      },
      {
        id: 'messages',
        title: 'Messages',
        body: 'Communicate with staff and keep up with announcements here.',
        targetTourId: 'teacher-nav:messages',
        route: '/teacher/messages',
      },
      {
        id: 'profile',
        title: 'Your profile',
        body: 'Update your details and account settings from your profile.',
        targetTourId: 'teacher-nav:profile',
        route: '/teacher/profile',
      },
    ]
    if (isClassTeacher) {
      base.splice(5, 0, {
        id: 'manage-class',
        title: 'Manage my class',
        body: 'As a class teacher, manage class info, messaging, and other operations here.',
        targetTourId: 'teacher-nav:manage-my-class',
        route: '/teacher/manage-class',
      })
    }
    return base
  }, [isClassTeacher])

  useEffect(() => {
    const key = getTourStorageKey(userId)
    const isDone = safeJsonParse(localStorage.getItem(key) || 'false', false)
    setCompleted(Boolean(isDone))
  }, [userId])

  useEffect(() => {
    if (completed) { setOpen(false); return }
    if (!userId) return

    // Only show on teacher routes and only once per user.
    if (!String(pathname || '').startsWith('/teacher')) return

    // Delay open slightly to allow layout to mount and nav items to exist.
    const id = setTimeout(() => setOpen(true), 350)
    return () => clearTimeout(id)
  }, [completed, userId, pathname])

  const persistCompleted = async () => {
    const key = getTourStorageKey(userId)
    try { localStorage.setItem(key, 'true') } catch {}
    setCompleted(true)
    setOpen(false)

    // Best-effort server persistence (if endpoint exists).
    try {
      await api.post('/auth/onboarding/complete/', { scope: 'teacher_dashboard' })
    } catch {
      // ignore
    }
  }

  const current = steps[stepIndex] || null

  const findTarget = (tourId) => {
    if (!tourId) return null
    try {
      const selector = `[data-tour-id="${tourId}"]`
      return document.querySelector(selector)
    } catch {
      return null
    }
  }

  const clearHighlights = () => {
    try {
      document.querySelectorAll('[data-tour-highlight="1"]').forEach(el => {
        el.removeAttribute('data-tour-highlight')
        el.style.outline = ''
        el.style.outlineOffset = ''
        el.style.borderRadius = ''
      })
    } catch {}
  }

  const highlight = (el) => {
    if (!el) return
    try {
      el.setAttribute('data-tour-highlight', '1')
      el.style.outline = '3px solid rgba(59,130,246,0.95)'
      el.style.outlineOffset = '4px'
      el.style.borderRadius = '12px'
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    } catch {}
  }

  useEffect(() => {
    if (!open) { clearHighlights(); return }
    if (!current) return

    const tourId = current.targetTourId
    const el = findTarget(tourId)
    clearHighlights()
    highlight(el)

    return () => {
      clearHighlights()
    }
  }, [open, current?.targetTourId])

  useEffect(() => {
    if (!open) return
    if (!current?.route) return

    const loc = String(pathname || '')
    const intended = String(current.route || '')

    if (loc !== intended && lastLocationRef.current !== intended) {
      lastLocationRef.current = intended
      navigate(intended)
    }
  }, [open, current?.route, pathname, navigate])

  const go = (nextIndex) => {
    const idx = Math.max(0, Math.min(steps.length - 1, nextIndex))
    setStepIndex(idx)
  }

  if (completed || !open || !current) return null

  const root = typeof document !== 'undefined' ? document.body : null
  if (!root) return null

  const progressLabel = `${stepIndex + 1} / ${steps.length}`

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 6000 }}>
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />

      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-gray-500">Setup Guide</div>
              <div className="font-semibold text-gray-900 truncate">{current.title}</div>
            </div>
            <div className="text-xs text-gray-500 whitespace-nowrap">{progressLabel}</div>
          </div>

          <div className="px-4 py-3 text-sm text-gray-700">
            {current.body}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg text-sm border bg-white text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(stepIndex - 1)}
                disabled={stepIndex === 0}
                className="px-3 py-1.5 rounded-lg text-sm border bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              {stepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => go(stepIndex + 1)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={persistCompleted}
                  className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Finish
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    root
  )
}
