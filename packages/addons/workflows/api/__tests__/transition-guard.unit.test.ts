import { describe, it, expect, vi } from 'vitest';
import {
  runTransitionGuards,
  previewTransitionGuards,
  type TransitionGuard,
  type GuardCtx,
} from '../transition-guard';

interface TestEntity {
  id: string;
  status: string;
}

interface TestDeps {
  countRelated: () => Promise<number>;
}

function ctx(overrides: Partial<GuardCtx<TestDeps>> = {}): GuardCtx<TestDeps> {
  return {
    fromState: 'draft',
    toState: 'submitted',
    actor: 'actor-1',
    deps: { countRelated: async () => 0 },
    ...overrides,
  };
}

describe('runTransitionGuards', () => {
  it('returns empty warnings when no guards match the from/to pair', async () => {
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'submitted', to: 'approved', check: async () => 'should not run' },
    ];
    const warnings = await runTransitionGuards(guards, { id: 'e1', status: 'draft' }, ctx());
    expect(warnings).toEqual([]);
  });

  it('runs every matching guard in declaration order', async () => {
    const order: string[] = [];
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'draft', to: 'submitted', check: async () => { order.push('g1'); } },
      { name: 'g2', from: 'draft', to: 'approved', check: async () => { order.push('g2'); } },
      { name: 'g3', from: 'draft', to: 'submitted', check: async () => { order.push('g3'); } },
    ];
    await runTransitionGuards(guards, { id: 'e1', status: 'draft' }, ctx());
    expect(order).toEqual(['g1', 'g3']);
  });

  it('collects string returns as warnings without short-circuiting', async () => {
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'draft', to: 'submitted', check: async () => 'first warning' },
      { name: 'g2', from: 'draft', to: 'submitted', check: async () => undefined },
      { name: 'g3', from: 'draft', to: 'submitted', check: async () => 'second warning' },
    ];
    const warnings = await runTransitionGuards(guards, { id: 'e1', status: 'draft' }, ctx());
    expect(warnings).toEqual(['first warning', 'second warning']);
  });

  it('propagates thrown errors from blocking guards', async () => {
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'draft', to: 'submitted', check: async () => { throw new Error('blocked'); } },
    ];
    await expect(
      runTransitionGuards(guards, { id: 'e1', status: 'draft' }, ctx()),
    ).rejects.toThrow('blocked');
  });

  it('passes the entity, deps, actor, and metadata through', async () => {
    const check = vi.fn(async () => undefined);
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'draft', to: 'submitted', check },
    ];
    const entity = { id: 'e1', status: 'draft' };
    const guardCtx = ctx({ metadata: { reason: 'review' } });
    await runTransitionGuards(guards, entity, guardCtx);
    expect(check).toHaveBeenCalledWith(entity, guardCtx);
  });

  it('stops invoking once any guard throws', async () => {
    const second = vi.fn();
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'draft', to: 'submitted', check: async () => { throw new Error('halt'); } },
      { name: 'g2', from: 'draft', to: 'submitted', check: second },
    ];
    await expect(
      runTransitionGuards(guards, { id: 'e1', status: 'draft' }, ctx()),
    ).rejects.toThrow('halt');
    expect(second).not.toHaveBeenCalled();
  });
});

describe('previewTransitionGuards', () => {
  it('collects warnings and blockers without short-circuiting', async () => {
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'draft', to: 'submitted', check: async () => { throw new Error('first blocker'); } },
      { name: 'g2', from: 'draft', to: 'submitted', check: async () => 'a warning' },
      { name: 'g3', from: 'draft', to: 'submitted', check: async () => { throw new Error('second blocker'); } },
      { name: 'g4', from: 'draft', to: 'submitted', check: async () => undefined },
    ];
    const result = await previewTransitionGuards(guards, { id: 'e1', status: 'draft' }, ctx());
    expect(result.blockers).toEqual(['first blocker', 'second blocker']);
    expect(result.warnings).toEqual(['a warning']);
  });

  it('coerces non-Error throws into string blockers', async () => {
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'draft', to: 'submitted', check: async () => { throw 'plain string'; } },
    ];
    const result = await previewTransitionGuards(guards, { id: 'e1', status: 'draft' }, ctx());
    expect(result.blockers).toEqual(['plain string']);
  });

  it('returns empty arrays when no guards match', async () => {
    const guards: TransitionGuard<TestEntity, TestDeps>[] = [
      { name: 'g1', from: 'submitted', to: 'approved', check: async () => 'never' },
    ];
    const result = await previewTransitionGuards(guards, { id: 'e1', status: 'draft' }, ctx());
    expect(result).toEqual({ warnings: [], blockers: [] });
  });
});
