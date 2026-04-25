import { users } from '@packages/database';
import { defineEntity, type EntityConfig } from '@packages/entity-engine';

export type UserStatus = 'active' | 'invited' | 'deactivated';

/**
 * Derive the read-side status from the three timestamps on the users row.
 * Precedence: deletedAt beats invitedAt, and an invitation that has been
 * accepted (acceptedAt set) transitions into the active bucket.
 */
export function deriveUserStatus(row: Record<string, unknown>): UserStatus {
  if (row.deletedAt) return 'deactivated';
  if (row.invitedAt && !row.acceptedAt) return 'invited';
  return 'active';
}

/** A single org-unit membership expressed as a user position. Kept as a plain
 *  structural type so `@packages/users` doesn't pick up an org-units dependency. */
export interface UserPosition {
  unitId: string;
  unitName: string;
  positionId: string | null;
  positionName: string | null;
}

/** Optional batch reader for list/detail position enrichment. Apps that don't
 *  wire it up simply get `positions: []` on every row. Supplied by any app that
 *  has an org-units-style membership table (e.g. `@apps/compliance`). */
export interface UsersPositionsReader {
  getPositionsByUserIds(userIds: string[]): Promise<Record<string, UserPosition[]>>;
}

/**
 * Static users entity config. The DTO shape expected on the write path is:
 *
 * ```json
 * {
 *   "email": "...", "firstName": "...", "lastName": "...", "userType": "...",
 *   "credentials": { "password": "..." },
 *   "roles": ["role-id-1", "role-id-2"]
 * }
 * ```
 *
 * `credentials` and `roles` are nested relationship payloads — UsersService
 * owns the full write path and composes the credentials + role assignments
 * with the users row insert in a single tx (see services/users.service).
 *
 * Read-side enrichment (roles, positions, derived status) is applied by
 * `UsersService.list` / `UsersService.findOne` after the engine returns —
 * see that service for the enrichment wiring.
 */
export const USERS_CONFIG: EntityConfig<typeof users> = defineEntity({
  table: users,
  slug: 'users',
  singularName: 'User',
  pluralName: 'Users',
  onDelete: { mode: 'soft' },
  timestamps: true,

  fields: {
    email: {
      type: 'email',
      label: 'Email',
      required: true,
      unique: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
    },
    firstName: {
      type: 'text',
      label: 'First Name',
      required: true,
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
    },
    lastName: {
      type: 'text',
      label: 'Last Name',
      required: true,
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 3,
    },
    phone: {
      type: 'phone',
      label: 'Phone',
      listVisible: true,
      listOrder: 4,
    },
    userType: {
      type: 'text',
      label: 'User Type',
      required: true,
      listVisible: true,
      listOrder: 5,
    },
  },

  defaultSort: 'firstName',

  sections: [
    {
      name: 'User',
      fields: ['email', 'firstName', 'lastName', 'phone', 'userType'],
    },
  ],

  relationships: [
    {
      name: 'credentials',
      type: 'hasOne',
      targetEntity: 'credentials',
      foreignKey: 'userId',
      label: 'Password',
      nestedFields: [
        {
          fieldKey: 'password',
          label: 'Password',
          fieldType: 'text',
          uiType: 'password',
          isRequired: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'roles',
      type: 'manyToMany',
      targetEntity: 'roles',
      junctionEntity: 'user_roles',
      label: 'Roles',
    },
  ],

  ui: {
    icon: 'User',
    navGroup: 'admin',
    navOrder: 10,
    createMode: 'page',
    subtitleField: 'email',
  },
});
