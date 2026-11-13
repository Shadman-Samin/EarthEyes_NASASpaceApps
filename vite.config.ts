import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { catalogueApi } from './backend/api/vite.ts'

// Set VITE_BASE_PATH when deploying under a subpath instead of the domain root.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  // Prebundling relocates MapLibre's relative worker URL into a missing .vite file.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  plugins: [catalogueApi(), react(), tailwindcss()],
})
