import { Controller, Get } from '@nestjs/common';
import { RbacService, RequirePermission, PermissionRegistryService } from '@packages/rbac-nestjs';

@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly permissionRegistry: PermissionRegistryService,
  ) {}

  @Get()
  @RequirePermission('rbac.roles.manage')
  async findAll() {
    return this.rbacService.findAllPermissions();
  }

  @Get('registry')
  @RequirePermission('rbac.roles.manage')
  async getRegistry() {
    return this.permissionRegistry.getAll();
  }
}
