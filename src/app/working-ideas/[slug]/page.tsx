import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollection, getEntry, renderMarkdown } from '@/lib/content';
import type { WorkingIdea } from '@/lib/content';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import RoughLine from '@/components/rough/RoughLine';

interface Props {
  params: Promise<{ slug: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  seed: 'Seed',
  growing: 'Growing',
  pruning: 'Pruning',
};

export function generateStaticParams() {
  const ideas = getCollection<WorkingIdea>('working-ideas');
  return ideas.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<WorkingIdea>('working-ideas', slug);
  if (!entry) return {};
  return {
    title: `${entry.data.title} | Working Ideas`,
    description:
      entry.data.summary ??
      'A working idea still finding its shape.',
  };
}

export default async function WorkingIdeaDetailPage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<WorkingIdea>('working-ideas', slug);
  if (!entry) notFound();

  const html = await renderMarkdown(entry.body);

  return (
    <article className="py-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-terracotta font-bold">
            {STATUS_LABELS[entry.data.status] ?? entry.data.status}
          </span>
          <span className="text-ink-faint">·</span>
          <DateStamp date={entry.data.date} />
        </div>
        <h1 className="font-title text-3xl md:text-4xl font-bold mt-2 mb-4">
          {entry.data.title}
        </h1>
        {entry.data.tags.length > 0 && (
          <TagList tags={entry.data.tags} tint="terracotta" />
        )}
      </header>

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <RoughLine />

      <nav className="flex justify-center py-4">
        <Link
          href="/working-ideas"
          className="font-mono text-sm hover:text-terracotta-hover"
        >
          &larr; All Working Ideas
        </Link>
      </nav>
    </article>
  );
}
