import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RbacService, RequirePermission } from '@packages/rbac-nestjs';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { SetRolePermissionsDto } from '../dto/set-role-permissions.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Post()
  @RequirePermission('rbac.roles.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto.name, dto.description);
  }

  @Get()
  @RequirePermission('rbac.roles.manage')
  async findAll() {
    return this.rbacService.findAllRoles();
  }

  @Get(':id')
  @RequirePermission('rbac.roles.manage')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacService.findRoleById(id);
  }

  @Patch(':id')
  @RequirePermission('rbac.roles.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete(':id')
  @RequirePermission('rbac.roles.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.rbacService.deleteRole(id);
  }

  @Get(':id/permissions')
  @RequirePermission('rbac.roles.manage')
  async getRolePermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacService.getRolePermissions(id);
  }

  @Put(':id/permissions')
  @RequirePermission('rbac.roles.manage')
  @HttpCode(HttpStatus.OK)
  async setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    await this.rbacService.setRolePermissions(id, dto.permissionIds);
    return this.rbacService.getRolePermissions(id);
  }

  @Get('/identities/:identityId/roles')
  @RequirePermission('rbac.roles.manage')
  async getIdentityRoles(@Param('identityId', ParseUUIDPipe) identityId: string) {
    return this.rbacService.getIdentityRoles(identityId);
  }

  @Post('/identities/:identityId/roles')
  @RequirePermission('rbac.roles.manage')
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Param('identityId', ParseUUIDPipe) identityId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rbacService.assignRoleToIdentity(identityId, dto.roleId);
  }

  @Delete('/identities/:identityId/roles/:roleId')
  @RequirePermission('rbac.roles.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRole(
    @Param('identityId', ParseUUIDPipe) identityId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.rbacService.removeRoleFromIdentity(identityId, roleId);
  }
}
