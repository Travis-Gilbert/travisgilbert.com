// SOURCING: none: pure logic, no upstream component applies
/**
 * Workspace graph (cargo-atlas artifact) reader.
 *
 * Resolution mirrors the gateway clients: resolve an upstream from env, fall
 * back cleanly, never leak a fetch failure to the page. The committed
 * src/data/graph.json is the fallback source: the site works today off the
 * static file and lights up as a live read the moment a harness URL is set.
 * Same graph, same routes, no rewrite.
 *
 * Pure graph queries live in @/lib/graph/atlas (client-safe) and are
 * re-exported here so this module stays the one contract for consumers.
 */

import fallbackGraph from '@/data/graph.json';
import type { Atlas } from '@/lib/graph/atlas';

export type { Atlas, AtlasEdge, AtlasEvent, AtlasObject } from '@/lib/graph/atlas';
export { atlasHeat, atlasNeighborhood, atlasPath } from '@/lib/graph/atlas';

export class AtlasUpstreamError extends Error {
  constructor(upstream: string, cause: unknown) {
    super(`atlas upstream unreachable: ${upstream}`);
    this.name = 'AtlasUpstreamError';
    this.cause = cause;
  }
}

/**
 * Upstream resolution order: an explicit atlas URL, then the harness, then
 * the raw THG server: the first env var that resolves wins. Returns
 * undefined when nothing is configured, which is a supported state, not an
 * error: the committed artifact serves.
 */
export function resolveAtlasUpstream(): string | undefined {
  const explicit = process.env.THEOREM_ATLAS_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  for (const base of [process.env.THEOREM_HARNESS_URL, process.env.RUSTYRED_THG_URL]) {
    if (base) return `${base.replace(/\/+$/, '')}/api/graph`;
  }
  return undefined;
}

export async function loadAtlas(): Promise<Atlas> {
  const upstream = resolveAtlasUpstream();
  if (!upstream) return fallbackGraph as Atlas;
  try {
    const res = await fetch(upstream, { next: { revalidate: 3600 } });
    if (!res.ok) throw new AtlasUpstreamError(upstream, res.status);
    return (await res.json()) as Atlas;
  } catch (cause) {
    console.warn(new AtlasUpstreamError(upstream, cause).message);
    return fallbackGraph as Atlas;
  }
}
