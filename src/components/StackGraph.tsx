// SOURCING: @xyflow/react (React Flow 12): canvas, pan/zoom, node and edge
// rendering. Layout stays deterministic in stackLayout (positions are
// computed, not force-directed); React Flow renders and handles interaction.
'use client';

/**
 * StackGraph: the workspace dependency graph on /toolkit.
 *
 * Mirrors ConnectionMap's contract: the server computes objects, edges,
 * heat, and hrefs and passes them down; the client renders. Layout is the
 * same layered algorithm as cargo-atlas's published SVG, oriented
 * vertically for the page.
 *
 * Interaction (Clew's click-to-path):
 *   Click a node    highlight its ancestors (what it needs) in Teal and its
 *                   descendants (what breaks without it) in Gold, animate
 *                   those edges, and dim the rest to 0.15 opacity.
 *   Pane click/Esc  clear.
 *   Hover/focus     tooltip with summary, version, dependent count.
 *   Arrow keys      walk edges from the focused node (down: dependency,
 *                   up: dependent, left/right: siblings). Enter selects.
 *
 * Heat scales node fill and stroke; hot nodes pulse slowly. Reduced motion
 * disables the pulse and the edge animation.
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Controls,
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
import { stackLayout } from '@/lib/graph/stackLayout';

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
  const borderWidth = d.state === 'selected' ? 2.5 : 1 + d.heat;
  const fill = `rgba(196, 154, 74, ${d.state === 'dimmed' ? 0.05 : 0.12 + d.heat * 0.55})`;
  return (
    <div
      className={`atlas-node ${d.heat > 0.7 && d.state !== 'dimmed' ? 'atlas-hot' : ''}`}
      style={{
        width: d.width,
        height: 30,
        borderRadius: 7,
        border: `${borderWidth}px solid ${border}`,
        background: fill,
        opacity: d.state === 'dimmed' ? 0.15 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-metadata, ui-monospace, monospace)',
        fontSize: 12.5,
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

export default function StackGraph({ objects, edges, heat, lastTouched, hrefs }: StackGraphProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const atlas = useMemo(() => ({ objects, edges, events: [] }), [objects, edges]);
  const layout = useMemo(() => stackLayout(atlas), [atlas]);
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
            strokeWidth: highlighted ? 1.8 : 1,
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
          50% { box-shadow: 0 0 10px 2px rgba(196, 154, 74, 0.18); }
        }
        .atlas-hot { animation: atlas-pulse 3.2s ease-in-out infinite; }
        .atlas-node .atlas-tip { display: none; }
        .atlas-node:hover .atlas-tip, .react-flow__node:focus .atlas-tip {
          display: block;
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          min-width: 200px;
          max-width: 300px;
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid ${GOLD};
          background: var(--color-paper, #F3EBDD);
          color: var(--color-ink, #2A2620);
          font-size: 11.5px;
          line-height: 1.45;
          z-index: 30;
          pointer-events: none;
          text-align: left;
        }
        .atlas-tip-title { font-weight: 700; }
        .atlas-tip-sub { color: ${TERRACOTTA}; margin-bottom: 2px; }
        .react-flow__node:focus { outline: none; }
        .react-flow__node:focus .atlas-node { border-color: ${TERRACOTTA} !important; }
        @media (prefers-reduced-motion: reduce) {
          .atlas-hot { animation: none; }
          .react-flow__edge-path { animation: none !important; }
        }
      `}</style>
      <div
        className="mb-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs font-semibold tracking-widest"
        style={{ color: TERRACOTTA }}
      >
        {workspaces.map((ws) => (
          <span key={ws}>{ws.toUpperCase()}</span>
        ))}
      </div>
      <div
        className="relative h-[78vh] min-h-[520px] rounded-lg border border-border"
        data-pagefind-ignore
        aria-label="Workspace dependency graph. Click a node to trace what it needs and what breaks without it."
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          onNodeClick={(_, node) =>
            setSelected((current) => (current === node.id ? null : node.id))
          }
          onPaneClick={() => setSelected(null)}
        >
          <Controls showInteractive={false} />
        </ReactFlow>
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
