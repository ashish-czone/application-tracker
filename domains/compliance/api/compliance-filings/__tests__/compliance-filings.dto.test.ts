import { describe, it, expect } from 'vitest';
import {
  CreateComplianceFilingSchema,
  FilingsListQuerySchema,
} from '../compliance-filings.dto';

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

describe('FilingsListQuerySchema — limits + page', () => {
  it('applies the default limit (20) when none is supplied', () => {
    expect(FilingsListQuerySchema.parse({}).limit).toBe(20);
  });

  it('caps a high limit at 100 (data-fetching rule)', () => {
    expect(FilingsListQuerySchema.parse({ limit: 5000 }).limit).toBe(100);
  });

  it('falls back to default for invalid limits', () => {
    expect(FilingsListQuerySchema.parse({ limit: 'NaN' }).limit).toBe(20);
    expect(FilingsListQuerySchema.parse({ limit: '-5' }).limit).toBe(20);
    expect(FilingsListQuerySchema.parse({ limit: 0 }).limit).toBe(20);
  });

  it('honours a small valid limit', () => {
    expect(FilingsListQuerySchema.parse({ limit: 5 }).limit).toBe(5);
  });

  it('coerces page to a number; missing page stays undefined (engine default)', () => {
    expect(FilingsListQuerySchema.parse({ page: '3' }).page).toBe(3);
    expect(FilingsListQuerySchema.parse({ page: 2 }).page).toBe(2);
    expect(FilingsListQuerySchema.parse({}).page).toBeUndefined();
  });
});

describe('FilingsListQuerySchema — sort', () => {
  it('parses sort=field:asc into split sort + order', () => {
    const out = FilingsListQuerySchema.parse({ sort: 'dueDate:asc' });
    expect(out.sort).toBe('dueDate');
    expect(out.order).toBe('asc');
  });

  it('parses sort=field:desc into split sort + order', () => {
    const out = FilingsListQuerySchema.parse({ sort: 'dueDate:desc' });
    expect(out.sort).toBe('dueDate');
    expect(out.order).toBe('desc');
  });

  it('still accepts separate sort and order params', () => {
    const out = FilingsListQuerySchema.parse({ sort: 'dueDate', order: 'asc' });
    expect(out.sort).toBe('dueDate');
    expect(out.order).toBe('asc');
  });
});

describe('FilingsListQuerySchema — booleans + enums', () => {
  it('honours includeDeleted only when string "true"', () => {
    expect(FilingsListQuerySchema.parse({ includeDeleted: 'true' }).includeDeleted).toBe(true);
    expect(FilingsListQuerySchema.parse({ includeDeleted: 'false' }).includeDeleted).toBe(false);
    expect(FilingsListQuerySchema.parse({}).includeDeleted).toBe(false);
  });

  it('coerces notCompleted from "true" string', () => {
    expect(FilingsListQuerySchema.parse({ notCompleted: 'true' }).notCompleted).toBe(true);
    expect(FilingsListQuerySchema.parse({ notCompleted: true }).notCompleted).toBe(true);
    expect(FilingsListQuerySchema.parse({ notCompleted: 'false' }).notCompleted).toBe(false);
  });

  it('validates bucket against the FilingBucket enum, dropping unknowns silently', () => {
    expect(FilingsListQuerySchema.parse({ bucket: 'overdue' }).bucket).toBe('overdue');
    expect(FilingsListQuerySchema.parse({ bucket: 'bogus' }).bucket).toBeUndefined();
  });

  it('splits status CSV into a string array', () => {
    expect(FilingsListQuerySchema.parse({ status: 'pending,in_progress' }).status).toEqual([
      'pending',
      'in_progress',
    ]);
  });
});

describe('FilingsListQuerySchema — passthrough', () => {
  it('preserves engine-known fields (clientId, lawId, ruleId, assigneeId, search)', () => {
    const out = FilingsListQuerySchema.parse({
      clientId: 'c1',
      lawId: 'l1',
      ruleId: 'r1',
      assigneeId: 'u1',
      assigneeTeamId: 't1',
      search: 'q1',
    });
    expect(out.clientId).toBe('c1');
    expect(out.lawId).toBe('l1');
    expect(out.ruleId).toBe('r1');
    expect(out.assigneeId).toBe('u1');
    expect(out.assigneeTeamId).toBe('t1');
    expect(out.search).toBe('q1');
  });
});
