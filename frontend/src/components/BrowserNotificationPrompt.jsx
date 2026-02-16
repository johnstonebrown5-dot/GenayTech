import React, { useEffect, useMemo, useState } from 'react'
import { useWebPush } from '../utils/webPush'

const STORAGE_KEYS = {
  dismissed: 'notif_prompt_dismissed',
  snoozeUntil: 'notif_prompt_snooze_until',
}

function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function canShowPrompt() {
  if (!isSupported()) return false
  if (Notification.permission !== 'default') return false
  const dismissed = localStorage.getItem(STORAGE_KEYS.dismissed) === '1'
  if (dismissed) return false
  const snooze = parseInt(localStorage.getItem(STORAGE_KEYS.snoozeUntil) || '0', 10)
  if (snooze && Date.now() < snooze) return false
  return true
}

export default function BrowserNotificationPrompt() {
  const [visible, setVisible] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const { subscribeToPush } = useWebPush()

  useEffect(() => {
    setVisible(canShowPrompt())
  }, [])

  const requestPermission = async () => {
    if (!isSupported()) return
    try {
      setRequesting(true)
      const result = await Notification.requestPermission()
      if (result === 'granted') {
        // Register SW and subscribe to push
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready
            
            // Perform Web Push subscription
            await subscribeToPush()

            if (reg?.showNotification) {
              reg.showNotification('Notifications enabled', {
                body: 'You will receive alerts even when this tab is inactive.',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
              })
            }
          } catch (e) {
            console.error('Error during push setup:', e)
          }
        }
        localStorage.setItem(STORAGE_KEYS.dismissed, '1')
        setVisible(false)
      } else if (result === 'denied') {
        localStorage.setItem(STORAGE_KEYS.dismissed, '1')
        setVisible(false)
      } else {
        // default -> keep prompt hidden for a day
        const oneDay = 24 * 60 * 60 * 1000
        localStorage.setItem(STORAGE_KEYS.snoozeUntil, String(Date.now() + oneDay))
        setVisible(false)
      }
    } finally {
      setRequesting(false)
    }
  }

  const onSnooze = () => {
    const fourHours = 4 * 60 * 60 * 1000
    localStorage.setItem(STORAGE_KEYS.snoozeUntil, String(Date.now() + fourHours))
    setVisible(false)
  }

  const onDismiss = () => {
    localStorage.setItem(STORAGE_KEYS.dismissed, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-[22rem] shadow-lg rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 00-7 7v3.586l-1.707 1.707A1 1 0 004 16h16a1 1 0 00.707-1.707L19 12.586V9a7 7 0 00-7-7zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Enable desktop notifications</h3>
          <p className="text-sm text-gray-600 mt-1">Get real-time alerts via Windows/Chrome notifications even when you're on another tab.</p>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={requestPermission} disabled={requesting} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60">
              {requesting ? 'Requesting…' : 'Enable notifications'}
            </button>
            <button onClick={onSnooze} className="px-3 py-1.5 rounded-md border text-sm">Remind me later</button>
            <button onClick={onDismiss} className="px-3 py-1.5 rounded-md text-sm text-gray-500">Don't ask again</button>
          </div>
        </div>
      </div>
    </div>
  )
}
