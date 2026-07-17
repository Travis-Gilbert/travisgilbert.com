// SOURCING: none: derived stub page from graph data, no upstream component applies
/**
 * /toolkit/:id: derived stub for one workspace object.
 *
 * The build writes one of these per object, so prose is only needed for the
 * few that matter. Everything here is derived from the graph artifact:
 * name, version, dependents, LOC, last touched, and the neighborhood.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SectionLabel from '@/components/SectionLabel';
import { getCollection } from '@/lib/content';
import { atlasHeat, atlasNeighborhood, loadAtlas } from '@/lib/workspace-graph';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const atlas = await loadAtlas();
  return atlas.objects.map((object) => ({ id: object.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: decodeURIComponent(id) };
}

export default async function ToolkitObjectPage({ params }: PageProps) {
  const id = decodeURIComponent((await params).id);
  const atlas = await loadAtlas();
  const object = atlas.objects.find((o) => o.id === id);
  if (!object) notFound();

  const { ancestors, descendants } = atlasNeighborhood(atlas, id);
  const heat = atlasHeat(atlas, new Date()).get(id) ?? 0;
  const events = atlas.events.filter((e) => e.object === id);
  const lastTouched = events.reduce<string | undefined>(
    (latest, e) => (!latest || e.at > latest ? e.at : latest),
    undefined,
  );
  const directDependents = atlas.edges.filter((e) => e.to === id).length;
  const projectSlug = getCollection<{ title: string }>('projects').find(
    (entry) => entry.slug === id,
  )?.slug;

  const facts: Array<[string, string]> = [
    ['kind', object.kind],
    ['workspace', object.workspace],
    ...(object.version ? ([['version', object.version]] as Array<[string, string]>) : []),
    ...(object.loc !== undefined
      ? ([['lines of code', object.loc.toLocaleString()]] as Array<[string, string]>)
      : []),
    ['direct dependents', String(directDependents)],
    ['breaks without it', String(descendants.length)],
    ...(lastTouched ? ([['last touched', lastTouched.slice(0, 10)]] as Array<[string, string]>) : []),
    ['heat', heat.toFixed(2)],
  ];

  return (
    <section className="py-4 sm:py-8">
      <SectionLabel color="terracotta">Workshop Tools</SectionLabel>
      <h1 className="font-title-alt text-3xl font-semibold mb-2">{object.id}</h1>
      {object.summary && <p className="text-ink-secondary mb-6">{object.summary}</p>}

      <dl className="font-mono text-sm grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 mb-8">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-secondary">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {ancestors.length > 0 && (
        <div className="mb-6">
          <h2 className="font-title-alt text-lg font-semibold mb-2">What it needs</h2>
          <ul className="font-mono text-sm flex flex-wrap gap-x-4 gap-y-1">
            {ancestors.map((a) => (
              <li key={a}>
                <Link href={`/toolkit/${encodeURIComponent(a)}`} className="text-teal hover:opacity-80">
                  {a}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {descendants.length > 0 && (
        <div className="mb-6">
          <h2 className="font-title-alt text-lg font-semibold mb-2">What breaks without it</h2>
          <ul className="font-mono text-sm flex flex-wrap gap-x-4 gap-y-1">
            {descendants.map((d) => (
              <li key={d}>
                <Link href={`/toolkit/${encodeURIComponent(d)}`} className="text-gold hover:opacity-80">
                  {d}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {projectSlug && (
        <p className="mb-6">
          <Link href="/projects" className="font-mono text-sm text-gold hover:text-gold/80">
            Read the project write-up →
          </Link>
        </p>
      )}

      <Link href="/toolkit" className="font-mono text-sm text-ink-secondary hover:text-ink">
        ← back to the graph
      </Link>
    </section>
  );
}
