/**
 * The fixture side of D2 and D3: turn extracted symbols into a field snapshot.
 *
 * Each stage stands in for server work the spec assigns to Rust, and each one
 * mirrors the shape of its counterpart rather than inventing a different one:
 *
 *  - embedding        `code.incremental_embed`, via the verified hash embedder
 *  - kNN              D2 `code.knn_edges`, vector_search k=16, self dropped, 15 kept
 *  - communities      `graphAlgorithm(COMMUNITIES)` restricted to NEAR, via Louvain
 *  - cluster labels   C11, top 3 TF-IDF terms over member symbol names
 *  - layout           C4 warm start, using C3's force model so the numbers this
 *                     produces are comparable with the WGSL kernel's
 *  - storage          D7 accounting over content addressed vector blocks
 *
 * Determinism is a requirement, not a nicety: D3's acceptance criterion is a
 * byte identical payload across two runs. So there is one seeded PRNG, no
 * `Math.random`, and no transcendental beyond `Math.sqrt`, which IEEE 754
 * requires to be correctly rounded. `Math.sin`, `Math.exp` and friends are
 * allowed to differ between engines and are therefore avoided.
 */

import { UndirectedGraph } from 'graphology';
import louvain from 'graphology-communities-louvain';

import {
  hashCodeEmbedding,
  cosineSimilarity,
  symbolEmbeddingText,
} from '../../src/lib/portfolio/hashEmbedding.ts';

/** D2 asks vector_search for 16 and keeps 15 after dropping self. */
export const KNN_SEARCH_K = 16;
export const KNN_KEPT = 15;

/** Saturation ceiling for the u16 degree column in the payload. */
const MAX_DEGREE = 0xffff;

/** Layout iterations for the warm start. */
const LAYOUT_ITERATIONS = 320;

/** Seeds Louvain's node visit order, so two runs agree on the same communities. */
export const COMMUNITY_SEED = 0x0c0_1ead >>> 0;

/**
 * Louvain's granularity knob, chosen against C11's cap rather than by feel.
 *
 * Modularity at resolution 1 merges subsystems that are plainly separate: it put
 * the atlas renderer and the civic forms in one community. Raising it splits
 * them. Measured on this corpus, the share of a cluster sitting in its single
 * most common source directory climbs from 46 percent at 1 to 56 percent at 3,
 * and then flattens, while the cluster count climbs from 17 to 48. C11 shows at
 * most 64 clusters, so 3 buys nearly all of the available coherence and still
 * leaves room for the corpus to grow before the cap starts hiding clusters.
 */
export const COMMUNITY_RESOLUTION = 3;

/** ---------------------------------------------------------------- PRNG */

/** mulberry32: small, seeded, and identical on every engine. */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ----------------------------------------------------------- embedding */

/**
 * Hash space for the fixture, deliberately wider than the hook's 64.
 *
 * `EMBEDDING_DIM` in `code_embed_hook.rs` is 64, and at 64 buckets these vectors
 * collide into noise: a symbol's name and one line signature give five or so
 * tokens, so two symbols share a bucket about as often by collision as by
 * meaning. Measured over this corpus, only 18 percent of a symbol's nearest
 * neighbours came from the same source directory at 64 buckets, against 73
 * percent at 1024. The first number is a field with no structure in it.
 *
 * The hash function is untouched: `hashCodeEmbedding` takes the dimension as an
 * argument and the parity evidence covers non default dimensions, so this is the
 * same verified embedder given room to separate.
 */
export const FIXTURE_EMBEDDING_DIM = 1024;

/**
 * The text the fixture embeds, which is not quite the text the hook embeds.
 *
 * `symbol_embedding_text` joins name, signature, snippet, doc and body, and body
 * is where most of its signal lives. This extractor has no body: it scans
 * declarations, and for a repo D0-b withholds there would be no body to read
 * anyway. Embedding name and signature alone leaves almost nothing to be similar
 * about, which is what produced the collision noise above.
 *
 * The path is what replaces it. Code in one module is related in the way a body
 * would have shown, so splitting the path into tokens recovers the locality that
 * C8's bge-small gets from reading the code itself. This is a fixture standing in
 * for a real embedder, and the substitution is the honest way to stand in.
 */
export function fixtureEmbeddingText(symbol) {
  return `${symbolEmbeddingText({ name: symbol.name, signature: symbol.signature })} ${symbol.path.replace(/[^A-Za-z0-9]+/g, ' ')}`;
}

export function embedSymbols(symbols, dimension = FIXTURE_EMBEDDING_DIM) {
  return symbols.map((symbol) => hashCodeEmbedding(fixtureEmbeddingText(symbol), dimension));
}

/** ----------------------------------------------------------------- kNN */

/**
 * Brute force cosine kNN, which is what `vector_search` does over this many
 * vectors anyway. Returns CSR arrays plus the per symbol degree.
 *
 * Ties break on the lower ordinal so the neighbor list does not depend on
 * iteration order.
 */
export function buildKnn(vectors, { searchK = KNN_SEARCH_K, kept = KNN_KEPT } = {}) {
  const count = vectors.length;
  const csrOffsets = new Uint32Array(count + 1);
  const neighbors = [];
  const weights = [];
  const inDegree = new Uint32Array(count);

  if (count === 0) return emptyKnn(csrOffsets, count);

  // These vectors are unit length, so cosine is the dot product, and they are
  // sparse: a symbol contributes about a dozen non zero buckets out of a
  // thousand. Two symbols with no bucket in common therefore have a dot of
  // exactly zero, and a zero is an edge this function drops anyway.
  //
  // So instead of comparing every pair, invert the vectors into a bucket to
  // symbol index and accumulate only over the pairs that can be non zero. The
  // result is identical to the all pairs scan, because the pairs it skips are
  // exactly the ones scoring zero; it is only faster. The all pairs version was
  // O(count squared times dimension), which at this dimension does not finish.
  const dimension = vectors[0].length;
  const { offsets, indices } = buildPostings(vectors, dimension);

  // Reused across rows so the inner loops do not allocate.
  const bestIndex = new Int32Array(searchK);
  const bestScore = new Float64Array(searchK);
  const touched = new Int32Array(count);
  // Which row last claimed each symbol. A stamp rather than a running dot,
  // because a dot can legitimately come to exactly zero when a symbol's signed
  // buckets cancel, and using zero as the "not seen yet" marker would then let
  // that symbol into the candidate list twice and into the top-k twice.
  const seenInRow = new Int32Array(count).fill(-1);

  for (let i = 0; i < count; i += 1) {
    const self = vectors[i];
    let touchedCount = 0;

    for (let bucket = 0; bucket < dimension; bucket += 1) {
      if (self[bucket] === 0) continue;
      for (let p = offsets[bucket]; p < offsets[bucket + 1]; p += 1) {
        const j = indices[p];
        if (j === i || seenInRow[j] === i) continue;
        seenInRow[j] = i;
        touched[touchedCount++] = j;
      }
    }

    let filled = 0;
    for (let t = 0; t < touchedCount; t += 1) {
      const j = touched[t];
      // Scored through the same helper the all pairs scan used, so the kept
      // weights are bit identical to what it produced. The index only decides
      // which pairs are worth scoring at all.
      const score = cosineSimilarity(self, vectors[j]);
      if (score <= 0) continue;
      filled = offer(bestIndex, bestScore, filled, searchK, j, score);
    }

    csrOffsets[i] = neighbors.length;
    const take = Math.min(filled, kept);
    for (let n = 0; n < take; n += 1) {
      // A zero or negative cosine is not a neighbourhood, it is the absence of
      // one. Keeping those edges would wire unrelated symbols together and the
      // layout would read that as structure.
      if (bestScore[n] <= 0) break;
      neighbors.push(bestIndex[n]);
      weights.push(Math.fround(bestScore[n]));
      inDegree[bestIndex[n]] += 1;
    }
  }
  csrOffsets[count] = neighbors.length;

  const degree = new Uint16Array(count);
  for (let i = 0; i < count; i += 1) {
    const out = csrOffsets[i + 1] - csrOffsets[i];
    degree[i] = Math.min(out + inDegree[i], MAX_DEGREE);
  }

  return {
    csrOffsets,
    csrNeighbors: Uint32Array.from(neighbors),
    csrWeights: Float32Array.from(weights),
    degree,
  };
}

function emptyKnn(csrOffsets, count) {
  return {
    csrOffsets,
    csrNeighbors: new Uint32Array(0),
    csrWeights: new Float32Array(0),
    degree: new Uint16Array(count),
  };
}

/**
 * Bucket to symbol index, in CSR form so the hot loop reads flat arrays.
 *
 * Only membership is stored. The weights stay in the vectors, because the score
 * is computed there by `cosineSimilarity` and duplicating them here would invite
 * a second, subtly different sum.
 */
function buildPostings(vectors, dimension) {
  const offsets = new Uint32Array(dimension + 1);
  for (const vector of vectors) {
    for (let bucket = 0; bucket < dimension; bucket += 1) {
      if (vector[bucket] !== 0) offsets[bucket + 1] += 1;
    }
  }
  for (let bucket = 0; bucket < dimension; bucket += 1) {
    offsets[bucket + 1] += offsets[bucket];
  }

  const indices = new Uint32Array(offsets[dimension]);
  const cursor = offsets.slice(0, dimension);
  for (let i = 0; i < vectors.length; i += 1) {
    const vector = vectors[i];
    for (let bucket = 0; bucket < dimension; bucket += 1) {
      if (vector[bucket] === 0) continue;
      indices[cursor[bucket]++] = i;
    }
  }

  return { offsets, indices };
}

/** Insert one candidate into the descending top-k, keeping the tie rule. */
function offer(bestIndex, bestScore, filled, searchK, index, score) {
  if (filled < searchK) {
    let slot = filled;
    filled += 1;
    while (slot > 0 && isBetter(score, index, bestScore[slot - 1], bestIndex[slot - 1])) {
      bestScore[slot] = bestScore[slot - 1];
      bestIndex[slot] = bestIndex[slot - 1];
      slot -= 1;
    }
    bestScore[slot] = score;
    bestIndex[slot] = index;
    return filled;
  }

  if (!isBetter(score, index, bestScore[filled - 1], bestIndex[filled - 1])) return filled;
  let slot = filled - 1;
  while (slot > 0 && isBetter(score, index, bestScore[slot - 1], bestIndex[slot - 1])) {
    bestScore[slot] = bestScore[slot - 1];
    bestIndex[slot] = bestIndex[slot - 1];
    slot -= 1;
  }
  bestScore[slot] = score;
  bestIndex[slot] = index;
  return filled;
}

function isBetter(score, index, otherScore, otherIndex) {
  if (score !== otherScore) return score > otherScore;
  return index < otherIndex;
}

/** --------------------------------------------------------- communities */

/**
 * Communities over the undirected NEAR graph, via Louvain.
 *
 * This was weighted label propagation, hand rolled. Label propagation has a well
 * known failure on a graph as connected as a kNN graph: it collapses into one
 * monster community. Measured on this corpus it put 63 percent of all symbols in
 * a single cluster whose label was three words that described none of them, and
 * a page whose first section is two thirds of the corpus is not a page about
 * anything.
 *
 * Louvain optimises modularity instead of copying neighbours, which is why it
 * splits a well connected graph into balanced parts rather than merging it. On
 * the same graph it produces twenty communities with the largest at 15 percent.
 * `graphology-communities-louvain` is the established implementation and it takes
 * an `rng`, so seeding it keeps the byte identical payload D3 asks for; the
 * modularity arithmetic is add, multiply and divide only, with no transcendental
 * to differ between engines.
 *
 * Cluster ids are assigned by descending size so id 0 is the largest, and ties
 * break on the smallest member index. Renumbering by first appearance, which is
 * what the previous implementation did, would let an unrelated change to symbol
 * order renumber every cluster.
 */
export function detectCommunities(
  csrOffsets,
  csrNeighbors,
  csrWeights,
  { seed = COMMUNITY_SEED, resolution = COMMUNITY_RESOLUTION } = {},
) {
  const count = csrOffsets.length - 1;
  if (count === 0) return { clusterId: new Uint16Array(0), clusterCount: 0 };

  const graph = new UndirectedGraph();
  for (let node = 0; node < count; node += 1) graph.addNode(String(node));

  const adjacency = buildUndirected(csrOffsets, csrNeighbors, csrWeights, count);
  for (let node = 0; node < count; node += 1) {
    for (let e = adjacency.offsets[node]; e < adjacency.offsets[node + 1]; e += 1) {
      const other = adjacency.targets[e];
      // `buildUndirected` stores each pair twice; add it once.
      if (other <= node) continue;
      graph.addEdge(String(node), String(other), { weight: adjacency.weights[e] });
    }
  }

  const communities = louvain(graph, { resolution, rng: makeRng(seed), getEdgeWeight: 'weight' });

  const sizes = new Map();
  const firstMember = new Map();
  const raw = new Int32Array(count);
  for (let node = 0; node < count; node += 1) {
    const community = communities[String(node)];
    raw[node] = community;
    sizes.set(community, (sizes.get(community) ?? 0) + 1);
    if (!firstMember.has(community)) firstMember.set(community, node);
  }

  const ordered = [...sizes.keys()].sort(
    (a, b) => sizes.get(b) - sizes.get(a) || firstMember.get(a) - firstMember.get(b),
  );
  const dense = new Map(ordered.map((community, id) => [community, id]));

  const clusterId = new Uint16Array(count);
  for (let node = 0; node < count; node += 1) {
    clusterId[node] = Math.min(dense.get(raw[node]), 0xffff);
  }

  return { clusterId, clusterCount: dense.size };
}

/** Symmetrize the directed kNN graph, keeping the heavier weight per pair. */
function buildUndirected(csrOffsets, csrNeighbors, csrWeights, count) {
  const pairs = new Map();
  for (let node = 0; node < count; node += 1) {
    for (let e = csrOffsets[node]; e < csrOffsets[node + 1]; e += 1) {
      const other = csrNeighbors[e];
      const low = node < other ? node : other;
      const high = node < other ? other : node;
      const key = low * count + high;
      const weight = csrWeights[e];
      const existing = pairs.get(key);
      if (existing === undefined || weight > existing) pairs.set(key, weight);
    }
  }

  const counts = new Uint32Array(count + 1);
  for (const key of pairs.keys()) {
    counts[Math.floor(key / count)] += 1;
    counts[key % count] += 1;
  }
  const offsets = new Uint32Array(count + 1);
  for (let i = 0; i < count; i += 1) offsets[i + 1] = offsets[i] + counts[i];

  const cursor = offsets.slice(0, count);
  const targets = new Uint32Array(offsets[count]);
  const weights = new Float64Array(offsets[count]);
  for (const [key, weight] of pairs) {
    const low = Math.floor(key / count);
    const high = key % count;
    targets[cursor[low]] = high;
    weights[cursor[low]] = weight;
    cursor[low] += 1;
    targets[cursor[high]] = low;
    weights[cursor[high]] = weight;
    cursor[high] += 1;
  }

  return { offsets, targets, weights };
}

/** ------------------------------------------------------ cluster labels */

/** Split identifiers into words: snake_case, camelCase, and PascalCase all fall apart here. */
export function splitIdentifier(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 1)
    .map((word) => word.toLowerCase());
}

/** Words that name every codebase rather than any cluster in one. */
const STOP_WORDS = new Set([
  'new', 'get', 'set', 'from', 'into', 'with', 'for', 'the', 'and', 'not',
  'default', 'value', 'self', 'type', 'test', 'tests', 'impl', 'fmt', 'try',
  // Filler that survived TF-IDF because it is rare in code but says nothing:
  // these turned up inside labels like "cookie cookies go" and "looks like above".
  'go', 'is', 'to', 'on', 'in', 'at', 'as', 'by', 'of', 'or', 'all', 'are',
  'be', 'do', 'it', 'that', 'this', 'was', 'has', 'have', 'when', 'then',
  'like', 'above', 'below', 'one', 'two', 'main', 'mod', 'lib', 'src', 'util',
  'utils', 'helper', 'helpers', 'common', 'core', 'index', 'options', 'props',
]);

/**
 * Collapse a term to a form two spellings of one word share.
 *
 * TF-IDF treats `cookie` and `cookies` as unrelated, so a cluster about cookies
 * spent two of its three label slots saying so.
 *
 * This is not a stemmer and the form it produces is not a word: `cookies` and
 * `cookie` both land on `cooky`, and `status` lands on `statu`. That is fine,
 * because the output is never shown. All it has to do is be the same for two
 * spellings of one term and different for two terms, and a crude fixed sequence
 * does that more reliably here than a half remembered plural rule: `cookies` and
 * `properties` have identical shapes and different singulars, so no rule short
 * of a dictionary tells them apart.
 */
function labelStem(word) {
  let stem = word;
  if (stem.length > 3 && stem.endsWith('s') && !stem.endsWith('ss')) stem = stem.slice(0, -1);
  if (stem.length > 3 && stem.endsWith('e')) stem = stem.slice(0, -1);
  if (stem.endsWith('i')) stem = `${stem.slice(0, -1)}y`;
  return stem;
}

/**
 * Top TF-IDF terms per cluster, treating each cluster as one document.
 *
 * Deterministic: ties break on the term string so two runs agree.
 */
export function labelClusters(clusterId, clusterCount, symbols, { topTerms = 3 } = {}) {
  const documents = Array.from({ length: clusterCount }, () => new Map());
  const sizes = new Uint32Array(clusterCount);

  for (let i = 0; i < symbols.length; i += 1) {
    const cluster = clusterId[i];
    sizes[cluster] += 1;
    for (const word of splitIdentifier(symbols[i].name)) {
      if (STOP_WORDS.has(word)) continue;
      const bag = documents[cluster];
      bag.set(word, (bag.get(word) ?? 0) + 1);
    }
  }

  const documentFrequency = new Map();
  for (const bag of documents) {
    for (const word of bag.keys()) {
      documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
    }
  }

  return documents.map((bag, cluster) => {
    let total = 0;
    for (const count of bag.values()) total += count;

    const scored = [];
    for (const [word, count] of bag) {
      const tf = total > 0 ? count / total : 0;
      // Plain ratio rather than a log, so the score stays engine independent.
      const idf = clusterCount / (documentFrequency.get(word) ?? 1);
      scored.push({ word, score: tf * idf });
    }
    scored.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, 'en'));

    // Highest scoring spelling wins its stem, and the rest of that word's
    // spellings are skipped, so three slots hold three ideas.
    const terms = [];
    const claimed = new Set();
    for (const entry of scored) {
      const stem = labelStem(entry.word);
      if (claimed.has(stem)) continue;
      claimed.add(stem);
      terms.push(entry.word);
      if (terms.length === topTerms) break;
    }
    return {
      id: cluster,
      terms,
      label: terms.length > 0 ? terms.join(' ') : `cluster ${cluster}`,
      size: sizes[cluster],
    };
  });
}

/** ---------------------------------------------------------------- layout */

/**
 * C4's warm start, produced with C3's force model.
 *
 * C4 says the server precomputes this with annembed, and that remains the plan.
 * Running the same force model here instead means the fixture positions and the
 * browser kernel's refinement agree about what the forces are, so the iteration
 * counts measured against this fixture are the ones D08 asked for rather than a
 * different algorithm's.
 *
 * Repulsion uses C3's two level uniform grid: exact against the nine cells
 * around a point, coarse against every other cell's centroid.
 */
export function layoutField(csrOffsets, csrNeighbors, csrWeights, { seed, iterations = LAYOUT_ITERATIONS } = {}) {
  const count = csrOffsets.length - 1;
  const positions = new Float64Array(count * 2);
  const forces = new Float64Array(count * 2);
  const rng = makeRng(seed);

  for (let i = 0; i < count * 2; i += 1) {
    positions[i] = rng() * 2 - 1;
  }
  if (count === 0) return new Float32Array(0);

  const attraction = 0.5;
  const repulsion = 0.02;
  const gravity = 0.008;

  for (let step = 0; step < iterations; step += 1) {
    forces.fill(0);
    // Linear anneal, no transcendental.
    const alpha = 1 - step / iterations;

    const grid = buildGrid(positions, count);

    for (let node = 0; node < count; node += 1) {
      const x = positions[node * 2];
      const y = positions[node * 2 + 1];

      for (let e = csrOffsets[node]; e < csrOffsets[node + 1]; e += 1) {
        const other = csrNeighbors[e];
        const weight = csrWeights[e];
        const dx = positions[other * 2] - x;
        const dy = positions[other * 2 + 1] - y;
        const pull = attraction * weight;
        forces[node * 2] += dx * pull;
        forces[node * 2 + 1] += dy * pull;
        forces[other * 2] -= dx * pull;
        forces[other * 2 + 1] -= dy * pull;
      }

      const cellX = grid.cellOf(x, grid.minX);
      const cellY = grid.cellOf(y, grid.minY);

      for (let cx = 0; cx < grid.size; cx += 1) {
        for (let cy = 0; cy < grid.size; cy += 1) {
          const cell = cx * grid.size + cy;
          if (grid.counts[cell] === 0) continue;
          const near = Math.abs(cx - cellX) <= 1 && Math.abs(cy - cellY) <= 1;

          if (near) {
            for (let m = grid.offsets[cell]; m < grid.offsets[cell + 1]; m += 1) {
              const other = grid.members[m];
              if (other === node) continue;
              pushApart(forces, positions, node, positions[other * 2], positions[other * 2 + 1], repulsion);
            }
          } else {
            pushApart(
              forces,
              positions,
              node,
              grid.centroidX[cell],
              grid.centroidY[cell],
              repulsion * grid.counts[cell],
            );
          }
        }
      }

      forces[node * 2] -= x * gravity;
      forces[node * 2 + 1] -= y * gravity;
    }

    for (let i = 0; i < count; i += 1) {
      positions[i * 2] += clamp(forces[i * 2], -1, 1) * alpha;
      positions[i * 2 + 1] += clamp(forces[i * 2 + 1], -1, 1) * alpha;
    }
  }

  return normalizePositions(positions, count);
}

function pushApart(forces, positions, node, otherX, otherY, strength) {
  const dx = positions[node * 2] - otherX;
  const dy = positions[node * 2 + 1] - otherY;
  const distanceSquared = dx * dx + dy * dy + 0.01;
  const push = strength / distanceSquared;
  forces[node * 2] += dx * push;
  forces[node * 2 + 1] += dy * push;
}

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

/** One level of C3's grid: counts, members, and per cell centroids. */
function buildGrid(positions, count) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 2];
    const y = positions[i * 2 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const size = Math.max(1, Math.min(32, Math.floor(Math.sqrt(count / 4)) || 1));
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const span = Math.max(spanX, spanY);
  const cellOf = (value, min) => clamp(Math.floor(((value - min) / span) * size), 0, size - 1);

  const cells = size * size;
  const counts = new Uint32Array(cells);
  const cellIndex = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) {
    const cx = cellOf(positions[i * 2], minX);
    const cy = cellOf(positions[i * 2 + 1], minY);
    const cell = cx * size + cy;
    cellIndex[i] = cell;
    counts[cell] += 1;
  }

  const offsets = new Uint32Array(cells + 1);
  for (let c = 0; c < cells; c += 1) offsets[c + 1] = offsets[c] + counts[c];
  const cursor = offsets.slice(0, cells);
  const members = new Uint32Array(count);
  const centroidX = new Float64Array(cells);
  const centroidY = new Float64Array(cells);
  for (let i = 0; i < count; i += 1) {
    const cell = cellIndex[i];
    members[cursor[cell]] = i;
    cursor[cell] += 1;
    centroidX[cell] += positions[i * 2];
    centroidY[cell] += positions[i * 2 + 1];
  }
  for (let c = 0; c < cells; c += 1) {
    if (counts[c] > 0) {
      centroidX[c] /= counts[c];
      centroidY[c] /= counts[c];
    }
  }

  return { size, minX, minY, counts, offsets, members, centroidX, centroidY, cellOf };
}

/** Fit into [-1, 1] on the longer axis so the camera has a known starting frame. */
function normalizePositions(positions, count) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 2];
    const y = positions[i * 2 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const scale = 2 / Math.max(maxX - minX, maxY - minY, 1e-6);

  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    out[i * 2] = (positions[i * 2] - centerX) * scale;
    out[i * 2 + 1] = (positions[i * 2 + 1] - centerY) * scale;
  }
  return out;
}

/** ------------------------------------------------------------ D6 arcs */

/** Group cross repo NEAR edges into one arc per ordered repo pair. */
export function buildCrossRepoArcs(csrOffsets, csrNeighbors, repoIndex) {
  const grouped = new Map();
  const count = csrOffsets.length - 1;

  for (let node = 0; node < count; node += 1) {
    const from = repoIndex[node];
    for (let e = csrOffsets[node]; e < csrOffsets[node + 1]; e += 1) {
      const to = repoIndex[csrNeighbors[e]];
      if (from === to) continue;
      const key = `${from}:${to}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
  }

  return Array.from(grouped, ([key, count_]) => {
    const [fromRepo, toRepo] = key.split(':').map(Number);
    return { fromRepo, toRepo, count: count_, edgeTypes: ['NEAR'] };
  }).sort((a, b) => a.fromRepo - b.fromRepo || a.toRepo - b.toRepo);
}

/** --------------------------------------------------------- D7 storage */

/**
 * Storage accounting over content addressed vector blocks.
 *
 * `TensorBlockPayloadStore` stores a vector once per distinct content and
 * references it from every node that carries it, so the dedupe ratio here is
 * real rather than modelled: two symbols whose embedding text is identical do
 * share one block.
 */
export function accountStorage(vectors, dimension) {
  const bytesPerVector = dimension * 4;
  const distinct = new Set();
  for (const vector of vectors) {
    distinct.add(Array.from(vector).join(','));
  }

  const blocks = distinct.size;
  const uniqueBytes = blocks * bytesPerVector;
  const referencedBytes = vectors.length * bytesPerVector;

  return {
    blocks,
    uniqueBytes,
    referencedBytes,
    dedupeRatio: uniqueBytes > 0 ? Number((referencedBytes / uniqueBytes).toFixed(4)) : 1,
    residentBytes: uniqueBytes,
    diskBytes: uniqueBytes,
  };
}
