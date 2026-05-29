import sharp from 'sharp'
import { readdir, stat, rename } from 'fs/promises'
import { join, extname, basename } from 'path'

const DIR = 'public/images'
const QUALITY = 80

const files = await readdir(DIR)

for (const file of files) {
  const ext = extname(file).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue

  const src = join(DIR, file)
  const tmp = join(DIR, `__tmp_${file}`)
  const before = (await stat(src)).size

  const img = sharp(src)

  if (ext === '.jpg' || ext === '.jpeg') {
    await img.jpeg({ quality: QUALITY, mozjpeg: true }).toFile(tmp)
  } else if (ext === '.png') {
    await img.png({ quality: QUALITY, compressionLevel: 9 }).toFile(tmp)
  } else {
    await img.webp({ quality: QUALITY }).toFile(tmp)
  }

  const after = (await stat(tmp)).size

  if (after < before) {
    await rename(tmp, src)
    console.log(`${file}: ${kb(before)} → ${kb(after)} KB (saved ${kb(before - after)} KB)`)
  } else {
    await rename(tmp, src)
    console.log(`${file}: already optimal, kept as-is`)
  }
}

function kb(bytes) { return Math.round(bytes / 1024) }
