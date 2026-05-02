import { defineFormLayout } from '@packages/entity-views-ui';

/**
 * Static form layout for compliance-rules edits. Replaces what
 * `useEntityLayout('compliance-rules')` used to fetch from
 * `GET /layouts/compliance-rules`. The workflow field (`status`) is
 * intentionally omitted — it's system-managed (transitions go through
 * `POST /:id/transition`, not the generic update endpoint).
 *
 * Field metadata is duplicated relative to `RULES_ENTITY` in
 * `domains/compliance/api/rules/rules.entity.ts`; that's the temporary
 * cost of the migration. When `defineEntity` is fully retired the api
 * side stops carrying form-presentation metadata and the duplication
 * dissolves.
 */
export const RULES_FORM_LAYOUT = defineFormLayout({
  entity: 'compliance-rules',
  sections: [
    {
      name: 'Rule',
      columns: 2,
      fields: [
        { fieldKey: 'code', label: 'Code', fieldType: 'text', isRequired: true },
        { fieldKey: 'name', label: 'Name', fieldType: 'text', isRequired: true },
        {
          fieldKey: 'lawId',
          label: 'Law',
          fieldType: 'lookup',
          isRequired: true,
          lookupEntity: 'laws',
        },
        { fieldKey: 'frequency', label: 'Frequency', fieldType: 'text', isRequired: true },
        { fieldKey: 'dueDayOfMonth', label: 'Due Day of Month', fieldType: 'number', isRequired: true },
        {
          fieldKey: 'dueMonthOffset',
          label: 'Due Month Offset',
          fieldType: 'number',
          isRequired: true,
          defaultValue: '0',
        },
        {
          fieldKey: 'gracePeriodDays',
          label: 'Grace Period (days)',
          fieldType: 'number',
          isRequired: true,
          defaultValue: '0',
        },
        {
          fieldKey: 'description',
          label: 'Description',
          fieldType: 'textarea',
          maxLength: 32000,
        },
      ],
    },
  ],
});
