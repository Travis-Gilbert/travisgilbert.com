/**
 * The fixture side of D2 and D3: turn extracted symbols into a field snapshot.
 *
 * Each stage stands in for server work the spec assigns to Rust, and each one
 * mirrors the shape of its counterpart rather than inventing a different one:
 *
 *  - embedding        `code.incremental_embed`, via the verified hash embedder
 *  - kNN              D2 `code.knn_edges`, vector_search k=16, self dropped, 15 kept
 *  - containment      the symbol level projection of `code_kg`'s DECLARES_SYMBOL
 *  - communities      a port of `CsrGraph::community_detection` in `graph_csr.rs`
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

import {
  hashCodeEmbedding,
  cosineSimilarity,
  symbolEmbeddingText,
} from '../../src/lib/portfolio/hashEmbedding.ts';
import { EDGE_TYPE_NAMES, MAX_DEGREE } from '../../src/lib/portfolio/fieldSnapshot.ts';

/** D2 asks vector_search for 16 and keeps 15 after dropping self. */
export const KNN_SEARCH_K = 16;
export const KNN_KEPT = 15;

/** Layout iterations for the warm start. */
const LAYOUT_ITERATIONS = 320;

/**
 * Modularity resolution, gamma in the local moving gain.
 *
 * `CsrGraph::community_detection` has no resolution parameter: its gain is
 * `k_in - sigma_tot * k_u / 2m`, which is gamma fixed at 1. This default is that
 * number, so the fixture reports what the server reports. The argument exists
 * because gamma is the knob that belongs in the Rust, and a fixture that already
 * takes it can be pointed at a tuned server without a second implementation
 * appearing here to do the tuning.
 */
export const COMMUNITY_RESOLUTION = 1;

/** `community_detection` caps its local moving sweeps at 64. */
const COMMUNITY_MAX_PASSES = 64;

/** The epsilon the Rust requires a gain to clear before it moves a node. */
const COMMUNITY_GAIN_EPSILON = 1e-12;

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
 * Embedding width, taken from C8's embedder rather than tuned here.
 *
 * `EMBEDDING_DIM` in `code_embed_hook.rs` is 64, but its own comment calls that
 * the legacy no-config value and says the designation follows the selected
 * embedder. C8 selects bge-small, which is 384, so 384 is the width the tenant
 * will designate and therefore the width the fixture writes.
 *
 * A wider hash space does separate these vectors better, and an earlier revision
 * of this file picked 1024 on exactly that evidence. That was choosing a number
 * because it flattered the output. The width is not the fixture's to choose.
 */
export const FIXTURE_EMBEDDING_DIM = 384;

/**
 * The text the fixture embeds, which is the text the hook embeds.
 *
 * `symbol_embedding_text` joins name, signature, snippet, doc and body, in that
 * order, and reads nothing else. In particular it does not read the path: the
 * path reaches the graph as a `CodeFile` node and a `DECLARES_SYMBOL` edge, not
 * as tokens in the vector. `search_text` on the symbol node does concatenate the
 * file path, which is what makes the omission here look like an oversight and is
 * not: search text and embedding text are different fields with different jobs.
 *
 * An earlier revision of this file appended path tokens, on the argument that
 * they stood in for the body this extractor cannot read. They do not stand in for
 * it. Putting the directory into the vector and then measuring how often
 * neighbours share a directory measures the substitution, not the field, and what
 * it produced was a tokenized file tree. The containment structure that argument
 * was reaching for is real and now arrives as its own edge type, below, where a
 * viewer can see it and switch it off.
 */
export function embedSymbols(symbols, dimension = FIXTURE_EMBEDDING_DIM) {
  return symbols.map((symbol) =>
    hashCodeEmbedding(
      symbolEmbeddingText({ name: symbol.name, signature: symbol.signature }),
      dimension,
    ),
  );
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

  if (count === 0) return emptyEdges(csrOffsets);

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
    }
  }
  csrOffsets[count] = neighbors.length;

  return {
    csrOffsets,
    csrNeighbors: Uint32Array.from(neighbors),
    csrWeights: Float32Array.from(weights),
  };
}

function emptyEdges(csrOffsets) {
  return {
    csrOffsets,
    csrNeighbors: new Uint32Array(0),
    csrWeights: new Float32Array(0),
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

/** ------------------------------------------------- DECLARES_SYMBOL edges */

/**
 * How many declaration order neighbours on each side a symbol links to.
 *
 * The `code_kg` edge is bipartite: a `CodeFile` declares each of its symbols.
 * The field's nodes are symbols, so the edge has to be projected onto them, and
 * the textbook projection makes every file a clique. On this corpus that is a
 * 400 symbol file contributing 79,800 edges, which is not a projection so much as
 * a wall, and it would swamp the 15 semantic edges each symbol gets from C5.
 *
 * So the projection is windowed: a symbol links to the four declarations either
 * side of it in the same file. That keeps the per node cost bounded and constant,
 * keeps NEAR the dominant edge type, and encodes the part of containment a reader
 * would actually claim, which is that things declared next to each other belong
 * together more than things at opposite ends of a thousand line file.
 */
export const DECLARES_FANOUT = 4;

/**
 * The symbol level projection of `code_kg`'s `DECLARES_SYMBOL` edge.
 *
 * This is the structure the path tokens were faking. It belongs in the graph
 * rather than in the vector for two reasons that are not about taste: the
 * embedding has a defined input and the path is not in it, and an edge type can
 * be named in a legend and switched off by D5's scrubber, so a viewer can see
 * exactly how much of the layout it is responsible for. A token folded into a
 * vector can do neither.
 *
 * Weight decays as `1 / (1 + rank distance)`, so an adjacent declaration weighs
 * 0.5 and the fourth one 0.2. That lands in the same range as the cosine weights
 * on the NEAR edges, which is what lets `community_detection` sum the two edge
 * types without one of them deciding every community on scale alone.
 *
 * Symbols arrive grouped by repo and sorted by path then line, so one file's
 * symbols are contiguous and ascending. The grouping key still carries the repo,
 * because two repos can hold the same relative path and they are not one file.
 *
 * @param {Array<{repo: string, path: string}>} symbols in ordinal order
 */
export function buildDeclaresEdges(symbols, { fanout = DECLARES_FANOUT } = {}) {
  const count = symbols.length;
  const csrOffsets = new Uint32Array(count + 1);
  if (count === 0) return emptyEdges(csrOffsets);

  // Rank of each symbol within its file, and the members of each file.
  const files = new Map();
  for (let i = 0; i < count; i += 1) {
    const key = `${symbols[i].repo}\u0000${symbols[i].path}`;
    let members = files.get(key);
    if (members === undefined) {
      members = [];
      files.set(key, members);
    }
    members.push(i);
  }

  const rankOf = new Uint32Array(count);
  const fileOf = new Array(count);
  for (const members of files.values()) {
    for (let r = 0; r < members.length; r += 1) {
      rankOf[members[r]] = r;
      fileOf[members[r]] = members;
    }
  }

  const neighbors = [];
  const weights = [];
  for (let i = 0; i < count; i += 1) {
    const members = fileOf[i];
    const rank = rankOf[i];
    csrOffsets[i] = neighbors.length;
    const low = Math.max(0, rank - fanout);
    const high = Math.min(members.length - 1, rank + fanout);
    // Ascending rank is ascending index, because a file's members were collected
    // in ordinal order. Emitting in this order keeps each row sorted.
    for (let r = low; r <= high; r += 1) {
      if (r === rank) continue;
      neighbors.push(members[r]);
      weights.push(Math.fround(1 / (1 + Math.abs(r - rank))));
    }
  }
  csrOffsets[count] = neighbors.length;

  return {
    csrOffsets,
    csrNeighbors: Uint32Array.from(neighbors),
    csrWeights: Float32Array.from(weights),
  };
}

/** ------------------------------------------------------- edge type merge */

/**
 * Splice several typed edge sets into the one CSR the payload carries.
 *
 * Each set keeps its own rows, so an edge never loses which type it came from,
 * and a pair that is both NEAR and declared together stays as two edges. That is
 * deliberate: `undirected_weighted_adjacency` in `graph_csr.rs` sums parallel
 * edges, so two edges is how the server says "related twice over", and collapsing
 * them here would quietly halve that pair's pull.
 *
 * Degree is counted here rather than in the kNN, because a symbol's degree is how
 * many edges touch it, not how many of one kind do.
 *
 * @param {Array<{type: number, edges: {csrOffsets: Uint32Array, csrNeighbors: Uint32Array, csrWeights: Float32Array}}>} sets
 */
export function mergeEdgeTypes(sets, count) {
  const csrOffsets = new Uint32Array(count + 1);
  const neighbors = [];
  const weights = [];
  const types = [];
  const inDegree = new Uint32Array(count);

  for (let node = 0; node < count; node += 1) {
    csrOffsets[node] = neighbors.length;
    // Type order, not interleaved, so a row reads as "its NEAR edges, then its
    // DECLARES edges" and the scrubber can slice a row by type without a scan.
    for (const { type, edges } of sets) {
      for (let e = edges.csrOffsets[node]; e < edges.csrOffsets[node + 1]; e += 1) {
        neighbors.push(edges.csrNeighbors[e]);
        weights.push(edges.csrWeights[e]);
        types.push(type);
        inDegree[edges.csrNeighbors[e]] += 1;
      }
    }
  }
  csrOffsets[count] = neighbors.length;

  const degree = new Uint16Array(count);
  for (let node = 0; node < count; node += 1) {
    const out = csrOffsets[node + 1] - csrOffsets[node];
    degree[node] = Math.min(out + inDegree[node], MAX_DEGREE);
  }

  return {
    csrOffsets,
    csrNeighbors: Uint32Array.from(neighbors),
    csrWeights: Float32Array.from(weights),
    csrEdgeType: Uint8Array.from(types),
    degree,
  };
}

/** --------------------------------------------------------- communities */

/**
 * A port of `CsrGraph::community_detection` from `graph_csr.rs`.
 *
 * The point of a port rather than a library is parity. D3 runs communities on the
 * server, and a fixture that partitions the same graph differently from the
 * server is a fixture that promises a page the server cannot serve. An earlier
 * revision of this file used `graphology-communities-louvain` at resolution 3,
 * which is multi level Louvain with a graph aggregation phase and a tuned gamma.
 * The Rust is none of those things, so its 48 clusters were fixture only.
 *
 * What the Rust does, and what this does:
 *
 *  - one level of local moving, no aggregation, sweeping nodes in index order
 *  - gain `k_in - gamma * sigma_tot * k_u / 2m`, with gamma fixed at 1 there
 *  - a move only when the gain clears the incumbent by 1e-12
 *  - at most 64 sweeps
 *  - the Leiden refinement: split any community whose induced subgraph is
 *    disconnected into its connected pieces
 *  - labels compacted by first appearance in node order
 *
 * One difference, and it favours this side. The Rust picks the best community by
 * iterating a `HashMap`, so when two communities tie on gain the winner depends
 * on `RandomState` and can differ between runs of the same binary. A `Map` here
 * iterates in insertion order, which is neighbour order, which is fixed. Ties are
 * rare in floating point but D3 asks for a byte identical payload, and this is
 * the version that can promise one.
 *
 * `refineConnectivity` is on because `leiden_communities` is the variant worth
 * running: a community that is internally disconnected is two clusters wearing
 * one label, and C11 puts that label on the page.
 */
export function detectCommunities(
  csrOffsets,
  csrNeighbors,
  csrWeights,
  { resolution = COMMUNITY_RESOLUTION, refineConnectivity = true } = {},
) {
  const count = csrOffsets.length - 1;
  if (count === 0) return { clusterId: new Uint16Array(0), clusterCount: 0 };

  const undirected = buildUndirected(csrOffsets, csrNeighbors, csrWeights, count);

  const k = new Float64Array(count);
  let total2m = 0;
  for (let u = 0; u < count; u += 1) {
    let strength = 0;
    for (let e = undirected.offsets[u]; e < undirected.offsets[u + 1]; e += 1) {
      strength += undirected.weights[e];
    }
    k[u] = strength;
    total2m += strength;
  }

  // No weight means no modularity to optimise, and the Rust returns the identity
  // partition rather than one community. Mirrored so the degenerate case agrees.
  if (total2m <= 0) {
    const clusterId = new Uint16Array(count);
    for (let u = 0; u < count; u += 1) clusterId[u] = Math.min(u, 0xffff);
    return { clusterId, clusterCount: count };
  }

  const community = new Int32Array(count);
  for (let u = 0; u < count; u += 1) community[u] = u;
  const sigmaTot = Float64Array.from(k);

  const links = new Map();
  let improved = true;
  let passes = 0;
  while (improved && passes < COMMUNITY_MAX_PASSES) {
    improved = false;
    passes += 1;
    for (let u = 0; u < count; u += 1) {
      const currentCommunity = community[u];
      links.clear();
      for (let e = undirected.offsets[u]; e < undirected.offsets[u + 1]; e += 1) {
        const v = undirected.targets[e];
        if (v === u) continue;
        const c = community[v];
        links.set(c, (links.get(c) ?? 0) + undirected.weights[e]);
      }

      sigmaTot[currentCommunity] -= k[u];
      const linksToCurrent = links.get(currentCommunity) ?? 0;

      let bestCommunity = currentCommunity;
      let bestGain = linksToCurrent - (resolution * sigmaTot[currentCommunity] * k[u]) / total2m;
      for (const [candidate, linksTo] of links) {
        const gain = linksTo - (resolution * sigmaTot[candidate] * k[u]) / total2m;
        if (gain > bestGain + COMMUNITY_GAIN_EPSILON) {
          bestGain = gain;
          bestCommunity = candidate;
        }
      }

      sigmaTot[bestCommunity] += k[u];
      if (bestCommunity !== currentCommunity) {
        community[u] = bestCommunity;
        improved = true;
      }
    }
  }

  if (refineConnectivity) splitDisconnectedCommunities(undirected, community);

  const { labels, labelCount } = compactLabels(community);
  const clusterId = new Uint16Array(count);
  for (let u = 0; u < count; u += 1) clusterId[u] = Math.min(labels[u], 0xffff);
  return { clusterId, clusterCount: labelCount };
}

/**
 * The Leiden well connectedness refinement: a community whose induced subgraph
 * falls into pieces becomes one community per piece.
 *
 * Mirrors `split_disconnected_communities`, including that the first piece keeps
 * the original label and later pieces take fresh ones counting up from the
 * highest label in use.
 */
function splitDisconnectedCommunities(undirected, community) {
  const count = community.length;
  const members = new Map();
  for (let u = 0; u < count; u += 1) {
    let list = members.get(community[u]);
    if (list === undefined) {
      list = [];
      members.set(community[u], list);
    }
    list.push(u);
  }

  let nextLabel = 0;
  for (let u = 0; u < count; u += 1) {
    if (community[u] >= nextLabel) nextLabel = community[u] + 1;
  }

  const seen = new Uint8Array(count);
  const queue = new Int32Array(count);
  for (const [label, list] of members) {
    if (list.length < 2) continue;
    let first = true;
    for (const seed of list) {
      if (seen[seed]) continue;
      // BFS inside the community induced subgraph.
      let head = 0;
      let tail = 0;
      queue[tail++] = seed;
      seen[seed] = 1;
      const piece = [];
      while (head < tail) {
        const node = queue[head++];
        piece.push(node);
        for (let e = undirected.offsets[node]; e < undirected.offsets[node + 1]; e += 1) {
          const other = undirected.targets[e];
          if (seen[other] || community[other] !== label) continue;
          seen[other] = 1;
          queue[tail++] = other;
        }
      }
      if (first) {
        first = false;
        continue;
      }
      const fresh = nextLabel;
      nextLabel += 1;
      for (const node of piece) community[node] = fresh;
    }
  }
}

/** `compact_labels`: renumber by first appearance in node order. */
function compactLabels(community) {
  const remap = new Map();
  const labels = new Int32Array(community.length);
  for (let u = 0; u < community.length; u += 1) {
    let dense = remap.get(community[u]);
    if (dense === undefined) {
      dense = remap.size;
      remap.set(community[u], dense);
    }
    labels[u] = dense;
  }
  return { labels, labelCount: remap.size };
}

/**
 * `undirected_weighted_adjacency`: symmetrize by summing, not by taking a max.
 *
 * The distinction matters. A reciprocal kNN pair contributes both its weights, so
 * mutual nearest neighbours pull twice as hard as one sided ones, and a pair that
 * is both NEAR and declared together contributes both edges. An earlier revision
 * kept the heavier weight per pair, which silently discarded exactly the signal
 * the second edge type exists to add. Rows come out sorted by target, as the Rust
 * sorts them.
 */
function buildUndirected(csrOffsets, csrNeighbors, csrWeights, count) {
  const counts = new Uint32Array(count + 1);
  for (let node = 0; node < count; node += 1) {
    for (let e = csrOffsets[node]; e < csrOffsets[node + 1]; e += 1) {
      counts[node] += 1;
      if (csrNeighbors[e] !== node) counts[csrNeighbors[e]] += 1;
    }
  }

  const offsets = new Uint32Array(count + 1);
  for (let node = 0; node < count; node += 1) offsets[node + 1] = offsets[node] + counts[node];

  const cursor = offsets.slice(0, count);
  const rawTargets = new Uint32Array(offsets[count]);
  const rawWeights = new Float64Array(offsets[count]);
  for (let node = 0; node < count; node += 1) {
    for (let e = csrOffsets[node]; e < csrOffsets[node + 1]; e += 1) {
      const other = csrNeighbors[e];
      const weight = csrWeights[e];
      rawTargets[cursor[node]] = other;
      rawWeights[cursor[node]] = weight;
      cursor[node] += 1;
      if (other === node) continue;
      rawTargets[cursor[other]] = node;
      rawWeights[cursor[other]] = weight;
      cursor[other] += 1;
    }
  }

  // Sort each row by target and sum the duplicates, which is what the HashMap
  // and the following `sort_unstable_by_key` add up to on the Rust side.
  const mergedOffsets = new Uint32Array(count + 1);
  const targets = new Uint32Array(offsets[count]);
  const weights = new Float64Array(offsets[count]);
  let write = 0;
  const row = [];
  for (let node = 0; node < count; node += 1) {
    mergedOffsets[node] = write;
    row.length = 0;
    for (let e = offsets[node]; e < offsets[node + 1]; e += 1) {
      row.push([rawTargets[e], rawWeights[e]]);
    }
    row.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < row.length; i += 1) {
      if (i > 0 && row[i][0] === targets[write - 1]) {
        weights[write - 1] += row[i][1];
        continue;
      }
      targets[write] = row[i][0];
      weights[write] = row[i][1];
      write += 1;
    }
  }
  mergedOffsets[count] = write;

  return {
    offsets: mergedOffsets,
    targets: targets.subarray(0, write),
    weights: weights.subarray(0, write),
  };
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

/**
 * Group cross repo edges into one arc per ordered repo pair.
 *
 * `edgeTypes` is read off the edges rather than asserted. Today that always comes
 * back as NEAR alone, because a `DECLARES_SYMBOL` edge joins two symbols in one
 * file and a file is in one repo, so containment cannot cross a repo boundary by
 * construction. Deriving it anyway is what makes the arc honest the day
 * `CALLS_SYMBOL` lands, which does cross, without this function needing an edit.
 */
export function buildCrossRepoArcs(csrOffsets, csrNeighbors, csrEdgeType, repoIndex) {
  const grouped = new Map();
  const count = csrOffsets.length - 1;

  for (let node = 0; node < count; node += 1) {
    const from = repoIndex[node];
    for (let e = csrOffsets[node]; e < csrOffsets[node + 1]; e += 1) {
      const to = repoIndex[csrNeighbors[e]];
      if (from === to) continue;
      const key = `${from}:${to}`;
      let arc = grouped.get(key);
      if (arc === undefined) {
        arc = { count: 0, types: new Set() };
        grouped.set(key, arc);
      }
      arc.count += 1;
      arc.types.add(csrEdgeType[e]);
    }
  }

  return Array.from(grouped, ([key, arc]) => {
    const [fromRepo, toRepo] = key.split(':').map(Number);
    return {
      fromRepo,
      toRepo,
      count: arc.count,
      // Wire order, so two arcs carrying the same types list them the same way.
      edgeTypes: EDGE_TYPE_NAMES.filter((_, type) => arc.types.has(type)),
    };
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
