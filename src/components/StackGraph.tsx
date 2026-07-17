// SOURCING: hand-roll: deterministic layered SVG over shared stackLayout; no
// library models a Sugiyama dependency graph with click-to-path semantics.
// Reuses GraphTooltip; d3 deliberately not used (no force simulation here).
'use client';

/**
 * StackGraph: the workspace dependency graph on /toolkit.
 *
 * Mirrors ConnectionMap's contract: the server computes objects, edges,
 * heat, and hrefs and passes them down; the client renders. Layout is the
 * same layered algorithm as cargo-atlas's published SVG, so the site and
 * the profile README agree on shape.
 *
 * Interaction (Clew's click-to-path):
 *   Click a node    highlight its ancestors (what it needs) in Teal and its
 *                   descendants (what breaks without it) in Gold; dim the
 *                   rest to 0.15 opacity.
 *   Background/Esc  clear.
 *   Hover           tooltip with summary, version, dependent count.
 *   Arrow keys      walk edges from the selected node (left: dependent,
 *                   right: dependency, up/down: siblings). Enter selects.
 *
 * Heat scales node opacity and stroke weight; hot nodes carry a slow pulse
 * that prefers-reduced-motion disables.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { AtlasEdge, AtlasObject } from '@/lib/graph/atlas';
import { atlasNeighborhood } from '@/lib/graph/atlas';
import { NODE_H, stackLayout, type StackNode } from '@/lib/graph/stackLayout';
import GraphTooltip from '@/components/GraphTooltip';

const GOLD = '#C49A4A';
const TEAL = '#2D5F6B';
const TERRACOTTA = '#B45A2D';

export interface StackGraphProps {
  objects: AtlasObject[];
  edges: AtlasEdge[];
  /** Object id -> heat in [0, 1], computed server-side via atlasHeat. */
  heat: Record<string, number>;
  /** Object id -> ISO date of the last commit touching it. */
  lastTouched: Record<string, string>;
  /** Object id -> detail href (project page or derived stub). */
  hrefs: Record<string, string>;
}

interface Tooltip {
  id: string;
  x: number;
  y: number;
}

export default function StackGraph({ objects, edges, heat, lastTouched, hrefs }: StackGraphProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());

  const atlas = useMemo(() => ({ objects, edges, events: [] }), [objects, edges]);
  const layout = useMemo(() => stackLayout(atlas), [atlas]);
  const nodeById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout],
  );
  const objectById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects]);
  const dependents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of edges) counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
    return counts;
  }, [edges]);

  const neighborhood = useMemo(() => {
    if (!selected) return null;
    const { ancestors, descendants } = atlasNeighborhood(atlas, selected);
    return { ancestors: new Set(ancestors), descendants: new Set(descendants) };
  }, [atlas, selected]);

  const nodeState = useCallback(
    (id: string): 'idle' | 'selected' | 'ancestor' | 'descendant' | 'dimmed' => {
      if (!selected || !neighborhood) return 'idle';
      if (id === selected) return 'selected';
      if (neighborhood.ancestors.has(id)) return 'ancestor';
      if (neighborhood.descendants.has(id)) return 'descendant';
      return 'dimmed';
    },
    [selected, neighborhood],
  );

  const edgeState = useCallback(
    (edge: AtlasEdge): 'idle' | 'ancestor' | 'descendant' | 'dimmed' => {
      if (!selected || !neighborhood) return 'idle';
      const inAncestry = (id: string) => id === selected || neighborhood.ancestors.has(id);
      const inDescent = (id: string) => id === selected || neighborhood.descendants.has(id);
      if (inAncestry(edge.from) && inAncestry(edge.to)) return 'ancestor';
      if (inDescent(edge.from) && inDescent(edge.to)) return 'descendant';
      return 'dimmed';
    },
    [selected, neighborhood],
  );

  const focusNode = useCallback((id: string) => {
    nodeRefs.current.get(id)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, id: string) => {
      if (event.key === 'Escape') {
        setSelected(null);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelected((current) => (current === id ? null : id));
        return;
      }
      const walk = (next: string | undefined) => {
        if (!next) return;
        event.preventDefault();
        focusNode(next);
        if (selected) setSelected(next);
      };
      if (event.key === 'ArrowRight') {
        walk(edges.find((e) => e.from === id)?.to);
      } else if (event.key === 'ArrowLeft') {
        walk(edges.find((e) => e.to === id)?.from);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const node = nodeById.get(id);
        if (!node) return;
        const column = layout.nodes
          .filter((n) => n.layer === node.layer)
          .sort((a, b) => a.y - b.y);
        const at = column.findIndex((n) => n.id === id);
        const next = column[event.key === 'ArrowDown' ? at + 1 : at - 1];
        walk(next?.id);
      }
    },
    [edges, focusNode, layout.nodes, nodeById, selected],
  );

  const showTooltip = useCallback((node: StackNode) => {
    setTooltip({ id: node.id, x: node.x + node.w / 2, y: node.y - 10 });
  }, []);

  const tooltipObject = tooltip ? objectById.get(tooltip.id) : undefined;

  const workspaces = useMemo(
    () => [...new Set(objects.map((o) => o.workspace))].sort(),
    [objects],
  );

  const selectedObject = selected ? objectById.get(selected) : undefined;
  const selectedNeighborhood = selected ? atlasNeighborhood(atlas, selected) : null;

  return (
    <div>
      <style>{`
        @keyframes stack-graph-pulse {
          0%, 100% { stroke-opacity: 1; }
          50% { stroke-opacity: 0.55; }
        }
        .stack-graph-hot { animation: stack-graph-pulse 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .stack-graph-hot { animation: none; }
        }
        .stack-graph-node:focus { outline: none; }
        .stack-graph-node:focus rect { stroke-width: 2.5; stroke: ${TERRACOTTA}; }
      `}</style>
      <div ref={containerRef} className="relative overflow-x-auto" data-pagefind-ignore>
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          role="application"
          aria-label="Workspace dependency graph. Click a node to trace what it needs and what breaks without it."
          onClick={() => setSelected(null)}
        >
          <g fill="none">
            {edges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);
              if (!from || !to) return null;
              const x1 = to.x + to.w;
              const y1 = to.y + NODE_H / 2;
              const x2 = from.x;
              const y2 = from.y + NODE_H / 2;
              const dx = Math.max(18, (x2 - x1) / 2);
              const state = edgeState(edge);
              const stroke = state === 'descendant' ? GOLD : TEAL;
              const opacity = state === 'dimmed' ? 0.06 : state === 'idle' ? 0.35 : 0.85;
              return (
                <path
                  key={`${edge.from}->${edge.to}`}
                  d={`M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`}
                  stroke={stroke}
                  strokeOpacity={opacity}
                  strokeWidth={state === 'idle' || state === 'dimmed' ? 1 : 1.6}
                />
              );
            })}
          </g>
          <g
            fontSize={12}
            fontWeight={600}
            fill={TERRACOTTA}
            letterSpacing="0.08em"
            fontFamily="var(--font-metadata, ui-monospace, monospace)"
          >
            {workspaces.map((ws, i) => (
              <text key={ws} x={24 + i * 180} y={22}>
                {ws.toUpperCase()}
              </text>
            ))}
          </g>
          <g fontSize={11.5} fontFamily="var(--font-metadata, ui-monospace, monospace)">
            {layout.nodes.map((node) => {
              const state = nodeState(node.id);
              const nodeHeat = heat[node.id] ?? 0;
              const dimmed = state === 'dimmed';
              const stroke =
                state === 'ancestor' ? TEAL : state === 'descendant' ? GOLD : GOLD;
              const fillOpacity = dimmed ? 0.05 : 0.12 + nodeHeat * 0.55;
              const opacity = dimmed ? 0.15 : 1;
              return (
                <g
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(node.id, el);
                    else nodeRefs.current.delete(node.id);
                  }}
                  className={`stack-graph-node ${nodeHeat > 0.7 ? 'stack-graph-hot' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={state === 'selected'}
                  aria-label={`${node.id}, ${objectById.get(node.id)?.kind ?? 'object'} in ${node.workspace}`}
                  opacity={opacity}
                  style={{ cursor: 'pointer' }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected((current) => (current === node.id ? null : node.id));
                  }}
                  onKeyDown={(event) => handleKeyDown(event, node.id)}
                  onMouseEnter={() => showTooltip(node)}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={() => showTooltip(node)}
                  onBlur={() => setTooltip(null)}
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.w}
                    height={node.h}
                    rx={6}
                    fill={GOLD}
                    fillOpacity={fillOpacity}
                    stroke={state === 'selected' ? TERRACOTTA : stroke}
                    strokeWidth={state === 'selected' ? 2.5 : 1 + nodeHeat}
                  />
                  <text
                    x={node.x + node.w / 2}
                    y={node.y + NODE_H / 2 + 4}
                    textAnchor="middle"
                    fill="var(--color-ink, #2A2620)"
                    fillOpacity={dimmed ? 0.5 : 0.65 + nodeHeat * 0.35}
                  >
                    {node.id}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {tooltip && tooltipObject && (
          <GraphTooltip
            title={tooltipObject.id}
            subtitle={
              tooltipObject.version
                ? `${tooltipObject.kind} · v${tooltipObject.version}`
                : tooltipObject.kind
            }
            lines={[
              ...(tooltipObject.summary ? [tooltipObject.summary] : []),
              `${dependents.get(tooltipObject.id) ?? 0} direct dependents`,
            ]}
            position={{ x: tooltip.x, y: tooltip.y }}
            visible
          />
        )}
      </div>
      {selectedObject && selectedNeighborhood && (
        <div className="mt-4 border-t border-border pt-4 font-mono text-sm">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-semibold" style={{ color: TERRACOTTA }}>
              {selectedObject.id}
            </span>
            {selectedObject.version && <span>v{selectedObject.version}</span>}
            <span style={{ color: TEAL }}>
              needs {selectedNeighborhood.ancestors.length}
            </span>
            <span style={{ color: GOLD }}>
              {selectedNeighborhood.descendants.length} break without it
            </span>
            {selectedObject.loc !== undefined && (
              <span>{selectedObject.loc.toLocaleString()} loc</span>
            )}
            {lastTouched[selectedObject.id] && (
              <span>last touched {lastTouched[selectedObject.id].slice(0, 10)}</span>
            )}
            {hrefs[selectedObject.id] && (
              <Link
                href={hrefs[selectedObject.id]}
                className="text-gold hover:text-gold/80 transition-colors"
              >
                details →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
