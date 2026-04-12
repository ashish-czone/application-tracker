import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { UserPreferencesService } from './services/user-preferences.service';
import { UserPreferencesController } from './controllers/user-preferences.controller';

@Global()
@Module({
  controllers: [UserPreferencesController],
  providers: [UserPreferencesService],
  exports: [UserPreferencesService],
})
export class UserPreferencesModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('user-preferences', [
      { action: 'read', description: 'Read own user preferences' },
      { action: 'write', description: 'Create, update, and delete own user preferences' },
    ]);
  }
}
