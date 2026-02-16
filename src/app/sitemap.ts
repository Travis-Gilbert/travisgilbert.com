import type { MetadataRoute } from 'next';
import { getCollection } from '@/lib/content';
import type { Investigation, FieldNote, Project, ShelfEntry, WorkingIdea } from '@/lib/content';
import { slugifyTag } from '@/lib/slugify';

export const dynamic = 'force-static';

const BASE_URL = 'https://travisgilbert.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const investigations = getCollection<Investigation>('investigations').filter(
    (i) => !i.data.draft
  );
  const fieldNotes = getCollection<FieldNote>('field-notes').filter(
    (n) => !n.data.draft
  );
  const projects = getCollection<Project>('projects').filter(
    (p) => !p.data.draft
  );
  const shelfItems = getCollection<ShelfEntry>('shelf');
  const workingIdeas = getCollection<WorkingIdea>('working-ideas').filter(
    (i) => !i.data.draft
  );

  // Collect all unique tag slugs
  const tagSlugs = new Set<string>();
  for (const item of [
    ...investigations,
    ...fieldNotes,
    ...projects,
    ...shelfItems,
    ...workingIdeas,
  ]) {
    for (const tag of item.data.tags) {
      tagSlugs.add(slugifyTag(tag));
    }
  }

  return [
    // Static pages
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/investigations`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/working-ideas`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/field-notes`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/projects`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/shelf`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/toolkit`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/tags`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/colophon`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/connect`, changeFrequency: 'yearly', priority: 0.3 },

    // Dynamic investigation pages
    ...investigations.map((i) => ({
      url: `${BASE_URL}/investigations/${i.slug}`,
      lastModified: i.data.date,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),

    // Dynamic working idea pages
    ...workingIdeas.map((i) => ({
      url: `${BASE_URL}/working-ideas/${i.slug}`,
      lastModified: i.data.date,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),

    // Dynamic field note pages
    ...fieldNotes.map((n) => ({
      url: `${BASE_URL}/field-notes/${n.slug}`,
      lastModified: n.data.date,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),

    // Tag pages
    ...Array.from(tagSlugs).map((slug) => ({
      url: `${BASE_URL}/tags/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
  ];
}
