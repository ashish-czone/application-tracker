import { Module, type OnModuleInit } from '@nestjs/common';
import { NotificationsModule } from '@packages/notifications';
import { RbacModule, RbacService } from '@packages/rbac';
import { NotificationRulesController } from './controllers/notification-rules.controller';
import { NotificationTemplatesController } from './controllers/notification-templates.controller';
import { AutomationsMetadataController } from './controllers/automations-metadata.controller';

@Module({
  imports: [NotificationsModule, RbacModule],
  controllers: [NotificationRulesController, NotificationTemplatesController, AutomationsMetadataController],
})
export class NotificationRulesModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('notifications', [
      { action: 'rules.read', description: 'View notification rules' },
      { action: 'rules.manage', description: 'Create, update, and delete notification rules' },
      { action: 'templates.read', description: 'View notification templates' },
      { action: 'templates.manage', description: 'Create, update, and delete notification templates' },
    ]);
  }
}
