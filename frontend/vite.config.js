import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const CORE_SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-192x192.png',
  '/pwa-maskable-512x512.png',
  '/icons.svg',
]

// Optional heavy export-only chunks stay out of eager install precache and are cached on demand.
const DEFERRED_CHUNK_PREFIXES = ['jspdf', 'html2canvas', 'index.es-']

function tradeCommitPwaPlugin() {
  return {
    name: 'tradecommit-pwa',
    apply: 'build',
    writeBundle(outputOptions) {
      const outDir = outputOptions?.dir ? path.resolve(outputOptions.dir) : path.resolve('dist')
      const swPath = path.join(outDir, 'sw.js')
      if (!fs.existsSync(swPath)) return

      const assetsDir = path.join(outDir, 'assets')
      const assetFiles = fs.existsSync(assetsDir)
        ? fs.readdirSync(assetsDir).sort()
        : []

      const precacheAssets = assetFiles
        .filter((file) => /\.(?:js|css|svg|png|woff2?)$/i.test(file))
        .filter((file) => !DEFERRED_CHUNK_PREFIXES.some((prefix) => file.startsWith(prefix)))
        .map((file) => `/assets/${file}`)

      const precacheList = [...CORE_SHELL_URLS, ...precacheAssets]

      const hash = crypto.createHash('sha256')
      for (const relUrl of precacheList) {
        const cleanRel = relUrl === '/' ? 'index.html' : relUrl.replace(/^\//, '')
        const fullPath = path.join(outDir, cleanRel)
        hash.update(relUrl)
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          hash.update(fs.readFileSync(fullPath))
        }
      }
      const version = hash.digest('hex').slice(0, 12)

      const swSource = fs.readFileSync(swPath, 'utf8')
      const updatedSw = swSource
        .replace("'__SW_CACHE_VERSION__'", JSON.stringify(version))
        .replace(
          /const PRECACHE_URLS = \[[\s\S]*?\]/,
          `const PRECACHE_URLS = ${JSON.stringify(precacheList, null, 2)}`
        )

      fs.writeFileSync(swPath, updatedSw, 'utf8')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    tradeCommitPwaPlugin(),
  ],
})
