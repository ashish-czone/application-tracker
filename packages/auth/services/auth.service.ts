import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { TokensService } from './tokens.service';
import { AUTH_TOKEN_TYPES, type JwtPayload, type Credential } from '../types';

@Injectable()
export class AuthService {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly tokensService: TokensService,
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
    const existing = await this.tokensService.validateToken(refreshToken, AUTH_TOKEN_TYPES.REFRESH);
    if (!existing) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.tokensService.revokeToken(existing.id);

    const newToken = await this.tokensService.createRefreshToken(existing.userId);
    return { userId: existing.userId, token: newToken.token, expiresAt: newToken.expiresAt };
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

  async createPasswordCredential(userId: string, identifier: string, password: string): Promise<Credential> {
    const credential = await this.credentialsService.createPasswordCredential(userId, identifier, password);
    return {
      id: credential.id,
      userId: credential.userId,
      provider: credential.provider,
      identifier: credential.identifier,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
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
    const existing = await this.tokensService.validateToken(token, AUTH_TOKEN_TYPES.PASSWORD_RESET);
    if (!existing) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    await this.credentialsService.updateSecretHash(existing.userId, 'password', newPassword);
    await this.tokensService.markTokenUsed(existing.id);

    // Revoke all refresh tokens so user must re-login
    await this.tokensService.revokeAllUserTokens(existing.userId, AUTH_TOKEN_TYPES.REFRESH);
  }
}
