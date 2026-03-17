import { Global, Module } from '@nestjs/common';
import { RbacService } from './services/rbac.service';
import { PermissionRegistryService } from './services/permission-registry.service';
import { RbacGuard } from './guards/rbac.guard';

@Global()
@Module({
  providers: [PermissionRegistryService, RbacService, RbacGuard],
  exports: [RbacService, PermissionRegistryService, RbacGuard],
})
export class RbacModule {}
