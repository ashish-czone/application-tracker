import { users } from '@packages/database';
import { defineEntity, type EntityConfig } from '@packages/entity-engine';
import type { RelationHandler } from '@packages/entity-engine-contract';

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

/** Minimal reader surface the users config needs from rbac for list/detail role
 *  enrichment. Keeping this a structural type (not `RbacService`) keeps
 *  `@packages/users` free of an rbac dependency at the config layer — rbac is
 *  still required by the owning module at wiring time. */
export interface UsersRolesReader {
  getRolesByUserIds(
    userIds: string[],
  ): Promise<Record<string, Array<{ id: string; name: string; userType: string | null }>>>;
}

export interface UsersEntityConfigDeps {
  /** Owns the users.credentials hasOne write path. Supplied by @packages/auth. */
  credentialsHandler: RelationHandler;
  /** Owns the users.roles manyToMany write path. Supplied by @packages/rbac. */
  rolesHandler: RelationHandler;
  /** Batch reader for list/detail role enrichment. Supplied by @packages/rbac.
   *  Optional so unit tests that don't exercise reads can omit it. */
  rolesReader?: UsersRolesReader;
}

/**
 * Dynamic users entity config. Built as a factory so the owning relation
 * handlers can be injected from their home packages (auth, rbac) at module
 * init time — keeps the package-boundary rule intact: users doesn't reach
 * into credentials or user_roles itself.
 *
 * The DTO shape expected on the write path is:
 *
 * ```json
 * {
 *   "email": "...", "firstName": "...", "lastName": "...", "userType": "...",
 *   "credentials": { "password": "..." },
 *   "roles": ["role-id-1", "role-id-2"]
 * }
 * ```
 *
 * `credentials.password` is stripped from the parent insert and handed to
 * CredentialsRelationHandler in the same tx. `roles` likewise goes to
 * UserRolesRelationHandler. See @packages/entity-engine/entity.service for
 * the write-path orchestration.
 *
 * Read-side enrichment: afterList / afterFindOne hooks batch-load roles via
 * the supplied reader so list rows and the detail response carry a `roles`
 * array without an N+1 per row.
 */
export function createUsersEntityConfig(deps: UsersEntityConfigDeps): EntityConfig<typeof users> {
  const rolesReader = deps.rolesReader;

  return defineEntity({
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
        handler: deps.credentialsHandler,
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
        handler: deps.rolesHandler,
      },
    ],

    hooks: {
      afterList: async (rows) => {
        if (rows.length === 0) return rows;
        const ids = rows.map((r) => r.id as string);
        const byUser = rolesReader ? await rolesReader.getRolesByUserIds(ids) : {};
        return rows.map((r) => ({
          ...r,
          roles: byUser[r.id as string] ?? [],
          status: deriveUserStatus(r),
        }));
      },
      afterFindOne: async (row) => {
        const id = row.id as string;
        const byUser = rolesReader ? await rolesReader.getRolesByUserIds([id]) : {};
        return {
          ...row,
          roles: byUser[id] ?? [],
          status: deriveUserStatus(row),
        };
      },
    },

    ui: {
      icon: 'User',
      navGroup: 'admin',
      navOrder: 10,
      createMode: 'page',
      subtitleField: 'email',
    },
  });
}
