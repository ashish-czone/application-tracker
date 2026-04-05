import { Controller, Get, Post, Patch, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DatabaseService, users, eq, and, isNull } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { RbacService } from '@packages/rbac';
import { Public, CurrentUser, type JwtPayload } from '@packages/auth-core';
import { ClientAuthService } from '../orchestrator/client-auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { OAuthLoginDto } from '../dto/oauth-login.dto';

@ApiTags('auth/client')
@Controller('auth/client')
export class ClientAuthController {
  constructor(
    private readonly clientAuth: ClientAuthService,
    private readonly database: DatabaseService,
    private readonly rbacService: RbacService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new client account' })
  async register(@Body() dto: RegisterDto) {
    return this.clientAuth.clientRegister(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login as client' })
  async login(@Body() dto: LoginDto) {
    return this.clientAuth.clientLogin(dto.identifier, dto.password);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('oauth/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register via OAuth provider' })
  async oauthLogin(@Param('provider') provider: string, @Body() dto: OAuthLoginDto) {
    return this.clientAuth.clientOAuthLogin(provider, dto.code, dto.redirectUri);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh client access token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.clientAuth.clientRefresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout client (revoke refresh token)' })
  async logout(@Body() dto: RefreshDto) {
    await this.clientAuth.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout client from all devices' })
  async logoutAll(@CurrentUser() user: JwtPayload) {
    await this.clientAuth.logoutAll(user.userId);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset token' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.clientAuth.forgotPassword(dto.identifier);
    return { message: 'If the account exists, a reset link has been sent' };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.clientAuth.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    const [row] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        firstName: users.firstName,
        lastName: users.lastName,
        userType: users.userType,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(withTenant(users, eq(users.id, user.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!row) return null;

    const userRoles = await this.rbacService.getUserRoles(user.userId);

    return {
      ...row,
      roles: userRoles.map((r) => ({ id: r.id, name: r.name })),
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    const updateValues: Record<string, unknown> = {};
    if (dto.firstName !== undefined) updateValues.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateValues.lastName = dto.lastName;
    if (dto.email !== undefined) updateValues.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) updateValues.phone = dto.phone;

    if (Object.keys(updateValues).length > 0) {
      await this.database.db
        .update(users)
        .set(updateValues)
        .where(withTenant(users, eq(users.id, user.userId)));
    }

    return this.getProfile(user);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for logged-in client' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.clientAuth.changePassword(user.userId, dto.oldPassword, dto.newPassword);
    return { message: 'Password has been changed' };
  }
}
