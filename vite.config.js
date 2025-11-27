import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // optional but handy for tunnels:
    host: true,
    allowedHosts: ["689d4e0b981a.ngrok-free.app", "ai.nds.studio"],
  },
});
