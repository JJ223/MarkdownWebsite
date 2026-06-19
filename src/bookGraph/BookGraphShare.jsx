import { useState, useEffect, useRef, useCallback } from 'react'
import './BookGraphShare.css'

export default function ShareControls({ canvasRef, data }) {
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

  const pageUrl = `${location.origin}${location.pathname}#/book-plot`
  const shareText = 'I turned my Goodreads history into a galaxy of books with Book Plot'

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
    const scale = Math.max(W / live.width, H / live.height)
    const dw = live.width * scale, dh = live.height * scale
    try { g.drawImage(live, (W - dw) / 2, (H - dh) / 2, dw, dh) } catch { /* ignore */ }
    const vg = g.createLinearGradient(0, 0, 0, H)
    vg.addColorStop(0, 'rgba(5,2,8,0.82)'); vg.addColorStop(0.24, 'rgba(5,2,8,0)')
    vg.addColorStop(0.76, 'rgba(5,2,8,0)'); vg.addColorStop(1, 'rgba(5,2,8,0.9)')
    g.fillStyle = vg; g.fillRect(0, 0, W, H)
    try { await document.fonts.load('600 46px Fraunces'); await document.fonts.ready } catch { /* font optional */ }
    g.textBaseline = 'alphabetic'
    g.fillStyle = '#e9dcff'
    g.font = '600 46px Fraunces, Georgia, serif'
    g.fillText('Book Plot', 50, 80)
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
    a.download = 'book-plot.png'
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
    const file = new File([blob], 'book-plot.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'My Book Plot', text: shareText }) }
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

  const onLinkedIn = () => withBusy(async () => {
    const blob = await buildBlob()
    let hint = ''
    if (blob) { try { await copyBlob(blob); hint = ' Image copied — paste it into the post.' } catch { /* paste optional */ } }
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
      '_blank', 'noopener,noreferrer'
    )
    flash(`Opening LinkedIn.${hint}`); setOpen(false)
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
            Share on LinkedIn<small>image copied to paste in</small>
          </button>
        </div>
      )}

      {toast && <div className="bg-toast" role="status">{toast}</div>}
    </div>
  )
}
