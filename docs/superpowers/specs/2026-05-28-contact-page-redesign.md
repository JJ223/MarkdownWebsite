# Contact Page Redesign & Global Social Bottom Bar

**Date:** 2026-05-28  
**Status:** Approved

## Overview

Two complementary changes to the portfolio site:

1. **Contact page** — replace the plain markdown table with a styled warm-list of clickable contact rows, each with an icon badge, label, and arrow indicator.
2. **Global sticky bottom bar** — three floating circular icon bubbles (email, LinkedIn, GitHub) that fade in when the user scrolls to the bottom of any page, implemented in React so it works across all routes.

---

## Contact Page (`public/docs/contact.md`)

### Layout

- Keep the existing intro paragraph and heading.
- Replace the markdown table with four custom HTML rows using a `<div class="contact-list">` wrapper.
- Each row: a square icon badge (36×36px, border-radius 8px, background `#533a7a`) + label/value text block + `→` arrow.
- Location row is non-clickable (no `<a>` tag, no arrow).

### Icons (all SVG, color `#c4aee8`)

| Row | Icon |
|-----|------|
| Email | Outlined envelope (`stroke`, not `fill`) |
| LinkedIn | Filled LinkedIn `in` mark |
| GitHub | Filled GitHub Octocat mark |
| Location | Outlined map pin (`stroke`) |

### Hover state

- Border color transitions to `var(--accent-hover)` on hover for clickable rows.
- No transform/lift needed (keeps it subtle).

### CSS

New classes added to `App.css`:
- `.contact-list` — flex column, gap 8px
- `.contact-row` — flex row, align-items center, gap 12px, padding 12px 16px, border-radius 8px, border `1px solid var(--table-border)`, background `var(--code-bg)`, text-decoration none, color inherit, transition border-color 0.2s
- `.contact-row:hover` — border-color `var(--accent-hover)`
- `.contact-icon` — 36×36px square badge
- `.contact-label` — uppercase 10px label
- `.contact-value` — 13px link-colored text
- `.contact-arrow` — margin-left auto, muted color

---

## Global Sticky Bottom Bar (`src/App.jsx`)

### Behavior

- A `<div class="social-bar">` rendered inside `App`, positioned fixed at `bottom: 0`, centered horizontally.
- Hidden by default (`opacity: 0`, `transform: translateY(12px)`, `pointer-events: none`).
- An `IntersectionObserver` watches a sentinel `<div>` placed at the very end of `.content main` (after `<Routes>`). When the sentinel enters the viewport, the bar transitions to visible. When it leaves, it hides again.
- Appears on **all pages** site-wide (including the contact page itself — it's unobtrusive enough).

### Contents

Three circular anchor buttons, 44×44px, border-radius 50%, background `#533a7a`, box-shadow `0 2px 12px rgba(83,58,122,0.5)`, gap 14px:

| Button | Links to |
|--------|----------|
| Email SVG | `mailto:joaojorg4@gmail.com` |
| LinkedIn SVG | LinkedIn profile URL |
| GitHub SVG | `https://github.com/JJ223` |

### CSS

New classes in `App.css`:
- `.social-bar` — fixed, bottom 24px, left 50%, transform translateX(-50%), display flex, gap 14px, z-index 100, opacity 0, translateY 12px, pointer-events none, transition opacity 0.3s + transform 0.3s
- `.social-bar.visible` — opacity 1, translateY(0), pointer-events auto
- `.social-bubble` — 44×44px circle, background `#533a7a`, box-shadow, display flex center, text-decoration none, transition background 0.2s
- `.social-bubble:hover` — background `var(--accent-hover)`

### Implementation notes

- The sentinel div sits inside `<main className="content">` just after `<Routes>`, so it scrolls with page content.
- Observer threshold: `0` (fires as soon as any part of sentinel is visible).
- No dependencies needed — uses native `IntersectionObserver`.

---

## Files Changed

| File | Change |
|------|--------|
| `public/docs/contact.md` | Replace table with HTML contact rows |
| `src/App.jsx` | Add `SocialBar` component + sentinel div |
| `src/App.css` | Add `.contact-*` and `.social-bar` / `.social-bubble` classes |
