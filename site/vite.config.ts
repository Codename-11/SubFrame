import path from "path"
import { readFileSync } from "fs"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Read version from root package.json (single source of truth)
const rootPkg = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
