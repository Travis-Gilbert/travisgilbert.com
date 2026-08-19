import type { Metadata } from 'next';
import Link from 'next/link';
import { publishedProjects } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Software, housing, documentaries, festivals, and tools.',
};

export default function ProjectsPage() {
  const projects = publishedProjects();

  return (
    <>
      <p className="kicker gold">Work</p>
      <h1>Projects</h1>
      <p className="lede">
        Software systems, housing, documentaries, community festivals, and research tools. The
        medium changes. The question does not: how do design decisions shape human outcomes?
      </p>
      {projects.length === 0 ? (
        <p className="empty">No projects yet.</p>
      ) : (
        <ul className="entry-list">
          {projects.map((project) => (
            <li key={project.slug}>
              <Link href={`/projects/${project.slug}`} className="entry-link">
                <span className="entry-date">{project.data.year}</span>
                <span>
                  <span className="entry-title">{project.data.title}</span>
                  <p className="entry-summary">
                    {project.data.role}
                    {project.data.organization ? ` · ${project.data.organization}` : ''}
                    {`. ${project.data.description}`}
                  </p>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
