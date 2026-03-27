export { RbacModule } from './rbac.module';
export { RbacService } from './services/rbac.service';
export { PermissionRegistryService } from './services/permission-registry.service';
export { RbacGuard } from './guards/rbac.guard';
export { RequirePermission } from './decorators/require-permission.decorator';
export { RBAC_PERMISSIONS } from './permissions';
export type { Role, RoleWithSystem, PermissionRegistryEntry, PermissionScope, ScopedPermissions } from './types';
export { roles, rolePermissions, userRoles } from './schema';
export { scopeFilter } from './helpers/scope-filter';
