// SOURCING: none: pure logic, no upstream component applies
import { afterEach, describe, expect, it } from 'vitest';

import committedGraph from '@/data/graph.json';
import {
  type Atlas,
  atlasHeat,
  atlasNeighborhood,
  atlasPath,
  loadAtlas,
  resolveAtlasUpstream,
} from '@/lib/workspace-graph';

const ENV_KEYS = ['THEOREM_ATLAS_URL', 'THEOREM_HARNESS_URL', 'RUSTYRED_THG_URL'] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('resolveAtlasUpstream', () => {
  it('is undefined when nothing is configured', () => {
    expect(resolveAtlasUpstream()).toBeUndefined();
  });

  it('derives from THEOREM_HARNESS_URL and clears when unset', () => {
    process.env.THEOREM_HARNESS_URL = 'https://harness.example/';
    expect(resolveAtlasUpstream()).toBe('https://harness.example/api/graph');
    delete process.env.THEOREM_HARNESS_URL;
    expect(resolveAtlasUpstream()).toBeUndefined();
  });

  it('prefers the explicit atlas URL over derived ones', () => {
    process.env.THEOREM_ATLAS_URL = 'https://atlas.example/graph.json';
    process.env.THEOREM_HARNESS_URL = 'https://harness.example';
    expect(resolveAtlasUpstream()).toBe('https://atlas.example/graph.json');
  });

  it('falls back to RUSTYRED_THG_URL last', () => {
    process.env.RUSTYRED_THG_URL = 'https://thg.example';
    expect(resolveAtlasUpstream()).toBe('https://thg.example/api/graph');
  });
});

describe('loadAtlas fallback', () => {
  it('returns the committed artifact when no upstream is configured', async () => {
    const atlas = await loadAtlas();
    expect(atlas.objects.length).toBe(committedGraph.objects.length);
    expect(atlas.edges.length).toBe(committedGraph.edges.length);
  });
});

describe('atlasPath', () => {
  const atlas = committedGraph as Atlas;

  it('returns an ordered edge chain on the committed graph', () => {
    const chain = atlasPath(atlas, 'theorem-harness', 'blake3');
    expect(chain).not.toBeNull();
    expect(chain![0].from).toBe('theorem-harness');
    expect(chain![chain!.length - 1].to).toBe('blake3');
    for (let i = 1; i < chain!.length; i += 1) {
      expect(chain![i].from).toBe(chain![i - 1].to);
    }
  });

  it('returns null (not an empty array) when no path exists', () => {
    expect(atlasPath(atlas, 'blake3', 'theorem-harness')).toBeNull();
    expect(atlasPath(atlas, 'theorem-harness', 'no-such-crate')).toBeNull();
  });
});

describe('atlasNeighborhood', () => {
  it('separates what a node needs from what needs it', () => {
    const tiny: Atlas = {
      objects: [],
      edges: [
        { from: 'app', to: 'lib', kind: 'depends_on' },
        { from: 'lib', to: 'core', kind: 'depends_on' },
      ],
      events: [],
    };
    const { ancestors, descendants } = atlasNeighborhood(tiny, 'lib');
    expect(ancestors).toEqual(['core']);
    expect(descendants).toEqual(['app']);
  });

  it('is transitive on the committed graph', () => {
    const atlas = committedGraph as Atlas;
    const { ancestors, descendants } = atlasNeighborhood(atlas, 'rustyred-thg-core');
    expect(ancestors).toContain('blake3');
    expect(descendants.length).toBeGreaterThan(10);
  });
});

describe('atlasHeat', () => {
  it('decays with age and is zero for untouched objects', () => {
    const now = new Date('2026-07-16T00:00:00Z');
    const atlas: Atlas = {
      objects: [
        { id: 'hot', kind: 'crate', workspace: 'w', public: false },
        { id: 'warm', kind: 'crate', workspace: 'w', public: false },
        { id: 'cold', kind: 'crate', workspace: 'w', public: false },
      ],
      edges: [],
      events: [
        { object: 'hot', at: '2026-07-15T00:00:00Z', kind: 'commit', sha: 'aaa1111' },
        { object: 'warm', at: '2026-06-01T00:00:00Z', kind: 'commit', sha: 'bbb2222' },
      ],
    };
    const heat = atlasHeat(atlas, now);
    expect(heat.get('hot')!).toBeGreaterThan(heat.get('warm')!);
    expect(heat.get('warm')!).toBeGreaterThan(0);
    expect(heat.get('cold')).toBe(0);
    expect(heat.get('hot')!).toBeLessThanOrEqual(1);
  });
});
