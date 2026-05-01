import { describe, expect, it } from 'vitest';
import { defineListLayout, defineDetailLayout } from '../index';

interface TestRule {
  id: string;
  code: string;
  name: string;
  status: string;
  lawId: string;
}

describe('defineListLayout', () => {
  it('returns the input unchanged (typed factory)', () => {
    const input = {
      entity: 'compliance-rules',
      columns: [{ field: 'code' as const, label: 'Code' }],
    };
    expect(defineListLayout<TestRule>(input)).toBe(input);
  });

  it('preserves all column metadata', () => {
    const layout = defineListLayout<TestRule>({
      entity: 'compliance-rules',
      defaultSort: { field: 'code', order: 'asc' },
      defaultPageSize: 50,
      columns: [
        { field: 'code', label: 'Code', cell: 'text', searchable: true, sortable: true, width: 120 },
        { field: 'name', label: 'Name', cell: 'text', isLabel: true },
        {
          field: 'lawId',
          label: 'Law',
          cell: 'lookup',
          lookup: { entity: 'laws', labelField: 'name' },
        },
        { field: 'status', label: 'Status', cell: 'workflow', workflowSlug: 'rule-status' },
      ],
    });

    expect(layout.columns).toHaveLength(4);
    expect(layout.columns[2].lookup).toEqual({ entity: 'laws', labelField: 'name' });
    expect(layout.columns[3].workflowSlug).toBe('rule-status');
    expect(layout.defaultSort).toEqual({ field: 'code', order: 'asc' });
    expect(layout.defaultPageSize).toBe(50);
  });
});

describe('defineDetailLayout', () => {
  it('returns the input unchanged', () => {
    const input = {
      entity: 'compliance-rules',
      sections: [{ title: 'Identity', fields: ['code' as const, 'name' as const] }],
    };
    expect(defineDetailLayout<TestRule>(input)).toBe(input);
  });
});
