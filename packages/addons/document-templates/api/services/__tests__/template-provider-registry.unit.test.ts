import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateProviderRegistry } from '../template-provider-registry';
import type { TemplatePlaceholderProvider } from '../../types';

function createProvider(category: string): TemplatePlaceholderProvider {
  return {
    category,
    getPlaceholders: () => [
      { key: 'name', label: 'Name', sampleValue: 'John' },
      { key: 'email', label: 'Email', sampleValue: 'john@test.com' },
    ],
    resolve: async () => ({ name: 'John', email: 'john@test.com' }),
  };
}

describe('TemplateProviderRegistry', () => {
  let registry: TemplateProviderRegistry;

  beforeEach(() => {
    registry = new TemplateProviderRegistry();
  });

  it('registers and retrieves a provider', () => {
    const provider = createProvider('offer-letter');
    registry.register(provider);

    expect(registry.get('offer-letter')).toBe(provider);
    expect(registry.has('offer-letter')).toBe(true);
  });

  it('returns undefined for unregistered category', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('returns placeholders for a registered category', () => {
    registry.register(createProvider('offer-letter'));

    const placeholders = registry.getPlaceholders('offer-letter');
    expect(placeholders).toHaveLength(2);
    expect(placeholders[0].key).toBe('name');
  });

  it('returns empty array for unregistered category placeholders', () => {
    expect(registry.getPlaceholders('nonexistent')).toEqual([]);
  });

  it('lists registered categories', () => {
    registry.register(createProvider('offer-letter'));
    registry.register(createProvider('contract'));

    const categories = registry.getRegisteredCategories();
    expect(categories).toContain('offer-letter');
    expect(categories).toContain('contract');
    expect(categories).toHaveLength(2);
  });

  it('overwrites provider when registering same category twice', () => {
    const first = createProvider('offer-letter');
    const second = createProvider('offer-letter');
    registry.register(first);
    registry.register(second);

    expect(registry.get('offer-letter')).toBe(second);
    expect(registry.getRegisteredCategories()).toHaveLength(1);
  });
});
