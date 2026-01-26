import axios from 'axios'

// Prefer relative base by default so requests go through Vite proxy (and ngrok single URL)
// You can still override with VITE_API_BASE_URL if needed.
export const backendBase = (import.meta.env.VITE_API_BASE_URL ?? '')
const api = axios.create({
  baseURL: backendBase.replace(/\/$/, '') + '/api',
  // Prevent the UI from hanging indefinitely on slow or unreachable networks
  timeout: 10000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  try { if (!config._skipGlobalLoading && typeof window !== 'undefined') window.dispatchEvent(new Event('api:request:start')) } catch {}
  return config
})

// Simple refresh token flow on 401
let isRefreshing = false
let refreshPromise = null
const subscribers = []
function subscribeTokenRefresh(cb){ subscribers.push(cb) }

// Guarded redirect to login to avoid reload loops when already on the login page
let lastRedirectTs = 0
function redirectToLoginIfNeeded(){
  try{
    if (typeof window === 'undefined') return
    const now = Date.now()
    if (now - lastRedirectTs < 800) return // debounce rapid redirects
    const p = String(window.location?.pathname || '')
    // If we are already on login or a public landing route, do not redirect again
    if (p === '/login' || p === '/' || p.startsWith('/login')) return
    lastRedirectTs = now
    window.location.href = '/login'
  }catch{}
}

// Build low/medium/high image candidates by appending resize/quality query params.
// If the backend/CDN doesn't support them, it will still return the original;
// URLs remain distinct for caching and progressive upgrade.
export function imageCandidates(url){
  const abs = toAbsoluteUrl(url)
  if (!abs) return { high: '', medium: '', low: '' }
  const u = new URL(abs, window.location.origin)
  function withParams(w, q){
    const x = new URL(u.toString())
    // Preserve existing params and add hints (commonly used by CDNs)
    x.searchParams.set('w', String(w))
    x.searchParams.set('q', String(q))
    return x.toString()
  }
  return {
    high: withParams(1600, 85),
    medium: withParams(960, 70),
    low: withParams(480, 50),
  }
}
function onRefreshed(newToken){ while(subscribers.length) { const cb = subscribers.shift(); try{ cb(newToken) }catch{} } }

api.interceptors.response.use(
  res => { try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('api:request:end')) } catch {}; return res },
  async err => {
    const original = err?.config
    const status = err?.response?.status
    const isAuthEndpoint = original?.url?.includes('/auth/token') || original?.url?.includes('/auth/me') || original?.url?.includes('/auth/token/refresh')
    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true
      const refresh = localStorage.getItem('refresh')
      if (!refresh) {
        try { localStorage.removeItem('access'); localStorage.removeItem('refresh') } catch {}
        redirectToLoginIfNeeded()
        try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('api:request:error')) } catch {}
        return Promise.reject(err)
      }
      try {
        if (!isRefreshing) {
          isRefreshing = true
          refreshPromise = axios.post(backendBase.replace(/\/$/, '') + '/api/auth/token/refresh/', { refresh })
            .then(r => {
              const newAccess = r?.data?.access
              if (newAccess) { localStorage.setItem('access', newAccess) }
              isRefreshing = false; onRefreshed(newAccess); return newAccess
            })
            .catch(e => { isRefreshing = false; try { localStorage.removeItem('access'); localStorage.removeItem('refresh') } catch {}; redirectToLoginIfNeeded(); throw e })
        }
        const newTok = await refreshPromise
        return new Promise(resolve => {
          subscribeTokenRefresh((token)=>{
            original.headers = original.headers || {}
            if (token) original.headers.Authorization = `Bearer ${token}`
            original._skipGlobalLoading = true
            resolve(api(original))
          })
        })
      } catch (e) {
        try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('api:request:error')) } catch {}
        return Promise.reject(e)
      }
    }
    try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('api:request:error')) } catch {}
    return Promise.reject(err)
  }
)

export default api

// Convert possibly relative URLs (e.g., /media/...) to absolute URLs using backendBase
export function toAbsoluteUrl(url){
  try{
    if (!url) return ''
    // Already absolute (http/https/data)
    if (/^(?:https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
    const base = backendBase.replace(/\/$/, '')
    if (url.startsWith('/')) return base + url
    return base + '/' + url
  }catch{
    return url || ''
  }
}
