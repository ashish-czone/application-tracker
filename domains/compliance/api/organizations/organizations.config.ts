import { BadRequestException } from '@nestjs/common';
import { count } from 'drizzle-orm';
import type { DrizzleDB } from '@packages/database';
import { defineEntity, type EntityConfig } from '@packages/entity-engine';
import { organizations } from '../schema/organizations';

export interface OrganizationsEntityConfigDeps {
  /** Accessor for the drizzle client. Late-bound via the owning module so the
   *  config can be defined at module-definition time with a placeholder that
   *  resolves to the live client at request time. */
  getDb: () => DrizzleDB;
}

export function createOrganizationsEntityConfig(
  deps: OrganizationsEntityConfigDeps,
): EntityConfig<typeof organizations> {
  return defineEntity({
    table: organizations,
    slug: 'organization',
    singularName: 'Organization',
    pluralName: 'Organization',
    onDelete: { mode: 'restrict' },
    timestamps: true,

    hooks: {
      beforeCreate: async (payload) => {
        const [{ count: rowCount }] = await deps.getDb()
          .select({ count: count() })
          .from(organizations);
        if (rowCount > 0) {
          throw new BadRequestException(
            'Organization is a singleton — only one row may exist. Update the existing one instead.',
          );
        }
        return payload;
      },
      beforeDelete: async () => {
        throw new BadRequestException('The organization record cannot be deleted.');
      },
    },

    fields: {
      name: {
        type: 'text',
        label: 'Name',
        required: true,
        isLabel: true,
      },
      legalName: {
        type: 'text',
        label: 'Legal Name',
      },
      logoUrl: {
        type: 'file',
        label: 'Logo',
      },
      email: {
        type: 'email',
        label: 'Email',
      },
      phone: {
        type: 'phone',
        label: 'Phone',
      },
      website: {
        type: 'url',
        label: 'Website',
      },
      taxRegistration: {
        type: 'text',
        label: 'Tax Registration',
      },
      fiscalYearStart: {
        type: 'picklist',
        label: 'Fiscal Year Start',
        options: [
          { value: '1', label: 'January' },
          { value: '2', label: 'February' },
          { value: '3', label: 'March' },
          { value: '4', label: 'April' },
          { value: '5', label: 'May' },
          { value: '6', label: 'June' },
          { value: '7', label: 'July' },
          { value: '8', label: 'August' },
          { value: '9', label: 'September' },
          { value: '10', label: 'October' },
          { value: '11', label: 'November' },
          { value: '12', label: 'December' },
        ],
      },
      addressLine1: {
        type: 'text',
        label: 'Address Line 1',
      },
      addressLine2: {
        type: 'text',
        label: 'Address Line 2',
      },
      city: {
        type: 'text',
        label: 'City',
      },
      state: {
        type: 'text',
        label: 'State / Province',
      },
      postalCode: {
        type: 'text',
        label: 'Postal Code',
      },
      countryId: {
        type: 'category',
        label: 'Country',
        categoryGroupSlug: 'countries',
      },
    },

    sections: [
      {
        name: 'Organization',
        fields: [
          'name',
          'legalName',
          'logoUrl',
          'email',
          'phone',
          'website',
          'taxRegistration',
          'fiscalYearStart',
        ],
      },
      {
        name: 'Address',
        fields: ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'countryId'],
      },
    ],

    ui: {
      icon: 'Building',
      createMode: 'page',
    },
  });
}
