import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatDate,
  getNowData,
  noteExcerpt,
  publishedEssays,
  publishedNotes,
  publishedProjects,
} from '@/lib/content';
import { profile } from '@/lib/profile';

export const metadata: Metadata = {
  title: `${profile.name} | Essays, projects, and field notes`,
  description: profile.blurb,
};

export default function HomePage() {
  const now = getNowData();
  const essays = publishedEssays().slice(0, 4);
  const notes = publishedNotes().slice(0, 3);
  const projects = publishedProjects()
    .filter((project) => project.data.featured)
    .slice(0, 4);

  return (
    <>
      <section>
        <p className="kicker terracotta">Field journal</p>
        <h1>{profile.name}</h1>
        <p className="lede">
          {profile.blurb} Based in {profile.place}. Current work is Theorem, RustyRed, a civic
          atlas, and RustyWeb. Theseus is retired.
        </p>
      </section>

      {now && (
        <aside className="now-panel">
          <p className="kicker">Now</p>
          <h2>Where attention is</h2>
          <p className="meta">Updated {formatDate(new Date(now.updated))}</p>
          <dl className="now-fields">
            <div>
              <dt>Building</dt>
              <dd>
                {now.building}
                {now.building_context && <span className="context">{now.building_context}</span>}
              </dd>
            </div>
            <div>
              <dt>Researching</dt>
              <dd>
                {now.researching}
                {now.researching_context && (
                  <span className="context">{now.researching_context}</span>
                )}
              </dd>
            </div>
          </dl>
          <p style={{ margin: '1rem 0 0' }}>
            <Link href="/now" className="more-link">
              Full now page
            </Link>
          </p>
        </aside>
      )}

      <div className="home-grid">
        <section>
          <div className="section-head">
            <h2>Recent writing</h2>
            <Link href="/essays" className="more-link">
              All essays
            </Link>
          </div>
          {essays.length === 0 ? (
            <p className="empty">No published essays yet.</p>
          ) : (
            <ul className="entry-list">
              {essays.map((essay) => (
                <li key={essay.slug}>
                  <Link href={`/essays/${essay.slug}`} className="entry-link">
                    <span className="entry-date">{formatDate(essay.data.date)}</span>
                    <span>
                      <span className="entry-title">{essay.data.title}</span>
                      {essay.data.summary && (
                        <p className="entry-summary">{essay.data.summary}</p>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {notes.length > 0 && (
            <p style={{ marginTop: '1.25rem' }}>
              Latest field note:{' '}
              <Link href={`/field-notes/${notes[0].slug}`}>{notes[0].data.title}</Link>
              {notes[0].data.excerpt || noteExcerpt(notes[0])
                ? `. ${notes[0].data.excerpt ?? noteExcerpt(notes[0])}`
                : ''}
            </p>
          )}
        </section>

        <section>
          <div className="section-head">
            <h2>Projects</h2>
            <Link href="/projects" className="more-link">
              All projects
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="empty">No featured projects yet.</p>
          ) : (
            <ul className="entry-list">
              {projects.map((project) => (
                <li key={project.slug}>
                  <Link href={`/projects/${project.slug}`} className="entry-link">
                    <span className="entry-date">{project.data.year}</span>
                    <span>
                      <span className="entry-title">{project.data.title}</span>
                      <p className="entry-summary">{project.data.description}</p>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
