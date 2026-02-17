import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollection, getEntry, renderMarkdown } from '@/lib/content';
import type { Essay } from '@/lib/content';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import YouTubeEmbed from '@/components/YouTubeEmbed';
import RoughLine from '@/components/rough/RoughLine';
import SourcesCollapsible from '@/components/SourcesCollapsible';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  const essays = getCollection<Essay>('essays');
  return essays.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<Essay>('essays', slug);
  if (!entry) return {};
  return {
    title: `${entry.data.title} | Essays on ...`,
    description: entry.data.summary,
  };
}

export default async function EssayDetailPage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<Essay>('essays', slug);
  if (!entry) notFound();

  const html = await renderMarkdown(entry.body);

  return (
    <article className="py-8">
      <YouTubeEmbed
        videoId={entry.data.youtubeId}
        title={entry.data.title}
      />

      <header className="mt-6 mb-8">
        <DateStamp date={entry.data.date} />
        <h1 className="font-title text-3xl md:text-4xl font-bold mt-4 mb-2">
          {entry.data.title}
        </h1>
        <p className="text-ink-secondary text-lg mb-4">
          {entry.data.summary}
        </p>
        <TagList tags={entry.data.tags} />
      </header>

      <div
        className="prose prose-essays mt-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {entry.data.sources.length > 0 && (
        <>
          <RoughLine />
          <SourcesCollapsible sources={entry.data.sources} />
        </>
      )}

      <nav className="py-4 border-t border-border mt-6">
        <Link
          href="/essays"
          className="font-mono text-sm hover:text-terracotta-hover"
        >
          &larr; All essays
        </Link>
      </nav>
    </article>
  );
}
