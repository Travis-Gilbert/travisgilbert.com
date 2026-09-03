/**
 * D0's decision, held as data.
 *
 * The allowlist is where D0-a and D0-b differ: choosing D0-a means deleting the
 * Theorem entry from `config/portfolio.json` and nothing else. These tests hold
 * the invariants that must survive either choice, and the one that only holds
 * while Theorem is in: a private repo has to withhold bodies.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_REVISIONS_PER_REPO,
  getPortfolioConfig,
  parsePortfolioConfig,
  repoRevisionUrl,
  symbolSourceUrl,
} from '@/lib/portfolio/allowlist';

const config = getPortfolioConfig();

function repoFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'repo:Travis-Gilbert/theorem',
    name: 'Theorem',
    url: 'https://github.com/Travis-Gilbert/theorem',
    blurb: 'A blurb.',
    private: false,
    bodyWithheld: false,
    revisions: [{ sha: 'a'.repeat(40), label: 'main', date: '2026-09-03' }],
    ...overrides,
  };
}

function configFixture(repos: unknown[]) {
  return { tenant: 'portfolio-public', endpoint: '', d0: 'D0-b', repos };
}

describe('portfolio allowlist', () => {
  it('parses the committed config', () => {
    expect(config.repos.length).toBeGreaterThan(0);
    expect(config.tenant).toBe('portfolio-public');
  });

  it('names a private tenant nowhere', () => {
    // C7 and the standing never both say the portfolio reaches one tenant only,
    // and that it is the read-only public one.
    expect(JSON.stringify(config)).not.toMatch(/theorem-private|private-tenant/i);
  });

  it('withholds bodies for every private repo', () => {
    for (const repo of config.repos) {
      if (repo.private) expect(repo.bodyWithheld).toBe(true);
    }
  });

  it('gives every repo a unique id in canonical form', () => {
    const ids = config.repos.map((repo) => repo.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^repo:[^/]+\/[^/]+$/);
  });

  it('pins every revision to a full commit sha', () => {
    for (const repo of config.repos) {
      expect(repo.revisions.length).toBeGreaterThan(0);
      for (const revision of repo.revisions) expect(revision.sha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('rejects a short sha, which is what an abbreviated paste looks like', () => {
    expect(() =>
      parsePortfolioConfig(
        configFixture([repoFixture({ revisions: [{ sha: 'abc1234', label: 'main', date: '2026-09-03' }] })]),
      ),
    ).toThrow();
  });

  it('rejects more revisions than D3 will scrub through', () => {
    const revisions = Array.from({ length: MAX_REVISIONS_PER_REPO + 1 }, (_unused, i) => ({
      sha: String(i).padStart(40, '0'),
      label: `r${i}`,
      date: '2026-09-03',
    }));
    expect(() => parsePortfolioConfig(configFixture([repoFixture({ revisions })]))).toThrow();
  });

  it('builds a source link that lands on the declaration', () => {
    const repo = config.repos[0];
    const sha = repo.revisions[0].sha;
    expect(symbolSourceUrl(repo, sha, 'crates/a/src/lib.rs', 42)).toBe(
      `${repo.url}/blob/${sha}/crates/a/src/lib.rs#L42`,
    );
    // A symbol with no recorded line still gets a working file link.
    expect(symbolSourceUrl(repo, sha, 'crates/a/src/lib.rs')).toBe(
      `${repo.url}/blob/${sha}/crates/a/src/lib.rs`,
    );
    expect(repoRevisionUrl(repo, sha)).toBe(`${repo.url}/tree/${sha}`);
  });
});
