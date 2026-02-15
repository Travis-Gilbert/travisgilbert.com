import { ArrowSquareOut, CaretRight } from '@phosphor-icons/react/dist/ssr';
import TagList from './TagList';

interface ProjectUrl {
  label: string;
  url: string;
}

interface ProjectEntry {
  title: string;
  role: string;
  description: string;
  year: number;
  date: Date;
  urls: ProjectUrl[];
  tags: string[];
}

interface ProjectTimelineProps {
  projects: ProjectEntry[];
}

export default function ProjectTimeline({ projects }: ProjectTimelineProps) {
  // Group projects by year (descending)
  const grouped = new Map<number, ProjectEntry[]>();
  for (const project of projects) {
    const year = project.year;
    if (!grouped.has(year)) {
      grouped.set(year, []);
    }
    grouped.get(year)!.push(project);
  }
  // Sort within each year by date descending
  for (const [, yearProjects] of grouped) {
    yearProjects.sort(
      (a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf()
    );
  }
  const yearGroups = Array.from(grouped.entries()).sort(
    (a, b) => b[0] - a[0]
  );

  return (
    <div className="timeline">
      {yearGroups.map(([year, yearProjects]) => (
        <div key={year} className="timeline-year-group">
          {/* Year marker */}
          <div className="timeline-year-marker">
            <span className="timeline-dot timeline-dot--year" />
            <span className="font-mono text-sm uppercase tracking-widest text-terracotta font-bold">
              {year}
            </span>
          </div>

          {/* Projects in this year */}
          {yearProjects.map((project) => (
            <div key={project.title} className="timeline-item">
              <span className="timeline-dot" />
              <details className="timeline-details">
                <summary className="timeline-summary">
                  <CaretRight
                    size={16}
                    weight="thin"
                    className="timeline-caret text-ink-faint"
                  />
                  <span className="font-title text-base font-bold text-ink">
                    {project.title}
                  </span>
                  <span className="font-mono text-xs text-ink-secondary">
                    {project.role}
                  </span>
                </summary>
                <div className="timeline-content">
                  <p className="text-sm text-ink-secondary m-0 mb-3">
                    {project.description}
                  </p>
                  {project.urls.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                      {project.urls.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-terracotta hover:text-terracotta-hover no-underline"
                        >
                          {link.label}
                          <ArrowSquareOut size={12} weight="thin" />
                        </a>
                      ))}
                    </div>
                  )}
                  <TagList tags={project.tags} />
                </div>
              </details>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
