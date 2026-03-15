import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from '@packages/auth';
import { RbacService } from '@packages/rbac';
import { DatabaseService, users, eq } from '@packages/database';

@Injectable()
export class BaseAuthOrchestratorService {
  constructor(
    protected readonly authService: AuthService,
    protected readonly rbacService: RbacService,
    protected readonly database: DatabaseService,
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
  }

  async forgotPassword(identifier: string) {
    const { token, expiresAt } = await this.authService.createPasswordResetToken(identifier);
    // TODO: emit event for email delivery
    return { token, expiresAt };
  }

  async resetPassword(token: string, newPassword: string) {
    await this.authService.resetPassword(token, newPassword);
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

    return { accessToken, refreshToken, userId: user.id };
  }
}
