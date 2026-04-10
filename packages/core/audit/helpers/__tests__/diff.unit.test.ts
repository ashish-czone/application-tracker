import { describe, it, expect } from 'vitest';
import { computeDiff, inferAction, redactSensitiveFields } from '../diff';

describe('computeDiff', () => {
  it('returns null when both inputs are null', () => {
    expect(computeDiff(null, null)).toBeNull();
  });

  it('returns null when before is null', () => {
    expect(computeDiff(null, { a: 1 })).toBeNull();
  });

  it('returns null when after is null', () => {
    expect(computeDiff({ a: 1 }, null)).toBeNull();
  });

  it('returns null when objects are identical', () => {
    const obj = { title: 'Test', status: 'open', priority: 'medium' };
    expect(computeDiff(obj, { ...obj })).toBeNull();
  });

  it('detects changed fields', () => {
    const before = { title: 'Old Title', status: 'open' };
    const after = { title: 'New Title', status: 'open' };
    const diff = computeDiff(before, after);
    expect(diff).toEqual({
      title: { from: 'Old Title', to: 'New Title' },
    });
  });

  it('detects multiple changed fields', () => {
    const before = { title: 'Old', status: 'open', priority: 'low' };
    const after = { title: 'New', status: 'closed', priority: 'low' };
    const diff = computeDiff(before, after);
    expect(diff).toEqual({
      title: { from: 'Old', to: 'New' },
      status: { from: 'open', to: 'closed' },
    });
  });

  it('detects added fields', () => {
    const before = { title: 'Test' };
    const after = { title: 'Test', description: 'Added' };
    const diff = computeDiff(before, after);
    expect(diff).toEqual({
      description: { from: undefined, to: 'Added' },
    });
  });

  it('detects removed fields', () => {
    const before = { title: 'Test', description: 'Exists' };
    const after = { title: 'Test' };
    const diff = computeDiff(before, after);
    expect(diff).toEqual({
      description: { from: 'Exists', to: undefined },
    });
  });

  it('excludes specified fields', () => {
    const before = { title: 'Old', password: 'secret1' };
    const after = { title: 'New', password: 'secret2' };
    const diff = computeDiff(before, after, ['password']);
    expect(diff).toEqual({
      title: { from: 'Old', to: 'New' },
    });
  });

  it('returns null when only excluded fields changed', () => {
    const before = { title: 'Same', password: 'secret1' };
    const after = { title: 'Same', password: 'secret2' };
    expect(computeDiff(before, after, ['password'])).toBeNull();
  });

  it('handles nested object changes via JSON comparison', () => {
    const before = { config: { theme: 'dark' } };
    const after = { config: { theme: 'light' } };
    const diff = computeDiff(before, after);
    expect(diff).toEqual({
      config: { from: { theme: 'dark' }, to: { theme: 'light' } },
    });
  });

  it('treats identical nested objects as equal', () => {
    const before = { config: { theme: 'dark' } };
    const after = { config: { theme: 'dark' } };
    expect(computeDiff(before, after)).toBeNull();
  });
});

describe('inferAction', () => {
  it('infers "created" from event names ending in Created', () => {
    expect(inferAction('tasks.TaskCreated')).toBe('created');
  });

  it('infers "updated" from event names ending in Updated', () => {
    expect(inferAction('users.UserUpdated')).toBe('updated');
  });

  it('infers "deleted" from event names ending in Deleted', () => {
    expect(inferAction('tasks.TaskDeleted')).toBe('deleted');
  });

  it('infers "registered" from event names ending in Registered', () => {
    expect(inferAction('auth.UserRegistered')).toBe('registered');
  });

  it('converts PascalCase to snake_case for custom events', () => {
    expect(inferAction('auth.UserLoggedIn')).toBe('user_logged_in');
  });

  it('converts PascalCase for password events', () => {
    expect(inferAction('auth.PasswordChanged')).toBe('password_changed');
  });

  it('returns the full name for single-part names', () => {
    expect(inferAction('SomethingHappened')).toBe('SomethingHappened');
  });
});

describe('redactSensitiveFields', () => {
  it('returns null for null input', () => {
    expect(redactSensitiveFields(null, ['password'])).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(redactSensitiveFields(undefined, ['password'])).toBeNull();
  });

  it('returns the original object when no sensitive fields specified', () => {
    const obj = { email: 'test@example.com', name: 'Test' };
    expect(redactSensitiveFields(obj, [])).toEqual(obj);
  });

  it('strips listed fields', () => {
    const obj = { email: 'test@example.com', password: 'secret', name: 'Test' };
    expect(redactSensitiveFields(obj, ['password'])).toEqual({
      email: 'test@example.com',
      name: 'Test',
    });
  });

  it('strips multiple sensitive fields', () => {
    const obj = { email: 'a@b.com', password: 'x', token: 'y', name: 'Test' };
    expect(redactSensitiveFields(obj, ['password', 'token'])).toEqual({
      email: 'a@b.com',
      name: 'Test',
    });
  });

  it('does not modify the original object', () => {
    const obj = { email: 'a@b.com', password: 'secret' };
    redactSensitiveFields(obj, ['password']);
    expect(obj.password).toBe('secret');
  });

  it('ignores fields that do not exist', () => {
    const obj = { name: 'Test' };
    expect(redactSensitiveFields(obj, ['password'])).toEqual({ name: 'Test' });
  });
});
