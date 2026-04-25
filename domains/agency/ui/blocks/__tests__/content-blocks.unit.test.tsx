import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { blockRegistry } from '../registry';
import { PageRenderer } from '../PageRenderer';
import type { SectionData } from '@domains/agency-contract';
import {
  contentBlocks,
  registerContentBlocks,
  testimonialsGridBlock,
  faqAccordionBlock,
  teamGridBlock,
  servicesGridBlock,
  clientLogosRowBlock,
  valuePropsGridBlock,
  statsRowBlock,
} from '../components/content';

function section(overrides: Partial<SectionData> & Pick<SectionData, 'blockKind'>): SectionData {
  return {
    id: overrides.id ?? 's1',
    order: overrides.order ?? 0,
    blockKind: overrides.blockKind,
    variant: overrides.variant ?? null,
    title: overrides.title ?? null,
    customFields: overrides.customFields ?? {},
    data: overrides.data ?? {},
  };
}

describe('content blocks', () => {
  beforeEach(() => {
    blockRegistry.clear();
  });

  it('registerContentBlocks() adds every block under kind + supports its default entity', () => {
    registerContentBlocks();
    expect(blockRegistry.get('testimonials-grid')?.supports).toEqual(['testimonials']);
    expect(blockRegistry.get('faq-accordion')?.supports).toEqual(['faq-items']);
    expect(blockRegistry.get('team-grid')?.supports).toEqual(['team-members']);
    expect(blockRegistry.get('services-grid')?.supports).toEqual(['services']);
    expect(blockRegistry.get('client-logos-row')?.supports).toEqual(['client-logos']);
    expect(blockRegistry.get('value-props-grid')?.supports).toEqual(['value-props']);
    expect(blockRegistry.get('stats-row')?.supports).toEqual(['stats']);
    expect(contentBlocks).toHaveLength(7);
  });

  it('every content block declares a category of "Content"', () => {
    for (const b of contentBlocks) expect(b.category).toBe('Content');
  });

  it('every block exposes a stable kind (snapshot for migration detection)', () => {
    expect(contentBlocks.map((b) => b.kind)).toEqual([
      'testimonials-grid',
      'faq-accordion',
      'team-grid',
      'services-grid',
      'client-logos-row',
      'value-props-grid',
      'stats-row',
    ]);
  });

  it('TestimonialsGrid renders one card per item with author + quote visible', () => {
    blockRegistry.register(testimonialsGridBlock);
    const html = renderToString(
      createElement(PageRenderer, {
        sections: [
          section({
            blockKind: 'testimonials-grid',
            title: 'What people say',
            data: {
              items: [
                {
                  id: 't1',
                  quote: 'Amazing',
                  authorName: 'Alice',
                  authorRole: 'CTO',
                  companyName: 'Acme',
                  avatarUrl: null,
                  companyLogoUrl: null,
                },
              ],
            },
          }),
        ],
      }),
    );
    expect(html).toContain('What people say');
    expect(html).toContain('Amazing');
    expect(html).toContain('Alice');
  });

  it('FaqAccordion renders each question inside a <details> element', () => {
    blockRegistry.register(faqAccordionBlock);
    const html = renderToString(
      createElement(PageRenderer, {
        sections: [
          section({
            blockKind: 'faq-accordion',
            data: {
              items: [
                { id: 'f1', question: 'Why?', answer: 'Because.', category: null },
                { id: 'f2', question: 'How?', answer: 'Like this.', category: null },
              ],
            },
          }),
        ],
      }),
    );
    expect(html.match(/<details/g)?.length).toBe(2);
    expect(html).toContain('Why?');
    expect(html).toContain('Because.');
  });

  it('TeamGrid renders each member name', () => {
    blockRegistry.register(teamGridBlock);
    const html = renderToString(
      createElement(PageRenderer, {
        sections: [
          section({
            blockKind: 'team-grid',
            data: {
              members: [
                {
                  id: 'm1',
                  fullName: 'Bob',
                  role: 'Engineer',
                  bio: null,
                  photoUrl: null,
                  linkedinUrl: null,
                  email: null,
                },
              ],
            },
          }),
        ],
      }),
    );
    expect(html).toContain('Bob');
    expect(html).toContain('Engineer');
  });

  it('ServicesGrid renders each service name + CTA when present', () => {
    blockRegistry.register(servicesGridBlock);
    const html = renderToString(
      createElement(PageRenderer, {
        sections: [
          section({
            blockKind: 'services-grid',
            data: {
              services: [
                {
                  id: 's1',
                  name: 'Design',
                  description: 'We design',
                  iconName: null,
                  ctaText: 'Learn more',
                  ctaHref: '/design',
                },
              ],
            },
          }),
        ],
      }),
    );
    expect(html).toContain('Design');
    expect(html).toContain('Learn more');
    expect(html).toContain('/design');
  });

  it('ClientLogosRow renders img tags with alt text', () => {
    blockRegistry.register(clientLogosRowBlock);
    const html = renderToString(
      createElement(PageRenderer, {
        sections: [
          section({
            blockKind: 'client-logos-row',
            data: {
              logos: [
                { id: 'c1', name: 'Acme', logoUrl: '/acme.png', href: null },
                { id: 'c2', name: 'Globex', logoUrl: '/globex.png', href: 'https://globex.example' },
              ],
            },
          }),
        ],
      }),
    );
    expect(html).toContain('alt="Acme"');
    expect(html).toContain('/acme.png');
    expect(html).toContain('https://globex.example');
  });

  it('ValuePropsGrid renders title + description for each item', () => {
    blockRegistry.register(valuePropsGridBlock);
    const html = renderToString(
      createElement(PageRenderer, {
        sections: [
          section({
            blockKind: 'value-props-grid',
            data: {
              items: [
                { id: 'v1', title: 'Fast', description: 'Very fast', iconName: null },
              ],
            },
          }),
        ],
      }),
    );
    expect(html).toContain('Fast');
    expect(html).toContain('Very fast');
  });

  it('StatsRow formats numeric values and appends suffix', () => {
    blockRegistry.register(statsRowBlock);
    const html = renderToString(
      createElement(PageRenderer, {
        sections: [
          section({
            blockKind: 'stats-row',
            data: {
              stats: [{ id: 's1', label: 'Users', value: 10000, suffix: '+' }],
            },
          }),
        ],
      }),
    );
    expect(html).toContain('10,000+');
    expect(html).toContain('Users');
  });
});
