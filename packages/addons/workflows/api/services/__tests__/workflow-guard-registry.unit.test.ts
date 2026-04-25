import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowGuardRegistry } from '../workflow-guard-registry.service';
import { allow, allowWithWarning, block } from '../../types';
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

  describe('register / get / has', () => {
    it('stores a guard function by name', () => {
      const guard = async () => allow();
      registry.register('test-guard', guard);
      expect(registry.get('test-guard')).toBe(guard);
      expect(registry.has('test-guard')).toBe(true);
    });

    it('returns undefined / false for unregistered guards', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('runGuards', () => {
    it('returns empty warnings and blockers when all guards allow', async () => {
      registry.register('guard-a', async () => allow());
      registry.register('guard-b', async () => allow());

      const result = await registry.runGuards(['guard-a', 'guard-b'], mockContext);
      expect(result.warnings).toEqual([]);
      expect(result.blockers).toEqual([]);
    });

    it('collects warning messages from allow_with_warning guards', async () => {
      registry.register('guard-a', async () => allowWithWarning('first'));
      registry.register('guard-b', async () => allow());
      registry.register('guard-c', async () => allowWithWarning('second'));

      const result = await registry.runGuards(['guard-a', 'guard-b', 'guard-c'], mockContext);
      expect(result.warnings).toEqual(['first', 'second']);
      expect(result.blockers).toEqual([]);
    });

    it('collects blockers from every guard rather than short-circuiting', async () => {
      registry.register('guard-a', async () => block('reason a'));
      registry.register('guard-b', async () => allow());
      registry.register('guard-c', async () => block('reason c'));

      const result = await registry.runGuards(['guard-a', 'guard-b', 'guard-c'], mockContext);
      expect(result.blockers).toEqual([
        { guardName: 'guard-a', message: 'reason a' },
        { guardName: 'guard-c', message: 'reason c' },
      ]);
    });

    it('throws when a guard name is not registered', async () => {
      await expect(
        registry.runGuards(['nonexistent'], mockContext),
      ).rejects.toThrow("Workflow guard 'nonexistent' is not registered");
    });

    it('returns empty result for empty names array', async () => {
      const result = await registry.runGuards([], mockContext);
      expect(result).toEqual({ warnings: [], blockers: [] });
    });

    it('passes the context to guard functions', async () => {
      let receivedContext: WorkflowGuardContext | null = null;
      registry.register('context-guard', async (ctx) => {
        receivedContext = ctx;
        return allow();
      });

      await registry.runGuards(['context-guard'], mockContext);
      expect(receivedContext).toEqual(mockContext);
    });
  });
});
