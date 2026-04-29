import { describe, it, expect } from 'vitest';
import { syntheticToFieldDefinition } from '../helpers/useEntityLayout';
import type { SyntheticFieldSpec } from '../types';

describe('syntheticToFieldDefinition', () => {
  it('materializes a minimal text-field spec into a complete FieldDefinition', () => {
    const spec: SyntheticFieldSpec = {
      section: 'Basic',
      fieldKey: 'clientName',
      label: 'Client Name',
      fieldType: 'text',
    };
    const def = syntheticToFieldDefinition(spec, 'clients', 5);
    expect(def).toMatchObject({
      id: 'synthetic:clients:clientName',
      entityType: 'clients',
      fieldKey: 'clientName',
      label: 'Client Name',
      fieldType: 'text',
      sortOrder: 5,
      isSystem: false,
      isCustom: false,
      isRequired: false,
      columnName: null,
      picklistOptions: [],
    });
  });

  it('honors isRequired, maxLength, and defaultValue when set', () => {
    const def = syntheticToFieldDefinition(
      {
        section: 'Basic',
        fieldKey: 'industry',
        label: 'Industry',
        fieldType: 'text',
        isRequired: true,
        maxLength: 64,
        defaultValue: 'unknown',
      },
      'clients',
      0,
    );
    expect(def.isRequired).toBe(true);
    expect(def.maxLength).toBe(64);
    expect(def.defaultValue).toBe('unknown');
  });

  it('materializes picklistOptions with synthetic ids and increasing sortOrder', () => {
    const def = syntheticToFieldDefinition(
      {
        section: 'Basic',
        fieldKey: 'industry',
        label: 'Industry',
        fieldType: 'picklist',
        picklistOptions: [
          { label: 'Tech', value: 'tech', isDefault: true },
          { label: 'Finance', value: 'finance' },
        ],
      },
      'clients',
      0,
    );
    expect(def.picklistOptions).toHaveLength(2);
    expect(def.picklistOptions[0]).toMatchObject({
      id: 'synthetic:clients:industry:tech',
      fieldId: 'synthetic:clients:industry',
      label: 'Tech',
      value: 'tech',
      isDefault: true,
      sortOrder: 0,
    });
    expect(def.picklistOptions[1]).toMatchObject({
      label: 'Finance',
      value: 'finance',
      isDefault: false,
      sortOrder: 1,
    });
  });

  it('passes lookupEntity through for fieldType=lookup specs', () => {
    const def = syntheticToFieldDefinition(
      {
        section: 'Basic',
        fieldKey: 'companyId',
        label: 'Company',
        fieldType: 'lookup',
        lookupEntity: 'companies',
      },
      'clients',
      0,
    );
    expect(def.lookupEntity).toBe('companies');
    expect(def.fieldType).toBe('lookup');
  });
});
