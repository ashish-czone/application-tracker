import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { AuditRegistryService } from './services/audit-registry.service';
import { AuditQueryService } from './services/audit-query.service';
import { AuditListener } from './listeners/audit.listener';
import { AuditLogsController } from './controllers/audit-logs.controller';

@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [AuditRegistryService, AuditQueryService, AuditListener],
  exports: [AuditRegistryService, AuditQueryService],
})
export class AuditModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('audit', [
      { action: 'read', description: 'View audit logs' },
    ]);
  }
}
