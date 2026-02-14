import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const investigations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/investigations' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string().max(200),
    youtubeId: z.string(),
    thumbnail: z.string().optional(),
    tags: z.array(z.string()).default([]),
    sources: z.array(z.object({
      title: z.string(),
      url: z.string().url(),
    })).default([]),
    related: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const fieldNotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/field-notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    excerpt: z.string().max(300).optional(),
    draft: z.boolean().default(false),
  }),
});

const shelf = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/shelf' }),
  schema: z.object({
    title: z.string(),
    creator: z.string(),
    type: z.enum(['book', 'video', 'podcast', 'article', 'tool', 'album', 'other']),
    annotation: z.string(),
    url: z.string().url().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

const toolkit = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/toolkit' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['production', 'tools', 'philosophy', 'automation']),
    order: z.number().default(0),
  }),
});

export const collections = {
  investigations,
  'field-notes': fieldNotes,
  shelf,
  toolkit,
};
