import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { SettingsRegistryService } from '../settings-registry.service';
import type { SettingsSchemaDefinition } from '../../types';

function createDefinition(
  module: string,
  overrides: Partial<SettingsSchemaDefinition> = {},
): SettingsSchemaDefinition {
  const schema = z.object({
    timeout: z.number().min(1).default(30),
    enabled: z.boolean().default(true),
  });

  return {
    module,
    label: `${module} Settings`,
    schema,
    metadata: {
      timeout: {
        label: 'Timeout',
        description: 'Timeout in seconds',
        type: 'number',
        min: 1,
      },
      enabled: {
        label: 'Enabled',
        type: 'boolean',
      },
    },
    ...overrides,
  };
}

describe('SettingsRegistryService', () => {
  let registry: SettingsRegistryService;

  beforeEach(() => {
    registry = new SettingsRegistryService();
  });

  describe('register', () => {
    it('should register a module settings schema', () => {
      const definition = createDefinition('identity');
      registry.register(definition);

      expect(registry.has('identity')).toBe(true);
      expect(registry.getByModule('identity')).toEqual(definition);
    });

    it('should throw if module is already registered', () => {
      registry.register(createDefinition('identity'));

      expect(() => registry.register(createDefinition('identity'))).toThrow(
        'Settings schema for module "identity" is already registered',
      );
    });

    it('should throw if schema key is missing metadata', () => {
      const definition = createDefinition('identity', {
        metadata: {
          timeout: {
            label: 'Timeout',
            type: 'number',
          },
          // missing 'enabled' metadata
        },
      });

      expect(() => registry.register(definition)).toThrow(
        'missing metadata for key "enabled"',
      );
    });

    it('should throw if metadata has key not in schema', () => {
      const definition = createDefinition('identity', {
        metadata: {
          timeout: { label: 'Timeout', type: 'number' },
          enabled: { label: 'Enabled', type: 'boolean' },
          unknown: { label: 'Unknown', type: 'string' },
        },
      });

      expect(() => registry.register(definition)).toThrow(
        'unknown key "unknown" not in schema',
      );
    });
  });

  describe('getAll', () => {
    it('should return empty array when no modules registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered modules sorted alphabetically', () => {
      registry.register(createDefinition('throttler'));
      registry.register(createDefinition('identity'));
      registry.register(createDefinition('rbac'));

      const all = registry.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((d) => d.module)).toEqual([
        'identity',
        'rbac',
        'throttler',
      ]);
    });
  });

  describe('getByModule', () => {
    it('should return undefined for unregistered module', () => {
      expect(registry.getByModule('nonexistent')).toBeUndefined();
    });

    it('should return the definition for a registered module', () => {
      const definition = createDefinition('identity');
      registry.register(definition);

      expect(registry.getByModule('identity')).toEqual(definition);
    });
  });

  describe('has', () => {
    it('should return false for unregistered module', () => {
      expect(registry.has('identity')).toBe(false);
    });

    it('should return true for registered module', () => {
      registry.register(createDefinition('identity'));
      expect(registry.has('identity')).toBe(true);
    });
  });
});
