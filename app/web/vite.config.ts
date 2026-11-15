/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API calls go through this proxy, mirroring nginx.conf in production:
// /api/onboard/* -> onboard service, /api/earth/* -> Earth service.
const ONBOARD_URL = process.env.ONBOARD_URL ?? 'http://localhost:8001'
const EARTH_URL = process.env.EARTH_URL ?? 'http://localhost:8002'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: {
      '/api/onboard': { target: ONBOARD_URL, rewrite: (p) => p.replace(/^\/api\/onboard/, '') },
      '/api/earth': { target: EARTH_URL, rewrite: (p) => p.replace(/^\/api\/earth/, '') },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    unstubGlobals: true,
  },
})
