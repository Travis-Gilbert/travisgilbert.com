'use client';

/**
 * Thin wrapper around Pagefind's client-side API.
 * Loads the index on first search, caches the instance.
 * A missing index (dev server, failed postbuild) returns no results
 * instead of throwing into the Cmd+K terminal.
 */

interface PagefindResult {
  id: string;
  url: string;
  excerpt: string;
  meta: {
    title?: string;
    image?: string;
  };
  filters: {
    type?: string[];
  };
  sub_results?: PagefindSubResult[];
}

interface PagefindSubResult {
  title: string;
  url: string;
  excerpt: string;
}

interface PagefindResponse {
  results: { id: string; data: () => Promise<PagefindResult> }[];
  totalFilters: Record<string, Record<string, number>>;
}

type PagefindApi = {
  search: (query: string, options?: Record<string, unknown>) => Promise<PagefindResponse>;
  options: (opts: Record<string, unknown>) => Promise<void>;
};

let pagefindInstance: PagefindApi | null = null;
let loadFailed = false;

async function loadPagefind(): Promise<PagefindApi | null> {
  if (pagefindInstance) return pagefindInstance;
  if (loadFailed) return null;
  if (typeof window === 'undefined') return null;
  try {
    // Pagefind writes itself to /pagefind/pagefind.js during `npm run build`.
    // @ts-expect-error dynamic import of build-time generated module
    const pf = await import(/* webpackIgnore: true */ '/pagefind/pagefind.js');
    await pf.options({ excerptLength: 120 });
    pagefindInstance = pf as PagefindApi;
    return pagefindInstance;
  } catch {
    loadFailed = true;
    return null;
  }
}

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  contentType: string;
}

export async function search(query: string, maxResults = 10): Promise<SearchResult[]> {
  try {
    const pf = await loadPagefind();
    if (!pf) return [];

    const response = await pf.search(query);

    const results: SearchResult[] = [];
    const limit = Math.min(response.results.length, maxResults);

    for (let i = 0; i < limit; i++) {
      const data = await response.results[i].data();
      const plainExcerpt = data.excerpt.replace(/<[^>]*>/g, '');
      results.push({
        id: data.id,
        url: data.url,
        title: data.meta.title ?? 'Untitled',
        excerpt: plainExcerpt,
        contentType: data.filters.type?.[0] ?? 'page',
      });
    }

    return results;
  } catch {
    return [];
  }
}
