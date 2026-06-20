import { USE_MOCK } from './bookGraphConfig.js'
import { SAMPLE_PLOT, SAMPLE_CORPUS } from '../bookGraphSample.js'

const MOCK_BOOK_DB = [
  { id: 'dune-1',        title: 'Dune',                                    author: 'Frank Herbert'      },
  { id: 'foundation-1',  title: 'Foundation',                              author: 'Isaac Asimov'       },
  { id: 'hyperion-1',    title: 'Hyperion',                                author: 'Dan Simmons'        },
  { id: 'neuromancer-1', title: 'Neuromancer',                             author: 'William Gibson'     },
  { id: 'ender-1',       title: "Ender's Game",                            author: 'Orson Scott Card'   },
  { id: 'hitchhiker-1',  title: "The Hitchhiker's Guide to the Galaxy",    author: 'Douglas Adams'      },
  { id: 'lotr-1',        title: 'The Lord of the Rings',                   author: 'J.R.R. Tolkien'     },
  { id: 'hp-1',          title: "Harry Potter and the Philosopher's Stone", author: 'J.K. Rowling'      },
  { id: 'mistborn-1',    title: 'Mistborn: The Final Empire',              author: 'Brandon Sanderson'  },
  { id: 'name-1',        title: 'The Name of the Wind',                    author: 'Patrick Rothfuss'   },
]
const MOCK_SIMILAR = {
  seed: { title: 'Dune', author: 'Frank Herbert', in_index: true, source: 'index' },
  same_author: [
    { title: 'Dune Messiah',        author: 'Frank Herbert', genre: 'Science Fiction', score: 0.921 },
    { title: 'Children of Dune',    author: 'Frank Herbert', genre: 'Science Fiction', score: 0.884 },
    { title: 'God Emperor of Dune', author: 'Frank Herbert', genre: 'Science Fiction', score: 0.847 },
  ],
  different_authors: [
    { title: 'Foundation',                author: 'Isaac Asimov',       genre: 'Science Fiction', score: 0.712 },
    { title: 'Hyperion',                  author: 'Dan Simmons',        genre: 'Science Fiction', score: 0.688 },
    { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', genre: 'Science Fiction', score: 0.671 },
    { title: 'Neuromancer',               author: 'William Gibson',     genre: 'Science Fiction', score: 0.654 },
    { title: "Ender's Game",              author: 'Orson Scott Card',   genre: 'Science Fiction', score: 0.641 },
  ],
}

export async function plotBooks(file, signal) {
  if (USE_MOCK) {
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

export async function searchBooks(q) {
  if (!q.trim()) return []
  const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}&limit=8`)
  return res.ok ? res.json() : []
}

export async function fetchSimilarById(id) {
  const res = await fetch(`/api/books/similar?id=${encodeURIComponent(id)}&n_same=5&n_diff=10`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchSimilarByText(q) {
  const res = await fetch(`/api/books/similar?${new URLSearchParams({ q, n_same: 5, n_diff: 10 })}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchCorpus() {
  if (USE_MOCK) {
    // Use Large.json's read books — a different library that spreads across the full
    // UMAP space — so the faded reference layer is visible behind the user's own stars.
    await new Promise(r => setTimeout(r, 200))
    return SAMPLE_CORPUS
  }
  const res = await fetch('/api/books/corpus')
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  if (!data) return null
  // Accept: array directly, { points }, or { books }
  if (Array.isArray(data)) return data
  if (Array.isArray(data.points)) return data.points
  if (Array.isArray(data.books)) return data.books
  return null
}
