import React, { useState } from 'react'

/**
 * ProgressiveImage
 * - Chooses an initial quality based on Network Information API and Save-Data.
 * - Renders the chosen source immediately, then preloads higher quality and crossfades to it.
 * - Never shows an empty fallback once the first image loads.
 * Props:
 *   - src: string (high quality default)
 *   - candidates: { low?: string, medium?: string, high?: string }
 *   - alt, className, style, blur
 */
export default function ProgressiveImage({
  src,
  candidates = {},
  alt = '',
  className = '',
  style = {},
  blur = 16,
}){
  const hi = src || candidates.high || ''
  const md = candidates.medium || hi
  const lo = candidates.low || md

  function pickInitial(){
    try{
      const c = navigator.connection || navigator.webkitConnection || navigator.mozConnection
      const save = navigator.connection?.saveData || false
      const eff = c?.effectiveType || '' // 'slow-2g','2g','3g','4g'
      if (save) return lo
      if (eff === 'slow-2g' || eff === '2g') return lo
      if (eff === '3g') return md
      return hi
    }catch{ return hi }
  }

  const [current, setCurrent] = useState(pickInitial())
  const [baseLoaded, setBaseLoaded] = useState(false)
  const [upgradeSrc, setUpgradeSrc] = useState('')
  const [upgradeLoaded, setUpgradeLoaded] = useState(false)

  // Determine upgrade target
  React.useEffect(() => {
    const target = current === lo ? md : (current === md ? hi : '')
    setUpgradeSrc(target)
  }, [current, lo, md, hi])

  // Preload upgrade and then crossfade
  React.useEffect(() => {
    if (!baseLoaded || !upgradeSrc || upgradeSrc === current) return
    let alive = true
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => { if (alive) setUpgradeLoaded(true) }
    img.onerror = () => { /* ignore upgrade errors */ }
    img.src = upgradeSrc
    return () => { alive = false }
  }, [baseLoaded, upgradeSrc, current])

  // When upgrade is ready, swap current after a tiny delay to allow CSS transition
  React.useEffect(() => {
    if (upgradeLoaded && upgradeSrc) {
      const t = setTimeout(() => setCurrent(upgradeSrc), 0)
      return () => clearTimeout(t)
    }
  }, [upgradeLoaded, upgradeSrc])

  return (
    <span className={`relative inline-block ${className}`} style={{ display: 'inline-block', ...style }}>
      {/* Base image (network-appropriate) */}
      <img
        src={current}
        alt={alt}
        style={{
          filter: baseLoaded ? 'none' : `blur(${blur}px)` ,
          transition: 'filter 300ms ease-out',
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        onLoad={() => setBaseLoaded(true)}
        onError={() => setBaseLoaded(true)}
      />

      {/* Crossfade overlay when upgrading to higher quality */}
      {upgradeSrc && upgradeSrc !== current && (
        <img
          src={upgradeSrc}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: upgradeLoaded ? 1 : 0,
            transition: 'opacity 400ms ease-out',
          }}
          onLoad={() => setUpgradeLoaded(true)}
          onError={() => {/* ignore */}}
        />
      )}
    </span>
  )
}
