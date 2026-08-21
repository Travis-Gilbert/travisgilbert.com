/**
 * Video production client stub for the public-site extract.
 * The Studio API is not part of this app. Every fetch no-ops so
 * pipeline numbers, /now, and essay pages still render from markdown.
 */

export interface VideoSummary {
  slug: string;
  title: string;
  short_title: string;
  phase: string;
  phase_display: string;
  phase_number: number;
  draft: boolean;
  updated_at: string;
  youtube_id: string;
  linked_essay_slugs: string[];
  published_at: string | null;
}

export interface VideoDetail extends VideoSummary {
  thesis: string;
  sources: Array<{ title: string; url: string }>;
  script_word_count: number;
  script_estimated_duration: string;
  youtube_url: string;
  youtube_title: string;
  published_at: string | null;
  linked_essays: Array<{ slug: string; title: string }>;
  linked_field_notes: Array<{ slug: string; title: string }>;
  scenes: Array<{
    id: number;
    order: number;
    title: string;
    scene_type: string;
    script_locked: boolean;
    vo_recorded: boolean;
    filmed: boolean;
    assembled: boolean;
    polished: boolean;
  }>;
  deliverables: Array<{
    id: number;
    label: string;
    platform: string;
    status: string;
    url: string;
  }>;
}

export const VIDEO_PHASES = [
  'research',
  'scripting',
  'voiceover',
  'filming',
  'assembly',
  'polish',
  'metadata',
  'publish',
  'published',
] as const;

export type VideoPhase = (typeof VIDEO_PHASES)[number];

export const PHASE_LABELS: Record<VideoPhase, string> = {
  research: 'Research',
  scripting: 'Scripting',
  voiceover: 'Voiceover',
  filming: 'Filming',
  assembly: 'Assembly',
  polish: 'Polish',
  metadata: 'Metadata',
  publish: 'Publish',
  published: 'Published',
};

export async function fetchActiveVideos(): Promise<VideoSummary[]> {
  return [];
}

export async function fetchAllVideos(): Promise<VideoSummary[]> {
  return [];
}

export async function fetchVideoDetail(_slug: string): Promise<VideoDetail | null> {
  return null;
}

export async function fetchVideosForEssay(_essaySlug: string): Promise<VideoSummary[]> {
  return [];
}
