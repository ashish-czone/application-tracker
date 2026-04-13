import path from 'path';
import fs from 'fs';

function collectPackages(dir: string, aliases: Record<string, string>, depth = 0): void {
  if (depth > 4 || !fs.existsSync(dir)) return;
  const pkgJsonPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkgJson.name?.startsWith('@packages/')) {
        aliases[pkgJson.name] = dir;
      }
    } catch {
      // ignore malformed package.json
    }
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === 'src' || entry.name === 'dist') continue;
    collectPackages(path.join(dir, entry.name), aliases, depth + 1);
  }
}

/**
 * Dynamically builds Vite/Vitest alias entries for all @packages/* by recursively
 * scanning the tier directories (core/, platform/, addons/) for package.json files.
 * Nested packages are supported (e.g. packages/platform/<feature>/{backend,ui}/).
 */
export function buildPackageAliases(packagesDir: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const tier of ['core', 'platform', 'addons']) {
    collectPackages(path.join(packagesDir, tier), aliases);
  }
  return aliases;
}

function collectDomainPackages(dir: string, aliases: Record<string, string>, depth = 0): void {
  if (depth > 4 || !fs.existsSync(dir)) return;
  const pkgJsonPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkgJson.name?.startsWith('@domains/')) {
        aliases[pkgJson.name] = dir;
      }
    } catch {
      // ignore malformed package.json
    }
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === 'src' || entry.name === 'dist') continue;
    collectDomainPackages(path.join(dir, entry.name), aliases, depth + 1);
  }
}

/**
 * Builds Vite/Vitest alias entries for all @domains/* packages by recursively
 * scanning the domains/ directory. Supports nested packages
 * (e.g. domains/<vertical>/{backend,web}/).
 */
export function buildDomainAliases(domainsDir: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  collectDomainPackages(domainsDir, aliases);
  return aliases;
}
