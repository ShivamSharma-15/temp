import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // optional but handy for tunnels:
    host: true,
    allowedHosts: ['97c3d6f5dbc2.ngrok-free.app'],
  },
})
