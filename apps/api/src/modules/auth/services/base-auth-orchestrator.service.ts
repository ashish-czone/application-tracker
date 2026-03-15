import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from '@packages/auth';
import { RbacService } from '@packages/rbac';
import { DatabaseService, users, eq } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import {
  AUTH_USER_REGISTERED,
  AUTH_USER_LOGGED_IN,
  AUTH_PASSWORD_RESET_REQUESTED,
  AUTH_PASSWORD_RESET_COMPLETED,
  AUTH_PASSWORD_CHANGED,
} from '../events/types';

@Injectable()
export class BaseAuthOrchestratorService {
  protected readonly userType!: string;

  constructor(
    protected readonly authService: AuthService,
    protected readonly rbacService: RbacService,
    protected readonly database: DatabaseService,
    protected readonly domainEventEmitter: DomainEventEmitter,
  ) {}

  async login(identifier: string, password: string, userType: string) {
    const { userId } = await this.authService.verifyPasswordCredential(identifier, password);

    // Validate user has the required user type
    const types = await this.rbacService.getUserTypes(userId);
    if (!types.includes(userType)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Load permissions for this user type
    const permissions = await this.rbacService.getPermissionsForUser(userId, userType);

    const accessToken = this.authService.generateAccessToken({ userId, userType, permissions });
    const { token: refreshToken } = await this.authService.createRefreshToken(userId);

    const user = await this.loadUser(userId);
    this.domainEventEmitter.emit(AUTH_USER_LOGGED_IN, {
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
  }

  async logoutAll(userId: string) {
    await this.authService.logoutAll(userId);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    await this.authService.changePassword(userId, oldPassword, newPassword);

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

    // Create user + credential + user type in a transaction
    const user = await this.database.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
        })
        .returning();

      await this.authService.createPasswordCredential(newUser.id, data.email.toLowerCase(), data.password, tx);
      await this.rbacService.assignUserType(newUser.id, userType, tx);

      return newUser;
    });

    // Generate tokens (outside transaction — not critical for atomicity)
    const permissions = await this.rbacService.getPermissionsForUser(user.id, userType);
    const accessToken = this.authService.generateAccessToken({ userId: user.id, userType, permissions });
    const { token: refreshToken } = await this.authService.createRefreshToken(user.id);

    this.domainEventEmitter.emit(AUTH_USER_REGISTERED, {
      entityType: 'users',
      entityId: user.id,
      actorId: user.id,
      payload: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        userType: this.userType,
      },
    });

    return { accessToken, refreshToken, userId: user.id };
  }

  // --- Private helpers ---

  private async loadUser(userId: string) {
    const [user] = await this.database.db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }
}
