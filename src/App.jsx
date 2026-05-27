import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

function MarkdownPage({ slug }) {
  const [content, setContent] = useState(null)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setContent(null)
    setError(false)
    fetch(`/docs/${slug}.md`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.text()
      })
      .then(setContent)
      .catch(() => setError(true))
  }, [slug])

  const components = {
    a({ href, children }) {
      if (href && /\.md$/.test(href)) {
        const target = href.replace(/^\.\//, '').replace(/\.md$/, '')
        return (
          <a
            href={`#/${target}`}
            onClick={e => { e.preventDefault(); navigate(target === 'index' ? '/' : `/${target}`) }}
          >
            {children}
          </a>
        )
      }
      return <a href={href} target="_blank" rel="noreferrer">{children}</a>
    },
  }

  if (error) {
    return (
      <div className="not-found">
        <h1>404</h1>
        <p>No page found for <code>{slug}</code>.</p>
        <p>Add <code>public/docs/{slug}.md</code> and register it in <code>manifest.json</code>.</p>
      </div>
    )
  }

  if (content === null) {
    return <div className="loading">Loading…</div>
  }

  return (
    <article className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  )
}

function SlugPage() {
  const { slug } = useParams()
  return <MarkdownPage slug={slug} />
}

export default function App() {
  const [pages, setPages] = useState([])

  useEffect(() => {
    fetch('/docs/manifest.json')
      .then(r => r.json())
      .then(setPages)
      .catch(() => {})
  }, [])

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-brand">Docs</div>
        <ul>
          {pages.map(p => (
            <li key={p.slug}>
              <NavLink
                to={p.slug === 'index' ? '/' : `/${p.slug}`}
                end={p.slug === 'index'}
              >
                {p.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<MarkdownPage slug="index" />} />
          <Route path="/:slug" element={<SlugPage />} />
        </Routes>
      </main>
    </div>
  )
}
