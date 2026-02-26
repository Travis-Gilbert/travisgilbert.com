# 003: Research API

## Summary

Django project (`research_api/`) for research source tracking, backlink computation, Webmention protocol, and a read-only public API. Sibling service to `publishing_api/`.

## Domain

Tracks sources (books, articles, papers) linked to published essays and field notes. Generates automatic backlinks between content sharing sources. Tracks research threads showing how investigations develop over time. Receives inbound mentions via W3C Webmention protocol.

## Architecture

### Apps

| App | Purpose |
|-----|---------|
| `core` | Custom User, TimeStampedModel abstract base |
| `research` | Source, ContentReference, ResearchThread, ThreadEntry |
| `mentions` | Webmention model + webhook receiver |
| `api` | DRF read-only viewsets + computed backlinks endpoint |
| `publisher` | GitHub API client, JSON serializers, publish orchestrator |

### Data Model

**Source**: title, slug, source_type (9 types: book, article, paper, podcast, video, website, report, dataset, other), authors (JSONField list), publisher, publication_date, url, isbn, doi, notes, tags, cover_image_url.

**ContentReference**: Links a Source to a content piece (essay, field note, project) by content_type + content_slug. Includes context quote and paragraph_index. Unique constraint on (source, content_type, content_slug).

**ResearchThread**: Title, slug, description, status (active/paused/completed), started_date, tags. Contains ordered ThreadEntry items.

**ThreadEntry**: date, title, body, M2M to sources, optional content_type + content_slug link.

**Webmention**: source_url, target_url, author metadata, content, mention_type (like/reply/repost/mention/bookmark), verified flag, moderation status (pending/approved/rejected/spam). Unique constraint on (source_url, target_url).

### Backlink Engine

Backlinks are **computed, not stored**. Two functions in `apps/research/services.py`:

1. `get_backlinks(content_type, content_slug)`: Finds content sharing sources with a specific piece.
2. `get_all_backlinks()`: Builds the full bidirectional graph for static publishing.

The computation joins ContentReferences via shared source_id. Cheap at single-user scale (tens to hundreds of sources).

### Publishing

`apps/publisher/publish.py` orchestrates:
1. Gathers all sources, references, threads, backlinks
2. Serializes to camelCase JSON (matching Next.js Zod conventions)
3. Commits atomically via Git Trees API to `src/data/research/` in the Next.js repo

Four output files: `sources.json`, `references.json`, `threads.json`, `backlinks.json`.

Management command: `python manage.py publish_research` (with `--dry-run` flag).

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/sources/` | GET | Sources (filterable by type, tag). Lookup by slug. |
| `/api/v1/references/` | GET | Content references (filterable by content_type, content_slug) |
| `/api/v1/threads/` | GET | Research threads with nested entries. Lookup by slug. |
| `/api/v1/mentions/` | GET | Approved webmentions (filterable by target URL) |
| `/api/v1/backlinks/` | GET | Computed backlinks for a content piece |
| `/webhooks/webmention/` | POST | W3C Webmention receiver (csrf_exempt) |
| `/health/` | GET | Health check (tests DB connectivity) |
| `/admin/` | GET | Django admin (authoring interface) |

### Key Decisions

- **Admin as authoring UI**: No custom editor like publishing_api's Studio. Django admin with rich fieldsets and inlines is sufficient for structured data entry.
- **Backlinks as computed data**: No Backlink model to sync. Derived from ContentReference joins.
- **Webmention verification is synchronous**: At this scale, no task queue needed.
- **DRF read-only**: AllowAny permissions, GET/HEAD/OPTIONS only. No public writes.

## Deployment

Same Railway pattern as publishing_api: nixpacks builder, PostgreSQL, gunicorn. Environment variables: `SECRET_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `WEBMENTION_TARGET_DOMAIN`.

## Status

Scaffolded and validated. Django check passes (0 issues). Migrations created and applied (SQLite). All URL patterns resolve. Not yet deployed to Railway.
