/**
 * D10's vendored leaf, and the two facts about it that decide how D4 mounts.
 *
 * The pin is checked here as well as by `npm run check:leaf-provenance` so a
 * plain `npm test` catches an edited copy. The other two tests are the reason
 * this file is worth more than a hash check: they assert, against the vendored
 * source, that there is no `field` leaf kind upstream and that adoption wipes
 * the host's children. Both are constraints on D4, and both are the kind of
 * thing that gets fixed upstream and silently forgotten here.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const VENDOR = path.join(ROOT, 'vendor', 'gpui');
const provenance = fs.readFileSync(path.join(VENDOR, 'PROVENANCE.toml'), 'utf-8');
const leaf = fs.readFileSync(path.join(VENDOR, 'gpui-leaf.js'), 'utf-8');

function pin(key: string): string {
  const match = new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm').exec(provenance);
  if (!match) throw new Error(`PROVENANCE.toml has no ${key}`);
  return match[1];
}

describe('vendored gpui-leaf.js', () => {
  it('matches the sha256 its pin records', () => {
    expect(createHash('sha256').update(leaf).digest('hex')).toBe(pin('sha256'));
  });

  it('pins a full commit sha', () => {
    expect(pin('commit')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('passes the drift check script', () => {
    expect(() =>
      execFileSync('node', ['scripts/check-leaf-provenance.mjs'], { cwd: ROOT }),
    ).not.toThrow();
  });

  it('has no field leaf kind, which is what blocks D4', () => {
    // `applyDocuments` and `drainLeaf` dispatch on the leaf kind. Until one of
    // them knows `field`, `module.startLeaf('field')` has nothing to start, and
    // the mount D10 describes cannot be written against this copy. When this
    // test fails, the upstream change landed and the page can mount.
    expect(leaf).toMatch(/leaf === "record-form"/);
    expect(leaf).not.toMatch(/leaf === "field"/);
  });

  it('replaces the host children on adoption, so the projection must be re-appended', () => {
    // D9's static projection lives inside the host. This call removes it. The
    // mount that lands with D4 has to put it back underneath the canvas, or the
    // page loses its crawlable content the moment a GPU shows up.
    expect(leaf).toMatch(/host\.replaceChildren\(canvas\)/);
  });

  it('is not served, because nothing on the site loads it yet', () => {
    // The standing nevers do not allow a module that calls nothing. Shipping the
    // leaf into `public/` before a bundle exists would do exactly that, so it
    // lives in `vendor/` until D4 gives it a caller.
    expect(fs.existsSync(path.join(ROOT, 'public', 'gpui', 'gpui-leaf.js'))).toBe(false);
    expect(provenance).toMatch(/served = false/);
  });
});

describe('the portfolio host page', () => {
  const page = fs.readFileSync(path.join(ROOT, 'src', 'app', 'portfolio', 'page.tsx'), 'utf-8');
  const nginx = fs.readFileSync(path.join(ROOT, 'nginx.conf'), 'utf-8');

  it('renders the host element the field adopts, with the static projection inside it', () => {
    expect(page).toMatch(/id=\{FIELD_HOST_ID\}/);
    expect(page).toMatch(/<SemanticProjection tree=\{tree\} \/>/);
  });

  it('is cross-origin isolated, and only it', () => {
    // COEP require-corp blocks cross-origin subresources that do not opt in, and
    // the essay pages carry youtube embeds that do not. Isolating the whole
    // server would take those down for a header only the field needs.
    const portfolioBlock = /location ~ \^\/portfolio[^{]*\{([^}]*)\}/.exec(nginx)?.[1] ?? '';
    expect(portfolioBlock).toMatch(/Cross-Origin-Opener-Policy "same-origin"/);
    expect(portfolioBlock).toMatch(/Cross-Origin-Embedder-Policy "require-corp"/);
    // Exactly one COEP header in the whole file, and it is the one just matched.
    // A second would mean the isolation escaped the route it was scoped to.
    expect(nginx.match(/add_header Cross-Origin-Embedder-Policy/g)).toHaveLength(1);
  });

  it('serves wasm as application/wasm, so streaming compile accepts it', () => {
    expect(nginx).toMatch(/location ~ \\\.wasm\$/);
    expect(nginx).toMatch(/default_type application\/wasm/);
  });

  it('ships the config and fixture the route reads at build time', () => {
    const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf-8');
    expect(dockerfile).toMatch(/COPY config \.\/config/);
    expect(dockerfile).toMatch(/COPY fixtures \.\/fixtures/);
  });
});
