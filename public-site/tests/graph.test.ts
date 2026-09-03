/**
 * The graph stages between the embedder and the layout.
 *
 * Three things are pinned here, and each one is pinned because getting it wrong
 * once already produced a page that looked structured and was not:
 *
 *  - the embedder reads the fields `symbol_embedding_text` reads, and no others
 *  - `DECLARES_SYMBOL` is a real edge type, not tokens smuggled into the vector
 *  - communities are what `CsrGraph::community_detection` would find, not what
 *    a different Louvain with a tuned resolution would find
 *
 * The community cases are hand checkable graphs rather than corpus statistics,
 * because the property that matters is agreement with a specific Rust function,
 * and a statistic cannot tell you whether you agree with it.
 */

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line -- the fixture pipeline is JavaScript by design; it
// runs under `node --experimental-strip-types` with no build step.
import {
  DECLARES_FANOUT,
  buildDeclaresEdges,
  detectCommunities,
  embedSymbols,
  mergeEdgeTypes,
} from '../scripts/fixture/pipeline.mjs';

import {
  EDGE_TYPE_DECLARES_SYMBOL,
  EDGE_TYPE_NEAR,
} from '@/lib/portfolio/fieldSnapshot';
import { hashCodeEmbedding, symbolEmbeddingText } from '@/lib/portfolio/hashEmbedding';

/** Build a CSR out of per node neighbour lists, for the community cases. */
function csr(rows: Array<Array<[number, number]>>) {
  const csrOffsets = new Uint32Array(rows.length + 1);
  const neighbors: number[] = [];
  const weights: number[] = [];
  rows.forEach((row, node) => {
    csrOffsets[node] = neighbors.length;
    for (const [target, weight] of row) {
      neighbors.push(target);
      weights.push(weight);
    }
  });
  csrOffsets[rows.length] = neighbors.length;
  return {
    csrOffsets,
    csrNeighbors: Uint32Array.from(neighbors),
    csrWeights: Float32Array.from(weights),
  };
}

/** Group node indices by the cluster they landed in, as sorted member lists. */
function partition(clusterId: Uint16Array): number[][] {
  const groups = new Map<number, number[]>();
  clusterId.forEach((cluster, node) => {
    const members = groups.get(cluster) ?? [];
    members.push(node);
    groups.set(cluster, members);
  });
  return [...groups.values()].map((members) => members.sort((a, b) => a - b));
}

describe('what the fixture embeds', () => {
  it('embeds name and signature, and nothing the path would add', () => {
    const symbol = {
      name: 'parsePortfolioConfig',
      signature: 'export function parsePortfolioConfig(value: unknown)',
      path: 'src/lib/portfolio/allowlist.ts',
      repo: 'site',
    };

    const [vector] = embedSymbols([symbol], 384);
    const expected = hashCodeEmbedding(
      symbolEmbeddingText({ name: symbol.name, signature: symbol.signature }),
      384,
    );

    expect(Array.from(vector)).toEqual(Array.from(expected));
  });

  it('gives two symbols with one signature the same vector whatever file they sit in', () => {
    // This is the regression. An earlier revision appended path tokens, which
    // made the path decide similarity and then reported the path locality that
    // followed as evidence the field had structure.
    const shared = { name: 'render', signature: 'export function render()' };
    const [here, there] = embedSymbols(
      [
        { ...shared, path: 'src/atlas/render.ts', repo: 'atlas' },
        { ...shared, path: 'crates/forms/src/lib.rs', repo: 'forms' },
      ],
      384,
    );

    expect(Array.from(here)).toEqual(Array.from(there));
  });
});

describe('DECLARES_SYMBOL edges', () => {
  /** Five symbols in one file, two in another, one alone. */
  const symbols = [
    { repo: 'a', path: 'src/one.ts' },
    { repo: 'a', path: 'src/one.ts' },
    { repo: 'a', path: 'src/one.ts' },
    { repo: 'a', path: 'src/two.ts' },
    { repo: 'a', path: 'src/two.ts' },
    { repo: 'b', path: 'src/one.ts' },
  ];

  it('links declarations in one file and never across files', () => {
    const edges = buildDeclaresEdges(symbols);
    for (let node = 0; node < symbols.length; node += 1) {
      for (let e = edges.csrOffsets[node]; e < edges.csrOffsets[node + 1]; e += 1) {
        const other = edges.csrNeighbors[e];
        expect(other).not.toBe(node);
        expect(symbols[other].repo).toBe(symbols[node].repo);
        expect(symbols[other].path).toBe(symbols[node].path);
      }
    }
  });

  it('keeps one repo path apart from another repo with the same path', () => {
    // Node 5 shares `src/one.ts` with nodes 0 to 2 but sits in another repo, so
    // it is alone in its file and has no edges at all.
    const edges = buildDeclaresEdges(symbols);
    expect(edges.csrOffsets[6] - edges.csrOffsets[5]).toBe(0);
  });

  it('weighs an adjacent declaration above a distant one', () => {
    const edges = buildDeclaresEdges(symbols);
    const row = new Map<number, number>();
    for (let e = edges.csrOffsets[0]; e < edges.csrOffsets[1]; e += 1) {
      row.set(edges.csrNeighbors[e], edges.csrWeights[e]);
    }
    expect(row.get(1)).toBeCloseTo(0.5, 6);
    expect(row.get(2)).toBeCloseTo(1 / 3, 6);
  });

  it('bounds a row at twice the fanout however long the file is', () => {
    const long = Array.from({ length: 200 }, () => ({ repo: 'a', path: 'src/long.ts' }));
    const edges = buildDeclaresEdges(long);
    for (let node = 0; node < long.length; node += 1) {
      expect(edges.csrOffsets[node + 1] - edges.csrOffsets[node]).toBeLessThanOrEqual(
        DECLARES_FANOUT * 2,
      );
    }
  });

  it('emits each row in ascending index order', () => {
    const edges = buildDeclaresEdges(symbols);
    for (let node = 0; node < symbols.length; node += 1) {
      for (let e = edges.csrOffsets[node] + 1; e < edges.csrOffsets[node + 1]; e += 1) {
        expect(edges.csrNeighbors[e]).toBeGreaterThan(edges.csrNeighbors[e - 1]);
      }
    }
  });
});

describe('merging edge types', () => {
  const near = csr([[[1, 0.9]], [[0, 0.9]], []]);
  const declares = csr([[[2, 0.5]], [], [[0, 0.5]]]);
  const merged = mergeEdgeTypes(
    [
      { type: EDGE_TYPE_NEAR, edges: near },
      { type: EDGE_TYPE_DECLARES_SYMBOL, edges: declares },
    ],
    3,
  );

  it('keeps every edge and labels it with the set it came from', () => {
    // Two NEAR edges, both directions of one pair, plus two DECLARES edges.
    expect(merged.csrNeighbors.length).toBe(4);
    expect(merged.csrEdgeType.length).toBe(merged.csrNeighbors.length);
    // Node 0 has one of each, in type order.
    expect(Array.from(merged.csrEdgeType.slice(0, 2))).toEqual([
      EDGE_TYPE_NEAR,
      EDGE_TYPE_DECLARES_SYMBOL,
    ]);
    expect(Array.from(merged.csrNeighbors.slice(0, 2))).toEqual([1, 2]);
  });

  it('counts degree over every type, not just the semantic one', () => {
    // Node 2 has one DECLARES out edge and one DECLARES in edge, and no NEAR
    // edge at all. Counting NEAR alone would call it isolated.
    expect(merged.degree[2]).toBe(2);
    expect(merged.degree[0]).toBe(4);
  });
});

describe('communities, as graph_csr.rs would find them', () => {
  it('separates two components that share no edge', () => {
    const triangles = csr([
      [[1, 1], [2, 1]],
      [[0, 1], [2, 1]],
      [[0, 1], [1, 1]],
      [[4, 1], [5, 1]],
      [[3, 1], [5, 1]],
      [[3, 1], [4, 1]],
    ]);
    const { clusterId, clusterCount } = detectCommunities(
      triangles.csrOffsets,
      triangles.csrNeighbors,
      triangles.csrWeights,
    );
    expect(clusterCount).toBe(2);
    expect(partition(clusterId)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });

  it('numbers clusters by first appearance, the way compact_labels does', () => {
    // Node 0 is in the smaller group. Numbering by size would give it cluster 1.
    const graph = csr([
      [[1, 1]],
      [[0, 1]],
      [[3, 1], [4, 1]],
      [[2, 1], [4, 1]],
      [[2, 1], [3, 1]],
    ]);
    const { clusterId } = detectCommunities(
      graph.csrOffsets,
      graph.csrNeighbors,
      graph.csrWeights,
    );
    expect(clusterId[0]).toBe(0);
    expect(clusterId[2]).toBe(1);
  });

  it('gives every node its own cluster when there is no weight to optimise', () => {
    const empty = csr([[], [], []]);
    const { clusterId, clusterCount } = detectCommunities(
      empty.csrOffsets,
      empty.csrNeighbors,
      empty.csrWeights,
    );
    expect(clusterCount).toBe(3);
    expect(Array.from(clusterId)).toEqual([0, 1, 2]);
  });

  it('handles an empty field', () => {
    const nothing = csr([]);
    const { clusterId, clusterCount } = detectCommunities(
      nothing.csrOffsets,
      nothing.csrNeighbors,
      nothing.csrWeights,
    );
    expect(clusterCount).toBe(0);
    expect(clusterId.length).toBe(0);
  });

  it('splits a community that local moving left internally disconnected', () => {
    // Two triangles joined only through a hub. Local moving can pull the hub and
    // both triangles into one label; the Leiden refinement is what notices that
    // dropping the hub would leave the community in two pieces. Whether it fires
    // on this graph or not, no community may be internally disconnected.
    const hub = csr([
      [[1, 1], [2, 1]],
      [[0, 1], [2, 1]],
      [[0, 1], [1, 1], [3, 0.01]],
      [[2, 0.01], [4, 1], [5, 1]],
      [[3, 1], [5, 1]],
      [[3, 1], [4, 1]],
    ]);
    const { clusterId } = detectCommunities(
      hub.csrOffsets,
      hub.csrNeighbors,
      hub.csrWeights,
    );

    // Reachability inside each community, over the undirected projection.
    const adjacency = new Map<number, number[]>();
    for (let node = 0; node < 6; node += 1) adjacency.set(node, []);
    for (let node = 0; node < 6; node += 1) {
      for (let e = hub.csrOffsets[node]; e < hub.csrOffsets[node + 1]; e += 1) {
        adjacency.get(node)!.push(hub.csrNeighbors[e]);
        adjacency.get(hub.csrNeighbors[e])!.push(node);
      }
    }

    for (const members of partition(clusterId)) {
      const inCommunity = new Set(members);
      const seen = new Set([members[0]]);
      const queue = [members[0]];
      while (queue.length > 0) {
        for (const other of adjacency.get(queue.pop()!)!) {
          if (!inCommunity.has(other) || seen.has(other)) continue;
          seen.add(other);
          queue.push(other);
        }
      }
      expect(seen.size).toBe(members.length);
    }
  });

  it('is reproducible, which the payload hash depends on', () => {
    const graph = csr([
      [[1, 0.8], [2, 0.3]],
      [[0, 0.8], [2, 0.7]],
      [[0, 0.3], [1, 0.7], [3, 0.2]],
      [[2, 0.2], [4, 0.9]],
      [[3, 0.9]],
    ]);
    const once = detectCommunities(graph.csrOffsets, graph.csrNeighbors, graph.csrWeights);
    const twice = detectCommunities(graph.csrOffsets, graph.csrNeighbors, graph.csrWeights);
    expect(Array.from(once.clusterId)).toEqual(Array.from(twice.clusterId));
  });
});
