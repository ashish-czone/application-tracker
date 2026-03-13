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
import type { AuthModuleConfig, AuthenticableUser } from '@packages/auth';
import { AUTH_MODULE_CONFIG } from '../constants';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_MODULE_CONFIG)
    private readonly config: AuthModuleConfig,
  ) {}

  async login(email: string, password: string) {
    const userDelegate = this.config.getUserDelegate();
    const user = await userDelegate.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokensAndStore(user);
  }

  async register(email: string, password: string) {
    const userDelegate = this.config.getUserDelegate();
    const existing = await userDelegate.findUnique({ where: { email: email.toLowerCase() } });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hashPassword(password);
    const user = await userDelegate.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    if (this.config.onUserCreated) {
      await this.config.onUserCreated(user);
    }

    return this.generateTokensAndStore(user);
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

    const userDelegate = this.config.getUserDelegate();
    const user = await userDelegate.findUnique({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify stored refresh token hash matches
    if (!user.refreshToken) {
      throw new UnauthorizedException('Refresh token invalidated');
    }

    const storedHashValid = verifyTokenHash(refreshTokenValue, user.refreshToken);
    if (!storedHashValid) {
      // Token rotation: old token used after new one was issued
      // Invalidate all refresh tokens for security
      await userDelegate.update({
        where: { id: user.id },
        data: { refreshToken: null },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return this.generateTokensAndStore(user);
  }

  async logout(userId: string) {
    const userDelegate = this.config.getUserDelegate();
    await userDelegate.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(email: string) {
    const userDelegate = this.config.getUserDelegate();
    const user = await userDelegate.findUnique({ where: { email: email.toLowerCase() } });

    // Always return 200 — don't reveal whether the email exists
    if (!user) {
      return { message: 'If an account exists, a password reset link has been sent' };
    }

    const token = generateRandomToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const passwordTokenDelegate = this.config.getPasswordTokenDelegate();
    await passwordTokenDelegate.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // TODO: enqueue email job via packages/queue
    return { message: 'If an account exists, a password reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const passwordTokenDelegate = this.config.getPasswordTokenDelegate();
    const record = await passwordTokenDelegate.findUnique({ where: { token } });

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
    const userDelegate = this.config.getUserDelegate();

    await userDelegate.update({
      where: { id: record.userId },
      data: { passwordHash, refreshToken: null },
    });

    await passwordTokenDelegate.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Password reset successfully' };
  }

  async getMe(userId: string) {
    const userDelegate = this.config.getUserDelegate();
    const user = await userDelegate.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Strip sensitive fields
    const { passwordHash: _, refreshToken: __, ...profile } = user;

    // Enrich with additional data (e.g., permissions)
    if (this.config.enrichUserProfile) {
      const extra = await this.config.enrichUserProfile(user);
      return { ...profile, ...extra };
    }

    return profile;
  }

  private async generateTokensAndStore(user: AuthenticableUser) {
    const payload = {
      sub: user.id,
      email: user.email,
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
    const userDelegate = this.config.getUserDelegate();
    await userDelegate.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }
}
