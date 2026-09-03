/**
 * The repo allowlist that D1 hands the ingest job, read here as data.
 *
 * D0 is the one decision the spec reserves for Travis. It lives in
 * `config/portfolio.json` rather than in code so that choosing D0-a (drop
 * Theorem) or D0-b (keep it with bodies withheld) is an edit to one file and
 * nothing else moves, exactly as the spec says it should be.
 */

import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const revisionSchema = z.object({
  /** Branch or tag as the ingest job checked it out. */
  ref: z.string().min(1),
  sha: z.string().regex(/^[0-9a-f]{40}$/, 'revision sha must be a full 40 character hex sha'),
});

const repoSchema = z.object({
  /** Matches `canonical_repo_id_from_url` in repo_fetch.rs, which yields `repo:owner/name`. */
  id: z.string().regex(/^repo:[^/]+\/[^/]+$/, 'repo id must look like repo:owner/name'),
  name: z.string().min(1),
  url: z.string().url(),
  blurb: z.string().min(1),
  private: z.boolean().default(false),
  /** D0-b: serve structure for this repo but never snippet, body, or search text. */
  bodyWithheld: z.boolean().default(false),
  revisions: z.array(revisionSchema).min(1).max(8),
});

const portfolioConfigSchema = z.object({
  tenant: z.string().min(1),
  /**
   * Public tenant GraphQL endpoint. Empty until D1 stands the Fly app up, which
   * is what keeps the site reading the committed fixture instead of guessing a
   * URL that does not answer yet.
   */
  endpoint: z.string().default(''),
  d0: z.enum(['D0-a', 'D0-b']),
  repos: z.array(repoSchema).min(1),
});

export type PortfolioRevision = z.infer<typeof revisionSchema>;
export type PortfolioRepo = z.infer<typeof repoSchema>;
export type PortfolioConfig = z.infer<typeof portfolioConfigSchema>;

export const PORTFOLIO_CONFIG_PATH = path.join('config', 'portfolio.json');

/** D3 caps a snapshot at eight revisions per repo; the schema enforces it above. */
export const MAX_REVISIONS_PER_REPO = 8;

let cached: PortfolioConfig | null = null;

export function getPortfolioConfig(): PortfolioConfig {
  if (cached) return cached;
  const configPath = path.join(process.cwd(), PORTFOLIO_CONFIG_PATH);
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  cached = portfolioConfigSchema.parse(raw);
  return cached;
}

/** Parse without touching the filesystem, for tests and for the fixture generator. */
export function parsePortfolioConfig(raw: unknown): PortfolioConfig {
  return portfolioConfigSchema.parse(raw);
}

/**
 * Deep link to a symbol at the revision it was indexed at.
 *
 * A withheld repo still gets a link. Withholding covers the body text the API
 * serves, not the existence of the repo, and a private repo's link simply asks
 * GitHub for authorization like any other.
 */
export function symbolSourceUrl(
  repo: PortfolioRepo,
  revisionSha: string,
  filePath: string,
  line?: number,
): string {
  const anchor = line && line > 0 ? `#L${line}` : '';
  const clean = filePath.replace(/^\/+/, '');
  return `${repo.url}/blob/${revisionSha}/${clean}${anchor}`;
}

/** Link to a repo at a pinned revision, used as each section's outbound link. */
export function repoRevisionUrl(repo: PortfolioRepo, revisionSha: string): string {
  return `${repo.url}/tree/${revisionSha}`;
}
