import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types';
import { AdminAuthService } from '../orchestrator/admin-auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

@ApiTags('auth/admin')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login as admin' })
  async login(@Body() dto: LoginDto) {
    return this.adminAuth.adminLogin(dto.identifier, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh admin access token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.adminAuth.adminRefresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout admin (revoke refresh token)' })
  async logout(@Body() dto: RefreshDto) {
    await this.adminAuth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request admin password reset token' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.adminAuth.forgotPassword(dto.identifier);
    return { message: 'If the account exists, a reset link has been sent' };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset admin password using token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.adminAuth.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for logged-in admin' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.adminAuth.changePassword(user.userId, dto.oldPassword, dto.newPassword);
    return { message: 'Password has been changed' };
  }
}
