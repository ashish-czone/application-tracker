import { describe, it, expect } from 'vitest';
import { buildNavItems } from '../EntityNavItems';
import type { EntityRegistryEntry } from '../types';

function mk(
  entityType: string,
  slug: string,
  pluralName: string,
  ui: Partial<EntityRegistryEntry['ui']> = {},
): EntityRegistryEntry {
  return {
    entityType,
    singularName: pluralName.replace(/s$/, ''),
    pluralName,
    slug,
    ui: {
      icon: 'Database',
      nameField: 'name',
      ...ui,
    },
    features: {
      softDelete: false,
      restore: false,
      adminConfigurable: false,
      hasTaxonomy: false,
      hasWorkflow: false,
      hasMedia: false,
      hasNotes: false,
      hasAttachments: false,
      hasEvaluations: false,
    } as EntityRegistryEntry['features'],
  } as EntityRegistryEntry;
}

describe('buildNavItems', () => {
  it('passes non-grouped entities through as entity items', () => {
    const items = buildNavItems([
      mk('candidate', 'candidates', 'Candidates'),
      mk('client', 'clients', 'Clients'),
    ]);

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === 'entity')).toBe(true);
  });

  it('collapses entities sharing navGroup + groupRenderMode=tabs into one group item', () => {
    const items = buildNavItems([
      mk('testimonial', 'testimonials', 'Testimonials', {
        navGroup: 'Content',
        groupRenderMode: 'tabs',
        navOrder: 10,
      }),
      mk('faq_item', 'faq-items', 'FAQ Items', {
        navGroup: 'Content',
        groupRenderMode: 'tabs',
        navOrder: 20,
      }),
      mk('team_member', 'team-members', 'Team Members', {
        navGroup: 'Content',
        groupRenderMode: 'tabs',
        navOrder: 30,
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('group');
    if (items[0].kind !== 'group') throw new Error('expected group');
    expect(items[0].slug).toBe('content');
    expect(items[0].navGroup).toBe('Content');
    expect(items[0].entityCount).toBe(3);
    expect(items[0].firstSlug).toBe('testimonials');
  });

  it('does not collapse when navGroup is set but groupRenderMode is not tabs', () => {
    const items = buildNavItems([
      mk('candidate', 'candidates', 'Candidates', { navGroup: 'Recruit' }),
      mk('client', 'clients', 'Clients', { navGroup: 'Recruit' }),
    ]);

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === 'entity')).toBe(true);
  });

  it('keeps non-tabbed entities separate from tabbed groups even within same navGroup', () => {
    const items = buildNavItems([
      mk('testimonial', 'testimonials', 'Testimonials', {
        navGroup: 'Content',
        groupRenderMode: 'tabs',
        navOrder: 10,
      }),
      mk('page', 'pages', 'Pages', { navGroup: 'Content', navOrder: 5 }),
    ]);

    expect(items).toHaveLength(2);
    const kinds = items.map((i) => i.kind).sort();
    expect(kinds).toEqual(['entity', 'group']);
  });

  it('orders group items by minimum navOrder of their members', () => {
    const items = buildNavItems([
      mk('alpha', 'alpha', 'Alpha', { navOrder: 50 }),
      mk('testimonial', 'testimonials', 'Testimonials', {
        navGroup: 'Content',
        groupRenderMode: 'tabs',
        navOrder: 30,
      }),
      mk('faq_item', 'faq-items', 'FAQ Items', {
        navGroup: 'Content',
        groupRenderMode: 'tabs',
        navOrder: 20,
      }),
      mk('beta', 'beta', 'Beta', { navOrder: 10 }),
    ]);

    expect(items.map((i) => (i.kind === 'entity' ? i.entity.entityType : i.slug))).toEqual([
      'beta',
      'content',
      'alpha',
    ]);
  });

  it('derives group slug by lowercasing and dashing the navGroup label', () => {
    const items = buildNavItems([
      mk('a', 'a', 'A', {
        navGroup: 'Customer Settings',
        groupRenderMode: 'tabs',
      }),
      mk('b', 'b', 'B', {
        navGroup: 'Customer Settings',
        groupRenderMode: 'tabs',
      }),
    ]);

    expect(items).toHaveLength(1);
    if (items[0].kind !== 'group') throw new Error('expected group');
    expect(items[0].slug).toBe('customer-settings');
  });

  it('groups entities with mismatched icons using the first member (by sort order)', () => {
    const items = buildNavItems([
      mk('testimonial', 'testimonials', 'Testimonials', {
        navGroup: 'Content',
        groupRenderMode: 'tabs',
        navOrder: 20,
        icon: 'MessageSquareQuote',
      }),
      mk('faq_item', 'faq-items', 'FAQ Items', {
        navGroup: 'Content',
        groupRenderMode: 'tabs',
        navOrder: 10,
        icon: 'HelpCircle',
      }),
    ]);

    if (items[0].kind !== 'group') throw new Error('expected group');
    expect(items[0].icon).toBe('HelpCircle');
    expect(items[0].firstSlug).toBe('faq-items');
  });
});
