import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@packages/database';
import { AuthService } from '@packages/auth-nestjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  USERS_USER_CREATED,
  USERS_USER_UPDATED,
  USERS_USER_DELETED,
} from '../events/types';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

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
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(input: RegisterInput) {
    const { accessToken, refreshToken, identity } = await this.authService.register(
      input.email,
      input.password,
    );

    const user = await this.prisma.user.create({
      data: {
        identityId: identity.id,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    this.emitEvent(USERS_USER_CREATED, {
      entityId: user.id,
      actorId: identity.id,
      payload: { email: identity.email, firstName: input.firstName, lastName: input.lastName, registeredSelf: true },
    });

    return {
      user: this.toUserResponse(user, identity.email),
      accessToken,
      refreshToken,
    };
  }

  async create(input: CreateUserInput) {
    const { identity } = await this.authService.register(
      input.email,
      input.password,
    );

    const user = await this.prisma.user.create({
      data: {
        identityId: identity.id,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      },
    });

    this.emitEvent(USERS_USER_CREATED, {
      entityId: user.id,
      actorId: identity.id,
      payload: { email: identity.email, firstName: input.firstName, lastName: input.lastName, registeredSelf: false },
    });

    return this.toUserResponse(user, identity.email);
  }

  async findAll(query: ListUsersQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort ?? 'createdAt';
    const order = query.order ?? 'desc';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { deletedAt: null };

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { identity: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any;
    if (sort === 'email') {
      orderBy = { identity: { email: order } };
    } else {
      orderBy = { [sort]: order };
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { identity: { select: { email: true } } },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => this.toUserResponse(u, u.identity.email)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneOrFail(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { identity: { select: { email: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user, user.identity.email);
  }

  async update(id: string, input: UpdateUserInput) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: input,
      include: { identity: { select: { email: true } } },
    });

    const updatedFields = Object.keys(input).filter((k) => input[k as keyof UpdateUserInput] !== undefined);
    this.emitEvent(USERS_USER_UPDATED, {
      entityId: id,
      actorId: id,
      payload: { updatedFields },
    });

    return this.toUserResponse(updated, updated.identity.email);
  }

  async softDelete(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { identity: { select: { email: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.authService.logout(user.identityId);

    this.emitEvent(USERS_USER_DELETED, {
      entityId: id,
      actorId: id,
      payload: { email: user.identity.email },
    });
  }

  private emitEvent(
    eventName: string,
    data: { entityId: string; actorId: string; payload: Record<string, unknown> },
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
