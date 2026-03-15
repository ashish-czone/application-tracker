export { RbacModule } from './rbac.module';
export { RbacService } from './services/rbac.service';
export { PermissionRegistryService } from './services/permission-registry.service';
export { RbacGuard } from './guards/rbac.guard';
export { RequirePermission } from './decorators/require-permission.decorator';
export type { Role, Permission, PermissionRegistryEntry } from './types';
export { roles, permissions, rolePermissions, userRoles } from './schema';
