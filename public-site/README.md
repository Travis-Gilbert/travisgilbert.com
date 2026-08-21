# Public site

Thin, self-contained travisgilbert.me. Markdown from `content/`, Next.js App Router, no studio stack.

This is the public site extract. It does not include CommonPlace, Theseus, Studio, Act, Index-API, or any TensorFlow / three.js / DuckDB / Monaco tooling from the parent repo.

## Run locally

```bash
cd public-site
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
cd public-site
npm install
npm run build
```

The build writes a static export to `out/`. You can preview it with any static file server (`npx serve out`).

## Deploy (Fly.io)

This folder is the only thing that should go to Fly. The repo-root Next app (Theseus, CommonPlace, Studio) stays undeployed.

First time only (the previous empty `travisgilbert-me` app was destroyed):

```bash
fly apps create travisgilbert-me
```

Then, always from this folder:

```bash
cd public-site && fly deploy
```

Use `fly deploy --ha=false` on the first deploy if you want a single shared-cpu-1x machine (256mb). No secrets are required. This PR does not point DNS at Fly.

## Content

`content/` is a copy of `src/content/` from the parent repo. Frontmatter matches the original shapes (title, date, summary, tags, draft, stage, sources, related, and so on). List pages skip `draft: true` items.

To refresh content later, copy `src/content/` over `public-site/content/` again, then re-check Theseus copy (Theseus is retired; Theorem, RustyRed, civic atlas, and RustyWeb are current).

## Routes

- `/` : CollageHero, PipelineCounter, featured essay, field notes, projects
- `/essays` and `/essays/[slug]` : `content/essays/`
- `/field-notes` and `/field-notes/[slug]` : `content/field-notes/`
- `/projects` and `/projects/[slug]` : `content/projects/`
- `/now` : `content/now.md`
- `/connect` : Profile links
- `/shelf` : `content/shelf/`
- `/toolkit` : `content/toolkit/`
- `/tags` and `/tags/[tag]` : topic index used by TagList

The homepage gold "Install" box from the old fat app is omitted because `/install` is not a public-site route.

## Stack

Next.js (App Router) + TypeScript + gray-matter + remark + Tailwind v4 + rough.js. Typography is Vollkorn, IBM Plex Sans, Courier Prime, JetBrains Mono, Caveat, Caudex, Lora, and Amarna via `next/font`, using the parchment palette (terracotta / teal / gold). Layout chrome is DotGrid, TopNav, Footer, and the Cmd+K terminal.
