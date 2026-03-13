export { RbacNestjsModule } from './rbac-nestjs.module';
export { RbacGuard } from './guards/rbac.guard';
export { RbacService } from './services/rbac.service';
export { PermissionRegistryService } from './services/permission-registry.service';
export type { RegisteredPermission, RegisteredResource } from './services/permission-registry.service';
export { RequirePermission } from './decorators/require-permission.decorator';
export { RBAC_MODULE_CONFIG, RBAC_CONFIGS_MAP, REQUIRE_PERMISSION_KEY } from './constants';
