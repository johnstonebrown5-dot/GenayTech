import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let ngrokHost = (env.NGROK_HOST || '').trim()
  if (!ngrokHost && env.NGROK_URL) {
    try {
      ngrokHost = new URL(env.NGROK_URL).host
    } catch (_) {
      // ignore invalid URL
    }
  }

  const allowedHosts = ['localhost', '127.0.0.1']
  // Allow local tenant base domains in dev (e.g., sch001.edutrack.local)
  const tenantBase = (env.TENANT_BASE_DOMAIN || env.VITE_TENANT_BASE_DOMAIN || 'edutrack.local').trim().replace(/^\./, '')
  if (tenantBase) {
    const wildcard = tenantBase.startsWith('.') ? tenantBase : `.${tenantBase}`
    if (!allowedHosts.includes(wildcard)) allowedHosts.push(wildcard)
  }
  // Allow any ngrok subdomain in dev for convenience
  allowedHosts.push('.ngrok-free.app')
  if (ngrokHost && !allowedHosts.includes(ngrokHost)) {
    allowedHosts.push(ngrokHost)
  }

  const server = {
    port: 5173,
    host: true,
    allowedHosts,
    proxy: {
      // Forward API requests to Django backend
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        xfwd: true,
        secure: false,
      },
      // Serve media files via the same origin
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        xfwd: true,
        secure: false,
      },
      // Serve static files (if accessed from frontend during dev)
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        xfwd: true,
        secure: false,
      },
    },
  }

  // Ensure HMR works when accessed via the ngrok public hostname
  if (ngrokHost) {
    server.hmr = {
      host: ngrokHost,
      protocol: 'wss',
      clientPort: 443,
    }
  }

  return {
    plugins: [react()],
    server,
  }
})
