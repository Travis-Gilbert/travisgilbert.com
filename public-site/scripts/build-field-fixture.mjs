/**
 * Build the committed field snapshot fixture.
 *
 * Step 2 of the spec's sequencing ships the crawlable portfolio against a
 * fixture, before D1 stands up the public tenant and before D4's leaf exists.
 * This is the generator for that fixture. It reads the same allowlist D1 will
 * hand the ingest job, walks checkouts of those repos, and runs the stages in
 * `scripts/fixture/pipeline.mjs` to produce exactly the payload D3 specifies.
 *
 * The output is committed, not built at deploy time, because D3's acceptance
 * criterion is that the same input and seed yield a byte identical payload and
 * that the hash is recorded beside the fixture. A generated artifact nobody
 * pinned cannot make that claim.
 *
 * Usage:
 *
 *   node --experimental-strip-types scripts/build-field-fixture.mjs \
 *     --root /home/user/repos --root /home/user/theorem --limit 600
 *
 * `--root` may be given repeatedly and may name either a directory holding
 * checkouts or a checkout itself. Repos in the allowlist that have no checkout
 * are reported and skipped rather than silently dropped, because a snapshot
 * missing a repo is a different snapshot, not a smaller one.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { extractRepoSymbols } from './fixture/extract.mjs';
import {
  embedSymbols,
  buildKnn,
  detectCommunities,
  labelClusters,
  layoutField,
  buildCrossRepoArcs,
  accountStorage,
  KNN_SEARCH_K,
  KNN_KEPT,
  FIXTURE_EMBEDDING_DIM,
} from './fixture/pipeline.mjs';
import {
  encodeFieldSnapshot,
  decodeFieldSnapshot,
  LAYOUT_CONTRACT,
  MAX_PAYLOAD_BYTES,
} from '../src/lib/portfolio/fieldSnapshot.ts';
import { parsePortfolioConfig } from '../src/lib/portfolio/allowlist.ts';
import { parseFieldSideTable } from '../src/lib/portfolio/sideTable.ts';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Fixed seed. Changing it changes every position, so it is a deliberate act. */
const LAYOUT_SEED = 0x5eed_f1e1;

function parseArgs(argv) {
  const roots = [];
  let limit = 600;
  let outDir = path.join('fixtures', 'portfolio');

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') roots.push(argv[++i]);
    else if (arg.startsWith('--root=')) roots.push(arg.slice('--root='.length));
    else if (arg === '--limit') limit = Number(argv[++i]);
    else if (arg.startsWith('--limit=')) limit = Number(arg.slice('--limit='.length));
    else if (arg === '--out') outDir = argv[++i];
    else if (arg.startsWith('--out=')) outDir = arg.slice('--out='.length);
    else throw new Error(`unknown argument ${arg}`);
  }

  if (roots.length === 0) throw new Error('at least one --root is required');
  return { roots, limit, outDir };
}

/** Last path segment of the repo URL, which is the directory a clone lands in. */
function repoDirName(repo) {
  return repo.url.replace(/\/+$/, '').split('/').pop();
}

/** Find a checkout for one repo under any of the search roots. */
function findCheckout(repo, roots) {
  const wanted = repoDirName(repo).toLowerCase();
  for (const root of roots) {
    const resolved = path.resolve(root);
    if (!fs.existsSync(resolved)) continue;

    if (path.basename(resolved).toLowerCase() === wanted) return resolved;

    let entries;
    try {
      entries = fs.readdirSync(resolved, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.toLowerCase() === wanted) {
        return path.join(resolved, entry.name);
      }
    }
  }
  return null;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function main() {
  const { roots, limit, outDir } = parseArgs(process.argv.slice(2));

  const config = parsePortfolioConfig(
    JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'config', 'portfolio.json'), 'utf-8')),
  );

  const symbols = [];
  const repoRows = [];
  const missing = [];

  config.repos.forEach((repo) => {
    const checkout = findCheckout(repo, roots);
    if (!checkout) {
      missing.push(repo.name);
      return;
    }

    const revision = repo.revisions[0];
    const found = extractRepoSymbols(checkout, limit);
    const repoIndex = repoRows.length;

    for (const symbol of found) {
      symbols.push({
        ordinal: symbols.length,
        id: `sym:${repo.id}:${symbol.path}:${symbol.line}:${symbol.name}`,
        name: symbol.name,
        kind: symbol.kind,
        signature: symbol.signature,
        path: symbol.path,
        line: symbol.line,
        repo: repo.id,
        revision: revision.sha,
        firstSeenRevision: revision.sha,
        repoIndex,
      });
    }

    repoRows.push({
      index: repoIndex,
      id: repo.id,
      name: repo.name,
      url: repo.url,
      blurb: repo.blurb,
      private: repo.private,
      bodyWithheld: repo.bodyWithheld,
      revision: revision.sha,
      symbolCount: found.length,
    });

    process.stderr.write(`  ${repo.name.padEnd(20)} ${String(found.length).padStart(5)} symbols\n`);
  });

  if (missing.length > 0) {
    throw new Error(
      `no checkout found for: ${missing.join(', ')}. ` +
        'Clone them under a --root, or drop them from config/portfolio.json.',
    );
  }
  if (symbols.length === 0) throw new Error('no symbols extracted');

  process.stderr.write(`\nembedding ${symbols.length} symbols at dim ${FIXTURE_EMBEDDING_DIM}\n`);
  const vectors = embedSymbols(symbols, FIXTURE_EMBEDDING_DIM);

  process.stderr.write(`kNN search k=${KNN_SEARCH_K}, keeping ${KNN_KEPT}\n`);
  const knn = buildKnn(vectors);

  process.stderr.write('detecting communities\n');
  const { clusterId, clusterCount } = detectCommunities(
    knn.csrOffsets,
    knn.csrNeighbors,
    knn.csrWeights,
  );

  const clusters = labelClusters(clusterId, clusterCount, symbols);

  process.stderr.write('laying out warm start\n');
  const positions = layoutField(knn.csrOffsets, knn.csrNeighbors, knn.csrWeights, {
    seed: LAYOUT_SEED,
  });

  const repoIndex = Uint16Array.from(symbols, (symbol) => symbol.repoIndex);
  const ordinal = Uint32Array.from(symbols, (symbol) => symbol.ordinal);
  const arcs = buildCrossRepoArcs(knn.csrOffsets, knn.csrNeighbors, repoIndex);
  const storage = accountStorage(vectors, FIXTURE_EMBEDDING_DIM);

  const binary = {
    symbolCount: symbols.length,
    edgeCount: knn.csrNeighbors.length,
    repoCount: repoRows.length,
    clusterCount,
    positions,
    repoIndex,
    clusterId,
    degree: knn.degree,
    ordinal,
    csrOffsets: knn.csrOffsets,
    csrNeighbors: knn.csrNeighbors,
    csrWeights: knn.csrWeights,
  };

  const payload = encodeFieldSnapshot(binary);

  // Decode what was just encoded. A generator that cannot read its own output
  // is the failure mode that would otherwise surface in the browser.
  decodeFieldSnapshot(payload);

  const sideTable = parseFieldSideTable({
    formatVersion: 1,
    tenant: config.tenant,
    revision: 'fixture',
    source: {
      generator: 'scripts/build-field-fixture.mjs',
      embedder: 'hash',
      embeddingDim: FIXTURE_EMBEDDING_DIM,
      knnK: KNN_KEPT,
      seed: LAYOUT_SEED,
      layoutContractSha256: sha256(Buffer.from(LAYOUT_CONTRACT, 'utf-8')),
    },
    repos: repoRows,
    clusters,
    symbols: symbols.map(({ repoIndex: _drop, ...row }) => row),
    arcs,
    storage,
    touched: {
      nodesVisited: symbols.length,
      blocksRead: storage.blocks,
      wallMs: 0,
    },
  });

  const absoluteOut = path.resolve(SITE_ROOT, outDir);
  fs.mkdirSync(absoluteOut, { recursive: true });

  const binPath = path.join(absoluteOut, 'field-snapshot.bin');
  const jsonPath = path.join(absoluteOut, 'field-snapshot.json');
  const sideTableJson = `${JSON.stringify(sideTable, null, 2)}\n`;

  fs.writeFileSync(binPath, payload);
  fs.writeFileSync(jsonPath, sideTableJson);

  const manifest = {
    generatedBy: 'scripts/build-field-fixture.mjs',
    note:
      'Regenerate with the same roots and seed to reproduce these hashes. ' +
      'A changed hash means the data or the format moved, and one of those needs saying in the commit message.',
    layoutContract: LAYOUT_CONTRACT,
    layoutContractSha256: sha256(Buffer.from(LAYOUT_CONTRACT, 'utf-8')),
    seed: LAYOUT_SEED,
    symbolCount: symbols.length,
    edgeCount: knn.csrNeighbors.length,
    repoCount: repoRows.length,
    clusterCount,
    payloadBytes: payload.byteLength,
    payloadCapBytes: MAX_PAYLOAD_BYTES,
    sideTableBytes: Buffer.byteLength(sideTableJson),
    files: {
      'field-snapshot.bin': sha256(payload),
      'field-snapshot.json': sha256(Buffer.from(sideTableJson, 'utf-8')),
    },
    repos: repoRows.map((row) => ({
      name: row.name,
      revision: row.revision,
      symbolCount: row.symbolCount,
      bodyWithheld: row.bodyWithheld,
    })),
  };

  fs.writeFileSync(
    path.join(absoluteOut, 'HASHES.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  process.stderr.write(
    `\nwrote ${outDir}\n` +
      `  symbols  ${manifest.symbolCount}\n` +
      `  edges    ${manifest.edgeCount}\n` +
      `  clusters ${manifest.clusterCount}\n` +
      `  payload  ${manifest.payloadBytes} bytes of ${MAX_PAYLOAD_BYTES} cap\n` +
      `  side     ${manifest.sideTableBytes} bytes\n` +
      `  bin      sha256 ${manifest.files['field-snapshot.bin']}\n`,
  );
}

main();
