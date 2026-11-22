import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: {
      '/api/v1': {
        target: 'https://torysv.kro.kr/fixmyhome',
        changeOrigin: true, secure: true, cookieDomainRewrite: '', cookiePathRewrite: '/',
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
});
