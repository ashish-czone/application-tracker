import { Global, Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { AuditRegistryService } from './services/audit-registry.service';
import { AuditQueryService } from './services/audit-query.service';
import { AuditListener } from './listeners/audit.listener';
import { AuditLogsController } from './controllers/audit-logs.controller';

@Global()
@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: [
        { slug: 'audit.read_all', module: 'audit', action: 'read_all', label: 'View all audit logs', description: 'View firm-wide audit logs across every entity', supportedScopes: ['any'] },
      ],
    }),
  ],
  controllers: [AuditLogsController],
  providers: [AuditRegistryService, AuditQueryService, AuditListener],
  exports: [AuditRegistryService, AuditQueryService],
})
export class AuditModule {}
