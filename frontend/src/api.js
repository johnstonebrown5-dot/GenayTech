import axios from 'axios'

// Prefer relative base by default so requests go through Vite proxy (and ngrok single URL)
// You can still override with VITE_API_BASE_URL if needed.
export const backendBase = (import.meta.env.VITE_API_BASE_URL ?? '')
const api = axios.create({
  baseURL: backendBase.replace(/\/$/, '') + '/api',
  // Increased timeout to 60 seconds to handle slow database queries on PythonAnywhere
  timeout: 60000,
})

// Add retry logic for failed requests
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function requestWithRetry(config, retryCount = 0) {
  try {
    return await axios(config)
  } catch (error) {
    const isRetryable = (
      error.code === 'ECONNABORTED' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'EPIPE' ||
      (error.response && error.response.status >= 500) ||
      !error.response
    )
    
    if (isRetryable && retryCount < MAX_RETRIES) {
      console.warn(`Retrying request (${retryCount + 1}/${MAX_RETRIES}):`, config.url)
      await sleep(RETRY_DELAY * (retryCount + 1)) // Exponential backoff
      return requestWithRetry(config, retryCount + 1)
    }
    
    throw error
  }
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  try {
    if (typeof window !== 'undefined') {
      const h = String(window.location?.host || '').trim()
      if (h) {
        config.headers = config.headers || {}
        if (!config.headers['X-Forwarded-Host']) config.headers['X-Forwarded-Host'] = h
      }
    }
  } catch {}
  try { if (!config._skipGlobalLoading && typeof window !== 'undefined') window.dispatchEvent(new Event('api:request:start')) } catch {}
  
  // Add request cancellation support
  const requestId = generateRequestId(config)
  if (pendingRequests.has(requestId)) {
    const controller = pendingRequests.get(requestId)
    controller.abort()
  }
  const controller = new AbortController()
  config.signal = controller.signal
  pendingRequests.set(requestId, controller)
  
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

// Add request cancellation to prevent memory leaks
const pendingRequests = new Map()

function generateRequestId(config) {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}:${JSON.stringify(config.data || {})}`
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
  res => { 
    // Clean up pending request
    try {
      const requestId = generateRequestId(res.config)
      pendingRequests.delete(requestId)
    } catch {}
    try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('api:request:end')) } catch {}; 
    return res 
  },
  async err => {
    // Clean up pending request
    try {
      const requestId = generateRequestId(err.config)
      pendingRequests.delete(requestId)
    } catch {}

    // Normalize axios timeout error into a stable, user-friendly message.
    // Many pages surface err.message directly.
    try{
      const msg = String(err?.message || '')
      const isTimeout = err?.code === 'ECONNABORTED' || /timeout\s+of\s+\d+ms\s+exceeded/i.test(msg)
      const isNetworkError = err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.code === 'ETIMEDOUT'
      
      if (isTimeout) {
        err.message = 'Request timed out. Please check your internet connection and try again.'
      } else if (isNetworkError) {
        err.message = 'Network error. Please check your connection and try again.'
      }
    }catch{}
    const original = err?.config
    const status = err?.response?.status
    const isAuthEndpoint = original?.url?.includes('/auth/token') || original?.url?.includes('/auth/me') || original?.url?.includes('/auth/token/refresh')
    
    // Retry on network errors and 5xx errors
    if (!isAuthEndpoint && original && !original._retry) {
      const isRetryable = (
        err?.code === 'ECONNABORTED' ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'EPIPE' ||
        (status && status >= 500) ||
        !status
      )
      
      if (isRetryable) {
        original._retry = true
        try {
          console.warn(`Retrying request due to network error:`, original.url)
          await sleep(1000)
          return api(original)
        } catch (retryErr) {
          console.error('Retry failed:', retryErr)
        }
      }
    }
    
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
          refreshPromise = axios.post(backendBase.replace(/\/$/, '') + '/api/auth/token/refresh/', { refresh }, { timeout: 10000 })
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
