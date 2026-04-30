import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { UsersService } from '../services/users.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { InviteUserDto } from '../dto/invite-user.dto';

/**
 * Users controller. Hosts both the standard CRUD routes (list/findOne/create/
 * update/delete/clone/restore/layout) and the slots the engine does not
 * generate (invite, resend-invitation, reset-password).
 *
 * CRUD bodies stay `Record<string, unknown>` so nested relationship payloads
 * (credentials, roles) defined in the users entity config flow through to the
 * engine's validator unchanged.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('layout/list')
  @RequirePermission('users.read')
  @ApiOperation({ summary: 'Get list layout config for users' })
  getListLayout() {
    return this.usersService.getListLayout();
  }

  @Get('summary')
  @RequirePermission('users.read')
  @ApiOperation({ summary: 'Aggregated user counts by derived status' })
  getSummary(@AccessContext() accessCtx?: DataAccessContext) {
    return this.usersService.getSummary(accessCtx);
  }

  @Get()
  @RequirePermission('users.read')
  @ApiOperation({ summary: 'List users' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.usersService.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('users.read')
  @ApiOperation({ summary: 'Get a single user by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.usersService.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('users.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() body: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(body, user.userId);
  }

  @Patch(':id')
  @RequirePermission('users.update')
  @ApiOperation({ summary: 'Update a user' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.usersService.update(id, body, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('users.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a user' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.usersService.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('users.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a user' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('users.update')
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.restore(id);
  }

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
