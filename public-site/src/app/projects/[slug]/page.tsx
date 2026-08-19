import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Prose from '@/components/Prose';
import TagList from '@/components/TagList';
import {
  getEntry,
  hasBody,
  publishedProjects,
  renderMarkdown,
  type ProjectData,
} from '@/lib/content';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return publishedProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<ProjectData>('projects', slug);
  if (!entry || entry.data.draft) return {};
  return {
    title: entry.data.title,
    description: entry.data.description,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<ProjectData>('projects', slug);
  if (!entry || entry.data.draft) notFound();

  const html = hasBody(entry.body) ? await renderMarkdown(entry.body) : '';

  return (
    <article>
      <header className="article-header">
        <p className="kicker gold">Project</p>
        <h1>{entry.data.title}</h1>
        <p className="project-meta">
          {entry.data.role}
          {entry.data.organization ? ` · ${entry.data.organization}` : ''}
          {` · ${entry.data.year}`}
        </p>
        <p className="lede">{entry.data.description}</p>
        {entry.data.urls.length > 0 && (
          <ul className="project-urls">
            {entry.data.urls.map((item) => (
              <li key={item.url}>
                <a href={item.url} rel="noreferrer">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <TagList tags={entry.data.tags} />
      </header>
      {html ? <Prose html={html} /> : null}
    </article>
  );
}
