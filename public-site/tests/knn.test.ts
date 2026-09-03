/**
 * The sparse kNN against the all pairs scan it replaced.
 *
 * `buildKnn` uses an inverted index because comparing every pair at this
 * dimension does not finish. That is an optimisation, and an optimisation to a
 * step that decides which symbols end up adjacent is exactly the kind that can
 * be subtly wrong and still look plausible on the page. So the scan it replaced
 * lives here as the reference, and these tests hold the two to producing the
 * same edges, the same order, and the same weights.
 *
 * This caught a real defect: the first version used a running dot of zero as its
 * "not seen yet" marker, and a symbol whose signed buckets happened to cancel to
 * exactly zero was then admitted to the candidate list twice.
 */

import { describe, expect, it } from 'vitest';

// The fixture pipeline is plain JavaScript; `allowJs` types it structurally.
import { buildKnn, makeRng, KNN_SEARCH_K, KNN_KEPT } from '../scripts/fixture/pipeline.mjs';
import { cosineSimilarity } from '@/lib/portfolio/hashEmbedding';

function isBetter(score: number, index: number, other: number, otherIndex: number): boolean {
  return score !== other ? score > other : index < otherIndex;
}

/** The all pairs scan, kept as the reference implementation. */
function bruteKnn(vectors: Float32Array[], searchK = KNN_SEARCH_K, kept = KNN_KEPT) {
  const count = vectors.length;
  const csrOffsets = new Uint32Array(count + 1);
  const neighbors: number[] = [];
  const weights: number[] = [];
  const bestIndex = new Int32Array(searchK);
  const bestScore = new Float64Array(searchK);

  for (let i = 0; i < count; i += 1) {
    let filled = 0;
    for (let j = 0; j < count; j += 1) {
      if (j === i) continue;
      const score = cosineSimilarity(vectors[i], vectors[j]);
      if (filled < searchK) {
        let slot = filled;
        filled += 1;
        while (slot > 0 && isBetter(score, j, bestScore[slot - 1], bestIndex[slot - 1])) {
          bestScore[slot] = bestScore[slot - 1];
          bestIndex[slot] = bestIndex[slot - 1];
          slot -= 1;
        }
        bestScore[slot] = score;
        bestIndex[slot] = j;
        continue;
      }
      if (!isBetter(score, j, bestScore[filled - 1], bestIndex[filled - 1])) continue;
      let slot = filled - 1;
      while (slot > 0 && isBetter(score, j, bestScore[slot - 1], bestIndex[slot - 1])) {
        bestScore[slot] = bestScore[slot - 1];
        bestIndex[slot] = bestIndex[slot - 1];
        slot -= 1;
      }
      bestScore[slot] = score;
      bestIndex[slot] = j;
    }
    csrOffsets[i] = neighbors.length;
    for (let n = 0; n < Math.min(filled, kept); n += 1) {
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

/** Sparse signed unit vectors, shaped like what the hash embedder produces. */
function sampleVectors(count: number, dimension: number, nonZero: number, seed: number) {
  const rng = makeRng(seed);
  return Array.from({ length: count }, () => {
    const vector = new Float32Array(dimension);
    for (let k = 0; k < nonZero; k += 1) {
      vector[Math.floor(rng() * dimension)] += rng() < 0.5 ? 1 : -1;
    }
    let sum = 0;
    for (const value of vector) sum += value * value;
    if (sum === 0) vector[0] = 1;
    else {
      const norm = Math.sqrt(sum);
      for (let k = 0; k < dimension; k += 1) vector[k] = Math.fround(vector[k] / norm);
    }
    return vector;
  });
}

describe('sparse kNN', () => {
  it.each([
    [120, 64, 5],
    [200, 256, 12],
    [80, 32, 3],
    [50, 1024, 12],
  ])('matches the all pairs scan for %i vectors at dim %i', (count, dimension, nonZero) => {
    const vectors = sampleVectors(count, dimension, nonZero, 0x1234 + count);
    const sparse = buildKnn(vectors);
    const brute = bruteKnn(vectors);

    expect(Array.from(sparse.csrOffsets)).toEqual(Array.from(brute.csrOffsets));
    expect(Array.from(sparse.csrNeighbors)).toEqual(Array.from(brute.csrNeighbors));
    expect(Array.from(sparse.csrWeights)).toEqual(Array.from(brute.csrWeights));
    expect(sparse.csrNeighbors.length).toBeGreaterThan(0);
  });

  it('lists no symbol twice in one neighbourhood', () => {
    // The exactly-cancelling dot defect showed up here first.
    const vectors = sampleVectors(200, 256, 12, 0x99);
    const knn = buildKnn(vectors);
    for (let i = 0; i < vectors.length; i += 1) {
      const row = Array.from(knn.csrNeighbors.slice(knn.csrOffsets[i], knn.csrOffsets[i + 1]));
      expect(new Set(row).size).toBe(row.length);
      expect(row).not.toContain(i);
    }
  });

  it('handles an empty corpus', () => {
    const knn = buildKnn([]);
    expect(knn.csrOffsets).toHaveLength(1);
    expect(knn.csrNeighbors).toHaveLength(0);
  });
});
