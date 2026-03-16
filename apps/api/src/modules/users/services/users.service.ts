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
  eq,
  and,
  or,
  isNull,
  ilike,
  asc,
  desc,
  count,
} from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import type { PaginatedResponse } from '@packages/common';
import {
  USERS_USER_CREATED,
  USERS_USER_UPDATED,
  USERS_USER_DELETED,
} from '../events/types';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  userType: string;
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

export interface UserWithType {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  userType: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly authService: AuthService,
    private readonly rbacService: RbacService,
    private readonly database: DatabaseService,
    private readonly domainEventEmitter: DomainEventEmitter,
  ) {}

  async list(query: ListUsersQuery): Promise<PaginatedResponse<UserWithType>> {
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

    if (query.userType) {
      conditions.push(eq(users.userType, query.userType));
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

    const data: UserWithType[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      userType: row.userType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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

  async findOneOrFail(id: string): Promise<UserWithType> {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async create(data: CreateUserInput, actorId: string): Promise<UserWithType> {
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
          userType: data.userType,
        })
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

    this.domainEventEmitter.emit(USERS_USER_CREATED, {
      entityType: 'users',
      entityId: user.id,
      actorId,
      payload: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: data.userType,
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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

    this.domainEventEmitter.emit(USERS_USER_UPDATED, {
      entityType: 'users',
      entityId: id,
      actorId,
      payload: {
        changes: Object.keys(updateValues),
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      userType: updated.userType,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    // Verify user exists and capture details for event
    const user = await this.findOneOrFail(id);

    await this.database.db
      .update(users)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(eq(users.id, id));

    this.domainEventEmitter.emit(USERS_USER_DELETED, {
      entityType: 'users',
      entityId: id,
      actorId,
      payload: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }
}
