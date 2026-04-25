import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react(), tailwindcss()],
    // In dev, /api/* is proxied through Vite. Defaults to the live site so the
    // Gallery tab works without running the website locally; override with
    // WEB_API_URL=http://localhost:3000 when iterating on website code.
    server: {
      proxy: {
        '/api': {
          target: process.env.WEB_API_URL || 'https://living-art-screensaver.com',
          changeOrigin: true,
        },
      },
    },
  },
})
