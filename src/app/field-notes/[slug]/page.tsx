import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollection, getEntry, renderMarkdown } from '@/lib/content';
import type { FieldNote } from '@/lib/content';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import RoughLine from '@/components/rough/RoughLine';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  const notes = getCollection<FieldNote>('field-notes');
  return notes.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<FieldNote>('field-notes', slug);
  if (!entry) return {};
  return {
    title: `${entry.data.title} — Field Notes`,
    description: entry.data.excerpt,
  };
}

export default async function FieldNoteDetailPage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<FieldNote>('field-notes', slug);
  if (!entry) notFound();

  const html = await renderMarkdown(entry.body);

  // Prev/next navigation
  const allNotes = getCollection<FieldNote>('field-notes')
    .filter((n) => !n.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const currentIndex = allNotes.findIndex((n) => n.slug === slug);
  const prevNote =
    currentIndex < allNotes.length - 1 ? allNotes[currentIndex + 1] : null;
  const nextNote = currentIndex > 0 ? allNotes[currentIndex - 1] : null;

  return (
    <article className="py-8">
      <header className="mb-8">
        <DateStamp date={entry.data.date} />
        <h1 className="font-title text-3xl md:text-4xl font-bold mt-4 mb-4">
          {entry.data.title}
        </h1>
        <TagList tags={entry.data.tags} />
      </header>

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <RoughLine />

      <nav className="flex justify-between items-start gap-4 py-4">
        <div>
          {prevNote && (
            <Link
              href={`/field-notes/${prevNote.slug}`}
              className="font-mono text-sm hover:text-terracotta-hover"
            >
              &larr; {prevNote.data.title}
            </Link>
          )}
        </div>
        <div className="text-right">
          {nextNote && (
            <Link
              href={`/field-notes/${nextNote.slug}`}
              className="font-mono text-sm hover:text-terracotta-hover"
            >
              {nextNote.data.title} &rarr;
            </Link>
          )}
        </div>
      </nav>
    </article>
  );
}
