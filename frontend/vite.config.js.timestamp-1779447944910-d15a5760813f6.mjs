// vite.config.js
import { defineConfig, loadEnv } from "file:///C:/Users/emili/OneDrive/Desktop/EDU-TRACK/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/emili/OneDrive/Desktop/EDU-TRACK/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let ngrokHost = (env.NGROK_HOST || "").trim();
  if (!ngrokHost && env.NGROK_URL) {
    try {
      ngrokHost = new URL(env.NGROK_URL).host;
    } catch (_) {
    }
  }
  const allowedHosts = ["localhost", "127.0.0.1"];
  const tenantBase = (env.TENANT_BASE_DOMAIN || env.VITE_TENANT_BASE_DOMAIN || "edutrack.local").trim().replace(/^\./, "");
  if (tenantBase) {
    const wildcard = tenantBase.startsWith(".") ? tenantBase : `.${tenantBase}`;
    if (!allowedHosts.includes(wildcard)) allowedHosts.push(wildcard);
  }
  allowedHosts.push(".ngrok-free.app");
  if (ngrokHost && !allowedHosts.includes(ngrokHost)) {
    allowedHosts.push(ngrokHost);
  }
  const server = {
    port: 5173,
    host: true,
    allowedHosts,
    proxy: {
      // Forward API requests to Django backend
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        xfwd: true,
        secure: false
      },
      // Serve media files via the same origin
      "/media": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        xfwd: true,
        secure: false
      },
      // Serve static files (if accessed from frontend during dev)
      "/static": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        xfwd: true,
        secure: false
      }
    }
  };
  if (ngrokHost) {
    server.hmr = {
      host: ngrokHost,
      protocol: "wss",
      clientPort: 443
    };
  }
  return {
    plugins: [react()],
    server
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxlbWlsaVxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXEVEVS1UUkFDS1xcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcZW1pbGlcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxFRFUtVFJBQ0tcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2VtaWxpL09uZURyaXZlL0Rlc2t0b3AvRURVLVRSQUNLL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpXHJcbiAgbGV0IG5ncm9rSG9zdCA9IChlbnYuTkdST0tfSE9TVCB8fCAnJykudHJpbSgpXHJcbiAgaWYgKCFuZ3Jva0hvc3QgJiYgZW52Lk5HUk9LX1VSTCkge1xyXG4gICAgdHJ5IHtcclxuICAgICAgbmdyb2tIb3N0ID0gbmV3IFVSTChlbnYuTkdST0tfVVJMKS5ob3N0XHJcbiAgICB9IGNhdGNoIChfKSB7XHJcbiAgICAgIC8vIGlnbm9yZSBpbnZhbGlkIFVSTFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY29uc3QgYWxsb3dlZEhvc3RzID0gWydsb2NhbGhvc3QnLCAnMTI3LjAuMC4xJ11cclxuICAvLyBBbGxvdyBsb2NhbCB0ZW5hbnQgYmFzZSBkb21haW5zIGluIGRldiAoZS5nLiwgc2NoMDAxLmVkdXRyYWNrLmxvY2FsKVxyXG4gIGNvbnN0IHRlbmFudEJhc2UgPSAoZW52LlRFTkFOVF9CQVNFX0RPTUFJTiB8fCBlbnYuVklURV9URU5BTlRfQkFTRV9ET01BSU4gfHwgJ2VkdXRyYWNrLmxvY2FsJykudHJpbSgpLnJlcGxhY2UoL15cXC4vLCAnJylcclxuICBpZiAodGVuYW50QmFzZSkge1xyXG4gICAgY29uc3Qgd2lsZGNhcmQgPSB0ZW5hbnRCYXNlLnN0YXJ0c1dpdGgoJy4nKSA/IHRlbmFudEJhc2UgOiBgLiR7dGVuYW50QmFzZX1gXHJcbiAgICBpZiAoIWFsbG93ZWRIb3N0cy5pbmNsdWRlcyh3aWxkY2FyZCkpIGFsbG93ZWRIb3N0cy5wdXNoKHdpbGRjYXJkKVxyXG4gIH1cclxuICAvLyBBbGxvdyBhbnkgbmdyb2sgc3ViZG9tYWluIGluIGRldiBmb3IgY29udmVuaWVuY2VcclxuICBhbGxvd2VkSG9zdHMucHVzaCgnLm5ncm9rLWZyZWUuYXBwJylcclxuICBpZiAobmdyb2tIb3N0ICYmICFhbGxvd2VkSG9zdHMuaW5jbHVkZXMobmdyb2tIb3N0KSkge1xyXG4gICAgYWxsb3dlZEhvc3RzLnB1c2gobmdyb2tIb3N0KVxyXG4gIH1cclxuXHJcbiAgY29uc3Qgc2VydmVyID0ge1xyXG4gICAgcG9ydDogNTE3MyxcclxuICAgIGhvc3Q6IHRydWUsXHJcbiAgICBhbGxvd2VkSG9zdHMsXHJcbiAgICBwcm94eToge1xyXG4gICAgICAvLyBGb3J3YXJkIEFQSSByZXF1ZXN0cyB0byBEamFuZ28gYmFja2VuZFxyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjgwMDAnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICB4ZndkOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIFNlcnZlIG1lZGlhIGZpbGVzIHZpYSB0aGUgc2FtZSBvcmlnaW5cclxuICAgICAgJy9tZWRpYSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjgwMDAnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICB4ZndkOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIFNlcnZlIHN0YXRpYyBmaWxlcyAoaWYgYWNjZXNzZWQgZnJvbSBmcm9udGVuZCBkdXJpbmcgZGV2KVxyXG4gICAgICAnL3N0YXRpYyc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjgwMDAnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICB4ZndkOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH1cclxuXHJcbiAgLy8gRW5zdXJlIEhNUiB3b3JrcyB3aGVuIGFjY2Vzc2VkIHZpYSB0aGUgbmdyb2sgcHVibGljIGhvc3RuYW1lXHJcbiAgaWYgKG5ncm9rSG9zdCkge1xyXG4gICAgc2VydmVyLmhtciA9IHtcclxuICAgICAgaG9zdDogbmdyb2tIb3N0LFxyXG4gICAgICBwcm90b2NvbDogJ3dzcycsXHJcbiAgICAgIGNsaWVudFBvcnQ6IDQ0MyxcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgICBzZXJ2ZXIsXHJcbiAgfVxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNWLFNBQVMsY0FBYyxlQUFlO0FBQzVYLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsTUFBSSxhQUFhLElBQUksY0FBYyxJQUFJLEtBQUs7QUFDNUMsTUFBSSxDQUFDLGFBQWEsSUFBSSxXQUFXO0FBQy9CLFFBQUk7QUFDRixrQkFBWSxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7QUFBQSxJQUNyQyxTQUFTLEdBQUc7QUFBQSxJQUVaO0FBQUEsRUFDRjtBQUVBLFFBQU0sZUFBZSxDQUFDLGFBQWEsV0FBVztBQUU5QyxRQUFNLGNBQWMsSUFBSSxzQkFBc0IsSUFBSSwyQkFBMkIsa0JBQWtCLEtBQUssRUFBRSxRQUFRLE9BQU8sRUFBRTtBQUN2SCxNQUFJLFlBQVk7QUFDZCxVQUFNLFdBQVcsV0FBVyxXQUFXLEdBQUcsSUFBSSxhQUFhLElBQUksVUFBVTtBQUN6RSxRQUFJLENBQUMsYUFBYSxTQUFTLFFBQVEsRUFBRyxjQUFhLEtBQUssUUFBUTtBQUFBLEVBQ2xFO0FBRUEsZUFBYSxLQUFLLGlCQUFpQjtBQUNuQyxNQUFJLGFBQWEsQ0FBQyxhQUFhLFNBQVMsU0FBUyxHQUFHO0FBQ2xELGlCQUFhLEtBQUssU0FBUztBQUFBLEVBQzdCO0FBRUEsUUFBTSxTQUFTO0FBQUEsSUFDYixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTjtBQUFBLElBQ0EsT0FBTztBQUFBO0FBQUEsTUFFTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxNQUFNO0FBQUEsUUFDTixRQUFRO0FBQUEsTUFDVjtBQUFBO0FBQUEsTUFFQSxVQUFVO0FBQUEsUUFDUixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxNQUFNO0FBQUEsUUFDTixRQUFRO0FBQUEsTUFDVjtBQUFBO0FBQUEsTUFFQSxXQUFXO0FBQUEsUUFDVCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxNQUFNO0FBQUEsUUFDTixRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBR0EsTUFBSSxXQUFXO0FBQ2IsV0FBTyxNQUFNO0FBQUEsTUFDWCxNQUFNO0FBQUEsTUFDTixVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsSUFDZDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQUEsSUFDTCxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsSUFDakI7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
