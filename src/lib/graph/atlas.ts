// SOURCING: none: pure logic, no upstream component applies
/**
 * Pure queries over the cargo-atlas workspace graph. No data imports, so
 * client components can use these without bundling the fallback artifact.
 * Server-side loading lives in @/lib/workspace-graph.
 */

export interface AtlasObject {
  id: string;
  kind: string;
  workspace: string;
  version?: string;
  path?: string;
  loc?: number;
  summary?: string;
  public: boolean;
}

export interface AtlasEdge {
  from: string;
  to: string;
  kind: string;
}

export interface AtlasEvent {
  object: string;
  at: string;
  kind: string;
  sha: string;
}

export type Atlas = {
  objects: AtlasObject[];
  edges: AtlasEdge[];
  events: AtlasEvent[];
  source_commit?: Record<string, string>;
  generated_at?: string;
};

/**
 * Shortest dependency chain from `from` to `to`, following depends_on
 * direction. Null when no path exists: callers surface that as a 404,
 * never as an empty array.
 */
export function atlasPath(atlas: Atlas, from: string, to: string): AtlasEdge[] | null {
  const outEdges = new Map<string, AtlasEdge[]>();
  for (const edge of atlas.edges) {
    const list = outEdges.get(edge.from) ?? [];
    list.push(edge);
    outEdges.set(edge.from, list);
  }
  const cameFrom = new Map<string, AtlasEdge>();
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === to) {
      const chain: AtlasEdge[] = [];
      let cursor = to;
      while (cursor !== from) {
        const edge = cameFrom.get(cursor) as AtlasEdge;
        chain.push(edge);
        cursor = edge.from;
      }
      return chain.reverse();
    }
    for (const edge of outEdges.get(current) ?? []) {
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        cameFrom.set(edge.to, edge);
        queue.push(edge.to);
      }
    }
  }
  return null;
}

/**
 * Ancestors answer "what does this need"; descendants answer "what breaks
 * without it". Both transitive, both sorted.
 */
export function atlasNeighborhood(
  atlas: Atlas,
  id: string,
): { ancestors: string[]; descendants: string[] } {
  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  for (const edge of atlas.edges) {
    forward.set(edge.from, [...(forward.get(edge.from) ?? []), edge.to]);
    reverse.set(edge.to, [...(reverse.get(edge.to) ?? []), edge.from]);
  }
  return {
    ancestors: reach(forward, id),
    descendants: reach(reverse, id),
  };
}

function reach(adjacency: Map<string, string[]>, start: string): string[] {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of adjacency.get(current) ?? []) {
      if (next !== start && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen].sort();
}

/** Half-life of the heat glow, in days. */
const HEAT_HALF_LIFE_DAYS = 14;

/**
 * Heat per object id in [0, 1], derived from commit-event recency at `now`.
 * Derived, never stored: storing heat would make the artifact
 * non-deterministic.
 */
export function atlasHeat(atlas: Atlas, now: Date): Map<string, number> {
  const lastTouch = new Map<string, number>();
  for (const event of atlas.events) {
    const at = Date.parse(event.at);
    if (Number.isNaN(at)) continue;
    lastTouch.set(event.object, Math.max(lastTouch.get(event.object) ?? 0, at));
  }
  const heat = new Map<string, number>();
  for (const object of atlas.objects) {
    const at = lastTouch.get(object.id);
    if (at === undefined) {
      heat.set(object.id, 0);
      continue;
    }
    const ageDays = Math.max(0, (now.getTime() - at) / 86_400_000);
    heat.set(object.id, Math.pow(0.5, ageDays / HEAT_HALF_LIFE_DAYS));
  }
  return heat;
}
