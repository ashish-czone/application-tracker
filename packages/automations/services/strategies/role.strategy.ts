import { DatabaseService, eq } from '@packages/database';
import { userRoles } from '@packages/rbac';
import type { UserResolution } from '../../types';
import type { UserResolverStrategy, UserResolutionContext } from '../user-resolver-registry';

/**
 * Resolves all users with a specific role.
 *
 * Config: { roleId: 'role-uuid' }
 */
export class RoleStrategy implements UserResolverStrategy {
  readonly type = 'role';
  readonly label = 'Users with Role';
  readonly configSchema = {
    roleId: { type: 'string', required: true, label: 'Role' },
  };

  constructor(private readonly database: DatabaseService) {}

  async resolve(resolution: UserResolution, _context: UserResolutionContext): Promise<string[]> {
    const roleId = resolution.config?.roleId as string | undefined;
    if (!roleId) return [];

    const rows = await this.database.db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));

    return rows.map((r) => r.userId);
  }
}
