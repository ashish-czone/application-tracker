import { Injectable, Inject } from '@nestjs/common';
import { DatabaseService, eq, and, isNull } from '@packages/database';
import * as jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { authTokens } from '../schema';
import { AUTH_MODULE_CONFIG, AUTH_TOKEN_TYPES, type AuthModuleConfig, type JwtPayload } from '../types';

@Injectable()
export class TokensService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(AUTH_MODULE_CONFIG) private readonly config: AuthModuleConfig,
  ) {}

  generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.accessTokenExpiresIn,
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, this.config.jwtSecret) as JwtPayload;
  }

  async createToken(userId: string, type: string, expiresIn: string) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = this.calculateExpiry(expiresIn);

    const [record] = await this.database.db
      .insert(authTokens)
      .values({ userId, type, tokenHash, expiresAt })
      .returning();

    return { token, expiresAt, id: record.id };
  }

  async createRefreshToken(userId: string) {
    return this.createToken(userId, AUTH_TOKEN_TYPES.REFRESH, this.config.refreshTokenExpiresIn);
  }

  async createPasswordResetToken(userId: string) {
    return this.createToken(userId, AUTH_TOKEN_TYPES.PASSWORD_RESET, this.config.resetTokenExpiresIn);
  }

  async validateToken(token: string, type: string) {
    const tokenHash = this.hashToken(token);

    const [record] = await this.database.db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, type),
          isNull(authTokens.revokedAt),
          isNull(authTokens.usedAt),
        ),
      )
      .limit(1);

    if (!record) return null;
    if (record.expiresAt < new Date()) return null;

    return record;
  }

  async revokeToken(tokenId: string) {
    await this.database.db
      .update(authTokens)
      .set({ revokedAt: new Date() })
      .where(eq(authTokens.id, tokenId));
  }

  async revokeAllUserTokens(userId: string, type?: string) {
    const conditions = [eq(authTokens.userId, userId), isNull(authTokens.revokedAt)];
    if (type) conditions.push(eq(authTokens.type, type));

    await this.database.db
      .update(authTokens)
      .set({ revokedAt: new Date() })
      .where(and(...conditions));
  }

  async markTokenUsed(tokenId: string) {
    await this.database.db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(eq(authTokens.id, tokenId));
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calculateExpiry(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid expiresIn format: ${expiresIn}`);

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const ms: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * ms[unit]);
  }
}
