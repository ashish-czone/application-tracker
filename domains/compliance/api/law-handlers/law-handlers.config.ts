import { defineEntity } from '@packages/entity-engine';
import { complianceLawHandlers } from '../schema/law-handlers';

export const LAW_HANDLERS_CONFIG = defineEntity({
  table: complianceLawHandlers,
  slug: 'compliance_law_handlers',
  singularName: 'Law Handler',
  pluralName: 'Law Handlers',
  softDelete: false,
  timestamps: true,

  fields: {
    lawId: {
      type: 'belongsTo',
      label: 'Law',
      entity: 'laws',
      required: true,
      lookupLabelField: 'name',
      lookupSearchFields: ['name', 'code'],
      listVisible: true,
      listOrder: 1,
    },
    orgEntityId: {
      type: 'belongsTo',
      label: 'Handler Org Unit',
      entity: 'org_units',
      required: true,
      lookupLabelField: 'name',
      lookupSearchFields: ['name'],
      listVisible: true,
      listOrder: 2,
    },
    clientId: {
      type: 'belongsTo',
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

  defaultSort: 'lawId',

  sections: [
    {
      name: 'Handler',
      fields: ['lawId', 'orgEntityId', 'clientId', 'isPrimary'],
    },
  ],

  ui: {
    icon: 'Users',
    navGroup: 'compliance',
    navOrder: 4,
    createMode: 'modal',
  },
});
