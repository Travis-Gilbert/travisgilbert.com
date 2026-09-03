#!/usr/bin/env node
/**
 * D10's drift check for the vendored GPUI leaf.
 *
 * Two checks, and the second one is optional because CI does not always have a
 * Theorem checkout beside this repo:
 *
 *   1. Integrity, always. The vendored file must hash to what PROVENANCE.toml
 *      records. This catches an edit to the copy, which is the failure mode that
 *      turns a pinned vendor into a fork nobody declared.
 *   2. Drift, when a Theorem checkout is reachable. The vendored file must match
 *      the blob at the pinned commit, and the check reports (without failing)
 *      when upstream HEAD has moved past the pin, because a moved upstream is
 *      news rather than an error.
 *
 * Exit code 0 means the copy is intact. Non-zero means it is not, and the
 * message says which of the two checks failed.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVENANCE_PATH = path.join(ROOT, 'vendor', 'gpui', 'PROVENANCE.toml');

/**
 * Read the handful of scalars this check needs out of the pin file.
 *
 * A TOML dependency for six values would be a dependency that earns nothing, so
 * this reads `key = "value"` and `key = 123` lines under `[table]` headers and
 * ignores everything else. Keys are qualified as `table.key` because both
 * `[source]` and `[vendored]` carry a `path`, and a flat read would silently
 * collapse the upstream path into the vendored one.
 */
function readPins(text) {
  const pins = new Map();
  let table = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const header = /^\[([A-Za-z_][A-Za-z0-9_.]*)\]$/.exec(line);
    if (header) {
      table = header[1];
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(line);
    if (!match) continue;
    const [, key, rest] = match;
    const value = rest.trim();
    const qualified = table ? `${table}.${key}` : key;
    if (value.startsWith('"') && value.endsWith('"')) pins.set(qualified, value.slice(1, -1));
    else if (/^-?\d+$/.test(value)) pins.set(qualified, Number(value));
  }
  return pins;
}

function require_(pins, key) {
  const value = pins.get(key);
  if (value === undefined) {
    throw new Error(`PROVENANCE.toml is missing ${key}, so the pin cannot be checked`);
  }
  return value;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Locate a Theorem checkout, or return null so the drift check is skipped. */
function findTheorem(argv) {
  const flag = argv.indexOf('--theorem');
  const candidates = [
    flag >= 0 ? argv[flag + 1] : undefined,
    process.env.THEOREM_ROOT,
    path.resolve(ROOT, '..', '..', 'theorem'),
    path.resolve(ROOT, '..', 'theorem'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(path.join(candidate, '.git'))) return candidate;
  }
  return null;
}

function main(argv) {
  const pins = readPins(fs.readFileSync(PROVENANCE_PATH, 'utf-8'));
  const vendoredPath = path.join(ROOT, require_(pins, 'vendored.path'));
  const expectedHash = require_(pins, 'vendored.sha256');
  const commit = require_(pins, 'source.commit');
  const upstreamPath = require_(pins, 'source.path');

  const vendored = fs.readFileSync(vendoredPath);
  const actualHash = sha256(vendored);
  if (actualHash !== expectedHash) {
    throw new Error(
      `${path.relative(ROOT, vendoredPath)} hashes to ${actualHash} but PROVENANCE.toml pins ` +
        `${expectedHash}. Either the copy was edited, in which case it is a fork and the ` +
        'pin should say so, or the pin is stale and needs re-recording.',
    );
  }
  console.log(`intact: ${path.relative(ROOT, vendoredPath)} matches its pin (${actualHash.slice(0, 12)})`);

  const theorem = findTheorem(argv);
  if (!theorem) {
    console.log('skipped drift: no Theorem checkout found (pass --theorem <path> or set THEOREM_ROOT)');
    return;
  }

  const pinned = execFileSync('git', ['show', `${commit}:${upstreamPath}`], {
    cwd: theorem,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (sha256(pinned) !== expectedHash) {
    throw new Error(
      `${upstreamPath} at ${commit.slice(0, 12)} does not match the vendored copy. ` +
        'The vendored file has diverged from the commit it claims to come from.',
    );
  }
  console.log(`pinned: upstream ${upstreamPath} at ${commit.slice(0, 12)} is byte identical`);

  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: theorem, encoding: 'utf-8' }).trim();
  if (head === commit) {
    console.log('current: the pin is at upstream HEAD');
    return;
  }
  const headBlob = execFileSync('git', ['show', `HEAD:${upstreamPath}`], {
    cwd: theorem,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (sha256(headBlob) === expectedHash) {
    console.log(`current: upstream HEAD is ${head.slice(0, 12)} but ${upstreamPath} is unchanged`);
  } else {
    console.log(
      `drift: ${upstreamPath} changed between ${commit.slice(0, 12)} and ${head.slice(0, 12)}. ` +
        're-vendor and re-record the pin when adopting it.',
    );
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`leaf provenance check failed: ${error.message}`);
  process.exit(1);
}
