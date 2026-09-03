/**
 * The TypeScript embedder against the Rust one, using the recorded evidence.
 *
 * `evidence/embedder/rust-hash-embedder.tsv` was produced by compiling
 * `rustyred-code-embedding` and printing its output; the TS file beside it was
 * produced by this port. They are byte identical, and this test is what keeps
 * them that way after an edit to either side.
 *
 * The comparison is exact rather than approximate on purpose. C8's local
 * embedder is deterministic, so a difference of one bit is a difference, and
 * a tolerance here would hide the drift it exists to catch.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  HASH_EMBEDDING_DIM,
  cosineSimilarity,
  hashCodeEmbedding,
  symbolEmbeddingText,
  tokenizeCode,
} from '@/lib/portfolio/hashEmbedding';

const EVIDENCE = path.join(process.cwd(), 'evidence', 'embedder');

interface Case {
  dimension: number;
  text: string;
  vector: number[];
}

function readCases(file: string): Case[] {
  return fs
    .readFileSync(path.join(EVIDENCE, file), 'utf-8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [dimension, text, vector] = line.split('\t');
      return {
        dimension: Number(dimension),
        text,
        vector: vector.split(',').map(Number),
      };
    });
}

describe('hash embedder', () => {
  const rust = readCases('rust-hash-embedder.tsv');

  it('recorded both sides of the comparison', () => {
    expect(rust.length).toBeGreaterThan(0);
    expect(readCases('ts-hash-embedder.tsv')).toEqual(rust);
  });

  it('reproduces every recorded Rust vector exactly', () => {
    for (const testCase of rust) {
      const actual = Array.from(hashCodeEmbedding(testCase.text, testCase.dimension));
      // The evidence is printed at nine decimals, which is what the recorded
      // values round to; compare on the same printed form rather than on floats
      // that differ only in how they were serialised.
      expect(actual.map((value) => value.toFixed(9))).toEqual(
        testCase.vector.map((value) => value.toFixed(9)),
      );
    }
  });

  it('normalises to unit length, or to the zero norm fallback', () => {
    const vector = hashCodeEmbedding('fn render_field(device: &Device)');
    const norm = Math.sqrt(Array.from(vector).reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 6);

    // Rust sets `vector[0] = 1.0` when nothing tokenised, so an empty input is a
    // unit vector rather than a zero one and cosine similarity stays defined.
    const empty = hashCodeEmbedding('');
    expect(empty[0]).toBe(1);
    expect(Array.from(empty.subarray(1)).every((v) => v === 0)).toBe(true);
  });

  it('splits on anything that is not a letter or a number, and lowercases ASCII', () => {
    expect(tokenizeCode('pub fn read_field<T>(x: &mut T) -> Result<(), E>')).toEqual([
      'pub', 'fn', 'read', 'field', 't', 'x', 'mut', 't', 'result', 'e',
    ]);
    // Unicode letters are letters. `to_ascii_lowercase` leaves them alone, so
    // the port must not reach for `toLowerCase`, which would fold them.
    expect(tokenizeCode('Ünïcode Δelta')).toEqual(['Ünïcode', 'Δelta']);
  });

  it('joins the embedding text in the field order the ingest hook uses', () => {
    expect(
      symbolEmbeddingText({
        name: 'read_field',
        signature: 'fn read_field()',
        snippet: 'let x = 1;',
        doc: 'Reads the field.',
        body: 'body',
      }),
    ).toBe('read_field fn read_field() let x = 1; Reads the field. body');
  });

  it('scores an identical vector as one and an orthogonal pair as zero', () => {
    const a = hashCodeEmbedding('fn alpha()');
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 6);

    const left = new Float32Array(HASH_EMBEDDING_DIM);
    const right = new Float32Array(HASH_EMBEDDING_DIM);
    left[0] = 1;
    right[1] = 1;
    expect(cosineSimilarity(left, right)).toBe(0);
  });
});
