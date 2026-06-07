import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SAMPLE_PLOT } from './bookGraphSample.js'
import './BookGraph.css'

// In local dev (`npm run dev`) we never hit the real API — it costs tokens and
// we want a deterministic plot. The production build always calls the live API.
const USE_MOCK = import.meta.env.DEV

/* ─────────────────────────────────────────────────────────────────────────
   Layer palette — purple-family hues so every dot reads as a "star" in the
   same cosmos, while still being distinguishable by role.
   ──────────────────────────────────────────────────────────────────────── */
const LAYERS = {
  read:     { rgb: { r: 170, g: 120, b: 255 }, label: 'Your books',       ring: false },
  want:     { rgb: { r: 214, g: 184, b: 255 }, label: 'Want to read',     ring: false },
  new:      { rgb: { r: 120, g: 150, b: 255 }, label: 'New authors',      ring: true  },
  familiar: { rgb: { r: 232, g: 132, b: 226 }, label: 'Familiar authors', ring: true  },
}

const STEPS = [
  'Reading your library…',
  'Matching against the book database…',
  'Looking up any unknown books…',
  'Understanding your taste…',
  'Building your map…',
  'Finding recommendations…',
]

/* ── API ─────────────────────────────────────────────────────────────────── */
async function plotBooks(file, signal) {
  if (USE_MOCK) {
    // Simulated request: no network, no token cost, same plot every time.
    // Brief delay so the stepped loader is still visible while developing.
    await new Promise(r => setTimeout(r, 1600))
    return SAMPLE_PLOT
  }
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/books/plot', { method: 'POST', body: form, signal })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/* ─────────────────────────────────────────────────────────────────────────
   StarMap — custom canvas renderer. Remounts (via key) whenever new data
   arrives, so its setup effect always closes over fresh data.
   ──────────────────────────────────────────────────────────────────────── */
function StarMap({ data, onSelect, selectedKey, canvasOutRef }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null) // { point, sx, sy }
  // Layer visibility — only "read" is shown initially; the rest toggle on via
  // the legend. A ref mirror lets the rAF draw loop read it without re-subscribing.
  const [visible, setVisible] = useState({ read: true, want: false, new: false, familiar: false })
  const visibleRef = useRef(visible)
  useEffect(() => { visibleRef.current = visible }, [visible])
  const toggleLayer = (k) => setVisible(v => ({ ...v, [k]: !v[k] }))
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // Flatten every plottable point into one list sharing the UMAP coord system.
  const points = useMemo(() => {
    const out = []
    const push = (arr, layer, sizer) =>
      (arr || []).forEach((p, i) => {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return
        out.push({
          ...p, layer,
          size: sizer(p),
          key: `${layer}-${i}`,
          phase: Math.random() * Math.PI * 2,
        })
      })
    push(data.read, 'read', p => 7 + 1.8 * (p.rating || 0))
    push(data.want, 'want', () => 8)
    push(data.recommendations?.new_authors, 'new', () => 7)
    push(data.recommendations?.familiar_authors, 'familiar', () => 7)
    return out
  }, [data])

  // Separation cues, derived once in world space (projected to screen each frame):
  //  • clusters → soft nebula halos behind each detected group of read books
  //  • links    → constellation lines between near-neighbour read books
  //  • orbits   → each recommendation orbits the read book that inspired it
  const structure = useMemo(() => {
    const readPts = points.filter(p => p.layer === 'read')
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
    if (readPts.length < 2) return { clusters: [], links: [], orbits: new Map() }

    // typical nearest-neighbour distance → thresholds that adapt to any data scale
    const nn = readPts.map(a => {
      let m = Infinity
      for (const b of readPts) if (b !== a) m = Math.min(m, dist(a, b))
      return m
    }).sort((a, b) => a - b)
    const mnn = nn[Math.floor(nn.length / 2)] || 1
    const linkT = mnn * 2.4
    const clusterT = mnn * 3.4

    // single-linkage clustering via union-find
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

    const PALETTE = [
      { r: 150, g: 110, b: 255 }, { r: 95, g: 145, b: 255 }, { r: 230, g: 120, b: 210 },
      { r: 95, g: 200, b: 210 }, { r: 180, g: 140, b: 255 }, { r: 130, g: 120, b: 235 },
    ]
    let ci = 0
    const clusters = []
    for (const members of groups.values()) {
      if (members.length < 3) continue // lone outliers get no halo
      clusters.push({ members, rgb: PALETTE[ci % PALETTE.length] })
      ci++
    }

    // constellation links: each read book to its ≤3 nearest neighbours within linkT
    const seen = new Set()
    const links = []
    readPts.forEach((a, i) => {
      readPts
        .map((b, j) => ({ b, j, d: dist(a, b) }))
        .filter(o => o.j !== i && o.d <= linkT)
        .sort((x, y) => x.d - y.d)
        .slice(0, 3)
        .forEach(({ b, j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`
          if (seen.has(key)) return
          seen.add(key)
          links.push([a, b])
        })
    })

    // orbits: each recommendation becomes a planet circling the read book named
    // in because_you_read. Multiple recs sharing a book get stacked orbit radii.
    const norm = s => (s || '').trim().toLowerCase()
    const byTitle = new Map(readPts.map(p => [norm(p.title), p]))
    const usedRadii = new Map() // src.key → how many planets already assigned
    const orbits = new Map()
    for (const p of points) {
      if (p.layer !== 'new' && p.layer !== 'familiar') continue
      const src = byTitle.get(norm(p.because_you_read))
      if (!src) continue
      const idx = usedRadii.get(src.key) || 0
      usedRadii.set(src.key, idx + 1)
      const radius = 20 + idx * 11           // screen px; stacked rings per book
      orbits.set(p.key, {
        src,
        layer: p.layer,
        radius,
        base: p.phase,                       // deterministic-ish start angle
        speed: 0.55 * (24 / radius),         // inner planets sweep faster
        dir: idx % 2 === 0 ? 1 : -1,         // alternate orbit direction
      })
    }

    return { clusters, links, orbits }
  }, [points])

  // Anisotropic fill-fit: the data box is mapped to (almost) the whole canvas so
  // there's no dead space, and clusters spread out to read as distinct groups.
  // `z` is a uniform zoom multiplier on top (z >= 1 → can't zoom out past the fit).
  const view = useRef({ z: 1, panX: 0, panY: 0 })
  const baseScale = useRef({ x: 1, y: 1 })
  const dataRange = useRef({ x: 1, y: 1 })
  const center = useRef({ x: 0, y: 0 })
  const dragging = useRef(null)
  const selectedRef = useRef(selectedKey)
  useEffect(() => { selectedRef.current = selectedKey }, [selectedKey])

  // Pre-render a fuzzy radial glow sprite per colour (fast drawImage blits).
  const sprites = useMemo(() => {
    const make = (rgb, whiteCore = true) => {
      const s = 128
      const c = document.createElement('canvas')
      c.width = c.height = s
      const g = c.getContext('2d')
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      grad.addColorStop(0, whiteCore ? 'rgba(255,255,255,0.95)' : `rgba(${rgb.r},${rgb.g},${rgb.b},0.95)`)
      grad.addColorStop(0.14, `rgba(${rgb.r},${rgb.g},${rgb.b},0.92)`)
      grad.addColorStop(0.38, `rgba(${rgb.r},${rgb.g},${rgb.b},0.40)`)
      grad.addColorStop(0.70, `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`)
      grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`)
      g.fillStyle = grad
      g.fillRect(0, 0, s, s)
      return c
    }
    const map = {}
    for (const k in LAYERS) map[k] = make(LAYERS[k].rgb)
    map._white = make({ r: 235, g: 225, b: 255 })
    return map
  }, [])

  // Decorative background starfield (canvas-space, regenerated on resize).
  const bgStars = useRef([])

  const fitView = useCallback((W, H) => {
    if (!points.length) return
    // Frame to the read books (the always-on base layer); recommendations live
    // in the same coordinate neighbourhood so they stay reachable when toggled on.
    const frame = points.filter(p => p.layer === 'read')
    const src = frame.length ? frame : points
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of src) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    }
    center.current = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    const rangeX = Math.max(maxX - minX, 1e-3)
    const rangeY = Math.max(maxY - minY, 1e-3)
    const pad = 0.12
    let sx = W * (1 - pad) / rangeX
    let sy = H * (1 - pad) / rangeY
    // cap the stretch so data never gets wildly distorted (e.g. a near-1D shelf)
    const cap = 2.2
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
      const rect = wrap.getBoundingClientRect()
      W = rect.width; H = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // (re)seed background stars proportional to area
      const n = Math.round((W * H) / 5200)
      bgStars.current = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 0.9 + 0.25,
        a: Math.random() * 0.5 + 0.15,
        phase: Math.random() * Math.PI * 2,
        twk: Math.random() * 1.5 + 0.5,
      }))
      fitView(W, H)
    }

    // Screen position of a point. Recommendations orbit their source book; every
    // other point uses its UMAP coordinate. `time` (seconds) drives the orbit.
    const screenPos = (p, time) => {
      const o = structure.orbits.get(p.key)
      if (o) {
        const [sx, sy] = worldToScreen(o.src.x, o.src.y, W, H)
        const ang = o.base + o.dir * (reduceMotion ? 0 : time) * o.speed
        return [sx + Math.cos(ang) * o.radius, sy + Math.sin(ang) * o.radius]
      }
      return worldToScreen(p.x, p.y, W, H)
    }

    const draw = (t) => {
      const time = t / 1000
      // deep-space backdrop
      const bg = ctx.createRadialGradient(W * 0.4, H * 0.35, 0, W * 0.4, H * 0.35, Math.max(W, H) * 0.8)
      bg.addColorStop(0, '#140d24')
      bg.addColorStop(0.55, '#0a0616')
      bg.addColorStop(1, '#050208')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 1

      // cluster halos — soft nebulae behind each detected group of read books
      if (visibleRef.current.read) {
        for (const cl of structure.clusters) {
          const pts = cl.members.map(m => worldToScreen(m.x, m.y, W, H))
          let cx = 0, cy = 0
          for (const [x, y] of pts) { cx += x; cy += y }
          cx /= pts.length; cy /= pts.length
          let rad = 0
          for (const [x, y] of pts) rad = Math.max(rad, Math.hypot(x - cx, y - cy))
          rad = rad * 1.55 + 40
          const { r, g, b } = cl.rgb
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
          grd.addColorStop(0, `rgba(${r},${g},${b},0.17)`)
          grd.addColorStop(0.5, `rgba(${r},${g},${b},0.07)`)
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

      // constellation lines — thin threads between near-neighbour read books
      if (visibleRef.current.read && structure.links.length) {
        ctx.strokeStyle = 'rgba(170,150,255,0.13)'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const [a, b] of structure.links) {
          const [ax, ay] = worldToScreen(a.x, a.y, W, H)
          const [bx, by] = worldToScreen(b.x, b.y, W, H)
          ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
        }
        ctx.stroke()
      }

      // orbital paths — faint ring each recommendation-planet travels around its book
      for (const o of structure.orbits.values()) {
        if (!visibleRef.current[o.layer]) continue
        const [sx, sy] = worldToScreen(o.src.x, o.src.y, W, H)
        const { r, g, b } = LAYERS[o.layer].rgb
        ctx.strokeStyle = `rgba(${r},${g},${b},0.16)`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(sx, sy, o.radius, 0, Math.PI * 2); ctx.stroke()
      }

      // data points — glow sprites (recommendations render as small planets)
      for (const p of points) {
        if (!visibleRef.current[p.layer]) continue
        const isRec = p.layer === 'new' || p.layer === 'familiar'
        const [sx, sy] = screenPos(p, time)
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
        const tw = reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(time * 1.4 + p.phase)
        const d = (isRec ? 4.4 : p.size) * (isRec ? 2.3 : 2.6)
        ctx.globalAlpha = tw
        ctx.drawImage(sprites[p.layer], sx - d, sy - d, d * 2, d * 2)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      // hover / selected emphasis ring
      for (const p of points) {
        if (!visibleRef.current[p.layer]) continue
        const isSel = selectedRef.current === p.key
        const isHov = hoverRef.current === p.key
        if (!isSel && !isHov) continue
        const isRec = p.layer === 'new' || p.layer === 'familiar'
        const [sx, sy] = screenPos(p, time)
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
        ctx.beginPath()
        ctx.arc(sx, sy, isRec ? 8 : p.size * 2 + 4, 0, Math.PI * 2)
        ctx.strokeStyle = isSel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)'
        ctx.lineWidth = isSel ? 2 : 1.2
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }

    // Keep the (filled) data box covering the viewport — no dragging into the void.
    // At the initial zoom the content is locked centred; zoomed in, pan is bounded.
    const clampPan = () => {
      const v = view.current
      const halfW = (dataRange.current.x / 2) * baseScale.current.x * v.z
      const halfH = (dataRange.current.y / 2) * baseScale.current.y * v.z
      const limX = halfW - W / 2, limY = halfH - H / 2
      v.panX = limX <= 0 ? 0 : Math.max(-limX, Math.min(limX, v.panX))
      v.panY = limY <= 0 ? 0 : Math.max(-limY, Math.min(limY, v.panY))
    }

    // hover tracked in a ref so the draw loop sees it without re-subscribing
    const hoverRef = { current: null }

    const pickPoint = (mx, my) => {
      const time = performance.now() / 1000
      let best = null, bestD = Infinity
      for (const p of points) {
        if (!visibleRef.current[p.layer]) continue
        const isRec = p.layer === 'new' || p.layer === 'familiar'
        const [sx, sy] = screenPos(p, time)
        const d = Math.hypot(sx - mx, sy - my)
        const hit = isRec ? 11 : p.size * 1.8 + 6
        if (d < hit && d < bestD) { bestD = d; best = { p, sx, sy } }
      }
      return best
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      if (dragging.current) {
        view.current.panX += mx - dragging.current.x
        view.current.panY += my - dragging.current.y
        dragging.current = { x: mx, y: my }
        clampPan()
        return
      }
      const found = pickPoint(mx, my)
      hoverRef.current = found ? found.p.key : null
      canvas.style.cursor = found ? 'pointer' : 'grab'
      setHover(found ? { point: found.p, sx: found.sx, sy: found.sy } : null)
    }
    const onDown = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const found = pickPoint(mx, my)
      if (found) { onSelect(found.p); return }
      dragging.current = { x: mx, y: my, moved: false }
      canvas.style.cursor = 'grabbing'
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
      const factor = Math.exp(-e.deltaY * 0.0014)
      // floor at z=1 (the initial fit) — zooming in only, never further out
      v.z = Math.min(Math.max(v.z * factor, 1), 60)
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
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    raf = requestAnimationFrame(draw)

    // expose reset for the toolbar button
    canvas._resetView = () => { fitView(W, H) }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      if (canvasOutRef) canvasOutRef.current = null
    }
  }, [points, structure, sprites, worldToScreen, fitView, onSelect, reduceMotion, canvasOutRef])

  const resetView = () => canvasRef.current?._resetView?.()

  return (
    <div className="bg-map" ref={wrapRef}>
      <canvas ref={canvasRef} className="bg-canvas" />

      <div className="bg-legend">
        {Object.entries(LAYERS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            className={`bg-legend-item${visible[k] ? '' : ' off'}`}
            onClick={() => toggleLayer(k)}
            aria-pressed={visible[k]}
            title={visible[k] ? `Hide ${v.label.toLowerCase()}` : `Show ${v.label.toLowerCase()}`}
          >
            <i className={`bg-dot${v.ring ? ' ring' : ''}`}
               style={{ '--c': `rgb(${v.rgb.r},${v.rgb.g},${v.rgb.b})` }} />
            {v.label}
          </button>
        ))}
      </div>

      <div className="bg-controls">
        <button onClick={resetView} title="Reset view">Reset view</button>
        <span className="bg-hint">scroll to zoom · drag to pan</span>
      </div>

      {hover && (
        <div className="bg-tooltip" style={{ left: hover.sx, top: hover.sy }}>
          <strong>{hover.point.title}</strong>
          <span>{hover.point.author}</span>
          {hover.point.layer === 'read' && (
            <span className="bg-tt-sub">
              {hover.point.rating ? '★'.repeat(hover.point.rating) : 'unrated'}
            </span>
          )}
          {hover.point.layer === 'want' && <span className="bg-tt-sub">want to read</span>}
          {(hover.point.layer === 'new' || hover.point.layer === 'familiar') && (
            <span className="bg-tt-sub">match {hover.point.score?.toFixed(2)}</span>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Detail panel for the selected star ──────────────────────────────────── */
function DetailPanel({ point, onClose }) {
  const meta = LAYERS[point.layer]
  return (
    <aside className="bg-detail">
      <button className="bg-detail-close" onClick={onClose} aria-label="Close">×</button>
      <span className="bg-detail-tag" style={{ '--c': `rgb(${meta.rgb.r},${meta.rgb.g},${meta.rgb.b})` }}>
        {meta.label}
      </span>
      <h3>{point.title}</h3>
      <p className="bg-detail-author">{point.author}</p>
      {point.layer === 'read' && (
        <dl>
          <div><dt>Rating</dt><dd>{point.rating ? '★'.repeat(point.rating) + '☆'.repeat(5 - point.rating) : 'unrated'}</dd></div>
          <div><dt>Date read</dt><dd>{point.date_read && point.date_read !== 'unknown' ? point.date_read : '—'}</dd></div>
        </dl>
      )}
      {point.layer === 'want' && <p className="bg-detail-note">On your to-read shelf.</p>}
      {(point.layer === 'new' || point.layer === 'familiar') && (
        <dl>
          {point.genre && <div><dt>Genre</dt><dd>{point.genre}</dd></div>}
          <div><dt>Match</dt><dd>{(point.score * 100).toFixed(0)}%</dd></div>
          {point.because_you_read && (
            <div><dt>Because you read</dt><dd><em>{point.because_you_read}</em></dd></div>
          )}
        </dl>
      )}
    </aside>
  )
}

/* ── Recommendation list cards ───────────────────────────────────────────── */
function RecList({ title, items, accent }) {
  if (!items?.length) return null
  return (
    <div className="bg-reclist">
      <h4 style={{ '--c': accent }}>{title}</h4>
      <ol>
        {items.map((r, i) => (
          <li key={i}>
            <span className="bg-rec-rank">{i + 1}</span>
            <span className="bg-rec-body">
              <b>{r.title}</b>
              <span className="bg-rec-author">{r.author}{r.genre ? ` · ${r.genre}` : ''}</span>
              <small>because you read <em>{r.because_you_read}</em></small>
            </span>
            <span className="bg-rec-score">{(r.score * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ── Dropzone ────────────────────────────────────────────────────────────── */
function Dropzone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)

  const handle = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onFile(null, 'Please upload the .csv file from Goodreads.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onFile(null, 'That file is over 5 MB — is it the right export?')
      return
    }
    onFile(file)
  }

  return (
    <div
      className={`bg-drop${over ? ' over' : ''}${disabled ? ' disabled' : ''}`}
      role="button" tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click() }}
      onDragEnter={e => { e.preventDefault(); setOver(true) }}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={e => { e.preventDefault(); setOver(false) }}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) handle(e.dataTransfer.files[0]) }}
    >
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
        <path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
      </svg>
      <p className="bg-drop-main">Drop your <strong>goodreads_library_export.csv</strong></p>
      <p className="bg-drop-sub">or <span className="bg-link">choose a file</span></p>
      <input ref={inputRef} type="file" accept=".csv,text/csv" hidden
             onChange={e => { handle(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}

/* ── Loader ──────────────────────────────────────────────────────────────── */
function Loader({ step, pct }) {
  return (
    <div className="bg-loader">
      <div className="bg-loader-orbit"><span /><span /><span /></div>
      <p className="bg-loader-step">{step}</p>
      <div className="bg-progress"><div style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

/* ── Share controls ──────────────────────────────────────────────────────────
   Each graph is built from the user's own CSV, so the shareable artefact is an
   IMAGE of the star-map (not a per-graph URL). We compose a branded 1200×675
   PNG from the live canvas, then offer: native device share (attaches the PNG —
   on mobile this hands straight to the Discord/X/LinkedIn apps), download, copy
   to clipboard, paste-into-X, paste-into-Discord, and link sharing.
   ──────────────────────────────────────────────────────────────────────────── */
function ShareControls({ canvasRef, data }) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)
  const toastTimer = useRef(0)

  useEffect(() => {
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => { document.removeEventListener('mousedown', onDoc); clearTimeout(toastTimer.current) }
  }, [])

  const flash = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3600)
  }, [])

  const pageUrl = `${location.origin}${location.pathname}#/book-graph`
  const shareText = 'I turned my Goodreads history into a galaxy of books with Book Graph'

  // Compose the branded share image from the live canvas.
  const buildBlob = useCallback(async () => {
    const live = canvasRef.current
    if (!live || !live.width) return null
    const W = 1200, H = 675
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d')
    const bg = g.createRadialGradient(W * 0.4, H * 0.35, 0, W * 0.4, H * 0.35, Math.max(W, H) * 0.85)
    bg.addColorStop(0, '#140d24'); bg.addColorStop(0.55, '#0a0616'); bg.addColorStop(1, '#050208')
    g.fillStyle = bg; g.fillRect(0, 0, W, H)
    // cover-fit the live map
    const scale = Math.max(W / live.width, H / live.height)
    const dw = live.width * scale, dh = live.height * scale
    try { g.drawImage(live, (W - dw) / 2, (H - dh) / 2, dw, dh) } catch { /* ignore */ }
    // vignette for text legibility
    const vg = g.createLinearGradient(0, 0, 0, H)
    vg.addColorStop(0, 'rgba(5,2,8,0.82)'); vg.addColorStop(0.24, 'rgba(5,2,8,0)')
    vg.addColorStop(0.76, 'rgba(5,2,8,0)'); vg.addColorStop(1, 'rgba(5,2,8,0.9)')
    g.fillStyle = vg; g.fillRect(0, 0, W, H)
    try { await document.fonts.load('600 46px Fraunces'); await document.fonts.ready } catch { /* font optional */ }
    g.textBaseline = 'alphabetic'
    g.fillStyle = '#e9dcff'
    g.font = '600 46px Fraunces, Georgia, serif'
    g.fillText('Book Graph', 50, 80)
    const n = data?.meta?.read_count
    g.font = '400 21px system-ui, sans-serif'
    g.fillStyle = '#b9a8d6'
    g.fillText(n ? `${n} books, mapped as a constellation of taste` : 'my reading, mapped', 50, 112)
    g.font = '600 19px system-ui, sans-serif'
    g.fillStyle = '#c4aee8'
    g.fillText('João Jorge', 50, H - 42)
    g.font = '400 16px system-ui, sans-serif'
    g.fillStyle = '#8a74a8'
    g.textAlign = 'right'
    g.fillText(pageUrl.replace(/^https?:\/\//, ''), W - 50, H - 42)
    g.textAlign = 'left'
    return await new Promise(r => c.toBlob(r, 'image/png'))
  }, [canvasRef, data, pageUrl])

  const saveBlob = (blob) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'book-graph.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  const copyBlob = async (blob) => {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard')
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
  }

  const withBusy = async (fn) => {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const onDownload = () => withBusy(async () => {
    const blob = await buildBlob(); if (!blob) return
    saveBlob(blob); flash('Image saved'); setOpen(false)
  })

  const onCopyImage = () => withBusy(async () => {
    const blob = await buildBlob(); if (!blob) return
    try { await copyBlob(blob); flash('Image copied to clipboard') }
    catch { saveBlob(blob); flash('Clipboard blocked — image downloaded instead') }
    setOpen(false)
  })

  const onNative = () => withBusy(async () => {
    const blob = await buildBlob(); if (!blob) return
    const file = new File([blob], 'book-graph.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'My Book Graph', text: shareText }) }
      catch (e) { if (e.name !== 'AbortError') flash('Sharing cancelled') }
    } else { saveBlob(blob); flash('Image saved') }
    setOpen(false)
  })

  const onShareX = () => withBusy(async () => {
    const blob = await buildBlob()
    let hint = ''
    if (blob) { try { await copyBlob(blob); hint = ' Image copied — paste it into the post.' } catch { /* paste optional */ } }
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`,
      '_blank', 'noopener,noreferrer'
    )
    flash(`Opening X.${hint}`); setOpen(false)
  })

  const onDiscord = () => withBusy(async () => {
    const blob = await buildBlob(); if (!blob) return
    try { await copyBlob(blob); flash('Image copied — paste it into Discord (Ctrl/Cmd+V)') }
    catch { saveBlob(blob); flash('Image downloaded — drag it into Discord') }
    setOpen(false)
  })

  const onLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
      '_blank', 'noopener,noreferrer'
    )
    flash('Opening LinkedIn — tip: attach the downloaded image for a richer post.')
    setOpen(false)
  }

  const onCopyLink = () => withBusy(async () => {
    try { await navigator.clipboard.writeText(pageUrl); flash('Page link copied') }
    catch { flash(pageUrl) }
    setOpen(false)
  })

  const canNative = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'

  const ShareIcon = (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  )

  return (
    <div className="bg-share" ref={wrapRef}>
      <button className="bg-share-btn" onClick={() => setOpen(o => !o)} disabled={busy}>
        {ShareIcon}<span>{busy ? 'Preparing…' : 'Share'}</span>
      </button>

      {open && (
        <div className="bg-share-menu" role="menu">
          <p className="bg-share-head">Share your star-map</p>
          {canNative && (
            <button role="menuitem" onClick={onNative}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" /></svg>
              Share to apps…
            </button>
          )}
          <button role="menuitem" onClick={onDownload}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M12 16l-4-4M12 16l4-4" /><path d="M5 20h14" /></svg>
            Download image
          </button>
          <button role="menuitem" onClick={onCopyImage}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
            Copy image
          </button>

          <div className="bg-share-sep" />
          <p className="bg-share-head">Post to</p>

          <button role="menuitem" onClick={onShareX}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            Share on X<small>image copied to paste in</small>
          </button>
          <button role="menuitem" onClick={onDiscord}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.029zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
            Share on Discord<small>image copied to paste in</small>
          </button>
          <button role="menuitem" onClick={onLinkedIn}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            Share on LinkedIn<small>shares the page link</small>
          </button>
          <button role="menuitem" onClick={onCopyLink}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4.93" /><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19.07" /></svg>
            Copy page link
          </button>
        </div>
      )}

      {toast && <div className="bg-toast" role="status">{toast}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   BookGraph — page-level orchestration
   ──────────────────────────────────────────────────────────────────────── */
export default function BookGraph() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('idle')      // idle | loading | done | error
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState(STEPS[0])
  const [pct, setPct] = useState(0)
  const [health, setHealth] = useState(USE_MOCK ? 'ok' : 'checking') // checking | ok | warming | unknown
  const abortRef = useRef(null)
  const liveCanvasRef = useRef(null)

  // readiness check (graceful: never hard-block if the endpoint is absent)
  useEffect(() => {
    if (USE_MOCK) return
    let stop = false
    const check = () => {
      fetch('/api/books/health')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(j => {
          if (stop) return
          if (j.status === 'ok' && j.reducer_ready) setHealth('ok')
          else { setHealth('warming'); setTimeout(check, 4000) }
        })
        .catch(() => { if (!stop) setHealth('unknown') })
    }
    check()
    return () => { stop = true }
  }, [])

  const runPlot = useCallback((file) => {
    setPhase('loading'); setError(''); setSelected(null)
    let s = 0
    setStep(STEPS[0]); setPct(6)
    const timer = setInterval(() => {
      if (s < STEPS.length - 1) { s++; setStep(STEPS[s]); setPct((s / STEPS.length) * 90) }
    }, 3500)
    const controller = new AbortController()
    abortRef.current = controller
    const guard = setTimeout(() => controller.abort(), 130000)

    plotBooks(file, controller.signal)
      .then(d => {
        clearInterval(timer); clearTimeout(guard)
        setStep('Done'); setPct(100)
        setData(d); setPhase('done')
      })
      .catch(e => {
        clearInterval(timer); clearTimeout(guard)
        setError(e.name === 'AbortError' ? 'Upload timed out. Please try again.' : e.message)
        setPhase('error')
      })
  }, [])

  const onFile = (file, clientError) => {
    if (clientError) { setError(clientError); setPhase('error'); return }
    if (file) runPlot(file)
  }

  const reset = () => {
    abortRef.current?.abort()
    setPhase('idle'); setData(null); setError(''); setSelected(null)
  }

  const meta = data?.meta
  const uploadDisabled = phase === 'loading' || health === 'warming'

  return (
    <div className="bookgraph">
      <header className="bg-head">
        <button className="bg-back" onClick={() => navigate('/projects')}>← Projects</button>
        <h1>Book Graph</h1>
        <p className="bg-tagline">
          A star-map of your reading. Upload your Goodreads export and watch your
          library bloom into constellations — then follow the dimmer stars toward
          your next read.
        </p>
      </header>

      {/* status pill */}
      {phase === 'idle' && (
        <div className={`bg-status bg-status-${health}`}>
          {health === 'checking' && 'Checking the engine…'}
          {health === 'ok' && 'Engine ready'}
          {health === 'warming' && 'Warming up — the recommender is still starting. One moment…'}
          {health === 'unknown' && 'Engine status unknown — uploads will be attempted directly.'}
        </div>
      )}

      {phase === 'idle' && (
        <>
          <Dropzone onFile={onFile} disabled={uploadDisabled} />
          <p className="bg-howto">
            Find your file in Goodreads under <em>My Books → Import and Export →
            Export Library</em>. Nothing is stored — your CSV is processed once
            to draw the map.
          </p>
        </>
      )}

      {phase === 'loading' && <Loader step={step} pct={pct} />}

      {phase === 'error' && (
        <div className="bg-error">
          <p>{error}</p>
          <button onClick={reset}>Try again</button>
        </div>
      )}

      {phase === 'done' && data && (
        <>
          {meta && (
            <div className="bg-meta">
              <span className="bg-meta-text">
                Mapped <b>{meta.read_count}</b> books ·{' '}
                <b>{data.recommendations?.new_authors?.length || 0}</b> new-author picks ·{' '}
                <b>{data.recommendations?.familiar_authors?.length || 0}</b> from authors you know
                {meta.enrich_timed_out && <em> · a few unknown books were matched approximately</em>}
              </span>
              <div className="bg-meta-actions">
                <ShareControls canvasRef={liveCanvasRef} data={data} />
                <button className="bg-replot" onClick={reset}>Plot another</button>
              </div>
            </div>
          )}

          <div className="bg-stage">
            <StarMap data={data} onSelect={setSelected} selectedKey={selected?.key} canvasOutRef={liveCanvasRef} />
            {selected && <DetailPanel point={selected} onClose={() => setSelected(null)} />}
          </div>

          <div className="bg-recs">
            <RecList title="Discover new authors"
                     items={data.recommendations?.new_authors}
                     accent="rgb(120,150,255)" />
            <RecList title="More from authors you know"
                     items={data.recommendations?.familiar_authors}
                     accent="rgb(232,132,226)" />
          </div>
        </>
      )}
    </div>
  )
}
