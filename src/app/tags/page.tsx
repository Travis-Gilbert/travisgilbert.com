import type { Metadata } from 'next';
import Link from 'next/link';
import { Tag } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { Investigation, FieldNote, ShelfEntry, Project } from '@/lib/content';
import { slugifyTag } from '@/lib/slugify';

export const metadata: Metadata = {
  title: 'Tags',
  description: 'Browse content by topic.',
};

export default function TagsPage() {
  const investigations = getCollection<Investigation>('investigations').filter(
    (i) => !i.data.draft
  );
  const fieldNotes = getCollection<FieldNote>('field-notes').filter(
    (n) => !n.data.draft
  );
  const shelfItems = getCollection<ShelfEntry>('shelf');
  const projectItems = getCollection<Project>('projects').filter(
    (p) => !p.data.draft
  );

  const tagCounts = new Map<string, { display: string; count: number }>();

  for (const item of [
    ...investigations,
    ...fieldNotes,
    ...shelfItems,
    ...projectItems,
  ]) {
    for (const tag of item.data.tags) {
      const slug = slugifyTag(tag);
      const existing = tagCounts.get(slug);
      if (existing) {
        existing.count++;
      } else {
        tagCounts.set(slug, { display: tag, count: 1 });
      }
    }
  }

  const sortedTags = Array.from(tagCounts.entries()).sort((a, b) =>
    a[1].display.localeCompare(b[1].display)
  );

  return (
    <>
      <section className="py-8">
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <Tag size={32} className="text-terracotta" />
          Tags
        </h1>
        <p className="text-ink-secondary mb-8">Browse content by topic.</p>
      </section>

      <div className="flex flex-wrap gap-3">
        {sortedTags.map(([slug, { display, count }]) => (
          <Link
            key={slug}
            href={`/tags/${slug}`}
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-border text-ink-secondary rounded-lg hover:border-terracotta hover:text-terracotta transition-colors no-underline"
          >
            {display}
            <span className="text-ink-faint">({count})</span>
          </Link>
        ))}
      </div>
    </>
  );
}
