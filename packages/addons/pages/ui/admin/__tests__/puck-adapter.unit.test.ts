import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { defineBlock } from '@packages/blocks-ui';
import {
  buildPuckConfig,
  filterBlocksBySupports,
  sectionsToPuckData,
  puckDataToSections,
} from '../puck-adapter';

function stubBlock(kind: string, overrides: Partial<Parameters<typeof defineBlock>[0]> = {}) {
  return defineBlock({
    kind,
    name: kind,
    fields: {
      title: { type: 'text', label: 'Title', required: true },
      subtitle: { type: 'textarea', label: 'Subtitle' },
    },
    component: () => createElement('div', null, kind),
    ...overrides,
  });
}

describe('buildPuckConfig', () => {
  it('maps each block to a Puck component keyed by kind', () => {
    const config = buildPuckConfig([
      stubBlock('hero', { category: 'Hero' }),
      stubBlock('cta', { category: 'Call to action' }),
    ]);
    expect(Object.keys(config.components).sort()).toEqual(['cta', 'hero']);
    expect(config.components.hero.label).toBe('hero');
  });

  it('maps text/textarea/number/boolean/picklist field specs to matching Puck field types', () => {
    const config = buildPuckConfig([
      defineBlock({
        kind: 'mixed',
        name: 'Mixed',
        fields: {
          title: { type: 'text', label: 'Title' },
          body: { type: 'textarea', label: 'Body' },
          count: { type: 'number', label: 'Count' },
          active: { type: 'boolean', label: 'Active' },
          size: {
            type: 'picklist',
            label: 'Size',
            options: [
              { value: 's', label: 'Small' },
              { value: 'm', label: 'Medium' },
            ],
          },
        },
        component: () => null,
      }),
    ]);
    const fields = config.components.mixed.fields;
    expect(fields.title.type).toBe('text');
    expect(fields.body.type).toBe('textarea');
    expect(fields.count.type).toBe('number');
    expect(fields.active.type).toBe('radio');
    expect(fields.size.type).toBe('select');
    expect(fields.size.options).toEqual([
      { label: 'Small', value: 's' },
      { label: 'Medium', value: 'm' },
    ]);
  });

  it('adds a variant select when the block declares variants', () => {
    const config = buildPuckConfig([
      stubBlock('hero', {
        variants: [
          { key: 'centered', label: 'Centered' },
          { key: 'split', label: 'Split' },
        ],
        defaultVariant: 'centered',
      }),
    ]);
    expect(config.components.hero.fields.variant).toEqual({
      type: 'select',
      label: 'Variant',
      options: [
        { label: 'Centered', value: 'centered' },
        { label: 'Split', value: 'split' },
      ],
    });
    expect(config.components.hero.defaultProps).toEqual({ variant: 'centered' });
  });

  it('groups kinds into categories for the picker', () => {
    const config = buildPuckConfig([
      stubBlock('hero-1', { category: 'Hero' }),
      stubBlock('hero-2', { category: 'Hero' }),
      stubBlock('text', { category: 'Content' }),
    ]);
    expect(config.categories?.Hero.components.sort()).toEqual(['hero-1', 'hero-2']);
    expect(config.categories?.Content.components).toEqual(['text']);
  });

  it('falls back to "Other" category when category is omitted', () => {
    const config = buildPuckConfig([stubBlock('uncat')]);
    expect(config.categories?.Other.components).toEqual(['uncat']);
  });

  it('hides blocks whose `supports` has no overlap with availableEntities', () => {
    const config = buildPuckConfig(
      [
        stubBlock('hero'),
        stubBlock('testimonials', { supports: ['testimonials'] }),
        stubBlock('faq', { supports: ['faq-items'] }),
      ],
      { availableEntities: ['testimonials'] },
    );
    expect(Object.keys(config.components).sort()).toEqual(['hero', 'testimonials']);
  });

  it('shows every block when availableEntities is omitted', () => {
    const config = buildPuckConfig([
      stubBlock('hero'),
      stubBlock('testimonials', { supports: ['testimonials'] }),
    ]);
    expect(Object.keys(config.components).sort()).toEqual(['hero', 'testimonials']);
  });
});

describe('filterBlocksBySupports', () => {
  it('passes through every block when availableEntities is undefined', () => {
    const blocks = [stubBlock('a', { supports: ['x'] }), stubBlock('b')];
    expect(filterBlocksBySupports(blocks, undefined)).toEqual(blocks);
  });

  it('keeps static-only blocks (empty supports) regardless of availableEntities', () => {
    const blocks = [stubBlock('static-block')];
    expect(filterBlocksBySupports(blocks, [])).toEqual(blocks);
  });

  it('drops blocks whose every supported entity is missing', () => {
    const blocks = [
      stubBlock('keep', { supports: ['testimonials', 'team'] }),
      stubBlock('drop', { supports: ['unknown'] }),
    ];
    const filtered = filterBlocksBySupports(blocks, ['team']);
    expect(filtered.map((b) => b.kind)).toEqual(['keep']);
  });
});

describe('section <-> puck data serialization', () => {
  const sections = [
    { id: 's1', order: 1, blockKind: 'cta', variant: 'centered', customFields: { text: 'Sign up' } },
    { id: 's0', order: 0, blockKind: 'hero', variant: null, customFields: { headline: 'Hi' } },
  ];

  it('sectionsToPuckData sorts by order and flattens into props', () => {
    const data = sectionsToPuckData(sections);
    expect(data.content).toHaveLength(2);
    expect(data.content[0].type).toBe('hero');
    expect(data.content[0].props.id).toBe('s0');
    expect(data.content[0].props.headline).toBe('Hi');
    expect(data.content[0].props).not.toHaveProperty('variant');
    expect(data.content[1].type).toBe('cta');
    expect(data.content[1].props.variant).toBe('centered');
  });

  it('puckDataToSections assigns order by array index and extracts variant + customFields', () => {
    const data = sectionsToPuckData(sections);
    const roundTrip = puckDataToSections(data);
    expect(roundTrip.map((s) => ({ order: s.order, id: s.id, kind: s.blockKind }))).toEqual([
      { order: 0, id: 's0', kind: 'hero' },
      { order: 1, id: 's1', kind: 'cta' },
    ]);
    expect(roundTrip[0].customFields).toEqual({ headline: 'Hi' });
    expect(roundTrip[1].customFields).toEqual({ text: 'Sign up' });
    expect(roundTrip[1].variant).toBe('centered');
  });

  it('puckDataToSections assigns a tmp id when missing', () => {
    const data = {
      content: [{ type: 'hero', props: { id: undefined as unknown as string } }],
      root: { props: {} },
    };
    const sections = puckDataToSections(data);
    expect(sections[0].id).toBe('tmp-0');
  });
});
