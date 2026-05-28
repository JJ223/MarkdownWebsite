# Contact Page Redesign & Global Social Bottom Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the contact page's plain markdown table with styled icon rows, and add three floating social-link bubbles that appear site-wide when the user scrolls to the bottom of any page.

**Architecture:** `contact.md` uses raw HTML (rendered via `rehype-raw`) for the new rows — no React component needed. The sticky bar lives in `App.jsx` as fixed-position markup controlled by an `IntersectionObserver` watching a sentinel `<div>` at the end of `<main>`. All visual styles go in `App.css`.

**Tech Stack:** React 18, Vite, `rehype-raw` (already installed), vanilla `IntersectionObserver` API, inline SVGs.

---

## File Map

| File | Change |
|------|--------|
| `src/App.css` | Add `.contact-*` and `.social-bar` / `.social-bubble` classes |
| `src/App.jsx` | Add `useRef` import, sentinel div, social bar markup + observer |
| `public/docs/contact.md` | Replace markdown table with HTML contact rows |

---

### Task 1: Add CSS — contact rows and social bar

**Files:**
- Modify: `src/App.css` (append at end)

- [ ] **Step 1: Append contact-row classes to `src/App.css`**

Add this block at the very end of the file:

```css
/* ── Contact rows ───────────────────────────────────── */

.contact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contact-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--table-border);
  background: var(--code-bg);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s;
}

.contact-row:hover {
  border-color: var(--accent-hover);
}

.contact-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #533a7a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.contact-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 2px;
}

.contact-value {
  font-size: 13px;
  color: var(--link);
}

.contact-value-plain {
  font-size: 13px;
  color: var(--text);
}

.contact-arrow {
  margin-left: auto;
  color: var(--muted);
  font-size: 13px;
}

/* ── Social bar ─────────────────────────────────────── */

.social-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(12px);
  display: flex;
  gap: 14px;
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s, transform 0.3s;
}

.social-bar.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}

.social-bubble {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #533a7a;
  box-shadow: 0 2px 12px rgba(83, 58, 122, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: background 0.2s;
}

.social-bubble:hover {
  background: var(--accent-hover);
}
```

- [ ] **Step 2: Start dev server and confirm no errors**

```bash
npm run dev
```

Expected: server starts on `http://localhost:5173` (or next available port), no compile errors in terminal.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "style: add contact-row and social-bar CSS classes"
```

---

### Task 2: Wire up the social bar in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `useRef` to the React import**

Change line 1 from:
```jsx
import { useState, useEffect } from 'react'
```
to:
```jsx
import { useState, useEffect, useRef } from 'react'
```

- [ ] **Step 2: Add `socialVisible` state and sentinel observer to the `App` component**

Inside `export default function App()`, after the existing `const [pages, setPages] = useState([])` line, add:

```jsx
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
```

- [ ] **Step 3: Add sentinel div at the end of `<main>` and the social bar markup after `</div>` (layout close)**

The current `return` in `App` ends with:
```jsx
      <main className="content">
        <Routes>
          <Route path="/" element={<MarkdownPage slug="index" />} />
          <Route path="/*" element={<SlugPage />} />
        </Routes>
      </main>
      </div>
    </>
```

Replace that closing section with:
```jsx
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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#c4aee8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M2 7l10 7 10-7"/>
          </svg>
        </a>
        <a className="social-bubble" href="https://www.linkedin.com/in/jo%C3%A3o-a-m-jorge/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#c4aee8">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </a>
        <a className="social-bubble" href="https://github.com/JJ223" target="_blank" rel="noreferrer" aria-label="GitHub">
          <svg viewBox="0 0 16 16" width="20" height="20" fill="#c4aee8">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </div>
    </>
```

- [ ] **Step 4: Verify in browser**

Open any page in the dev server. Scroll to the very bottom — the three purple bubbles should fade up into view. Scroll back up — they should disappear. Check all three links open correctly (email client, LinkedIn tab, GitHub tab).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add sticky social bar that appears on scroll to bottom"
```

---

### Task 3: Redesign contact.md with HTML rows

**Files:**
- Modify: `public/docs/contact.md`

- [ ] **Step 1: Replace the entire file content**

```markdown
# 📬 Contact

I'm always open to interesting conversations about software engineering, autonomous systems, and drone or automotive technology.

---

## Get in Touch

<div class="contact-list">

<a class="contact-row" href="mailto:joaojorg4@gmail.com">
  <div class="contact-icon">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c4aee8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
  </div>
  <div>
    <div class="contact-label">Email</div>
    <div class="contact-value">joaojorg4@gmail.com</div>
  </div>
  <span class="contact-arrow">→</span>
</a>

<a class="contact-row" href="https://www.linkedin.com/in/jo%C3%A3o-a-m-jorge/" target="_blank" rel="noreferrer">
  <div class="contact-icon">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#c4aee8"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  </div>
  <div>
    <div class="contact-label">LinkedIn</div>
    <div class="contact-value">linkedin.com/in/joão-a-m-jorge</div>
  </div>
  <span class="contact-arrow">→</span>
</a>

<a class="contact-row" href="https://github.com/JJ223" target="_blank" rel="noreferrer">
  <div class="contact-icon">
    <svg viewBox="0 0 16 16" width="18" height="18" fill="#c4aee8"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
  </div>
  <div>
    <div class="contact-label">GitHub</div>
    <div class="contact-value">github.com/JJ223</div>
  </div>
  <span class="contact-arrow">→</span>
</a>

<div class="contact-row" style="cursor: default;">
  <div class="contact-icon">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c4aee8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
  </div>
  <div>
    <div class="contact-label">Location</div>
    <div class="contact-value-plain">Lisbon, Portugal</div>
  </div>
</div>

</div>

---

[Experience](./experience.md) · [Projects](./projects.md) · [Back to Home](./index.md)
```

- [ ] **Step 2: Verify in browser**

Navigate to the Contact page in the dev server. You should see four rows with purple square icon badges, SVG icons in `#c4aee8`, label text above value text, and `→` arrows on the three clickable rows. The location row has no arrow and no hover effect. Clicking Email opens the mail client; LinkedIn and GitHub open in new tabs.

- [ ] **Step 3: Commit**

```bash
git add public/docs/contact.md
git commit -m "feat: redesign contact page with icon rows and SVG logos"
```
