import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    // Allow Cloudflare Tunnel quick-tunnel hostnames + ngrok, otherwise Vite
    // rejects tunneled requests with a "Blocked request" page.
    allowedHosts: [
      ".trycloudflare.com",
      ".ngrok-free.app",
      ".ngrok.io",
    ],
  },
});