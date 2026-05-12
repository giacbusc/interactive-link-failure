import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // When the controller is running on a different host (e.g. one of the
    // Raspberry Pis), set VITE_API_BASE in .env.local instead of using
    // this proxy. The proxy below is for local dev when both run on
    // localhost.
    proxy: {
      "/api": {
        target: "http://192.168.1.10:8080",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
