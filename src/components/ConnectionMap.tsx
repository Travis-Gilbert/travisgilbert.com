'use client';

/**
 * ConnectionMap: D3 force-directed graph showing content relationships.
 *
 * Two-layer rendering:
 *   Canvas (behind): rough.js hand-drawn edges
 *   SVG (front): colored nodes, labels, hover interactions
 *
 * Force simulation runs synchronously (300 iterations) for instant layout.
 * Disconnected nodes are pushed to a radial ring via forceRadial.
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import rough from 'roughjs';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface NodeData {
  id: string;
  slug: string;
  title: string;
  type: 'essay' | 'field-note' | 'project' | 'shelf';
  connectionCount: number;
  href: string;
}

interface EdgeData {
  source: string;
  target: string;
  type: string;
  strokeWidth: number;
}

interface ConnectionMapProps {
  nodes: NodeData[];
  edges: EdgeData[];
}

interface LayoutNode {
  x: number;
  y: number;
  radius: number;
  node: NodeData;
}

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  essay: '#B45A2D',
  'field-note': '#2D5F6B',
  project: '#C49A4A',
  shelf: '#5A7A4A',
};

const TYPE_LABELS: Record<string, string> = {
  essay: 'ESSAYS',
  'field-note': 'FIELD NOTES',
  project: 'PROJECTS',
  shelf: 'SHELF',
};

/** Warm gray for hand-drawn edges (matches parchment aesthetic) */
const EDGE_RGB = '140, 130, 120';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function truncateTitle(str: string, maxLen = 20): string {
  if (str.length <= maxLen) return str.toUpperCase();
  return str.slice(0, maxLen - 1).toUpperCase() + '\u2026';
}

/**
 * Run D3 force simulation synchronously and return final node positions.
 * 300 iterations is enough for convergence on graphs with <50 nodes.
 */
function computeLayout(
  nodes: NodeData[],
  edges: EdgeData[],
  width: number,
  height: number,
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const maxConn = Math.max(1, ...nodes.map((n) => n.connectionCount));

  interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    radius: number;
    nodeData: NodeData;
  }

  const simNodes: SimNode[] = nodes.map((n) => ({
    id: n.id,
    radius: 8 + (n.connectionCount / maxConn) * 16,
    nodeData: n,
  }));

  const simEdges: d3.SimulationLinkDatum<SimNode>[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  const simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>(simEdges)
        .id((d) => d.id)
        .distance(90),
    )
    .force('charge', d3.forceManyBody().strength(-150))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collision',
      d3.forceCollide<SimNode>().radius((d) => d.radius + 6),
    )
    .force(
      'radial',
      d3
        .forceRadial<SimNode>(
          (d) =>
            d.nodeData.connectionCount === 0
              ? Math.min(width, height) * 0.35
              : 0,
          width / 2,
          height / 2,
        )
        .strength((d) => (d.nodeData.connectionCount === 0 ? 0.3 : 0)),
    )
    .stop();

  for (let i = 0; i < 300; i++) simulation.tick();

  return simNodes.map((n) => ({
    x: Math.max(
      n.radius + 20,
      Math.min(width - n.radius - 20, n.x ?? width / 2),
    ),
    y: Math.max(
      n.radius + 20,
      Math.min(height - n.radius - 20, n.y ?? height / 2),
    ),
    radius: n.radius,
    node: n.nodeData,
  }));
}

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

export default function ConnectionMap({ nodes, edges }: ConnectionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const router = useRouter();

  const height = Math.max(500, Math.round(width * 0.6));

  const layout = useMemo(
    () => computeLayout(nodes, edges, width, height),
    [nodes, edges, width, height],
  );

  // Track container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw rough.js edges on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layout.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const rc = rough.canvas(canvas);
    const posMap = new Map(
      layout.map((l) => [l.node.id, { x: l.x, y: l.y }]),
    );

    // Connected IDs for hover highlighting
    const connectedIds = new Set<string>();
    if (hoveredId) {
      connectedIds.add(hoveredId);
      edges.forEach((e) => {
        if (e.source === hoveredId) connectedIds.add(e.target);
        if (e.target === hoveredId) connectedIds.add(e.source);
      });
    }

    edges.forEach((e) => {
      const from = posMap.get(e.source);
      const to = posMap.get(e.target);
      if (!from || !to) return;

      let alpha = 0.3;
      if (hoveredId) {
        const isConnected =
          connectedIds.has(e.source) && connectedIds.has(e.target);
        alpha = isConnected ? 0.6 : 0.06;
      }

      rc.line(from.x, from.y, to.x, to.y, {
        roughness: 1.5,
        stroke: `rgba(${EDGE_RGB}, ${alpha})`,
        strokeWidth: e.strokeWidth,
        bowing: 2,
      });
    });
  }, [layout, edges, hoveredId, width, height]);

  // Connected IDs for node dimming (computed in render for SVG)
  const connectedIds = new Set<string>();
  if (hoveredId) {
    connectedIds.add(hoveredId);
    edges.forEach((e) => {
      if (e.source === hoveredId) connectedIds.add(e.target);
      if (e.target === hoveredId) connectedIds.add(e.source);
    });
  }

  const presentTypes = [...new Set(nodes.map((n) => n.type))];

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', minHeight: 500, width: '100%' }}
    >
      {/* rough.js edge canvas (behind nodes) */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Node SVG (interactive layer; pointer-events only on nodes) */}
      <svg
        width={width}
        height={height}
        style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}
        role="img"
        aria-label="Content connection map showing relationships between essays, field notes, projects, and shelf items"
      >
        {layout.map(({ x, y, radius, node }) => {
          const dimmed = hoveredId !== null && !connectedIds.has(node.id);
          return (
            <g
              key={node.id}
              style={{
                cursor: 'pointer',
                pointerEvents: 'all',
                transition: 'opacity 200ms ease',
              }}
              opacity={dimmed ? 0.12 : 1}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => router.push(node.href)}
              role="link"
              tabIndex={0}
              aria-label={`${node.title} (${TYPE_LABELS[node.type]})`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(node.href);
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={NODE_COLORS[node.type]}
                fillOpacity={0.7}
                stroke={NODE_COLORS[node.type]}
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y + radius + 14}
                textAnchor="middle"
                fill="var(--color-ink-secondary)"
                style={{
                  fontFamily: 'var(--font-metadata)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                }}
              >
                {truncateTitle(node.title)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {presentTypes.map((type) => (
          <div
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-metadata)',
              fontSize: 9,
              letterSpacing: '0.06em',
              color: 'var(--color-ink-secondary)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: NODE_COLORS[type],
                opacity: 0.7,
              }}
            />
            {TYPE_LABELS[type]}
          </div>
        ))}
      </div>
    </div>
  );
}
