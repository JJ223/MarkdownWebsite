---
title: Hello World — Why I built this
date: 2026-06-01
description: The story behind this site — why I built it, how the content pipeline works, and where it's going next.
---

# Hello World — Why I built this

_2026-06-01_

<div class="article-banner"><img src="/images/blog-hello-world.jpg" alt="Hello World" /></div>

I wanted a personal website that felt like a notebook rather than a portfolio template. Something I could write in plaintext, navigate like a wiki, and publish without thinking about making it pretty. This site is that experiment.

## The stack

The site is a Vite + React single-page app. Most pages are a `.md` file fetched at runtime and rendered with `react-markdown`. There is no database, no server-side rendering, no framework magic — just a JSON manifest that drives the sidebar and a fetch call per page load.

The URL structure mirrors the file structure. `#/about/education` fetches `public/docs/about/education.md`. Adding a page means dropping a file and registering it in the manifest. Removing one means deleting the file.

## The hosting plan

Right now the markdown files live inside the git repository alongside the React source code. That means every new post triggers a full redeploy. For a blog that changes more often than the app itself, that coupling is unnecessary overhead.

The plan is to host the `public/docs/` folder separately — on a CDN or an object storage bucket — and configure the app to fetch content from that external URL instead of its own origin. The React app becomes a static shell that never changes between posts. Writing a new entry means uploading a `.md` file and running the index generator against the remote bucket. No git commit, no build, no deploy.

This change will be coming soon. :)

---

[← Back to Blog](blog.md) · [Archive](blog/archive.md)
