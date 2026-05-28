import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeRaw from 'rehype-raw'
import './App.css'

function CardIndex({ src, filter }) {
  const [entries, setEntries] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`/docs/${src}`)
      .then(r => r.json())
      .then(setEntries)
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
          onClick={e => { e.preventDefault(); navigate(`/${entry.slug}`) }}
        >
          <div className={`project-card-img${entry.image ? ' has-image' : ''}`}>
            {entry.image
              ? <img src={entry.image} alt={entry.title} />
              : <><span>{isBlog ? '📝' : '📷'}</span><small>{entry.date || 'no date'}</small></>
            }
          </div>
          <div className="project-card-body">
            <h3>{entry.title}</h3>
            {(entry.org || entry.date) && (
              <div className="project-meta">{[entry.org, entry.date].filter(Boolean).join(' · ')}</div>
            )}
            {entry.description && <p>{entry.description}</p>}
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
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkFrontmatter]} rehypePlugins={[rehypeRaw]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  )
}

function SidebarItem({ page, depth = 0 }) {
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
        >
          {page.title}
        </NavLink>
      </div>
      {hasChildren && open && (
        <ul>
          {page.children.map(child => (
            <SidebarItem key={child.slug} page={child} depth={depth + 1} />
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

export default function App() {
  const [pages, setPages] = useState([])
  const [socialVisible, setSocialVisible] = useState(false)
  const sentinelRef = useRef(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setSocialVisible(entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    fetch('/docs/manifest.json')
      .then(r => r.json())
      .then(setPages)
      .catch(() => {})
  }, [])

  return (
    <>
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-brand">João Jorge</div>
        <ul>
          {pages.map(p => (
            <SidebarItem key={p.slug} page={p} depth={0} />
          ))}
        </ul>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<MarkdownPage slug="index" />} />
          <Route path="/*" element={<SlugPage />} />
        </Routes>
        <div ref={sentinelRef} style={{ height: 1 }} />
      </main>
      </div>
      <div className={`social-bar${socialVisible ? ' visible' : ''}`}>
        <a className="social-bubble" href="mailto:joaojorg4@gmail.com" aria-label="Email">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M2 7l10 7 10-7"/>
          </svg>
        </a>
        <a className="social-bubble" href="https://www.linkedin.com/in/jo%C3%A3o-a-m-jorge/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
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
    </>
  )
}
