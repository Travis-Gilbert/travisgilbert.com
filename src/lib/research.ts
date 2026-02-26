/**
 * Research Trail API client and TypeScript types.
 *
 * Fetches from the research_api Django service at research.travisgilbert.me.
 * All functions return null on failure for graceful degradation:
 * if the API is unreachable, the Research Trail section simply doesn't appear.
 */

const RESEARCH_API = 'https://research.travisgilbert.me';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrailSource {
  id: number;
  title: string;
  slug: string;
  creator: string;
  sourceType: string;
  url: string;
  publication: string;
  publicAnnotation: string;
  role: string;
  keyQuote: string;
  keyFindings?: string[];
  dateEncountered?: string;
  datePublished?: string;
  tags?: string[];
}

export interface Backlink {
  contentType: string;
  contentSlug: string;
  contentTitle: string;
  sharedSources: Array<{
    sourceId: number;
    sourceTitle: string;
  }>;
}

export interface ThreadEntry {
  entryType: string;
  date: string;
  title: string;
  description: string;
  sourceTitle: string;
}

export interface ResearchThread {
  title: string;
  slug: string;
  description: string;
  status: string;
  startedDate: string;
  completedDate?: string;
  durationDays?: number;
  entries: ThreadEntry[];
}

export interface Mention {
  sourceUrl: string;
  sourceTitle: string;
  sourceExcerpt: string;
  sourceAuthor: string;
  mentionType: string;
  featured: boolean;
  mentionSourceName: string;
  mentionSourceAvatar: string;
  createdAt: string;
  sourcePublished?: string;
}

export interface ApprovedSuggestion {
  title: string;
  url: string;
  sourceType: string;
  relevanceNote: string;
  contributorName: string;
}

export interface TrailResponse {
  slug: string;
  contentType: 'essay' | 'field_note';
  sources: TrailSource[];
  backlinks: Backlink[];
  thread: ResearchThread | null;
  mentions: Mention[];
  approvedSuggestions?: ApprovedSuggestion[];
}

export interface SourceSuggestion {
  title: string;
  url: string;
  source_type: string;
  relevance_note: string;
  target_content_type: string;
  target_slug: string;
  contributor_name: string;
  contributor_url: string;
  recaptcha_token: string;
}

// ─── API Functions ──────────────────────────────────────────────────────────

export async function fetchResearchTrail(slug: string): Promise<TrailResponse | null> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/trail/${slug}/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchApprovedSuggestions(slug: string): Promise<ApprovedSuggestion[]> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/suggestions/${slug}/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function submitSourceSuggestion(data: SourceSuggestion): Promise<boolean> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/suggest/source/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}
