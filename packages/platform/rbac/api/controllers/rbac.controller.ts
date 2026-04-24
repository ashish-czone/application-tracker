import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { RbacService } from '../services/rbac.service';
import { PermissionManifestRegistry } from '../permission-manifest';
import { RequirePermission } from '../decorators/require-permission.decorator';
import type { BooleanPermissions } from '../types';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { ListRolesQueryDto } from '../dto/list-roles-query.dto';
import { SetRolePermissionsDto } from '../dto/set-role-permissions.dto';
import { AddRoleMemberDto } from '../dto/add-role-member.dto';
import { ListRoleMembersQueryDto } from '../dto/list-role-members-query.dto';
import { RBAC_PERMISSIONS } from '../permissions';

@ApiTags('rbac')
@Controller()
export class RbacController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly manifestRegistry: PermissionManifestRegistry,
  ) {}

  // --- Roles ---

  @Get('roles')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'List roles with pagination and filtering' })
  async listRoles(@Query() query: ListRolesQueryDto) {
    return this.rbacService.listRoles(query);
  }

  @Get('roles/:id')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'Get a single role by ID' })
  async findRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacService.findRoleByIdOrFail(id);
  }

  @Post('roles')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role' })
  async createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Update a role name' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a role. Removes user assignments; keeps permissions for audit/restore.' })
  async deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.rbacService.deleteRole(id, user.userId);
  }

  @Get('roles/:id/user-count')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'Get number of users assigned to a role' })
  async getRoleUserCount(@Param('id', ParseUUIDPipe) id: string) {
    await this.rbacService.findRoleByIdOrFail(id);
    const count = await this.rbacService.getRoleUserCount(id);
    return { count };
  }

  // --- Role Members ---

  @Get('roles/:id/members')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'List users assigned to a role' })
  async listRoleMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListRoleMembersQueryDto,
  ) {
    return this.rbacService.listRoleMembers(id, query);
  }

  @Post('roles/:id/members')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a user to a role' })
  async addRoleMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddRoleMemberDto,
  ) {
    return this.rbacService.addRoleMember(id, dto.userId);
  }

  @Delete('roles/:id/members/:userId')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a user from a role' })
  async removeRoleMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.rbacService.removeRoleMember(id, userId);
  }

  // --- Role Permissions ---

  @Get('roles/:id/permissions')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'Get permissions assigned to a role with scopes' })
  async getRolePermissions(@Param('id', ParseUUIDPipe) id: string) {
    await this.rbacService.findRoleByIdOrFail(id);
    return this.rbacService.getRolePermissions(id);
  }

  @Put('roles/:id/permissions')
  @RequirePermission(RBAC_PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Set permissions for a role (full replace)' })
  async setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const actorPermissions = (user.permissions ?? {}) as BooleanPermissions;
    await this.rbacService.setRolePermissions(id, dto.permissions, actorPermissions);
    return this.rbacService.getRolePermissions(id);
  }

  // --- Permission Manifests ---

  @Get('permission-manifests')
  @RequirePermission(RBAC_PERMISSIONS.PERMISSIONS_READ)
  @ApiOperation({
    summary: 'List every registered permission manifest',
    description:
      'Returns slug, module, action, label, description, and supportedScopes for every permission the platform knows about. Drives the role-editor UI.',
  })
  async listPermissionManifests() {
    return this.manifestRegistry.list();
  }
}
