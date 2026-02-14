import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const fieldNotes = await getCollection('field-notes');
  const investigations = await getCollection('investigations');

  const allItems = [
    ...fieldNotes
      .filter((n) => !n.data.draft)
      .map((note) => ({
        title: note.data.title,
        pubDate: note.data.date,
        description: note.data.excerpt || note.data.title,
        link: `/field-notes/${note.id}/`,
      })),
    ...investigations
      .filter((i) => !i.data.draft)
      .map((investigation) => ({
        title: investigation.data.title,
        pubDate: investigation.data.date,
        description: investigation.data.summary,
        link: `/investigations/${investigation.id}/`,
      })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: 'Travis Gilbert',
    description: 'Investigations, field notes, and explorations into how design decisions shape human outcomes.',
    site: context.site!,
    items: allItems,
    customData: '<language>en-us</language>',
  });
}
