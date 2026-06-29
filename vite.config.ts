import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      manifest: {
        name: "Chronos — Time, Designed.",
        short_name: "Chronos",
        description: "The executive operating system for time. AI-assisted routines, focus blocks, and calendar architecture.",
        theme_color: "#0d0d0d",
        background_color: "#0d0d0d",
        display: "standalone",
        icons: [
          // PNGs are required for installability (Android "Add to home screen",
          // desktop Chrome/Edge "Install app"). SVG kept as a scalable extra.
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/pwa-512x512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,png,ico,json}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,png,ico,json}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-three": ["three", "@react-three/fiber", "@react-three/drei"],
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-popover", "@radix-ui/react-tooltip"],
          "vendor-recharts": ["recharts"],
        },
      },
    },
  },
}));
