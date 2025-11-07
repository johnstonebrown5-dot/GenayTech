function ensureCtx() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!window.__appAudioCtx) {
    window.__appAudioCtx = new AC()
  }
  return window.__appAudioCtx
}

export function unlockAudioOnUserGesture() {
  try {
    const ctx = ensureCtx()
    if (!ctx) return
    if (ctx.state === 'running') return
    const handler = async () => {
      try { await ctx.resume() } catch {}
      // play an inaudible blip to fully unlock on some browsers
      try {
        const now = ctx.currentTime
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.00001, now)
        o.connect(g); g.connect(ctx.destination)
        o.start(now); o.stop(now + 0.01)
      } catch {}
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
      window.removeEventListener('touchstart', handler)
    }
    window.addEventListener('pointerdown', handler, { once: true, passive: true })
    window.addEventListener('keydown', handler, { once: true })
    window.addEventListener('touchstart', handler, { once: true, passive: true })
  } catch {}
}

export function playSound(type) {
  try {
    const ctx = ensureCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      // Resume may fail until a user gesture happens; unlock helper in main will handle it.
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime

    function beep({ freq=880, dur=0.2, type='sine', peak=0.15, when=now }){
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, when)
      g.gain.setValueAtTime(0.0001, when)
      g.gain.exponentialRampToValueAtTime(peak, when + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
      o.connect(g); g.connect(ctx.destination)
      o.start(when); o.stop(when + dur)
    }

    switch (type) {
      case 'success': {
        // Rising two-tone: pleasant confirmation
        beep({ freq: 740, dur: 0.14, type: 'triangle', peak: 0.24, when: now })
        beep({ freq: 1040, dur: 0.16, type: 'triangle', peak: 0.24, when: now + 0.12 })
        break
      }
      case 'error':
      case 'fail': {
        // Falling two-tone: clear negative
        beep({ freq: 700, dur: 0.16, type: 'sawtooth', peak: 0.26, when: now })
        beep({ freq: 480, dur: 0.18, type: 'sawtooth', peak: 0.22, when: now + 0.12 })
        break
      }
      case 'alert':
      case 'warning': {
        // Short triad ping
        beep({ freq: 880, dur: 0.12, type: 'square', peak: 0.22, when: now })
        beep({ freq: 1175, dur: 0.12, type: 'square', peak: 0.20, when: now + 0.08 })
        beep({ freq: 1480, dur: 0.12, type: 'square', peak: 0.18, when: now + 0.16 })
        break
      }
      case 'info':
      case 'notify': {
        // Single concise ping
        beep({ freq: 1250, dur: 0.16, type: 'triangle', peak: 0.18, when: now })
        break
      }
      case 'login': {
        beep({ freq: 980, dur: 0.22, type: 'triangle', peak: 0.22, when: now })
        beep({ freq: 1310, dur: 0.18, type: 'triangle', peak: 0.20, when: now + 0.12 })
        break
      }
      case 'logout': {
        beep({ freq: 520, dur: 0.22, type: 'sawtooth', peak: 0.22, when: now })
        break
      }
      case 'lock': {
        beep({ freq: 660, dur: 0.24, type: 'square', peak: 0.22, when: now })
        break
      }
      default: {
        beep({ freq: 900, dur: 0.16, type: 'sine', peak: 0.16, when: now })
      }
    }
  } catch {}
}
