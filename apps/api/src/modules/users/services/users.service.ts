import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AuthService } from '@packages/auth';
import { RbacService } from '@packages/rbac';
import {
  DatabaseService,
  users,
  userUserTypes,
  eq,
  and,
  or,
  isNull,
  ilike,
  sql,
  asc,
  desc,
  count,
} from '@packages/database';
import type { PaginatedResponse } from '@packages/common';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  userTypes: string[];
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  userType?: string;
  sort?: 'firstName' | 'email' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface UserWithTypes {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date;
  userTypes: string[];
}

@Injectable()
export class UsersService {
  constructor(
    private readonly authService: AuthService,
    private readonly rbacService: RbacService,
    private readonly database: DatabaseService,
  ) {}

  async list(query: ListUsersQuery): Promise<PaginatedResponse<UserWithTypes>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [isNull(users.deletedAt)];

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

    // If filtering by userType, join with userUserTypes
    if (query.userType) {
      const userIdsWithType = this.database.db
        .select({ userId: userUserTypes.userId })
        .from(userUserTypes)
        .where(eq(userUserTypes.userType, query.userType));

      conditions.push(sql`${users.id} IN (${userIdsWithType})`);
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
      .where(whereClause);

    // Fetch page
    const rows = await this.database.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    // Load userTypes for each user
    const userIds = rows.map((r) => r.id);
    const typesMap = await this.loadUserTypesMap(userIds);

    const data: UserWithTypes[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      userTypes: typesMap.get(row.id) ?? [],
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

  async findOneOrFail(id: string): Promise<UserWithTypes> {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    const userTypes = await this.rbacService.getUserTypes(user.id);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userTypes,
    };
  }

  async create(data: CreateUserInput, actorId: string): Promise<UserWithTypes> {
    // Check email uniqueness
    const [existing] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, data.email.toLowerCase()), isNull(users.deletedAt)))
      .limit(1);

    if (existing) throw new ConflictException('Email already in use');

    const user = await this.database.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
        })
        .returning();

      // Create password credential
      await this.authService.createPasswordCredential(
        newUser.id,
        data.email.toLowerCase(),
        data.password,
        tx,
      );

      // Assign user types
      for (const userType of data.userTypes) {
        await this.rbacService.assignUserType(newUser.id, userType, tx);
      }

      return newUser;
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userTypes: data.userTypes,
    };
  }

  async update(id: string, data: UpdateUserInput, actorId: string): Promise<UserWithTypes> {
    // Verify user exists
    const existing = await this.findOneOrFail(id);

    // Check email uniqueness if email is being changed
    if (data.email && data.email.toLowerCase() !== existing.email) {
      const [duplicate] = await this.database.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.email, data.email.toLowerCase()),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);

      if (duplicate) throw new ConflictException('Email already in use');
    }

    const updateValues: Record<string, unknown> = {};
    if (data.email !== undefined) updateValues.email = data.email.toLowerCase();
    if (data.firstName !== undefined) updateValues.firstName = data.firstName;
    if (data.lastName !== undefined) updateValues.lastName = data.lastName;

    if (Object.keys(updateValues).length === 0) {
      return existing;
    }

    const [updated] = await this.database.db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, id))
      .returning();

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      userTypes: existing.userTypes,
    };
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    // Verify user exists
    await this.findOneOrFail(id);

    await this.database.db
      .update(users)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(eq(users.id, id));
  }

  // --- Private helpers ---

  private async loadUserTypesMap(userIds: string[]): Promise<Map<string, string[]>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.database.db
      .select()
      .from(userUserTypes)
      .where(sql`${userUserTypes.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`);

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const types = map.get(row.userId) ?? [];
      types.push(row.userType);
      map.set(row.userId, types);
    }
    return map;
  }
}
