/**
 * Deterministic symbol extraction for the field fixture.
 *
 * This stands in for the real code ingest in `rustyred-thg-code`, which parses
 * with a proper grammar and writes `CodeSymbol` nodes. The fixture only needs
 * the fields D3's side table carries (name, kind, signature, path, line), so a
 * declaration level scan over the checked out tree is enough and keeps the
 * generator free of a parser dependency.
 *
 * What matters here is determinism, not recall. Two runs over the same checkout
 * must produce the same symbols in the same order, because D3's acceptance
 * criterion is a byte identical payload across runs. Every traversal is sorted
 * and every cap is applied after sorting.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Directories that never hold first party source. */
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'target', 'dist', 'build', 'out', '.next', 'vendor',
  'third_party', '__pycache__', '.venv', 'venv', 'site-packages', 'coverage',
  '.turbo', '.cache', 'fixtures', 'snapshots', '.pytest_cache', 'migrations',
]);

/** A file bigger than this is generated or vendored more often than it is written. */
const MAX_FILE_BYTES = 512 * 1024;

/** A line longer than this is minified or generated. */
const MAX_LINE_CHARS = 400;

/**
 * Declaration patterns per language.
 *
 * Each entry names a capture group `name`. Ordering inside a file follows line
 * number, so the emitted list is stable without a secondary sort.
 *
 * Visibility is deliberately not a filter. The real ingest writes a `CodeSymbol`
 * per declaration, not per exported declaration, and filtering on `pub` here
 * emptied out whole repos: RustyWeb is one binary crate whose every item is
 * private, and requiring `pub` gave it zero symbols and an empty section on the
 * page. Module level `const` still wants an `export` or a `pub`, because an
 * unexported local constant is noise rather than surface.
 */
const LANGUAGES = [
  {
    id: 'rust',
    extensions: ['.rs'],
    patterns: [
      { kind: 'fn', re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:const\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)/ },
      { kind: 'struct', re: /^\s*(?:pub(?:\([^)]*\))?\s+)?struct\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)/ },
      { kind: 'enum', re: /^\s*(?:pub(?:\([^)]*\))?\s+)?enum\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)/ },
      { kind: 'trait', re: /^\s*(?:pub(?:\([^)]*\))?\s+)?trait\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)/ },
      { kind: 'type', re: /^\s*(?:pub(?:\([^)]*\))?\s+)?type\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)/ },
      { kind: 'const', re: /^\s*pub(?:\([^)]*\))?\s+(?:const|static)\s+(?<name>[A-Z_][A-Z0-9_]*)/ },
    ],
  },
  {
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
    patterns: [
      { kind: 'fn', re: /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+\*?(?<name>[A-Za-z_$][A-Za-z0-9_$]*)/ },
      { kind: 'class', re: /^\s*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)/ },
      { kind: 'interface', re: /^\s*(?:export\s+)?interface\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)/ },
      { kind: 'type', re: /^\s*(?:export\s+)?type\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)/ },
      { kind: 'const', re: /^\s*export\s+(?:const|let|var)\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)/ },
    ],
  },
  {
    id: 'python',
    extensions: ['.py'],
    patterns: [
      { kind: 'fn', re: /^(?:async\s+)?def\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)/ },
      { kind: 'class', re: /^class\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)/ },
    ],
  },
];

const EXTENSION_LANGUAGE = new Map(
  LANGUAGES.flatMap((language) => language.extensions.map((ext) => [ext, language])),
);

/** Collapse whitespace so a wrapped declaration hashes like a single line one. */
function normalizeSignature(line) {
  return line.trim().replace(/\s+/g, ' ').replace(/\s*[{;]\s*$/, '');
}

function* walkFiles(root) {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        yield full;
      }
    }
  }
}

/**
 * Extract declarations from one checked out repo.
 *
 * @param {string} root absolute path to the checkout
 * @param {number} limit maximum symbols to keep, applied after a stable sort
 * @returns {Array<{name: string, kind: string, signature: string, path: string, line: number}>}
 */
export function extractRepoSymbols(root, limit) {
  const found = [];

  for (const file of walkFiles(root)) {
    const language = EXTENSION_LANGUAGE.get(path.extname(file));
    if (!language) continue;

    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES || stat.size === 0) continue;

    let text;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    // A NUL byte means this decoded as text but is not text.
    if (text.includes('\u0000')) continue;

    const relative = path.relative(root, file).split(path.sep).join('/');
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.length > MAX_LINE_CHARS) continue;
      for (const pattern of language.patterns) {
        const match = pattern.re.exec(line);
        if (!match?.groups?.name) continue;
        found.push({
          name: match.groups.name,
          kind: pattern.kind,
          signature: normalizeSignature(line),
          path: relative,
          line: i + 1,
        });
        break;
      }
    }
  }

  // One total order over the whole repo, then the cap. Sorting before capping is
  // what makes "the first N symbols" mean the same thing on every machine.
  found.sort(
    (a, b) =>
      a.path.localeCompare(b.path, 'en') ||
      a.line - b.line ||
      a.name.localeCompare(b.name, 'en'),
  );

  if (!Number.isFinite(limit) || limit <= 0 || found.length <= limit) return found;

  // An even stride keeps the sample spread across the tree instead of stopping
  // at whichever directory happens to sort first.
  const stride = found.length / limit;
  const sampled = [];
  for (let i = 0; i < limit; i += 1) {
    sampled.push(found[Math.floor(i * stride)]);
  }
  return sampled;
}
