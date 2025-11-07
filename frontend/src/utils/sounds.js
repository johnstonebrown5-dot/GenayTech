export function playSound(type) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!window.__appAudioCtx) {
      window.__appAudioCtx = new AC()
    }
    const ctx = window.__appAudioCtx
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()

    let freq = 880
    let dur = 0.18
    let typeName = 'sine'
    if (type === 'login') { freq = 990; dur = 0.22; typeName = 'triangle' }
    else if (type === 'logout') { freq = 440; dur = 0.22; typeName = 'sawtooth' }
    else if (type === 'lock') { freq = 660; dur = 0.25; typeName = 'square' }
    else if (type === 'notify') { freq = 1200; dur = 0.12; typeName = 'triangle' }

    o.type = typeName
    o.frequency.setValueAtTime(freq, now)

    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    o.connect(g)
    g.connect(ctx.destination)

    o.start(now)
    o.stop(now + dur)
  } catch {}
}
