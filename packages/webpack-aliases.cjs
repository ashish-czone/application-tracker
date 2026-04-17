const path = require('path');
const fs = require('fs');

function collectPackages(dir, prefix, aliases, depth = 0) {
  if (depth > 4 || !fs.existsSync(dir)) return;
  const pkgJsonPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkgJson.name && pkgJson.name.startsWith(prefix)) {
        aliases[pkgJson.name] = dir;
      }
    } catch {
      // ignore malformed package.json
    }
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === 'src' || entry.name === 'dist') continue;
    collectPackages(path.join(dir, entry.name), prefix, aliases, depth + 1);
  }
}

/**
 * Webpack counterpart of packages/resolve-aliases.ts. Builds explicit
 * `@packages/<name>` -> absolute path entries by scanning the three package
 * tiers, so nested paths (e.g. `packages/addons/tasks/contracts` exposed as
 * `@packages/tasks-contract`) resolve correctly. Without these, the naive
 * `'@packages': '<repo>/packages'` alias misses any package whose directory
 * layout doesn't match its package name.
 */
function buildPackageAliases(packagesDir) {
  const aliases = {};
  for (const tier of ['core', 'platform', 'addons']) {
    collectPackages(path.join(packagesDir, tier), '@packages/', aliases);
  }
  return aliases;
}

function buildDomainAliases(domainsDir) {
  const aliases = {};
  collectPackages(domainsDir, '@domains/', aliases);
  return aliases;
}

module.exports = { buildPackageAliases, buildDomainAliases };
