const fs = require('fs');
const path = require('path');
const { globSync } = require('fs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCHEMA_DIR = path.resolve(__dirname, '..', 'prisma', 'schema');

function findSchemaFiles() {
  const patterns = [
    path.join(ROOT, 'apps', 'api', 'src', 'modules', '**', 'schema.prisma'),
    path.join(ROOT, 'packages', '**', 'schema.prisma'),
  ];

  const files = [];

  for (const pattern of patterns) {
    const base = pattern.split('**')[0];
    collectFiles(base, files);
  }

  // Exclude the base.prisma and any already-collected schemas
  return files.filter(
    (f) =>
      !f.startsWith(SCHEMA_DIR) &&
      !f.includes('node_modules'),
  );
}

function collectFiles(dir, results) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      collectFiles(fullPath, results);
    } else if (entry.name === 'schema.prisma') {
      results.push(fullPath);
    }
  }
}

function main() {
  // Clean existing collected schemas (but not base.prisma)
  if (fs.existsSync(SCHEMA_DIR)) {
    const existing = fs.readdirSync(SCHEMA_DIR);
    for (const file of existing) {
      const filePath = path.join(SCHEMA_DIR, file);
      if (file !== 'base.prisma' && !fs.statSync(filePath).isDirectory()) {
        fs.unlinkSync(filePath);
      }
    }
  }

  const schemas = findSchemaFiles();

  for (const schemaPath of schemas) {
    // Derive a unique name from the path
    const relative = path.relative(ROOT, schemaPath);
    const name = relative
      .replace(/[/\\]/g, '_')
      .replace('_schema.prisma', '.prisma');

    const dest = path.join(SCHEMA_DIR, name);
    fs.copyFileSync(schemaPath, dest);
    console.log(`Collected: ${relative} → prisma/schema/${name}`);
  }

  console.log(`\nCollected ${schemas.length} schema file(s).`);
}

main();
