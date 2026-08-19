import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate, noteExcerpt, publishedNotes } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Field Notes',
  description: 'Observations and running notes on design, infrastructure, and the built environment.',
};

export default function FieldNotesPage() {
  const notes = publishedNotes();

  return (
    <>
      <p className="kicker">Field observation</p>
      <h1>Field Notes</h1>
      <p className="lede">Observations, essays, and running notes.</p>
      {notes.length === 0 ? (
        <p className="empty">No field notes yet.</p>
      ) : (
        <ul className="entry-list">
          {notes.map((note) => (
            <li key={note.slug}>
              <Link href={`/field-notes/${note.slug}`} className="entry-link">
                <span className="entry-date">{formatDate(note.data.date)}</span>
                <span>
                  <span className="entry-title">{note.data.title}</span>
                  <p className="entry-summary">{noteExcerpt(note)}</p>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
