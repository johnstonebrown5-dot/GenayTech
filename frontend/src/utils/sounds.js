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
    const o = ctx.createOscillator()
    const g = ctx.createGain()

    let freq = 880
    let dur = 0.20
    let typeName = 'sine'
    let peak = 0.10
    if (type === 'login') { freq = 980; dur = 0.26; typeName = 'triangle'; peak = 0.14 }
    else if (type === 'logout') { freq = 420; dur = 0.24; typeName = 'sawtooth'; peak = 0.12 }
    else if (type === 'lock') { freq = 660; dur = 0.28; typeName = 'square'; peak = 0.12 }
    else if (type === 'notify') { freq = 1250; dur = 0.16; typeName = 'triangle'; peak = 0.12 }

    o.type = typeName
    o.frequency.setValueAtTime(freq, now)

    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(peak, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    o.connect(g)
    g.connect(ctx.destination)

    o.start(now)
    o.stop(now + dur)
  } catch {}
}
