import { Feed } from 'feed';
import { getCollection } from '@/lib/content';
import type { Investigation, FieldNote } from '@/lib/content';

export const dynamic = 'force-static';

const SITE_URL = 'https://travisgilbert.com';

export function GET() {
  const feed = new Feed({
    title: 'Travis Gilbert',
    description:
      'Investigations, field notes, and explorations into how design decisions shape human outcomes.',
    id: SITE_URL,
    link: SITE_URL,
    language: 'en',
    copyright: `${new Date().getFullYear()} Travis Gilbert`,
    feedLinks: {
      rss2: `${SITE_URL}/rss.xml`,
    },
    author: {
      name: 'Travis Gilbert',
      link: SITE_URL,
    },
  });

  const fieldNotes = getCollection<FieldNote>('field-notes')
    .filter((n) => !n.data.draft)
    .map((note) => ({
      title: note.data.title,
      date: note.data.date,
      description: note.data.excerpt || note.data.title,
      link: `${SITE_URL}/field-notes/${note.slug}`,
    }));

  const investigations = getCollection<Investigation>('investigations')
    .filter((i) => !i.data.draft)
    .map((investigation) => ({
      title: investigation.data.title,
      date: investigation.data.date,
      description: investigation.data.summary,
      link: `${SITE_URL}/investigations/${investigation.slug}`,
    }));

  const allItems = [...fieldNotes, ...investigations].sort(
    (a, b) => b.date.valueOf() - a.date.valueOf()
  );

  for (const item of allItems) {
    feed.addItem({
      title: item.title,
      id: item.link,
      link: item.link,
      description: item.description,
      date: item.date,
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
