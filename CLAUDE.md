# travisgilbert.com

## Project Overview

Personal "creative workbench" site: a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements (rough.js). NOT a traditional portfolio or resume.

## Writing Rules

- **No dashes.** Never use em dashes (`—`) or en dashes (`–`) anywhere: not in code comments, not in UI strings, not in markdown content. Use colons, periods, commas, semicolons, or parentheses instead.
- Applies to all files: `.tsx`, `.ts`, `.css`, `.md`, frontmatter strings, JSDoc comments, JSX comments

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
3. Push to `main` (Vercel auto-deploys)

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
| `rough/RoughCallout.tsx` | Canvas straight-line callouts |
| `rough/RoughPivotCallout.tsx` | Canvas 45° leader-line callouts |
| `ScrollReveal.tsx` | IntersectionObserver scroll animations |
| `ProjectTimeline.tsx` | Expandable timeline with `useState` |

Server Components can import and render Client Components; children pass through as a slot without hydrating.

### Font System

`next/font` sets CSS variables on `<html>` via `fontVariableClasses` (from `src/app/fonts.ts`). Global CSS bridges these to Tailwind `@theme inline`:

```
next/font > --font-vollkorn (CSS var on <html>)
global.css > --font-title: var(--font-vollkorn), Georgia, serif
Tailwind > font-title class
```

7 fonts: Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, Space Mono (Google), Amarna (local).

### Content Loading

`src/lib/content.ts` replaces Astro's `getCollection()`:
- Reads `src/content/{name}/*.md` with `gray-matter`
- Validates frontmatter with Zod schemas
- Renders markdown with `remark` + `remark-gfm` + `remark-html`
- Dynamic routes use `generateStaticParams()` (replaces Astro's `getStaticPaths()`)

### RoughBox Pattern

`RoughBox` is the primary card container site-wide: hand-drawn canvas borders with transparent brand-color fills. Props:

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

### RoughPivotCallout Pattern

`RoughPivotCallout` draws architectural leader lines with a 45° pivot for featured content annotations. Geometry: horizontal segment (~30% of `totalLength`) then an 18px diagonal stub. Text starts right after the pivot point.

| Prop | Default | Description |
|------|---------|-------------|
| `side` | `'right'` | Which side of the card the callout branches from |
| `tint` | `'terracotta'` | Color matching the parent card |
| `offsetY` | `16` | Vertical offset from positioned parent |
| `totalLength` | `187` | Total leader-line length (horizontal + diagonal) |
| `pivotDown` | `true` | Diagonal direction |

Used exclusively on the homepage featured investigation card. Two callouts max, staggered on opposite sides.

### Surface Materiality System

The site uses a layered texture system to create skeuomorphic depth:

1. **Page level**: DotGrid canvas (spring physics) + paper grain (`body::after` SVG feTurbulence at 2.5%)
2. **Card level**: Transparent tint fill + blueprint grid (`::before` at 35%) + warm shadow + rough.js colored stroke
3. **Content level**: SectionLabel (monospace colored headers), TagList with tint-matched colors

**Key CSS classes** (in `global.css`):
- `.surface-elevated`: warm shadow only (no bg-color; tint handles fill)
- `.surface-tint-{color}`: transparent brand-color wash
- `.surface-grid`: blueprint grid overlay via `::before`
- `.surface-hover`: lift animation with shadow transition

### Section Color Language

Each content type has a brand color that flows through labels, icons, tags, card tints, and borders:

| Section | Color | Label Text |
|---------|-------|-----------|
| Investigations / Toolkit | Terracotta (`#B45A2D`) | INVESTIGATION FILE / WORKSHOP TOOLS |
| Field Notes / Connect | Teal (`#2D5F6B`) | FIELD OBSERVATION / OPEN CHANNEL |
| Projects / Shelf | Gold (`#C49A4A`) | PROJECT ARCHIVE / REFERENCE SHELF |

Components: `SectionLabel` (monospace header), `TagList` (tint prop), page icons

## Deployment

Vercel with native Next.js builder. Git integration auto-deploys on push to `main`. No `vercel.json` needed; Vercel auto-detects Next.js. **Important:** Vercel dashboard Project Settings > Output Directory must be blank/default (not `dist`).

## Status: Three-Phase Buildout

### Phase 1: Foundation + Surface Materiality ✅ Complete

| Item | Status |
|------|--------|
| Astro to Next.js 15 migration | ✅ |
| RoughBox site-wide card borders | ✅ |
| Surface materiality layer (tints, grid, grain, shadows) | ✅ |
| Card tint + colored borders | ✅ |
| Section color system (labels, icons, tags) | ✅ |
| Font system (7 fonts + CSS variable bridging) | ✅ |
| Content pipeline (gray-matter + remark + Zod) | ✅ |
| Vercel deployment | ✅ Auto-deploys on push to main |

### Phase 2: Micro-interactions + Homepage Redesign 🔄 In Progress

| Item | Status |
|------|--------|
| Homepage redesign as creative workbench | ✅ |
| ScrollReveal scroll-triggered animations | ✅ |
| RoughCallout editor's-notes callouts | ✅ |
| Caveat handwritten font + `--font-annotation` token | ✅ |
| RoughPivotCallout 45° leader-line callouts | ✅ |
| Featured investigation promoted (no outer box, scale hierarchy) | ✅ |
| Radix UI primitives (accordion, tooltips, dialogs) | Planned |
| Evidence callout labels in article blockquotes | Planned |
| DateStamp subtle color enhancement (terracotta-light) | Planned |

Decided during brainstorm: Radix Primitives + fully custom styling (no shadcn/ui).
See `docs/plans/2026-02-15-surface-materiality-layer-design.md` for design doc.

### Phase 3: Content + Polish (Not Started)

- Additional content pages and investigations
- Responsive polish and mobile refinements
- Performance optimization (image loading, bundle size)
- SEO and metadata refinements
- Dark mode (design tokens already prepared in global.css)

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Framework migration | Next.js 15 App Router | More powerful than Astro for where the design is heading; React-native state/routing |
| Navigation style | Horizontal top nav (TopNav.tsx) | Reverted sidebar layout; didn't look good for most content types |
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
| Section color system | terracotta=investigations, teal=field-notes, gold=projects | Creates wayfinding language; color tells you where you are on the site |
| Grid opacity | 0.35 (bumped from 0.15) | Grid was invisible against the card fill at lower opacity |
| No dashes | Colons, periods, parentheses, semicolons | User style preference; applies to all code, comments, and content |
| Pivot callout geometry | Short 18px diagonal stub, text at pivot | Full diagonal pushed text too far from card; stub keeps it compact |
| Callout staggering | Opposite sides (right + left) | Same-side callouts overlap; opposite sides create visual balance |
| Featured card hierarchy | Scale + negative space, no outer box | Double-bordered hero was visually cluttered; subtraction creates emphasis |
| Font annotation token | `--font-annotation` (Caveat) | Separate from `--font-handwritten` for semantic clarity |
| Page title separators | Pipe `\|` not em dash | "Title \| Section" in metadata; consistent with no-dash rule |

## Gotchas

- **Canvas stacking context**: Body needs `isolation: isolate`, canvas needs `z-index: -1`, `background-color` on `html` (not body); otherwise body bg paints over canvas
- **Canvas DPR scaling**: Multiply canvas dimensions by `devicePixelRatio`, use `ctx.scale(dpr, dpr)`, set CSS size to logical pixels
- **Phosphor icons in Server Components**: Import from `@phosphor-icons/react/dist/ssr` (not default export)
- **Route handlers need force-static**: `sitemap.ts` and `rss.xml/route.ts` require `export const dynamic = 'force-static'`
- **Next.js 15 async params**: Dynamic route `params` is `Promise<{ slug: string }>`; must `await` it
- **Vercel Output Directory**: Dashboard must have Output Directory blank/default. `dist` setting from old Astro config breaks Next.js builds
- **Font variable bridging**: `next/font` vars (e.g., `--font-vollkorn`) are distinct from Tailwind theme aliases (e.g., `--font-title`). Bridge in `global.css` `@theme inline`
- **RoughBox needs `position: relative`** for absolute-positioned children like RoughPivotCallout to anchor correctly
- **ScrollReveal + headless testing**: Elements start at `opacity: 0`; IntersectionObserver won't fire in headless browsers. Force visibility for visual testing
- **Callout overlap**: Two callouts on the same side of a card will overlap if their total heights (canvas + text) exceed the vertical gap between them. Always stagger on opposite sides
- **Zod schema backward compat**: When adding `callouts` array field, keep the existing singular `callout` field. Page component prefers array, falls back to singular
