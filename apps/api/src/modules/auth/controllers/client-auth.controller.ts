import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public, CurrentUser, type JwtPayload } from '@packages/auth';
import { ClientAuthService } from '../services/client-auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

@ApiTags('auth/client')
@Controller('auth/client')
export class ClientAuthController {
  constructor(private readonly clientAuth: ClientAuthService) {}

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

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for logged-in client' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.clientAuth.changePassword(user.userId, dto.oldPassword, dto.newPassword);
    return { message: 'Password has been changed' };
  }
}
