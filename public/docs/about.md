# About

This project is a minimal **Markdown-powered website** built with:

- [React](https://react.dev) — UI framework
- [Vite](https://vitejs.dev) — build tool
- [React Router](https://reactrouter.com) — client-side routing
- [react-markdown](https://github.com/remarkjs/react-markdown) — Markdown rendering
- [remark-gfm](https://github.com/remarkjs/remark-gfm) — GitHub Flavoured Markdown (tables, strikethrough, etc.)

## How it works

Pages are plain `.md` files served from `public/docs/`. The app fetches the
file for the current route, renders it with `react-markdown`, and intercepts
any links ending in `.md` so they stay inside the single-page app.

The sidebar is driven by `public/docs/manifest.json`, making it easy to add,
reorder, or remove pages without touching any source code.

---

[Home](./index.md) · [Getting Started](./getting-started.md)
