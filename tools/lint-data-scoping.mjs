#!/usr/bin/env node
/**
 * Structural lint for `.claude/rules/data-scoping.md` and
 * `.claude/rules/data-access-scope.md`.
 *
 * Walks every TypeScript service/module file under packages/, domains/, apps/
 * and flags any file that contains a raw `db.select/update/delete/execute`
 * chain without importing one of the scope primitives:
 *
 *   - `withScope` / `withScopeIncludingDeleted` (soft-delete + tenant)
 *   - `BaseCrudService` (delegation path that wires scope internally)
 *   - `buildPredicate` / `getScopePredicate` (actor-scope, explicit)
 *
 * Files listed in `tools/data-access-scope-allowlist.txt` are exempt
 * (grandfathered). New code that introduces a violation breaks the lint;
 * existing offenders are migrated opportunistically per the rule doc.
 *
 * The check is structural, not semantic: it cannot tell whether the imported
 * primitive is actually applied to the right WHERE. That stays a code-review
 * concern. What this catches is the common drift — "wrote a raw query and
 * forgot scope entirely."
 *
 * Exit code 0 = clean, 1 = violations.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const QUERY_PATTERN =
  /(?:^|[^.\w])(?:this\.)?(?:database\.db|db|database)\.(?:select|update|delete|execute)\(/m;
const SCOPE_IMPORTS_PATTERN =
  /\b(?:withScope|withScopeIncludingDeleted|BaseCrudService|buildPredicate|getScopePredicate)\b/;

// Path-prefix excludes: never scanned regardless of content.
const EXCLUDE_PREFIXES = [
  'node_modules',
  '.claude',
  'dist',
  'build',
  '.next',
];

// Per-segment excludes: any path containing one of these segments is skipped.
const EXCLUDE_SEGMENTS = new Set([
  '__tests__',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
]);

// Files to skip by basename pattern.
const EXCLUDE_FILE_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.config\.ts$/,
  /\.d\.ts$/,
];

// Path infixes that mark seed/migration/test infrastructure — exempt by design.
const EXEMPT_INFIXES = [
  '/seeds/',
  '.seeds.ts',
  '/cli/seed',
  '/cli/migrate',
  '/migrations/',
  '/drizzle/',
];

// The implementation files of the scope primitives themselves — they
// legitimately contain raw queries because they ARE the primitive.
const EXEMPT_FILES = new Set([
  'packages/core/database/scope.ts',
  'packages/core/soft-delete/query.ts',
  'packages/addons/tenancy/helpers/with-tenant.ts',
  'packages/addons/tenancy/services/tenant-registry.service.ts',
  'packages/platform/rbac/api/data-access-scope.service.ts',
]);

// Where to scan.
const SCAN_ROOTS = ['packages', 'domains', 'apps'];

function shouldSkipDir(name) {
  return EXCLUDE_SEGMENTS.has(name) || name.startsWith('.');
}

function shouldSkipFile(path) {
  if (!path.endsWith('.ts')) return true;
  for (const re of EXCLUDE_FILE_PATTERNS) if (re.test(path)) return true;
  for (const infix of EXEMPT_INFIXES) if (path.includes(infix)) return true;
  return false;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (shouldSkipDir(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (st.isFile()) {
      yield full;
    }
  }
}

function loadAllowlist() {
  const path = join(REPO_ROOT, 'tools/data-access-scope-allowlist.txt');
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return new Set();
  }
  const set = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    set.add(trimmed.split(sep).join('/'));
  }
  return set;
}

function main() {
  const allowlist = loadAllowlist();
  const violations = [];
  const allowlistedHits = [];
  const seenAllowlistPaths = new Set();

  for (const root of SCAN_ROOTS) {
    const absRoot = join(REPO_ROOT, root);
    for (const file of walk(absRoot)) {
      const rel = relative(REPO_ROOT, file).split(sep).join('/');
      if (shouldSkipFile(rel)) continue;
      if (EXEMPT_FILES.has(rel)) continue;

      let content;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }

      // Cheap pre-check: any of `select(`, `update(`, `delete(`, `execute(` ?
      if (
        !/\b(?:select|update|delete|execute)\(/.test(content)
      ) {
        continue;
      }

      if (!QUERY_PATTERN.test(content)) continue;
      if (SCOPE_IMPORTS_PATTERN.test(content)) continue;

      if (allowlist.has(rel)) {
        allowlistedHits.push(rel);
        seenAllowlistPaths.add(rel);
      } else {
        violations.push(rel);
      }
    }
  }

  if (violations.length > 0) {
    console.error('');
    console.error('Data scoping rule violations:');
    console.error(
      '  Files contain raw db.select/update/delete/execute chains without importing',
    );
    console.error(
      '  any scope primitive (withScope, BaseCrudService, buildPredicate, …).',
    );
    console.error('');
    for (const file of violations) console.error(`  ${file}`);
    console.error('');
    console.error('Fix:');
    console.error('  - Wrap the WHERE in withScope(table, …) (see .claude/rules/data-scoping.md).');
    console.error(
      '  - For scope-bearing tables, also apply DataAccessScopeService.buildPredicate(...)',
    );
    console.error('    or delegate via BaseCrudService (see .claude/rules/data-access-scope.md).');
    console.error('');
    console.error('  Or, if this file is intentionally exempt and should be grandfathered:');
    console.error(
      '  - Add it to tools/data-access-scope-allowlist.txt with a one-line justification comment',
    );
    console.error('    (only acceptable when the file pre-dates this lint).');
    console.error('');
    process.exit(1);
  }

  // Stale allowlist entries (file no longer offending or no longer present)
  // → warn so the list shrinks honestly.
  const stale = [...allowlist].filter((p) => !seenAllowlistPaths.has(p));
  if (stale.length > 0) {
    console.error('');
    console.error('Stale entries in tools/data-access-scope-allowlist.txt:');
    console.error(
      '  Listed but no longer offending — either fixed (good!) or moved (path drift).',
    );
    console.error('  Remove these lines:');
    for (const p of stale) console.error(`  ${p}`);
    console.error('');
    process.exit(1);
  }

  console.log(
    `data-scoping lint: clean (${allowlistedHits.length} grandfathered files; new code is compliant)`,
  );
}

main();
