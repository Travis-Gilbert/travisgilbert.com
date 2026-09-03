/**
 * D9's tree, and the ident grammar C12 constrains.
 *
 * C12 says a grid row's ident equals the field node's ident. That forces idents
 * to be keyed on what a node is rather than on which part kind drew it, and it
 * forces the tree to be built once and projected twice rather than built twice.
 * These tests hold both ends: the grammar, and the fact that the HTML projection
 * and the field are reading the same tree.
 */

import { describe, expect, it } from 'vitest';

import { getPortfolioConfig } from '@/lib/portfolio/allowlist';
import { loadFieldSnapshot } from '@/lib/portfolio/snapshot';
import {
  CAMERA_IDENT,
  CAPABILITY_IDENT,
  MAX_VISIBLE_CLUSTERS,
  ROOT_IDENT,
  STORAGE_IDENT,
  buildSemanticTree,
  clusterIdent,
  flattenTree,
  formatBytes,
  repoIdent,
  symbolIdent,
} from '@/lib/portfolio/semanticTree';

const snapshot = loadFieldSnapshot();
const config = getPortfolioConfig();
const tree = buildSemanticTree({ snapshot, config });
const nodes = flattenTree(tree);

describe('semantic tree', () => {
  it('raises a node per allowlisted repo', () => {
    const repos = tree.children.filter((node) => node.kind === 'repo');
    expect(repos).toHaveLength(snapshot.binary.repoCount);
    expect(repos.map((node) => node.ident)).toEqual(
      snapshot.sideTable.repos.map((repo) => repoIdent(repo.id)),
    );
  });

  it('bounds visible clusters at C11 sixty four', () => {
    const clusters = tree.children.filter((node) => node.kind === 'cluster');
    expect(clusters.length).toBeLessThanOrEqual(MAX_VISIBLE_CLUSTERS);
    // Largest first, so the cap drops the smallest clusters rather than an
    // arbitrary tail.
    for (let i = 1; i < clusters.length; i += 1) {
      expect(Number(clusters[i - 1].data?.size)).toBeGreaterThanOrEqual(
        Number(clusters[i].data?.size),
      );
    }
  });

  it('carries the camera, storage and capability nodes the field dispatches against', () => {
    const idents = new Set(nodes.map((node) => node.ident));
    expect(idents.has(CAMERA_IDENT)).toBe(true);
    expect(idents.has(STORAGE_IDENT)).toBe(true);
    expect(idents.has(CAPABILITY_IDENT)).toBe(true);
  });

  it('claims no residency before a renderer has attached', () => {
    // C9. The static projection is what a visitor has before any GPU is asked
    // anything, so the honest value is that nothing is resident.
    const capability = nodes.find((node) => node.ident === CAPABILITY_IDENT);
    expect(capability?.data?.residency).toBe(false);
    expect(capability?.data?.backend).toBe('none');
  });

  it('keys idents on what a node is, never on the part kind that drew it', () => {
    // C12: a grid row and a field node share an ident, so `portfolio.field/...`
    // or `portfolio.grid/...` would make the two views disagree by construction.
    for (const node of nodes) {
      expect(node.ident.startsWith(`${ROOT_IDENT}/`) || node.ident === ROOT_IDENT).toBe(true);
      expect(node.ident).not.toMatch(/portfolio\.(field|grid|thread)/);
    }
  });

  it('means the same node everywhere one ident appears', () => {
    // A symbol appears twice on purpose: once under its repo and once under its
    // cluster, because those are two true groupings of the same thing. What must
    // not happen is one ident standing for two different nodes, because then the
    // field and the grid would disagree about what C12 says they share.
    const byIdent = new Map<string, string>();
    for (const node of nodes) {
      const serialised = JSON.stringify(node);
      const seen = byIdent.get(node.ident);
      if (seen === undefined) byIdent.set(node.ident, serialised);
      else expect(serialised).toBe(seen);
    }
    expect(byIdent.size).toBeGreaterThan(0);
  });

  it('gives each grouping node a unique ident, since those carry HTML ids', () => {
    const grouping = nodes.filter((node) => node.kind !== 'symbol').map((node) => node.ident);
    expect(new Set(grouping).size).toBe(grouping.length);
  });

  it('builds idents through the exported helpers rather than by hand', () => {
    expect(repoIdent('repo:a/b')).toBe('portfolio/repo/repo:a/b');
    expect(clusterIdent(7)).toBe('portfolio/cluster/7');
    expect(symbolIdent('sym-1')).toBe('portfolio/symbol/sym-1');
  });

  it('links every symbol it shows to its declaration at the pinned revision', () => {
    const symbols = nodes.filter((node) => node.kind === 'symbol');
    expect(symbols.length).toBeGreaterThan(0);
    for (const symbol of symbols) {
      expect(symbol.href).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[0-9a-f]{40}\//);
    }
  });

  it('describes the field with the counts the payload actually carries', () => {
    expect(tree.data?.symbols).toBe(snapshot.binary.symbolCount);
    expect(tree.data?.edges).toBe(snapshot.binary.edgeCount);
    expect(tree.data?.repos).toBe(snapshot.binary.repoCount);
    expect(tree.data?.clusters).toBe(snapshot.binary.clusterCount);
  });

  it('is deterministic across builds', () => {
    const again = buildSemanticTree({ snapshot, config });
    expect(JSON.stringify(again)).toBe(JSON.stringify(tree));
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.0 MB'],
    [1024 * 1024 * 1024 * 2.5, '2.5 GB'],
  ])('renders %i as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
