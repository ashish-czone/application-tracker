import { defineEntity } from '@packages/entity-engine';
import { teamMembers } from './schema/team-members';

export const TEAM_MEMBERS_CONFIG = defineEntity({
  table: teamMembers,
  slug: 'team-members',
  singularName: 'Team Member',
  pluralName: 'Team Members',
  onDelete: { mode: 'soft' },
  timestamps: true,
  adminConfigurable: true,

  fields: {
    fullName: {
      type: 'text',
      label: 'Full Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    role: {
      type: 'text',
      label: 'Role',
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    bio: {
      type: 'textarea',
      label: 'Bio',
      searchable: true,
    },
    photoUrl: {
      type: 'file',
      label: 'Photo',
      accept: ['image/*'],
    },
    linkedinUrl: {
      type: 'url',
      label: 'LinkedIn URL',
    },
    email: {
      type: 'email',
      label: 'Email',
    },
    displayOrder: {
      type: 'number',
      label: 'Display Order',
      sortable: true,
    },
    isActive: {
      type: 'boolean',
      label: 'Active',
      listVisible: true,
      listOrder: 3,
    },
  },

  defaultSort: 'displayOrder',

  ui: {
    icon: 'Users',
    navGroup: 'Content',
    groupRenderMode: 'tabs',
    navOrder: 30,
    createMode: 'modal',
  },
});
