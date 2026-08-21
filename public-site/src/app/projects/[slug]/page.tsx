import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import TagList from '@/components/TagList';
import RoughLine from '@/components/rough/RoughLine';
import ReadingSurface from '@/components/ReadingSurface';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import {
  getEntry,
  hasBody,
  publishedProjects,
  renderMarkdown,
  type Project,
} from '@/lib/content';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return publishedProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<Project>('projects', slug);
  if (!entry || entry.data.draft) return {};
  return {
    title: entry.data.title,
    description: entry.data.description,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<Project>('projects', slug);
  if (!entry || entry.data.draft) notFound();

  const html = hasBody(entry.body) ? await renderMarkdown(entry.body) : '';

  return (
    <article>
      <header className="mb-8">
        <span className="block font-mono text-sm font-bold uppercase tracking-[0.1em] mb-2 select-none text-gold">
          Project
        </span>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="briefcase" size={32} color="var(--color-gold)" />
          {entry.data.title}
        </h1>
        <p className="font-mono text-sm text-ink-secondary mb-4">
          {entry.data.role}
          {entry.data.organization ? ` · ${entry.data.organization}` : ''}
          {` · ${entry.data.year}`}
        </p>
        <p className="text-ink-secondary max-w-prose leading-relaxed mb-4">
          {entry.data.description}
        </p>
        {entry.data.urls.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            {entry.data.urls.map((item) => (
              <a
                key={item.url}
                href={item.url}
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-terracotta hover:text-terracotta-hover no-underline"
              >
                {item.label} &rarr;
              </a>
            ))}
          </div>
        )}
        <TagList tags={entry.data.tags} tint="gold" />
        <div className="mt-4">
          <RoughLine />
        </div>
      </header>
      {html ? (
        <ReadingSurface>
          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        </ReadingSurface>
      ) : null}
      <nav className="py-4 border-t border-border mt-6">
        <Link href="/projects" className="font-mono text-sm hover:text-terracotta-hover">
          &larr; All projects
        </Link>
      </nav>
    </article>
  );
}
