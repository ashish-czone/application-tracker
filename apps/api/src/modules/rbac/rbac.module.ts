import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacModule as RbacPackageModule, RbacService } from '@packages/rbac';
import { RbacController } from './controllers/rbac.controller';

@Module({
  imports: [RbacPackageModule],
  controllers: [RbacController],
})
export class RbacManagementModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('rbac', [
      { action: 'roles.read', description: 'View roles' },
      { action: 'roles.manage', description: 'Create, update, and delete roles' },
      { action: 'permissions.read', description: 'View available permissions' },
    ]);
  }
}
