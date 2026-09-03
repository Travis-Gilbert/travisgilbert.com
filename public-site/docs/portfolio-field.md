# SPEC-PORTFOLIO-FIELD-1.0: what shipped

The spec's sequencing has four steps. This is step 2, which the spec says "alone
replaces the stale Projects section":

> D9 static projection and D10 host page against the fixture snapshot (ships a
> crawlable, updated portfolio before the leaf paints)

Step 1 is D1, D2 and D3 on the server. It is next, and it is not blocked: those
three have no GPUI dependency, which is exactly why the spec puts them first.
They are Rust in the Theorem repository, and this branch has no push access
there, so what this repository can do for them is hold a fixture that matches
what they will produce and record the three findings in "What step 1 needs"
below. Steps 3 and 4 wait on D4, which is blocked, and the reasons are under
"Blocked".

## Shipped

| Item | Where | What it does |
| --- | --- | --- |
| D0 decision | `config/portfolio.json` | The allowlist, as data. D0-b is in force. Choosing D0-a means deleting the Theorem entry and nothing else. |
| D0-b withholding | `src/lib/portfolio/sideTable.ts` | Strict zod schemas. A payload carrying `snippet`, `body` or `search_text` fails to parse rather than reaching a component that might render it. |
| D3 wire format | `src/lib/portfolio/fieldSnapshot.ts` | `fieldSnapshot` encode and decode, format version 2. Struct of arrays, section offsets derived by one shared function so encoder and decoder cannot disagree, `LAYOUT_CONTRACT` pinned in a test. |
| Edge types | `src/lib/portfolio/fieldSnapshot.ts` | A `csrEdgeType` column beside `csrNeighbors`. `NEAR` is C5's kNN edge; `DECLARES_SYMBOL` is the symbol level projection of `code_kg`'s file to symbol edge. |
| Fixture | `fixtures/portfolio/`, `scripts/` | Stands in for D1 to D3 until the tenant exists. Deterministic: two runs produce byte identical files. |
| D9 tree | `src/lib/portfolio/semanticTree.ts` | One tree, keyed by C12's ident grammar. D4 raises the same tree from the leaf. |
| D9 projection | `src/components/portfolio/SemanticProjection.tsx` | The tree as HTML, including the edge legend D5 will scrub. Server component, no client JavaScript, present in the static export. |
| D10 route | `src/app/portfolio/page.tsx` | `/portfolio`, rendering the projection inside the host element the field will adopt. |
| C9 badge | `src/components/portfolio/CapabilityBadge.tsx` | Reports what the visitor's browser actually offers. Claims no residency, because none is held. |
| D10 headers | `nginx.conf` | COOP and COEP on `/portfolio` only, and `application/wasm`. |
| D10 provenance | `vendor/gpui/` | `gpui-leaf.js` pinned to Theorem `63802c5f`, with a drift check. |

Verify with `npm test` (95 tests), `npm run build`, and
`npm run check:leaf-provenance`.

## What the fixture is, and what it is not

The fixture runs the stages D1 to D3 will run, in the same order, with the same
inputs and the same algorithms, so that the day the server produces a real
snapshot the page does not change shape. Where it stands in for something, it
stands in visibly:

| Stage | Server | Fixture |
| --- | --- | --- |
| Symbols | `rustyred-thg-code` parses with a grammar | a declaration level scan, no parser dependency |
| Embedding text | `symbol_embedding_text`: name, signature, snippet, doc, body | the same function over the two fields a scan can fill |
| Embedder | C8's bge-small at 384 | the FNV hash embedder, proven byte identical against the Rust in `evidence/embedder/` |
| kNN | `vector_search` k=16, 15 kept | exact cosine kNN, k=16, 15 kept |
| Containment | `code_kg` `DECLARES_SYMBOL` | the same edge, projected onto symbols with a fanout of four |
| Communities | `CsrGraph::community_detection` | a port of it, in `scripts/fixture/pipeline.mjs` |
| Layout | C4 warm start | C3's force model, so iteration counts stay comparable |

Two things this table used to say and no longer does, because both were the
fixture flattering itself:

- **The embedding text does not contain the path.** An earlier revision appended
  path tokens and reported that the share of nearest neighbours in the same
  source directory rose from 18 percent to 73 percent. That measurement was
  circular: it put the directory in the vector and then counted directories.
  `symbol_embedding_text` reads name, signature, snippet, doc and body, and
  nothing else. `search_text` on the symbol node does concatenate the file path,
  which is what made the omission look like an oversight; they are different
  fields with different jobs. `tests/graph.test.ts` pins this.
- **The width is not tuned.** It is 384, which is what C8's bge-small
  designates. `EMBEDDING_DIM` in `code_embed_hook.rs` is 64, but its own comment
  calls that the legacy no-config value and says the designation follows the
  selected embedder. An earlier revision picked 1024 because the output looked
  better at 1024.

The containment structure the path tokens were reaching for is real, and it now
arrives as `DECLARES_SYMBOL`: its own weighted edge type, named in the legend
with its share, and switchable by D5 because an edge can be switched off and a
token folded into a vector cannot.

## What step 1 needs

Three findings from reading Theorem at `63802c5ff89a57c27745735e3df0d6811dd6438d`.
Each one changes what D1 to D3 should be written as, and each is checkable from
that commit or reproducible from this repository.

### 1. `graphAlgorithm(COMMUNITIES)` does not run Louvain

D3 assigns communities to `graphAlgorithm(COMMUNITIES)`. That dispatches to
`rustyred_thg_core::label_propagation_communities`
(`rustyred-thg-mcp/src/lib.rs:8637`), not to `CsrGraph`. The re-export that
sounds right is explicit about it:

```rust
#[deprecated(
    since = "0.1.0",
    note = "this function runs label propagation, not Louvain; use label_propagation_communities"
)]
pub fn louvain_communities(edges: &[EdgeRecord]) -> (HashMap<String, u64>, f64)
```

D3 should say which one it means. It is worth writing down what this does not
change, because an earlier revision of this document got it wrong in the
direction that flatters the recommendation. Label propagation is known to
collapse a well connected graph into one community, and on the earlier fixture
graph it did: 63 percent of all symbols in one cluster. On the corrected graph
it does not. Run over these 63,360 edges it gives 283 communities with the
largest at 4.9 percent, against local moving's 285 with the largest at 3.1
percent. The collapse was the contaminated embedding, not the algorithm, and it
went away with the path tokens.

So this is a naming and contract finding, not the cause of the cluster problem.
That is finding 2, and it is the same for both algorithms.

### 2. The resolution parameter is worth adding and will not fix the fragmentation

`CsrGraph::community_detection` is one level of local moving. There is no
aggregation phase, so once nodes settle into small groups nothing can merge
them, and gamma barely moves the result. Measured on the field graph, all with
the port in `scripts/fixture/pipeline.mjs`:

| gamma | 0.05 | 0.1 | 0.2 | 0.35 | 0.5 | 1 |
| --- | --- | --- | --- | --- | --- | --- |
| clusters | 269 | 271 | 272 | 275 | 278 | 285 |

A twentyfold change in gamma moves the count by six percent. Multi-level Louvain
over the identical graph gives 38 clusters at gamma 1 and a single cluster at
gamma 0.1, so gamma is a real knob only once the aggregation phase exists. Label
propagation lands in the same place from a different direction, at 283, which is
what says the fragmentation belongs to the missing phase rather than to either
algorithm's rule. C11 shows at most 64 clusters; at 285 the page shows the 64
largest and says so, and they cover 51 percent of the corpus.

So the change to `CsrGraph::community_detection` is two changes, in this order:
add the aggregation phase, then expose gamma as
`k_in - gamma * sigma_tot * k_u / 2m` on `graphAlgorithm`. Gamma alone is worth
having and does not get this under 64 on its own.

While reading it: the pick loop iterates a `HashMap`, so two communities tied on
gain are separated by `RandomState` and the partition can differ between runs of
one binary. Ties are rare in floating point and D3 asks for a byte identical
payload. The port here iterates a `Map` in neighbour order instead, which is the
only place it deliberately differs.

### 3. The hash embedder carries almost no code semantics

With the input contract restored, 10.6 percent of the 50,370 `NEAR` edges join
two symbols in the same source directory. The hash embedder is a bag of tokens
over an identifier and one line of signature; two symbols are neighbours when
they share a word. That is enough to prove the pipeline and the wire format, and
it is not a code embedding.

This is the case for C8. bge-small reading bodies would do better than a token
bag; a code adapted embedder better still. The revision worth making is C8 to
Jina v4 through the hosted API with its code task adapter, keeping
`RUSTYRED_CODE_EMBEDDER=local` and bge-small as the offline default so the
fixture and the test suite stay runnable with no network.

## Blocked, and why

Verified by inspection of Theorem at `63802c5ff89a57c27745735e3df0d6811dd6438d`:

- **D4, the residency slice**, and therefore D5, D6, D7 and D8. Two separate
  blockers, both under test in `tests/leafProvenance.test.ts` so they announce
  themselves when they clear:
  1. `gpui-leaf.js` dispatches on four leaf kinds (`record-form`, `thread`,
     `document`, `story`). There is no `field`, so `startLeaf('field')` has
     nothing to start. D4 needs an upstream change, and at that point the
     vendored copy stops being a pure copy.
  2. Adoption calls `host.replaceChildren(canvas)`, which **removes** D9's
     projection from the host. Whatever mounts the field has to re-append the
     projection under the canvas, or the page loses its crawlable content the
     moment a GPU shows up.
- The `agpui-contract`, `agpui-registry` and `agpui` crates do not exist on
  `main`, and neither does `field_projection.rs`.

The leaf is vendored to `vendor/` rather than `public/` on purpose. Serving it
before a bundle exists would ship a script with no caller. It moves to
`public/gpui/` in the same change that adds the `field` leaf kind.

## Not done, and deliberate

- `/projects` is untouched. The spec says step 2 replaces the stale Projects
  section; deleting existing content is the owner's call, not this branch's.
  Both routes are in the nav.
- `nginx.conf` was not run through `nginx -t`. No Docker daemon is available in
  this environment. The two added blocks use documented directives (`types { }`
  to clear inherited MIME mappings, `add_header ... always`), and COEP is scoped
  to `/portfolio` because the essay pages embed `youtube-nocookie.com` iframes
  and `img.youtube.com` thumbnails that `require-corp` would break.
