/**
 * Read the committed field snapshot at build time.
 *
 * Until D1 stands up the `portfolio-public` tenant, `fieldSnapshot(revision)`
 * has nowhere to answer from, so the route reads the fixture that
 * `scripts/build-field-fixture.mjs` produced from the same allowlist. The join
 * and the checks below are the part that survives the switch: when the resolver
 * exists, `loadFieldSnapshot` changes where the two halves come from and
 * nothing downstream of it moves.
 */

import fs from 'fs';
import path from 'path';

import { decodeFieldSnapshot, type FieldSnapshotBinary } from './fieldSnapshot';
import { parseFieldSideTable, type FieldSideTable, type SymbolRow } from './sideTable';

export const FIXTURE_DIR = path.join('fixtures', 'portfolio');
export const FIXTURE_BINARY = 'field-snapshot.bin';
export const FIXTURE_SIDE_TABLE = 'field-snapshot.json';

export interface FieldSnapshot {
  binary: FieldSnapshotBinary;
  sideTable: FieldSideTable;
}

/** One symbol joined across both halves, which is what every view actually wants. */
export interface FieldSymbol extends SymbolRow {
  repoIndex: number;
  clusterId: number;
  degree: number;
  x: number;
  y: number;
}

let cached: FieldSnapshot | null = null;

export function loadFieldSnapshot(): FieldSnapshot {
  if (cached) return cached;

  const dir = path.join(process.cwd(), FIXTURE_DIR);
  const payload = fs.readFileSync(path.join(dir, FIXTURE_BINARY));
  const sideTableRaw = JSON.parse(fs.readFileSync(path.join(dir, FIXTURE_SIDE_TABLE), 'utf-8'));

  const binary = decodeFieldSnapshot(
    new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength),
  );
  const sideTable = parseFieldSideTable(sideTableRaw);

  assertConsistent(binary, sideTable);

  cached = { binary, sideTable };
  return cached;
}

/**
 * The two halves are produced together but shipped as separate files, so they
 * can be edited apart. These checks are what stops a stale pair rendering a page
 * whose labels belong to different symbols than its positions.
 */
export function assertConsistent(binary: FieldSnapshotBinary, sideTable: FieldSideTable): void {
  if (sideTable.symbols.length !== binary.symbolCount) {
    throw new Error(
      `side table has ${sideTable.symbols.length} symbols but the payload has ${binary.symbolCount}`,
    );
  }
  if (sideTable.repos.length !== binary.repoCount) {
    throw new Error(
      `side table has ${sideTable.repos.length} repos but the payload has ${binary.repoCount}`,
    );
  }
  for (let i = 0; i < sideTable.symbols.length; i += 1) {
    if (sideTable.symbols[i].ordinal !== binary.ordinal[i]) {
      throw new Error(
        `side table row ${i} has ordinal ${sideTable.symbols[i].ordinal} but the payload has ${binary.ordinal[i]}`,
      );
    }
  }
}

/** Join both halves into one array in ordinal order. */
export function joinSymbols(snapshot: FieldSnapshot): FieldSymbol[] {
  const { binary, sideTable } = snapshot;
  return sideTable.symbols.map((row, i) => ({
    ...row,
    repoIndex: binary.repoIndex[i],
    clusterId: binary.clusterId[i],
    degree: binary.degree[i],
    x: binary.positions[i * 2],
    y: binary.positions[i * 2 + 1],
  }));
}

/**
 * Pick the symbols that best stand for a group.
 *
 * Degree is the ranking because a symbol many others chose as a nearest
 * neighbour is the one that describes its neighbourhood. Ordinal breaks ties so
 * the choice does not depend on sort stability.
 *
 * One name appears once. A codebase has many distinct symbols called `new` or
 * `servo`, and by degree they arrive together, so the plain ranking listed Turvo
 * as "servo, servo, servo". Three links to three real and different symbols, and
 * still a list that tells a reader nothing and reads as a bug. Keeping the
 * highest ranked symbol per name spends each row on something new.
 */
export function representativeSymbols(symbols: FieldSymbol[], count: number): FieldSymbol[] {
  const ranked = [...symbols].sort((a, b) => b.degree - a.degree || a.ordinal - b.ordinal);

  const chosen: FieldSymbol[] = [];
  const names = new Set<string>();
  for (const symbol of ranked) {
    if (names.has(symbol.name)) continue;
    names.add(symbol.name);
    chosen.push(symbol);
    if (chosen.length === count) break;
  }
  return chosen;
}
