// SOURCING: @xyflow/react (React Flow 12): node and edge rendering. Viewport
// is pinned at zoom 1 with pan/zoom disabled: the page itself scrolls the
// graph. Layout stays deterministic in stackLayout.
'use client';

/**
 * StackGraph: the workspace dependency graph, full-bleed on /toolkit.
 *
 * The graph is the page: no framing box, no zoom controls. Nodes are sized
 * to be read at natural scale and the page scrolls down the stack, from
 * dependents at the top to foundations at the bottom. Workspace labels sit
 * stacked in the left margin (sticky) on wide screens.
 *
 * Interaction (Clew's click-to-path):
 *   Click a node    highlight its ancestors (what it needs) in Teal and its
 *                   descendants (what breaks without it) in Gold, animate
 *                   those edges, and dim the rest to 0.15 opacity. A fixed
 *                   bar at the bottom shows the selected object's facts.
 *   Pane click/Esc  clear.
 *   Hover/focus     tooltip with summary, version, dependent count.
 *   Arrow keys      walk edges from the focused node (down: dependency,
 *                   up: dependent, left/right: siblings). Enter selects.
 *
 * Heat scales node fill and stroke; hot nodes pulse slowly. Reduced motion
 * disables the pulse and the edge animation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Handle,
  Position,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AtlasEdge, AtlasObject } from '@/lib/graph/atlas';
import { atlasNeighborhood } from '@/lib/graph/atlas';
import { NODE_H, stackLayout } from '@/lib/graph/stackLayout';

const GOLD = '#C49A4A';
const TEAL = '#2D5F6B';
const TERRACOTTA = '#B45A2D';

type NodeState = 'idle' | 'selected' | 'ancestor' | 'descendant' | 'dimmed';

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

interface AtlasNodeData extends Record<string, unknown> {
  label: string;
  sub: string;
  summary?: string;
  dependents: number;
  state: NodeState;
  heat: number;
  width: number;
}

function AtlasFlowNode({ data }: NodeProps) {
  const d = data as AtlasNodeData;
  const border =
    d.state === 'selected' ? TERRACOTTA : d.state === 'ancestor' ? TEAL : GOLD;
  const borderWidth = d.state === 'selected' ? 3 : 1.25 + d.heat * 1.25;
  const fill = `rgba(196, 154, 74, ${d.state === 'dimmed' ? 0.05 : 0.12 + d.heat * 0.55})`;
  return (
    <div
      className={`atlas-node ${d.heat > 0.7 && d.state !== 'dimmed' ? 'atlas-hot' : ''}`}
      style={{
        width: d.width,
        height: NODE_H,
        borderRadius: 9,
        border: `${borderWidth}px solid ${border}`,
        background: fill,
        opacity: d.state === 'dimmed' ? 0.15 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-metadata, ui-monospace, monospace)',
        fontSize: 15,
        color: 'var(--color-ink, #2A2620)',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <span className="truncate px-1">{d.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
      <div className="atlas-tip" role="tooltip">
        <div className="atlas-tip-title">{d.label}</div>
        <div className="atlas-tip-sub">{d.sub}</div>
        {d.summary && <div className="atlas-tip-line">{d.summary}</div>}
        <div className="atlas-tip-line">{d.dependents} direct dependents</div>
      </div>
    </div>
  );
}

const nodeTypes = { atlas: AtlasFlowNode };
const STATIC_VIEWPORT = { x: 0, y: 0, zoom: 1 };

export default function StackGraph({ objects, edges, heat, lastTouched, hrefs }: StackGraphProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [graphWidth, setGraphWidth] = useState(1120);
  const graphRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 320) setGraphWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const atlas = useMemo(() => ({ objects, edges, events: [] }), [objects, edges]);
  const layout = useMemo(
    () => stackLayout(atlas, { maxRowW: graphWidth }),
    [atlas, graphWidth],
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
    (id: string): NodeState => {
      if (!selected || !neighborhood) return 'idle';
      if (id === selected) return 'selected';
      if (neighborhood.ancestors.has(id)) return 'ancestor';
      if (neighborhood.descendants.has(id)) return 'descendant';
      return 'dimmed';
    },
    [selected, neighborhood],
  );

  const flowNodes = useMemo<FlowNode[]>(
    () =>
      layout.nodes.map((node) => {
        const object = objectById.get(node.id);
        return {
          id: node.id,
          type: 'atlas',
          position: { x: node.x, y: node.y },
          draggable: false,
          connectable: false,
          data: {
            label: node.id,
            sub: object?.version
              ? `${object.kind} · v${object.version} · ${node.workspace}`
              : `${object?.kind ?? 'object'} · ${node.workspace}`,
            summary: object?.summary,
            dependents: dependents.get(node.id) ?? 0,
            state: nodeState(node.id),
            heat: heat[node.id] ?? 0,
            width: node.w,
          } satisfies AtlasNodeData,
        };
      }),
    [layout, objectById, dependents, nodeState, heat],
  );

  const flowEdges = useMemo<FlowEdge[]>(
    () =>
      edges.map((edge) => {
        let state: 'idle' | 'ancestor' | 'descendant' | 'dimmed' = 'idle';
        if (selected && neighborhood) {
          const inAncestry = (id: string) => id === selected || neighborhood.ancestors.has(id);
          const inDescent = (id: string) => id === selected || neighborhood.descendants.has(id);
          if (inAncestry(edge.from) && inAncestry(edge.to)) state = 'ancestor';
          else if (inDescent(edge.from) && inDescent(edge.to)) state = 'descendant';
          else state = 'dimmed';
        }
        const highlighted = state === 'ancestor' || state === 'descendant';
        return {
          id: `${edge.from}->${edge.to}`,
          source: edge.from,
          target: edge.to,
          animated: highlighted,
          focusable: false,
          style: {
            stroke: state === 'descendant' ? GOLD : TEAL,
            strokeOpacity: state === 'dimmed' ? 0.05 : state === 'idle' ? 0.3 : 0.9,
            strokeWidth: highlighted ? 2 : 1.2,
          },
        };
      }),
    [edges, selected, neighborhood],
  );

  const focusFlowNode = useCallback((id: string) => {
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
    el?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
        return;
      }
      const focused = (event.target as HTMLElement).closest('.react-flow__node');
      const id = focused?.getAttribute('data-id');
      if (!id) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelected((current) => (current === id ? null : id));
        return;
      }
      const walk = (next: string | undefined) => {
        if (!next) return;
        event.preventDefault();
        focusFlowNode(next);
        if (selected) setSelected(next);
      };
      if (event.key === 'ArrowDown') {
        walk(edges.find((e) => e.from === id)?.to);
      } else if (event.key === 'ArrowUp') {
        walk(edges.find((e) => e.to === id)?.from);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const node = layout.nodes.find((n) => n.id === id);
        if (!node) return;
        const siblings = layout.nodes
          .filter((n) => n.layer === node.layer)
          .sort((a, b) => a.y - b.y || a.x - b.x);
        const at = siblings.findIndex((n) => n.id === id);
        walk(siblings[event.key === 'ArrowRight' ? at + 1 : at - 1]?.id);
      }
    },
    [edges, focusFlowNode, layout.nodes, selected],
  );

  const workspaces = useMemo(
    () => [...new Set(objects.map((o) => o.workspace))].sort(),
    [objects],
  );

  const selectedObject = selected ? objectById.get(selected) : undefined;
  const selectedNeighborhood = selected ? atlasNeighborhood(atlas, selected) : null;

  return (
    <div onKeyDown={handleKeyDown}>
      <style>{`
        @keyframes atlas-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(196, 154, 74, 0.35); }
          50% { box-shadow: 0 0 12px 3px rgba(196, 154, 74, 0.18); }
        }
        .atlas-hot { animation: atlas-pulse 3.2s ease-in-out infinite; }
        .atlas-node .atlas-tip { display: none; }
        .atlas-node:hover .atlas-tip, .react-flow__node:focus .atlas-tip {
          display: block;
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          min-width: 220px;
          max-width: 320px;
          padding: 9px 12px;
          border-radius: 7px;
          border: 1px solid ${GOLD};
          background: var(--color-paper, #F3EBDD);
          color: var(--color-ink, #2A2620);
          font-size: 12.5px;
          line-height: 1.45;
          z-index: 30;
          pointer-events: none;
          text-align: left;
        }
        .atlas-tip-title { font-weight: 700; }
        .atlas-tip-sub { color: ${TERRACOTTA}; margin-bottom: 2px; }
        .react-flow__node:focus { outline: none; }
        .react-flow__node:focus .atlas-node { border-color: ${TERRACOTTA} !important; }
        .react-flow__attribution { background: transparent; }
        @media (prefers-reduced-motion: reduce) {
          .atlas-hot { animation: none; }
          .react-flow__edge-path { animation: none !important; }
        }
      `}</style>
      <div className="flex gap-2">
        <aside className="hidden lg:block w-44 shrink-0 pl-4">
          <div className="sticky top-24 font-mono text-xs">
            <div
              className="flex flex-col gap-2 font-semibold tracking-widest"
              style={{ color: TERRACOTTA }}
            >
              {workspaces.map((ws) => (
                <span key={ws}>{ws.toUpperCase()}</span>
              ))}
            </div>
            <p className="mt-6 text-ink-secondary leading-relaxed">
              Click a node to trace what it needs and what breaks without it.
              Recent work glows.
            </p>
            <p className="mt-3">
              <a
                href="https://github.com/Travis-Gilbert/cargo-atlas"
                className="text-gold hover:text-gold/80 transition-colors"
              >
                cargo-atlas
              </a>
            </p>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div
            className="mb-4 flex flex-wrap gap-x-5 gap-y-1 px-4 font-mono text-xs font-semibold tracking-widest lg:hidden"
            style={{ color: TERRACOTTA }}
          >
            {workspaces.map((ws) => (
              <span key={ws}>{ws.toUpperCase()}</span>
            ))}
          </div>
          <div
            ref={graphRef}
            style={{ height: layout.height }}
            data-pagefind-ignore
            aria-label="Workspace dependency graph. Click a node to trace what it needs and what breaks without it."
          >
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              viewport={STATIC_VIEWPORT}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              panOnDrag={false}
              panOnScroll={false}
              preventScrolling={false}
              nodesDraggable={false}
              nodesConnectable={false}
              edgesFocusable={false}
              onNodeClick={(_, node) =>
                setSelected((current) => (current === node.id ? null : node.id))
              }
              onPaneClick={() => setSelected(null)}
            />
          </div>
        </div>
      </div>
      {selectedObject && selectedNeighborhood && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border"
          style={{ background: 'var(--color-paper, #F3EBDD)' }}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 font-mono text-sm">
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
