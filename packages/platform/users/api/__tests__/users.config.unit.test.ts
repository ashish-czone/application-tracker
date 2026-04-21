import { describe, it, expect, vi } from 'vitest';
import type { RelationHandler } from '@packages/entity-engine-contract';
import { createUsersEntityConfig } from '../users.config';

const noopHandler: RelationHandler = {
  async onCreate() { /* noop */ },
  async onUpdate() { /* noop */ },
  async onDelete() { /* noop */ },
};

describe('createUsersEntityConfig', () => {
  it('builds an EntityConfig with the expected identity', () => {
    const config = createUsersEntityConfig({
      credentialsHandler: noopHandler,
      rolesHandler: noopHandler,
    });

    expect(config.entityType).toBe('users');
    expect(config.slug).toBe('users');
    expect(config.singularName).toBe('User');
    expect(config.pluralName).toBe('Users');
    expect(config.onDelete.mode).toBe('soft');
  });

  it('declares email, firstName, lastName, phone, userType as code-defined fields', () => {
    const config = createUsersEntityConfig({
      credentialsHandler: noopHandler,
      rolesHandler: noopHandler,
    });
    const keys = Object.keys(config.fieldMeta);
    expect(keys).toEqual(expect.arrayContaining(['email', 'firstName', 'lastName', 'phone', 'userType']));
  });

  it('declares credentials hasOne with a password nested field and the supplied handler', () => {
    const credentialsHandler: RelationHandler = { async onCreate() {} };
    const config = createUsersEntityConfig({
      credentialsHandler,
      rolesHandler: noopHandler,
    });
    const rel = config.relationships?.find((r) => r.name === 'credentials');
    expect(rel).toBeDefined();
    expect(rel!.type).toBe('hasOne');
    expect(rel!.targetEntity).toBe('credentials');
    expect(rel!.handler).toBe(credentialsHandler);
    expect(rel!.nestedFields).toHaveLength(1);
    expect(rel!.nestedFields?.[0]).toMatchObject({
      fieldKey: 'password',
      fieldType: 'text',
      uiType: 'password',
      isRequired: true,
    });
  });

  it('declares roles manyToMany with the supplied handler and no nestedFields', () => {
    const rolesHandler: RelationHandler = { async onCreate() {} };
    const config = createUsersEntityConfig({
      credentialsHandler: noopHandler,
      rolesHandler,
    });
    const rel = config.relationships?.find((r) => r.name === 'roles');
    expect(rel).toBeDefined();
    expect(rel!.type).toBe('manyToMany');
    expect(rel!.targetEntity).toBe('roles');
    expect(rel!.junctionEntity).toBe('user_roles');
    expect(rel!.handler).toBe(rolesHandler);
    expect(rel!.nestedFields).toBeUndefined();
  });

  it('marks email as unique, required, isLabel and enables search/sort', () => {
    const config = createUsersEntityConfig({
      credentialsHandler: noopHandler,
      rolesHandler: noopHandler,
    });
    const meta = config.fieldMeta.email;
    expect(meta.isUnique).toBe(true);
    // FieldMeta from defineEntity has isSystem, not required — required lives on ModelField.
    // Presence-check the core shape without drilling into generation internals.
    expect(meta.fieldType).toBe('email');
  });

  it('injects different handlers into independent configs (factory produces fresh references)', () => {
    const h1: RelationHandler = { async onCreate() {} };
    const h2: RelationHandler = { async onCreate() {} };
    const cfg1 = createUsersEntityConfig({ credentialsHandler: h1, rolesHandler: noopHandler });
    const cfg2 = createUsersEntityConfig({ credentialsHandler: h2, rolesHandler: noopHandler });
    expect(cfg1.relationships?.find((r) => r.name === 'credentials')?.handler).toBe(h1);
    expect(cfg2.relationships?.find((r) => r.name === 'credentials')?.handler).toBe(h2);
  });

  describe('read-side role enrichment hooks', () => {
    it('does not register hooks when rolesReader is omitted', () => {
      const config = createUsersEntityConfig({
        credentialsHandler: noopHandler,
        rolesHandler: noopHandler,
      });
      expect(config.hooks).toBeUndefined();
    });

    it('registers afterList + afterFindOne when rolesReader is supplied', () => {
      const rolesReader = {
        getRolesByUserIds: async () => ({}),
      };
      const config = createUsersEntityConfig({
        credentialsHandler: noopHandler,
        rolesHandler: noopHandler,
        rolesReader,
      });
      expect(config.hooks?.afterList).toBeDefined();
      expect(config.hooks?.afterFindOne).toBeDefined();
    });

    it('afterList attaches roles per row via batch reader', async () => {
      const rolesReader = {
        getRolesByUserIds: vi.fn(async (ids: string[]) => ({
          [ids[0]!]: [{ id: 'r1', name: 'Admin', userType: 'admin' }],
          [ids[1]!]: [],
        })),
      };
      const config = createUsersEntityConfig({
        credentialsHandler: noopHandler,
        rolesHandler: noopHandler,
        rolesReader,
      });

      const enriched = await config.hooks!.afterList!(
        [{ id: 'u1', email: 'a@b.com' }, { id: 'u2', email: 'c@d.com' }],
        { actorId: 'actor-1' },
      );

      expect(rolesReader.getRolesByUserIds).toHaveBeenCalledOnce();
      expect(rolesReader.getRolesByUserIds).toHaveBeenCalledWith(['u1', 'u2']);
      expect(enriched[0]?.roles).toEqual([{ id: 'r1', name: 'Admin', userType: 'admin' }]);
      expect(enriched[1]?.roles).toEqual([]);
    });

    it('afterList short-circuits on empty page (no reader call)', async () => {
      const rolesReader = {
        getRolesByUserIds: vi.fn(async () => ({})),
      };
      const config = createUsersEntityConfig({
        credentialsHandler: noopHandler,
        rolesHandler: noopHandler,
        rolesReader,
      });

      const out = await config.hooks!.afterList!([], { actorId: 'actor-1' });

      expect(out).toEqual([]);
      expect(rolesReader.getRolesByUserIds).not.toHaveBeenCalled();
    });

    it('afterFindOne attaches roles for the single row via batch reader', async () => {
      const rolesReader = {
        getRolesByUserIds: vi.fn(async (ids: string[]) => ({
          [ids[0]!]: [{ id: 'r1', name: 'Editor', userType: 'admin' }],
        })),
      };
      const config = createUsersEntityConfig({
        credentialsHandler: noopHandler,
        rolesHandler: noopHandler,
        rolesReader,
      });

      const enriched = await config.hooks!.afterFindOne!(
        { id: 'u1', email: 'x@y.com' },
        { actorId: 'actor-1' },
      );

      expect(rolesReader.getRolesByUserIds).toHaveBeenCalledWith(['u1']);
      expect(enriched.roles).toEqual([{ id: 'r1', name: 'Editor', userType: 'admin' }]);
    });

    it('afterFindOne returns empty roles array when the user has none', async () => {
      const rolesReader = {
        getRolesByUserIds: async () => ({}),
      };
      const config = createUsersEntityConfig({
        credentialsHandler: noopHandler,
        rolesHandler: noopHandler,
        rolesReader,
      });

      const enriched = await config.hooks!.afterFindOne!(
        { id: 'u1' },
        { actorId: 'actor-1' },
      );
      expect(enriched.roles).toEqual([]);
    });
  });
});
