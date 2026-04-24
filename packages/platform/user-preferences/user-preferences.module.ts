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
    this.rbacService.registerManifests([
      { slug: 'user-preferences.read',  module: 'user-preferences', action: 'read',  label: 'Read own preferences',  description: 'Read own user preferences',                   supportedScopes: ['any'] },
      { slug: 'user-preferences.write', module: 'user-preferences', action: 'write', label: 'Write own preferences', description: 'Create, update, and delete own user preferences', supportedScopes: ['any'] },
    ]);
  }
}
