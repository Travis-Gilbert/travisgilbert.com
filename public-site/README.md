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

The build writes a static export to `out/`. You can preview it with any static file server (`npx serve out`). There is no Vercel, Railway, Fly, or Docker config here on purpose.

## Content

`content/` is a copy of `src/content/` from the parent repo. Frontmatter matches the original shapes (title, date, summary, tags, draft, stage, sources, related, and so on). List pages skip `draft: true` items.

To refresh content later, copy `src/content/` over `public-site/content/` again, then re-check Theseus copy (Theseus is retired; Theorem, RustyRed, civic atlas, and RustyWeb are current).

## Routes

- `/` : Home (bio, now blurb, recent writing, featured projects)
- `/essays` and `/essays/[slug]` : `content/essays/`
- `/field-notes` and `/field-notes/[slug]` : `content/field-notes/`
- `/projects` and `/projects/[slug]` : `content/projects/`
- `/now` : `content/now.md`
- `/connect` : Profile links
- `/shelf` : `content/shelf/`
- `/toolkit` : `content/toolkit/`

## Stack

Next.js (App Router) + TypeScript + gray-matter + remark + a small Tailwind/CSS layer. Typography is Vollkorn, Cabin, and IBM Plex Mono via `next/font`, using the existing parchment palette.
