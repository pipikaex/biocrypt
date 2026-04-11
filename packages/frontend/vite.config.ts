import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@zcoin/core": path.resolve(__dirname, "../core/src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/gossip": { target: "http://localhost:3000", ws: true },
    },
  },
  worker: { format: "es" },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
