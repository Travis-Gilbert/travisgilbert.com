# Hash embedder parity

`src/lib/portfolio/hashEmbedding.ts` reimplements `hash_code_embedding` from
`rustyredcore_THG/crates/rustyred-code-embedding/src/lib.rs` so the fixture
generator can produce symbol vectors before D1 stands up a tenant.

A reimplementation is only worth having if it agrees with the original, so this
is the check rather than an assertion that it should.

## How these files were produced

The Rust side was compiled against the real crate at Theorem
`63802c5ff89a57c27745735e3df0d6811dd6438d`, default features, and run over seven
cases chosen to hit the places a port drifts:

- a full Rust signature with punctuation
- a snake_case identifier
- a Rust type declaration
- the empty string, which takes the zero norm branch that sets component 0 to 1
- a Unicode and mixed case string, which separates `to_ascii_lowercase` from a
  Unicode fold and `char::is_alphanumeric` from `[A-Za-z0-9]`
- dimension 17, a non power of two, which exercises the modulo bucket
- dimension 1, where every token lands in the same bucket

Both sides printed each component at nine decimal places.

## Result

`rust-hash-embedder.tsv` and `ts-hash-embedder.tsv` are byte identical.

Reproduce:

    diff evidence/embedder/rust-hash-embedder.tsv evidence/embedder/ts-hash-embedder.tsv

`npm run test` also asserts the parity vectors from `rust-hash-embedder.tsv`
directly, so a regression in the port fails the suite rather than waiting for
someone to rerun cargo.
