import type { Metadata } from 'next';
import Link from 'next/link';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, ShelfEntry } from '@/lib/content';
import { computeThreadPairs } from '@/lib/connectionEngine';
import type { AllContent } from '@/lib/connectionEngine';
import ThreadLines from '@/components/ThreadLines';

export const metadata: Metadata = {
  title: 'Paper Trails',
  description:
    'Published essays, field notes, and shelf items, and the threads that connect them.',
};

type TrailKind = 'essay' | 'field_note' | 'shelf';

interface TrailNode {
  id: string;
  slug: string;
  label: string;
  kind: TrailKind;
  href: string;
  connectionCount: number;
  external?: boolean;
}

const KIND_LABEL: Record<TrailKind, string> = {
  essay: 'essay',
  field_note: 'field note',
  shelf: 'shelf',
};

export default function ResearchPage() {
  const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
  const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);
  const shelf = getCollection<ShelfEntry>('shelf');

  const threadContent: AllContent = { essays, fieldNotes, shelf };
  const threadPairs = computeThreadPairs(threadContent, 24);

  const degree = new Map<string, number>();
  for (const pair of threadPairs) {
    degree.set(pair.fromSlug, (degree.get(pair.fromSlug) ?? 0) + 1);
    degree.set(pair.toSlug, (degree.get(pair.toSlug) ?? 0) + 1);
  }

  const nodes: TrailNode[] = [
    ...essays.map((entry) => ({
      id: `essay-${entry.slug}`,
      slug: entry.slug,
      label: entry.data.title,
      kind: 'essay' as const,
      href: `/essays/${entry.slug}`,
      connectionCount: degree.get(entry.slug) ?? 0,
    })),
    ...fieldNotes.map((entry) => ({
      id: `note-${entry.slug}`,
      slug: entry.slug,
      label: entry.data.title,
      kind: 'field_note' as const,
      href: `/field-notes/${entry.slug}`,
      connectionCount: degree.get(entry.slug) ?? 0,
    })),
    ...shelf.map((entry) => ({
      id: `shelf-${entry.slug}`,
      slug: entry.slug,
      label: entry.data.title,
      kind: 'shelf' as const,
      href: entry.data.url ?? '/shelf',
      connectionCount: degree.get(entry.slug) ?? 0,
      external: Boolean(entry.data.url),
    })),
  ].sort((a, b) => {
    if (b.connectionCount !== a.connectionCount) {
      return b.connectionCount - a.connectionCount;
    }
    return a.label.localeCompare(b.label);
  });

  return (
    <>
      <section className="py-8">
        <SectionLabel color="teal">Research Network</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="magnifying-glass" size={32} color="var(--color-teal)" />
          Paper Trails
        </h1>
        <p className="text-ink-secondary mb-6 max-w-prose">
          Source-backed views of the essays and field notes on this site,
          plus shelf items, with thread lines from the local connection
          engine. The old live Index API force graph is not part of this
          static extract.
        </p>
      </section>

      {nodes.length === 0 ? (
        <div className="border border-border bg-surface px-4 py-5">
          <p className="font-body-alt text-sm text-ink-secondary">
            No published essays, field notes, or shelf items yet.
          </p>
        </div>
      ) : (
        <div className="relative">
          <ThreadLines pairs={threadPairs} />
          <div className="grid gap-2">
            {nodes.map((node) => (
              <TrailNodeRow key={node.id} node={node} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function TrailNodeRow({ node }: { node: TrailNode }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="font-title text-base leading-tight">{node.label}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint whitespace-nowrap">
          {node.connectionCount}
        </span>
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
        {KIND_LABEL[node.kind]}
      </div>
    </>
  );

  const className =
    'block no-underline border border-border bg-surface px-3 py-3 text-ink hover:text-ink hover:border-terracotta/40';

  if (node.external) {
    return (
      <a href={node.href} className={className} data-slug={node.slug}>
        {content}
      </a>
    );
  }

  return (
    <Link href={node.href} className={className} data-slug={node.slug}>
      {content}
    </Link>
  );
}
