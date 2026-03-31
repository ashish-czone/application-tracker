import { describe, it, expect, beforeEach } from 'vitest';
import { FieldTypeSaveHookRegistry } from '../field-type-save-hook.registry';
import type { FieldTypeSaveHooks, FieldTypeSaveHookContext } from '../field-type-save-hook.registry';

describe('FieldTypeSaveHookRegistry', () => {
  let registry: FieldTypeSaveHookRegistry;

  beforeEach(() => {
    registry = new FieldTypeSaveHookRegistry();
  });

  const ctx: FieldTypeSaveHookContext = {
    entityType: 'test',
    entityId: '123',
    fieldKey: 'testField',
    fieldType: 'file',
    mode: 'create',
    actorId: 'user-1',
  };

  it('registers and retrieves hooks', () => {
    const hooks: FieldTypeSaveHooks = {
      onBeforeSave: async () => ({}),
    };
    registry.register('file', hooks);
    expect(registry.get('file')).toBe(hooks);
    expect(registry.has('file')).toBe(true);
  });

  it('returns undefined for unregistered type', () => {
    expect(registry.get('unknown')).toBeUndefined();
    expect(registry.has('unknown')).toBe(false);
  });

  it('throws on duplicate registration', () => {
    registry.register('file', { onBeforeSave: async () => ({}) });
    expect(() => registry.register('file', { onBeforeSave: async () => ({}) }))
      .toThrow("already registered");
  });

  it('onBeforeSave hook can transform value', async () => {
    registry.register('file', {
      onBeforeSave: async (value) => {
        const file = value as { key: string };
        if (file.key.startsWith('tmp/')) {
          return { transformedValue: { ...file, key: 'permanent/file.pdf' } };
        }
        return {};
      },
    });

    const hooks = registry.get('file')!;
    const result = await hooks.onBeforeSave!({ key: 'tmp/abc.pdf', originalName: 'abc.pdf' }, ctx);
    expect(result.transformedValue).toEqual({ key: 'permanent/file.pdf', originalName: 'abc.pdf' });
  });

  it('onBeforeSave hook can throw to abort', async () => {
    registry.register('file', {
      onBeforeSave: async () => {
        throw new Error('File upload failed');
      },
    });

    const hooks = registry.get('file')!;
    await expect(hooks.onBeforeSave!({}, ctx)).rejects.toThrow('File upload failed');
  });

  it('onTransactionalSave hook receives tx', async () => {
    let receivedTx: any = null;
    registry.register('tags', {
      onTransactionalSave: async (_value, _ctx, tx) => {
        receivedTx = tx;
      },
    });

    const hooks = registry.get('tags')!;
    const fakeTx = { id: 'fake-tx' };
    await hooks.onTransactionalSave!([], { ...ctx, fieldType: 'tags' }, fakeTx);
    expect(receivedTx).toBe(fakeTx);
  });

  it('supports multiple field types', () => {
    registry.register('file', { onBeforeSave: async () => ({}) });
    registry.register('tags', { onTransactionalSave: async () => {} });
    registry.register('multi_user', { onTransactionalSave: async () => {} });

    expect(registry.has('file')).toBe(true);
    expect(registry.has('tags')).toBe(true);
    expect(registry.has('multi_user')).toBe(true);
    expect(registry.has('picklist')).toBe(false);
  });
});
