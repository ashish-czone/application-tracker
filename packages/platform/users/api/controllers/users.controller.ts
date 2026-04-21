import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { UsersService } from '../services/users.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { InviteUserDto } from '../dto/invite-user.dto';

/**
 * Thin users controller. CRUD + soft-delete + restore + list come from the
 * generic entity-engine controller auto-mounted by `forEntity(usersConfig)`.
 *
 * This controller hosts endpoints the engine does not generate:
 *   - POST /users/invite                 — create a user with deferred
 *                                          credentials + mint an invitation
 *                                          token; email delivery is handled by
 *                                          a notifications handler subscribed
 *                                          to auth.InvitationSent.
 *   - POST /users/:id/resend-invitation  — re-emit the invite with a fresh token.
 *   - POST /users/:id/reset-password     — admin-only direct password reset.
 *
 * It coexists at `@Controller('users')` with the auto-generated controller —
 * NestJS matches on (method, path), and each of these actions is more specific
 * than any route the engine auto-mounts.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('invite')
  @RequirePermission('users.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new user — creates deferred account + mints invitation token' })
  async invite(@Body() dto: InviteUserDto) {
    return this.usersService.inviteUser({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      userType: dto.userType,
      phone: dto.phone,
      roleIds: dto.roleIds,
    });
  }

  @Post(':id/resend-invitation')
  @RequirePermission('users.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invitation to a user with a pending (not-yet-accepted) invitation' })
  async resendInvitation(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resendInvitation(id);
  }

  @Post(':id/reset-password')
  @RequirePermission('users.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reset a user's password (admin action)" })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.resetPassword(id, dto.password);
  }
}
