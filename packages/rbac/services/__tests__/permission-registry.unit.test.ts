import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionRegistryService } from '../permission-registry.service';

describe('PermissionRegistryService', () => {
  let registry: PermissionRegistryService;

  beforeEach(() => {
    registry = new PermissionRegistryService();
  });

  describe('register', () => {
    it('should register permissions for a module', () => {
      registry.register('candidates', [
        { action: 'create', description: 'Create candidates' },
        { action: 'read', description: 'View candidates' },
      ]);

      const result = registry.getByModule('candidates');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        module: 'candidates',
        action: 'create',
        description: 'Create candidates',
      });
    });

    it('should overwrite existing module permissions on re-register', () => {
      registry.register('candidates', [
        { action: 'create', description: 'Create candidates' },
      ]);
      registry.register('candidates', [
        { action: 'read', description: 'View candidates' },
      ]);

      const result = registry.getByModule('candidates');
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('read');
    });
  });

  describe('getAll', () => {
    it('should return empty array when no permissions registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all permissions across modules', () => {
      registry.register('candidates', [
        { action: 'create', description: 'Create candidates' },
      ]);
      registry.register('orders', [
        { action: 'read', description: 'View orders' },
        { action: 'create', description: 'Create orders' },
      ]);

      const result = registry.getAll();
      expect(result).toHaveLength(3);
    });
  });

  describe('getByModule', () => {
    it('should return empty array for unknown module', () => {
      expect(registry.getByModule('unknown')).toEqual([]);
    });
  });

  describe('has', () => {
    it('should return false for unregistered module', () => {
      expect(registry.has('candidates')).toBe(false);
    });

    it('should return true for registered module', () => {
      registry.register('candidates', [
        { action: 'create', description: 'Create candidates' },
      ]);
      expect(registry.has('candidates')).toBe(true);
    });
  });
});
