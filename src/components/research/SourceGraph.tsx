'use client';

/**
 * SourceGraph: D3.js force-directed graph of sources and content.
 *
 * Renders an interactive SVG network showing how sources connect
 * to essays and field notes. Click a node to see details, hover
 * to highlight connections, drag to rearrange.
 *
 * Data comes from GET /api/v1/graph/ which returns {nodes, edges}.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphResponse } from '@/lib/research';
import { fetchSourceGraph } from '@/lib/research';

// ─── Color mapping ───────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  // Source types
  book: '#C49A4A',
  article: '#B45A2D',
  paper: '#6B4A8A',
  video: '#A44A3A',
  podcast: '#5A7A4A',
  dataset: '#2D5F6B',
  document: '#8A7A5A',
  report: '#5A6A7A',
  map: '#4A7A5A',
  archive: '#7A6A4A',
  interview: '#6A5A7A',
  website: '#5A7A8A',
  other: '#6A5E52',
  // Content types
  essay: '#B45A2D',
  field_note: '#2D5F6B',
};

const EDGE_COLORS: Record<string, string> = {
  primary: '#B45A2D',
  background: '#9A8E82',
  inspiration: '#C49A4A',
  data: '#2D5F6B',
  counterargument: '#A44A3A',
  methodology: '#5A7A4A',
  reference: '#6A5E52',
};

// ─── Types for D3 simulation ─────────────────────────────────────────────────

interface SimNode extends GraphNode, d3.SimulationNodeDatum {}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  role: string;
}

interface DetailPanel {
  node: SimNode;
  connections: Array<{ label: string; type: string; role: string }>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SourceGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [detail, setDetail] = useState<DetailPanel | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  // Fetch graph data
  useEffect(() => {
    let cancelled = false;
    fetchSourceGraph().then((d) => {
      if (cancelled) return;
      setData(d);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Responsive sizing
  useEffect(() => {
    const updateSize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.max(500, Math.min(container.clientWidth * 0.65, 700)),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Build detail panel data
  const showDetail = useCallback((node: SimNode, edges: SimEdge[], nodes: SimNode[]) => {
    const connections: DetailPanel['connections'] = [];

    for (const edge of edges) {
      const sourceId = typeof edge.source === 'object' ? (edge.source as SimNode).id : edge.source;
      const targetId = typeof edge.target === 'object' ? (edge.target as SimNode).id : edge.target;

      if (sourceId === node.id) {
        const target = nodes.find((n) => n.id === targetId);
        if (target) connections.push({ label: target.label, type: target.type, role: edge.role });
      } else if (targetId === node.id) {
        const source = nodes.find((n) => n.id === sourceId);
        if (source) connections.push({ label: source.label, type: source.type, role: edge.role });
      }
    }

    setDetail({ node, connections });
  }, []);

  // D3 simulation
  useEffect(() => {
    if (!data || !svgRef.current) return;
    if (data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    // Clone data for D3 mutation
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const edges: SimEdge[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      role: e.role,
    }));

    // Simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(edges).id((d) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // Container group for zoom
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));

    svg.call(zoom);

    // Edges
    const edgeSelection = g
      .append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => EDGE_COLORS[d.role] || '#9A8E82')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4);

    // Nodes
    const nodeGroup = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer');

    // Source nodes: circles
    nodeGroup
      .filter((d) => d.type === 'source')
      .append('circle')
      .attr('r', 8)
      .attr('fill', (d) => NODE_COLORS[d.sourceType || 'other'] || '#6A5E52')
      .attr('stroke', '#F0EBE4')
      .attr('stroke-width', 1.5);

    // Content nodes: rounded rects
    nodeGroup
      .filter((d) => d.type !== 'source')
      .append('rect')
      .attr('width', 16)
      .attr('height', 16)
      .attr('x', -8)
      .attr('y', -8)
      .attr('rx', 3)
      .attr('fill', (d) => NODE_COLORS[d.type] || '#6A5E52')
      .attr('stroke', '#F0EBE4')
      .attr('stroke-width', 1.5);

    // Labels
    nodeGroup
      .append('text')
      .text((d) => d.label.length > 20 ? d.label.slice(0, 18) + '...' : d.label)
      .attr('dx', 14)
      .attr('dy', 4)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '10px')
      .attr('fill', 'var(--color-ink-muted)')
      .attr('pointer-events', 'none');

    // Interaction: hover highlight
    nodeGroup
      .on('mouseenter', function (_event, d) {
        const connectedIds = new Set<string>();
        connectedIds.add(d.id);
        edges.forEach((e) => {
          const srcId = typeof e.source === 'object' ? (e.source as SimNode).id : e.source;
          const tgtId = typeof e.target === 'object' ? (e.target as SimNode).id : e.target;
          if (srcId === d.id) connectedIds.add(tgtId as string);
          if (tgtId === d.id) connectedIds.add(srcId as string);
        });

        nodeGroup.attr('opacity', (n) => connectedIds.has(n.id) ? 1 : 0.15);
        edgeSelection.attr('stroke-opacity', (e) => {
          const srcId = typeof e.source === 'object' ? (e.source as SimNode).id : e.source;
          const tgtId = typeof e.target === 'object' ? (e.target as SimNode).id : e.target;
          return (srcId === d.id || tgtId === d.id) ? 0.8 : 0.05;
        });
      })
      .on('mouseleave', function () {
        nodeGroup.attr('opacity', 1);
        edgeSelection.attr('stroke-opacity', 0.4);
      })
      .on('click', function (_event, d) {
        showDetail(d, edges, nodes);
      });

    // Drag behavior
    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(drag);

    // Tick
    simulation.on('tick', () => {
      edgeSelection
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!);

      nodeGroup.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [data, dimensions, showDetail]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-[500px] text-ink-light font-mono text-sm">
        Loading graph...
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-ink-light font-body-alt text-sm">
        No research data yet. Sources will appear here as essays are linked to research.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="rounded-lg border border-border bg-surface"
        style={{ touchAction: 'none' }}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-[11px] font-mono text-ink-light">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#B45A2D' }} />
          Essay
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#2D5F6B' }} />
          Field Note
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#C49A4A' }} />
          Book
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#6B4A8A' }} />
          Paper
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#5A7A8A' }} />
          Website
        </span>
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="absolute top-4 right-4 w-72 bg-surface border border-border rounded-lg shadow-warm p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span
                className="inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded mb-1"
                style={{
                  backgroundColor: NODE_COLORS[detail.node.sourceType || detail.node.type] + '20',
                  color: NODE_COLORS[detail.node.sourceType || detail.node.type],
                }}
              >
                {detail.node.sourceType || detail.node.type}
              </span>
              <h3 className="font-title text-base font-bold text-ink leading-tight mt-1">
                {detail.node.label}
              </h3>
              {detail.node.creator && (
                <p className="text-[12px] text-ink-light font-body-alt mt-0.5">
                  {detail.node.creator}
                </p>
              )}
            </div>
            <button
              onClick={() => setDetail(null)}
              className="text-ink-light hover:text-ink text-lg leading-none"
              aria-label="Close detail panel"
            >
              &times;
            </button>
          </div>

          {detail.connections.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-light mb-2">
                Connections ({detail.connections.length})
              </p>
              <ul className="space-y-1.5">
                {detail.connections.map((c, i) => (
                  <li key={i} className="text-[12px] font-body-alt text-ink-muted leading-snug">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: NODE_COLORS[c.type] || '#6A5E52' }}
                    />
                    {c.label}
                    <span className="text-[10px] text-ink-light ml-1">({c.role})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
