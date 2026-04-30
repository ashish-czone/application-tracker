import { describe, it, expect } from 'vitest';
import {
  projectLawHandler,
  type LawHandlerRow,
} from '../useLawHandlersByOrgUnit';

describe('projectLawHandler', () => {
  it('projects an embedded law-handler row to the UI assignment shape', () => {
    const handler: LawHandlerRow = {
      id: 'lh-1',
      lawId: 'law-gst',
      orgEntityId: 'org-1',
      clientId: null,
      isPrimary: true,
      lawCode: 'GST',
      lawName: 'Goods & Services Tax',
    };
    expect(projectLawHandler(handler)).toEqual({
      id: 'lh-1',
      lawId: 'law-gst',
      lawCode: 'GST',
      lawName: 'Goods & Services Tax',
      isPrimary: true,
      isGlobal: true,
    });
  });

  it('marks per-client overrides as not global', () => {
    const handler: LawHandlerRow = {
      id: 'lh-2',
      lawId: 'law-tds',
      orgEntityId: 'org-1',
      clientId: 'cli-9',
      isPrimary: false,
      lawCode: 'TDS',
      lawName: 'Tax Deducted at Source',
    };
    const result = projectLawHandler(handler);
    expect(result.isGlobal).toBe(false);
    expect(result.isPrimary).toBe(false);
  });

  it('falls back to placeholder text when the server omitted lawCode/lawName', () => {
    const handler: LawHandlerRow = {
      id: 'lh-3',
      lawId: 'law-missing',
      orgEntityId: 'org-1',
      clientId: null,
      isPrimary: false,
    };
    const result = projectLawHandler(handler);
    expect(result.lawCode).toBe('—');
    expect(result.lawName).toBe('Unknown law');
  });
});
