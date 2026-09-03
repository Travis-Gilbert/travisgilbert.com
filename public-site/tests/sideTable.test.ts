/**
 * D0-b's withholding rule, held to structurally.
 *
 * The spec says the public API never serves snippet, body, or search_text for a
 * withheld repo. A rule written only in prose is a rule that survives until
 * someone adds a field. These tests hold the schema to rejecting those keys, so
 * the failure lands in CI rather than on the page.
 */

import { describe, expect, it } from 'vitest';

import {
  WITHHELD_SYMBOL_KEYS,
  parseFieldSideTable,
  symbolRowSchema,
} from '@/lib/portfolio/sideTable';
import { loadFieldSnapshot } from '@/lib/portfolio/snapshot';

const VALID_SYMBOL = {
  ordinal: 0,
  id: 'repo:Travis-Gilbert/theorem@63802c5:crates/a/src/lib.rs:1:read_field',
  name: 'read_field',
  kind: 'fn',
  signature: 'pub fn read_field()',
  path: 'crates/a/src/lib.rs',
  line: 1,
  repo: 'repo:Travis-Gilbert/theorem',
  revision: '63802c5ff89a57c27745735e3df0d6811dd6438d',
  firstSeenRevision: '63802c5ff89a57c27745735e3df0d6811dd6438d',
};

describe('symbol row schema', () => {
  it('accepts the fields D0-b does serve', () => {
    expect(symbolRowSchema.parse(VALID_SYMBOL)).toEqual(VALID_SYMBOL);
  });

  it.each(WITHHELD_SYMBOL_KEYS)('rejects a row carrying %s', (key) => {
    expect(() => symbolRowSchema.parse({ ...VALID_SYMBOL, [key]: 'leaked' })).toThrow();
  });

  it('rejects any unknown key, so a new leak is a parse failure too', () => {
    expect(() => symbolRowSchema.parse({ ...VALID_SYMBOL, sourceText: 'leaked' })).toThrow();
  });

  it('rejects a row missing a field the field needs', () => {
    const { name: _name, ...withoutName } = VALID_SYMBOL;
    expect(() => symbolRowSchema.parse(withoutName)).toThrow();
  });
});

describe('the committed side table', () => {
  const { sideTable } = loadFieldSnapshot();

  it('parses under the strict schema', () => {
    expect(() => parseFieldSideTable(JSON.parse(JSON.stringify(sideTable)))).not.toThrow();
  });

  it('carries no withheld key on any row', () => {
    // Belt and braces against the schema being loosened: assert on the data as
    // well as on the parser, since the parser is the thing under test elsewhere.
    for (const row of sideTable.symbols) {
      for (const key of WITHHELD_SYMBOL_KEYS) {
        expect(row).not.toHaveProperty(key);
      }
    }
  });

  it('marks the repo D0-b withholds bodies for', () => {
    const withheld = sideTable.repos.filter((repo) => repo.bodyWithheld);
    expect(withheld.map((repo) => repo.name)).toEqual(['Theorem']);
    // A private repo must withhold. A public one may, but Theorem is the only
    // private entry and the allowlist test holds that end of it.
    for (const repo of sideTable.repos) {
      if (repo.private) expect(repo.bodyWithheld).toBe(true);
    }
  });
});
