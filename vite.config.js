import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/apps/solar-smart/",
  plugins: [react()],
  build: {
    // Emit files into the same folder structure you serve from
    outDir: "dist/apps/solar-smart",
    assetsDir: "assets",
    manifest: true,
    rollupOptions: {
      // Keep asset names deterministic to avoid stale hashed paths being cached
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: {
    port: 5173,
    // optional but handy for tunnels:
    host: true,
    allowedHosts: [
      "689d4e0b981a.ngrok-free.app",
      "ai.nds.studio",
      "this.app.test",
    ],
  },
});
