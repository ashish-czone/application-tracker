import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { DatabaseService, users, eq } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { AuthService } from '../services/auth.service';
import {
  AUTH_USER_REGISTERED,
  AUTH_USER_LOGGED_IN,
  AUTH_PASSWORD_RESET_REQUESTED,
  AUTH_PASSWORD_RESET_COMPLETED,
  AUTH_PASSWORD_CHANGED,
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
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(AuthOrchestratorService.name);
  }

  async login(identifier: string, password: string, userType: string) {
    const { userId } = await this.authService.verifyPasswordCredential(identifier, password);

    // Validate user has the required user type
    const user = await this.loadUser(userId);
    if (!user || user.userType !== userType) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Load permissions for this user type
    const permissions = await this.rbacService.getPermissionsForUser(userId, userType);

    const accessToken = this.authService.generateAccessToken({ userId, userType, permissions });
    const { token: refreshToken } = await this.authService.createRefreshToken(userId);

    this.logger.log('User logged in', { userId, userType });

    this.domainEventEmitter.emit(AUTH_USER_LOGGED_IN, {
      entityType: 'users',
      entityId: userId,
      actorId: userId,
      payload: {
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        userType,
      },
    });

    return { accessToken, refreshToken, userId };
  }

  async refresh(refreshToken: string, userType: string) {
    const { userId, token: newRefreshToken } = await this.authService.refresh(refreshToken);

    // Reload permissions (may have changed since last token)
    const permissions = await this.rbacService.getPermissionsForUser(userId, userType);

    const accessToken = this.authService.generateAccessToken({ userId, userType, permissions });

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
      .where(eq(users.email, data.email.toLowerCase()))
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
        .values({
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          userType,
        })
        .returning();

      await this.authService.createPasswordCredential(newUser.id, data.email.toLowerCase(), data.password, tx);

      return newUser;
    });

    // Assign the default role (outside transaction — role assignment is idempotent)
    await this.rbacService.assignRoleToUser(user.id, defaultRole.id);

    // Generate tokens with permissions from the default role
    const permissions = await this.rbacService.getPermissionsForUser(user.id, userType);
    const accessToken = this.authService.generateAccessToken({ userId: user.id, userType, permissions });
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

  private async loadUser(userId: string) {
    const [user] = await this.database.db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        userType: users.userType,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }
}
