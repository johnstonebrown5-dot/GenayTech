import React, { useState, useMemo } from 'react'

/**
 * AppLogo: resilient logo component with automatic fallback.
 * - Tries to load `/logo.jpg` (or custom src)
 * - If it fails, swaps to an inline SVG data URL so the logo never breaks
 */
export default function AppLogo({
  src = '/logo.jpg',
  alt = 'Genay Technologies Logo',
  className = '',
  size = 32,
  rounded = true,
  loading = 'eager',
}) {
  const [failed, setFailed] = useState(false)

  const fallback = useMemo(() => {
    // Gradient ET monogram as inline SVG (tiny)
    const svg = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
      <stop offset='0%' stop-color='#4f46e5'/>
      <stop offset='100%' stop-color='#8b5cf6'/>
    </linearGradient>
  </defs>
  <rect width='64' height='64' rx='12' fill='url(#g)'/>
  <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle'
        font-family='Inter, Arial, sans-serif' font-size='28' font-weight='800' fill='white'>ET</text>
</svg>`
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  }, [])

  const dim = { width: size, height: size }
  const radius = rounded ? 'rounded' : ''

  return (
    <img
      src={failed ? fallback : src}
      alt={alt}
      {...dim}
      loading={loading}
      decoding='async'
      onError={() => setFailed(true)}
      className={`object-contain ${radius} ${className}`}
    />
  )
}
