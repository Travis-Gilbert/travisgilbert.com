/**
 * D9's projection: the semantic tree rendered as HTML.
 *
 * This is what a crawler, a reader with no WebGPU, and a screen reader get, and
 * it is generated from the same tree the field raises rather than written twice.
 * It is a server component with no client JavaScript, so it is present in the
 * static export itself and does not wait on hydration to say anything.
 *
 * The heading levels matter more than they look: the route supplies the h1, so
 * every section here starts at h2 and repo names are h3. A projection that skips
 * a level reads as a broken outline to a screen reader even though it looks
 * identical.
 */

import CapabilityBadge from './CapabilityBadge';
import {
  CAPABILITY_IDENT,
  formatBytes,
  type SemanticNode,
} from '@/lib/portfolio/semanticTree';

/** Turn an ident into an id attribute that is unique and valid. */
function domId(ident: string): string {
  return `pf-${ident.replace(/[^A-Za-z0-9_-]+/g, '-')}`;
}

function nodeDataAttributes(node: SemanticNode): Record<string, string> {
  const attributes: Record<string, string> = { 'data-ident': node.ident };
  for (const [key, value] of Object.entries(node.data ?? {})) {
    attributes[`data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = String(value);
  }
  return attributes;
}

function SymbolList({ symbols }: { symbols: SemanticNode[] }) {
  if (symbols.length === 0) return null;

  return (
    <ul className="mt-2 mb-0 pl-0 list-none grid gap-1">
      {symbols.map((symbol) => (
        <li key={symbol.ident} className="m-0 leading-snug" {...nodeDataAttributes(symbol)}>
          {symbol.href ? (
            <a
              href={symbol.href}
              className="font-mono text-[13px] text-terracotta hover:text-terracotta-hover no-underline"
            >
              {symbol.label}
            </a>
          ) : (
            <span className="font-mono text-[13px]">{symbol.label}</span>
          )}
          {symbol.detail && (
            <span className="block font-mono text-[11px] text-ink-light truncate">
              {symbol.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function RepoSection({ repo }: { repo: SemanticNode }) {
  const withheld = repo.data?.bodyWithheld === true;

  return (
    <article
      className="border border-border-light rounded-sm p-4 bg-surface"
      {...nodeDataAttributes(repo)}
    >
      <h3 className="font-title text-lg font-bold m-0" id={domId(repo.ident)}>
        {repo.href ? (
          <a href={repo.href} className="no-underline text-ink hover:text-terracotta">
            {repo.label}
          </a>
        ) : (
          repo.label
        )}
      </h3>
      <p className="font-mono text-[11px] text-ink-light m-0 mt-1">
        {String(repo.data?.symbols ?? 0)} symbols at {String(repo.data?.revision ?? '')}
        {withheld && ' (structure only, bodies withheld)'}
      </p>
      {repo.detail && <p className="text-sm text-ink-secondary m-0 mt-2">{repo.detail}</p>}
      <SymbolList symbols={repo.children} />
    </article>
  );
}

function ClusterList({ clusters }: { clusters: SemanticNode[] }) {
  return (
    <ul className="pl-0 list-none grid gap-3 sm:grid-cols-2">
      {clusters.map((cluster) => (
        <li
          key={cluster.ident}
          className="m-0 border-l-2 border-gold/30 pl-3"
          {...nodeDataAttributes(cluster)}
        >
          <h3 className="font-mono text-[13px] font-bold m-0 text-ink" id={domId(cluster.ident)}>
            {cluster.label}
          </h3>
          {cluster.detail && (
            <p className="font-mono text-[11px] text-ink-light m-0">{cluster.detail}</p>
          )}
          <SymbolList symbols={cluster.children} />
        </li>
      ))}
    </ul>
  );
}

/** D7's numbers. A definition list because that is what a labelled number is. */
function StoragePanel({ storage }: { storage: SemanticNode }) {
  const data = storage.data ?? {};
  const rows: Array<[string, string]> = [
    ['Vector blocks', String(data.blocks ?? 0)],
    ['Unique bytes', formatBytes(Number(data.uniqueBytes ?? 0))],
    ['Referenced bytes', formatBytes(Number(data.referencedBytes ?? 0))],
    ['Dedupe ratio', `${Number(data.dedupeRatio ?? 1).toFixed(2)} to 1`],
    ['Resident bytes', formatBytes(Number(data.residentBytes ?? 0))],
    ['Disk bytes', formatBytes(Number(data.diskBytes ?? 0))],
  ];

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 m-0" {...nodeDataAttributes(storage)}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-light m-0">
            {term}
          </dt>
          <dd className="font-mono text-sm text-ink m-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The edge legend, which is the static half of D5's scrubber.
 *
 * Every row carries the ident the scrubber will toggle, so the crawlable page
 * and the painted field name the same edges. Until the leaf mounts these are
 * read only: there is nothing yet to switch off.
 */
function EdgeLegend({ edges }: { edges: SemanticNode }) {
  return (
    <ul className="list-none p-0 m-0 grid gap-2 sm:grid-cols-2" {...nodeDataAttributes(edges)}>
      {edges.children.map((edge) => {
        const share = Number(edge.data?.share ?? 0);
        return (
          <li
            key={edge.ident}
            className="border border-rule rounded p-3 grid gap-1"
            {...nodeDataAttributes(edge)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[12px] text-ink">{edge.label}</span>
              <span className="font-mono text-[11px] text-ink-light">
                {/* One decimal, because two shares rounded to whole numbers
                    added up to 101 percent and a legend that cannot count is
                    not a legend. */}
                {Number(edge.data?.count ?? 0).toLocaleString('en-US')} ({(share * 100).toFixed(1)}%)
              </span>
            </div>
            <p className="text-[13px] text-ink-secondary m-0 leading-snug">{edge.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}

export default function SemanticProjection({ tree }: { tree: SemanticNode }) {
  const repos = tree.children.filter((node) => node.kind === 'repo');
  const clusters = tree.children.filter((node) => node.kind === 'cluster');
  const edges = tree.children.find((node) => node.kind === 'edges');
  // The tree bounds cluster nodes at C11's sixty four. A page that showed a
  // slice while its own header counted the whole would be lying by omission.
  const clusterTotal = Number(tree.data?.clusters ?? clusters.length);
  const storage = tree.children.find((node) => node.kind === 'storage');
  const capability = tree.children.find((node) => node.kind === 'capability');
  const camera = tree.children.find((node) => node.kind === 'camera');

  return (
    <div className="grid gap-10" data-portfolio-projection="static" {...nodeDataAttributes(tree)}>
      {tree.detail && (
        <p className="text-sm text-ink-secondary m-0 max-w-2xl leading-relaxed">{tree.detail}</p>
      )}

      <section aria-labelledby="pf-repos">
        <h2
          id="pf-repos"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold m-0 mb-3"
        >
          Repositories
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {repos.map((repo) => (
            <RepoSection key={repo.ident} repo={repo} />
          ))}
        </div>
      </section>

      <section aria-labelledby="pf-clusters">
        <h2
          id="pf-clusters"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold m-0 mb-3"
        >
          Clusters
        </h2>
        {clusterTotal > clusters.length && (
          <p className="font-mono text-[11px] text-ink-light m-0 mb-3">
            The {clusters.length} largest of {clusterTotal.toLocaleString('en-US')}.
          </p>
        )}
        <ClusterList clusters={clusters} />
      </section>

      {edges && (
        <section aria-labelledby="pf-edges">
          <h2
            id="pf-edges"
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold m-0 mb-3"
          >
            Edges
          </h2>
          <EdgeLegend edges={edges} />
        </section>
      )}

      {storage && (
        <section aria-labelledby="pf-storage">
          <h2
            id="pf-storage"
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold m-0 mb-3"
          >
            Storage
          </h2>
          <StoragePanel storage={storage} />
        </section>
      )}

      <section aria-labelledby="pf-renderer">
        <h2
          id="pf-renderer"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold m-0 mb-3"
        >
          Renderer
        </h2>
        <CapabilityBadge
          ident={capability?.ident ?? CAPABILITY_IDENT}
          initial={capability?.detail ?? 'Static projection. No GPU layout, and no residency claimed.'}
        />
        {camera && (
          <p className="font-mono text-[11px] text-ink-light m-0 mt-1" {...nodeDataAttributes(camera)}>
            {camera.label}: {camera.detail}
          </p>
        )}
      </section>
    </div>
  );
}
