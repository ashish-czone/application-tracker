import { describe, it, expect, vi } from 'vitest';
import { resolveLookupValues } from '../helpers/resolveLookupValues';
import type { FieldDefinition } from '@packages/eav-attributes-ui';
import type { FieldUI } from '../types';

const apiFn = {
  get: vi.fn(),
  post: vi.fn(),
};

function field(key: string, fieldType: FieldDefinition['fieldType'] = 'lookup'): FieldDefinition {
  return {
    id: `synthetic:test:${key}`,
    entityType: 'test',
    fieldKey: key,
    label: key,
    fieldType,
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
    nestedPath: null,
  };
}

describe('resolveLookupValues', () => {
  it('passes data through unchanged when no FieldUI configures lookupResolveValue', async () => {
    const data = { clientId: 'company-1', name: 'Acme' };
    const fields = [field('clientId'), field('name', 'text')];
    const getFieldUI = vi.fn<(et: string, fk: string) => FieldUI | undefined>().mockReturnValue(undefined);

    const out = await resolveLookupValues(data, fields, apiFn, getFieldUI, 'job_openings');

    expect(out).toEqual(data);
  });

  it('runs the resolver for fields with lookupResolveValue and rewrites the value', async () => {
    const data = { clientId: 'company-1' };
    const fields = [field('clientId')];
    const resolver = vi.fn().mockResolvedValue({ label: 'Acme Corp', value: 'recruit-client-99' });
    const getFieldUI = vi.fn<(et: string, fk: string) => FieldUI | undefined>().mockImplementation((_et, fk) =>
      fk === 'clientId' ? { lookupResolveValue: resolver } : undefined,
    );

    const out = await resolveLookupValues(data, fields, apiFn, getFieldUI, 'job_openings');

    expect(resolver).toHaveBeenCalledWith(apiFn, { label: '', value: 'company-1' });
    expect(out.clientId).toBe('recruit-client-99');
  });

  it('skips fields whose value is null, undefined, or empty string', async () => {
    const data = { clientId: '', otherId: null };
    const fields = [field('clientId'), field('otherId')];
    const resolver = vi.fn();
    const getFieldUI = vi.fn().mockReturnValue({ lookupResolveValue: resolver });

    await resolveLookupValues(data, fields, apiFn, getFieldUI, 'job_openings');

    expect(resolver).not.toHaveBeenCalled();
  });

  it('does not mutate the input object', async () => {
    const data = { clientId: 'company-1' };
    const fields = [field('clientId')];
    const resolver = vi.fn().mockResolvedValue({ label: 'X', value: 'rc-1' });
    const getFieldUI = vi.fn().mockReturnValue({ lookupResolveValue: resolver });

    const out = await resolveLookupValues(data, fields, apiFn, getFieldUI, 'job_openings');

    expect(data.clientId).toBe('company-1');
    expect(out).not.toBe(data);
  });
});
