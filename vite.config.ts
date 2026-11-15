import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { catalogueApi } from './backend/api/vite.ts'

// Set VITE_BASE_PATH when deploying under a subpath instead of the domain root.
export default defineConfig(({ mode }) => {
  // Local server-side secrets may come from unprefixed vars or the VITE_ ones used by earlier builds.
  const env = loadEnv(mode, process.cwd(), '')
  const serverEnv = {
    GROQ_API_KEY: process.env.GROQ_API_KEY ?? env.GROQ_API_KEY ?? process.env.VITE_GROQ_API_KEY ?? env.VITE_GROQ_API_KEY,
    ARGUS_MODEL: process.env.ARGUS_MODEL ?? env.ARGUS_MODEL ?? process.env.VITE_GROQ_MODEL ?? env.VITE_GROQ_MODEL,
    ARGUS_VISION_MODEL: process.env.ARGUS_VISION_MODEL ?? env.ARGUS_VISION_MODEL ?? process.env.VITE_GROQ_VISION_MODEL ?? env.VITE_GROQ_VISION_MODEL,
  }
  return {
    base: process.env.VITE_BASE_PATH || '/',
    // Prebundling relocates MapLibre's relative worker URL into a missing .vite file.
    optimizeDeps: { exclude: ['maplibre-gl'] },
    plugins: [catalogueApi(serverEnv), react(), tailwindcss()],
  }
})
