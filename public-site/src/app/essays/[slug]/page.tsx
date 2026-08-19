import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Prose from '@/components/Prose';
import TagList from '@/components/TagList';
import {
  estimateReadingTime,
  formatDate,
  getEntry,
  publishedEssays,
  renderMarkdown,
  type EssayData,
} from '@/lib/content';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return publishedEssays().map((essay) => ({ slug: essay.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<EssayData>('essays', slug);
  if (!entry || entry.data.draft) return {};
  return {
    title: entry.data.title,
    description: entry.data.summary,
  };
}

export default async function EssayPage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<EssayData>('essays', slug);
  if (!entry || entry.data.draft) notFound();

  const html = await renderMarkdown(entry.body);
  const related = publishedEssays().filter((essay) => entry.data.related.includes(essay.slug));

  return (
    <article>
      <header className="article-header">
        <p className="kicker terracotta">Essay</p>
        <h1>{entry.data.title}</h1>
        <p className="meta">
          {formatDate(entry.data.date)}
          <span aria-hidden="true"> · </span>
          {estimateReadingTime(entry.body)} min read
          {entry.data.stage ? (
            <>
              <span aria-hidden="true"> · </span>
              {entry.data.stage}
            </>
          ) : null}
        </p>
        {entry.data.thesis && <p className="lede">{entry.data.thesis}</p>}
        <TagList tags={entry.data.tags} />
      </header>
      {entry.data.youtubeId && (
        <p>
          <a
            href={`https://www.youtube.com/watch?v=${entry.data.youtubeId}`}
            rel="noreferrer"
          >
            Watch the companion video
          </a>
        </p>
      )}
      <Prose html={html} />
      {entry.data.sources.length > 0 && (
        <section className="sources">
          <h2>Sources</h2>
          <ul>
            {entry.data.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} rel="noreferrer">
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {related.length > 0 && (
        <section className="related">
          <h2>Related</h2>
          <ul>
            {related.map((essay) => (
              <li key={essay.slug}>
                <Link href={`/essays/${essay.slug}`}>{essay.data.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
