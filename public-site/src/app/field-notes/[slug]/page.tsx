import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Prose from '@/components/Prose';
import TagList from '@/components/TagList';
import {
  estimateReadingTime,
  formatDate,
  getEntry,
  publishedNotes,
  renderMarkdown,
  type FieldNoteData,
} from '@/lib/content';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return publishedNotes().map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<FieldNoteData>('field-notes', slug);
  if (!entry || entry.data.draft) return {};
  return {
    title: entry.data.title,
    description: entry.data.excerpt,
  };
}

export default async function FieldNotePage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<FieldNoteData>('field-notes', slug);
  if (!entry || entry.data.draft) notFound();

  const html = await renderMarkdown(entry.body);

  return (
    <article>
      <header className="article-header">
        <p className="kicker">Field note</p>
        <h1>{entry.data.title}</h1>
        <p className="meta">
          {formatDate(entry.data.date)}
          <span aria-hidden="true"> · </span>
          {estimateReadingTime(entry.body)} min read
          {entry.data.status ? (
            <>
              <span aria-hidden="true"> · </span>
              {entry.data.status}
            </>
          ) : null}
        </p>
        <TagList tags={entry.data.tags} />
      </header>
      <Prose html={html} />
    </article>
  );
}
