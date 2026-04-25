import { describe, it, expect } from 'vitest';
import { USERS_CONFIG, deriveUserStatus } from '../users.config';

describe('deriveUserStatus', () => {
  it('returns deactivated when deletedAt is set (takes precedence)', () => {
    expect(deriveUserStatus({ deletedAt: new Date(), invitedAt: new Date(), acceptedAt: null })).toBe('deactivated');
    expect(deriveUserStatus({ deletedAt: new Date(), invitedAt: null, acceptedAt: null })).toBe('deactivated');
    expect(deriveUserStatus({ deletedAt: new Date(), invitedAt: new Date(), acceptedAt: new Date() })).toBe('deactivated');
  });

  it('returns invited when invitedAt is set but acceptedAt is not', () => {
    expect(deriveUserStatus({ deletedAt: null, invitedAt: new Date(), acceptedAt: null })).toBe('invited');
  });

  it('returns active when invitation was accepted', () => {
    expect(deriveUserStatus({ deletedAt: null, invitedAt: new Date(), acceptedAt: new Date() })).toBe('active');
  });

  it('returns active for a user that was never invited (legacy account created with credentials)', () => {
    expect(deriveUserStatus({ deletedAt: null, invitedAt: null, acceptedAt: null })).toBe('active');
  });
});

describe('USERS_CONFIG', () => {
  it('declares the expected entity identity', () => {
    expect(USERS_CONFIG.entityType).toBe('users');
    expect(USERS_CONFIG.slug).toBe('users');
    expect(USERS_CONFIG.singularName).toBe('User');
    expect(USERS_CONFIG.pluralName).toBe('Users');
    expect(USERS_CONFIG.onDelete.mode).toBe('soft');
  });

  it('declares email, firstName, lastName, phone, userType as code-defined fields', () => {
    const keys = Object.keys(USERS_CONFIG.fieldMeta);
    expect(keys).toEqual(expect.arrayContaining(['email', 'firstName', 'lastName', 'phone', 'userType']));
  });

  it('declares credentials hasOne with a password nested-field hint (layout-only)', () => {
    const rel = USERS_CONFIG.relationships?.find((r) => r.name === 'credentials');
    expect(rel).toBeDefined();
    expect(rel!.type).toBe('hasOne');
    expect(rel!.targetEntity).toBe('credentials');
    expect(rel!.nestedFields).toHaveLength(1);
    expect(rel!.nestedFields?.[0]).toMatchObject({
      fieldKey: 'password',
      fieldType: 'text',
      uiType: 'password',
      isRequired: true,
    });
  });

  it('declares roles manyToMany with no nestedFields', () => {
    const rel = USERS_CONFIG.relationships?.find((r) => r.name === 'roles');
    expect(rel).toBeDefined();
    expect(rel!.type).toBe('manyToMany');
    expect(rel!.targetEntity).toBe('roles');
    expect(rel!.junctionEntity).toBe('user_roles');
    expect(rel!.nestedFields).toBeUndefined();
  });

  it('marks email as unique, required, isLabel and enables search/sort', () => {
    const meta = USERS_CONFIG.fieldMeta.email;
    expect(meta.isUnique).toBe(true);
    expect(meta.fieldType).toBe('email');
  });

  it('does not carry handlers on relationships — composition lives in UsersService', () => {
    for (const rel of USERS_CONFIG.relationships ?? []) {
      expect((rel as Record<string, unknown>).handler).toBeUndefined();
    }
  });
});
