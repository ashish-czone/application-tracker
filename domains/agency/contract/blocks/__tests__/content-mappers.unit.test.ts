import { describe, it, expect, beforeEach } from 'vitest';
import { mapperRegistry } from '../registry';
import {
  contentMappers,
  registerContentMappers,
  testimonialsGridMapper,
  faqAccordionMapper,
  teamGridMapper,
  servicesGridMapper,
  clientLogosRowMapper,
  valuePropsGridMapper,
  statsRowMapper,
} from '../mappers';

describe('content mappers', () => {
  beforeEach(() => {
    mapperRegistry.clear();
  });

  it('registerContentMappers() adds every mapper to the singleton registry', () => {
    registerContentMappers();
    expect(mapperRegistry.has('testimonials', 'testimonials-grid')).toBe(true);
    expect(mapperRegistry.has('faq-items', 'faq-accordion')).toBe(true);
    expect(mapperRegistry.has('team-members', 'team-grid')).toBe(true);
    expect(mapperRegistry.has('services', 'services-grid')).toBe(true);
    expect(mapperRegistry.has('client-logos', 'client-logos-row')).toBe(true);
    expect(mapperRegistry.has('value-props', 'value-props-grid')).toBe(true);
    expect(mapperRegistry.has('stats', 'stats-row')).toBe(true);
    expect(contentMappers).toHaveLength(7);
  });

  it('testimonialsGridMapper reshapes records into { items }', () => {
    const out = testimonialsGridMapper.map([
      {
        id: 't1',
        quote: 'Great service',
        authorName: 'Alice',
        authorRole: 'CTO',
        companyName: 'Acme',
        avatarUrl: null,
        companyLogoUrl: null,
      },
    ]);
    expect(out.items).toEqual([
      {
        id: 't1',
        quote: 'Great service',
        authorName: 'Alice',
        authorRole: 'CTO',
        companyName: 'Acme',
        avatarUrl: null,
        companyLogoUrl: null,
      },
    ]);
  });

  it('faqAccordionMapper passes question + answer through', () => {
    const out = faqAccordionMapper.map([
      { id: 'f1', question: 'Why?', answer: 'Because.', category: 'general' },
    ]);
    expect(out.items[0]).toMatchObject({ question: 'Why?', answer: 'Because.', category: 'general' });
  });

  it('teamGridMapper reshapes into { members }', () => {
    const out = teamGridMapper.map([
      {
        id: 'm1',
        fullName: 'Bob',
        role: 'Engineer',
        bio: 'hi',
        photoUrl: null,
        linkedinUrl: null,
        email: null,
      },
    ]);
    expect(out.members).toHaveLength(1);
    expect(out.members[0].fullName).toBe('Bob');
  });

  it('servicesGridMapper reshapes into { services }', () => {
    const out = servicesGridMapper.map([
      {
        id: 's1',
        name: 'Design',
        description: 'We design',
        iconName: null,
        ctaText: null,
        ctaHref: null,
      },
    ]);
    expect(out.services[0]).toMatchObject({ name: 'Design', description: 'We design' });
  });

  it('clientLogosRowMapper reshapes into { logos }', () => {
    const out = clientLogosRowMapper.map([
      { id: 'c1', name: 'Acme', logoUrl: '/logo.png', href: null },
    ]);
    expect(out.logos[0]).toMatchObject({ name: 'Acme', logoUrl: '/logo.png' });
  });

  it('valuePropsGridMapper reshapes into { items }', () => {
    const out = valuePropsGridMapper.map([
      { id: 'v1', title: 'Fast', description: 'Very fast', iconName: 'zap' },
    ]);
    expect(out.items[0]).toMatchObject({ title: 'Fast', iconName: 'zap' });
  });

  it('statsRowMapper reshapes into { stats }', () => {
    const out = statsRowMapper.map([
      { id: 's1', label: 'Users', value: 10000, suffix: '+' },
    ]);
    expect(out.stats).toEqual([{ id: 's1', label: 'Users', value: 10000, suffix: '+' }]);
  });

  it('handles empty input arrays gracefully', () => {
    expect(testimonialsGridMapper.map([]).items).toEqual([]);
    expect(faqAccordionMapper.map([]).items).toEqual([]);
    expect(teamGridMapper.map([]).members).toEqual([]);
    expect(servicesGridMapper.map([]).services).toEqual([]);
    expect(clientLogosRowMapper.map([]).logos).toEqual([]);
    expect(valuePropsGridMapper.map([]).items).toEqual([]);
    expect(statsRowMapper.map([]).stats).toEqual([]);
  });
});
