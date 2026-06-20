import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function generateIndexesPlugin() {
  const script = join(__dirname, 'scripts', 'generate-indexes.js')
  const run = () => {
    try {
      execFileSync('node', [script], { stdio: 'inherit' })
    } catch (e) {
      console.error('[generate-indexes] failed:', e.message)
    }
  }

  return {
    name: 'generate-indexes',
    buildStart: run,
    configureServer(server) {
      const relevant = (f) => f.endsWith('.md') || /public[\\/]images[\\/]/.test(f)
      server.watcher.add('public/docs/**/*.md')
      server.watcher.add('public/images/**')
      server.watcher.on('add',    (f) => { if (relevant(f)) run() })
      server.watcher.on('unlink', (f) => { if (relevant(f)) run() })
      server.watcher.on('change', (f) => { if (relevant(f)) run() })
    },
  }
}

export default defineConfig({
  plugins: [react(), generateIndexesPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'https://joaojorge.site',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (['react', 'react-dom', 'react-router-dom'].some(p => id.includes(`/node_modules/${p}/`))) return 'vendor'
          if (['react-markdown', 'remark-gfm', 'remark-frontmatter', 'rehype-raw'].some(p => id.includes(`/node_modules/${p}/`))) return 'markdown'
        },
      },
    },
  },
})
