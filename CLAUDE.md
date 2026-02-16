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
| `src/components/SectionLabel.tsx` | Monospace colored section headers (terracotta/teal/gold) |
| `src/styles/global.css` | Design tokens, surface utilities, prose variants, timeline CSS |
| `docs/plans/` | Design documents and implementation plans |
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

`RoughBox` is the primary card container site-wide — hand-drawn canvas borders with transparent brand-color fills. Props:

| Prop | Default | Description |
|------|---------|-------------|
| `tint` | `'neutral'` | Brand-color fill wash: `'terracotta'` / `'teal'` / `'gold'` / `'neutral'` |
| `grid` | `true` | Blueprint grid lines (40px, opacity 0.35) inside card |
| `elevated` | `true` | Warm brown box-shadow |
| `hover` | `false` | Lift-on-hover animation (opt-in for linked cards) |
| `stroke` | derived from `tint` | rough.js border color; auto-matches tint when not set |

**Architecture:** Surface styles (tint, grid, shadow) go on the wrapper `<div>` via CSS classes. The canvas only draws the hand-drawn stroke. Stroke color is derived from `tint` via `tintStroke` map unless explicitly overridden.

**Color mapping:**

| Card Type | tint | stroke | fill opacity |
|-----------|------|--------|-------------|
| InvestigationCard | terracotta | `#B45A2D` | 4.5% |
| FieldNoteEntry | teal | `#2D5F6B` | 4% |
| ProjectCard / ShelfItem | gold | `#C49A4A` | 5% |
| Toolkit boxes | terracotta | `#B45A2D` | 4.5% |
| Connect box | teal | `#2D5F6B` | 4% |
| Neutral (404, etc) | neutral | `#3A3632` | 2.5% |

### Surface Materiality System

The site uses a layered texture system to create skeuomorphic depth:

1. **Page level**: DotGrid canvas (spring physics) + paper grain (`body::after` SVG feTurbulence at 2.5%)
2. **Card level**: Transparent tint fill + blueprint grid (`::before` at 35%) + warm shadow + rough.js colored stroke
3. **Content level**: SectionLabel (monospace colored headers), TagList with tint-matched colors

**Key CSS classes** (in `global.css`):
- `.surface-elevated` — warm shadow only (no bg-color; tint handles fill)
- `.surface-tint-{color}` — transparent brand-color wash
- `.surface-grid` — blueprint grid overlay via `::before`
- `.surface-hover` — lift animation with shadow transition

### Section Color Language

Each content type has a brand color that flows through labels, icons, tags, card tints, and borders:

| Section | Color | Label Text |
|---------|-------|-----------|
| Investigations / Toolkit | Terracotta (`#B45A2D`) | INVESTIGATION FILE / WORKSHOP TOOLS |
| Field Notes / Connect | Teal (`#2D5F6B`) | FIELD OBSERVATION / OPEN CHANNEL |
| Projects / Shelf | Gold (`#C49A4A`) | PROJECT ARCHIVE / REFERENCE SHELF |

Components: `SectionLabel` (monospace header), `TagList` (tint prop), page icons

## Deployment

Vercel with native Next.js builder. Git integration auto-deploys on push to `main`. No `vercel.json` needed — Vercel auto-detects Next.js. **Important:** Vercel dashboard Project Settings > Output Directory must be blank/default (not `dist`).

## Status

| Phase | Status |
|-------|--------|
| Astro → Next.js 15 migration | Complete |
| RoughBox site-wide card borders | Complete |
| Surface materiality layer (Phase 1) | Complete |
| Card tint + colored borders | Complete |
| Section color system (labels, icons, tags) | Complete |
| Vercel deployment | Auto-deploys on push to main |

### Next Steps (Phase 2 — Micro-interactions & Radix UI)

Decided during brainstorm: Radix Primitives + fully custom styling (no shadcn/ui). Phase 2 focuses on:
- Interactive components via Radix UI primitives (accessibility-first)
- Micro-interactions that reinforce the "physical workbench" metaphor
- Potential: accordion/collapsible sections, tooltips, dialog modals
- Evidence callout labels in article blockquotes (monospace "FIELD NOTE — SOURCE DOCUMENT")
- DateStamp subtle color enhancement (terracotta-light tint)
- See `docs/plans/2026-02-15-surface-materiality-layer-design.md` for design doc

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
| UI library | Radix Primitives (not shadcn/ui) | Full custom styling over brand; shadcn opinionated defaults fight the aesthetic |
| Card fills | Transparent brand-color tints, not solid white | White `bg-surface` was jarring against warm parchment; tints let paper show through |
| Card border colors | Derived from tint (terracotta/teal/gold) | Monochrome dark ink borders made all cards look identical; colored borders create section identity |
| Blueprint grid placement | Cards only, NOT page background or article prose | Dots (DotGrid) for page bg; grid for card interiors; prose stays clean for reading |
| Section color system | terracotta=investigations, teal=field-notes, gold=projects | Creates wayfinding language — color tells you where you are on the site |
| Grid opacity | 0.35 (bumped from 0.15) | Grid was invisible against the card fill at lower opacity |

## Gotchas

- **Canvas stacking context**: Body needs `isolation: isolate`, canvas needs `z-index: -1`, `background-color` on `html` (not body) — otherwise body bg paints over canvas
- **Canvas DPR scaling**: Multiply canvas dimensions by `devicePixelRatio`, use `ctx.scale(dpr, dpr)`, set CSS size to logical pixels
- **Phosphor icons in Server Components**: Import from `@phosphor-icons/react/dist/ssr` (not default export)
- **Route handlers need force-static**: `sitemap.ts` and `rss.xml/route.ts` require `export const dynamic = 'force-static'`
- **Next.js 15 async params**: Dynamic route `params` is `Promise<{ slug: string }>` — must `await` it
- **Vercel Output Directory**: Dashboard must have Output Directory blank/default — `dist` setting from old Astro config breaks Next.js builds
- **Font variable bridging**: `next/font` vars (e.g., `--font-vollkorn`) are distinct from Tailwind theme aliases (e.g., `--font-title`). Bridge in `global.css` `@theme inline`
