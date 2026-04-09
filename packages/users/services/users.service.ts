import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AuthService } from '@packages/auth';
import { RbacService, userRoles, roles } from '@packages/rbac';
import {
  DatabaseService,
  users,
  eq,
  and,
  or,
  isNull,
  ilike,
  inArray,
  asc,
  desc,
  count,
  sql,
} from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import type { PaginatedResponse } from '@packages/common';
import {
  USERS_USER_CREATED,
  USERS_USER_UPDATED,
  USERS_USER_DELETED,
  type UserSnapshot,
} from '../events/types';

export interface CreateUserInput {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  password: string;
  userType: string;
  roleIds: string[];
}

export interface UpdateUserInput {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  userType?: string;
  roleId?: string;
  sort?: 'firstName' | 'email' | 'createdAt';
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface UserWithType {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  userType: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  roles: { id: string; name: string }[];
}

@Injectable()
export class UsersService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly authService: AuthService,
    private readonly rbacService: RbacService,
    private readonly database: DatabaseService,
    private readonly domainEventEmitter: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(UsersService.name);
  }

  async list(query: ListUsersQuery): Promise<PaginatedResponse<UserWithType>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: any[] = [];
    if (!query.includeDeleted) {
      conditions.push(isNull(users.deletedAt));
    }

    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern),
          ilike(users.email, pattern),
        )!,
      );
    }

    if (query.userType) {
      conditions.push(eq(users.userType, query.userType));
    }

    if (query.roleId) {
      const usersWithRole = this.database.db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(withTenant(userRoles, eq(userRoles.roleId, query.roleId)));
      conditions.push(inArray(users.id, usersWithRole));
    }

    const whereClause = and(...conditions);

    // Sort
    const sortColumn = {
      firstName: users.firstName,
      email: users.email,
      createdAt: users.createdAt,
    }[query.sort ?? 'createdAt'];

    const orderFn = query.order === 'asc' ? asc : desc;

    // Count total
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(users)
      .where(withTenant(users, whereClause));

    // Fetch page
    const rows = await this.database.db
      .select()
      .from(users)
      .where(withTenant(users, whereClause))
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    // Batch-load roles for all users on this page
    const userIds = rows.map((r) => r.id);
    const userRoleRows = userIds.length > 0
      ? await this.database.db
          .select({
            userId: userRoles.userId,
            roleId: roles.id,
            roleName: roles.name,
          })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(withTenant(userRoles, inArray(userRoles.userId, userIds)))
      : [];

    const rolesByUserId = new Map<string, { id: string; name: string }[]>();
    for (const row of userRoleRows) {
      const list = rolesByUserId.get(row.userId) ?? [];
      list.push({ id: row.roleId, name: row.roleName });
      rolesByUserId.set(row.userId, list);
    }

    const data: UserWithType[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      phone: row.phone,
      firstName: row.firstName,
      lastName: row.lastName,
      userType: row.userType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      roles: rolesByUserId.get(row.id) ?? [],
    }));

    return {
      data,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async getEmail(id: string): Promise<string | null> {
    const [user] = await this.database.db
      .select({ email: users.email })
      .from(users)
      .where(withTenant(users, eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    return user?.email ?? null;
  }

  async getPhone(id: string): Promise<string | null> {
    const [user] = await this.database.db
      .select({ phone: users.phone })
      .from(users)
      .where(withTenant(users, eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    return user?.phone ?? null;
  }

  async findOneOrFail(id: string): Promise<UserWithType> {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(withTenant(users, eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      roles: [],
    };
  }

  async create(data: CreateUserInput, actorId: string): Promise<UserWithType> {
    // Validate all roles exist and match userType
    for (const roleId of data.roleIds) {
      const role = await this.rbacService.findRoleById(roleId);
      if (!role) throw new NotFoundException(`Role '${roleId}' not found`);
      if (role.userType !== data.userType) {
        throw new ConflictException(
          `Role '${role.name}' is scoped to '${role.userType}', but user type is '${data.userType}'`,
        );
      }
    }

    // Check email uniqueness
    const [existing] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(withTenant(users, eq(users.email, data.email.toLowerCase()), isNull(users.deletedAt)))
      .limit(1);

    if (existing) throw new ConflictException('Email already in use');

    const user = await this.database.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values(withTenantInsert(users, {
          email: data.email.toLowerCase(),
          phone: data.phone ?? null,
          firstName: data.firstName,
          lastName: data.lastName,
          userType: data.userType,
        }))
        .returning();

      // Create password credential
      await this.authService.createPasswordCredential(
        newUser.id,
        data.email.toLowerCase(),
        data.password,
        tx,
      );

      return newUser;
    });

    // Assign roles (outside transaction — idempotent)
    for (const roleId of data.roleIds) {
      await this.rbacService.assignRoleToUser(user.id, roleId);
    }

    this.logger.log('User created', { userId: user.id, actorId, userType: data.userType });

    this.domainEventEmitter.emit(USERS_USER_CREATED, {
      entityType: 'users',
      entityId: user.id,
      actorId,
      payload: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: data.userType,
        after: this.toSnapshot(user),
      },
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      roles: [],
    };
  }

  async update(id: string, data: UpdateUserInput, actorId: string): Promise<UserWithType> {
    // Verify user exists
    const existing = await this.findOneOrFail(id);

    // Check email uniqueness if email is being changed
    if (data.email && data.email.toLowerCase() !== existing.email) {
      const [duplicate] = await this.database.db
        .select({ id: users.id })
        .from(users)
        .where(
          withTenant(users,
            eq(users.email, data.email.toLowerCase()),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);

      if (duplicate) throw new ConflictException('Email already in use');
    }

    const updateValues: Record<string, unknown> = {};
    if (data.email !== undefined) updateValues.email = data.email.toLowerCase();
    if (data.phone !== undefined) updateValues.phone = data.phone;
    if (data.firstName !== undefined) updateValues.firstName = data.firstName;
    if (data.lastName !== undefined) updateValues.lastName = data.lastName;

    if (Object.keys(updateValues).length === 0) {
      return existing;
    }

    const [updated] = await this.database.db
      .update(users)
      .set(updateValues)
      .where(withTenant(users, eq(users.id, id)))
      .returning();

    this.logger.log('User updated', { userId: id, actorId, changes: Object.keys(updateValues) });

    this.domainEventEmitter.emit(USERS_USER_UPDATED, {
      entityType: 'users',
      entityId: id,
      actorId,
      payload: {
        changes: Object.keys(updateValues),
        before: this.toSnapshot(existing),
        after: this.toSnapshot(updated),
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      phone: updated.phone,
      firstName: updated.firstName,
      lastName: updated.lastName,
      userType: updated.userType,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      deletedAt: updated.deletedAt,
      roles: [],
    };
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    // Verify user exists and capture details for event
    const user = await this.findOneOrFail(id);

    await this.database.db
      .update(users)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(withTenant(users, eq(users.id, id)));

    this.logger.log('User deleted', { userId: id, actorId });

    this.domainEventEmitter.emit(USERS_USER_DELETED, {
      entityType: 'users',
      entityId: id,
      actorId,
      payload: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        before: this.toSnapshot(user),
      },
    });
  }

  private toSnapshot(entity: UserWithType | typeof users.$inferSelect): UserSnapshot {
    return {
      email: entity.email,
      phone: entity.phone,
      firstName: entity.firstName,
      lastName: entity.lastName,
      userType: entity.userType,
    };
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const user = await this.findOneOrFail(id);
    await this.authService.changePasswordDirect(user.id, newPassword);
    this.logger.log('User password reset', { userId: id });
  }

  async restore(id: string): Promise<UserWithType> {
    // Find user including deleted
    const [row] = await this.database.db
      .select()
      .from(users)
      .where(withTenant(users, eq(users.id, id)))
      .limit(1);

    if (!row) throw new NotFoundException('User not found');
    if (!row.deletedAt) throw new ConflictException('User is not deleted');

    const [restored] = await this.database.db
      .update(users)
      .set({ deletedAt: null, deletedBy: null })
      .where(withTenant(users, eq(users.id, id)))
      .returning();

    this.logger.log('User restored', { userId: id });

    return {
      id: restored.id,
      email: restored.email,
      phone: restored.phone,
      firstName: restored.firstName,
      lastName: restored.lastName,
      userType: restored.userType,
      createdAt: restored.createdAt,
      updatedAt: restored.updatedAt,
      deletedAt: restored.deletedAt,
      roles: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Hierarchy resolution
  // ---------------------------------------------------------------------------

  /**
   * Returns all direct and indirect subordinate user IDs (recursive).
   * Uses a recursive CTE to walk the reportsTo tree.
   */
  async getSubordinateIds(userId: string): Promise<string[]> {
    const result = await this.database.db.execute<{ id: string }>(sql`
      WITH RECURSIVE subordinates AS (
        SELECT id FROM users WHERE reports_to = ${userId} AND deleted_at IS NULL
        UNION ALL
        SELECT u.id FROM users u
        INNER JOIN subordinates s ON u.reports_to = s.id
        WHERE u.deleted_at IS NULL
      )
      SELECT id FROM subordinates
    `);
    return result.rows.map((r) => r.id);
  }

  /**
   * Returns the user's own ID plus all subordinate IDs.
   * Useful for "own + reports" scope resolution.
   */
  async getSelfAndSubordinateIds(userId: string): Promise<string[]> {
    const subordinateIds = await this.getSubordinateIds(userId);
    return [userId, ...subordinateIds];
  }
}
