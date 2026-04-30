import { describe, it, expect, afterEach, vi } from 'vitest';
import { eq, type SQL } from 'drizzle-orm';
import { PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';
import * as logger from '@packages/logger';
import { withScope, withScopeIncludingDeleted, tenantSqlCondition } from '../scope';

const dialect = new PgDialect();

// Test fixtures: all combinations of soft-delete × tenancy
const plainTable = pgTable('plain', {
  id: text('id').primaryKey(),
  name: text('name'),
});

const softTable = pgTable('soft', {
  id: text('id').primaryKey(),
  name: text('name'),
  ...softDeleteColumns(),
});

const tenantedTable = pgTable('tenanted', {
  id: text('id').primaryKey(),
  name: text('name'),
  tenantId: text('tenant_id').notNull(),
});

const fullTable = pgTable('full', {
  id: text('id').primaryKey(),
  name: text('name'),
  tenantId: text('tenant_id').notNull(),
  ...softDeleteColumns(),
});

function setTenant(id: string | undefined) {
  vi.spyOn(logger, 'getTenantId').mockReturnValue(id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withScope', () => {
  it('returns undefined when the table has no scope columns and no caller conditions', () => {
    setTenant(undefined);
    expect(withScope(plainTable)).toBeUndefined();
  });

  it('returns the caller condition unchanged when table is plain and tenant inactive', () => {
    setTenant(undefined);
    const cond = eq(plainTable.id, 'x');
    expect(withScope(plainTable, cond)).toBe(cond);
  });

  it('adds notDeleted when the table is soft-delete and tenant is inactive', () => {
    setTenant(undefined);
    const result = withScope(softTable);
    expect(result).toBeDefined();
    // Drizzle SQL inspection: the AND'd predicate string should contain `is null`
    expect(serialize(result!).toLowerCase()).toContain('"deleted_at"');
    expect(serialize(result!).toLowerCase()).toContain('is null');
  });

  it('adds tenant_id filter when the table is tenanted and a tenant is active', () => {
    setTenant('tenant-1');
    const result = withScope(tenantedTable);
    expect(result).toBeDefined();
    const s = serialize(result!);
    expect(s).toMatch(/tenant_id/);
  });

  it('omits tenant filter when tenant context is empty even if the table has a tenantId column', () => {
    setTenant(undefined);
    const result = withScope(tenantedTable);
    // No tenant + no soft-delete + no caller conditions = undefined
    expect(result).toBeUndefined();
  });

  it('combines tenant + soft-delete + caller conditions on a fully-scoped table', () => {
    setTenant('tenant-1');
    const result = withScope(fullTable, eq(fullTable.id, 'row-1'));
    expect(result).toBeDefined();
    const s = serialize(result!);
    expect(s).toMatch(/tenant_id/);
    expect(s.toLowerCase()).toContain('"deleted_at"');
    expect(s.toLowerCase()).toContain('is null');
    expect(s).toMatch(/"id"/);
  });

  it('drops undefined caller conditions silently', () => {
    setTenant(undefined);
    const cond = eq(plainTable.id, 'x');
    const result = withScope(plainTable, undefined, cond, undefined);
    expect(result).toBe(cond);
  });

  it('preserves order: tenant first, soft-delete second, caller conditions last', () => {
    setTenant('tenant-1');
    const result = withScope(fullTable, eq(fullTable.id, 'row-1'));
    const s = serialize(result!);
    const tenantIdx = s.indexOf('tenant_id');
    const deletedIdx = s.toLowerCase().indexOf('"deleted_at"');
    const idIdx = s.indexOf('"id"');
    expect(tenantIdx).toBeGreaterThan(-1);
    expect(deletedIdx).toBeGreaterThan(tenantIdx);
    expect(idIdx).toBeGreaterThan(deletedIdx);
  });
});

describe('withScopeIncludingDeleted', () => {
  it('omits notDeleted on a soft-delete table', () => {
    setTenant(undefined);
    const result = withScopeIncludingDeleted(softTable);
    expect(result).toBeUndefined();
  });

  it('still applies tenant scope and caller conditions', () => {
    setTenant('tenant-1');
    const result = withScopeIncludingDeleted(fullTable, eq(fullTable.id, 'row-1'));
    expect(result).toBeDefined();
    const s = serialize(result!);
    expect(s).toMatch(/tenant_id/);
    expect(s.toLowerCase()).not.toContain('is null');
    expect(s).toMatch(/"id"/);
  });
});

describe('tenantSqlCondition', () => {
  it('returns TRUE when tenant context is empty', () => {
    setTenant(undefined);
    expect(serialize(tenantSqlCondition()).toUpperCase()).toContain('TRUE');
  });

  it('returns tenant_id = $current when a tenant is active', () => {
    setTenant('tenant-7');
    const s = serialize(tenantSqlCondition());
    expect(s).toMatch(/tenant_id/);
  });
});

/**
 * Serialise a Drizzle SQL fragment to its concrete templated string + params
 * via the postgres dialect. The string contains lower-cased column references
 * and parameter placeholders; the params array contains the bound values.
 */
function serialize(s: SQL): string {
  const { sql: text, params } = dialect.sqlToQuery(s);
  return `${text} :: ${JSON.stringify(params)}`;
}
