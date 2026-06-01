# Hero Photo — Design Spec

**Date:** 2026-06-01  
**Status:** Approved

## Goal

Add a personal photo to the home page so visitors immediately see who João is.

## Decision

Photo sits **below** the hero description and CTA links, displayed as a **full-width banner** with rounded corners. It is the last element in the hero section.

## Implementation

### File: `public/docs/index.md`

1. Add a `.hero-photo` div after the `.hero-cta` div:

```html
<div class="hero-photo">
  <img src="/docs/about/DuckPhoto.jpeg" alt="João Jorge" />
</div>
```

2. Add CSS for `.hero-photo` inside the existing `<style>` block at the top of the file:

```css
.hero-photo {
  margin-top: 40px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--table-border);
  opacity: 0;
  animation: h-up 0.5s ease-out 4.2s forwards;
}
.hero-photo img {
  width: 100%;
  height: 280px;
  object-fit: cover;
  object-position: top;
  display: block;
}
```

### No other files change

- `App.jsx` — no changes
- `App.css` — no changes
- The image `/docs/about/DuckPhoto.jpeg` already exists in the repo

## Constraints

- Animation reuses the existing `h-up` keyframe already defined in the page; delay of 4.2s places it after the CTA links (which fade in at 3.7s).
- `object-position: top` ensures the face is visible when the image is cropped to the banner height.
- `display: block` on the `<img>` removes the default inline bottom gap.
