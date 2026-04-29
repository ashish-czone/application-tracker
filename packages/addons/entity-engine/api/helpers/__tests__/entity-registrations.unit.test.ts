import { describe, it, expect, vi } from 'vitest';
import {
  registerEntityCrudPermissions,
  registerEntityCrudEvents,
  registerWorkflowTransitionEvent,
  registerEntityAudit,
  registerEntityLookup,
} from '../entity-registrations';

describe('entity-registrations helpers', () => {
  describe('registerEntityCrudPermissions', () => {
    it('emits four CRUD manifests with humanized labels', () => {
      const rbac = { registerManifests: vi.fn() } as any;
      registerEntityCrudPermissions(rbac, {
        slug: 'candidates',
        singular: 'candidate',
        plural: 'candidates',
        supportedScopes: ['any', 'own'],
      });
      expect(rbac.registerManifests).toHaveBeenCalledTimes(1);
      const manifests = rbac.registerManifests.mock.calls[0][0];
      expect(manifests).toHaveLength(4);
      expect(manifests.map((m: any) => m.slug)).toEqual([
        'candidates.create',
        'candidates.read',
        'candidates.update',
        'candidates.delete',
      ]);
      expect(manifests[1].label).toBe('View candidates');
      expect(manifests[2].label).toBe('Update candidate');
      expect(manifests[0].supportedScopes).toEqual(['any', 'own']);
    });

    it('appends extraPermissions and inherits supportedScopes when not overridden', () => {
      const rbac = { registerManifests: vi.fn() } as any;
      registerEntityCrudPermissions(rbac, {
        slug: 'filings',
        singular: 'filing',
        plural: 'filings',
        supportedScopes: ['any', 'own', 'unit'],
        extraPermissions: [
          { action: 'pickup', description: 'Pick up a filing', supportedScopes: ['unit'] },
          { action: 'submit', description: 'Submit for review' },
        ],
      });
      const manifests = rbac.registerManifests.mock.calls[0][0];
      expect(manifests).toHaveLength(6);
      expect(manifests[4].slug).toBe('filings.pickup');
      expect(manifests[4].supportedScopes).toEqual(['unit']);
      expect(manifests[5].slug).toBe('filings.submit');
      expect(manifests[5].supportedScopes).toEqual(['any', 'own', 'unit']);
    });
  });

  describe('registerEntityCrudEvents', () => {
    it('registers Created/Updated/Deleted and returns the names', () => {
      const eventRegistry = { register: vi.fn() } as any;
      const names = registerEntityCrudEvents(eventRegistry, {
        entityType: 'candidates',
        singular: 'candidate',
      });
      expect(names).toEqual({
        created: 'candidates.Created',
        updated: 'candidates.Updated',
        deleted: 'candidates.Deleted',
      });
      expect(eventRegistry.register).toHaveBeenCalledTimes(3);
      const created = eventRegistry.register.mock.calls[0][0];
      expect(created.eventName).toBe('candidates.Created');
      expect(created.description).toContain('candidate');
      expect(created.group).toBe('candidates');
    });
  });

  describe('registerWorkflowTransitionEvent', () => {
    it('builds PascalCase event name and returns it', () => {
      const eventRegistry = { register: vi.fn() } as any;
      const name = registerWorkflowTransitionEvent(eventRegistry, {
        entityType: 'applications',
        fieldKey: 'stage',
        singular: 'application',
        fieldLabel: 'Stage',
      });
      expect(name).toBe('applications.StageChanged');
      const call = eventRegistry.register.mock.calls[0][0];
      expect(call.payloadSchema.fromState.label).toBe('Previous Stage');
      expect(call.payloadSchema.toState.label).toBe('New Stage');
    });
  });

  describe('registerEntityAudit', () => {
    it('forwards entityType + eventNames to the audit extension', () => {
      const auditExt = { register: vi.fn() } as any;
      registerEntityAudit(auditExt, {
        entityType: 'candidates',
        eventNames: ['candidates.Created', 'candidates.Updated'],
      });
      expect(auditExt.register).toHaveBeenCalledWith('candidates', {
        events: ['candidates.Created', 'candidates.Updated'],
      });
    });

    it('is a no-op when the audit extension is null/undefined', () => {
      expect(() => registerEntityAudit(null, { entityType: 'x', eventNames: [] })).not.toThrow();
      expect(() => registerEntityAudit(undefined, { entityType: 'x', eventNames: [] })).not.toThrow();
    });
  });

  describe('registerEntityLookup', () => {
    it('passes table + label/value/search fields to the lookup resolver, defaulting valueField to id', () => {
      const lookupResolver = { register: vi.fn() } as any;
      const table = {} as any;
      registerEntityLookup(lookupResolver, {
        entityType: 'candidates',
        table,
        labelField: 'firstName',
        searchFields: ['firstName', 'email'],
      });
      expect(lookupResolver.register).toHaveBeenCalledWith({
        entity: 'candidates',
        table,
        labelField: 'firstName',
        valueField: 'id',
        searchFields: ['firstName', 'email'],
      });
    });

    it('honors a non-default valueField', () => {
      const lookupResolver = { register: vi.fn() } as any;
      registerEntityLookup(lookupResolver, {
        entityType: 'countries',
        table: {} as any,
        labelField: 'name',
        searchFields: ['name', 'code'],
        valueField: 'isoCode',
      });
      expect(lookupResolver.register.mock.calls[0][0].valueField).toBe('isoCode');
    });
  });
});
