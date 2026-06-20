import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchBooks, fetchSimilarById, fetchSimilarByText } from './bookGraph/bookGraphApi.js'
import './BookRecommend.css'

function SimilarList({ title, items, accent }) {
  if (!items?.length) return null
  return (
    <div className="br-reclist">
      <h4 style={{ '--c': accent }}>{title}</h4>
      <ol>
        {items.map((r, i) => (
          <li key={i}>
            <span className="br-rec-rank">{i + 1}</span>
            <span className="br-rec-body">
              <b>{r.title}</b>
              <span className="br-rec-author">{r.author}{r.genre ? ` · ${r.genre}` : ''}</span>
            </span>
            <span className="br-rec-score" title="Similarity match score">{(r.score * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function BookRecommend() {
  const navigate = useNavigate()
  const [query, setQuery]           = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeIdx, setActiveIdx]   = useState(-1)
  const [picked, setPicked]         = useState(false)
  const [result, setResult]         = useState(null)
  const [loading, setLoading]       = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]           = useState('')
  const debounceRef  = useRef(null)
  const slowTimer    = useRef(null)
  const inputRef     = useRef(null)
  const dropdownRef  = useRef(null)

  const clearAll = () => {
    setQuery(''); setSuggestions([]); setPicked(false); setResult(null); setError('')
    inputRef.current?.focus()
  }

  // Debounced autocomplete
  const onInput = useCallback((e) => {
    const q = e.target.value
    setQuery(q)
    setPicked(false)
    setResult(null)
    setActiveIdx(-1)
    clearTimeout(debounceRef.current)
    if (!q.trim()) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      const hits = await searchBooks(q)
      setSuggestions(hits)
    }, 200)
  }, [])

  const runFetch = useCallback(async (fetchFn, isOnline = false) => {
    setSuggestions([])
    setPicked(true)
    setActiveIdx(-1)
    setError('')
    setResult(null)
    setLoading(true)
    setLoadingMsg('Finding recommendations…')
    clearTimeout(slowTimer.current)
    if (isOnline) {
      slowTimer.current = setTimeout(
        () => setLoadingMsg('Looking this up online — this may take a moment…'),
        3000
      )
    }
    try {
      const data = await fetchFn()
      if (!data) throw new Error('No results returned.')
      setResult(data)
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      clearTimeout(slowTimer.current)
      setLoading(false)
    }
  }, [])

  // Pick from dropdown (known id)
  const pick = useCallback((book) => {
    setQuery(book.title)
    runFetch(() => fetchSimilarById(book.id), false)
  }, [runFetch])

  // Free-text search for books not in the index
  const searchFreeText = useCallback(() => {
    if (!query.trim()) return
    runFetch(() => fetchSimilarByText(query), true)
  }, [query, runFetch])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length))  // +1 to include fallback row
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && activeIdx < suggestions.length) pick(suggestions[activeIdx])
      else if (activeIdx === suggestions.length || !suggestions.length) searchFreeText()
    } else if (e.key === 'Escape') {
      setSuggestions([]); setActiveIdx(-1)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (!dropdownRef.current?.contains(e.target) && e.target !== inputRef.current)
        setSuggestions([])
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const showDropdown = !picked && (suggestions.length > 0 || !!query.trim())

  return (
    <div className="bookrec">
      <header className="br-head">
        <button className="br-back" onClick={() => navigate('/projects')}>← Projects</button>
        <h1>Book Recommendations</h1>
        <p className="br-tagline">
          Search for a book you love and discover what to read next —
          more from the same author and new voices in the same universe.
        </p>
      </header>

      <div className="br-search-wrap">
        <div className="br-search-box">
          <svg className="br-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            className="br-search-input"
            type="text"
            placeholder="Search for a book…"
            value={query}
            onChange={onInput}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
            aria-label="Book search"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
          />
          {query && (
            <button className="br-search-clear" onClick={clearAll} aria-label="Clear search">✕</button>
          )}
        </div>

        {showDropdown && (
          <ul ref={dropdownRef} className="br-dropdown" role="listbox">
            {suggestions.map((b, i) => (
              <li key={b.id} role="option" aria-selected={i === activeIdx}
                className={`br-dropdown-item${i === activeIdx ? ' active' : ''}`}
                onMouseDown={() => pick(b)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="br-dd-title">{b.title}</span>
                <span className="br-dd-author">{b.author}</span>
              </li>
            ))}
            <li role="option" aria-selected={activeIdx === suggestions.length}
              className={`br-dropdown-item br-dropdown-fallback${activeIdx === suggestions.length ? ' active' : ''}`}
              onMouseDown={searchFreeText}
              onMouseEnter={() => setActiveIdx(suggestions.length)}
            >
              Search for <em>"{query}"</em> directly →
            </li>
          </ul>
        )}
      </div>

      {loading && (
        <div className="br-loading">
          <div className="br-spinner" />
          <span>{loadingMsg}</span>
        </div>
      )}

      {error && (
        <div className="br-error">
          <p>{error}</p>
          <button onClick={clearAll}>Try again</button>
        </div>
      )}

      {result && (
        <div className="br-results">
          <div className="br-seed">
            <span className="br-seed-label">Recommendations based on</span>
            <strong>{result.seed.title}</strong>
            <span>by {result.seed.author}</span>
            {result.seed.source === 'online' && (
              <span className="br-seed-note">matched via online lookup</span>
            )}
          </div>
          <div className="br-recs">
            <SimilarList
              title={`More by ${result.seed.author}`}
              items={result.same_author}
              accent="rgb(232,132,226)"
            />
            <SimilarList
              title="Discover new authors"
              items={result.different_authors}
              accent="rgb(120,150,255)"
            />
          </div>
        </div>
      )}
    </div>
  )
}
