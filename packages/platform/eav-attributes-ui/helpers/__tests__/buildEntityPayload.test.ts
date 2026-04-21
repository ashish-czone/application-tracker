import { describe, it, expect } from 'vitest';
import { buildEntityPayload } from '../buildEntityPayload';
import type { FieldDefinition, FullLayout, LayoutSection } from '../../types';

function field(
  overrides: Partial<FieldDefinition> & {
    fieldKey: string;
    fieldType?: FieldDefinition['fieldType'];
  },
): FieldDefinition {
  return {
    id: `f-${overrides.fieldKey}`,
    entityType: 'users',
    fieldKey: overrides.fieldKey,
    label: overrides.fieldKey,
    fieldType: overrides.fieldType ?? 'text',
    uiType: null,
    isRequired: false,
    isSystem: false,
    isCustom: false,
    isUnique: false,
    isQuickCreate: false,
    isReadonly: false,
    maxLength: null,
    defaultValue: null,
    columnName: null,
    lookupEntity: null,
    lookupLabelField: null,
    lookupSearchFields: null,
    tagGroupSlug: null,
    categoryGroupSlug: null,
    fileAccept: null,
    fileMaxSize: null,
    sortOrder: 0,
    picklistOptions: [],
    columnIndex: 0,
    ...overrides,
  };
}

function section(fields: FieldDefinition[]): LayoutSection {
  return {
    id: 's-1',
    name: 'Main',
    columns: 1,
    sortOrder: 0,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields,
  };
}

function layout(fields: FieldDefinition[]): FullLayout {
  return {
    entityType: 'users',
    layoutName: 'default',
    sections: [section(fields)],
    relationSections: [],
    quickCreateFields: [],
  };
}

describe('buildEntityPayload', () => {
  it('passes top-level fields through unchanged', () => {
    const l = layout([
      field({ fieldKey: 'email', fieldType: 'email' }),
      field({ fieldKey: 'firstName' }),
    ]);
    const out = buildEntityPayload({ email: 'a@b.com', firstName: 'Ada' }, l);
    expect(out).toEqual({ email: 'a@b.com', firstName: 'Ada' });
  });

  it('wraps fields with nestedPath under their relation name', () => {
    const l = layout([
      field({ fieldKey: 'email' }),
      field({ fieldKey: 'password', nestedPath: 'credentials' }),
    ]);
    const out = buildEntityPayload({ email: 'a@b.com', password: 'secret' }, l);
    expect(out).toEqual({ email: 'a@b.com', credentials: { password: 'secret' } });
  });

  it('groups multiple nested fields under the same relation bucket', () => {
    const l = layout([
      field({ fieldKey: 'email' }),
      field({ fieldKey: 'password', nestedPath: 'credentials' }),
      field({ fieldKey: 'mfaSecret', nestedPath: 'credentials' }),
    ]);
    const out = buildEntityPayload(
      { email: 'a@b.com', password: 'p', mfaSecret: 'm' },
      l,
    );
    expect(out).toEqual({
      email: 'a@b.com',
      credentials: { password: 'p', mfaSecret: 'm' },
    });
  });

  it('drops empty strings', () => {
    const l = layout([field({ fieldKey: 'email' }), field({ fieldKey: 'phone' })]);
    const out = buildEntityPayload({ email: 'a@b.com', phone: '' }, l);
    expect(out).toEqual({ email: 'a@b.com' });
    expect('phone' in out).toBe(false);
  });

  it('drops undefined values', () => {
    const l = layout([field({ fieldKey: 'email' }), field({ fieldKey: 'phone' })]);
    const out = buildEntityPayload({ email: 'a@b.com', phone: undefined }, l);
    expect(out).toEqual({ email: 'a@b.com' });
  });

  it('preserves null, false, 0, and empty arrays', () => {
    const l = layout([
      field({ fieldKey: 'dob', fieldType: 'date' }),
      field({ fieldKey: 'active', fieldType: 'boolean' }),
      field({ fieldKey: 'count', fieldType: 'number' }),
    ]);
    const out = buildEntityPayload(
      { dob: null, active: false, count: 0, roles: [] },
      l,
    );
    expect(out).toEqual({ dob: null, active: false, count: 0, roles: [] });
  });

  it('omits a nested bucket when every field in it is empty', () => {
    const l = layout([
      field({ fieldKey: 'email' }),
      field({ fieldKey: 'password', nestedPath: 'credentials' }),
    ]);
    const out = buildEntityPayload({ email: 'a@b.com', password: '' }, l);
    expect(out).toEqual({ email: 'a@b.com' });
    expect('credentials' in out).toBe(false);
  });

  it('emits a nested bucket when at least one field in it has a value', () => {
    const l = layout([
      field({ fieldKey: 'password', nestedPath: 'credentials' }),
      field({ fieldKey: 'mfaSecret', nestedPath: 'credentials' }),
    ]);
    const out = buildEntityPayload({ password: 'p', mfaSecret: '' }, l);
    expect(out).toEqual({ credentials: { password: 'p' } });
  });

  it('passes through keys not present in the layout (e.g. relationSections)', () => {
    const l = layout([field({ fieldKey: 'email' })]);
    const out = buildEntityPayload(
      { email: 'a@b.com', roles: ['r1', 'r2'] },
      l,
    );
    expect(out).toEqual({ email: 'a@b.com', roles: ['r1', 'r2'] });
  });

  it('collects nested fields from fields across multiple sections', () => {
    const l: FullLayout = {
      entityType: 'users',
      layoutName: 'default',
      sections: [
        section([field({ fieldKey: 'email' })]),
        {
          ...section([field({ fieldKey: 'password', nestedPath: 'credentials' })]),
          id: 's-2',
          name: 'Auth',
        },
      ],
      relationSections: [],
      quickCreateFields: [],
    };
    const out = buildEntityPayload({ email: 'a@b.com', password: 'p' }, l);
    expect(out).toEqual({
      email: 'a@b.com',
      credentials: { password: 'p' },
    });
  });

  it('returns an empty object when given no values', () => {
    const l = layout([field({ fieldKey: 'email' })]);
    expect(buildEntityPayload({}, l)).toEqual({});
  });
});
