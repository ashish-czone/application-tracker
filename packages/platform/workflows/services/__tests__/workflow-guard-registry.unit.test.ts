import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowGuardRegistry } from '../workflow-guard-registry.service';
import type { WorkflowGuardContext } from '../../types';

const mockContextLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockAppLogger = {
  forContext: vi.fn().mockReturnValue(mockContextLogger),
} as any;

describe('WorkflowGuardRegistry', () => {
  let registry: WorkflowGuardRegistry;

  const mockContext: WorkflowGuardContext = {
    workflowSlug: 'test-workflow',
    entityType: 'task',
    entityId: 'entity-1',
    fieldName: 'status',
    fromState: 'draft',
    toState: 'submitted',
    actorId: 'user-1',
  };

  beforeEach(() => {
    registry = new WorkflowGuardRegistry(mockAppLogger);
  });

  describe('register', () => {
    it('should store a guard function by name', () => {
      const guard = async () => true;
      registry.register('test-guard', guard);
      expect(registry.get('test-guard')).toBe(guard);
    });
  });

  describe('get', () => {
    it('should return undefined for unregistered guard', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered guard', () => {
      registry.register('test-guard', async () => true);
      expect(registry.has('test-guard')).toBe(true);
    });

    it('should return false for unregistered guard', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('executeGuards', () => {
    it('should pass when all guards return true', async () => {
      registry.register('guard-a', async () => true);
      registry.register('guard-b', async () => true);

      const result = await registry.executeGuards(['guard-a', 'guard-b'], mockContext);
      expect(result).toEqual({ passed: true });
    });

    it('should fail on first failing guard and return its name', async () => {
      registry.register('guard-a', async () => true);
      registry.register('guard-b', async () => false);
      registry.register('guard-c', async () => true);

      const result = await registry.executeGuards(['guard-a', 'guard-b', 'guard-c'], mockContext);
      expect(result).toEqual({ passed: false, failedGuard: 'guard-b' });
    });

    it('should throw when a guard name is not registered', async () => {
      await expect(
        registry.executeGuards(['nonexistent'], mockContext),
      ).rejects.toThrow("Workflow guard 'nonexistent' is not registered");
    });

    it('should pass with empty guard names array', async () => {
      const result = await registry.executeGuards([], mockContext);
      expect(result).toEqual({ passed: true });
    });

    it('should pass the context to guard functions', async () => {
      let receivedContext: WorkflowGuardContext | null = null;
      registry.register('context-guard', async (ctx) => {
        receivedContext = ctx;
        return true;
      });

      await registry.executeGuards(['context-guard'], mockContext);
      expect(receivedContext).toEqual(mockContext);
    });
  });
});
