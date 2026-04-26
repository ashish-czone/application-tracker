import { describe, it, expect } from 'vitest';
import { CreateComplianceFilingSchema } from '../compliance-filings.dto';

const baseBody = {
  title: 'Q1 Filing',
  priority: 'medium',
  ruleId: 'r1',
  clientId: 'c1',
  lawId: 'l1',
  assigneeTeamId: 't1',
  periodStart: '2026-03-01',
  periodEnd: '2026-03-31',
};

describe('CreateComplianceFilingSchema — completedAt parsing', () => {
  it('parses a body without completedAt', () => {
    const out = CreateComplianceFilingSchema.parse(baseBody);
    expect(out.completedAt).toBeUndefined();
  });

  it('accepts an explicit null completedAt', () => {
    const out = CreateComplianceFilingSchema.parse({ ...baseBody, completedAt: null });
    expect(out.completedAt).toBeNull();
  });

  it('coerces an empty string to null', () => {
    const out = CreateComplianceFilingSchema.parse({ ...baseBody, completedAt: '' });
    expect(out.completedAt).toBeNull();
  });

  it('coerces an ISO 8601 string to a Date instance', () => {
    const iso = '2026-03-31T18:00:00.000Z';
    const out = CreateComplianceFilingSchema.parse({ ...baseBody, completedAt: iso });
    expect(out.completedAt).toBeInstanceOf(Date);
    expect((out.completedAt as Date).toISOString()).toBe(iso);
  });

  it('passes a Date instance through unchanged', () => {
    const d = new Date('2026-03-31T18:00:00.000Z');
    const out = CreateComplianceFilingSchema.parse({ ...baseBody, completedAt: d });
    expect(out.completedAt).toBeInstanceOf(Date);
    expect((out.completedAt as Date).toISOString()).toBe(d.toISOString());
  });

  it('rejects a malformed completedAt with a Zod error', () => {
    expect(() =>
      CreateComplianceFilingSchema.parse({ ...baseBody, completedAt: 'not-a-date' }),
    ).toThrow();
  });
});
