import { describe, it, expect } from 'vitest';
import { of, lastValueFrom } from 'rxjs';
import { createFieldPermissionInterceptor } from '../field-permission.interceptor';
import type { FieldMeta } from '../../types';
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

describe('FieldPermissionInterceptor', () => {
  const fieldMeta: Record<string, FieldMeta> = {
    firstName: { label: 'First Name', section: 'basic', sortOrder: 0 },
    lastName: { label: 'Last Name', section: 'basic', sortOrder: 1 },
    salary: {
      label: 'Salary', section: 'details', sortOrder: 0,
      readPermission: 'candidates.read-salary',
      writePermission: 'candidates.update-salary',
    },
    internalNotes: {
      label: 'Internal Notes', section: 'details', sortOrder: 1,
      readPermission: 'candidates.read-notes',
      writePermission: 'candidates.update-notes',
    },
  };

  describe('read filtering', () => {
    it('should strip read-restricted fields when user lacks permission', async () => {
      const Interceptor = createFieldPermissionInterceptor(fieldMeta);
      const interceptor = new Interceptor();

      const context = createMockContext({ 'candidates.read': 'all' });
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual({ id: '1', firstName: 'Jane' });
      expect(result).not.toHaveProperty('salary');
      expect(result).not.toHaveProperty('internalNotes');
    });

    it('should keep read-restricted fields when user has permission', async () => {
      const Interceptor = createFieldPermissionInterceptor(fieldMeta);
      const interceptor = new Interceptor();

      const context = createMockContext({
        'candidates.read': 'all',
        'candidates.read-salary': 'all',
        'candidates.read-notes': 'all',
      });
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' });
    });

    it('should keep some restricted fields and strip others based on partial permissions', async () => {
      const Interceptor = createFieldPermissionInterceptor(fieldMeta);
      const interceptor = new Interceptor();

      const context = createMockContext({
        'candidates.read': 'all',
        'candidates.read-salary': 'all',
      });
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual({ id: '1', firstName: 'Jane', salary: 80000 });
      expect(result).not.toHaveProperty('internalNotes');
    });

    it('should handle paginated list responses', async () => {
      const Interceptor = createFieldPermissionInterceptor(fieldMeta);
      const interceptor = new Interceptor();

      const context = createMockContext({ 'candidates.read': 'all' });
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

    it('should pass through null/undefined responses', async () => {
      const Interceptor = createFieldPermissionInterceptor(fieldMeta);
      const interceptor = new Interceptor();

      const context = createMockContext({ 'candidates.read': 'all' });
      const handler = createMockHandler(null);

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toBeNull();
    });
  });

  describe('write filtering', () => {
    it('should strip write-restricted fields from body when user lacks permission', async () => {
      const Interceptor = createFieldPermissionInterceptor(fieldMeta);
      const interceptor = new Interceptor();

      const body = { firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' };
      const context = createMockContext({ 'candidates.create': 'all' }, body);
      const handler = createMockHandler({ id: '1' });

      await lastValueFrom(interceptor.intercept(context, handler));

      // Body should be mutated — restricted fields removed
      expect(body).toEqual({ firstName: 'Jane' });
    });

    it('should keep write-restricted fields when user has permission', async () => {
      const Interceptor = createFieldPermissionInterceptor(fieldMeta);
      const interceptor = new Interceptor();

      const body = { firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' };
      const context = createMockContext({
        'candidates.create': 'all',
        'candidates.update-salary': 'all',
        'candidates.update-notes': 'all',
      }, body);
      const handler = createMockHandler({ id: '1' });

      await lastValueFrom(interceptor.intercept(context, handler));

      expect(body).toEqual({ firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' });
    });
  });

  describe('no restrictions', () => {
    it('should pass through without modification when no fields have permissions', async () => {
      const noRestrictions: Record<string, FieldMeta> = {
        firstName: { label: 'First Name', section: 'basic', sortOrder: 0 },
        lastName: { label: 'Last Name', section: 'basic', sortOrder: 1 },
      };

      const Interceptor = createFieldPermissionInterceptor(noRestrictions);
      const interceptor = new Interceptor();

      const body = { firstName: 'Jane', lastName: 'Doe' };
      const context = createMockContext({ 'candidates.read': 'all' }, body);
      const response = { id: '1', firstName: 'Jane', lastName: 'Doe' };
      const handler = createMockHandler(response);

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual(response);
      expect(body).toEqual({ firstName: 'Jane', lastName: 'Doe' });
    });
  });

  describe('superadmin bypass', () => {
    it('should allow all fields for superadmin with wildcard permission', async () => {
      const Interceptor = createFieldPermissionInterceptor(fieldMeta);
      const interceptor = new Interceptor();

      const context = createMockContext({ '*': 'all' });
      const handler = createMockHandler({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' });

      const result = await lastValueFrom(interceptor.intercept(context, handler));

      expect(result).toEqual({ id: '1', firstName: 'Jane', salary: 80000, internalNotes: 'Good fit' });
    });
  });
});
