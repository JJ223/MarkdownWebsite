import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { LAYERS } from './bookGraphConfig.js'

function StarMap({ data, canvasOutRef }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null)
  const [visible, setVisible] = useState({ read: true, want: false, suggestions: true })
  const visibleRef = useRef(visible)
  useEffect(() => { visibleRef.current = visible }, [visible])
  const toggleLayer = (k) => setVisible(v => ({ ...v, [k]: !v[k] }))
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

    // Cosmetic jitter: real exports stack many books on near-identical coords
    // (e.g. every Harry Potter title lands on one pixel). A small fixed offset —
    // a fraction of the data range, assigned once per point — fans those stacks
    // into a readable cluster so each star is individually hoverable.
    if (out.length) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const p of out) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
      }
      const jx = Math.max(maxX - minX, 1e-3) * 0.01
      const jy = Math.max(maxY - minY, 1e-3) * 0.01
      for (const p of out) {
        p.x += (Math.random() * 2 - 1) * jx
        p.y += (Math.random() * 2 - 1) * jy
      }
    }
    return out
  }, [data])

  // Separation cues derived once in world space (projected to screen each frame):
  //  • clusters → soft nebula halos behind each detected group of read books
  //  • links    → constellation lines between near-neighbour read books
  //  • orbits   → each recommendation orbits the read book that inspired it
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

    const PALETTE = [
      { r: 150, g: 110, b: 255 }, { r: 95, g: 145, b: 255 }, { r: 230, g: 120, b: 210 },
      { r: 95, g: 200, b: 210 }, { r: 180, g: 140, b: 255 }, { r: 130, g: 120, b: 235 },
    ]
    let ci = 0
    const clusters = []
    for (const members of groups.values()) {
      if (members.length < 3) continue
      clusters.push({ members, rgb: PALETTE[ci % PALETTE.length] })
      ci++
    }

    // constellation links: within each author, draw a minimum spanning tree so
    // their titles form one constellation. Edges longer than maxLinkT are dropped.
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

    // orbits: each recommendation circles the read book named in `because_you_read`
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

  // Pre-render a soft radial halo sprite per colour (fast drawImage blits).
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
    for (const k in LAYERS) map[k] = make(LAYERS[k].rgb)
    map._white = make({ r: 235, g: 225, b: 255 })
    return map
  }, [])

  const bgStars = useRef([])

  const fitView = useCallback((W, H) => {
    if (!points.length) return
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
      const rect = wrap.getBoundingClientRect()
      W = rect.width; H = rect.height
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
      fitView(W, H)
    }

    const norm = s => (s || '').trim().toLowerCase()
    const keyMap = new Map(points.map(p => [p.key, p]))

    const FOCUS_FADE = 0.75
    // Hover intent: only engage focus dimming once the pointer has rested
    const HOVER_DELAY = 0.25
    let lastMoveAt = 0
    let focusAmt = 0, prevT = 0, lastAuthor = null, lastKeys = null

    const orbitAng = new Map()
    for (const [k, orb] of structure.orbits) orbitAng.set(k, orb.phase)

    const worldPos = (p) => {
      const orb = structure.orbits.get(p.key)
      if (!orb) return [p.x, p.y]
      const ang = orbitAng.has(p.key) ? orbitAng.get(p.key) : orb.phase
      // Scale y offset by x/y base-scale ratio so the path is a true circle on screen
      const ratio = baseScale.current.x / baseScale.current.y
      return [orb.sx + orb.r * Math.cos(ang), orb.sy - orb.r * ratio * Math.sin(ang)]
    }
    const screenPos = (p) => { const [wx, wy] = worldPos(p); return worldToScreen(wx, wy, W, H) }

    const draw = (t) => {
      const time = t / 1000
      const hp = hoverRef.current ? keyMap.get(hoverRef.current) : null
      const hoverOrbit = hp && hp.layer === 'suggestions' ? structure.orbits.get(hp.key) : null
      const settled = (time - lastMoveAt) >= HOVER_DELAY
      let focusAuthor = null, focusKeys = null
      if (settled && hp && hp.layer === 'read' && hp.author) focusAuthor = norm(hp.author)
      else if (settled && hoverOrbit) focusKeys = new Set([hp.key, hoverOrbit.srcKey])
      else if (settled && hp && hp.layer === 'want') focusKeys = new Set([hp.key])
      if (!prevT) prevT = time
      const dt = Math.min(time - prevT, 0.05); prevT = time
      if (!reduceMotion) {
        for (const [k, orb] of structure.orbits) {
          if (k === hoverRef.current) continue
          orbitAng.set(k, orbitAng.get(k) + dt * orb.speed)
        }
      }
      const target = (focusAuthor || focusKeys) ? 1 : 0
      const step = dt / FOCUS_FADE
      focusAmt += Math.max(-step, Math.min(step, target - focusAmt))
      if (focusAuthor) { lastAuthor = focusAuthor; lastKeys = null }
      else if (focusKeys) { lastKeys = focusKeys; lastAuthor = null }
      const active = focusAmt > 0.001
      const fAuthor = focusAuthor || (active ? lastAuthor : null)
      const fKeys = focusKeys || (active ? lastKeys : null)

      const bg = ctx.createRadialGradient(W * 0.4, H * 0.35, 0, W * 0.4, H * 0.35, Math.max(W, H) * 0.8)
      bg.addColorStop(0, '#140d24')
      bg.addColorStop(0.55, '#0a0616')
      bg.addColorStop(1, '#050208')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1

      // cluster halos
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

      // constellation lines
      if (visibleRef.current.read && structure.links.length) {
        const stroke = (filter, style, width) => {
          ctx.strokeStyle = style; ctx.lineWidth = width
          ctx.beginPath()
          for (const [a, b] of structure.links) {
            if (filter && !filter(a)) continue
            const [ax, ay] = worldToScreen(a.x, a.y, W, H)
            const [bx, by] = worldToScreen(b.x, b.y, W, H)
            ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
          }
          ctx.stroke()
        }
        if ((!fAuthor && !fKeys) || focusAmt < 0.001) {
          stroke(null, 'rgba(190,170,255,0.42)', 1.9)
        } else {
          const lerp = (a, b) => a + (b - a) * focusAmt
          stroke(a => norm(a.author) !== fAuthor, `rgba(178,158,255,${lerp(0.42, 0.08)})`, lerp(1.9, 1.2))
          if (fAuthor) stroke(a => norm(a.author) === fAuthor, `rgba(210,194,255,${lerp(0.42, 0.85)})`, lerp(1.9, 2.6))
        }
      }

      // orbit outline while hovering a recommendation
      if (hoverOrbit && visibleRef.current.suggestions) {
        const [cx, cy] = worldToScreen(hoverOrbit.sx, hoverOrbit.sy, W, H)
        const R = hoverOrbit.r * baseScale.current.x * view.current.z
        ctx.strokeStyle = `rgba(150,170,255,${0.5 * focusAmt})`
        ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
      }

      // data points
      const zoom = view.current.z
      const sizeFade = Math.max(0.5, Math.min(zoom, 2.6))
      const dimFade = 0.52 * (0.78 + 0.22 * Math.min(zoom, 1))
      const coreFade = Math.max(0.7, Math.min(zoom, 1.8))
      for (const p of points) {
        if (!visibleRef.current[p.layer]) continue
        const isRec = p.layer === 'suggestions'
        const [sx, sy] = screenPos(p)
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
        const tw = reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(time * 1.4 + p.phase)
        const inFocus = (fAuthor && p.layer === 'read' && norm(p.author) === fAuthor) ||
          (fKeys && fKeys.has(p.key))
        const focusMul = inFocus ? 1 : 1 - 0.74 * focusAmt
        const { r, g, b } = LAYERS[p.layer].rgb

        if (p.layer === 'want') {
          const tws = reduceMotion ? 0.7 : 0.45 + 0.35 * Math.sin(time * 1.1 + p.phase)
          const rr = 1.7 * coreFade
          const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * 2.8)
          gl.addColorStop(0, `rgba(${r},${g},${b},0.5)`)
          gl.addColorStop(0.5, `rgba(${r},${g},${b},0.14)`)
          gl.addColorStop(1, `rgba(${r},${g},${b},0)`)
          ctx.globalAlpha = (0.55 + tws * 0.45) * focusMul
          ctx.fillStyle = gl
          ctx.beginPath(); ctx.arc(sx, sy, rr * 2.8, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = (0.6 + tws * 0.4) * focusMul
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.fill()
          continue
        }

        const d = (isRec ? 6.4 : p.size) * (isRec ? 2.5 : 2.6) * sizeFade
        ctx.globalAlpha = tw * dimFade * focusMul
        ctx.drawImage(sprites[p.layer], sx - d, sy - d, d * 2, d * 2)
        const cr = (isRec ? 2.6 : p.size * 0.56) * coreFade
        ctx.globalAlpha = Math.min(1, tw + 0.1) * 0.72 * focusMul
        const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, cr)
        cg.addColorStop(0, `rgb(${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 38, 255)})`)
        cg.addColorStop(0.55, `rgb(${Math.min(r + 20, 255)},${Math.min(g + 20, 255)},${Math.min(b + 10, 255)})`)
        cg.addColorStop(1, `rgb(${Math.round(r * 0.88)},${Math.round(g * 0.88)},${Math.round(b * 0.88)})`)
        ctx.fillStyle = cg
        ctx.beginPath(); ctx.arc(sx, sy, cr, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1

      // hover emphasis ring
      for (const p of points) {
        if (!visibleRef.current[p.layer]) continue
        if (hoverRef.current !== p.key) continue
        const isRec = p.layer === 'suggestions'
        const [sx, sy] = screenPos(p)
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
        ctx.beginPath()
        ctx.arc(sx, sy, isRec ? 9 : p.size * 1.7 + 3, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'
        ctx.lineWidth = 1.4
        ctx.stroke()
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
        if (!visibleRef.current[p.layer]) continue
        const isRec = p.layer === 'suggestions'
        const [sx, sy] = screenPos(p)
        const d = Math.hypot(sx - mx, sy - my)
        const hit = isRec ? 14 : p.size * 1.8 + 6
        if (d < hit && d < bestD) { bestD = d; best = { p, sx, sy } }
      }
      return best
    }

    const onMove = (e) => {
      lastMoveAt = performance.now() / 1000
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
      setHover(found ? { point: found.p, sx: found.sx, sy: found.sy, W } : null)
    }
    const onDown = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
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
      // Normalise across input devices: trackpads emit many small pixel deltas,
      // mouse wheels emit a few large line/page deltas
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
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      if (canvasOutRef) canvasOutRef.current = null
    }
  }, [points, structure, sprites, worldToScreen, fitView, reduceMotion, canvasOutRef])

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
          {hover.point.layer === 'read' && hover.point.rating > 0 && (
            <span className="bg-tt-sub">{'★'.repeat(hover.point.rating)}</span>
          )}
          {hover.point.layer === 'want' && <span className="bg-tt-sub">want to read</span>}
          {(hover.point.layer === 'suggestions') && (
            <span className="bg-tt-sub">match {hover.point.score?.toFixed(2)}</span>
          )}
        </div>
        )
      })()}
    </div>
  )
}

export default StarMap
