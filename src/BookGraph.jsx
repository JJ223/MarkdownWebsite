import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { USE_MOCK, STEPS } from './bookGraph/bookGraphConfig.js'
import { plotBooks, fetchCorpus } from './bookGraph/bookGraphApi.js'
import StarMap from './bookGraph/BookGraphStarMap.jsx'
import DetailPanel from './bookGraph/BookGraphDetail.jsx'
import RecList from './bookGraph/BookGraphRecList.jsx'
import Dropzone from './bookGraph/BookGraphDropzone.jsx'
import Loader from './bookGraph/BookGraphLoader.jsx'
import ShareControls from './bookGraph/BookGraphShare.jsx'
import './BookGraph.css'

const CORPUS_THRESHOLD = 1000 // fetch reference map for smaller libraries

export default function BookGraph() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('idle')      // idle | loading | done | error
  const [data, setData] = useState(null)
  const [corpus, setCorpus] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState(STEPS[0])
  const [pct, setPct] = useState(0)
  const [health, setHealth] = useState(USE_MOCK ? 'ok' : 'checking') // checking | ok | warming | unknown
  const abortRef = useRef(null)
  const liveCanvasRef = useRef(null)
  const stageRef = useRef(null)

  // Scroll to the map once it finishes loading
  useEffect(() => {
    if (phase !== 'done') return
    const id = requestAnimationFrame(() =>
      stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    )
    return () => cancelAnimationFrame(id)
  }, [phase])

  // Readiness check (graceful: never hard-block if the endpoint is absent)
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
    setPhase('loading'); setError('')
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
        // Fetch reference corpus for small libraries so the user can see the
        // broader map as a faded backdrop (toggled on by default in StarMap)
        if ((d.meta?.read_count ?? Infinity) < CORPUS_THRESHOLD) {
          fetchCorpus()
            .then(pts => { if (pts?.length) setCorpus(pts) })
            .catch(() => {})
        }
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
    setPhase('idle'); setData(null); setCorpus(null); setSelected(null); setError('')
  }

  const meta = data?.meta
  const uploadDisabled = phase === 'loading' || health === 'warming'

  return (
    <div className="bookgraph">
      <header className="bg-head">
        <button className="bg-back" onClick={() => navigate('/projects')}>← Projects</button>
        <h1>Book Plot</h1>
        <p className="bg-tagline">
          A star-map of your reading. Upload your Goodreads export and watch your
          library bloom into constellations — then follow the dimmer stars toward
          your next read.
        </p>
      </header>

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

          <div className="bg-stage" ref={stageRef}>
            <StarMap data={data} corpus={corpus} canvasOutRef={liveCanvasRef}
                     onSelect={setSelected} selectedKey={selected?.key} />
          </div>
          {corpus && corpus.length > 0 && (
            <p className="bg-corpus-note">
              The faded background stars are a reference map of the wider literary world.
              They show where books beyond your library sit in taste-space, so you can
              see which corners of the map you've explored and which lie just beyond your horizon.
              Toggle <em>Reference map</em> in the legend to show or hide them.
            </p>
          )}
          {selected && (
            <DetailPanel point={selected} onClose={() => setSelected(null)} />
          )}

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
