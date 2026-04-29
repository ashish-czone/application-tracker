import { Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { UserPreferencesService } from './services/user-preferences.service';
import { UserPreferencesController } from './controllers/user-preferences.controller';

@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: [
        { slug: 'user-preferences.read',  module: 'user-preferences', action: 'read',  label: 'Read own preferences',  description: 'Read own user preferences',                       supportedScopes: ['any'] },
        { slug: 'user-preferences.write', module: 'user-preferences', action: 'write', label: 'Write own preferences', description: 'Create, update, and delete own user preferences', supportedScopes: ['any'] },
      ],
    }),
  ],
  controllers: [UserPreferencesController],
  providers: [UserPreferencesService],
  exports: [UserPreferencesService],
})
export class UserPreferencesModule {}
