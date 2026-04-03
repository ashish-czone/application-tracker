import { describe, it, expect, vi } from 'vitest';
import { EntityCleanupRegistry } from '../entity-cleanup-registry';

describe('EntityCleanupRegistry', () => {
  it('registers and runs a handler', async () => {
    const registry = new EntityCleanupRegistry();
    const handler = vi.fn();
    registry.register('notes', handler);

    const tx = {};
    await registry.runAll('candidates', 'entity-1', 'actor-1', tx);

    expect(handler).toHaveBeenCalledWith('candidates', 'entity-1', 'actor-1', tx);
  });

  it('runs multiple handlers in order', async () => {
    const registry = new EntityCleanupRegistry();
    const order: string[] = [];

    registry.register('notes', async () => { order.push('notes'); });
    registry.register('attachments', async () => { order.push('attachments'); });

    await registry.runAll('candidates', 'entity-1', 'actor-1', {});

    expect(order).toEqual(['notes', 'attachments']);
  });

  it('has() returns correct state', () => {
    const registry = new EntityCleanupRegistry();
    expect(registry.has('notes')).toBe(false);

    registry.register('notes', vi.fn());
    expect(registry.has('notes')).toBe(true);
  });

  it('size reflects number of handlers', () => {
    const registry = new EntityCleanupRegistry();
    expect(registry.size).toBe(0);

    registry.register('notes', vi.fn());
    expect(registry.size).toBe(1);

    registry.register('attachments', vi.fn());
    expect(registry.size).toBe(2);
  });

  it('allows overwriting a handler', () => {
    const registry = new EntityCleanupRegistry();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    registry.register('notes', handler1);
    registry.register('notes', handler2);

    expect(registry.size).toBe(1);
  });

  it('propagates handler errors', async () => {
    const registry = new EntityCleanupRegistry();
    registry.register('notes', async () => { throw new Error('cleanup failed'); });

    await expect(registry.runAll('candidates', 'entity-1', 'actor-1', {}))
      .rejects.toThrow('cleanup failed');
  });

  it('does nothing when no handlers registered', async () => {
    const registry = new EntityCleanupRegistry();
    await expect(registry.runAll('candidates', 'entity-1', 'actor-1', {})).resolves.toBeUndefined();
  });
});
