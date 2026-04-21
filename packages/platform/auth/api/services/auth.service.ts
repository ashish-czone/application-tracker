import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService, users, eq, and, isNull, gt, type DrizzleDB } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { CredentialsService } from './credentials.service';
import { TokensService } from './tokens.service';
import { authTokens } from '../schema';
import { AUTH_TOKEN_TYPES, type JwtPayload, type Credential } from '../types';

@Injectable()
export class AuthService {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly tokensService: TokensService,
    private readonly database: DatabaseService,
  ) {}

  // --- Credential verification ---

  async verifyPasswordCredential(identifier: string, password: string): Promise<{ userId: string }> {
    const credential = await this.credentialsService.findByProviderAndIdentifier('password', identifier);
    if (!credential || !credential.secretHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.credentialsService.verifyPassword(credential.secretHash, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { userId: credential.userId };
  }

  // --- Access tokens ---

  generateAccessToken(payload: JwtPayload): string {
    return this.tokensService.generateAccessToken(payload);
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.tokensService.verifyAccessToken(token);
  }

  // --- Refresh tokens ---

  async createRefreshToken(userId: string) {
    return this.tokensService.createRefreshToken(userId);
  }

  async refresh(refreshToken: string): Promise<{ userId: string; token: string; expiresAt: Date }> {
    const tokenHash = this.tokensService.hashToken(refreshToken);

    return this.database.db.transaction(async (tx) => {
      // Lock the token row — second concurrent request waits here
      const [existing] = await tx
        .select()
        .from(authTokens)
        .where(withTenant(authTokens,
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, AUTH_TOKEN_TYPES.REFRESH),
          isNull(authTokens.revokedAt),
          gt(authTokens.expiresAt, new Date()),
        ))
        .for('update')
        .limit(1);

      if (!existing) throw new UnauthorizedException('Invalid or expired refresh token');

      // Create new token first
      const newToken = await this.tokensService.createRefreshToken(existing.userId, tx);

      // Then revoke old token
      await tx
        .update(authTokens)
        .set({ revokedAt: new Date() })
        .where(withTenant(authTokens, eq(authTokens.id, existing.id)));

      return { userId: existing.userId, token: newToken.token, expiresAt: newToken.expiresAt };
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const existing = await this.tokensService.validateToken(refreshToken, AUTH_TOKEN_TYPES.REFRESH);
    if (existing) {
      await this.tokensService.revokeToken(existing.id);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokensService.revokeAllUserTokens(userId, AUTH_TOKEN_TYPES.REFRESH);
  }

  // --- Password credential management ---

  async createPasswordCredential(userId: string, identifier: string, password: string, tx?: DrizzleDB): Promise<Credential> {
    const credential = await this.credentialsService.createPasswordCredential(userId, identifier, password, tx);
    return {
      id: credential.id,
      userId: credential.userId,
      provider: credential.provider,
      identifier: credential.identifier,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  async changePasswordDirect(userId: string, newPassword: string): Promise<void> {
    await this.credentialsService.updateSecretHash(userId, 'password', newPassword);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const userCredentials = await this.credentialsService.findByUserId(userId);
    const passwordCredential = userCredentials.find((c) => c.provider === 'password');

    if (!passwordCredential || !passwordCredential.secretHash) {
      throw new UnauthorizedException('No password credential found');
    }

    const isValid = await this.credentialsService.verifyPassword(passwordCredential.secretHash, oldPassword);
    if (!isValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    await this.credentialsService.updateSecretHash(userId, 'password', newPassword);
  }

  // --- Generic credential management (used by adapters like OAuth) ---

  async findCredential(provider: string, identifier: string) {
    return this.credentialsService.findByProviderAndIdentifier(provider, identifier);
  }

  async createCredential(userId: string, provider: string, identifier: string, tx?: DrizzleDB) {
    return this.credentialsService.createCredential(userId, provider, identifier, tx);
  }

  async findUserByEmail(email: string) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(withTenant(users, eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  // --- Password reset tokens ---

  async createPasswordResetToken(identifier: string): Promise<{ token: string; expiresAt: Date }> {
    const credential = await this.credentialsService.findByProviderAndIdentifier('password', identifier);
    if (!credential) {
      // Return silently to prevent email enumeration
      return { token: '', expiresAt: new Date() };
    }

    // Revoke any existing reset tokens for this user
    await this.tokensService.revokeAllUserTokens(credential.userId, AUTH_TOKEN_TYPES.PASSWORD_RESET);

    const { token, expiresAt } = await this.tokensService.createPasswordResetToken(credential.userId);
    return { token, expiresAt };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.tokensService.hashToken(token);

    const existing = await this.database.db.transaction(async (tx) => {
      // Lock the token row — second concurrent request waits here
      const [record] = await tx
        .select()
        .from(authTokens)
        .where(withTenant(authTokens,
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, AUTH_TOKEN_TYPES.PASSWORD_RESET),
          isNull(authTokens.revokedAt),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ))
        .for('update')
        .limit(1);

      if (!record) throw new UnauthorizedException('Invalid or expired reset token');

      // Do the work
      await this.credentialsService.updateSecretHash(record.userId, 'password', newPassword, tx);

      // Then consume
      await tx
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(withTenant(authTokens, eq(authTokens.id, record.id)));

      return record;
    });

    // Outside transaction — non-critical
    await this.tokensService.revokeAllUserTokens(existing.userId, AUTH_TOKEN_TYPES.REFRESH);
  }

  // --- Invitation tokens ---

  async createInvitationToken(userId: string, tx?: DrizzleDB): Promise<{ token: string; expiresAt: Date }> {
    // Revoke outstanding invitation tokens for this user so a "resend invite"
    // supersedes any prior link.
    await this.tokensService.revokeAllUserTokens(userId, AUTH_TOKEN_TYPES.INVITATION);
    const { token, expiresAt } = await this.tokensService.createInvitationToken(userId, tx);
    return { token, expiresAt };
  }

  /**
   * Accept an invitation — validates the token, creates the password credential
   * for the invited user, stamps users.acceptedAt, consumes the token. Caller
   * decides whether to mint a session afterward.
   */
  async acceptInvitation(token: string, newPassword: string): Promise<{ userId: string }> {
    const tokenHash = this.tokensService.hashToken(token);

    return this.database.db.transaction(async (tx) => {
      // Lock the token row
      const [record] = await tx
        .select()
        .from(authTokens)
        .where(withTenant(authTokens,
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, AUTH_TOKEN_TYPES.INVITATION),
          isNull(authTokens.revokedAt),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ))
        .for('update')
        .limit(1);

      if (!record) throw new UnauthorizedException('Invalid or expired invitation token');

      // Load the invited user (must still exist, not soft-deleted, not already accepted)
      const [user] = await tx
        .select({
          id: users.id,
          email: users.email,
          acceptedAt: users.acceptedAt,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(withTenant(users, eq(users.id, record.userId)))
        .limit(1);

      if (!user || user.deletedAt) {
        throw new UnauthorizedException('Invalid or expired invitation token');
      }
      if (user.acceptedAt) {
        // Stale link — account is already usable; tell the caller to log in instead
        // of silently succeeding.
        throw new UnauthorizedException('Invitation already accepted');
      }

      // Create the password credential (invited users don't have one yet).
      await this.credentialsService.createPasswordCredential(user.id, user.email, newPassword, tx);

      // Stamp acceptedAt on the user row
      await tx
        .update(users)
        .set({ acceptedAt: new Date() })
        .where(withTenant(users, eq(users.id, user.id)));

      // Consume the token
      await tx
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(withTenant(authTokens, eq(authTokens.id, record.id)));

      return { userId: user.id };
    });
  }
}
