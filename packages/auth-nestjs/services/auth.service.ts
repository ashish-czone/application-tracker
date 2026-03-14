import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  verifyTokenHash,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateRandomToken,
  TokenExpiredError,
  InvalidTokenError,
} from '@packages/auth';
import type { AuthModuleConfig, AuthenticableIdentity } from '@packages/auth';
import { DatabaseService, identities, passwordTokens, eq } from '@packages/database';
import { AUTH_MODULE_CONFIG } from '../constants';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_MODULE_CONFIG)
    private readonly config: AuthModuleConfig,
    private readonly database: DatabaseService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async login(email: string, password: string) {
    const [identity] = await this.db
      .select()
      .from(identities)
      .where(eq(identities.email, email.toLowerCase()))
      .limit(1);

    if (!identity) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(password, identity.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokensAndStore(identity);
  }

  async register(email: string, password: string) {
    const [existing] = await this.db
      .select()
      .from(identities)
      .where(eq(identities.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hashPassword(password);
    const [identity] = await this.db
      .insert(identities)
      .values({
        email: email.toLowerCase(),
        passwordHash,
      })
      .returning();

    if (this.config.onIdentityCreated) {
      await this.config.onIdentityCreated(identity);
    }

    const tokens = await this.generateTokensAndStore(identity);
    return { ...tokens, identity: { id: identity.id, email: identity.email } };
  }

  async refresh(refreshTokenValue: string | undefined) {
    if (!refreshTokenValue) {
      throw new UnauthorizedException('No refresh token provided');
    }

    let payload;
    try {
      payload = verifyToken(refreshTokenValue, this.config.jwtSecret);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Refresh token expired');
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [identity] = await this.db
      .select()
      .from(identities)
      .where(eq(identities.id, payload.sub))
      .limit(1);

    if (!identity) {
      throw new UnauthorizedException('Identity not found');
    }

    // Verify stored refresh token hash matches
    if (!identity.refreshToken) {
      throw new UnauthorizedException('Refresh token invalidated');
    }

    const storedHashValid = verifyTokenHash(refreshTokenValue, identity.refreshToken);
    if (!storedHashValid) {
      // Token rotation: old token used after new one was issued
      // Invalidate all refresh tokens for security
      await this.db
        .update(identities)
        .set({ refreshToken: null })
        .where(eq(identities.id, identity.id));
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return this.generateTokensAndStore(identity);
  }

  async logout(identityId: string) {
    await this.db
      .update(identities)
      .set({ refreshToken: null })
      .where(eq(identities.id, identityId));
  }

  async forgotPassword(email: string) {
    const [identity] = await this.db
      .select()
      .from(identities)
      .where(eq(identities.email, email.toLowerCase()))
      .limit(1);

    // Always return 200 — don't reveal whether the email exists
    if (!identity) {
      return { message: 'If an account exists, a password reset link has been sent' };
    }

    const token = generateRandomToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.db.insert(passwordTokens).values({
      identityId: identity.id,
      token,
      expiresAt,
    });

    // TODO: enqueue email job via packages/queue
    return { message: 'If an account exists, a password reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const [record] = await this.db
      .select()
      .from(passwordTokens)
      .where(eq(passwordTokens.token, token))
      .limit(1);

    if (!record) {
      throw new BadRequestException('Invalid reset token');
    }

    if (record.usedAt) {
      throw new BadRequestException('Reset token has already been used');
    }

    if (new Date() > record.expiresAt) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordHash = await hashPassword(newPassword);

    await this.db
      .update(identities)
      .set({ passwordHash, refreshToken: null })
      .where(eq(identities.id, record.identityId));

    await this.db
      .update(passwordTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordTokens.id, record.id));

    return { message: 'Password reset successfully' };
  }

  async getMe(identityId: string) {
    const [identity] = await this.db
      .select()
      .from(identities)
      .where(eq(identities.id, identityId))
      .limit(1);

    if (!identity) {
      throw new UnauthorizedException('Identity not found');
    }

    // Strip sensitive fields
    const { passwordHash: _, refreshToken: __, ...profile } = identity;

    // Enrich with additional data (e.g., permissions)
    if (this.config.enrichIdentityProfile) {
      const extra = await this.config.enrichIdentityProfile(identity);
      return { ...profile, ...extra };
    }

    return profile;
  }

  private async generateTokensAndStore(identity: AuthenticableIdentity) {
    const payload = {
      sub: identity.id,
      email: identity.email,
      entityName: this.config.entityName,
    };

    const accessToken = generateAccessToken(
      payload,
      this.config.jwtSecret,
      this.config.accessTokenExpiresIn,
    );
    const refreshToken = generateRefreshToken(
      payload,
      this.config.jwtSecret,
      this.config.refreshTokenExpiresIn,
    );

    // SHA-256 hash for refresh token (bcrypt truncates at 72 bytes, JWTs are longer)
    const refreshTokenHash = hashToken(refreshToken);
    await this.db
      .update(identities)
      .set({ refreshToken: refreshTokenHash })
      .where(eq(identities.id, identity.id));

    return { accessToken, refreshToken };
  }
}
