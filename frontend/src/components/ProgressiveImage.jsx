import React, { useState } from 'react'

export default function ProgressiveImage({ src, alt = '', className = '', style = {}, blur = 16 }){
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      src={src}
      alt={alt}
      style={{
        ...style,
        filter: loaded ? 'none' : `blur(${blur}px)` ,
        transition: 'filter 300ms ease-out',
      }}
      className={className}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
    />
  )
}
