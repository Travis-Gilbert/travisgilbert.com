# SPEC-PORTFOLIO-FIELD-1.0: what shipped

The spec's own sequencing has four steps. This is step 2, which the spec says
"alone replaces the stale Projects section":

> D9 static projection and D10 host page against the fixture snapshot (ships a
> crawlable, updated portfolio before the leaf paints)

Steps 1, 3 and 4 are Rust in the Theorem repository. Nothing in this repository
can supply them, and the reasons are in "Blocked" below.

## Shipped

| Item | Where | What it does |
| --- | --- | --- |
| D0 decision | `config/portfolio.json` | The allowlist, as data. D0-b is in force. Choosing D0-a means deleting the Theorem entry and nothing else. |
| D0-b withholding | `src/lib/portfolio/sideTable.ts` | Strict zod schemas. A payload carrying `snippet`, `body` or `search_text` fails to parse rather than reaching a component that might render it. |
| D3 wire format | `src/lib/portfolio/fieldSnapshot.ts` | `fieldSnapshot` encode and decode. Struct of arrays, section offsets derived by one shared function so encoder and decoder cannot disagree, `LAYOUT_CONTRACT` pinned in a test. |
| Fixture | `fixtures/portfolio/`, `scripts/` | Stands in for D1 to D3 until the tenant exists. Deterministic: two runs produce byte identical files. |
| D9 tree | `src/lib/portfolio/semanticTree.ts` | One tree, keyed by C12's ident grammar. D4 raises the same tree from the leaf. |
| D9 projection | `src/components/portfolio/SemanticProjection.tsx` | The tree as HTML. Server component, no client JavaScript, present in the static export. |
| D10 route | `src/app/portfolio/page.tsx` | `/portfolio`, rendering the projection inside the host element the field will adopt. |
| C9 badge | `src/components/portfolio/CapabilityBadge.tsx` | Reports what the visitor's browser actually offers. Claims no residency, because none is held. |
| D10 headers | `nginx.conf` | COOP and COEP on `/portfolio` only, and `application/wasm`. |
| D10 provenance | `vendor/gpui/` | `gpui-leaf.js` pinned to Theorem `63802c5f`, with a drift check. |

Verify with `npm test` (77 tests), `npm run build`, and
`npm run check:leaf-provenance`.

## Blocked, and why

Verified by inspection of Theorem at `63802c5ff89a57c27745735e3df0d6811dd6438d`:

- **D1, D2, D3 server, D5, D6, D7, D8.** The `agpui-contract`, `agpui-registry`
  and `agpui` crates do not exist. Neither do `fieldSnapshot`,
  `storageAccounting`, `code.knn_edges`, or `field_projection.rs`. These are
  unwritten Rust in a repository this branch cannot push to.
- **D4, the residency slice.** Two separate blockers, both under test in
  `tests/leafProvenance.test.ts` so they announce themselves when they clear:
  1. `gpui-leaf.js` dispatches on four leaf kinds (`record-form`, `thread`,
     `document`, `story`). There is no `field`, so `startLeaf('field')` has
     nothing to start. D4 needs an upstream change, and at that point the
     vendored copy stops being a pure copy.
  2. Adoption calls `host.replaceChildren(canvas)`, which **removes** D9's
     projection from the host. Whatever mounts the field has to re-append the
     projection under the canvas, or the page loses its crawlable content the
     moment a GPU shows up.

The leaf is vendored to `vendor/` rather than `public/` on purpose. Serving it
before a bundle exists would ship a script with no caller. It moves to
`public/gpui/` in the same change that adds the `field` leaf kind.

## Where the fixture differs from the real pipeline

The fixture is honest about being a fixture. Three deliberate divergences:

1. **Embedder.** C8 specifies bge-small at 384 dimensions, which reads bodies and
   docs. The fixture uses the verified FNV hash embedder, which is the same
   function `rustyred-code-embedding` exports, proven byte identical against the
   Rust output in `evidence/embedder/`.
2. **Embedding text and width.** The extractor has no bodies, so name and
   signature alone left almost nothing to be similar about: at the hook's 64
   buckets only 18 percent of a symbol's nearest neighbours came from the same
   source directory, which is a field with no structure in it. Adding path tokens
   and widening to 1024 buckets takes that to 73 percent. The path stands in for
   the locality bge-small would get from reading the code.
3. **Communities.** Label propagation collapsed into one cluster holding 63
   percent of all symbols. Louvain at resolution 3 gives 48 balanced communities
   with 83 percent repo purity, seeded so the payload stays byte identical.

When D1 and D3 land on the server, `loadFieldSnapshot` changes where the two
halves come from and nothing downstream of it moves.

## Not done, and deliberate

- `/projects` is untouched. The spec says step 2 replaces the stale Projects
  section; deleting existing content is the owner's call, not this branch's.
  Both routes are in the nav.
- `nginx.conf` was not run through `nginx -t`. No Docker daemon is available in
  this environment. The two added blocks use documented directives (`types { }`
  with `default_type` is the nginx manual's own idiom) but they are unexecuted.
