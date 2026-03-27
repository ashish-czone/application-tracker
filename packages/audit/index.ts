export { AuditModule } from './audit.module';
export { AUDIT_PERMISSIONS } from './permissions';
export { AuditRegistryService } from './services/audit-registry.service';
export { AuditQueryService } from './services/audit-query.service';
export type {
  AuditLogRecord,
  ListAuditLogsQuery,
  AuditModuleRegistration,
  AuditAction,
} from './types';
export { auditLogs } from './schema';
export { computeDiff, inferAction, redactSensitiveFields } from './helpers/diff';
