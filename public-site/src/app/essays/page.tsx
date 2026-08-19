import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate, publishedEssays } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Essays',
  description: 'Long form writing on how design decisions reshape cities, systems, and daily life.',
};

export default function EssaysPage() {
  const essays = publishedEssays();

  return (
    <>
      <p className="kicker terracotta">Writing</p>
      <h1>Essays</h1>
      <p className="lede">
        Long form examinations of how design decisions reshape cities, systems, and daily life.
      </p>
      {essays.length === 0 ? (
        <p className="empty">No essays yet.</p>
      ) : (
        <ul className="entry-list">
          {essays.map((essay) => (
            <li key={essay.slug}>
              <Link href={`/essays/${essay.slug}`} className="entry-link">
                <span className="entry-date">{formatDate(essay.data.date)}</span>
                <span>
                  <span className="entry-title">{essay.data.title}</span>
                  {essay.data.summary && <p className="entry-summary">{essay.data.summary}</p>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
