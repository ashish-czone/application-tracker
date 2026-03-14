import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@packages/database';
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '@packages/auth';
import { RbacService } from '@packages/rbac-nestjs';
import { SettingsService } from '@packages/settings-nestjs';

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
    private readonly rbacService: RbacService,
    private readonly settingsService: SettingsService,
  ) {}

  async register(input: RegisterInput) {
    const { identity, user } = await this.createIdentityAndUser({
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    await this.rbacService.bootstrapSuperadmin(identity.id);

    const tokens = await this.generateTokensAndStore(identity);

    return {
      user: this.toUserResponse(user, identity.email),
      ...tokens,
    };
  }

  async create(input: CreateUserInput) {
    const { identity, user } = await this.createIdentityAndUser(input);

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

    // Build orderBy — handle email sorting via identity relation
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

    return this.toUserResponse(updated, updated.identity.email);
  }

  async softDelete(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: now },
      }),
      this.prisma.identity.update({
        where: { id: user.identityId },
        data: { refreshToken: null },
      }),
    ]);
  }

  private async createIdentityAndUser(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    const existing = await this.prisma.identity.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hashPassword(input.password);

    return this.prisma.$transaction(async (tx) => {
      const identity = await tx.identity.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
        },
      });

      const user = await tx.user.create({
        data: {
          identityId: identity.id,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        },
      });

      return { identity, user };
    });
  }

  private async generateTokensAndStore(identity: { id: string; email: string }) {
    const jwtSecret = process.env.JWT_SECRET!;
    const accessTokenExpiresIn = await this.settingsService.get(
      'identity',
      'accessTokenExpiresIn',
      '15m',
    );
    const refreshTokenExpiresIn = await this.settingsService.get(
      'identity',
      'refreshTokenExpiresIn',
      '7d',
    );

    const payload = {
      sub: identity.id,
      email: identity.email,
      entityName: 'identity',
    };

    const accessToken = generateAccessToken(payload, jwtSecret, accessTokenExpiresIn);
    const refreshToken = generateRefreshToken(payload, jwtSecret, refreshTokenExpiresIn);

    const refreshTokenHash = hashToken(refreshToken);
    await this.prisma.identity.update({
      where: { id: identity.id },
      data: { refreshToken: refreshTokenHash },
    });

    return { accessToken, refreshToken };
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
