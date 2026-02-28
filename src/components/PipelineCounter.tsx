/**
 * PipelineCounter: Server Component that displays content pipeline status.
 * Counts essays and field notes by stage, maps them to unified buckets,
 * and renders as colored monospace labels separated by middots.
 *
 * Field note status mapping:
 *   observation -> researching, developing -> drafting, connected/undefined -> published
 */

import { getCollection } from '@/lib/content';
import type { Essay, FieldNote } from '@/lib/content';

interface Bucket {
  label: string;
  color: string;
  count: number;
}

export default function PipelineCounter() {
  const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
  const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);

  const buckets: Record<string, Bucket> = {
    researching: { label: 'RESEARCHING', color: 'var(--color-teal)', count: 0 },
    drafting: { label: 'DRAFTING', color: 'var(--color-terracotta)', count: 0 },
    production: { label: 'IN PRODUCTION', color: 'var(--color-gold)', count: 0 },
    published: { label: 'PUBLISHED', color: 'var(--color-green)', count: 0 },
  };

  for (const essay of essays) {
    const stage = essay.data.stage || 'published';
    if (stage === 'research') buckets.researching.count++;
    else if (stage === 'drafting') buckets.drafting.count++;
    else if (stage === 'production') buckets.production.count++;
    else buckets.published.count++;
  }

  for (const note of fieldNotes) {
    const status = note.data.status;
    if (status === 'observation') buckets.researching.count++;
    else if (status === 'developing') buckets.drafting.count++;
    else buckets.published.count++;
  }

  const active = Object.values(buckets).filter((b) => b.count > 0);

  return (
    <div
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono"
      style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}
      aria-label="Content pipeline status"
    >
      {active.map((bucket, i) => (
        <span key={bucket.label} className="inline-flex items-center gap-1.5">
          {i > 0 && (
            <span style={{ color: 'var(--color-ink-muted)' }} aria-hidden="true">
              &middot;
            </span>
          )}
          <span style={{ color: bucket.color }}>
            {bucket.count} {bucket.label}
          </span>
        </span>
      ))}
    </div>
  );
}
