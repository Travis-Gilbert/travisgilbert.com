// SOURCING: none: pure logic, no upstream component applies
/**
 * Deterministic layered (Sugiyama) layout for the workspace graph.
 *
 * Mirrors cargo-atlas's SVG renderer exactly: longest-path-from-sinks
 * layering, median-heuristic ordering, lexicographic tie-breaks: so the
 * site and the published SVG agree on shape. Not force-directed: force
 * reshuffles on every run and the two surfaces would drift apart.
 */

import type { Atlas } from '@/lib/graph/atlas';

export interface StackNode {
  id: string;
  workspace: string;
  layer: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StackLayout {
  nodes: StackNode[];
  width: number;
  height: number;
}

export const NODE_H = 26;
const ROW_GAP = 14;
const COL_GAP = 70;
const MARGIN = 24;
const HEADER_H = 34;
const CHAR_W = 6.9;
const PAD_X = 10;

export function stackLayout(atlas: Atlas): StackLayout {
  const ids = atlas.objects.map((o) => o.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const workspaceOf = new Map(atlas.objects.map((o) => [o.id, o.workspace]));

  const succ: number[][] = ids.map(() => []);
  const pred: number[][] = ids.map(() => []);
  for (const edge of atlas.edges) {
    const f = index.get(edge.from);
    const t = index.get(edge.to);
    if (f === undefined || t === undefined) continue;
    succ[f].push(t);
    pred[t].push(f);
  }

  // Longest path from sinks, with an on-stack guard for import cycles.
  const layer = new Array<number>(ids.length).fill(-1);
  const onStack = new Array<boolean>(ids.length).fill(false);
  const assign = (v: number): number => {
    if (layer[v] !== -1) return layer[v];
    if (onStack[v]) return 0;
    onStack[v] = true;
    let level = 0;
    for (const d of succ[v]) level = Math.max(level, assign(d) + 1);
    onStack[v] = false;
    layer[v] = level;
    return level;
  };
  for (let v = 0; v < ids.length; v += 1) assign(v);

  const maxLayer = layer.reduce((a, b) => Math.max(a, b), 0);
  const layers: number[][] = Array.from({ length: maxLayer + 1 }, () => []);
  layer.forEach((l, v) => layers[l].push(v));
  for (const row of layers) row.sort((a, b) => ids[a].localeCompare(ids[b]));

  // Median-heuristic sweeps, four fixed passes, ties broken by id.
  const rank = new Array<number>(ids.length).fill(0);
  const setRanks = () => {
    for (const row of layers) row.forEach((v, r) => (rank[v] = r));
  };
  setRanks();
  for (let pass = 0; pass < 4; pass += 1) {
    const downward = pass % 2 === 0;
    const order = downward
      ? Array.from({ length: maxLayer + 1 }, (_, i) => i)
      : Array.from({ length: maxLayer + 1 }, (_, i) => maxLayer - i);
    for (const l of order) {
      const keyed = layers[l].map((v) => {
        const neighbors = (downward ? pred[v] : succ[v]).map((u) => rank[u]).sort((a, b) => a - b);
        const median = neighbors.length === 0 ? rank[v] : neighbors[Math.floor(neighbors.length / 2)];
        return { median, id: ids[v], v };
      });
      keyed.sort((a, b) => a.median - b.median || a.id.localeCompare(b.id));
      layers[l] = keyed.map((k) => k.v);
      setRanks();
    }
  }

  const nodeW = (id: string) => Math.max(56, id.length * CHAR_W + PAD_X * 2);
  const colW = layers.map((row) => row.reduce((w, v) => Math.max(w, nodeW(ids[v])), 56));
  const tallest = layers.reduce((t, row) => Math.max(t, row.length), 1);
  const innerH = tallest * NODE_H + (tallest - 1) * ROW_GAP;
  const height = innerH + HEADER_H + MARGIN * 2;

  // Foundations (layer 0) leftmost, dependents rightward: the graph reads
  // left-to-right as "built on", and the dense hub columns lead.
  const colX = new Array<number>(maxLayer + 1).fill(0);
  let xCursor = MARGIN;
  for (let l = 0; l <= maxLayer; l += 1) {
    colX[l] = xCursor;
    xCursor += colW[l] + COL_GAP;
  }
  const width = xCursor - COL_GAP + MARGIN;

  const nodes: StackNode[] = [];
  layers.forEach((row, l) => {
    const blockH = row.length * NODE_H + (row.length - 1) * ROW_GAP;
    const y0 = HEADER_H + MARGIN + (innerH - blockH) / 2;
    row.forEach((v, r) => {
      const id = ids[v];
      nodes.push({
        id,
        workspace: workspaceOf.get(id) ?? '',
        layer: l,
        x: colX[l] + (colW[l] - nodeW(id)) / 2,
        y: y0 + r * (NODE_H + ROW_GAP),
        w: nodeW(id),
        h: NODE_H,
      });
    });
  });

  return { nodes, width, height };
}
