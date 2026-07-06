import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative assets work on GitHub Pages and inside a future Capacitor web view.
  base: './',
  plugins: [react()],
})
