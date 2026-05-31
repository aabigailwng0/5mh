import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During dev we proxy /api -> the FastAPI backend so the frontend can use
// same-origin relative URLs (no CORS juggling, easy to deploy behind one host).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
