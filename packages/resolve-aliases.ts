import path from 'path';
import fs from 'fs';

/**
 * Dynamically builds Vite/Vitest alias entries for all @packages/* by scanning
 * the tier directories (core/, platform/, addons/) and reading package.json names.
 */
export function buildPackageAliases(packagesDir: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  const scanDirs = [
    path.join(packagesDir, 'core'),
    path.join(packagesDir, 'platform'),
    path.join(packagesDir, 'platform', 'platform-ui'),
    path.join(packagesDir, 'addons'),
  ];

  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const pkgJsonPath = path.join(dir, entry.name, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkgJson.name?.startsWith('@packages/')) {
        aliases[pkgJson.name] = path.join(dir, entry.name);
      }
    }
  }

  return aliases;
}
