import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS = join(__dirname, '..', 'public', 'docs')
const IMAGES = join(__dirname, '..', 'public', 'images')
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']

function findImage(basename) {
  for (const ext of IMAGE_EXTS) {
    if (existsSync(join(IMAGES, basename + ext))) return `/images/${basename}${ext}`
  }
  return null
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const data = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    } else {
      data[key] = value.replace(/^["']|["']$/g, '')
    }
  }
  return data
}

function generateIndex(relDir, slugPrefix, exclude = []) {
  const absDir = join(DOCS, relDir)
  if (!existsSync(absDir)) return

  const files = readdirSync(absDir)
    .filter(f => f.endsWith('.md') && !exclude.includes(f))

  const entries = files.map(file => {
    const basename = file.replace(/\.md$/, '')
    const content = readFileSync(join(absDir, file), 'utf8')
    const fm = parseFrontmatter(content)
    return {
      slug: `${slugPrefix}/${basename}`,
      title: fm.title || basename.replace(/-/g, ' '),
      date: fm.date || null,
      description: fm.description || null,
      tags: fm.tags || [],
      org: fm.org || null,
      image: fm.image || findImage(basename),
      highlight: fm.highlight === 'true' || fm.highlight === true,
    }
  })

  entries.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(b.date) - new Date(a.date)
  })

  const outPath = join(absDir, 'index.json')
  writeFileSync(outPath, JSON.stringify(entries, null, 2))
  console.log(`[generate-indexes] ${relDir}/index.json — ${entries.length} entries`)
}

generateIndex('blog', 'blog', ['archive.md'])
generateIndex('projects/work-projects', 'projects/work-projects')
generateIndex('projects/my-projects', 'projects/my-projects')
