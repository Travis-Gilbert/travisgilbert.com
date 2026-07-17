// SOURCING: none: server data assembly for StackGraph, no upstream component applies
/**
 * /toolkit: the workspace graph, full-bleed.
 *
 * The page is the graph. No header block, no framing box: the stack list
 * was a claim, this is evidence, extracted by cargo-atlas. The graph
 * breaks out of the main column to use the whole screen and the page
 * scrolls down the stack.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'iconoir-react';
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
      <section
        className="relative left-1/2 w-screen -translate-x-1/2 py-4 sm:py-6"
        data-pagefind-ignore
      >
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
