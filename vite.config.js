import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/sigma-calendar-heatmap-plugin/',
  server: {
    port: 3002,
    host: true,
    cors: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
