/**
 * The JSON side table that travels with a `fieldSnapshot` payload, D3.
 *
 * D0-b says the public API serves name, kind, signature, path, repo, revision,
 * position and cluster for a withheld repo, and never snippet, body, or
 * search_text. That rule is enforced here rather than described: the symbol
 * schema is strict, so a payload carrying a withheld key fails to parse instead
 * of reaching a component that might render it. The test in
 * `sideTable.test.ts` holds the rule to that.
 */

import { z } from 'zod';

/** Keys D0-b withholds. Named once so the schema and its test cannot drift apart. */
export const WITHHELD_SYMBOL_KEYS = ['snippet', 'body', 'search_text', 'searchText'] as const;

export const symbolRowSchema = z
  .object({
    ordinal: z.number().int().nonnegative(),
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.string().min(1),
    signature: z.string(),
    path: z.string().min(1),
    line: z.number().int().positive().optional(),
    /** Repo id, matching `PortfolioRepo.id`. */
    repo: z.string().min(1),
    revision: z.string().min(1),
    firstSeenRevision: z.string().min(1),
  })
  .strict();

export const clusterRowSchema = z
  .object({
    id: z.number().int().nonnegative(),
    /** Top TF-IDF terms over member symbol names, joined for display. */
    label: z.string().min(1),
    terms: z.array(z.string()).max(3),
    size: z.number().int().nonnegative(),
  })
  .strict();

export const repoRowSchema = z
  .object({
    index: z.number().int().nonnegative(),
    id: z.string().min(1),
    name: z.string().min(1),
    url: z.string().url(),
    blurb: z.string(),
    private: z.boolean(),
    bodyWithheld: z.boolean(),
    revision: z.string().min(1),
    symbolCount: z.number().int().nonnegative(),
  })
  .strict();

/** D7 `storageAccounting`. Rendered as the panel's definition list. */
export const storageAccountingSchema = z
  .object({
    blocks: z.number().int().nonnegative(),
    uniqueBytes: z.number().int().nonnegative(),
    referencedBytes: z.number().int().nonnegative(),
    dedupeRatio: z.number(),
    residentBytes: z.number().int().nonnegative(),
    diskBytes: z.number().int().nonnegative(),
  })
  .strict();

/** D7 per request touched receipt, returned as a GraphQL extension field. */
export const touchedReceiptSchema = z
  .object({
    nodesVisited: z.number().int().nonnegative(),
    blocksRead: z.number().int().nonnegative(),
    wallMs: z.number().nonnegative(),
  })
  .strict();

export const crossRepoArcSchema = z
  .object({
    fromRepo: z.number().int().nonnegative(),
    toRepo: z.number().int().nonnegative(),
    count: z.number().int().positive(),
    edgeTypes: z.array(z.string()).min(1),
  })
  .strict();

export const fieldSideTableSchema = z
  .object({
    formatVersion: z.literal(1),
    tenant: z.string().min(1),
    revision: z.string().min(1),
    /** Provenance for the fixture: which generator produced it, from what. */
    source: z
      .object({
        generator: z.string().min(1),
        embedder: z.string().min(1),
        embeddingDim: z.number().int().positive(),
        knnK: z.number().int().positive(),
        seed: z.number().int(),
        layoutContractSha256: z.string().length(64),
      })
      .strict(),
    repos: z.array(repoRowSchema).min(1),
    clusters: z.array(clusterRowSchema),
    symbols: z.array(symbolRowSchema),
    arcs: z.array(crossRepoArcSchema).default([]),
    storage: storageAccountingSchema,
    touched: touchedReceiptSchema,
  })
  .strict();

export type SymbolRow = z.infer<typeof symbolRowSchema>;
export type ClusterRow = z.infer<typeof clusterRowSchema>;
export type RepoRow = z.infer<typeof repoRowSchema>;
export type StorageAccounting = z.infer<typeof storageAccountingSchema>;
export type TouchedReceipt = z.infer<typeof touchedReceiptSchema>;
export type CrossRepoArc = z.infer<typeof crossRepoArcSchema>;
export type FieldSideTable = z.infer<typeof fieldSideTableSchema>;

export function parseFieldSideTable(raw: unknown): FieldSideTable {
  return fieldSideTableSchema.parse(raw);
}
