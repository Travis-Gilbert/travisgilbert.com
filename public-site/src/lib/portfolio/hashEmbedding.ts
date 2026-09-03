/**
 * A faithful mirror of `hash_code_embedding` from
 * `rustyredcore_THG/crates/rustyred-code-embedding/src/lib.rs`.
 *
 * The fixture generator needs symbol vectors before D1 stands up a tenant that
 * can produce them. Rather than invent a stand in, this reimplements the
 * embedder the codebase already ships as its default (`CodeEmbeddingKind::Hash`
 * at `EMBEDDING_DIM = 64`), so a fixture built here and a fixture built by the
 * Rust ingest agree value for value.
 *
 * Fidelity notes, each one a place a casual port would drift:
 *  - `to_ascii_lowercase` folds only A through Z. `String.toLowerCase` folds
 *    Unicode, so this does the ASCII fold by hand.
 *  - `char::is_alphanumeric` is Unicode aware, so the split uses \p{L} and \p{N}
 *    rather than [A-Za-z0-9].
 *  - Rust accumulates in f32. The vector is a Float32Array and the norm is
 *    rounded per step, so the divisions round the same way.
 *  - The zero norm branch sets the first component to 1.0 instead of leaving
 *    zeros, and callers depend on the result being unit length.
 *
 * When D1 switches the machine to `RUSTYRED_CODE_EMBEDDER=local` (bge-small at
 * 384 dimensions) the numbers change but nothing structural does: the snapshot
 * format, the kNN step, and the layout all read a unit length vector of some
 * dimension.
 */

/** Matches `EMBEDDING_DIM` in code_embed_hook.rs. */
export const HASH_EMBEDDING_DIM = 64;

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x00000100000001b3n;
const U64_MASK = 0xffffffffffffffffn;

/** Split on anything that is not a Unicode letter or number, as Rust's `is_alphanumeric` does. */
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/u;

function asciiLowercase(token: string): string {
  let out = '';
  for (let i = 0; i < token.length; i += 1) {
    const code = token.charCodeAt(i);
    out += code >= 0x41 && code <= 0x5a ? String.fromCharCode(code + 0x20) : token[i];
  }
  return out;
}

export function tokenizeCode(text: string): string[] {
  return text
    .split(NON_ALPHANUMERIC)
    .filter((token) => token.length > 0)
    .map(asciiLowercase);
}

/** FNV-1a over the token's UTF-8 bytes, wrapping at 64 bits. */
export function fnv1a(token: string): bigint {
  const bytes = new TextEncoder().encode(token);
  let hash = FNV_OFFSET_BASIS;
  for (const byte of bytes) {
    hash = (hash ^ BigInt(byte)) & U64_MASK;
    hash = (hash * FNV_PRIME) & U64_MASK;
  }
  return hash;
}

export function hashCodeEmbedding(text: string, dimension = HASH_EMBEDDING_DIM): Float32Array {
  const size = Math.max(1, dimension);
  const vector = new Float32Array(size);

  for (const token of tokenizeCode(text)) {
    const hash = fnv1a(token);
    const index = Number(hash % BigInt(size));
    const sign = ((hash >> 1n) & 1n) === 0n ? 1 : -1;
    vector[index] += sign;
  }

  l2Normalize(vector);
  return vector;
}

export function l2Normalize(vector: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) {
    sum = Math.fround(sum + Math.fround(vector[i] * vector[i]));
  }
  const norm = Math.fround(Math.sqrt(sum));

  if (norm > 0) {
    for (let i = 0; i < vector.length; i += 1) {
      vector[i] = vector[i] / norm;
    }
  } else if (vector.length > 0) {
    vector[0] = 1;
  }
}

/** Dot product. Valid as cosine because every vector here is unit length. */
export function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < left.length; i += 1) {
    sum = Math.fround(sum + Math.fround(left[i] * right[i]));
  }
  return sum;
}

/**
 * Mirror of `symbol_embedding_text` in code_embed_hook.rs: the non empty values
 * of name, signature, snippet, doc and body joined by a single space, in that
 * order. The generator has name and signature; the withheld fields stay absent,
 * which is the same thing the hook sees for a symbol with no snippet.
 */
export function symbolEmbeddingText(parts: {
  name?: string;
  signature?: string;
  snippet?: string;
  doc?: string;
  body?: string;
}): string {
  return [parts.name, parts.signature, parts.snippet, parts.doc, parts.body]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
}
