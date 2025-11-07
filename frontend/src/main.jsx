import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Global PWA install wiring: capture the beforeinstallprompt event and expose a helper
if (typeof window !== 'undefined') {
  window.__pwaInstallEvent = window.__pwaInstallEvent || null
  window.addEventListener('beforeinstallprompt', (e) => {
    try { e.preventDefault() } catch {}
    window.__pwaInstallEvent = e
    try { window.dispatchEvent(new CustomEvent('pwa:ready')) } catch {}
  })
  window.addEventListener('appinstalled', () => {
    window.__pwaInstallEvent = null
    try { window.dispatchEvent(new CustomEvent('pwa:installed')) } catch {}
  })
  window.requestPWAInstall = async () => {
    const ev = window.__pwaInstallEvent
    if (!ev) throw new Error('install-not-available')
    await ev.prompt()
    const choice = await ev.userChoice
    window.__pwaInstallEvent = null
    return choice
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// Register a simple service worker for notifications
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      }
    }).catch(() => {
      // Try register anyway
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  })
}
