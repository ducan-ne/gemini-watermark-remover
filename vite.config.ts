import fs from "node:fs/promises"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import cssInject from "vite-plugin-css-injected-by-js"

// The build is a React component that bannerify.co loads from /gemini-watermark-remover/index.js
// (a proxy to this Worker). The page gives it React, so the build leaves React out.
export default defineConfig({
  base: "/gemini-watermark-remover/",
  plugins: [
    react(),
    tailwindcss(),
    cssInject(),
    {
      name: "index.js",
      apply: "build",
      async writeBundle() {
        const manifest = JSON.parse(await fs.readFile("dist/.vite/manifest.json", "utf-8"))
        await fs.writeFile("dist/index.js", `export { default } from "./${manifest["src/App.tsx"].file}"\n`)
      },
    },
  ],
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
    manifest: true,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      input: resolve(import.meta.dirname, "src/App.tsx"),
      preserveEntrySignatures: "exports-only",
      output: {
        entryFileNames: "index.[hash].js",
        format: "esm",
      },
    },
  },
})
