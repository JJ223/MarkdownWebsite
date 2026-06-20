import { useState, useEffect, useRef, useMemo } from 'react'
import { Routes, Route, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeRaw from 'rehype-raw'
import BookGraph from './BookGraph.jsx'
import BookRecommend from './BookRecommend.jsx'
import './App.css'

const jsonCache = {}

function CardIndex({ src, filter }) {
  const [entries, setEntries] = useState(jsonCache[src] ?? null)
  const navigate = useNavigate()
  const touchStartY = useRef(0)
  const didScroll = useRef(false)

  useEffect(() => {
    if (jsonCache[src]) { setEntries(jsonCache[src]); return }
    fetch(`/docs/${src}`)
      .then(r => r.json())
      .then(data => { jsonCache[src] = data; setEntries(data) })
      .catch(() => setEntries([]))
  }, [src])

  if (!entries) return <div className="loading">Loading…</div>

  const isBlog = src.includes('blog')
  const displayed = filter === 'highlight' ? entries.filter(e => e.highlight) : entries

  return (
    <div>
      {displayed.map(entry => (
        <a
          key={entry.slug}
          className="project-card"
          href={`#/${entry.slug}`}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY; didScroll.current = false }}
          onTouchMove={e => { if (Math.abs(e.touches[0].clientY - touchStartY.current) > 8) didScroll.current = true }}
          onClick={e => { e.preventDefault(); if (!didScroll.current) navigate(`/${entry.slug}`) }}
        >
          <div className={`project-card-img${entry.image ? ' has-image' : ''}`}>
            {entry.image
              ? <img src={entry.image} alt={entry.title} loading="lazy" decoding="async" width="240" height="150" />
              : <><span>{isBlog ? '📝' : '📷'}</span><small>{entry.date || 'no date'}</small></>
            }
          </div>
          <div className="project-card-body">
            <h3>{entry.title}</h3>
            {(entry.org || entry.date) && (
              <div className="project-meta">{[entry.org, entry.date].filter(Boolean).join(' · ')}</div>
            )}
            {entry.description && <p>{entry.description.length > 250 ? entry.description.slice(0, 250) + '…' : entry.description}</p>}
            {entry.tags?.length > 0 && (
              <div className="tags">
                {entry.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  )
}

const mdCache = {}

function MarkdownPage({ slug }) {
  const [content, setContent] = useState(mdCache[slug] ?? null)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (mdCache[slug]) { setContent(mdCache[slug]); return }
    setContent(null)
    setError(false)
    fetch(`/docs/${slug}.md`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.text()
      })
      .then(text => { mdCache[slug] = text; setContent(text) })
      .catch(() => setError(true))
  }, [slug])

  const components = useMemo(() => ({
    a({ href, children, node, ...props }) {
      if (href && /\.md$/.test(href) && !/^https?:\/\//.test(href)) {
        const target = href.replace(/^\.\//, '').replace(/\.md$/, '')
        return (
          <a
            {...props}
            href={`#/${target}`}
            onClick={e => { e.preventDefault(); navigate(target === 'index' ? '/' : `/${target}`) }}
          >
            {children}
          </a>
        )
      }
      if (href && href.startsWith('#/')) {
        const target = href.slice(2)
        return (
          <a
            {...props}
            href={href}
            onClick={e => { e.preventDefault(); navigate(target === 'index' ? '/' : `/${target}`) }}
          >
            {children}
          </a>
        )
      }
      return <a {...props} href={href} target="_blank" rel="noreferrer">{children}</a>
    },
    cardlist({ src, filter }) {
      return <CardIndex src={src} filter={filter} />
    },
    img({ src, alt, node, ...props }) {
      return <img src={src} alt={alt} loading="lazy" decoding="async" {...props} />
    },
    p({ children, node, ...props }) {
      if (node?.children?.some(c => c.tagName === 'cardlist')) return <>{children}</>
      return <p {...props}>{children}</p>
    },
  }), [navigate])

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
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkFrontmatter]} rehypePlugins={[rehypeRaw]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  )
}

function SidebarItem({ page, depth = 0, onNavigate }) {
  const [open, setOpen] = useState(true)
  const hasChildren = page.children?.length > 0

  return (
    <li>
      <div className="sidebar-row" style={{ '--depth': depth }}>
        <button
          className={`sidebar-toggle${open ? ' open' : ''}${hasChildren ? '' : ' leaf'}`}
          onClick={() => setOpen(o => !o)}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2l4 3-4 3" />
          </svg>
        </button>
        <NavLink
          to={page.slug === 'index' ? '/' : `/${page.slug}`}
          end={page.slug === 'index'}
          onClick={onNavigate}
        >
          {page.title}
        </NavLink>
      </div>
      {hasChildren && open && (
        <ul>
          {page.children.map(child => (
            <SidebarItem key={child.slug} page={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  )
}

function SlugPage() {
  const { '*': slug } = useParams()
  return <MarkdownPage slug={slug} />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const [pages, setPages] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hamburgerVisible, setHamburgerVisible] = useState(true)
  const closeSidebar = () => setSidebarOpen(false)

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const current = window.scrollY
      if (current < 10 || current < last) setHamburgerVisible(true)
      else if (current > last + 4) setHamburgerVisible(false)
      last = current
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('/docs/manifest.json')
      .then(r => r.json())
      .then(setPages)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const prefetch = [
      'blog/index.json',
      'projects/index.json',
    ]
    prefetch.forEach(src => {
      if (jsonCache[src]) return
      fetch(`/docs/${src}`)
        .then(r => r.json())
        .then(data => { jsonCache[src] = data })
        .catch(() => {})
    })
  }, [])

  return (
    <>
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <button className={`hamburger${hamburgerVisible ? '' : ' hidden'}`} onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
        {sidebarOpen
          ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        }
      </button>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}
<div className="layout">
      <nav className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">João Jorge</div>
        <ul>
          {pages.map(p => (
            <SidebarItem key={p.slug} page={p} depth={0} onNavigate={closeSidebar} />
          ))}
        </ul>
      </nav>
      <main className="content">
        <ScrollToTop />
        <div className="content-body">
          <Routes>
            <Route path="/" element={<MarkdownPage slug="index" />} />
            <Route path="/book-plot" element={<BookGraph />} />
            <Route path="/book-recommend" element={<BookRecommend />} />
            <Route path="/*" element={<SlugPage />} />
          </Routes>
        </div>
        <div className="social-bar">
          <a className="social-bubble" href="mailto:joaojorg4@gmail.com" aria-label="Email">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </a>
          <a className="social-bubble" href="https://www.linkedin.com/in/joao-a-m-jorge/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a className="social-bubble" href="https://github.com/JJ223" target="_blank" rel="noreferrer" aria-label="GitHub">
            <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
        </div>
      </main>
      </div>
    </>
  )
}
