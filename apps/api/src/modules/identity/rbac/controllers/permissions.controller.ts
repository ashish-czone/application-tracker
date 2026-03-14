import { Controller, Get } from '@nestjs/common';
import { RbacService, RequirePermission, PermissionRegistryService } from '@packages/rbac-nestjs';
import { IDENTITY_PERMISSIONS } from '../../permissions';

@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly permissionRegistry: PermissionRegistryService,
  ) {}

  @Get()
  @RequirePermission(IDENTITY_PERMISSIONS.PERMISSIONS_READ)
  async findAll() {
    return this.rbacService.findAllPermissions();
  }

  @Get('registry')
  @RequirePermission(IDENTITY_PERMISSIONS.PERMISSIONS_READ)
  async getRegistry() {
    return this.permissionRegistry.getAll();
  }
}
