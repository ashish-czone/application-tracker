import { defineEntity } from '@packages/entity-engine';
import { complianceLawHandlers } from './law-handlers.schema';

export const LAW_HANDLERS_CONFIG = defineEntity({
  table: complianceLawHandlers,
  slug: 'law-handlers',
  timestamps: true,

  fields: {
    lawId: {
      type: 'lookup',
      label: 'Law',
      entity: 'laws',
      required: true,
      lookupLabelField: 'name',
      lookupSearchFields: ['name', 'code'],
      listVisible: true,
      listOrder: 1,
    },
    orgEntityId: {
      type: 'lookup',
      label: 'Handler Org Unit',
      entity: 'org_units',
      required: true,
      lookupLabelField: 'name',
      lookupSearchFields: ['name'],
      listVisible: true,
      listOrder: 2,
    },
    clientId: {
      type: 'lookup',
      label: 'Client (optional override)',
      entity: 'clients',
      lookupLabelField: 'name',
      lookupSearchFields: ['name'],
      listVisible: true,
      listOrder: 3,
    },
    isPrimary: {
      type: 'boolean',
      label: 'Primary Handler',
      defaultValue: 'false',
      listVisible: true,
      listOrder: 4,
    },
  },

  relationships: [
    { name: 'law', type: 'belongsTo', foreignKey: 'lawId', targetEntity: 'laws', label: 'Law' },
    { name: 'orgEntity', type: 'belongsTo', foreignKey: 'orgEntityId', targetEntity: 'org_units', label: 'Handler Org Unit' },
    { name: 'client', type: 'belongsTo', foreignKey: 'clientId', targetEntity: 'clients', label: 'Client' },
  ],

  defaultSort: 'lawId',

  sections: [
    {
      name: 'Handler',
      fields: ['lawId', 'orgEntityId', 'clientId', 'isPrimary'],
    },
  ],
});
