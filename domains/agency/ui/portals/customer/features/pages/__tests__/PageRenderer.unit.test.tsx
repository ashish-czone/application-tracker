import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactNode } from 'react';
import type { SectionData } from '@domains/agency-contract';
import { defineBlock, blockRegistry } from '../../../../../components/blocks/registry';
import { PageRenderer } from '../PageRenderer';

function section(partial: Partial<SectionData> & Pick<SectionData, 'id' | 'order' | 'blockKind'>): SectionData {
  return {
    variant: null,
    title: null,
    customFields: {},
    data: {},
    ...partial,
  };
}

function mount(sections: SectionData[], fallback?: (s: SectionData) => ReactNode) {
  return renderToStaticMarkup(createElement(PageRenderer, { sections, fallback }));
}

describe('PageRenderer', () => {
  beforeEach(() => {
    blockRegistry.clear();
  });

  it('renders each section by looking up its blockKind', () => {
    blockRegistry.register(defineBlock({
      kind: 'hero',
      name: 'Hero',
      fields: {},
      component: ({ fields }: { fields: { headline?: string } }) =>
        createElement('h1', null, fields.headline ?? ''),
    }));

    const html = mount([
      section({ id: 's1', order: 0, blockKind: 'hero', customFields: { headline: 'Welcome' } }),
    ]);

    expect(html).toBe('<h1>Welcome</h1>');
  });

  it('orders sections by `order` regardless of input order', () => {
    blockRegistry.register(defineBlock({
      kind: 'text',
      name: 'Text',
      fields: {},
      component: ({ fields }: { fields: { content?: string } }) =>
        createElement('p', null, fields.content ?? ''),
    }));

    const html = mount([
      section({ id: 's2', order: 1, blockKind: 'text', customFields: { content: 'second' } }),
      section({ id: 's1', order: 0, blockKind: 'text', customFields: { content: 'first' } }),
    ]);

    expect(html).toBe('<p>first</p><p>second</p>');
  });

  it('passes variant through, falling back to defaultVariant', () => {
    blockRegistry.register(defineBlock({
      kind: 'hero',
      name: 'Hero',
      defaultVariant: 'centered',
      fields: {},
      component: ({ variant }) => createElement('div', { 'data-variant': variant ?? '' }),
    }));

    const explicit = mount([
      section({ id: 's1', order: 0, blockKind: 'hero', variant: 'split' }),
    ]);
    expect(explicit).toContain('data-variant="split"');

    const fallback = mount([
      section({ id: 's1', order: 0, blockKind: 'hero' }),
    ]);
    expect(fallback).toContain('data-variant="centered"');
  });

  it('renders nothing for unknown blockKind by default', () => {
    const html = mount([section({ id: 's1', order: 0, blockKind: 'never-registered' })]);
    expect(html).toBe('');
  });

  it('uses fallback render for unknown blockKind when provided', () => {
    const html = mount(
      [section({ id: 's1', order: 0, blockKind: 'never-registered' })],
      (s) => createElement('div', { className: 'missing' }, `missing: ${s.blockKind}`),
    );
    expect(html).toContain('missing: never-registered');
  });

  it('composes fields = section.data ∪ {heading: title} ∪ customFields with customFields winning', () => {
    blockRegistry.register(defineBlock({
      kind: 'probe',
      name: 'Probe',
      fields: {},
      component: ({ fields }: { fields: { heading?: string; items?: string; override?: string } }) =>
        createElement('div', null, `h=${fields.heading ?? ''}|i=${fields.items ?? ''}|o=${fields.override ?? ''}`),
    }));

    const html = mount([
      section({
        id: 's1',
        order: 0,
        blockKind: 'probe',
        title: 'From Title',
        data: { items: 'from-data', override: 'data-wins?' },
        customFields: { override: 'customFields-wins' },
      }),
    ]);

    expect(html).toContain('h=From Title');
    expect(html).toContain('i=from-data');
    expect(html).toContain('o=customFields-wins');
  });

  it('null section.title does not inject heading key', () => {
    blockRegistry.register(defineBlock({
      kind: 'probe',
      name: 'Probe',
      fields: {},
      component: ({ fields }: { fields: { heading?: string } }) =>
        createElement('div', null, 'heading' in fields ? 'present' : 'absent'),
    }));

    const html = mount([section({ id: 's1', order: 0, blockKind: 'probe' })]);
    expect(html).toContain('absent');
  });
});
