import { describe, it, expect, vi } from 'vitest';
import { ActionRegistry } from '../action-registry';
import type { ActionHandler, ActionContext, ActionResult } from '../../types';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

function createFakeHandler(type: string, label = 'Test'): ActionHandler {
  return {
    type,
    label,
    userSlots: [{ name: 'recipient', label: 'Send To', required: true }],
    configSchema: { templateId: { type: 'string', required: true } },
    execute: vi.fn().mockResolvedValue({}),
  };
}

describe('ActionRegistry', () => {
  it('should register and retrieve a handler', () => {
    const registry = new ActionRegistry(createMockAppLogger());
    const handler = createFakeHandler('send_notification', 'Send Notification');
    registry.register(handler);

    expect(registry.get('send_notification')).toBe(handler);
    expect(registry.has('send_notification')).toBe(true);
  });

  it('should return undefined for unregistered type', () => {
    const registry = new ActionRegistry(createMockAppLogger());

    expect(registry.get('unknown')).toBeUndefined();
    expect(registry.has('unknown')).toBe(false);
  });

  it('should list all registered handlers', () => {
    const registry = new ActionRegistry(createMockAppLogger());
    registry.register(createFakeHandler('send_notification', 'Send Notification'));
    registry.register(createFakeHandler('create_task', 'Create Task'));

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((h) => h.type)).toContain('send_notification');
    expect(all.map((h) => h.type)).toContain('create_task');
  });

  it('should overwrite handler when registering same type twice', () => {
    const registry = new ActionRegistry(createMockAppLogger());
    const first = createFakeHandler('send_notification', 'First');
    const second = createFakeHandler('send_notification', 'Second');

    registry.register(first);
    registry.register(second);

    expect(registry.get('send_notification')).toBe(second);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('should return metadata for all handlers', () => {
    const registry = new ActionRegistry(createMockAppLogger());
    registry.register(createFakeHandler('send_notification', 'Send Notification'));
    registry.register(createFakeHandler('create_task', 'Create Task'));

    const metadata = registry.getAllMetadata();

    expect(metadata).toHaveLength(2);
    expect(metadata[0]).toEqual({
      type: 'send_notification',
      label: 'Send Notification',
      userSlots: [{ name: 'recipient', label: 'Send To', required: true }],
      configSchema: { templateId: { type: 'string', required: true } },
    });
  });

  it('should return empty array when no handlers registered', () => {
    const registry = new ActionRegistry(createMockAppLogger());

    expect(registry.getAll()).toEqual([]);
    expect(registry.getAllMetadata()).toEqual([]);
  });
});
