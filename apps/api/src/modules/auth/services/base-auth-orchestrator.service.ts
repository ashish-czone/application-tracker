import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from '@packages/auth';
import { RbacService } from '@packages/rbac';
import { DatabaseService, users, eq } from '@packages/database';
import { randomUUID } from 'crypto';
import {
  AUTH_USER_REGISTERED,
  AUTH_USER_LOGGED_IN,
  AUTH_PASSWORD_RESET_REQUESTED,
  AUTH_PASSWORD_RESET_COMPLETED,
  AUTH_PASSWORD_CHANGED,
} from '../events/types';

@Injectable()
export class BaseAuthOrchestratorService {
  constructor(
    protected readonly authService: AuthService,
    protected readonly rbacService: RbacService,
    protected readonly database: DatabaseService,
    protected readonly eventEmitter: EventEmitter2,
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

    this.eventEmitter.emit(AUTH_USER_LOGGED_IN, {
      eventName: AUTH_USER_LOGGED_IN,
      entityType: 'user',
      entityId: userId,
      actorId: userId,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: { userType },
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

    this.eventEmitter.emit(AUTH_PASSWORD_CHANGED, {
      eventName: AUTH_PASSWORD_CHANGED,
      entityType: 'user',
      entityId: userId,
      actorId: userId,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: {},
    });
  }

  async forgotPassword(identifier: string) {
    const { token, expiresAt } = await this.authService.createPasswordResetToken(identifier);

    // Only emit if a token was actually created (non-empty means user exists)
    if (token) {
      this.eventEmitter.emit(AUTH_PASSWORD_RESET_REQUESTED, {
        eventName: AUTH_PASSWORD_RESET_REQUESTED,
        entityType: 'user',
        entityId: '',
        actorId: null,
        correlationId: randomUUID(),
        occurredAt: new Date().toISOString(),
        payload: { token, expiresAt: expiresAt.toISOString() },
      });
    }

    return { token, expiresAt };
  }

  async resetPassword(token: string, newPassword: string) {
    await this.authService.resetPassword(token, newPassword);

    this.eventEmitter.emit(AUTH_PASSWORD_RESET_COMPLETED, {
      eventName: AUTH_PASSWORD_RESET_COMPLETED,
      entityType: 'user',
      entityId: '',
      actorId: null,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: {},
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

    this.eventEmitter.emit(AUTH_USER_REGISTERED, {
      eventName: AUTH_USER_REGISTERED,
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: { email: data.email.toLowerCase(), userType },
    });

    return { accessToken, refreshToken, userId: user.id };
  }
}
