import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MenuRenderer } from '../MenuRenderer';
import type { PublicMenuItemDto } from '../types';

function item(overrides: Partial<PublicMenuItemDto>): PublicMenuItemDto {
  return {
    id: overrides.id ?? 'x',
    label: overrides.label ?? 'Item',
    linkType: overrides.linkType ?? 'url',
    url: overrides.url ?? null,
    pageId: overrides.pageId ?? null,
    href: overrides.href ?? null,
    target: overrides.target ?? '_self',
    children: overrides.children ?? [],
  };
}

describe('MenuRenderer', () => {
  it('returns null for an empty tree', () => {
    const html = renderToStaticMarkup(<MenuRenderer items={[]} />);
    expect(html).toBe('');
  });

  it('renders a flat list of items as anchors', () => {
    const html = renderToStaticMarkup(
      <MenuRenderer
        items={[
          item({ id: 'a', label: 'Home', href: '/' }),
          item({ id: 'b', label: 'About', href: '/about' }),
        ]}
      />,
    );
    expect(html).toContain('Home');
    expect(html).toContain('href="/"');
    expect(html).toContain('About');
    expect(html).toContain('href="/about"');
  });

  it('nests children inside a second <ul>', () => {
    const html = renderToStaticMarkup(
      <MenuRenderer
        items={[
          item({
            id: 'p',
            label: 'Products',
            href: '/products',
            children: [item({ id: 'p1', label: 'Widgets', href: '/products/widgets' })],
          }),
        ]}
      />,
    );
    // Two <ul> (outer + dropdown)
    expect((html.match(/<ul/g) ?? []).length).toBe(2);
    expect(html).toContain('Widgets');
  });

  it('renders target=_blank with rel="noopener noreferrer"', () => {
    const html = renderToStaticMarkup(
      <MenuRenderer
        items={[item({ label: 'External', href: 'https://example.com', target: '_blank' })]}
      />,
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders items with null href as <span> rather than <a>', () => {
    const html = renderToStaticMarkup(
      <MenuRenderer items={[item({ label: 'Broken link', href: null })]} />,
    );
    expect(html).not.toContain('<a ');
    expect(html).toContain('<span');
    expect(html).toContain('Broken link');
  });
});
