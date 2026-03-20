import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AuditLogsController } from './controllers/audit-logs.controller';

@Module({
  controllers: [AuditLogsController],
})
export class AuditManagementModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('audit', [
      { action: 'read', description: 'View audit logs' },
    ]);
  }
}
