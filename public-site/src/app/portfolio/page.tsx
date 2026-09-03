/**
 * D10's host page.
 *
 * The route reads the snapshot at build time, raises D9's semantic tree from it,
 * and renders the tree inside the element the field will later adopt. Nothing
 * here waits on JavaScript: the static export carries the whole projection, so a
 * crawler and a reader with no GPU get the portfolio rather than an empty shell.
 *
 * The host element is the seam. When D4's `portfolio.field` part kind lands, the
 * leaf adopts `#portfolio-field` and paints into it. `gpui-leaf.js` adopts a host
 * with `host.replaceChildren(canvas)`, which removes the children below, so the
 * mount that lands with D4 has to re-append this projection underneath the canvas
 * rather than assume it survived.
 */

import type { Metadata } from 'next';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import SemanticProjection from '@/components/portfolio/SemanticProjection';
import { getPortfolioConfig } from '@/lib/portfolio/allowlist';
import { loadFieldSnapshot } from '@/lib/portfolio/snapshot';
import { buildSemanticTree, ROOT_IDENT } from '@/lib/portfolio/semanticTree';

export const metadata: Metadata = {
  title: 'Portfolio',
  description:
    'Every code symbol across the repositories I maintain, embedded into one space and grouped by what the code is about.',
};

/** The element the field adopts. Named once so D4 and the page cannot disagree. */
export const FIELD_HOST_ID = 'portfolio-field';

export default function PortfolioPage() {
  const config = getPortfolioConfig();
  const snapshot = loadFieldSnapshot();
  const tree = buildSemanticTree({ snapshot, config });

  const { symbolCount, edgeCount, repoCount, clusterCount } = snapshot.binary;

  return (
    <>
      <section className="py-4 sm:py-8" data-pagefind-ignore>
        <span className="block font-mono text-sm font-bold uppercase tracking-[0.1em] mb-2 select-none text-gold">
          Portfolio
        </span>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="network" size={44} color="var(--color-gold)" />
          The whole field, not a list of highlights.
        </h1>
        <p className="text-ink-secondary mb-2 max-w-xl font-light leading-relaxed">
          Every declaration across the repositories I maintain, embedded into one space
          and grouped by what the code is about rather than by which repository it
          happens to live in. Neighbours are neighbours because the code is similar.
        </p>
        <p className="font-mono text-[11px] text-ink-light m-0">
          {symbolCount.toLocaleString('en-US')} symbols &middot;{' '}
          {edgeCount.toLocaleString('en-US')} edges &middot; {repoCount} repositories &middot;{' '}
          {clusterCount} clusters
        </p>
      </section>

      <div id={FIELD_HOST_ID} data-gpui-host data-ident={ROOT_IDENT}>
        <SemanticProjection tree={tree} />
      </div>

      <section className="mt-16 pt-8 border-t border-border-light text-center">
        <p className="font-title text-lg italic text-ink-secondary max-w-lg mx-auto mb-6 leading-relaxed">
          A repository is where code is filed.
          <br />
          It is not what the code is about.
        </p>
        <div className="flex justify-center gap-6">
          {[
            { label: 'Projects', href: '/projects' },
            { label: 'Toolkit', href: '/toolkit' },
            { label: 'Connect', href: '/connect' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted no-underline hover:text-terracotta transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
