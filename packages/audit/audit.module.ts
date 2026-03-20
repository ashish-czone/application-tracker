import { Global, Module } from '@nestjs/common';
import { AuditRegistryService } from './services/audit-registry.service';
import { AuditQueryService } from './services/audit-query.service';
import { AuditListener } from './listeners/audit.listener';

@Global()
@Module({
  providers: [AuditRegistryService, AuditQueryService, AuditListener],
  exports: [AuditRegistryService, AuditQueryService],
})
export class AuditModule {}
