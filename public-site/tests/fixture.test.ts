/**
 * The committed fixture, checked against its own manifest.
 *
 * D3's acceptance criterion is that two runs of the projection produce a byte
 * identical payload. Regenerating the fixture inside a test would take minutes
 * and need seven checkouts, so the generator records the hashes it produced and
 * this test holds the committed files to them. A changed hash here means either
 * the data or the format moved, and the commit message has to say which.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LAYOUT_CONTRACT, MAX_PAYLOAD_BYTES } from '@/lib/portfolio/fieldSnapshot';
import {
  FIXTURE_BINARY,
  FIXTURE_DIR,
  FIXTURE_SIDE_TABLE,
  assertConsistent,
  joinSymbols,
  loadFieldSnapshot,
  representativeSymbols,
} from '@/lib/portfolio/snapshot';

const DIR = path.join(process.cwd(), FIXTURE_DIR);
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'HASHES.json'), 'utf-8'));

function sha256(file: string): string {
  return createHash('sha256').update(fs.readFileSync(path.join(DIR, file))).digest('hex');
}

describe('the committed fixture', () => {
  it.each([FIXTURE_BINARY, FIXTURE_SIDE_TABLE])('matches the recorded hash for %s', (file) => {
    expect(sha256(file)).toBe(manifest.files[file]);
  });

  it('was written against this layout contract', () => {
    expect(manifest.layoutContract).toBe(LAYOUT_CONTRACT);
    expect(manifest.layoutContractSha256).toBe(
      createHash('sha256').update(LAYOUT_CONTRACT).digest('hex'),
    );
  });

  it('stays under the D3 payload cap', () => {
    expect(manifest.payloadCapBytes).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    expect(manifest.payloadBytes).toBeLessThan(manifest.payloadCapBytes);
  });

  it('decodes and agrees with its side table', () => {
    const snapshot = loadFieldSnapshot();
    expect(() => assertConsistent(snapshot.binary, snapshot.sideTable)).not.toThrow();
    expect(snapshot.binary.symbolCount).toBe(manifest.symbolCount);
    expect(snapshot.binary.edgeCount).toBe(manifest.edgeCount);
    expect(snapshot.binary.repoCount).toBe(manifest.repoCount);
    expect(snapshot.binary.clusterCount).toBe(manifest.clusterCount);
  });

  it('gives every symbol a position, a repo and a cluster that exist', () => {
    const snapshot = loadFieldSnapshot();
    const { binary, sideTable } = snapshot;
    const clusterIds = new Set(sideTable.clusters.map((cluster) => cluster.id));

    for (let i = 0; i < binary.symbolCount; i += 1) {
      expect(Number.isFinite(binary.positions[i * 2])).toBe(true);
      expect(Number.isFinite(binary.positions[i * 2 + 1])).toBe(true);
      expect(binary.repoIndex[i]).toBeLessThan(binary.repoCount);
      expect(clusterIds.has(binary.clusterId[i])).toBe(true);
    }
  });

  it('carries a CSR that is sorted, in range, and adds up to the edge count', () => {
    const { binary } = loadFieldSnapshot();
    expect(binary.csrOffsets[0]).toBe(0);
    expect(binary.csrOffsets[binary.symbolCount]).toBe(binary.edgeCount);

    for (let i = 0; i < binary.symbolCount; i += 1) {
      const start = binary.csrOffsets[i];
      const end = binary.csrOffsets[i + 1];
      expect(end).toBeGreaterThanOrEqual(start);
      for (let e = start; e < end; e += 1) {
        expect(binary.csrNeighbors[e]).toBeLessThan(binary.symbolCount);
        // A symbol is never its own neighbour, which would give the layout a
        // self repulsion term that pushes against nothing.
        expect(binary.csrNeighbors[e]).not.toBe(i);
        expect(binary.csrWeights[e]).toBeGreaterThan(0);
      }
    }
  });

  it('records a per repo symbol count that matches the payload', () => {
    const snapshot = loadFieldSnapshot();
    const counts = new Map<number, number>();
    for (const index of snapshot.binary.repoIndex) {
      counts.set(index, (counts.get(index) ?? 0) + 1);
    }
    for (const repo of snapshot.sideTable.repos) {
      expect(counts.get(repo.index) ?? 0).toBe(repo.symbolCount);
    }
    const declared: Array<{ name: string; symbolCount: number }> = manifest.repos;
    expect(snapshot.sideTable.repos.map((repo) => repo.name)).toEqual(
      declared.map((repo) => repo.name),
    );
  });

  it('ranks representatives by degree and breaks ties by ordinal', () => {
    const symbols = joinSymbols(loadFieldSnapshot());
    const top = representativeSymbols(symbols, 10);
    expect(top).toHaveLength(10);
    for (let i = 1; i < top.length; i += 1) {
      const previous = top[i - 1];
      const current = top[i];
      expect(
        previous.degree > current.degree ||
          (previous.degree === current.degree && previous.ordinal < current.ordinal),
      ).toBe(true);
    }
  });

  it('spends each representative row on a different name', () => {
    const symbols = joinSymbols(loadFieldSnapshot());
    const names = representativeSymbols(symbols, 12).map((symbol) => symbol.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('returns everything it can when a group has fewer distinct names than rows', () => {
    const symbols = joinSymbols(loadFieldSnapshot()).slice(0, 3);
    expect(representativeSymbols(symbols, 50).length).toBeLessThanOrEqual(3);
    expect(representativeSymbols([], 5)).toEqual([]);
  });
});
