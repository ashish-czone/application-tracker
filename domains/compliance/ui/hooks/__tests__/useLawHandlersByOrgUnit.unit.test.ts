import { describe, it, expect } from 'vitest';
import {
  joinLawHandlersWithLaws,
  type LawHandlerRow,
  type LawRow,
} from '../useLawHandlersByOrgUnit';

const laws: LawRow[] = [
  { id: 'law-gst', code: 'GST', name: 'Goods & Services Tax' },
  { id: 'law-tds', code: 'TDS', name: 'Tax Deducted at Source' },
];

describe('joinLawHandlersWithLaws', () => {
  it('joins handlers with laws by lawId', () => {
    const handlers: LawHandlerRow[] = [
      { id: 'lh-1', lawId: 'law-gst', orgEntityId: 'org-1', clientId: null, isPrimary: true },
    ];
    const result = joinLawHandlersWithLaws(handlers, laws);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'lh-1',
      lawId: 'law-gst',
      lawCode: 'GST',
      lawName: 'Goods & Services Tax',
      isPrimary: true,
      isGlobal: true,
    });
  });

  it('marks per-client overrides as not global', () => {
    const handlers: LawHandlerRow[] = [
      { id: 'lh-2', lawId: 'law-tds', orgEntityId: 'org-1', clientId: 'cli-9', isPrimary: false },
    ];
    const [row] = joinLawHandlersWithLaws(handlers, laws);
    expect(row.isGlobal).toBe(false);
    expect(row.isPrimary).toBe(false);
  });

  it('falls back to placeholder text when the law row is missing', () => {
    const handlers: LawHandlerRow[] = [
      { id: 'lh-3', lawId: 'law-missing', orgEntityId: 'org-1', clientId: null, isPrimary: false },
    ];
    const [row] = joinLawHandlersWithLaws(handlers, []);
    expect(row.lawCode).toBe('—');
    expect(row.lawName).toBe('Unknown law');
  });

  it('returns an empty array when there are no handlers', () => {
    expect(joinLawHandlersWithLaws([], laws)).toEqual([]);
  });
});
