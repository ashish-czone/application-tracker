import { describe, it, expect } from 'vitest';
import { interpolateValues } from '../interpolator';

describe('interpolateValues', () => {
  it('should interpolate Mustache templates in string values', () => {
    const result = interpolateValues(
      { dueDate: '{{payload.after.scheduledDate}}' },
      { payload: { after: { scheduledDate: '2026-04-15' } } },
    );

    expect(result).toEqual({ dueDate: '2026-04-15' });
  });

  it('should pass through non-template values unchanged', () => {
    const result = interpolateValues(
      { status: 'cancelled', count: 42, flag: true },
      {},
    );

    expect(result).toEqual({ status: 'cancelled', count: 42, flag: true });
  });

  it('should handle mixed template and static values', () => {
    const result = interpolateValues(
      { title: '{{payload.name}} follow-up', priority: 'high' },
      { payload: { name: 'John' } },
    );

    expect(result).toEqual({ title: 'John follow-up', priority: 'high' });
  });

  it('should render empty string for missing template variables', () => {
    const result = interpolateValues(
      { value: '{{missing}}' },
      {},
    );

    expect(result).toEqual({ value: '' });
  });

  it('should handle nested context paths', () => {
    const result = interpolateValues(
      { id: '{{event.entityId}}' },
      { event: { entityId: 'ent-123' } },
    );

    expect(result).toEqual({ id: 'ent-123' });
  });
});
