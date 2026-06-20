import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { LAYERS, genreRgb, TERRAIN_BOUNDS } from './bookGraphConfig.js'
import terrainSrc from '../assets/genre_terrain.png'
import './BookGraphStarMap.css'

function StarMap({ data, corpus, canvasOutRef, onSelect, selectedKey }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null)
  const selectedRef = useRef(selectedKey)
  useEffect(() => { selectedRef.current = selectedKey }, [selectedKey])

  // Derive sorted genre list from the user's read books only.
  const genres = useMemo(() => {
    const seen = new Set()
    for (const p of data.read || []) if (p.genre) seen.add(p.genre)
    return [...seen].sort()
  }, [data])

  // Visibility: genres (missing key = true/on) + fixed overlays.
  // Corpus defaults to true when present; want starts hidden.
  const [visible, setVisible] = useState({ want: false, suggestions: true, corpus: false, corpusDots: false })
  const [overlayHelp, setOverlayHelp] = useState(false)
  const visibleRef = useRef(visible)
  useEffect(() => { visibleRef.current = visible }, [visible])

  // Ensure new genres that appear are added as visible
  useEffect(() => {
    setVisible(v => {
      let changed = false
      const next = { ...v }
      for (const g of genres) if (!(g in next)) { next[g] = true; changed = true }
      return changed ? next : v
    })
  }, [genres])

  const toggleLayer = (k) => setVisible(v => ({ ...v, [k]: !v[k] }))

  const isGenreVisible = (genre) => visible[genre] !== false

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  )

  const points = useMemo(() => {
    const out = []
    const push = (arr, layer, sizer, keyPrefix = layer) =>
      (arr || []).forEach((p, i) => {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return
        out.push({
          ...p, layer,
          size: sizer(p),
          key: `${keyPrefix}-${i}`,
          phase: Math.random() * Math.PI * 2,
        })
      })
    push(data.read, 'read', p => 4 + 1.1 * (p.rating || 4))
    push(data.want, 'want', () => 6)
    push(data.recommendations?.new_authors, 'suggestions', () => 5, 'sug-new')
    push(data.recommendations?.familiar_authors, 'suggestions', () => 5, 'sug-fam')
    push(corpus, 'corpus', p => 4 + 1.1 * (p.rating || 4), 'corpus')

    // Cosmetic jitter: fans stacked same-coord books into individually hoverable clusters
    const userPts = out.filter(p => p.layer !== 'corpus')
    if (userPts.length) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const p of userPts) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
      }
      const jx = Math.max(maxX - minX, 1e-3) * 0.01
      const jy = Math.max(maxY - minY, 1e-3) * 0.01
      for (const p of userPts) {
        p.x += (Math.random() * 2 - 1) * jx
        p.y += (Math.random() * 2 - 1) * jy
      }
    }
    return out
  }, [data, corpus])

  // Separation cues derived once in world space:
  //  • clusters → soft nebula halos behind groups of read books (coloured by dominant genre)
  //  • links    → constellation lines between same-author read books
  //  • orbits   → each suggestion orbits the read book that inspired it
  const structure = useMemo(() => {
    const readPts = points.filter(p => p.layer === 'read')
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
    if (readPts.length < 2) return { clusters: [], links: [], orbits: new Map() }

    const nn = readPts.map(a => {
      let m = Infinity
      for (const b of readPts) if (b !== a) m = Math.min(m, dist(a, b))
      return m
    }).sort((a, b) => a - b)
    const mnn = nn[Math.floor(nn.length / 2)] || 1
    const clusterT = mnn * 3.4
    const norm = s => (s || '').trim().toLowerCase()

    const parent = readPts.map((_, i) => i)
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
    for (let i = 0; i < readPts.length; i++)
      for (let j = i + 1; j < readPts.length; j++)
        if (dist(readPts[i], readPts[j]) <= clusterT) parent[find(i)] = find(j)

    const groups = new Map()
    readPts.forEach((p, i) => {
      const r = find(i)
      if (!groups.has(r)) groups.set(r, [])
      groups.get(r).push(p)
    })

    const clusters = []
    for (const members of groups.values()) {
      if (members.length < 3) continue
      // colour halo by the dominant genre in this cluster
      const counts = {}
      for (const m of members) counts[m.genre || ''] = (counts[m.genre || ''] || 0) + 1
      const topGenre = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
      const wx = members.reduce((s, m) => s + m.x, 0) / members.length
      const wy = members.reduce((s, m) => s + m.y, 0) / members.length
      clusters.push({ members, rgb: genreRgb(topGenre), wx, wy })
    }

    // constellation links: MST per author, capped at maxLinkT
    const byAuthor = new Map()
    readPts.forEach(p => {
      const a = norm(p.author)
      if (!a) return
      if (!byAuthor.has(a)) byAuthor.set(a, [])
      byAuthor.get(a).push(p)
    })
    const maxLinkT = mnn * 4.5
    const links = []
    for (const group of byAuthor.values()) {
      if (group.length < 2) continue
      const edges = []
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++)
          edges.push({ i, j, d: dist(group[i], group[j]) })
      edges.sort((a, b) => a.d - b.d)
      const par = group.map((_, i) => i)
      const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i] } return i }
      let added = 0
      for (const { i, j, d } of edges) {
        if (added === group.length - 1) break
        if (d > maxLinkT) break
        const ri = find(i), rj = find(j)
        if (ri === rj) continue
        par[ri] = rj
        links.push([group[i], group[j]])
        added++
      }
    }

    // orbits: each suggestion circles the read book it was inspired by
    const byTitle = new Map()
    readPts.forEach(p => { const t = norm(p.title); if (t && !byTitle.has(t)) byTitle.set(t, p) })
    const orbits = new Map()
    points.filter(p => p.layer === 'suggestions').forEach((p, i) => {
      const src = byTitle.get(norm(p.because_you_read))
      if (!src) return
      const d = Math.hypot(p.x - src.x, p.y - src.y)
      const r = Math.max(mnn * 0.5, Math.min(d || mnn, mnn * 1.25))
      const dir = i % 2 ? 1 : -1
      orbits.set(p.key, { sx: src.x, sy: src.y, r, phase: p.phase, speed: dir * (0.1 + (i % 3) * 0.02), author: norm(src.author), srcKey: src.key })
    })

    return { clusters, links, orbits }
  }, [points])

  const view = useRef({ z: 1, panX: 0, panY: 0 })
  const baseScale = useRef({ x: 1, y: 1 })
  const dataRange = useRef({ x: 1, y: 1 })
  const center = useRef({ x: 0, y: 0 })
  const dragging = useRef(null)
  const terrainImgRef = useRef(null)
  const corpusBoundsRef = useRef(null)

  useEffect(() => {
    const img = new Image()
    img.src = terrainSrc
    img.onload = () => { terrainImgRef.current = img }
  }, [])

  useEffect(() => {
    if (!corpus?.length) { corpusBoundsRef.current = null; return }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of corpus) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    }
    corpusBoundsRef.current = { minX, maxX, minY, maxY }
  }, [corpus])

  // Pre-render a soft radial halo sprite per colour (fast drawImage blits).
  // Sprites are keyed by genre name for read/corpus, or layer key for overlays.
  const sprites = useMemo(() => {
    const make = (rgb) => {
      const s = 128
      const c = document.createElement('canvas')
      c.width = c.height = s
      const g = c.getContext('2d')
      const tint = { r: Math.min(rgb.r + 45, 255), g: Math.min(rgb.g + 45, 255), b: Math.min(rgb.b + 25, 255) }
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      grad.addColorStop(0, `rgba(${tint.r},${tint.g},${tint.b},0.85)`)
      grad.addColorStop(0.12, `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`)
      grad.addColorStop(0.34, `rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`)
      grad.addColorStop(0.66, `rgba(${rgb.r},${rgb.g},${rgb.b},0.05)`)
      grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`)
      g.fillStyle = grad
      g.fillRect(0, 0, s, s)
      return c
    }
    const map = {}
    for (const g of genres) map[`genre:${g}`] = make(genreRgb(g))
    map['genre:'] = make(genreRgb(''))
    for (const k in LAYERS) map[k] = make(LAYERS[k].rgb)
    map._white = make({ r: 235, g: 225, b: 255 })
    return map
  }, [genres])

  const bgStars = useRef([])

  // Frame the view to the user's read books (corpus is background reference only)
  const fitView = useCallback((W, H) => {
    const userPts = points.filter(p => p.layer !== 'corpus')
    if (!userPts.length) return
    const frame = userPts.filter(p => p.layer === 'read')
    const src = frame.length ? frame : userPts
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of src) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    }
    center.current = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    const rangeX = Math.max(maxX - minX, 1e-3)
    const rangeY = Math.max(maxY - minY, 1e-3)
    const pad = 0.22
    let sx = W * (1 - pad) / rangeX
    let sy = H * (1 - pad) / rangeY
    const cap = 1.8
    if (sx > sy * cap) sx = sy * cap
    else if (sy > sx * cap) sy = sx * cap
    baseScale.current = { x: sx, y: sy }
    dataRange.current = { x: rangeX, y: rangeY }
    view.current = { z: 1, panX: 0, panY: 0 }
  }, [points])

  const worldToScreen = useCallback((wx, wy, W, H) => {
    const { z, panX, panY } = view.current
    const c = center.current
    const bx = baseScale.current.x * z, by = baseScale.current.y * z
    return [(wx - c.x) * bx + W / 2 + panX, -(wy - c.y) * by + H / 2 + panY]
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (canvasOutRef) canvasOutRef.current = canvas
    let raf = 0
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      canvasRect = wrap.getBoundingClientRect()
      W = canvasRect.width; H = canvasRect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round((W * H) / 5200)
      bgStars.current = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 0.9 + 0.25,
        a: Math.random() * 0.5 + 0.15,
        phase: Math.random() * Math.PI * 2,
        twk: Math.random() * 1.5 + 0.5,
      }))
      bgGrad = ctx.createRadialGradient(W * 0.4, H * 0.35, 0, W * 0.4, H * 0.35, Math.max(W, H) * 0.8)
      bgGrad.addColorStop(0, '#140d24')
      bgGrad.addColorStop(0.55, '#0a0616')
      bgGrad.addColorStop(1, '#050208')
      fitView(W, H)
    }

    let bgGrad = null
    let canvasRect = null
    const screenPosCache = new Map()
    const keyMap = new Map(points.map(p => [p.key, p]))
    const dragMoved = { current: false }
    const orbitAng = new Map()
    for (const [k, orb] of structure.orbits) orbitAng.set(k, orb.phase)
    let prevT = 0

    const worldPos = (p) => {
      const orb = structure.orbits.get(p.key)
      if (!orb) return [p.x, p.y]
      const ang = orbitAng.has(p.key) ? orbitAng.get(p.key) : orb.phase
      const ratio = baseScale.current.x / baseScale.current.y
      return [orb.sx + orb.r * Math.cos(ang), orb.sy - orb.r * ratio * Math.sin(ang)]
    }
    const screenPos = (p) => { const [wx, wy] = worldPos(p); return worldToScreen(wx, wy, W, H) }

    const draw = (t) => {
      const time = t / 1000
      const hp = hoverRef.current ? keyMap.get(hoverRef.current) : null
      const hoverOrbit = hp && hp.layer === 'suggestions' ? structure.orbits.get(hp.key) : null
      if (!prevT) prevT = time
      const dt = Math.min(time - prevT, 0.05); prevT = time
      if (!reduceMotion) {
        for (const [k, orb] of structure.orbits) {
          if (k === hoverRef.current) continue
          orbitAng.set(k, orbitAng.get(k) + dt * orb.speed)
        }
      }

      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1

      // cluster halos — coloured by dominant genre of each cluster
      if (visibleRef.current.read !== false) {
        for (const cl of structure.clusters) {
          const [cx, cy] = worldToScreen(cl.wx, cl.wy, W, H)
          let rad = 0, hasVisible = false
          for (const m of cl.members) {
            if (visibleRef.current[m.genre] === false) continue
            hasVisible = true
            const [sx, sy] = worldToScreen(m.x, m.y, W, H)
            rad = Math.max(rad, Math.hypot(sx - cx, sy - cy))
          }
          if (!hasVisible) continue
          rad = Math.min(rad * 1.55 + 40, 200)
          const { r, g, b } = cl.rgb
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
          grd.addColorStop(0, `rgba(${r},${g},${b},0.11)`)
          grd.addColorStop(0.5, `rgba(${r},${g},${b},0.045)`)
          grd.addColorStop(1, `rgba(${r},${g},${b},0)`)
          ctx.fillStyle = grd
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill()
        }
      }

      // background stars
      for (const s of bgStars.current) {
        const tw = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(time * s.twk + s.phase)
        const d = s.r * 7
        ctx.globalAlpha = s.a * tw
        ctx.drawImage(sprites._white, s.x - d, s.y - d, d * 2, d * 2)
      }
      ctx.globalAlpha = 1

      // corpus — terrain PNG behind everything else.
      // The PNG is rendered over a padded grid wider than the corpus point extent,
      // so its placement must use the exact bounds the notebook emitted (TERRAIN_BOUNDS),
      // not the dots' min/max. corpusBoundsRef is only a fallback if those are missing.
      const _tb = TERRAIN_BOUNDS ?? corpusBoundsRef.current
      if (visibleRef.current.corpus && terrainImgRef.current && _tb) {
        const [x0, y0] = worldToScreen(_tb.minX, _tb.maxY, W, H)
        const [x1, y1] = worldToScreen(_tb.maxX, _tb.minY, W, H)
        ctx.globalAlpha = 0.5
        ctx.drawImage(terrainImgRef.current, x0, y0, x1 - x0, y1 - y0)
        ctx.globalAlpha = 1
      }

      // zoom-derived fades (shared by corpus dots and user points below)
      const zoom = view.current.z
      const sizeFade = Math.max(0.5, Math.min(zoom, 2.6))
      const dimFade = 0.3 * Math.pow(Math.min(zoom, 1), 2.5)
      const coreFade = Math.max(0.7, Math.min(zoom, 1.8))

      // corpus dots — individual reference books, same style as read but faded
      if (visibleRef.current.corpusDots) {
        for (const p of points) {
          if (p.layer !== 'corpus') continue
          const [sx, sy] = worldToScreen(p.x, p.y, W, H)
          screenPosCache.set(p.key, [sx, sy])
          if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
          const tw = reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(time * 1.4 + p.phase)
          const { r, g, b } = genreRgb(p.genre)
          const sprite = sprites[`genre:${p.genre || ''}`] || sprites['genre:']
          const d = p.size * 2.6 * sizeFade
          ctx.globalAlpha = tw * dimFade * 0.15
          ctx.drawImage(sprite, sx - d, sy - d, d * 2, d * 2)
          const cr = p.size * 0.56 * coreFade
          ctx.globalAlpha = Math.min(1, tw + 0.1) * 0.12
          const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, cr)
          cg.addColorStop(0, `rgb(${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 38, 255)})`)
          cg.addColorStop(0.55, `rgb(${Math.min(r + 20, 255)},${Math.min(g + 20, 255)},${Math.min(b + 10, 255)})`)
          cg.addColorStop(1, `rgb(${Math.round(r * 0.88)},${Math.round(g * 0.88)},${Math.round(b * 0.88)})`)
          ctx.fillStyle = cg
          ctx.beginPath(); ctx.arc(sx, sy, cr, 0, Math.PI * 2); ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // constellation lines
      if (structure.links.length) {
        ctx.strokeStyle = 'rgba(190,170,255,0.42)'; ctx.lineWidth = 1.9
        ctx.beginPath()
        for (const [a, b] of structure.links) {
          if (visibleRef.current[a.genre] === false) continue
          const [ax, ay] = worldToScreen(a.x, a.y, W, H)
          const [bx, by] = worldToScreen(b.x, b.y, W, H)
          ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
        }
        ctx.stroke()
      }

      // orbit outline while hovering a suggestion
      if (hoverOrbit && visibleRef.current.suggestions) {
        const [cx, cy] = worldToScreen(hoverOrbit.sx, hoverOrbit.sy, W, H)
        const R = hoverOrbit.r * baseScale.current.x * view.current.z
        ctx.strokeStyle = 'rgba(150,170,255,0.5)'
        ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
      }

      // user data points (read, want, suggestions)
      for (const p of points) {
        if (p.layer === 'corpus') continue
        if (p.layer === 'want' && !visibleRef.current.want) continue
        if (p.layer === 'suggestions' && !visibleRef.current.suggestions) continue
        if (p.layer === 'read' && visibleRef.current[p.genre] === false) continue
        const isRec = p.layer === 'suggestions'
        const [sx, sy] = screenPos(p)
        screenPosCache.set(p.key, [sx, sy])
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
        const tw = reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(time * 1.4 + p.phase)

        // colour: genre for read; white for suggestions; layer colour for want
        const rgb = p.layer === 'read'
          ? genreRgb(p.genre)
          : p.layer === 'suggestions'
            ? { r: 235, g: 230, b: 255 }
            : LAYERS[p.layer].rgb
        const { r, g, b } = rgb

        if (p.layer === 'want') {
          const tws = reduceMotion ? 0.7 : 0.45 + 0.35 * Math.sin(time * 1.1 + p.phase)
          const rr = p.size * 0.56 * coreFade
          const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * 2.8)
          gl.addColorStop(0, `rgba(${r},${g},${b},0.5)`)
          gl.addColorStop(0.5, `rgba(${r},${g},${b},0.14)`)
          gl.addColorStop(1, `rgba(${r},${g},${b},0)`)
          ctx.globalAlpha = 0.55 + tws * 0.45
          ctx.fillStyle = gl
          ctx.beginPath(); ctx.arc(sx, sy, rr * 2.8, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 0.6 + tws * 0.4
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.fill()
          continue
        }

        const spriteKey = p.layer === 'read'
          ? `genre:${p.genre || ''}`
          : p.layer === 'suggestions'
            ? '_white'
            : p.layer
        const sprite = sprites[spriteKey] || sprites['genre:']
        const d = (isRec ? 8.0 : p.size) * (isRec ? 2.5 : 2.6) * sizeFade
        ctx.globalAlpha = tw * dimFade
        ctx.drawImage(sprite, sx - d, sy - d, d * 2, d * 2)
        const cr = (isRec ? 3.6 : p.size * 0.56) * coreFade
        ctx.globalAlpha = Math.min(1, tw + 0.1) * 0.9
        const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, cr)
        cg.addColorStop(0, `rgb(${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 38, 255)})`)
        cg.addColorStop(0.55, `rgb(${Math.min(r + 20, 255)},${Math.min(g + 20, 255)},${Math.min(b + 10, 255)})`)
        cg.addColorStop(1, `rgb(${Math.round(r * 0.88)},${Math.round(g * 0.88)},${Math.round(b * 0.88)})`)
        ctx.fillStyle = cg
        ctx.beginPath()
        if (isRec) {
          ctx.moveTo(sx,      sy - cr)
          ctx.lineTo(sx + cr, sy)
          ctx.lineTo(sx,      sy + cr)
          ctx.lineTo(sx - cr, sy)
          ctx.closePath()
        } else {
          ctx.arc(sx, sy, cr, 0, Math.PI * 2)
        }
        ctx.fill()
      }

      ctx.globalAlpha = 1

      // hover ring — O(1) lookup
      const hovP = hoverRef.current ? keyMap.get(hoverRef.current) : null
      if (hovP &&
          !(hovP.layer === 'corpus' && !visibleRef.current.corpusDots) &&
          !(hovP.layer === 'want' && !visibleRef.current.want) &&
          !(hovP.layer === 'suggestions' && !visibleRef.current.suggestions) &&
          !(hovP.layer === 'read' && visibleRef.current[hovP.genre] === false)) {
        const isRec = hovP.layer === 'suggestions'
        const isCorpus = hovP.layer === 'corpus'
        const [sx, sy] = screenPosCache.get(hovP.key) ?? screenPos(hovP)
        if (sx >= -60 && sx <= W + 60 && sy >= -60 && sy <= H + 60) {
          ctx.beginPath()
          ctx.arc(sx, sy, isRec ? 9 : hovP.size * 1.7 + 3, 0, Math.PI * 2)
          ctx.strokeStyle = isCorpus ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)'
          ctx.lineWidth = 1.4
          ctx.stroke()
        }
      }

      // selection ring — O(1) lookup
      const selP = selectedRef.current ? keyMap.get(selectedRef.current) : null
      if (selP &&
          !(selP.layer === 'corpus' && !visibleRef.current.corpusDots) &&
          !(selP.layer === 'want' && !visibleRef.current.want) &&
          !(selP.layer === 'suggestions' && !visibleRef.current.suggestions) &&
          !(selP.layer === 'read' && visibleRef.current[selP.genre] === false)) {
        const isRec = selP.layer === 'suggestions'
        const isCorpus = selP.layer === 'corpus'
        const [sx, sy] = screenPosCache.get(selP.key) ?? screenPos(selP)
        if (sx >= -60 && sx <= W + 60 && sy >= -60 && sy <= H + 60) {
          ctx.beginPath()
          ctx.arc(sx, sy, isRec ? 11 : selP.size * 1.7 + 5, 0, Math.PI * 2)
          ctx.strokeStyle = isCorpus ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.95)'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      raf = requestAnimationFrame(draw)
    }

    const clampPan = () => {
      const v = view.current
      const halfW = (dataRange.current.x / 2) * baseScale.current.x * v.z
      const halfH = (dataRange.current.y / 2) * baseScale.current.y * v.z
      v.panX = Math.max(-halfW, Math.min(halfW, v.panX))
      v.panY = Math.max(-halfH, Math.min(halfH, v.panY))
    }

    const hoverRef = { current: null }

    const pickPoint = (mx, my) => {
      let best = null, bestD = Infinity
      for (const p of points) {
        if (p.layer === 'corpus' && !visibleRef.current.corpusDots) continue
        if (p.layer === 'want' && !visibleRef.current.want) continue
        if (p.layer === 'suggestions' && !visibleRef.current.suggestions) continue
        if (p.layer === 'read' && visibleRef.current[p.genre] === false) continue
        const isRec = p.layer === 'suggestions'
        const cached = screenPosCache.get(p.key)
        const [sx, sy] = cached ?? screenPos(p)
        const d = Math.hypot(sx - mx, sy - my)
        const hit = isRec ? 14 : p.size * 1.8 + 6
        if (d < hit && d < bestD) { bestD = d; best = { p, sx, sy } }
      }
      return best
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      if (dragging.current) {
        const dx = mx - dragging.current.x, dy = my - dragging.current.y
        if (Math.hypot(dx, dy) > 4) dragMoved.current = true
        view.current.panX += dx
        view.current.panY += dy
        dragging.current = { x: mx, y: my }
        clampPan()
        return
      }
      const found = pickPoint(mx, my)
      const newKey = found ? found.p.key : null
      if (newKey !== hoverRef.current) {
        hoverRef.current = newKey
        canvas.style.cursor = found ? 'pointer' : 'grab'
        setHover(found ? { point: found.p, sx: found.sx, sy: found.sy, W } : null)
      }
    }
    const onDown = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      dragMoved.current = false
      dragging.current = { x: mx, y: my }
      canvas.style.cursor = 'grabbing'
    }
    const onClick = (e) => {
      if (dragMoved.current) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const found = pickPoint(mx, my)
      if (found && onSelect) onSelect(found.p)
    }
    const onUp = () => { dragging.current = null; canvas.style.cursor = 'grab' }
    const onLeave = () => { hoverRef.current = null; setHover(null); dragging.current = null }
    const onWheel = (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const v = view.current, c = center.current
      const bx = baseScale.current.x * v.z, by = baseScale.current.y * v.z
      const wx = (mx - W / 2 - v.panX) / bx + c.x
      const wy = -(my - H / 2 - v.panY) / by + c.y
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1
      const factor = Math.exp(-e.deltaY * unit * 0.0035)
      v.z = Math.min(Math.max(v.z * factor, 0.6), 60)
      const nbx = baseScale.current.x * v.z, nby = baseScale.current.y * v.z
      v.panX = mx - W / 2 - (wx - c.x) * nbx
      v.panY = my - H / 2 + (wy - c.y) * nby
      clampPan()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('click', onClick)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    raf = requestAnimationFrame(draw)
    canvas._resetView = () => { fitView(W, H) }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('click', onClick)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      if (canvasOutRef) canvasOutRef.current = null
    }
  }, [points, structure, sprites, worldToScreen, fitView, reduceMotion, canvasOutRef])

  const resetView = () => canvasRef.current?._resetView?.()

  const hasCorpus = corpus && corpus.length > 0

  return (
    <div className="bg-map" ref={wrapRef}>
      <canvas ref={canvasRef} className="bg-canvas" />

      {/* Genres — top left */}
      {genres.length > 0 && (
        <div className="bg-legend">
          <span className="bg-legend-section">Genres</span>
          {genres.map(g => {
            const { r, b: bl, g: gr } = genreRgb(g)
            return (
              <button
                key={g}
                type="button"
                className={`bg-legend-item${isGenreVisible(g) ? '' : ' off'}`}
                onClick={() => toggleLayer(g)}
                aria-pressed={isGenreVisible(g)}
                title={isGenreVisible(g) ? `Hide ${g}` : `Show ${g}`}
              >
                <i className="bg-dot" style={{ '--c': `rgb(${r},${gr},${bl})` }} />
                {g}
              </button>
            )
          })}
        </div>
      )}

      {/* Overlays — top right */}
      <div className="bg-legend bg-legend-right">
        <div className="bg-legend-section-row">
          <span className="bg-legend-section">Overlays</span>
          <button
            type="button"
            className={`bg-legend-help${overlayHelp ? ' active' : ''}`}
            onClick={() => setOverlayHelp(v => !v)}
            title="What are overlays?"
            aria-pressed={overlayHelp}
          >?</button>
        </div>
        {Object.entries(LAYERS)
          .filter(([k]) => (k !== 'corpus' && k !== 'corpusDots') || hasCorpus)
          .map(([k, v]) => (
            <button
              key={k}
              type="button"
              className={`bg-legend-item${visible[k] ? '' : ' off'}${overlayHelp ? ' help-on' : ''}`}
              onClick={() => toggleLayer(k)}
              aria-pressed={visible[k]}
            >
              <i className={`bg-dot${v.ring ? ' ring' : ''}${v.diamond ? ' diamond' : ''}`}
                 style={{ '--c': `rgb(${v.rgb.r},${v.rgb.g},${v.rgb.b})`, opacity: v.faded ? 0.45 : 1 }} />
              <span className="bg-legend-item-text">
                <span>{v.label}</span>
                <span className="bg-legend-item-desc">{v.desc}</span>
              </span>
            </button>
          ))}
      </div>

      <div className="bg-controls">
        <button onClick={resetView} title="Reset view">Reset view</button>
        <span className="bg-hint">scroll to zoom · drag to pan</span>
      </div>

      {hover && (() => {
        const W = hover.W ?? 0
        const flipBelow = hover.sy < 96
        const left = W ? Math.max(124, Math.min(W - 124, hover.sx)) : hover.sx
        return (
          <div
            className={`bg-tooltip${flipBelow ? ' below' : ''}`}
            style={{ left, top: hover.sy }}
          >
            <strong>{hover.point.title}</strong>
            <span>{hover.point.author}</span>
            {hover.point.genre && (
              <span className="bg-tt-genre" style={{ '--gc': `rgb(${genreRgb(hover.point.genre).r},${genreRgb(hover.point.genre).g},${genreRgb(hover.point.genre).b})` }}>
                {hover.point.genre}
              </span>
            )}
            {hover.point.layer === 'read' && hover.point.rating > 0 && (
              <span className="bg-tt-sub">{'★'.repeat(hover.point.rating)}</span>
            )}
            {hover.point.layer === 'want' && <span className="bg-tt-sub">want to read</span>}
            {hover.point.layer === 'suggestions' && (
              <span className="bg-tt-sub">match {hover.point.score?.toFixed(2)}</span>
            )}
            {hover.point.layer === 'corpus' && <span className="bg-tt-sub">reference book</span>}
          </div>
        )
      })()}
    </div>
  )
}

export default StarMap
