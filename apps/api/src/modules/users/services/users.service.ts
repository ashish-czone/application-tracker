import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DatabaseService,
  users,
  identities,
  eq,
  and,
  or,
  isNull,
  ilike,
  asc,
  desc,
  count,
} from '@packages/database';
import { AuthService } from '@packages/auth-nestjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  USERS_USER_CREATED,
  USERS_USER_UPDATED,
  USERS_USER_DELETED,
} from '../events/types';

interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  timezone?: string | null;
}

interface ListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.database.db;
  }

  async create(input: CreateUserInput, actorId: string | null) {
    const { accessToken, refreshToken, identity } = await this.authService.register(
      input.email,
      input.password,
    );

    const [user] = await this.db
      .insert(users)
      .values({
        identityId: identity.id,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      })
      .returning();

    this.emitEvent(USERS_USER_CREATED, {
      entityId: user.id,
      actorId: actorId,
      payload: { email: identity.email, firstName: input.firstName, lastName: input.lastName },
    });

    return {
      user: this.toUserResponse(user, identity.email),
      accessToken,
      refreshToken,
    };
  }

  async findAll(query: ListUsersQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort ?? 'createdAt';
    const order = query.order ?? 'desc';

    const orderFn = order === 'desc' ? desc : asc;
    const sortColumn = sort === 'email' ? identities.email
      : sort === 'firstName' ? users.firstName
      : sort === 'lastName' ? users.lastName
      : users.createdAt;

    const searchCondition = query.search
      ? or(
          ilike(users.firstName, `%${query.search}%`),
          ilike(users.lastName, `%${query.search}%`),
          ilike(identities.email, `%${query.search}%`),
        )
      : undefined;

    const whereCondition = searchCondition
      ? and(isNull(users.deletedAt), searchCondition)
      : isNull(users.deletedAt);

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: users.id,
          identityId: users.identityId,
          firstName: users.firstName,
          lastName: users.lastName,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
          timezone: users.timezone,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          email: identities.email,
        })
        .from(users)
        .innerJoin(identities, eq(users.identityId, identities.id))
        .where(whereCondition)
        .orderBy(orderFn(sortColumn))
        .offset(skip)
        .limit(limit),
      this.db
        .select({ total: count() })
        .from(users)
        .innerJoin(identities, eq(users.identityId, identities.id))
        .where(whereCondition),
    ]);

    return {
      data: data.map((u) => this.toUserResponse(u, u.email)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneOrFail(id: string) {
    const [result] = await this.db
      .select({
        id: users.id,
        identityId: users.identityId,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        timezone: users.timezone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        email: identities.email,
      })
      .from(users)
      .innerJoin(identities, eq(users.identityId, identities.id))
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (!result) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(result, result.email);
  }

  async update(id: string, input: UpdateUserInput, actorId: string) {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const [updated] = await this.db
      .update(users)
      .set(input)
      .where(eq(users.id, id))
      .returning();

    const [withEmail] = await this.db
      .select({ email: identities.email })
      .from(identities)
      .where(eq(identities.id, updated.identityId))
      .limit(1);

    const updatedFields = Object.keys(input).filter((k) => input[k as keyof UpdateUserInput] !== undefined);
    this.emitEvent(USERS_USER_UPDATED, {
      entityId: id,
      actorId,
      payload: { updatedFields },
    });

    return this.toUserResponse(updated, withEmail.email);
  }

  async softDelete(id: string, actorId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        identityId: users.identityId,
        email: identities.email,
      })
      .from(users)
      .innerJoin(identities, eq(users.identityId, identities.id))
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, id));

    await this.authService.logout(user.identityId);

    this.emitEvent(USERS_USER_DELETED, {
      entityId: id,
      actorId,
      payload: { email: user.email },
    });
  }

  private emitEvent(
    eventName: string,
    data: { entityId: string; actorId: string | null; payload: Record<string, unknown> },
  ) {
    this.eventEmitter.emit(eventName, {
      eventName,
      entityType: 'user',
      entityId: data.entityId,
      actorId: data.actorId,
      correlationId: '',
      occurredAt: new Date().toISOString(),
      payload: data.payload,
    });
  }

  private toUserResponse(
    user: { id: string; firstName: string; lastName: string; phone: string | null; avatarUrl: string | null; timezone: string | null; createdAt: Date; updatedAt: Date },
    email: string,
  ) {
    return {
      id: user.id,
      email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
