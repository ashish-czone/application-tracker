import { Injectable, Optional, Inject, UnauthorizedException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { DatabaseService, users, eq } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger, getTenantId } from '@packages/logger';
import { JWT_CLAIMS_ENRICHERS, type JwtClaimsEnricher, type JwtPayload } from '@packages/auth-core';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { AuthService } from '../services/auth.service';
import { AuthAdapterRegistry } from '../adapters/auth-adapter-registry';
import {
  AUTH_USER_REGISTERED,
  AUTH_USER_LOGGED_IN,
  AUTH_PASSWORD_RESET_REQUESTED,
  AUTH_PASSWORD_RESET_COMPLETED,
  AUTH_PASSWORD_CHANGED,
  AUTH_ACCOUNT_LINKED,
} from '../events/types';

@Injectable()
export class AuthOrchestratorService {
  protected readonly userType!: string;
  protected readonly logger: ContextLogger;

  constructor(
    protected readonly authService: AuthService,
    protected readonly rbacService: RbacService,
    protected readonly database: DatabaseService,
    protected readonly domainEventEmitter: DomainEventEmitter,
    protected readonly adapterRegistry: AuthAdapterRegistry,
    appLogger: AppLoggerService,
    @Optional() @Inject(JWT_CLAIMS_ENRICHERS) private readonly enrichers?: JwtClaimsEnricher[],
  ) {
    this.logger = appLogger.forContext(AuthOrchestratorService.name);
  }

  async login(identifier: string, password: string, userType: string) {
    return this.loginWithProvider('password', { identifier, password }, userType);
  }

  async loginWithProvider(provider: string, credentials: Record<string, unknown>, userType: string) {
    const adapter = this.adapterRegistry.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Unknown auth provider: ${provider}`);
    }

    const result = await adapter.authenticate(credentials);
    let userId = result.userId;

    if (result.isNewUser) {
      // Create user + credential in a transaction
      const newUser = await this.database.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values(withTenantInsert(users, {
            email: result.email.toLowerCase(),
            firstName: result.firstName ?? result.email.split('@')[0],
            lastName: result.lastName ?? '',
            userType,
          }))
          .returning();

        await this.authService.createCredential(created.id, result.provider, result.providerIdentifier, tx);
        return created;
      });

      userId = newUser.id;

      // Assign default role (outside transaction — idempotent)
      const defaultRole = await this.rbacService.findDefaultRoleForUserType(userType);
      if (defaultRole) {
        await this.rbacService.assignRoleToUser(userId, defaultRole.id);
      }
    } else if (result.isNewCredential && userId) {
      // Account linking — create credential for existing user
      await this.authService.createCredential(userId, result.provider, result.providerIdentifier);
    }

    // Validate user type
    const user = await this.loadUser(userId!);
    if (!user || user.userType !== userType) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Stamp last login time — drives the "last active" column on user listings.
    await this.database.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(withTenant(users, eq(users.id, userId!)));

    // Generate tokens
    const permissions = await this.rbacService.getPermissionsForUser(userId!, userType);
    const accessToken = this.authService.generateAccessToken(
      await this.enrichPayload({ userId: userId!, userType, permissions, tenantId: getTenantId() }),
    );
    const { token: refreshToken } = await this.authService.createRefreshToken(userId!);

    this.logger.log('User authenticated', { userId: userId!, userType, provider });

    // Emit appropriate event
    if (result.isNewUser) {
      this.domainEventEmitter.emit(AUTH_USER_REGISTERED, {
        entityType: 'users',
        entityId: userId!,
        actorId: userId!,
        payload: {
          email: user.email ?? null,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          userType,
          authProvider: provider,
        },
      });
    } else if (result.isNewCredential) {
      this.domainEventEmitter.emit(AUTH_ACCOUNT_LINKED, {
        entityType: 'users',
        entityId: userId!,
        actorId: userId!,
        payload: {
          provider: result.provider,
          userType,
        },
      });
    } else {
      this.domainEventEmitter.emit(AUTH_USER_LOGGED_IN, {
        entityType: 'users',
        entityId: userId!,
        actorId: userId!,
        payload: {
          email: user.email ?? null,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          userType,
          authProvider: provider,
        },
      });
    }

    return { accessToken, refreshToken, userId: userId! };
  }

  async refresh(refreshToken: string, userType: string) {
    const { userId, token: newRefreshToken } = await this.authService.refresh(refreshToken);

    // Reload permissions (may have changed since last token)
    const permissions = await this.rbacService.getPermissionsForUser(userId, userType);

    const accessToken = this.authService.generateAccessToken(
      await this.enrichPayload({ userId, userType, permissions, tenantId: getTenantId() }),
    );

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await this.authService.logout(refreshToken);
    this.logger.log('User logged out', {});
  }

  async logoutAll(userId: string) {
    await this.authService.logoutAll(userId);
    this.logger.log('All sessions revoked', { userId });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    await this.authService.changePassword(userId, oldPassword, newPassword);

    this.logger.log('Password changed', { userId });

    const user = await this.loadUser(userId);
    this.domainEventEmitter.emit(AUTH_PASSWORD_CHANGED, {
      entityType: 'users',
      entityId: userId,
      actorId: userId,
      payload: {
        email: user?.email ?? null,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        userType: this.userType,
      },
    });
  }

  async forgotPassword(identifier: string) {
    const { token, expiresAt } = await this.authService.createPasswordResetToken(identifier);

    this.logger.log('Password reset requested', { userType: this.userType });

    if (token) {
      this.domainEventEmitter.emit(AUTH_PASSWORD_RESET_REQUESTED, {
        entityType: 'users',
        entityId: '',
        actorId: null,
        payload: {
          identifier,
          token,
          expiresAt: expiresAt.toISOString(),
          userType: this.userType,
        },
      });
    }

    return { token, expiresAt };
  }

  async resetPassword(token: string, newPassword: string) {
    await this.authService.resetPassword(token, newPassword);

    this.logger.log('Password reset completed', { userType: this.userType });

    this.domainEventEmitter.emit(AUTH_PASSWORD_RESET_COMPLETED, {
      entityType: 'users',
      entityId: '',
      actorId: null,
      payload: {
        userType: this.userType,
      },
    });
  }

  async register(
    data: { email: string; firstName: string; lastName: string; password: string },
    userType: string,
  ) {
    // Check if email already exists
    const [existing] = await this.database.db
      .select()
      .from(users)
      .where(withTenant(users, eq(users.email, data.email.toLowerCase())))
      .limit(1);

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // Look up the default role for this user type
    const defaultRole = await this.rbacService.findDefaultRoleForUserType(userType);
    if (!defaultRole) {
      throw new InternalServerErrorException(`No default role configured for user type '${userType}'`);
    }

    // Create user + credential in a transaction
    const user = await this.database.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values(withTenantInsert(users, {
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          userType,
        }))
        .returning();

      await this.authService.createPasswordCredential(newUser.id, data.email.toLowerCase(), data.password, tx);

      return newUser;
    });

    // Assign the default role (outside transaction — role assignment is idempotent)
    await this.rbacService.assignRoleToUser(user.id, defaultRole.id);

    // Generate tokens with permissions from the default role
    const permissions = await this.rbacService.getPermissionsForUser(user.id, userType);
    const accessToken = this.authService.generateAccessToken(
      await this.enrichPayload({ userId: user.id, userType, permissions, tenantId: getTenantId() }),
    );
    const { token: refreshToken } = await this.authService.createRefreshToken(user.id);

    this.logger.log('User registered', { userId: user.id, userType });

    this.domainEventEmitter.emit(AUTH_USER_REGISTERED, {
      entityType: 'users',
      entityId: user.id,
      actorId: user.id,
      payload: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        userType,
      },
    });

    return { accessToken, refreshToken, userId: user.id };
  }

  // --- Private helpers ---

  private async enrichPayload(payload: JwtPayload): Promise<JwtPayload> {
    if (!this.enrichers?.length) return payload;
    let enriched = payload;
    for (const enricher of this.enrichers) {
      enriched = await enricher.enrich(enriched);
    }
    return enriched;
  }

  private async loadUser(userId: string) {
    const [user] = await this.database.db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        userType: users.userType,
      })
      .from(users)
      .where(withTenant(users, eq(users.id, userId)))
      .limit(1);

    return user ?? null;
  }
}
