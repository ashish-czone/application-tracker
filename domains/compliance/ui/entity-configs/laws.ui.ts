import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const LAWS_UI_CONFIG: EntityUIConfig = {
  entityType: 'laws',
  presentation: {
    singularName: 'Law',
    pluralName: 'Laws',
    icon: 'Scale',
    navGroup: 'compliance',
    navOrder: 1,
    createMode: 'modal',
  },
  fieldUI: {
    name: { label: 'Name' },
    code: { label: 'Code' },
    issuingAuthority: { label: 'Issuing Authority' },
    jurisdiction: { label: 'Jurisdiction' },
    effectiveFrom: { label: 'Effective From' },
    description: { label: 'Description' },
  },
  formLayout: {
    sections: [
      { name: 'Law', fields: ['name', 'code', 'issuingAuthority', 'jurisdiction', 'effectiveFrom', 'description'] },
    ],
  },
  listColumns: [
    { fieldKey: 'name', visible: true, order: 1 },
    { fieldKey: 'code', visible: true, order: 2 },
    { fieldKey: 'issuingAuthority', visible: true, order: 3 },
    { fieldKey: 'jurisdiction', visible: true, order: 4 },
  ],
};
