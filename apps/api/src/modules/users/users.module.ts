import { Module, type OnModuleInit } from '@nestjs/common';
import { PermissionRegistryService } from '@packages/rbac-nestjs';
import { UsersService } from './services/users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    private readonly permissionRegistry: PermissionRegistryService,
  ) {}

  onModuleInit() {
    this.permissionRegistry.register('users', [
      { action: 'create', description: 'Create users' },
      { action: 'read', description: 'View users' },
      { action: 'update', description: 'Edit users' },
      { action: 'delete', description: 'Delete users' },
    ]);
  }
}
