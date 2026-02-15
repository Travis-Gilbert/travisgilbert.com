# travisgilbert.com — Personal Website

## Project Overview

Personal "creative workbench" site — a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements (rough.js). NOT a traditional portfolio or resume.

## Tech Stack

Next.js 15 (App Router), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), rough.js, rough-notation, `next/font` (Google + local), Zod, gray-matter + remark

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | App Router pages and layouts |
| `src/app/fonts.ts` | All 7 font declarations (`next/font/google` + `next/font/local`) |
| `src/app/layout.tsx` | Root layout (DotGrid, TopNav, Footer, metadata) |
| `src/components/` | React components (Server + Client) |
| `src/components/rough/` | Client Components for rough.js visuals (RoughBox, RoughLine, RoughUnderline) |
| `src/content/` | Markdown content collections (investigations, field-notes, shelf, toolkit, projects) |
| `src/lib/content.ts` | Content loading: Zod schemas, `getCollection()`, `getEntry()`, `renderMarkdown()` |
| `src/lib/slugify.ts` | Tag slug utility |
| `src/styles/global.css` | Design tokens, prose variants, timeline CSS |
| `public/fonts/` | Self-hosted Amarna variable font |

## Development Commands

```bash
npm run dev        # Start Next.js dev server
npm run build      # Production build (SSG)
npm run start      # Serve production build locally
npm run lint       # Run Next.js linter
```

## Content Workflow

1. Create a `.md` file in the appropriate `src/content/` subdirectory
2. Fill in frontmatter matching the Zod schema in `src/lib/content.ts`
3. Push to `main` — Vercel auto-deploys

## Architecture Notes

### Server vs Client Components

Most components are **Server Components** by default. Components needing browser APIs use `'use client'`:

| Client Component | Why |
|-----------------|-----|
| `DotGrid.tsx` | Canvas animation, rAF, mouse/touch events |
| `TopNav.tsx` | `usePathname()`, mobile menu `useState` |
| `ShelfFilter.tsx` | Filter state via `useState` |
| `YouTubeEmbed.tsx` | Click-to-load facade via `useState` |
| `ConsoleEasterEgg.tsx` | `console.log` in `useEffect` |
| `rough/RoughBox.tsx` | Canvas drawing via `useRef` + `useEffect` |
| `rough/RoughLine.tsx` | Canvas drawing |
| `rough/RoughUnderline.tsx` | Canvas drawing |

Server Components can import and render Client Components — children pass through as a slot without hydrating.

### Font System

`next/font` sets CSS variables on `<html>` via `fontVariableClasses` (from `src/app/fonts.ts`). Global CSS bridges these to Tailwind `@theme inline`:

```
next/font → --font-vollkorn (CSS var on <html>)
global.css → --font-title: var(--font-vollkorn), Georgia, serif
Tailwind → font-title class
```

7 fonts: Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, Space Mono (Google), Amarna (local).

### Content Loading

`src/lib/content.ts` replaces Astro's `getCollection()`:
- Reads `src/content/{name}/*.md` with `gray-matter`
- Validates frontmatter with Zod schemas
- Renders markdown with `remark` + `remark-gfm` + `remark-html`
- Dynamic routes use `generateStaticParams()` (replaces Astro's `getStaticPaths()`)

### RoughBox Pattern

`RoughBox` is the primary card container site-wide — hand-drawn canvas borders replacing CSS `border-border rounded-xl`. Used in all content cards (InvestigationCard, FieldNoteEntry, ProjectCard, ShelfItem, ShelfFilter, toolkit boxes, connect box). Each wraps content in `<div className="bg-surface">` for readability against the dot grid.

## Deployment

Vercel with native Next.js builder. Git integration auto-deploys on push to `main`. No `vercel.json` needed — Vercel auto-detects Next.js. **Important:** Vercel dashboard Project Settings > Output Directory must be blank/default (not `dist`).

## Status

| Phase | Status |
|-------|--------|
| Astro → Next.js 15 migration | Complete |
| RoughBox site-wide card borders | Complete |
| Vercel deployment | Needs dashboard Output Directory fix |

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Framework migration | Next.js 15 App Router | More powerful than Astro for where the design is heading; React-native state/routing |
| Navigation style | Horizontal top nav (TopNav.tsx) | Reverted sidebar layout — didn't look good for most content types |
| Static rendering | No `output: 'export'` | Vercel's native Next.js builder handles SSG automatically; export mode caused dist directory conflicts |
| Content loading | gray-matter + remark + Zod | MDX is overkill, Contentlayer is deprecated; manual pipeline gives full control |
| Tailwind integration | `@tailwindcss/postcss` | Replaces `@tailwindcss/vite` from Astro; standard PostCSS plugin for Next.js |
| Icon library | `@phosphor-icons/react` with `weight` prop | Replaces `phosphor-astro`; SSR imports from `dist/ssr` for Server Components |
| Card containers | RoughBox everywhere | Hand-drawn borders are the brand signature; replaces plain CSS borders |
| Dot grid background | Canvas React component with spring physics | Ported from Preact to React hooks |
| Name font | Amarna (`next/font/local`) | Not on Google Fonts; single 63kB variable file |

## Gotchas

- **Canvas stacking context**: Body needs `isolation: isolate`, canvas needs `z-index: -1`, `background-color` on `html` (not body) — otherwise body bg paints over canvas
- **Canvas DPR scaling**: Multiply canvas dimensions by `devicePixelRatio`, use `ctx.scale(dpr, dpr)`, set CSS size to logical pixels
- **Phosphor icons in Server Components**: Import from `@phosphor-icons/react/dist/ssr` (not default export)
- **Route handlers need force-static**: `sitemap.ts` and `rss.xml/route.ts` require `export const dynamic = 'force-static'`
- **Next.js 15 async params**: Dynamic route `params` is `Promise<{ slug: string }>` — must `await` it
- **Vercel Output Directory**: Dashboard must have Output Directory blank/default — `dist` setting from old Astro config breaks Next.js builds
- **Font variable bridging**: `next/font` vars (e.g., `--font-vollkorn`) are distinct from Tailwind theme aliases (e.g., `--font-title`). Bridge in `global.css` `@theme inline`
