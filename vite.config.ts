import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const frontendApiPath = '/api/v1';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_');
  const apiProxyTarget = env.API_PROXY_TARGET?.trim() || 'https://torysv.kro.kr/fixmyhome';
  const apiProxyPath = (env.API_PROXY_PATH?.trim() || frontendApiPath).replace(/\/+$/, '');

  return {
    plugins: [react()],
    build: {
      minify: 'esbuild',
      sourcemap: false
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        [frontendApiPath]: {
          target: apiProxyTarget,
          rewrite: (path) => apiProxyPath + path.slice(frontendApiPath.length),
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: '',
          cookiePathRewrite: '/',
          configure(proxy) {
            // The proxy event is supported at runtime; this annotation avoids
            // the incompatible Vite proxy type that caused the original TS2339.
            type RequestProxy = { on?: (name: string, callback: (request: {removeHeader(name: string): void}) => void) => void };
            (proxy as unknown as RequestProxy).on?.('proxyReq', (request) => {
              request.removeHeader('origin');
              request.removeHeader('referer');
            });
          }
        }
      }
    }
  };
});
