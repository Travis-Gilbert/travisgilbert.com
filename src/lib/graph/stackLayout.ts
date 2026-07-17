// SOURCING: none: pure logic, no upstream component applies
/**
 * Deterministic layered (Sugiyama) layout for the workspace graph, oriented
 * vertically: dependents at the top, foundations at the bottom, so the page
 * scrolls the way the stack reads. Layer assignment and within-layer
 * ordering mirror cargo-atlas's SVG renderer (longest path from sinks,
 * median heuristic, lexicographic tie-breaks); only the orientation
 * differs, per user feedback that horizontal was hard to interact with.
 *
 * Wide layers wrap into multiple rows inside their band so the graph stays
 * near page width instead of sprawling sideways. Not force-directed: force
 * reshuffles on every run.
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

export const NODE_H = 44;
const H_GAP = 12;
const V_GAP = 10;
const BAND_GAP = 76;
const MARGIN = 20;
const CHAR_W = 9;
const PAD_X = 16;

export interface StackLayoutOptions {
  /** Wrap width for a band's rows; pass the measured container width. */
  maxRowW?: number;
}

export function stackLayout(atlas: Atlas, options: StackLayoutOptions = {}): StackLayout {
  const maxRowW = options.maxRowW ?? 1120;
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

  // Bands top to bottom: dependents (max layer) first, foundations last.
  // Nodes flow left to right within a band and wrap at maxRowW.
  const nodeW = (id: string) => Math.max(76, id.length * CHAR_W + PAD_X * 2);
  const nodes: StackNode[] = [];
  let yCursor = MARGIN;
  let width = 0;
  for (let l = maxLayer; l >= 0; l -= 1) {
    let x = MARGIN;
    let rowTop = yCursor;
    let bandBottom = yCursor;
    for (const v of layers[l]) {
      const id = ids[v];
      const w = nodeW(id);
      if (x > MARGIN && x + w > maxRowW) {
        x = MARGIN;
        rowTop = bandBottom + V_GAP;
      }
      nodes.push({
        id,
        workspace: workspaceOf.get(id) ?? '',
        layer: l,
        x,
        y: rowTop,
        w,
        h: NODE_H,
      });
      bandBottom = Math.max(bandBottom, rowTop + NODE_H);
      width = Math.max(width, x + w + MARGIN);
      x += w + H_GAP;
    }
    yCursor = bandBottom + BAND_GAP;
  }
  const height = yCursor - BAND_GAP + MARGIN;

  return { nodes, width, height };
}
