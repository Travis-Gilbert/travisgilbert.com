/**
 * The portfolio's semantic tree, and the ident grammar it is keyed by.
 *
 * SPEC-AGPUI-SEMANTIC-TREE-1.0 owns `Ident`, `Snapshot` and `SnapshotDiff`, and
 * those crates are not on Theorem `main` yet. What the portfolio owes that spec
 * is not an implementation but a shape: the set of nodes the field raises, and
 * an ident for each that is stable across frames and identical between the two
 * views. C12 is explicit that a grid row's ident equals the field node's ident,
 * so an ident cannot mention which part kind produced it. `portfolio/repo/...`
 * is therefore right and `portfolio.field/repo/...` would be wrong.
 *
 * D9 projects this tree to HTML. D4 raises the same tree from the leaf. Keeping
 * one builder means the crawlable page and the painted field cannot describe
 * different portfolios.
 */

import type { FieldSnapshot, FieldSymbol } from './snapshot';
import { joinSymbols, representativeSymbols } from './snapshot';
import { symbolSourceUrl, repoRevisionUrl, type PortfolioConfig } from './allowlist';
import type { StorageAccounting } from './sideTable';

/** C11 bounds visible cluster labels; the tree bounds cluster nodes to match. */
export const MAX_VISIBLE_CLUSTERS = 64;

export const SYMBOLS_PER_REPO = 12;
export const SYMBOLS_PER_CLUSTER = 6;

export type SemanticKind =
  | 'root'
  | 'repo'
  | 'cluster'
  | 'symbol'
  | 'camera'
  | 'storage'
  | 'capability';

export interface SemanticNode {
  ident: string;
  kind: SemanticKind;
  label: string;
  /** One line of supporting text. Rendered, so it stays plain prose. */
  detail?: string;
  href?: string;
  /** Rendered as data attributes so the DOM mirror and the receipt agree. */
  data?: Record<string, string | number | boolean>;
  children: SemanticNode[];
}

export const ROOT_IDENT = 'portfolio';

export function repoIdent(repoId: string): string {
  return `${ROOT_IDENT}/repo/${repoId}`;
}

export function clusterIdent(clusterId: number): string {
  return `${ROOT_IDENT}/cluster/${clusterId}`;
}

export function symbolIdent(symbolId: string): string {
  return `${ROOT_IDENT}/symbol/${symbolId}`;
}

export const CAMERA_IDENT = `${ROOT_IDENT}/camera`;
export const STORAGE_IDENT = `${ROOT_IDENT}/storage`;
export const CAPABILITY_IDENT = `${ROOT_IDENT}/capability`;

export interface BuildTreeOptions {
  snapshot: FieldSnapshot;
  config: PortfolioConfig;
  maxClusters?: number;
  symbolsPerRepo?: number;
  symbolsPerCluster?: number;
}

export function buildSemanticTree(options: BuildTreeOptions): SemanticNode {
  const {
    snapshot,
    config,
    maxClusters = MAX_VISIBLE_CLUSTERS,
    symbolsPerRepo = SYMBOLS_PER_REPO,
    symbolsPerCluster = SYMBOLS_PER_CLUSTER,
  } = options;

  const symbols = joinSymbols(snapshot);
  const { sideTable, binary } = snapshot;

  const byRepo = groupBy(symbols, (symbol) => symbol.repoIndex);
  const byCluster = groupBy(symbols, (symbol) => symbol.clusterId);
  const configByRepoId = new Map(config.repos.map((repo) => [repo.id, repo]));

  const repoNodes = sideTable.repos.map((repo) => {
    const members = byRepo.get(repo.index) ?? [];
    const declared = configByRepoId.get(repo.id);

    return {
      ident: repoIdent(repo.id),
      kind: 'repo' as const,
      label: repo.name,
      detail: repo.blurb,
      href: declared ? repoRevisionUrl(declared, repo.revision) : repo.url,
      data: {
        symbols: members.length,
        revision: repo.revision.slice(0, 7),
        bodyWithheld: repo.bodyWithheld,
      },
      children: representativeSymbols(members, symbolsPerRepo).map((symbol) =>
        symbolNode(symbol, config),
      ),
    };
  });

  const clusterNodes = [...sideTable.clusters]
    .sort((a, b) => b.size - a.size || a.id - b.id)
    .slice(0, maxClusters)
    .map((cluster) => {
      const members = byCluster.get(cluster.id) ?? [];
      const repoNames = new Set(
        members.map((symbol) => sideTable.repos[symbol.repoIndex]?.name).filter(Boolean),
      );

      return {
        ident: clusterIdent(cluster.id),
        kind: 'cluster' as const,
        label: cluster.label,
        detail: `${cluster.size} symbols across ${repoNames.size} ${repoNames.size === 1 ? 'repo' : 'repos'}`,
        data: { size: cluster.size, repos: repoNames.size },
        children: representativeSymbols(members, symbolsPerCluster).map((symbol) =>
          symbolNode(symbol, config),
        ),
      };
    });

  return {
    ident: ROOT_IDENT,
    kind: 'root',
    label: 'Portfolio field',
    detail:
      `${binary.symbolCount} symbols and ${binary.edgeCount} nearest neighbour edges ` +
      `across ${binary.repoCount} repositories, grouped into ${binary.clusterCount} clusters.`,
    data: {
      symbols: binary.symbolCount,
      edges: binary.edgeCount,
      repos: binary.repoCount,
      clusters: binary.clusterCount,
    },
    children: [
      ...repoNodes,
      ...clusterNodes,
      cameraNode(),
      storageNode(sideTable.storage),
      capabilityNode(),
    ],
  };
}

function symbolNode(symbol: FieldSymbol, config: PortfolioConfig): SemanticNode {
  const repo = config.repos.find((candidate) => candidate.id === symbol.repo);
  return {
    ident: symbolIdent(symbol.id),
    kind: 'symbol',
    label: symbol.name,
    detail: symbol.signature || `${symbol.kind} in ${symbol.path}`,
    href: repo ? symbolSourceUrl(repo, symbol.revision, symbol.path, symbol.line) : undefined,
    data: {
      kind: symbol.kind,
      path: symbol.path,
      degree: symbol.degree,
      cluster: symbol.clusterId,
    },
    children: [],
  };
}

/**
 * The camera is a tree node because a screen reader needs to know where the
 * field is looking, and because D4 dispatches `FlyTo` against this ident.
 * Before a leaf mounts there is no camera, and saying so is the honest value.
 */
function cameraNode(): SemanticNode {
  return {
    ident: CAMERA_IDENT,
    kind: 'camera',
    label: 'Camera',
    detail: 'Framed on the whole field.',
    data: { x: 0, y: 0, zoom: 1 },
    children: [],
  };
}

function storageNode(storage: StorageAccounting): SemanticNode {
  return {
    ident: STORAGE_IDENT,
    kind: 'storage',
    label: 'Storage',
    detail: `${storage.blocks} vector blocks, ${storage.dedupeRatio.toFixed(2)} to 1 dedupe.`,
    data: {
      blocks: storage.blocks,
      uniqueBytes: storage.uniqueBytes,
      referencedBytes: storage.referencedBytes,
      dedupeRatio: storage.dedupeRatio,
      residentBytes: storage.residentBytes,
      diskBytes: storage.diskBytes,
    },
    children: [],
  };
}

/**
 * C9's badge. The static projection is what a visitor has before any renderer
 * attaches, so the honest initial value is that no renderer has, and that no
 * residency is claimed. The client replaces this text with what actually
 * happened rather than with what was hoped for.
 */
function capabilityNode(): SemanticNode {
  return {
    ident: CAPABILITY_IDENT,
    kind: 'capability',
    label: 'Renderer',
    detail: 'Static projection. No GPU layout, and no residency claimed.',
    data: { backend: 'none', residency: false },
    children: [],
  };
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const item of items) {
    const bucket = out.get(key(item));
    if (bucket) bucket.push(item);
    else out.set(key(item), [item]);
  }
  return out;
}

/** Flatten depth first, which is the order the DOM mirror and receipts use. */
export function flattenTree(node: SemanticNode): SemanticNode[] {
  return [node, ...node.children.flatMap(flattenTree)];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}
