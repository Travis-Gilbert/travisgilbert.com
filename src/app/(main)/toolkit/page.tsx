// SOURCING: none: server data assembly for StackGraph, no upstream component applies
/**
 * /toolkit: the workspace graph.
 *
 * The stack list was a claim; this is evidence, extracted from the
 * workspaces by cargo-atlas. The server loads the artifact and computes
 * heat; StackGraph renders and handles interaction.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'iconoir-react';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import StackGraph from '@/components/StackGraph';
import { atlasHeat, loadAtlas } from '@/lib/workspace-graph';

export const metadata: Metadata = {
  title: 'Toolkit',
  description: 'The workspace graph: what exists, what depends on what, and where the recent work is.',
};

export const revalidate = 3600;

export default async function ToolkitPage() {
  const atlas = await loadAtlas();
  const heat = Object.fromEntries(atlasHeat(atlas, new Date()));

  const lastTouched: Record<string, string> = {};
  for (const event of atlas.events) {
    if (!lastTouched[event.object] || event.at > lastTouched[event.object]) {
      lastTouched[event.object] = event.at;
    }
  }

  const hrefs = Object.fromEntries(
    atlas.objects.map((object) => [object.id, `/toolkit/${encodeURIComponent(object.id)}`]),
  );

  return (
    <>
      <section className="py-4 sm:py-8" data-pagefind-ignore>
        <SectionLabel color="terracotta">Workshop Tools</SectionLabel>
        <h1 className="font-title-alt text-3xl md:text-4xl font-semibold mb-2 flex items-center gap-3">
          <DrawOnIcon name="wrench" size={32} color="var(--color-terracotta)" />
          Toolkit
        </h1>
        <p className="text-ink-secondary mb-2">
          The machine, drawn from evidence: every crate and package in the
          workspaces, extracted by{' '}
          <a
            href="https://github.com/Travis-Gilbert/cargo-atlas"
            className="text-gold hover:text-gold/80 transition-colors"
          >
            cargo-atlas
          </a>
          . Click a node to trace what it needs and what breaks without it.
          Recent work glows.
        </p>
      </section>

      <section className="mb-12">
        <StackGraph
          objects={atlas.objects}
          edges={atlas.edges}
          heat={heat}
          lastTouched={lastTouched}
          hrefs={hrefs}
        />
      </section>

      <section className="mb-12 border-t border-border pt-8">
        <h2 className="font-title-alt text-2xl font-semibold mb-3">
          Reference Shelf
        </h2>
        <p className="text-ink-secondary mb-4">
          Books, articles, and sources that inform the work here. Annotated with notes on why each one matters.
        </p>
        <Link
          href="/shelf"
          className="inline-flex items-center gap-1.5 font-mono text-sm text-gold hover:text-gold/80 transition-colors"
        >
          Browse the shelf <ArrowRight width={14} height={14} strokeWidth={2.5} />
        </Link>
      </section>
    </>
  );
}
