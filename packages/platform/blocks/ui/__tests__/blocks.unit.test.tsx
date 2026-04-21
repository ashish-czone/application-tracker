import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { SectionData } from '@packages/blocks-contract';
import { blockRegistry } from '../registry';
import { registerStarterBlocks, starterBlocks } from '../blocks';
import { PageRenderer } from '../PageRenderer';

function section(partial: Partial<SectionData> & Pick<SectionData, 'id' | 'order' | 'blockKind'>): SectionData {
  return { variant: null, title: null, customFields: {}, data: {}, ...partial };
}

function markup(sections: SectionData[]) {
  return renderToStaticMarkup(createElement(PageRenderer, { sections }));
}

describe('starter blocks', () => {
  beforeEach(() => {
    blockRegistry.clear();
    registerStarterBlocks();
  });

  it('registers hero, text, image, feature-list, cta', () => {
    expect(starterBlocks.map((b) => b.kind).sort()).toEqual([
      'cta',
      'feature-list',
      'hero',
      'image',
      'text',
    ]);
    for (const block of starterBlocks) {
      expect(blockRegistry.has(block.kind)).toBe(true);
    }
  });

  it('Hero renders headline + subheadline + cta', () => {
    const html = markup([
      section({
        id: 's1',
        order: 0,
        blockKind: 'hero',
        customFields: { headline: 'Hello', subheadline: 'World', ctaText: 'Start', ctaHref: '/start' },
      }),
    ]);
    expect(html).toContain('Hello');
    expect(html).toContain('World');
    expect(html).toContain('href="/start"');
    expect(html).toContain('Start');
  });

  it('Image block returns nothing when src is missing', () => {
    const html = markup([section({ id: 's1', order: 0, blockKind: 'image' })]);
    expect(html).toBe('');
  });

  it('FeatureList parses "title :: description" lines into list items', () => {
    const html = markup([
      section({
        id: 's1',
        order: 0,
        blockKind: 'feature-list',
        customFields: {
          heading: 'Why us',
          items: 'Fast :: Deploys in seconds\nCheap :: No hidden fees\nSecure',
        },
      }),
    ]);
    expect(html).toContain('Why us');
    expect(html).toContain('Fast');
    expect(html).toContain('Deploys in seconds');
    expect(html).toContain('Cheap');
    expect(html).toContain('Secure');
  });

  it('CTA renders primary and secondary buttons when both pairs are present', () => {
    const html = markup([
      section({
        id: 's1',
        order: 0,
        blockKind: 'cta',
        customFields: {
          heading: 'Ready?',
          primaryText: 'Start now',
          primaryHref: '/signup',
          secondaryText: 'Docs',
          secondaryHref: '/docs',
        },
      }),
    ]);
    expect(html).toContain('Start now');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('Docs');
    expect(html).toContain('href="/docs"');
  });

  it('Hero split variant renders image + copy side by side', () => {
    const html = markup([
      section({
        id: 's1',
        order: 0,
        blockKind: 'hero',
        variant: 'split',
        customFields: { headline: 'Split', imageUrl: 'https://x/img.png' },
      }),
    ]);
    expect(html).toContain('Split');
    expect(html).toContain('src="https://x/img.png"');
  });
});
