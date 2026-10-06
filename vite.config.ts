import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Set VITE_BASE_PATH when deploying under a repository subpath, such as
// /EarthEyes_NASASpaceApps/ on GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
})
