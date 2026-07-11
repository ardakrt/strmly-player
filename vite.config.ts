import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  base: './',
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('hls.js')) {
              return 'vendor-hls';
            }
            return 'vendor-others';
          }
        }
      }
    }
  },
  server: {
    allowedHosts: true,
    watch: {
      ignored: [
        '**/profiles/**',
        '**/profiles-dev/**',
      ]
    }
  }
})
