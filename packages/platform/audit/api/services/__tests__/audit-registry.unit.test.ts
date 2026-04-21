import { describe, it, expect, beforeEach } from 'vitest';
import { AuditRegistryService } from '../audit-registry.service';

describe('AuditRegistryService', () => {
  let registry: AuditRegistryService;

  beforeEach(() => {
    registry = new AuditRegistryService();
  });

  describe('register + findRegistration', () => {
    it('finds a registration with explicit event list', () => {
      registry.register('tasks', {
        events: ['tasks.TaskCreated', 'tasks.TaskUpdated'],
      });

      const match = registry.findRegistration('tasks.TaskCreated');
      expect(match).not.toBeNull();
      expect(match!.moduleName).toBe('tasks');
      expect(match!.registration.events).toContain('tasks.TaskCreated');
    });

    it('returns null for unregistered events', () => {
      registry.register('tasks', {
        events: ['tasks.TaskCreated'],
      });

      expect(registry.findRegistration('users.Created')).toBeNull();
    });

    it('returns null for events not in the explicit list', () => {
      registry.register('tasks', {
        events: ['tasks.TaskCreated'],
      });

      expect(registry.findRegistration('tasks.TaskDeleted')).toBeNull();
    });

    it('matches events with wildcard "*" by module prefix', () => {
      registry.register('tasks', { events: '*' });

      expect(registry.findRegistration('tasks.TaskCreated')).not.toBeNull();
      expect(registry.findRegistration('tasks.TaskUpdated')).not.toBeNull();
      expect(registry.findRegistration('tasks.TaskDeleted')).not.toBeNull();
    });

    it('wildcard does not match events from other modules', () => {
      registry.register('tasks', { events: '*' });

      expect(registry.findRegistration('users.Created')).toBeNull();
    });

    it('wildcard matching is case-insensitive on module prefix', () => {
      registry.register('Tasks', { events: '*' });

      expect(registry.findRegistration('tasks.TaskCreated')).not.toBeNull();
    });

    it('preserves sensitiveFields in registration', () => {
      registry.register('users', {
        events: ['users.Created'],
        sensitiveFields: ['passwordHash', 'token'],
      });

      const match = registry.findRegistration('users.Created');
      expect(match!.registration.sensitiveFields).toEqual(['passwordHash', 'token']);
    });
  });

  describe('getAll', () => {
    it('returns all registrations', () => {
      registry.register('tasks', { events: '*' });
      registry.register('users', { events: ['users.Created'] });

      const all = registry.getAll();
      expect(all.size).toBe(2);
      expect(all.has('tasks')).toBe(true);
      expect(all.has('users')).toBe(true);
    });

    it('returns empty map when nothing registered', () => {
      expect(registry.getAll().size).toBe(0);
    });

    it('returns a copy, not the internal map', () => {
      registry.register('tasks', { events: '*' });
      const all = registry.getAll();
      all.delete('tasks');
      expect(registry.getAll().size).toBe(1);
    });
  });
});
