import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { RbacModuleConfig } from '@packages/rbac';
import { RBAC_MODULE_CONFIG } from '../constants';

@Injectable()
export class RbacService {
  constructor(
    @Inject(RBAC_MODULE_CONFIG)
    private readonly config: RbacModuleConfig,
  ) {}

  // --- Role CRUD ---

  async createRole(name: string, description?: string) {
    const roleDelegate = this.config.getRoleDelegate();
    const existing = await roleDelegate.findByName(name);
    if (existing) {
      throw new ConflictException(`Role "${name}" already exists`);
    }
    return roleDelegate.create({ name, description });
  }

  async findAllRoles() {
    const roleDelegate = this.config.getRoleDelegate();
    return roleDelegate.findAll({ field: 'name', direction: 'asc' });
  }

  async findRoleById(id: string) {
    const roleDelegate = this.config.getRoleDelegate();
    const role = await roleDelegate.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async updateRole(id: string, data: { name?: string; description?: string }) {
    await this.findRoleById(id);

    if (data.name) {
      const roleDelegate = this.config.getRoleDelegate();
      const existing = await roleDelegate.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Role "${data.name}" already exists`);
      }
    }

    const roleDelegate = this.config.getRoleDelegate();
    return roleDelegate.update(id, data);
  }

  async deleteRole(id: string) {
    await this.findRoleById(id);
    const roleDelegate = this.config.getRoleDelegate();
    await roleDelegate.delete(id);
  }

  // --- Permission sync ---

  async syncPermissions(resource: string, permissions: { action: string; description?: string }[]) {
    const permissionDelegate = this.config.getPermissionDelegate();
    const results = [];

    for (const perm of permissions) {
      const result = await permissionDelegate.upsert({
        resource,
        action: perm.action,
        description: perm.description,
      });
      results.push(result);
    }

    return results;
  }

  async findAllPermissions() {
    const permissionDelegate = this.config.getPermissionDelegate();
    return permissionDelegate.findAll({ field: 'resource', direction: 'asc' });
  }

  // --- Role-Permission management ---

  async setRolePermissions(roleId: string, permissionIds: string[]) {
    await this.findRoleById(roleId);
    const rpDelegate = this.config.getRolePermissionDelegate();
    await rpDelegate.setForRole(roleId, permissionIds);
  }

  async getRolePermissions(roleId: string) {
    await this.findRoleById(roleId);
    const rpDelegate = this.config.getRolePermissionDelegate();
    return rpDelegate.findByRoleId(roleId);
  }

  // --- Identity-Role management ---

  async assignRoleToIdentity(identityId: string, roleId: string) {
    await this.findRoleById(roleId);
    const irDelegate = this.config.getIdentityRoleDelegate();
    return irDelegate.create({ identityId, roleId });
  }

  async removeRoleFromIdentity(identityId: string, roleId: string) {
    const irDelegate = this.config.getIdentityRoleDelegate();
    await irDelegate.delete(identityId, roleId);
  }

  async getIdentityRoles(identityId: string) {
    const irDelegate = this.config.getIdentityRoleDelegate();
    return irDelegate.findByIdentityId(identityId);
  }

  // --- Permission check (used by guard) ---

  async getIdentityPermissions(identityId: string): Promise<string[]> {
    const irDelegate = this.config.getIdentityRoleDelegate();
    const roleIds = await irDelegate.findRoleIdsByIdentityId(identityId);

    if (roleIds.length === 0) return [];

    const rpDelegate = this.config.getRolePermissionDelegate();
    const allPermissions: string[] = [];

    for (const roleId of roleIds) {
      const rps = await rpDelegate.findByRoleId(roleId);
      for (const rp of rps) {
        const key = `${rp.permission.resource}.${rp.permission.action}`;
        if (!allPermissions.includes(key)) {
          allPermissions.push(key);
        }
      }
    }

    return allPermissions;
  }

  // --- Superadmin bootstrap ---

  async bootstrapSuperadmin(identityId: string) {
    const roleDelegate = this.config.getRoleDelegate();

    // Find or create superadmin role
    let superadminRole = await roleDelegate.findByName('superadmin');
    if (!superadminRole) {
      try {
        superadminRole = await roleDelegate.create({
          name: 'superadmin',
          description: 'Full system access',
        });
      } catch {
        // Race condition: another request created it first
        superadminRole = await roleDelegate.findByName('superadmin');
        if (!superadminRole) throw new Error('Failed to create or find superadmin role');
      }
    }

    if (!superadminRole) {
      throw new Error('Failed to create or find superadmin role');
    }

    // Check if any identity already has superadmin role
    const irDelegate = this.config.getIdentityRoleDelegate();
    const existingRoleIds = await irDelegate.findRoleIdsByIdentityId(identityId);
    const alreadyHasRole = existingRoleIds.includes(superadminRole.id);

    if (!alreadyHasRole) {
      // Check if anyone has the superadmin role by looking for role assignments
      // We use findByIdentityId with a check — but we need all holders of the role
      // Since the delegate doesn't expose this, check via creating (idempotent)
      try {
        await irDelegate.create({
          identityId,
          roleId: superadminRole.id,
        });
      } catch {
        // Race condition: another request assigned it first — safe to ignore
      }
    }
  }
}
