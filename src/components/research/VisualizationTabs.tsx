'use client';

/**
 * VisualizationTabs: tab switcher for the Paper Trails /research page.
 *
 * Renders a row of tab buttons and mounts the selected visualization.
 * Only the active visualization is mounted at any time to keep
 * DOM weight and D3 simulation costs down.
 *
 * The "Connections" tab renders the content relationship graph
 * (ConnectionMap) with server-computed node/edge data passed as props.
 */

import { useState } from 'react';
import SourceGraph from './SourceGraph';
import ResearchTimeline from './ResearchTimeline';
import SourceConstellation from './SourceConstellation';
import ActivityHeatmap from './ActivityHeatmap';
import SourceSankey from './SourceSankey';
import ConnectionMap from '@/components/ConnectionMap';

type TabId = 'graph' | 'connections' | 'timeline' | 'constellation' | 'activity' | 'sankey';

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'graph',
    label: 'Network',
    description: 'Force-directed graph of sources and content. Drag to rearrange, click for details.',
  },
  {
    id: 'connections',
    label: 'Connections',
    description: 'How essays, field notes, projects, and shelf items relate to each other across the site.',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Sources arranged chronologically by type. Hover for details.',
  },
  {
    id: 'constellation',
    label: 'Constellation',
    description: 'Radial layout grouping sources by type. More connections, closer to center.',
  },
  {
    id: 'activity',
    label: 'Activity',
    description: 'Calendar heatmap of daily research activity over the past year.',
  },
  {
    id: 'sankey',
    label: 'Flow',
    description: 'How sources connect to essays and field notes, colored by role.',
  },
];

/** Node shape expected by ConnectionMap (server-computed) */
interface ConnectionNode {
  id: string;
  slug: string;
  title: string;
  type: 'essay' | 'field-note' | 'project' | 'shelf';
  connectionCount: number;
  href: string;
}

/** Edge shape expected by ConnectionMap (server-computed) */
interface ConnectionEdge {
  source: string;
  target: string;
  type: string;
  strokeWidth: number;
}

interface VisualizationTabsProps {
  /** Pre-computed connection graph nodes (from connectionEngine) */
  connectionNodes?: ConnectionNode[];
  /** Pre-computed connection graph edges (from connectionEngine) */
  connectionEdges?: ConnectionEdge[];
}

export default function VisualizationTabs({
  connectionNodes = [],
  connectionEdges = [],
}: VisualizationTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('graph');

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-1.5 rounded font-mono text-[11px] tracking-wide uppercase
              transition-colors duration-150 border
              ${
                activeTab === tab.id
                  ? 'bg-surface-elevated border-border text-ink font-medium shadow-sm'
                  : 'bg-transparent border-transparent text-ink-light hover:text-ink hover:bg-surface-elevated/50'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-ink-secondary text-sm mb-4 font-body-alt">
        {currentTab.description}
      </p>

      {/* Active visualization */}
      <div className="min-h-[400px]">
        {activeTab === 'graph' && <SourceGraph />}
        {activeTab === 'connections' && (
          <ConnectionMap nodes={connectionNodes} edges={connectionEdges} />
        )}
        {activeTab === 'timeline' && <ResearchTimeline />}
        {activeTab === 'constellation' && <SourceConstellation />}
        {activeTab === 'activity' && <ActivityHeatmap />}
        {activeTab === 'sankey' && <SourceSankey />}
      </div>
    </div>
  );
}
