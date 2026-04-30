import { describe, it, expect } from 'vitest';
import { buildMenuTree } from '../services/menus-public.service';

function row(overrides: Partial<Parameters<typeof buildMenuTree>[0][number]>) {
  return {
    id: overrides.id ?? 'x',
    label: overrides.label ?? 'Item',
    description: overrides.description ?? null,
    icon: overrides.icon ?? null,
    linkType: overrides.linkType ?? 'url',
    url: overrides.url ?? null,
    pageId: overrides.pageId ?? null,
    target: overrides.target ?? '_self',
    parentId: overrides.parentId ?? null,
    depth: overrides.depth ?? 0,
    sortOrder: overrides.sortOrder ?? 0,
  };
}

describe('buildMenuTree', () => {
  it('returns an empty array for no rows', () => {
    expect(buildMenuTree([])).toEqual([]);
  });

  it('returns flat roots when no row has a parentId', () => {
    const tree = buildMenuTree([
      row({ id: 'a', label: 'A' }),
      row({ id: 'b', label: 'B' }),
    ]);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe('a');
    expect(tree[0].children).toEqual([]);
    expect(tree[1].id).toBe('b');
  });

  it('nests children under their parent', () => {
    const tree = buildMenuTree([
      row({ id: 'a', label: 'A' }),
      row({ id: 'a1', label: 'A1', parentId: 'a', depth: 1 }),
      row({ id: 'a2', label: 'A2', parentId: 'a', depth: 1 }),
      row({ id: 'b', label: 'B' }),
    ]);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe('a');
    expect(tree[0].children.map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(tree[1].children).toEqual([]);
  });

  it('preserves input order within each level (caller is responsible for sort)', () => {
    const tree = buildMenuTree([
      row({ id: 'a', sortOrder: 0 }),
      row({ id: 'a2', parentId: 'a', sortOrder: 200, depth: 1 }),
      row({ id: 'a1', parentId: 'a', sortOrder: 100, depth: 1 }),
    ]);
    // The helper does not re-sort — it just bucket-assigns.
    expect(tree[0].children.map((c) => c.id)).toEqual(['a2', 'a1']);
  });

  it('surfaces orphaned children at the root rather than dropping them', () => {
    const tree = buildMenuTree([
      row({ id: 'x', parentId: 'missing-parent', depth: 1 }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('x');
  });

  it('maps the raw row shape to the public DTO shape', () => {
    const tree = buildMenuTree([
      row({
        id: 'a',
        label: 'Home',
        linkType: 'page',
        url: null,
        pageId: 'page-1',
        target: '_blank',
      }),
    ]);
    expect(tree[0]).toMatchObject({
      id: 'a',
      label: 'Home',
      linkType: 'page',
      url: null,
      pageId: 'page-1',
      target: '_blank',
      children: [],
    });
  });

  it('resolves href from url for linkType=url', () => {
    const tree = buildMenuTree([
      row({ id: 'a', linkType: 'url', url: 'https://example.com' }),
    ]);
    expect(tree[0].href).toBe('https://example.com');
  });

  it('resolves href from resolvePageSlug for linkType=page', () => {
    const tree = buildMenuTree(
      [row({ id: 'a', linkType: 'page', url: null, pageId: 'p1' })],
      (id) => (id === 'p1' ? 'about' : null),
    );
    expect(tree[0].href).toBe('/about');
  });

  it('returns null href when the referenced page is missing', () => {
    const tree = buildMenuTree(
      [row({ id: 'a', linkType: 'page', url: null, pageId: 'missing' })],
      () => null,
    );
    expect(tree[0].href).toBeNull();
  });

  it('surfaces description and icon on the public DTO', () => {
    const tree = buildMenuTree([
      row({
        id: 'a',
        label: 'Web platforms',
        description: 'CMS-backed marketing sites and web apps',
        icon: 'globe',
      }),
    ]);
    expect(tree[0].description).toBe('CMS-backed marketing sites and web apps');
    expect(tree[0].icon).toBe('globe');
  });
});
