/**
 * gen-entity orchestration.
 *
 * Loads an entity's config, derives the generator context from it, and
 * writes the file plan with mode-aware overwrite rules.
 */

import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import {
  dtoGeneratedTemplate,
  dtoTemplate,
  serviceTemplate,
  controllerTemplate,
  moduleTemplate,
  permissionsTemplate,
  indexTemplate,
} from './templates';

export interface TagFieldInfo {
  key: string;
  tagGroupSlug?: string;
}

export interface GeneratorContext {
  entitySlug: string;        // e.g. 'candidates'
  domain: string;            // e.g. 'recruit'
  targetDir: string;         // absolute path to domains/<domain>/api/<entity>/
  singularPascal: string;    // 'Candidate' (from config.singularName) — used for schemas + DTOs
  pluralPascal: string;      // 'Candidates' (from config.pluralName) — used for Service/Controller/Module
  tableIdent: string;        // 'candidates' (Drizzle table import name; matches slug)
  configIdent: string;       // 'candidatesConfig' (the export name)
  tagFields: TagFieldInfo[]; // fields with fieldType === 'tags'
}

interface FilePlanEntry {
  filename: string;
  template: (ctx: GeneratorContext) => string;
  /** 'regenerable' = always rewrite. 'scaffold' = only on --init, never on re-run. */
  mode: 'regenerable' | 'scaffold';
}

const FILE_PLAN: FilePlanEntry[] = [
  { filename: '${slug}.dto.generated.ts', template: dtoGeneratedTemplate, mode: 'regenerable' },
  { filename: '${slug}.module.ts',        template: moduleTemplate,       mode: 'regenerable' },
  { filename: 'index.ts',                 template: indexTemplate,        mode: 'regenerable' },
  { filename: '${slug}.dto.ts',           template: dtoTemplate,          mode: 'scaffold' },
  { filename: '${slug}.service.ts',       template: serviceTemplate,      mode: 'scaffold' },
  { filename: '${slug}.controller.ts',    template: controllerTemplate,   mode: 'scaffold' },
  { filename: 'permissions.ts',           template: permissionsTemplate,  mode: 'scaffold' },
];

export interface RunOptions {
  entitySlug: string;
  domain: string;
  init: boolean;
  repoRoot: string;
}

export async function run(opts: RunOptions): Promise<void> {
  const { entitySlug, domain, init, repoRoot } = opts;
  const targetDir = resolve(repoRoot, 'domains', domain, 'api', entitySlug);

  if (!existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${relative(repoRoot, targetDir)}`);
  }

  const configPath = join(targetDir, `${entitySlug}.config.ts`);
  if (!existsSync(configPath)) {
    throw new Error(`Entity config not found: ${relative(repoRoot, configPath)}`);
  }

  const ctx = await buildContext({ entitySlug, domain, targetDir, configPath });

  // Pre-flight: --init requires no scaffold-mode files to exist.
  if (init) {
    const conflicts = FILE_PLAN
      .map((f) => f.filename.replace('${slug}', entitySlug))
      .filter((f) => existsSync(join(targetDir, f)));
    if (conflicts.length > 0) {
      throw new Error(
        `--init refused: target dir already contains generator outputs.\n` +
        `Conflicts: ${conflicts.join(', ')}\n` +
        `Either re-run without --init (rewrites only regenerable files) or delete these files explicitly.`,
      );
    }
  }

  for (const entry of FILE_PLAN) {
    const filename = entry.filename.replace('${slug}', entitySlug);
    const filepath = join(targetDir, filename);
    const exists = existsSync(filepath);

    if (entry.mode === 'scaffold' && exists && !init) {
      log(`skip   ${relative(repoRoot, filepath)} (scaffold-only, exists)`);
      continue;
    }
    if (entry.mode === 'scaffold' && !exists && !init) {
      log(`miss   ${relative(repoRoot, filepath)} (scaffold-only, but missing — run --init or write by hand)`);
      continue;
    }

    const next = entry.template(ctx);
    if (exists && readFileSync(filepath, 'utf8') === next) {
      log(`equal  ${relative(repoRoot, filepath)}`);
      continue;
    }
    writeFileSync(filepath, next, 'utf8');
    log(`${exists ? 'rewrote' : 'wrote  '} ${relative(repoRoot, filepath)}`);
  }
}

async function buildContext(args: {
  entitySlug: string;
  domain: string;
  targetDir: string;
  configPath: string;
}): Promise<GeneratorContext> {
  const { entitySlug, domain, targetDir, configPath } = args;

  // Dynamic import. tsx handles TS resolution at runtime.
  const mod = await import(configPath);
  const configEntry = Object.entries(mod).find(
    ([k]) => /Config$|_CONFIG$/.test(k),
  );
  if (!configEntry) {
    throw new Error(`No *Config / *_CONFIG export found in ${configPath}`);
  }
  const [configIdent, config] = configEntry as [string, any];

  const singularPascal = (config.singularName as string).replace(/\s/g, '');
  const pluralPascal = (config.pluralName as string).replace(/\s/g, '');

  const fieldMeta = (config.fieldMeta ?? {}) as Record<string, any>;
  const tagFields: TagFieldInfo[] = Object.entries(fieldMeta)
    .filter(([, m]) => (m as any).fieldType === 'tags')
    .map(([key, m]) => ({ key, tagGroupSlug: (m as any).tagGroupSlug }));

  return {
    entitySlug,
    domain,
    targetDir,
    singularPascal,
    pluralPascal,
    tableIdent: entitySlug,    // convention: drizzle table identifier matches slug
    configIdent,
    tagFields,
  };
}

function log(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}
