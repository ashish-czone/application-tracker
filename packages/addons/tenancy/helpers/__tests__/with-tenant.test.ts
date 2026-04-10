import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { runWithCorrelationId, setTenantId } from '@packages/logger';
import { withTenant, withTenantInsert, tenantCondition } from '../with-tenant';

// Table WITH tenantId column
const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  tenantId: text('tenant_id').notNull(),
});

// Table WITHOUT tenantId column
const systemConfig = pgTable('system_config', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
});

function runInTenantContext<T>(tenantId: string, fn: () => T): T {
  return runWithCorrelationId('test-correlation', () => {
    setTenantId(tenantId);
    return fn();
  });
}

describe('withTenant', () => {
  it('should add tenant filter when tenancy is active and table has tenantId', () => {
    runInTenantContext('tenant-abc', () => {
      const condition = withTenant(orders);
      expect(condition).toBeDefined();
    });
  });

  it('should return undefined when no conditions and no tenant context', () => {
    // Outside any request context
    const condition = withTenant(orders);
    expect(condition).toBeUndefined();
  });

  it('should pass through conditions when no tenant context', () => {
    const condition = withTenant(orders, sql`status = 'active'`);
    expect(condition).toBeDefined();
  });

  it('should pass through when table has no tenantId column', () => {
    runInTenantContext('tenant-abc', () => {
      const condition = withTenant(systemConfig, sql`key = 'foo'`);
      expect(condition).toBeDefined();
    });
  });

  it('should return undefined for table without tenantId and no conditions outside context', () => {
    const condition = withTenant(systemConfig);
    expect(condition).toBeUndefined();
  });

  it('should AND tenant filter with user conditions', () => {
    runInTenantContext('tenant-abc', () => {
      const condition = withTenant(orders, sql`status = 'active'`);
      expect(condition).toBeDefined();
    });
  });

  it('should filter out undefined conditions', () => {
    runInTenantContext('tenant-abc', () => {
      const condition = withTenant(orders, undefined, sql`status = 'active'`, undefined);
      expect(condition).toBeDefined();
    });
  });
});

describe('withTenantInsert', () => {
  it('should inject tenantId into single object when tenancy is active', () => {
    runInTenantContext('tenant-abc', () => {
      const result = withTenantInsert(orders, { id: '1', status: 'new' });
      expect(result).toEqual({ id: '1', status: 'new', tenantId: 'tenant-abc' });
    });
  });

  it('should inject tenantId into array of objects when tenancy is active', () => {
    runInTenantContext('tenant-abc', () => {
      const result = withTenantInsert(orders, [
        { id: '1', status: 'new' },
        { id: '2', status: 'pending' },
      ]);
      expect(result).toEqual([
        { id: '1', status: 'new', tenantId: 'tenant-abc' },
        { id: '2', status: 'pending', tenantId: 'tenant-abc' },
      ]);
    });
  });

  it('should return data unchanged when no tenant context', () => {
    const data = { id: '1', status: 'new' };
    const result = withTenantInsert(orders, data);
    expect(result).toEqual(data);
  });

  it('should return data unchanged when table has no tenantId column', () => {
    runInTenantContext('tenant-abc', () => {
      const data = { id: '1', key: 'test' };
      const result = withTenantInsert(systemConfig, data);
      expect(result).toEqual(data);
    });
  });
});

describe('tenantCondition', () => {
  it('should return a SQL condition when tenancy is active', () => {
    runInTenantContext('tenant-abc', () => {
      const condition = tenantCondition();
      expect(condition).toBeDefined();
    });
  });

  it('should return a SQL condition (TRUE) when no tenant context', () => {
    const condition = tenantCondition();
    expect(condition).toBeDefined();
  });
});
