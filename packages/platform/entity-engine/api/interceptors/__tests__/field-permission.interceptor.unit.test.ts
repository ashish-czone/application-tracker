import { describe, it, expect } from 'vitest';
import { of, lastValueFrom } from 'rxjs';
import { createFieldPermissionInterceptor } from '../field-permission.interceptor';
import type { EntityConfig } from '../../types';
import type { CallHandler, ExecutionContext } from '@nestjs/common';

function createMockContext(
  userPermissions: Record<string, string>,
  body?: Record<string, unknown>,
): ExecutionContext {
  const request = { user: { userId: 'u1', permissions: userPermissions }, body };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getClass: () => ({}),
    getHandler: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function createMockHandler(response: any): CallHandler {
  return { handle: () => of(response) };
}

// Minimal EntityConfig for testing
const mockConfig = {
  slug: 'candidates',
  fieldMeta: {
    firstName: { label: 'First Name', section: 'basic', sortOrder: 0 },
    lastName: { label: 'Last Name', section: 'basic', sortOrder: 1 },
    salary: { label: 'Salary', section: 'details', sortOrder: 0 },
    internalNotes: { label: 'Internal Notes', section: 'details', sortOrder: 1 },
    stage: { label: 'Stage', section: 'basic', sortOrder: 2, isSystem: true },
  },
} as unknown as EntityConfig;

describe('FieldPermissionInterceptor (restriction-based)', () => {
  describe('hidden fields', () => {
    it('should strip hidden fields from response', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      const context = createMockContext({
        'candidates.read': 'all',
        'candidates.hide-salary': 'all',
        'candidates.hide-internalNotes': 'all',
      });
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual({ id: '1', firstName: 'Jane' });
    });

    it('should strip hidden fields from writes', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      const body = { firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' };
      const context = createMockContext({
        'candidates.hide-salary': 'all',
        'candidates.hide-internalNotes': 'all',
      }, body);
      const handler = createMockHandler({ id: '1' });

      await lastValueFrom(interceptor.intercept(context, handler));

      expect(body).toEqual({ firstName: 'Jane' });
    });

    it('should strip lookup labels for hidden fields', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      const context = createMockContext({ 'candidates.hide-salary': 'all' });
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000, salary__label: '$80k' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).not.toHaveProperty('salary');
      expect(result).not.toHaveProperty('salary__label');
    });

    it('should handle paginated list responses', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      const context = createMockContext({ 'candidates.hide-salary': 'all' });
      const handler = createMockHandler({
        data: [
          { id: '1', firstName: 'Jane', salary: 80000 },
          { id: '2', firstName: 'John', salary: 90000 },
        ],
        meta: { total: 2, page: 1, limit: 25, totalPages: 1 },
      });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result.data).toEqual([
        { id: '1', firstName: 'Jane' },
        { id: '2', firstName: 'John' },
      ]);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 25, totalPages: 1 });
    });
  });

  describe('readonly fields', () => {
    it('should strip readonly fields from writes but keep in reads', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      // Test write stripping
      const body = { firstName: 'Jane', salary: 80000 };
      const context = createMockContext({ 'candidates.readonly-salary': 'all' }, body);
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000 });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      // Body should have salary stripped (readonly = can't write)
      expect(body).toEqual({ firstName: 'Jane' });
      // Response should still have salary (readonly = can read)
      expect(result).toEqual({ id: '1', firstName: 'Jane', salary: 80000 });
    });
  });

  describe('system fields cannot be restricted', () => {
    it('should not strip system fields even with hide permission', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      const context = createMockContext({ 'candidates.hide-stage': 'all' });
      const handler = createMockHandler({ id: '1', firstName: 'Jane', stage: 'new' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      // stage is isSystem=true, so it can't be hidden
      expect(result).toEqual({ id: '1', firstName: 'Jane', stage: 'new' });
    });
  });

  describe('no restrictions', () => {
    it('should pass through when user has no restriction permissions', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      const body = { firstName: 'Jane', salary: 80000 };
      const context = createMockContext({ 'candidates.read': 'all' }, body);
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000 });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual({ id: '1', firstName: 'Jane', salary: 80000 });
      expect(body).toEqual({ firstName: 'Jane', salary: 80000 });
    });

    it('should pass through null responses', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      const context = createMockContext({ 'candidates.hide-salary': 'all' });
      const handler = createMockHandler(null);

      const result = await lastValueFrom(interceptor.intercept(context, handler));
      expect(result).toBeNull();
    });
  });

  describe('superadmin bypass', () => {
    it('should allow all fields for superadmin', async () => {
      const Interceptor = createFieldPermissionInterceptor(mockConfig);
      const interceptor = new Interceptor();

      const context = createMockContext({ '*': 'all' });
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Secret' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Secret' });
    });
  });

  // --- Extension entities: parent's hide/readonly perms cover projected cols ---

  describe('extension entity (parent permissions for projected columns)', () => {
    // Child entity that extends the 'tasks' parent. Its own restrictable
    // fields don't include 'title' or 'priority' — those are projected.
    const childConfig = {
      slug: 'compliance-tasks',
      entityType: 'compliance_tasks',
      fieldMeta: {
        ruleId: { label: 'Rule', section: 'basic', sortOrder: 0 },
      },
    } as unknown as EntityConfig;

    const parentConfig = {
      slug: 'tasks',
      entityType: 'tasks',
      fieldMeta: {
        title: { label: 'Title', section: 'basic', sortOrder: 0 },
        priority: { label: 'Priority', section: 'basic', sortOrder: 1 },
        kind: { label: 'Kind', section: 'basic', sortOrder: 2, isSystem: true },
      },
    } as unknown as EntityConfig;

    function createMockRegistry(resolved: any) {
      return {
        getResolvedExtension: (entityType: string) =>
          entityType === childConfig.entityType ? resolved : undefined,
        get: (entityType: string) =>
          entityType === parentConfig.entityType ? parentConfig : undefined,
      } as any;
    }

    const resolvedExtension = {
      parentEntityType: 'tasks',
      parentTable: {} as any,
      foreignKeyColumn: {} as any,
      parentIdColumn: {} as any,
      projectedColumns: [
        { fieldKey: 'title', column: {} as any },
        { fieldKey: 'priority', column: {} as any },
        { fieldKey: 'kind', column: {} as any }, // system on parent — should not be hideable
      ],
      parentDefaults: {},
    };

    it('strips projected parent column when parent has hide-{key} permission', async () => {
      const Interceptor = createFieldPermissionInterceptor(childConfig);
      const interceptor = new Interceptor(createMockRegistry(resolvedExtension));

      const context = createMockContext({ 'tasks.hide-title': 'all' });
      const handler = createMockHandler({ id: '1', ruleId: 'r1', title: 'My Task', priority: 'high' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).not.toHaveProperty('title');
      expect(result).toMatchObject({ id: '1', ruleId: 'r1', priority: 'high' });
    });

    it('strips projected parent column from writes for readonly-{key}', async () => {
      const Interceptor = createFieldPermissionInterceptor(childConfig);
      const interceptor = new Interceptor(createMockRegistry(resolvedExtension));

      const body: Record<string, unknown> = { ruleId: 'r1', title: 'Edit', priority: 'high' };
      const context = createMockContext({ 'tasks.readonly-priority': 'all' }, body);
      const handler = createMockHandler({ id: '1' });

      await lastValueFrom(interceptor.intercept(context, handler));

      expect(body).toEqual({ ruleId: 'r1', title: 'Edit' });
    });

    it('does not strip parent system fields even with hide permission', async () => {
      const Interceptor = createFieldPermissionInterceptor(childConfig);
      const interceptor = new Interceptor(createMockRegistry(resolvedExtension));

      const context = createMockContext({ 'tasks.hide-kind': 'all' });
      const handler = createMockHandler({ id: '1', kind: 'compliance', title: 'X' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual({ id: '1', kind: 'compliance', title: 'X' });
    });

    it('child hide-{key} continues to work alongside parent permissions', async () => {
      const Interceptor = createFieldPermissionInterceptor(childConfig);
      const interceptor = new Interceptor(createMockRegistry(resolvedExtension));

      const context = createMockContext({
        'compliance-tasks.hide-ruleId': 'all',
        'tasks.hide-title': 'all',
      });
      const handler = createMockHandler({ id: '1', ruleId: 'r1', title: 'X', priority: 'high' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).not.toHaveProperty('ruleId');
      expect(result).not.toHaveProperty('title');
      expect(result).toMatchObject({ id: '1', priority: 'high' });
    });

    it('falls back gracefully when registry is not injected (legacy callers)', async () => {
      const Interceptor = createFieldPermissionInterceptor(childConfig);
      const interceptor = new Interceptor(); // no registry

      const context = createMockContext({ 'tasks.hide-title': 'all' });
      const handler = createMockHandler({ id: '1', title: 'X' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      // Without the registry the parent perm doesn't apply — title stays.
      expect(result).toEqual({ id: '1', title: 'X' });
    });
  });
});
