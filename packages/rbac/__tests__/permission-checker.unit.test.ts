import { describe, it, expect } from 'vitest';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../permission-checker';

describe('hasPermission', () => {
  it('should return true when user has the required permission', () => {
    const permissions = ['candidates.create', 'candidates.read', 'orders.read'];
    expect(hasPermission(permissions, 'candidates.create')).toBe(true);
  });

  it('should return false when user lacks the required permission', () => {
    const permissions = ['candidates.read', 'orders.read'];
    expect(hasPermission(permissions, 'candidates.delete')).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('should return true when user has at least one of the required permissions', () => {
    const permissions = ['candidates.read', 'orders.read'];
    expect(hasAnyPermission(permissions, ['candidates.delete', 'orders.read'])).toBe(true);
  });

  it('should return false when user has none of the required permissions', () => {
    const permissions = ['candidates.read'];
    expect(hasAnyPermission(permissions, ['candidates.delete', 'orders.delete'])).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  it('should return true when user has all required permissions', () => {
    const permissions = ['candidates.create', 'candidates.read', 'orders.read'];
    expect(hasAllPermissions(permissions, ['candidates.create', 'orders.read'])).toBe(true);
  });

  it('should return false when user is missing at least one required permission', () => {
    const permissions = ['candidates.create', 'candidates.read'];
    expect(hasAllPermissions(permissions, ['candidates.create', 'orders.delete'])).toBe(false);
  });
});
