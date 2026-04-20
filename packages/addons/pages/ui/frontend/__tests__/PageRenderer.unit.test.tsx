import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { defineBlock, blockRegistry } from '../registry';
import { PageRenderer } from '../PageRenderer';
import type { SectionData } from '../types';

function mount(sections: SectionData[], fallback?: (s: SectionData) => any) {
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
      { id: 's1', order: 0, blockKind: 'hero', variant: null, customFields: { headline: 'Welcome' } },
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
      { id: 's2', order: 1, blockKind: 'text', variant: null, customFields: { content: 'second' } },
      { id: 's1', order: 0, blockKind: 'text', variant: null, customFields: { content: 'first' } },
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
      { id: 's1', order: 0, blockKind: 'hero', variant: 'split', customFields: {} },
    ]);
    expect(explicit).toContain('data-variant="split"');

    const fallback = mount([
      { id: 's1', order: 0, blockKind: 'hero', variant: null, customFields: {} },
    ]);
    expect(fallback).toContain('data-variant="centered"');
  });

  it('renders nothing for unknown blockKind by default', () => {
    const html = mount([
      { id: 's1', order: 0, blockKind: 'never-registered', variant: null, customFields: {} },
    ]);
    expect(html).toBe('');
  });

  it('uses fallback render for unknown blockKind when provided', () => {
    const html = mount(
      [{ id: 's1', order: 0, blockKind: 'never-registered', variant: null, customFields: {} }],
      (s) => createElement('div', { className: 'missing' }, `missing: ${s.blockKind}`),
    );
    expect(html).toContain('missing: never-registered');
  });
});
