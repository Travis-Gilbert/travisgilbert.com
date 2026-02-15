# travisgilbert.com — Personal Website

## Project Overview

Personal "creative workbench" site — a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements. NOT a traditional portfolio or resume.

Spec: `~/Downloads/site-spec.md`

## Tech Stack

Astro 5 (SSG), Tailwind CSS v4, Preact (islands), rough.js, rough-notation, Google Fonts (Courier Prime, Lora, Special Elite), Amarna (self-hosted variable font)

## Key Directories

| Path | Purpose |
|------|---------|
| `public/fonts/` | Self-hosted fonts (Amarna variable font) |
| `src/data/` | Content collections (Astro 5 glob loader convention) |
| `src/data/investigations/` | Video case file entries (markdown) |
| `src/data/field-notes/` | Blog posts (markdown) |
| `src/data/shelf/` | Recommendations: books, videos, tools, etc. (markdown) |
| `src/data/toolkit/` | How I work: tools, processes (markdown) |
| `src/components/` | Astro + Preact components |
| `src/components/rough/` | Preact island components for rough.js visuals |
| `src/layouts/` | Page layouts |
| `src/pages/` | Route pages |
| `src/styles/` | Global CSS, design tokens |
| `src/content.config.ts` | Content collection schemas (Astro 5 API) |

## Development Commands

```bash
npm run dev        # Start dev server
npm run build      # Build static site
npm run preview    # Preview production build locally
```

## Content Workflow

1. Create a `.md` file in the appropriate `src/data/` subdirectory
2. Fill in frontmatter matching the collection schema in `src/content.config.ts`
3. Push to `main` — Vercel auto-deploys

## Status

| Phase | Status |
|-------|--------|
| Pre-Phase: Git + CLAUDE.md | Complete |
| Phase 1: Foundation | Complete |
| Phase 2: Design System Components | Complete |
| Phase 3: Content Architecture | Complete |
| Phase 4: Pages | Complete |
| Phase 5: Polish | Complete |

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Dot grid background | Canvas Preact island (`DotGrid.tsx`) with spring physics | CSS radial-gradient can't animate individual dots; canvas gives per-dot control |
| Canvas stacking | `isolation: isolate` on body, `z-index: -1` on canvas, `background-color` on `html` | Body bg propagates to html per CSS spec; isolation creates stacking context |
| Name font | Amarna (self-hosted variable font in `public/fonts/`) | Not on Google Fonts; single 63kB variable file for all weights |
| Vercel deployment | Git integration auto-deploy (push to `main`) | Vercel CLI has peer dep conflicts with Node 25; git integration is reliable |
| Tailwind version | v4 via `@tailwindcss/vite` | v3 integration is legacy; v4 pairs with CSS custom properties |
| Content location | `src/data/` | Astro 5 convention with glob loaders |
| Config file | `src/content.config.ts` | Required by Astro 5 (not legacy `src/content/config.ts`) |
| Island framework | Preact | 3kB, spec recommends, excellent Astro support |
| Git repo scope | Project directory only | Was incorrectly at `~` |

## Gotchas

- **Canvas behind page content**: Fixed canvas needs `isolation: isolate` on body + `background-color` on `html` (not body) + `z-index: -1` — otherwise body bg paints over it
- **Vercel CLI + Node 25**: `npx vercel` fails with ERESOLVE peer dependency conflict — use git push auto-deploy instead
- **Preact island canvas pattern**: DPR scaling required — multiply canvas dimensions by `devicePixelRatio`, use `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, set CSS size to logical pixels
- **Preact islands use mutable closure vars** (not `useState`) for high-frequency animation state (rAF, mouse coords, typed arrays)
