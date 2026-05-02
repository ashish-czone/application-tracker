import { defineFormLayout } from '@packages/entity-views-ui';

/**
 * Static form layout for compliance-rules edits. Single source of truth
 * for rules' form presentation; the api side (`rules.service.ts` +
 * `rules.schema.ts`) carries the data shape, the workflow def,
 * validation, and CRUD wiring but no form-layout metadata after
 * `rules.entity.ts` was retired in the workflow-lift effort.
 *
 * The workflow field (`status`) is intentionally omitted — it's
 * system-managed (transitions go through `POST /:id/transition`, not
 * the generic update endpoint).
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
