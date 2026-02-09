async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)) }

export async function uploadToCloudinary(file, opts = {}){
  const cloud = (import.meta.env.VITE_CLOUDINARY_CLOUD || '').trim()
  const preset = (import.meta.env.VITE_CLOUDINARY_PRESET || '').trim()
  if (!cloud || !preset) throw new Error('Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD and VITE_CLOUDINARY_PRESET, then restart Vite.')
  const folder = (opts.folder || '').trim()
  const resourceType = (opts.resourceType || 'auto').trim() // default 'auto' to support any file type
  const endpoint = `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', preset)
  if (folder) fd.append('folder', folder)
  if (opts.context && typeof opts.context === 'object'){
    const ctx = Object.entries(opts.context).map(([k,v])=>`${k}=${v}`).join('|')
    if (ctx) fd.append('context', ctx)
  }
  let lastErr = null
  const attempts = Number(opts.attempts || 3)
  for (let i=0;i<attempts;i++){
    // First try XHR (HTTP/1.1) to avoid some HTTP/2 issues
    try{
      const result = await new Promise((resolve, reject)=>{
        try{
          const xhr = new XMLHttpRequest()
          xhr.open('POST', endpoint)
          xhr.responseType = 'json'
          xhr.timeout = 30000
          xhr.onload = () => {
            try{
              const resp = xhr.response || JSON.parse(xhr.responseText || '{}')
              if (xhr.status >= 200 && xhr.status < 300){
                const url = resp.secure_url || resp.url
                if (!url) return reject(new Error('Cloudinary response missing secure_url'))
                resolve({ url, public_id: resp.public_id, width: resp.width, height: resp.height, bytes: resp.bytes, format: resp.format })
              } else {
                const msg = resp?.error?.message || `Cloudinary upload failed (${xhr.status})`
                reject(new Error(msg))
              }
            }catch(e){ reject(e) }
          }
          xhr.ontimeout = () => reject(new Error('Network timeout'))
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.send(fd)
        }catch(e){ reject(e) }
      })
      return result
    }catch(xhrErr){
      lastErr = xhrErr
      // Fallback to fetch
      try{
        const res = await fetch(endpoint, { method: 'POST', body: fd, mode: 'cors', cache: 'no-store' })
        if (!res.ok){
          let msg = `Cloudinary upload failed (${res.status})`
          try{ const j = await res.json(); msg = j?.error?.message || msg }catch{}
          throw new Error(msg)
        }
        const json = await res.json()
        const url = json.secure_url || json.url
        if (!url) throw new Error('Cloudinary response missing secure_url')
        return { url, public_id: json.public_id, width: json.width, height: json.height, bytes: json.bytes, format: json.format }
      }catch(fetchErr){
        lastErr = fetchErr
        if (i < attempts-1){
          const backoff = 300 * Math.pow(2, i)
          await sleep(backoff)
          continue
        }
      }
    }
  }
  throw lastErr || new Error('Cloudinary upload failed')
}
