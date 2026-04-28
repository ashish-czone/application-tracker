import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { SectionData } from '@domains/agency-contract';
import { blockRegistry } from '../../components/blocks/registry';
import { registerStarterBlocks, starterBlocks } from '../../components/blocks/starter';
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

  it('registers the full starter set (F4 + F4.4 blocks)', () => {
    expect(starterBlocks.map((b) => b.kind).sort()).toEqual([
      'case-study-grid',
      'contact-form-placeholder',
      'cta',
      'feature-list',
      'hero',
      'image',
      'pricing',
      'process-timeline',
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

  it('ProcessTimeline renders numbered steps from "Title :: Description" lines', () => {
    const html = markup([
      section({
        id: 's1',
        order: 0,
        blockKind: 'process-timeline',
        customFields: {
          heading: 'How we work',
          steps:
            'Discover :: Kickoff workshop\nDesign :: Wireframes to hi-fi\nBuild :: Engineering sprints\nLaunch',
        },
      }),
    ]);
    expect(html).toContain('How we work');
    expect(html).toContain('Discover');
    expect(html).toContain('Kickoff workshop');
    expect(html).toContain('Design');
    expect(html).toContain('Build');
    expect(html).toContain('Launch');
    // Numbered 01..04
    expect(html).toContain('01');
    expect(html).toContain('04');
  });

  it('CaseStudyGrid renders each entry; drops malformed rows', () => {
    const html = markup([
      section({
        id: 's1',
        order: 0,
        blockKind: 'case-study-grid',
        customFields: {
          entries:
            'Brightline :: Freight tracking :: /work/brightline :: /img/a.jpg\nNorthshore :: HIPAA portal\nDanglingRowWithNoTitle',
        },
      }),
    ]);
    expect(html).toContain('Brightline');
    expect(html).toContain('Freight tracking');
    expect(html).toContain('href="/work/brightline"');
    expect(html).toContain('src="/img/a.jpg"');
    expect(html).toContain('Northshore');
    expect(html).toContain('HIPAA portal');
    expect(html).not.toContain('DanglingRowWithNoTitle');
  });

  it('Pricing parses tiers, marks featured, renders CTA row', () => {
    const html = markup([
      section({
        id: 's1',
        order: 0,
        blockKind: 'pricing',
        customFields: {
          tiers:
            'Starter\n$49/mo\nUnlimited projects\nEmail support\nGet started :: /signup\n\nPro (recommended)\n$99/mo\nEverything in Starter\nDedicated manager\nStart trial :: /signup?plan=pro',
        },
      }),
    ]);
    expect(html).toContain('Starter');
    expect(html).toContain('$49/mo');
    expect(html).toContain('Unlimited projects');
    expect(html).toContain('Email support');
    expect(html).toContain('Get started');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('Pro');
    expect(html).toContain('Recommended');
    expect(html).not.toContain('(recommended)');
    expect(html).toContain('$99/mo');
    expect(html).toContain('Dedicated manager');
    expect(html).toContain('href="/signup?plan=pro"');
  });

  it('ContactFormPlaceholder renders disabled fields with heading', () => {
    const html = markup([
      section({
        id: 's1',
        order: 0,
        blockKind: 'contact-form-placeholder',
        customFields: { heading: 'Talk to us', subheading: 'We reply within a day.' },
      }),
    ]);
    expect(html).toContain('Talk to us');
    expect(html).toContain('We reply within a day.');
    expect(html).toContain('placeholder="Your full name"');
    expect(html).toContain('placeholder="you@example.com"');
    expect(html).toContain('Send message');
    expect(html).toContain('disabled');
  });
});
